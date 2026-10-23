/**
 * 为历史标注补 quote。
 *
 * 背景：三色高亮规则改成"必须指出原文片段"后，早期按整段标注的
 * 项目数据里没有 quote，渲染出来一个高亮都没有。
 * 这里做一次性回填：从段落正文里挑一句最能代表该段的短语。
 *
 * 挑选策略（按优先级）：
 * 1. 段落里第一句中文引号或书名号里的内容（通常是术语）
 * 2. 段落第一句（到第一个句号/问号/分号）
 * 3. 段落前 24 字
 * 只做机械挑选，不猜测语义——真正的 quote 应该由模型给。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const WS = process.argv[2] ?? 'D:\\learn'
const DOC = process.argv[3] ?? 'chapter4-d6eaed'
const DIR = join(WS, '.study', DOC)

const annPath = join(DIR, 'annotations.json')
const textsPath = join(DIR, 'segment-texts.json')
if (!existsSync(annPath) || !existsSync(textsPath)) {
  console.error('缺文件')
  process.exit(1)
}

const ann = JSON.parse(readFileSync(annPath, 'utf8'))
const texts = new Map(JSON.parse(readFileSync(textsPath, 'utf8')).items.map((t) => [t.id, t.text]))

function pickQuote(text) {
  // 注意：不要把换行压成空格——quote 必须逐字出现在原文里，
  // 表格行里的 quote 一旦压缩空白就再也匹配不上。
  const t = String(text ?? '').trim()
  if (!t) return ''
  // 1. 引号/书名号里的术语
  const quoted = t.match(/[「『“"]([^」』”"]{2,24})[」』”"]/)
  if (quoted && t.includes(quoted[1])) return quoted[1]
  // 2. 第一句（单行内）
  const firstSentence = t.match(/^([^。！？；\n]{4,40})[。！？；]/)
  if (firstSentence) return firstSentence[1]
  // 3. 第一行前 24 字（表格行就取整行片段）
  const firstLine = t.split('\n').find((l) => l.trim()) ?? ''
  const clipped = [...firstLine.trim()].slice(0, Math.min(24, [...firstLine.trim()].length)).join('')
  return clipped
}

let filled = 0
let kept = 0
let missing = 0
for (const item of ann.items ?? []) {
  // 已有 quote 也要校验是否真在原文里；不在就重新挑（旧数据可能被压缩过空白）
  const curText = texts.get(item.segmentId) ?? ''
  if (item.quote && item.quote.trim() && curText.includes(item.quote)) {
    kept += 1
    continue
  }
  const text = texts.get(item.segmentId)
  if (!text) {
    missing += 1
    continue
  }
  const q = pickQuote(text)
  if (q) {
    item.quote = q
    filled += 1
  } else {
    missing += 1
  }
}

ann.backfilledAt = new Date().toISOString()
ann.backfillNote = 'quote 由脚本从原文机械回填，建议让模型重新精标'
writeFileSync(annPath, JSON.stringify(ann, null, 2), 'utf8')

console.log(`总标注 ${ann.items.length} 条：已有 quote ${kept}，回填 ${filled}，无法回填 ${missing}`)
console.log('\n回填样例：')
ann.items
  .filter((i) => i.quote)
  .slice(0, 8)
  .forEach((i) => console.log(`  ${i.segmentId} [${i.label}/${i.tier}] 「${i.quote}」`))

// 校验回填结果：quote 必须真的在原文里
let bad = 0
for (const i of ann.items) {
  const t = texts.get(i.segmentId) ?? ''
  if (i.quote && !t.includes(i.quote)) bad += 1
}
console.log(`\nquote 不在原文中的条数: ${bad}`)
