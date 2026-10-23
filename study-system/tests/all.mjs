/**
 * 全部审计一次跑完。
 *
 * 之前是每次手敲一长串 node xxx.mjs，漏跑一个也不知道。
 * 这里统一入口，任何一项红色就整体退出码非 0。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const NODE = process.execPath

const SUITES = [
  ['run-tests.mjs', '单元 / 端到端 / 规则'],
  ['e2e-check.mjs', '真实 HTTP 接口'],
  ['audit-ui.mjs', '界面渲染内容'],
  ['audit-skills.mjs', '技能文档约束'],
  ['audit-requirements.mjs', '用户需求逐条'],
  ['audit-docs.mjs', '文档与代码一致'],
  ['audit-styles.mjs', '样式与变量'],
  ['check-render.mjs', 'Markdown 渲染'],
]

let totalPass = 0
const failed = []
const rows = []

for (const [file, what] of SUITES) {
  const r = spawnSync(NODE, [join(HERE, file)], { encoding: 'utf8' })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  const line = (out.match(/^(通过|符合).*$/m) ?? [''])[0].trim()
  const nums = line.match(/(\d+)\s*(\/\s*\d+)?/)
  // "通过 136 失败 0" 取 136；"符合 29/29" 取 29
  const n = nums ? Number(nums[1]) : 0
  const ok = r.status === 0
  if (ok) totalPass += n
  else failed.push({ file, out })
  rows.push({ file, what, line, ok })
}

const w = Math.max(...rows.map((r) => r.file.length))
console.log('\n' + '='.repeat(70))
for (const r of rows) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.file.padEnd(w)}  ${r.line || '（无汇总行）'}`)
}
console.log('='.repeat(70))
console.log(`合计通过 ${totalPass} 项，失败套件 ${failed.length} 个`)

if (failed.length) {
  for (const f of failed) {
    console.log(`\n---- ${f.file} ----`)
    console.log(f.out.slice(-2500))
  }
  process.exitCode = 1
} else {
  console.log('全部通过。')
}
