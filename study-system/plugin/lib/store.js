/**
 * 学习项目存储：<workspace>/.study/<docId>/
 *
 * 一个文档一个目录，所有阶段产物都是普通文件 —— 用户随时可以直接看、直接改，
 * 也方便备份和迁移。插件只负责读写与原子落盘，不做隐式格式转换。
 */
import { mkdir, readFile, writeFile, readdir, stat, rename, rm } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname, basename, extname, relative, isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'

export const STUDY_DIR_NAME = '.study'

export function projectRoot(workspace) {
  return join(workspace, STUDY_DIR_NAME)
}

/**
 * 从任意路径（资料文件、子目录、或工作区本身）向上找到真正的工作区。
 * 判据：该目录下存在 .study 子目录。
 *
 * 为什么需要它：用户手里只有"我的资料在哪"，不该被要求理解
 * "工作区"这个内部概念。把资料路径直接当工作区用，会去找
 * `<资料路径>\.study\`，那里永远没有东西。
 *
 * @returns 含 .study 的最近祖先目录；一个都没有则返回 null
 */
export function findWorkspaceRoot(input) {
  if (!input) return null
  let cur = resolve(String(input))
  // 传入的是文件（或看起来像文件）时，从它的父目录开始找
  try {
    if (existsSync(cur) && !statSyncIsDir(cur)) cur = dirname(cur)
  } catch {
    /* 路径不存在就按目录处理 */
  }
  for (let depth = 0; depth < 24; depth += 1) {
    if (existsSync(join(cur, STUDY_DIR_NAME))) return cur
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return null
}

function statSyncIsDir(p) {
  try {
    // 避免引入额外 import：用 readdir 是否成功来近似判断
    readdirSync(p)
    return true
  } catch (e) {
    return e?.code !== 'ENOTDIR'
  }
}

/** 列出某个目录树内所有含 .study 的目录（供界面自动发现）。 */
export function findWorkspaceRoots(seeds, maxDepth = 4) {
  const found = new Set()
  for (const seed of seeds) {
    if (!seed) continue
    const base = resolve(String(seed))
    if (!existsSync(base)) continue
    if (existsSync(join(base, STUDY_DIR_NAME))) {
      found.add(base)
      continue
    }
    // 广度向下搜有限层，找 .study
    const queue = [[base, 0]]
    while (queue.length) {
      const [dir, depth] = queue.shift()
      if (depth >= maxDepth) continue
      let entries = []
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('$')) continue
        const child = join(dir, entry.name)
        if (entry.name === STUDY_DIR_NAME) {
          found.add(dir)
          continue
        }
        queue.push([child, depth + 1])
      }
    }
  }
  return [...found]
}

