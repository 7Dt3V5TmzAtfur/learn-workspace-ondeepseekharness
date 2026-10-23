/** 列出所有"边穿节点"，并给出几何原因。 */
import { readFileSync } from 'node:fs'

const cand = JSON.parse(readFileSync('D:\\learn\\study-system\\tests\\.archify-test\\candidate.json', 'utf8'))
const byId = new Map(cand.components.map((c) => [c.id, c]))
const rect = (c) => ({ x: c.pos[0], y: c.pos[1], w: c.size[0], h: c.size[1] })

function segHitsRect(x1, y1, x2, y2, r) {
  // 只处理正交段（水平或垂直），采样判断
  const pts = []
  for (let t = 0; t <= 1; t += 0.02) pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t])
  return pts.some(([x, y]) => x > r.x + 4 && x < r.x + r.w - 4 && y > r.y + 4 && y < r.y + r.h - 4)
}

const SIDE_POINT = (r, side) => {
  if (side === 'top') return [r.x + r.w / 2, r.y]
  if (side === 'bottom') return [r.x + r.w / 2, r.y + r.h]
  if (side === 'left') return [r.x, r.y + r.h / 2]
  return [r.x + r.w, r.y + r.h / 2]
}

const bad = []
for (const conn of cand.connections) {
  const A = byId.get(conn.from)
  const B = byId.get(conn.to)
  if (!A || !B) continue
  const ra = rect(A)
  const rb = rect(B)
  const p0 = SIDE_POINT(ra, conn.fromSide ?? 'bottom')
  const p1 = SIDE_POINT(rb, conn.toSide ?? 'top')
  const pts = [p0, ...(conn.via ?? []), p1]
  const hits = []
  for (let k = 1; k < pts.length; k += 1) {
    for (const c of cand.components) {
      if (c.id === conn.from || c.id === conn.to) continue
      if (segHitsRect(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], rect(c))) {
        hits.push(c.id)
      }
    }
  }
  if (hits.length) bad.push({ id: conn.id, from: conn.from, to: conn.to, hits: [...new Set(hits)], pts, via: conn.via })
}

console.log(`穿节点的边: ${bad.length}/${cand.connections.length}`)
for (const b of bad) {
  const A = rect(byId.get(b.from))
  const B = rect(byId.get(b.to))
  console.log(`\n${b.from} -> ${b.to}`)
  console.log(`  源 pos=[${A.x},${A.y}] 目标 pos=[${B.x},${B.y}]  行差=${(B.y - A.y) / 154}`)
  console.log(`  穿过: ${b.hits.join(', ')}`)
  console.log(`  路径点: ${JSON.stringify(b.pts)}`)
  console.log(`  有 via: ${b.via ? 'yes' : 'NO'}`)
}
