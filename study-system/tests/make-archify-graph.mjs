import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { relationsToArchify } from '../plugin/lib/archify-graph.js'

const WS = 'D:\\learn'
const DOC = process.argv[2] ?? 'chapter4-d6eaed'
const rel = JSON.parse(readFileSync(join(WS, '.study', DOC, 'relations.json'), 'utf8'))

const outDir = join(WS, 'study-system', 'tests', '.archify-test')
mkdirSync(outDir, { recursive: true })

const cand = relationsToArchify(rel, {
  title: '知识点逻辑衔接图',
  // archify 要求 meta.output 是相对 cwd 的路径
  output: 'study-system/tests/.archify-test/graph.html',
})
writeFileSync(join(outDir, 'candidate.json'), JSON.stringify(cand, null, 2), 'utf8')

console.log(`component 数: ${cand.components.length}`)
console.log(`connection 数: ${cand.connections.length}`)
console.log(`layout: 绝对坐标`)
const rows = new Map()
for (const c of cand.components) {
  const y = c.pos[1]
  rows.set(y, (rows.get(y) ?? 0) + 1)
}
const sortedRows = [...rows.entries()].sort((a, b) => a[0] - b[0])
console.log(`分行: ${sortedRows.map(([y, n]) => `y${y}:${n}`).join(' ')}`)
const maxX = Math.max(...cand.components.map((c) => c.pos[0] + c.size[0]))
const maxY = Math.max(...cand.components.map((c) => c.pos[1] + c.size[1]))
console.log(`画布: ${maxX}x${maxY}`)
console.log(`\n候选已写入 ${join(outDir, 'candidate.json')}`)
