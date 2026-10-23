/**
 * 多格式文档提取：任意格式 → 纯文本 + 结构线索。
 *
 * 设计要点
 * - 纯 Node 实现，零第三方依赖：DOCX/PPTX/XLSX/EPUB 本质是 ZIP + XML，
 *   用一个最小的 ZIP 读取器（中央目录 + inflateRaw）即可，不依赖 Python/pandoc。
 * - PDF 优先调用 pdftotext（若系统有），否则退回内置的最小解析器（只处理
 *   FlateDecode 文本流），再不行给出可操作的错误，而不是抛一个看不懂的异常。
 * - 编码：先按 BOM 判断，再试 UTF-8 严格解码，失败退回 GB18030（中文文档常见）。
 */
import { readFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/* ------------------------------------------------------------------ 编码 */

function decodeText(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buf.subarray(3))
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2))
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buf.subarray(2))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buf)
    } catch {
      return buf.toString('latin1')
    }
  }
}

/* --------------------------------------------------------------- ZIP 读取 */

function findEndOfCentralDirectory(buf) {
  const stop = Math.max(0, buf.length - 66_000)
  for (let i = buf.length - 22; i >= stop; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

/**
 * 读取 ZIP 内所有条目，返回 name → Buffer。
 * 只支持 stored(0) 与 deflate(8)，足够覆盖 OOXML 与 EPUB。
 */
export function readZip(buf) {
  const eocd = findEndOfCentralDirectory(buf)
  if (eocd < 0) throw new Error('不是有效的 ZIP 文件（找不到中央目录）')
  const count = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)
  const files = new Map()

  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break
    const method = buf.readUInt16LE(offset + 10)
    const compressedSize = buf.readUInt32LE(offset + 20)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const localOffset = buf.readUInt32LE(offset + 42)
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen)

    if (buf.readUInt32LE(localOffset) === 0x04034b50) {
      const localNameLen = buf.readUInt16LE(localOffset + 26)
      const localExtraLen = buf.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + localNameLen + localExtraLen
      const raw = buf.subarray(dataStart, dataStart + compressedSize)
      try {
        files.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw))
      } catch {
        /* 单个条目坏掉不阻断整份文档 */
      }
    }
    offset += 46 + nameLen + extraLen + commentLen
  }
  return files
}

/* ------------------------------------------------------------------ XML */

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

/** 把一段 HTML/XHTML 变成带段落边界的纯文本。 */
export function htmlToText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section|article|pre|dd|dt)>/gi, '\n\n')
    .replace(/<(h[1-6])\b[^>]*>/gi, (m, tag) => `\n\n${'#'.repeat(Number(tag[1]))} `)
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<td\b[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
  s = decodeXmlEntities(s)
  return normalizeWhitespace(s)
}

