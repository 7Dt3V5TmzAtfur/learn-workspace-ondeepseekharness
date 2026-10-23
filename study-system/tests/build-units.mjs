/**
 * 生成 units.json —— 学习工作台的组织骨架。
 *
 * ## 为什么要这一层
 *
 * 之前 182 段是平铺的：用户看不到"这份资料分几块、每块讲什么"，
 * preflight 的 4 个 parts 是模型自己编的切法，跟原文 20 个真实小节没有 ID 关联，
 * 图谱 33 个节点也 0 个能指回段落。三处断裂同一个病根：缺一个中间层。
 *
 * ## 怎么切
 *
 * 原文有两种小标题：
 *   1. Markdown 标题 `## 执行工具`
 *   2. 加粗单独成段 `**安全机制的层次化设计。**`
 *
 * 只认第一种会得到 20 块，其中「执行工具」一块就有 45 段 6333 字 ——
 * 相当于别的块的 20 倍，左侧列表明显失衡。
 * 第二种是原文作者自己分的小节，认它就得到 27 块，最均衡。
 *
 * 所以两者都认。判断规则：整段只有 `**...**` 且短于 30 字，就是小标题。
 *
 * ## 不做什么
 *
 * 不做"每单元必须有 N 个知识点"这类配额。参考项目自己都承认
 * "不设数量上限"是它的优点 —— 一旦有配额，模型就会凑。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'D:/learn/.study/chapter4-d6eaed'

const segs = JSON.parse(readFileSync(`${DIR}/segments.json`, 'utf8')).items
const texts = new Map(
  JSON.parse(readFileSync(`${DIR}/segment-texts.json`, 'utf8')).items.map((t) => [t.id, String(t.text ?? '')]),
)
const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')).items
const pre = JSON.parse(readFileSync(`${DIR}/preflight.json`, 'utf8'))

/** 整段只有一个加粗短语（可带结尾标点），视为小标题 */
function boldHeading(raw) {
  const t = raw.trim()
  if (!t || t.length > 40) return null
  const m = /^\*\*([^*]+)\*\*[.。：:]?$/.exec(t)
  // 去掉标题末尾的句号：原文写「**安全机制的层次化设计。**」，
  // 直接拿来当标题会变成「…设计。」，列表里一排句号很难看
  return m ? m[1].trim().replace(/[.。：:]+$/, '') : null
}