export function slugify(title, fallback = 'doc') {
  const base = String(title ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
  const safe = base.replace(/\s+/g, '-').slice(0, 40) || fallback
  const hash = createHash('sha1').update(String(title ?? fallback) + Date.now()).digest('hex').slice(0, 6)
  return `${safe}-${hash}`
}

async function writeJson(file, value) {
  const tmp = `${file}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, file)
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** 读 JSONL 记录；文件不存在或某行损坏时跳过该行，不抛错。 */
async function readJsonl(file) {
  let raw = ''
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return []
  }
  const out = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      out.push(JSON.parse(trimmed))
    } catch {
      /* 跳过损坏行 */
    }
  }
  return out
}

export class StudyStore {
  constructor(workspace) {
    if (!workspace) throw new Error('StudyStore 需要一个工作区路径')
    this.workspace = resolve(workspace)
    this.root = projectRoot(this.workspace)
  }

  async ensure() {
    await mkdir(this.root, { recursive: true })
    return this.root
  }

  /** 解析项目目录，并确保它确实落在 .study 之下（防止路径穿越）。 */
  dir(docId) {
    if (!docId || typeof docId !== 'string') throw new Error('缺少 docId')
    if (/[\\/]|\.\./.test(docId)) throw new Error(`非法的 docId: ${docId}`)
    const target = resolve(this.root, docId)
    const rel = relative(this.root, target)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`非法的 docId: ${docId}`)
    return target
  }

  async list() {
    if (!existsSync(this.root)) return []
    const entries = await readdir(this.root, { withFileTypes: true })
    const out = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const meta = await readJson(join(this.root, entry.name, 'meta.json'))
      if (!meta) continue
      const progress = await this.progressOf(entry.name)
      out.push({ ...meta, progress })
    }
    return out.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
  }

  async meta(docId) {
    const meta = await readJson(join(this.dir(docId), 'meta.json'))
    if (!meta) throw new Error(`找不到学习项目 ${docId}`)
    return meta
  }

  async saveMeta(docId, patch) {
    const dir = this.dir(docId)
    await mkdir(dir, { recursive: true })
    const prev = (await readJson(join(dir, 'meta.json'))) ?? {}
    const next = { ...prev, ...patch, id: docId, updatedAt: new Date().toISOString() }
    await writeJson(join(dir, 'meta.json'), next)
    return next
  }

  async segments(docId) {
    return (await readJson(join(this.dir(docId), 'segments.json'), { items: [] })).items ?? []
  }

  async sourceText(docId) {
    try {
      return await readFile(join(this.dir(docId), 'source.md'), 'utf8')
    } catch {
      return ''
    }
  }

  async artifact(docId, name) {
    const file = join(this.dir(docId), name)
    if (!existsSync(file)) return null
    if (name.endsWith('.json')) return readJson(file)
    if (name.endsWith('.jsonl')) {
      const text = await readFile(file, 'utf8')
      return text
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line)
          } catch {
            return { raw: line }
          }
        })
    }
    return readFile(file, 'utf8')
  }

  async writeArtifact(docId, name, value) {
    const dir = this.dir(docId)
    await mkdir(dir, { recursive: true })
    const file = join(dir, name)
    if (name.endsWith('.json') || typeof value === 'object') {
      await writeJson(file, value)
    } else {
      await writeFile(file, String(value), 'utf8')
    }
    await this.saveMeta(docId, {})
    return file
  }

  async appendJsonl(docId, name, record) {
    const dir = this.dir(docId)
    await mkdir(dir, { recursive: true })
    const file = join(dir, name)
    const prefix = existsSync(file) ? '\n' : ''
    await writeFile(file, prefix + JSON.stringify(record), { encoding: 'utf8', flag: 'a' })
    return file
  }

  /** 读回 JSONL 记录（考核记录、术语追问等）。 */
  async jsonl(docId, name) {
    return readJsonl(join(this.dir(docId), name))
  }

  /** 计算各阶段完成度，界面进度条与"下一步"提示都读它。 */
  async progressOf(docId) {
    const dir = this.dir(docId)
    const has = (name) => existsSync(join(dir, name))
    const annotation = await readJson(join(dir, 'annotations.json'))
    const preflight = await readJson(join(dir, 'preflight.json'))
    // 读前建构阶段就会生成 quiz.md（思考题），所以它不能代表"已考核"。
    // 真正的考核完成以学习者自己提交过复述/答题记录为准。
    const drillRecords = await readJsonl(join(dir, 'drills.jsonl')).catch(() => [])
    return {
      ingested: has('source.md'),
      planned: Boolean(preflight?.summary),
      annotated: Boolean(annotation?.items?.length),
      drilled: drillRecords.length > 0,
      mapped: has('relations.json'),
      annotatedCount: annotation?.items?.length ?? 0,
      drillCount: drillRecords.length,
      segmentCount: (await this.segments(docId)).length,
    }
  }

  async fullProject(docId) {
    const [meta, segments, source, preflight, annotations, relations, quiz, refs, terms, drills, progress] =
      await Promise.all([
        this.meta(docId),
        this.segments(docId),
        this.sourceText(docId),
        this.artifact(docId, 'preflight.json'),
        this.artifact(docId, 'annotations.json'),
        this.artifact(docId, 'relations.json'),
        this.artifact(docId, 'quiz.md'),
        this.artifact(docId, 'refs.md'),
        this.jsonl(docId, 'terms.jsonl'),
        this.jsonl(docId, 'drills.jsonl'),
        this.progressOf(docId),
      ])
    return {
      meta,
      segments,
      source,
      preflight,
      annotations,
      relations,
      quiz,
      refs,
      terms,
      drills,
      progress,
    }
  }

  async remove(docId) {
    const dir = this.dir(docId)
    await rm(dir, { recursive: true, force: true })
  }

  /**
   * 把一个任意路径的文件复制进项目目录并保留原名，
   * 供界面预览原始文件（PDF/图片）。
   */
  async importOriginal(docId, filePath) {
    const dir = this.dir(docId)
    await mkdir(join(dir, 'original'), { recursive: true })
    const name = basename(filePath)
    const target = join(dir, 'original', name)
    await writeFile(target, await readFile(filePath))
    return { name, size: (await stat(target)).size }
  }
}
