import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WS = 'D:\\learn'
const DOC = process.argv[2] ?? 'chapter4-d6eaed'
const rel = JSON.parse(readFileSync(join(WS, '.study', DOC, 'relations.json'), 'utf8'))

const types = new Map()
for (const e of rel.edges) types.set(e.relation, (types.get(e.relation) ?? 0) + 1)
console.log('关系类型分布:', [...types.entries()].map(([k, v]) => `${k}×${v}`).join(' '))
console.log('节点数:', rel.nodes.length, '边数:', rel.edges.length)

const kinds = new Map()
for (const n of rel.nodes) kinds.set(n.kind ?? 'concept', (kinds.get(n.kind ?? 'concept') ?? 0) + 1)
console.log('节点类型:', [...kinds.entries()].map(([k, v]) => `${k}×${v}`).join(' '))

// 度数分布
const deg = new Map(rel.nodes.map((n) => [n.id, { out: 0, in: 0 }]))
for (const e of rel.edges) {
  if (deg.has(e.from)) deg.get(e.from).out += 1
  if (deg.has(e.to)) deg.get(e.to).in += 1
}
const roots = rel.nodes.filter((n) => deg.get(n.id).in === 0)
const leaves = rel.nodes.filter((n) => deg.get(n.id).out === 0)
console.log(`\n入度为0（根）: ${roots.length}`)
roots.forEach((n) => console.log(`  ${n.id}  out=${deg.get(n.id).out}`))
console.log(`\n出度为0（叶）: ${leaves.length}`)

// 最长路径深度（按所有边，不限类型）
const adj = new Map(rel.nodes.map((n) => [n.id, []]))
for (const e of rel.edges) if (adj.has(e.from)) adj.get(e.from).push(e.to)
const depth = new Map()
function d(id, seen = new Set()) {
  if (depth.has(id)) return depth.get(id)
  if (seen.has(id)) return 0
  seen.add(id)
  let m = 0
  for (const t of adj.get(id) ?? []) m = Math.max(m, d(t, seen) + 1)
  seen.delete(id)
  depth.set(id, m)
  return m
}
for (const n of rel.nodes) d(n.id)
const byDepth = new Map()
for (const [id, v] of depth) {
  if (!byDepth.has(v)) byDepth.set(v, [])
  byDepth.get(v).push(id)
}
console.log('\n按最长路径深度分组（深度=到最远叶子的距离，用于自底向上分层）:')
;[...byDepth.entries()].sort((a, b) => b[0] - a[0]).forEach(([k, v]) => console.log(`  深度 ${k}: ${v.length} 个`))
