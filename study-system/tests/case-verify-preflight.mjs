/**
 * 校验 chapter1 的读前建构：既跑宿主校验器，也独立核对段号。
 */
const LIB = 'D:/learn/study-system/plugin/lib'
const { validatePreflight } = await import(`file://${LIB}/rules.js`)
const { readFileSync } = await import('node:fs')

const DIR = 'D:/learn/.study/chapter1-940885'
const plan = JSON.parse(readFileSync(`${DIR}/preflight.json`, 'utf8'))
const segs = JSON.parse(readFileSync(`${DIR}/segments.json`, 'utf8')).items

const res = validatePreflight(plan, { segCount: segs.length })
const issues = res.issues ?? []
const errs = issues.filter((i) => i.level === 'error')
const warns = issues.filter((i) => i.level !== 'error')

console.log(`===== 宿主校验器 =====`)
console.log(`错误 ${errs.length}　警告 ${warns.length}`)
for (const i of issues) console.log(`  [${i.level}] ${i.code ?? ''} ${i.message ?? ''}`)

// ---- 独立核对：结构 + 段号真实性 ----
const ids = new Set(segs.map((s) => s.id))
const problems = []
let kpTotal = 0
let kpWithIds = 0

for (const p of plan.parts ?? []) {
  if (!p.assessment?.level) problems.push(`「${p.title}」缺 assessment.level`)
  if (!p.assessment?.requirement) problems.push(`「${p.title}」缺 assessment.requirement`)
  if (!p.assessment?.purpose) problems.push(`「${p.title}」缺 assessment.purpose（警告）`)
  if (!p.knowledgePoints?.length) problems.push(`「${p.title}」没有 knowledgePoints`)

  for (const id of p.segmentIds ?? []) if (!ids.has(id)) problems.push(`「${p.title}」segmentIds 挂了不存在的 ${id}`)
  for (const id of p.unitIds ?? []) if (!ids.has(id)) problems.push(`「${p.title}」unitIds 挂了不存在的 ${id}`)

  for (const k of p.knowledgePoints ?? []) {
    kpTotal += 1
    if (k.segmentIds?.length) kpWithIds += 1
    else problems.push(`知识点「${k.name}」没有 segmentIds`)
    for (const id of k.segmentIds ?? []) {
      if (!ids.has(id)) problems.push(`知识点「${k.name}」挂了不存在的 ${id}`)
    }
  }
}

console.log(`\n===== 独立核对 =====`)
console.log(`parts: ${plan.parts?.length ?? 0}`)
console.log(`知识点回指：${kpWithIds}/${kpTotal}`)
console.log(`exercises: ${plan.exercises?.length ?? 0}　references: ${plan.references?.length ?? 0}`)
const levels = (plan.parts ?? []).map((p) => p.assessment?.level)
console.log(`档位分布：${levels.join(' / ')}`)
if (problems.length) {
  console.log(`\n问题 ${problems.length} 条：`)
  for (const x of problems) console.log('  ' + x)
} else {
  console.log('结构与段号全部正确')
}
process.exit(errs.length || problems.filter((x) => !x.includes('警告')).length ? 1 : 0)