export function normalizeWhitespace(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** 从 OOXML 段落集合里取文字，保留段落边界。 */
function ooxmlParagraphs(xml, { pTag = 'w:p', tTag = 'w:t' } = {}) {
  const paragraphs = []
  const pRe = new RegExp(`<${pTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${pTag}>`, 'g')
  const tRe = new RegExp(`<${tTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tTag}>`, 'g')
  let m
  while ((m = pRe.exec(xml)) !== null) {
    const inner = m[1]
    let text = ''
    let t
    while ((t = tRe.exec(inner)) !== null) text += decodeXmlEntities(t[1])
    tRe.lastIndex = 0
    if (inner.includes('<w:tab/>') || inner.includes('<w:br/>')) text = text || ''
    paragraphs.push(text)
  }
  return paragraphs
}

/* ------------------------------------------------------------- 各格式 */

async function extractDocx(buf) {
  const zip = readZip(buf)
  const doc = zip.get('word/document.xml')
  if (!doc) throw new Error('DOCX 缺少 word/document.xml')
  const xml = decodeText(doc)
  // 标题样式：<w:pStyle w:val="Heading1"/> 转成 Markdown 标题
  const parts = []
  const pRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g
  const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
  let m
  while ((m = pRe.exec(xml)) !== null) {
    const inner = m[1]
    let text = ''
    let t
    while ((t = tRe.exec(inner)) !== null) text += decodeXmlEntities(t[1])
    tRe.lastIndex = 0
    const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(inner)?.[1] ?? ''
    const heading = /^Heading(\d)$/i.exec(style)
    if (heading) parts.push(`${'#'.repeat(Number(heading[1]))} ${text.trim()}`)
    else if (text.trim()) parts.push(text.trim())
  }
  // Word 的每个 <w:p> 都是一个自然段，用空行分隔，segmentText 才能逐段切分
  return normalizeWhitespace(parts.join('\n\n'))
}

async function extractPptx(buf) {
  const zip = readZip(buf)
  const slides = [...zip.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)/.exec(a)[1]) - Number(/(\d+)/.exec(b)[1]))
  if (slides.length === 0) throw new Error('PPTX 中没有幻灯片')
  const out = []
  slides.forEach((name, i) => {
    const xml = decodeText(zip.get(name))
    const paragraphs = ooxmlParagraphs(xml, { pTag: 'a:p', tTag: 'a:t' }).filter((p) => p.trim())
    out.push(`## 幻灯片 ${i + 1}\n\n${paragraphs.join('\n\n')}`)
  })
  return normalizeWhitespace(out.join('\n\n'))
}

async function extractXlsx(buf) {
  const zip = readZip(buf)
  const sharedRaw = zip.get('xl/sharedStrings.xml')
  const shared = []
  if (sharedRaw) {
    const xml = decodeText(sharedRaw)
    const siRe = /<si>([\s\S]*?)<\/si>/g
    let m
    while ((m = siRe.exec(xml)) !== null) {
      let text = ''
      const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g
      let t
      while ((t = tRe.exec(m[1])) !== null) text += decodeXmlEntities(t[1])
      shared.push(text)
    }
  }
  const sheets = [...zip.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()
  const out = []
  sheets.forEach((name, i) => {
    const xml = decodeText(zip.get(name))
    const rows = []
    const rowRe = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g
    let rm
    while ((rm = rowRe.exec(xml)) !== null) {
      const cells = []
      const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g
      let cm
      while ((cm = cRe.exec(rm[1])) !== null) {
        const attrs = cm[1]
        const body = cm[2]
        const type = /t="([^"]+)"/.exec(attrs)?.[1]
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        if (type === 's' && v !== undefined) cells.push(shared[Number(v)] ?? '')
        else if (type === 'inlineStr') {
          const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g
          let text = ''
          let t
          while ((t = tRe.exec(body)) !== null) text += decodeXmlEntities(t[1])
          cells.push(text)
        } else cells.push(v === undefined ? '' : decodeXmlEntities(v))
      }
      if (cells.some((c) => c !== '')) rows.push(cells.join(' | '))
    }
    if (rows.length) out.push(`## 工作表 ${i + 1}\n\n${rows.join('\n')}`)
  })
  if (out.length === 0) throw new Error('XLSX 中没有可读单元格')
  return normalizeWhitespace(out.join('\n\n'))
}

async function extractEpub(buf) {
  const zip = readZip(buf)
  const containerRaw = zip.get('META-INF/container.xml')
  let spine = []
  if (containerRaw) {
    const opfPath = /full-path="([^"]+)"/.exec(decodeText(containerRaw))?.[1]
    const opf = opfPath ? zip.get(opfPath) : undefined
    if (opf) {
      const opfXml = decodeText(opf)
      const manifest = new Map()
      const itemRe = /<item\b[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*\/?>/g
      let m
      while ((m = itemRe.exec(opfXml)) !== null) manifest.set(m[1], m[2])
      const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
      const refRe = /<itemref\b[^>]*idref="([^"]+)"/g
      while ((m = refRe.exec(opfXml)) !== null) {
        const href = manifest.get(m[1])
        if (href) spine.push(baseDir + href)
      }
    }
  }
  if (spine.length === 0) {
    spine = [...zip.keys()].filter((n) => /\.x?html?$/i.test(n)).sort()
  }
  const out = []
  for (const name of spine) {
    const entry = zip.get(name) ?? zip.get(decodeURIComponent(name))
    if (!entry) continue
    out.push(htmlToText(decodeText(entry)))
  }
  if (out.length === 0) throw new Error('EPUB 中没有可读章节')
  return normalizeWhitespace(out.join('\n\n'))
}