/** Markdown 标题 */
function mdHeading(raw) {
  const t = raw.trim()
  const m = /^(#{1,6})\s+(.+)$/.exec(t)
  if (!m) return null
  return { level: m[1].length, title: m[2].replace(/\*\*/g, '').trim() }
}

/** 扫出所有小节起点 */
const byOrd = new Map(segs.map((s) => [s.ordinal, s]))
const marks = []
for (const s of segs) {
  const raw = texts.get(s.id) ?? ''
  const md = mdHeading(raw)
  if (md) {
    marks.push({ id: s.id, ord: s.ordinal, title: md.title, level: md.level, kind: 'md' })
    continue
  }
  const bold = boldHeading(raw)
  if (bold) marks.push({ id: s.id, ord: s.ordinal, title: bold, level: 9, kind: 'bold' })
}

// 段范围：从本小节起点到下一小节起点之前
for (let i = 0; i < marks.length; i++) {
  marks[i].endOrd = marks[i + 1] ? marks[i + 1].ord : segs.length + 1
}

/**
 * 处理 Markdown 大标题与紧随的加粗小标题之间的关系。
 *
 * 两种情形要相反的处理，靠字数判断：
 *
 * A. 大标题本身几乎是空的（`## 执行工具` 后面直接是 `**安全机制…**`）：
 *    合并，否则左侧会出现一个点进去什么都没有的条目。
 *
 * B. 大标题下挂了很多加粗小节，合起来超过 MAX_MERGED_CHARS：
 *    不合并，让每个小节独立成单元，否则一个单元 45 段 6333 字，
 *    是别的单元的 20 倍，列表明显失衡，用户也不知道从哪看起。
 */
const MIN_MD_CHARS = 300
const MAX_MERGED_CHARS = 2500

function charsBetween(fromOrd, toOrd) {
  let n = 0
  for (let o = fromOrd; o < toOrd; o++) n += byOrd.get(o)?.chars ?? 0
  return n
}

const merged = []
for (let i = 0; i < marks.length; i++) {
  const m = marks[i]
  m.startOrd = m.ord
  if (m.kind === 'md') {
    const own = charsBetween(m.startOrd, m.endOrd)
    const next = marks[i + 1]
    if (own < MIN_MD_CHARS && next && next.kind === 'bold') {
      // 情形 A：合并紧邻的加粗小节，直到凑够量或遇到下一个大标题
      m.absorbed = m.absorbed ?? []
      let j = i + 1
      while (j < marks.length && marks[j].kind === 'bold') {
        m.absorbed.push(marks[j].title)
        m.endOrd = marks[j].endOrd
        marks[j].skip = true
        j += 1
        // 已经凑够就不再多吞，避免反而吞成巨块
        if (charsBetween(m.startOrd, m.endOrd) >= MAX_MERGED_CHARS) break
      }
    }
    // 情形 B：不合并，后面的加粗小节照常独立
  }
  if (!m.skip) merged.push(m)
}

// 第一小节之前若有内容（导语），单独成块
const first = marks[0]
const headLead =
  first && first.ord > segs[0].ordinal
    ? {
        id: 'u00',
        title: '本章要解决的问题',
        level: 0,
        kind: 'lead',
        startOrd: segs[0].ordinal,
        endOrd: first.ord,
      }
    : null

const annMap = new Map(ann.map((a) => [a.segmentId, a]))

/** 组装一个单元 */
function buildUnit(m, idx) {
  const ids = []
  let chars = 0
  for (let o = m.startOrd ?? m.ord; o < m.endOrd; o++) {
    const s = byOrd.get(o)
    if (!s) continue
    ids.push(s.id)
    chars += s.chars ?? 0
  }
  // 这个单元里的核心档标注 —— 也就是用户会被要求停下来回想的那些点
  const keyPoints = ids
    .map((id) => annMap.get(id))
    .filter((a) => a && a.tier === 'core')
    .map((a) => ({ segmentId: a.segmentId, title: a.title, quote: a.quote }))

  return {
    id: m.id,
    title: m.title,
    level: m.level,
    kind: m.kind,
    segmentIds: ids,
    segmentCount: ids.length,
    chars,
    keyPoints,
    // 被并进来的子小节标题：不丢信息，界面可以当小目录显示
    ...(m.absorbed?.length ? { subsections: m.absorbed } : {}),
    // 原文可在哪一节精确回查
    sourceRange: { from: ids[0], to: ids[ids.length - 1] },
  }
}

const units = []
if (headLead) units.push(buildUnit(headLead, 0))
for (const m of merged) units.push(buildUnit(m, units.length))

// ---- 校验 ----
const problems = []

// 1. 覆盖完整：每个段落必须恰好属于一个单元
const seen = new Map()
for (const u of units) for (const id of u.segmentIds) seen.set(id, (seen.get(id) ?? 0) + 1)
const segIds = segs.map((s) => s.id)
const missing = segIds.filter((id) => !seen.has(id))
const dup = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
if (missing.length) problems.push(`有 ${missing.length} 段不属于任何单元：${missing.slice(0, 5).join(',')}`)
if (dup.length) problems.push(`有 ${dup.length} 段被多个单元收进去：${dup.slice(0, 5).join(',')}`)

// 2. 不许有空单元
const empty = units.filter((u) => u.segmentCount === 0)
if (empty.length) problems.push(`出现空单元：${empty.map((u) => u.title).join(',')}`)

// 3. 每个单元都要能回查原文
const noRange = units.filter((u) => !u.sourceRange?.from || !u.sourceRange?.to)
if (noRange.length) problems.push(`有 ${noRange.length} 个单元没有原文范围`)

// 4. 标题不带句号（原文 **…设计。** 直接拿来会变成一排「…设计。」）
const dotTitle = units.filter((u) => /[。.：:]$/.test(u.title))
if (dotTitle.length) problems.push(`标题带句号：${dotTitle.map((u) => u.title).join(', ')}`)

// 5. 大小不失衡：最大块不该超过最小块的 40 倍
//    差太多时左侧列表明显失衡，用户不知道该从哪看起
const widths = units.map((u) => u.chars).filter((n) => n > 0)
const ratio = Math.max(...widths) / Math.min(...widths)
if (ratio > 40) problems.push(`切分失衡：最大 ${Math.max(...widths)} 字 / 最小 ${Math.min(...widths)} 字 = ${ratio.toFixed(1)} 倍`)

if (problems.length) {
  console.error('单元切分校验不通过：')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

const out = {
  docId: 'chapter4-d6eaed',
  generatedAt: new Date().toISOString(),
  // 单元是骨架：原文小节 ↔ 段落 ↔ 知识点 靠它串起来
  totalUnits: units.length,
  totalSegments: segs.length,
  units,
}

writeFileSync(`${DIR}/units.json`, JSON.stringify(out, null, 2), 'utf8')

// ---- 报告 ----
console.log(`切成 ${units.length} 个单元，覆盖 ${segs.length} 段\n`)
const allWidths = units.map((u) => u.chars)
const sorted = [...allWidths].sort((a, b) => a - b)
console.log('字数分布：')
console.log(`  最小 ${sorted[0]}　中位 ${sorted[Math.floor(sorted.length / 2)]}　最大 ${sorted[sorted.length - 1]}`)
console.log('')
for (const u of units) {
  const bar = '█'.repeat(Math.max(1, Math.round(u.chars / 220)))
  const kp = u.keyPoints.length ? ` 核心${u.keyPoints.length}` : ''
  console.log(`  ${u.title.slice(0, 26).padEnd(28)} ${String(u.segmentCount).padStart(2)}段 ${String(u.chars).padStart(5)}字${kp.padEnd(8)} ${bar}`)
}

// 超大单元提示
const big = units.filter((u) => u.chars > 3000)
if (big.length) {
  console.log(`\n注意：${big.length} 个单元超过 3000 字，可能需要再切`)
  for (const u of big) console.log(`  ${u.title}（${u.chars} 字）`)
}
