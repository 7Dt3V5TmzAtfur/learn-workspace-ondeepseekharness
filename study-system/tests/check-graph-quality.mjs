/** 程序化检查图谱布局质量（替代人眼看图）。用法：node tests/check-graph-quality.mjs [docId] */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DOC = process.argv[2] ?? 'chapter4-d6eaed'
const WS = 'D:\\learn'
const LIB = join('D:', 'learn', 'study-system', 'plugin', 'lib')
const { StudyService } = await import(`file://${join(LIB, 'service.js')}`)

const svc = new StudyService(WS)
const project = await svc.project(DOC, { width: 1400, withLayout: true })
const g = project.graphLayout
if (!g) {
  console.error('该项目没有 relations，无法检查图谱布局')
  process.exit(1)
}
const rel = JSON.parse(readFileSync(join(WS, '.study', DOC, 'relations.json'), 'utf8'))
const labelOf = new Map(rel.nodes.map((n) => [n.id, n.label]))

const byId = new Map(g.nodes.map((n) => [n.id, n]))

let issues = 0
const warn = (m) => {
  issues += 1
  console.log(`  ! ${m}`)
}

console.log(`画布 ${g.width}x${g.height}，${g.nodes.length} 节点，${g.edges.length} 边`)

// 1. 节点标签长度是否超出宽度（11 中文字 ≈ 168px 宽，够）
let longLabels = 0
for (const n of g.nodes) {
  const w = [...n.label].reduce((a, c) => a + (/[\u4e00-\u9fa5]/.test(c) ? 12 : 6.6), 0)
  if (w > n.w - 12) longLabels += 1
}
console.log(`\n1. 标签宽度`)
console.log(`   超出节点宽度的标签: ${longLabels}/${g.nodes.length}`)
if (longLabels > 0) {
  for (const n of g.nodes) {
    const w = [...n.label].reduce((a, c) => a + (/[\u4e00-\u9fa5]/.test(c) ? 12 : 6.6), 0)
    if (w > n.w - 12) console.log(`     ${n.id}: ${w.toFixed(0)}px > ${n.w - 12}px  「${n.label}」`)
  }
}

// 2. 边长是否过长（跨层越远，线越乱）
const layerOf = new Map(g.nodes.map((n) => [n.id, n.layer]))
let longEdges = 0
for (const e of g.edges) {
  const span = Math.abs((layerOf.get(e.to) ?? 0) - (layerOf.get(e.from) ?? 0))
  if (span > 3) longEdges += 1
}
console.log(`\n2. 边长跨度`)
console.log(`   跨 3 层以上的边: ${longEdges}/${g.edges.length}`)

// 3. 边是否穿过其他节点的矩形（会看不清）
//    与客户端一致：直接用宿主给出的折线拐点 points
function edgeSamples(e) {
  const pts = e.points ?? [
    [e.x1, e.y1],
    [e.x2, e.y2],
  ]
  const out = []
  for (let k = 1; k < pts.length; k += 1) {
    const [x1, y1] = pts[k - 1]
    const [x2, y2] = pts[k]
    for (let t = 0; t <= 1; t += 0.04) out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t])
  }
  return out
}

function crossesRect(pts, r) {
  for (const [x, y] of pts) {
    if (x >= r.x + 5 && x <= r.x + r.w - 5 && y >= r.y + 5 && y <= r.y + r.h - 5) return true
  }
  return false
}

let crossings = 0
const crossingDetail = []
for (const e of g.edges) {
  const pts = edgeSamples(e)
  for (const n of g.nodes) {
    if (n.id === e.from || n.id === e.to) continue
    if (crossesRect(pts, n)) {
      crossings += 1
      if (crossingDetail.length < 6) crossingDetail.push(`${e.from}→${e.to} 穿过「${labelOf.get(n.id)}」`)
      break
    }
  }
}
console.log(`\n3. 边穿过其他节点`)
console.log(`   穿节点数: ${crossings}/${g.edges.length}`)
for (const c of crossingDetail) console.log(`     ${c}`)

// 4. 层内分布是否均衡
const lay = new Map()
for (const n of g.nodes) {
  if (!lay.has(n.layer)) lay.set(n.layer, 0)
  lay.set(n.layer, lay.get(n.layer) + 1)
}
const sizes = [...lay.values()]
console.log(`\n4. 分层均衡度`)
console.log(`   每层节点数: ${sizes.join(' / ')}（共 ${sizes.length} 层）`)
const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length
const maxDev = Math.max(...sizes.map((s) => Math.abs(s - avg)))
console.log(`   平均 ${avg.toFixed(1)}，最大偏离 ${maxDev.toFixed(1)}`)

// 5. 孤立节点
const deg = new Map(g.nodes.map((n) => [n.id, 0]))
for (const e of g.edges) {
  deg.set(e.from, (deg.get(e.from) ?? 0) + 1)
  deg.set(e.to, (deg.get(e.to) ?? 0) + 1)
}
const isolated = [...deg.entries()].filter(([, d]) => d === 0)
console.log(`\n5. 孤立节点`)
console.log(`   度为 0 的节点: ${isolated.length}`)
for (const [id] of isolated) console.log(`     ${labelOf.get(id)}`)

console.log(`\n${'─'.repeat(50)}`)
console.log(`结构性警告 ${issues} 条、穿节点 ${crossings} 处、孤立 ${isolated.length} 个`)