async function extractRtf(buf) {
  const text = decodeText(buf)
  return normalizeWhitespace(
    text
      .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\par[d]?/g, '\n')
      .replace(/\{\\\*[\s\S]*?\}/g, '')
      .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
      .replace(/[{}]/g, ''),
  )
}

/** 内置的最小 PDF 解析器：只处理 FlateDecode 的 Tj/TJ 文本操作符。 */
function extractPdfBuiltin(buf) {
  const out = []
  const latin = buf.toString('latin1')
  const streamRe = /stream\r?\n?/g
  let m
  while ((m = streamRe.exec(latin)) !== null) {
    const start = m.index + m[0].length
    const end = latin.indexOf('endstream', start)
    if (end < 0) continue
    const raw = buf.subarray(start, end)
    let content = null
    try {
      content = inflateRawSync(raw).toString('latin1')
    } catch {
      content = null
    }
    if (!content) continue
    const textRe = /\((?:\\.|[^\\()])*\)/g
    const wordRe = /\[((?:\((?:\\.|[^\\()])*\)|[^\]])*)\]\s*TJ/g
    let t
    let chunk = ''
    while ((t = textRe.exec(content)) !== null) {
      const value = t[0].slice(1, -1).replace(/\\([()\\])/g, '$1').replace(/\\n/g, '\n')
      chunk += value
    }
    if (wordRe.test(content)) chunk += '\n'
    if (chunk.trim()) out.push(chunk)
  }
  return normalizeWhitespace(out.join('\n'))
}

async function extractPdf(buf, filePath) {
  try {
    const { stdout } = await execFileAsync(
      'pdftotext',
      ['-layout', '-enc', 'UTF-8', filePath, '-'],
      { maxBuffer: 128 * 1024 * 1024, timeout: 120_000, windowsHide: true },
    )
    const text = normalizeWhitespace(stdout)
    if (text.length > 0) return text
  } catch {
    /* 系统没有 pdftotext：走内置解析器 */
  }
  const builtin = extractPdfBuiltin(buf)
  if (builtin.length > 20) return builtin
  throw new Error(
    'PDF 没有可提取的文本层（可能是扫描件）。请安装 poppler 的 pdftotext，' +
      '或先用 OCR 工具转换为可复制文本的 PDF/Word 后再导入。',
  )
}

/* ------------------------------------------------------------- 对外入口 */

export const TEXT_EXTENSIONS = new Set([
  '.txt', '.text', '.md', '.markdown', '.csv', '.tsv', '.json', '.yaml', '.yml',
  '.log', '.srt', '.vtt', '.rtf', '.tex', '.py', '.js', '.ts', '.java', '.c', '.cpp',
  '.go', '.rs', '.sql', '.ini', '.toml', '.xml',
])

const HTML_EXTENSIONS = new Set(['.html', '.htm', '.xhtml', '.mhtml'])

/**
 * 提取文档为纯文本。
 * @param {string} filePath 源文件绝对路径
 * @param {Buffer} buf 文件内容
 * @returns {Promise<{ text: string, format: string, warning?: string }>}
 */
