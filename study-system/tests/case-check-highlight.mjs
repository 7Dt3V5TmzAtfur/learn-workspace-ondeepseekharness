import { readFileSync } from 'node:fs'

const html = readFileSync('D:/learn/_ann.html', 'utf8')
const segs = JSON.parse(readFileSync('D:/learn/.study/chapter1-940885/segments.json', 'utf8')).items
const texts = new Map(
  JSON.parse(readFileSync('D:/learn/.study/chapter1-940885/segment-texts.json', 'utf8')).items.map((t) => [
    t.id,
    String(t.text),
  ]),
)
const ann = JSON.parse(readFileSync('D:/learn/.study/chapter1-940885/annotations.json', 'utf8'))

// 逐段比较：高亮字数 / 整段字数
const bySeg = new Map()
for (const item of ann.items) bySeg.set(item.segmentId, item)

let whole = 0
let maxRatio = 0
let maxId = ''
const rows = []
for (const s of segs) {
  const a = bySeg.get(s.id)
  if (!a) continue
  const textLen = String(texts.get(s.id) ?? '').replace(/\s/g, '').length
  const qLen = String(a.quote).replace(/\s/g, '').length
  if (!textLen) continue
  const ratio = qLen / textLen
  rows.push({ id: s.id, ratio, qLen, textLen, tier: a.tier })
  if (ratio >= 0.99) whole += 1
  if (ratio > maxRatio) {
    maxRatio = ratio
    maxId = s.id
  }
}

console.log(`整段变色（quote 占满 100%）: ${whole} 段`)
console.log(`最高占比: ${maxId} = ${(maxRatio * 100).toFixed(0)}%`)
console.log('')

// 平均占比
const avg = rows.reduce((n, r) => n + r.ratio, 0) / rows.length
console.log(`平均 quote 占段落: ${(avg * 100).toFixed(1)}%`)

// 分布
const buckets = { '<30%': 0, '30-60%': 0, '60-90%': 0, '>=90%': 0 }
for (const r of rows) {
  if (r.ratio < 0.3) buckets['<30%'] += 1
  else if (r.ratio < 0.6) buckets['30-60%'] += 1
  else if (r.ratio < 0.9) buckets['60-90%'] += 1
  else buckets['>=90%'] += 1
}
console.log('占比分布:', JSON.stringify(buckets))

console.log('\n占段落最多的 5 段（quote 偏长的嫌疑）:')
for (const r of rows.sort((a, b) => b.ratio - a.ratio).slice(0, 5)) {
  console.log(`  ${r.id} ${(r.ratio * 100).toFixed(0)}%  quote ${r.qLen}字 / 段 ${r.textLen}字  [${r.tier}]`)
}
