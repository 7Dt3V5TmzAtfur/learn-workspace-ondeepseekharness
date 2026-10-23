/**
 * 用真实项目数据验证渲染修复效果。
 *
 * 只验证可程序化判定的东西：
 * - 字面量 `**` 是否清零
 * - 表格是否变成 <table>
 * - 高亮是否还在
 * - 段落整体是否仍未被染色（不能倒退到 v1 的错误）
 *
 * 注意：这不能证明"好看"——好看只能由人看图判断。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderAnnotatedHtml } from '../plugin/lib/rules.js'

const WS = process.argv[2] ?? 'D:\\learn'
const DOC = process.argv[3] ?? 'chapter4-d6eaed'
const DIR = join(WS, '.study', DOC)

if (!existsSync(join(DIR, 'segments.json'))) {
  console.error(`找不到 ${DIR}/segments.json`)
  process.exit(1)
}

const segmentsRaw = JSON.parse(readFileSync(join(DIR, 'segments.json'), 'utf8'))
// segments.json 的形状是 { totalChars, items: [...] }，不是裸数组
const segments = Array.isArray(segmentsRaw) ? segmentsRaw : (segmentsRaw.items ?? [])
const texts = new Map(
  (JSON.parse(readFileSync(join(DIR, 'segment-texts.json'), 'utf8')).items ?? []).map((t) => [t.id, t.text]),
)
const ann = JSON.parse(readFileSync(join(DIR, 'annotations.json'), 'utf8'))

const withText = segments.map((s) => ({ ...s, text: texts.get(s.id) ?? s.lead ?? '' }))
const html = renderAnnotatedHtml(withText, ann)

const count = (re) => (html.match(re) ?? []).length

console.log(`项目 ${DOC}：${segments.length} 段，${ann.items.length} 条标注\n`)
console.log('=== 修复前 → 修复后 ===')
const rows = [
  ['字面量 ** 残留', 422, count(/\*\*/g)],
  ['<table> 数量', 0, count(/<table/g)],
  ['三色高亮 <strong class=sc-hl-*>', 37, count(/<strong class="sc-hl-\w+">/g)],
  ['整段染色（应为 0）', 0, count(/class="sc-seg sc-hl/g)],
  ['<strong> 总数（正文粗体）', null, count(/<strong>/g)],
  ['<code> 数量', null, count(/<code>/g)],
  ['<li> 数量', null, count(/<li>/g)],
]
for (const [name, before, after] of rows) {
  const b = before === null ? '  ?' : String(before).padStart(4)
  console.log(`  ${name.padEnd(36)} ${b} → ${String(after).padStart(5)}`)
}

console.log('\n=== 判定 ===')
let ok = true
const bad = []
if (count(/\*\*/g) > 0) {
  bad.push(`还有 ${count(/\*\*/g)} 处字面量 **`)
  ok = false
}
if (count(/<strong class="sc-hl-\w+">/g) !== ann.items.length) {
  bad.push(`高亮数 ${count(/<strong class="sc-hl-\w+">/g)} ≠ 标注数 ${ann.items.length}`)
  ok = false
}
if (count(/class="sc-seg sc-hl/g) > 0) {
  bad.push('出现整段染色')
  ok = false
}
if (count(/<table/g) === 0) {
  bad.push('没有生成任何表格')
  ok = false
}

if (ok) console.log('  ✓ 全部通过')
else {
  for (const b of bad) console.log(`  ✗ ${b}`)
  process.exitCode = 1
}

// 抽一段原始含表格的段落，看看真实产物
const tableSeg = withText.find((s) => /^\|/.test(String(s.text).trim()))
if (tableSeg) {
  console.log(`\n=== 样例：${tableSeg.id}（原含表格）渲染结果前 600 字 ===`)
  const one = renderAnnotatedHtml([tableSeg], { items: [] })
  console.log(one.slice(0, 600))
}
