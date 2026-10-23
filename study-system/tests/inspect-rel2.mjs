import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WS = 'D:\\learn'
const DOC = process.argv[2] ?? 'chapter4-d6eaed'
const rel = JSON.parse(readFileSync(join(WS, '.study', DOC, 'relations.json'), 'utf8'))
const pre = JSON.parse(readFileSync(join(WS, '.study', DOC, 'preflight.json'), 'utf8'))

console.log('=== 节点（含 id / kind / label）===')
for (const n of rel.nodes) console.log(`  ${n.id.padEnd(24)} ${String(n.kind ?? '').padEnd(12)} ${n.label}`)

console.log('\n=== 预检里的部分划分 ===')
;(pre.parts ?? []).forEach((p, i) => {
  console.log(`第${i + 1}部分: ${p.title}`)
  console.log(`  知识点: ${(p.knowledgePoints ?? []).map((k) => k.name).join(' / ')}`)
})

console.log('\n=== 弱连通分量（能否自然拆图）===')
const parent = new Map(rel.nodes.map((n) => [n.id, n.id]))
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)))
const union = (a, b) => {
  const ra = find(a)
  const rb = find(b)
  if (ra !== rb) parent.set(ra, rb)
}
for (const e of rel.edges) if (parent.has(e.from) && parent.has(e.to)) union(e.from, e.to)
const groups = new Map()
for (const n of rel.nodes) {
  const r = find(n.id)
  if (!groups.has(r)) groups.set(r, [])
  groups.get(r).push(n.id)
}
;[...groups.values()].sort((a, b) => b.length - a.length).forEach((g, i) => {
  console.log(`  分量${i + 1}: ${g.length} 个 -> ${g.join(', ')}`)
})