export async function extractDocument(filePath, buf) {
  const lower = filePath.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot) : ''

  if (ext === '.pdf') return { text: await extractPdf(buf, filePath), format: 'pdf' }
  if (ext === '.docx') return { text: await extractDocx(buf), format: 'docx' }
  if (ext === '.pptx') return { text: await extractPptx(buf), format: 'pptx' }
  if (ext === '.xlsx' || ext === '.xlsm') return { text: await extractXlsx(buf), format: 'xlsx' }
  if (ext === '.epub') return { text: await extractEpub(buf), format: 'epub' }
  if (ext === '.rtf') return { text: await extractRtf(buf), format: 'rtf' }
  if (HTML_EXTENSIONS.has(ext)) return { text: htmlToText(decodeText(buf)), format: 'html' }

  if (ext === '.doc') {
    // 旧版二进制 DOC 无纯 JS 解法：先尝试当作纯文本找可见片段
    const fallback = normalizeWhitespace(decodeText(buf).replace(/[^\x09\x0a\x20-\x7e\u4e00-\u9fa5\u3000-\u303f]+/g, ' '))
    if (fallback.length > 200) {
      return { text: fallback, format: 'doc', warning: '旧版 .doc 为二进制格式，提取结果可能不完整；建议另存为 .docx 后重新导入。' }
    }
    throw new Error('无法解析旧版 .doc 文件，请用 Word 另存为 .docx 后重试。')
  }

  if (TEXT_EXTENSIONS.has(ext) || ext === '') {
    return { text: normalizeWhitespace(decodeText(buf)), format: ext === '' ? 'text' : ext.slice(1) }
  }

  // 未知扩展名：尝试当作文本，若几乎全是控制字符则拒绝
  const guess = normalizeWhitespace(decodeText(buf))
  const printable = guess.replace(/[\s\S]/g, (c) => (c.charCodeAt(0) < 32 && c !== '\n' && c !== '\t' ? '' : c))
  if (guess.length > 0 && printable.length / guess.length > 0.85) {
    return { text: guess, format: ext.slice(1), warning: `未识别的扩展名 ${ext}，已按纯文本处理。` }
  }
  throw new Error(`不支持的文件格式：${ext || '未知'}。支持 pdf/docx/pptx/xlsx/epub/html/md/txt/rtf 等。`)
}

/** 从磁盘读取并提取。 */
export async function extractFile(filePath) {
  const buf = await readFile(filePath)
  return extractDocument(filePath, buf)
}

/* ---------------------------------------------------------------- 分段 */

/**
 * 把文本切成段落单元，带稳定锚点 ¶N 与章节信息。
 * 用户要求"不盲目按换行切，按意思切段"，这里做保守处理：
 * 合并过短的续行、保留标题结构，把真正的语义切分留给模型在标注阶段做。
 */
export function segmentText(text) {
  const lines = text.split('\n')
  const segments = []
  let chapter = ''
  let buf = []
  let ordinal = 0

  const flush = () => {
    const body = buf.join('\n').trim()
    buf = []
    if (!body) return
    ordinal += 1
    segments.push({
      id: `¶${ordinal}`,
      ordinal,
      chapter,
      chars: body.length,
      lead: body.replace(/\s+/g, ' ').slice(0, 60),
      text: body,
    })
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      if (heading[1].length <= 2) chapter = heading[2].trim()
      buf.push(line)
      flush()
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    buf.push(line)
    // 单个段落过长时按句子边界兜底切割，避免一段几千字。
    // 阈值取得比较宽：真实段落（几百字、七八句）应当保持完整，
    // 只有明显是"整篇没有分段的裸文本"才需要切开。
    const joined = buf.join('\n')
    const sentenceCount = (joined.match(/[。！？；.!?;]/g) ?? []).length
    if (joined.length > 1200 || (joined.length > 600 && sentenceCount >= 12)) {
      const sentences = joined.split(/(?<=[。！？；.!?;])/)
      const chunks = []
      let chunk = ''
      for (const sentence of sentences) {
        if (chunk.length + sentence.length > 800 && chunk) {
          chunks.push(chunk)
          chunk = ''
        }
        chunk += sentence
      }
      if (chunk.trim()) chunks.push(chunk)
      buf = []
      for (const piece of chunks) {
        const body = piece.trim()
        if (!body) continue
        ordinal += 1
        segments.push({
          id: `¶${ordinal}`,
          ordinal,
          chapter,
          chars: body.length,
          lead: body.replace(/\s+/g, ' ').slice(0, 60),
          text: body,
        })
      }
    }
  }
  flush()
  return segments
}
