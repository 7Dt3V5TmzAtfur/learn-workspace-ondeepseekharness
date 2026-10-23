/**
 * 导出某项目的图谱布局为 JSON，供 preview_graph.py 画成 PNG 人眼检查。
 * 用法：node tests/dump-graph.mjs [docId]
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DOC = process.argv[2] ?? 'chapter4-d6eaed'
const WS = 'D:\\learn'
const LIB = join('D:', 'learn', 'study-system', 'plugin', 'lib')
const { StudyService } = await import(`file://${join(LIB, 'service.js')}`)

const svc = new StudyService(WS)
const project = await svc.project(DOC, { width: 1400 })
if (!project.graphLayout) {
  console.error(`「${DOC}」没有 relations，无法导出图谱布局`)
  process.exit(1)
}

const out = join('D:', 'learn', 'study-system', 'tests', '_graph.json')
writeFileSync(out, JSON.stringify(project.graphLayout))
console.log(`已导出 ${out}`)
console.log(
  `  ${project.graphLayout.nodes.length} 节点 / ${project.graphLayout.edges.length} 边 / ${project.graphLayout.width}x${project.graphLayout.height}`,
)
