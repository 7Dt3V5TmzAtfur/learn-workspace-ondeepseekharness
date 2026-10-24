/**
 * 用 _roles1/2/3 的手工角色判定，生成 chapter1 的逐段标注。
 *
 * 三条铁律：
 *   1. 217 段每一段都必须有手工判定，缺一段就报错退出 —— 不许用规则自动填
 *   2. quote 必须在原文里逐字找到（只容忍空白差异），否则报错退出
 *   3. quote 不能是碎片（<=6 字且段落不是标题）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import r1 from './case-roles-1.mjs'
import r2 from './case-roles-2.mjs'
import r3 from './case-roles-3.mjs'

const DIR = 'D:/learn/.study/chapter1-940885'
const segs = JSON.parse(readFileSync(`${DIR}/segments.json`, 'utf8')).items
const texts = new Map(
  JSON.parse(readFileSync(`${DIR}/segment-texts.json`, 'utf8')).items.map((t) => [t.id, String(t.text ?? '')]),
)

const ROLES = { ...r1, ...r2, ...r3 }

// ---- 1. 覆盖性：一段都不能漏 ----
const missingRole = segs.map((s) => s.id).filter((id) => !ROLES[id])
if (missingRole.length) {
  console.error(`有 ${missingRole.length} 段没有手工判定，拒绝生成：`)
  console.error('  ' + missingRole.join(', '))
  process.exit(1)
}
const extraRole = Object.keys(ROLES).filter((id) => !segs.some((s) => s.id === id))
if (extraRole.length) {
  console.error(`有 ${extraRole.length} 个段号不存在：${extraRole.join(', ')}`)
  process.exit(1)
}

// ---- 2. quote 必须逐字存在 ----
/**
 * 只容忍空白差异，其余逐字比对。
 * 之前用"先规范化再比较"（把括号、标点一起抹掉），
 * 结果既可能让非原文的串意外通过，也可能让真实子串失配。
 */
function quoteExists(text, quote) {
  const raw = String(text ?? '')
  if (raw.includes(quote)) return true
  const flat = raw.replace(/\s+/g, '')
  return flat.includes(quote.replace(/\s+/g, ''))
}

const items = []
const bad = []

for (const s of segs) {
  const [label, tier, title, quote, note] = ROLES[s.id]
  const text = texts.get(s.id) ?? ''

  if (!quoteExists(text, quote)) {
    bad.push(`${s.id}: quote「${quote}」不在原文里`)
    continue
  }
  // 碎片检查：<=6 字且段落不是纯标题
  const isHeading = /^#{1,6}\s/.test(text.trim()) || /^\*\*[^*]+\*\*[.。]?$/.test(text.trim())
  if (quote.replace(/\s+/g, '').length <= 6 && !isHeading) {
    bad.push(`${s.id}: quote「${quote}」是碎片（${quote.length} 字）`)
    continue
  }

  items.push({
    segmentId: s.id,
    label,
    tier,
    title,
    quote,
    ...(note ? { note } : {}),
  })
}

if (bad.length) {
  console.error(`有 ${bad.length} 段不合格，拒绝写入：`)
  for (const b of bad) console.error('  ' + b)
  process.exit(1)
}

// ---- 3. 预算与分布 ----
const effLen = (s) => String(s ?? '').replace(/\s+/g, '').length
const totalChars = segs.reduce((n, s) => n + (s.chars ?? 0), 0)
const byTier = { core: 0, hard: 0, ref: 0 }
for (const a of items) byTier[a.tier] += effLen(a.quote)
const labelCounts = {}
for (const a of items) labelCounts[a.label] = (labelCounts[a.label] ?? 0) + 1
const highlightedChars = byTier.core + byTier.hard + byTier.ref
const ratio = highlightedChars / totalChars

console.log(`段落 ${items.length} / ${segs.length}`)
console.log(
  `档位 core=${byTier.core}字(${((byTier.core / totalChars) * 100).toFixed(2)}%) ` +
    `hard=${byTier.hard}字(${((byTier.hard / totalChars) * 100).toFixed(2)}%) ` +
    `ref=${byTier.ref}字`,
)
console.log(`高亮占比 ${(ratio * 100).toFixed(2)}%`)
console.log(`标签分布 ${JSON.stringify(labelCounts)}`)

// 预算检查（core<=10%, hard<=8%, 总<=20%）
const problems = []
if (byTier.core / totalChars > 0.1) problems.push(`core 超 10%：${((byTier.core / totalChars) * 100).toFixed(2)}%`)
if (byTier.hard / totalChars > 0.08) problems.push(`hard 超 8%：${((byTier.hard / totalChars) * 100).toFixed(2)}%`)
if (ratio > 0.2) problems.push(`总数超 20%：${(ratio * 100).toFixed(2)}%`)
if (problems.length) {
  console.error('\n预算超标，拒绝写入：')
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

const out = {
  docId: 'chapter1-940885',
  savedAt: new Date().toISOString(),
  stats: {
    total: items.length,
    byTier,
    highlightedChars,
    totalChars,
    ratio,
    labelCounts,
  },
  items,
}
writeFileSync(`${DIR}/annotations.json`, JSON.stringify(out, null, 2), 'utf8')
console.log('已写入 annotations.json')
