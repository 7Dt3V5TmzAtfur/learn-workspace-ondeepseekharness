/** 通过 StudyService.saveRelations 走标准路径生成 archify 图（3 张）。 */
import { readFileSync } from 'node:fs'
const { StudyService } = await import('file:///D:/learn/study-system/plugin/lib/service.js')

const WS = 'D:/learn'
const DOC = 'chapter1-940885'
// StudyService 的构造参数是 workspace 路径，不是 store 实例
const svc = new StudyService(WS)

const rel = JSON.parse(readFileSync(`${WS}/.study/${DOC}/relations.json`, 'utf8'))
// 必须把 relationReview 一起带上：saveRelations 只写 {...graph}，
// 这里少传一个字段，落盘时就少了它，校验器会说"缺少 relationReview"。
const graph = {
  nodes: rel.nodes,
  edges: rel.edges,
  direction: rel.direction,
  relationReview: rel.relationReview,
}
if (!graph.relationReview) throw new Error('relations.json 里没有 relationReview，先跑 case-relations.mjs')

console.log('保存关系图并生成 archify 图…')
const res = await svc.saveRelations(DOC, graph)
console.log('校验:', res.check?.ok ? '通过' : '未通过')
if (res.check?.issues?.length) {
  for (const i of res.check.issues) console.log(`  [${i.level}] ${i.message}`)
}
console.log('图:', res.figures ? `${res.figures.figures?.length ?? 0} 张` : '未生成')
if (res.figures?.figures) {
  for (const f of res.figures.figures) {
    console.log(`  ${f.file}  ${f.nodeCount} 节点 ${f.edgeCount} 边  ${Math.round((f.sizeBytes ?? 0) / 1024)}KB  ok=${f.ok}`)
    if (f.diagnostics?.length) for (const d of f.diagnostics) console.log(`    [${d.code}] ${String(d.message).slice(0, 120)}`)
  }
}
