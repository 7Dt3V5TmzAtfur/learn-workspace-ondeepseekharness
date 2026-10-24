/**
 * 架构不变量：这些断言守护的是"同一概念只有一份实现"，不是行为。
 *
 * 为什么单独一套：它们跨文件、跨半身（宿主 / 界面），既不属于文档一致性，
 * 也不属于某一层的行为测试。放在这里，重构时该红的地方才会红。
 *
 * 运行：node tests/audit-architecture.mjs
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const client = read('plugin/client.js')
const service = read('plugin/lib/service.js')
const store = read('plugin/lib/store.js')
const rules = read('plugin/lib/rules.js')

let pass = 0
let fail = 0
const problems = []

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  ✓ ${name}`)
  } else {
    fail += 1
    problems.push(`${name}${detail ? `\n      ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`)
  }
}

console.log('\n1. 阶段真相只有宿主一份')

check(
  'client 不自带阶段表',
  !/const STAGES\s*=\s*\[/.test(client),
  'client.js 里又出现了本地 STAGES 数组；阶段名/顺序/判据应读 /stages',
)
check(
  'client 不写死阶段按钮文案',
  !/STAGE_WORD/.test(client),
  '按钮文案应来自 rules.js 的 action/redo',
)
check(
  '每个阶段都声明 progressKey / action / redo',
  ['preflight', 'annotate', 'map', 'recall', 'feynman'].every((k) => {
    const seg = rules.slice(rules.indexOf(`${k}: {`), rules.indexOf(`${k}: {`) + 320)
    return /progressKey:/.test(seg) && /action:/.test(seg) && /redo:/.test(seg)
  }),
  'rules.js 的 STAGES 少字段，界面会退回自己猜',
)

console.log('\n2. 正文只有一个读取入口')

check(
  'service 不再直接读 segment-texts.json',
  !/artifact\(docId, 'segment-texts\.json'\)/.test(service),
  '正文应只经 store.segmentTexts() 读取；直接读会重新长出第二种兜底',
)
check(
  'store 提供 segmentTexts()',
  /async segmentTexts\(docId\)/.test(store),
  '缺了它，九处会重新各拼一次 Map',
)

console.log('\n3. 持久化只有一扇门')

check(
  'artifact() 不处理 .jsonl',
  !/name\.endsWith\('\.jsonl'\)/.test(store),
  'JSONL 应只走 jsonl()：它跳过坏行，而 artifact 曾返回 {raw} 占位对象',
)
check(
  '没有代码往 meta.stage 写死阶段',
  !/saveMeta\(docId, \{ stage:/.test(service),
  'stage 由 progressOf 推导，写 meta.stage 只会制造第二个真相',
)

console.log('\n4. 校验失败不留正式产物')

const rel = service.slice(service.indexOf('async saveRelations'), service.indexOf('async saveQuiz'))
check(
  'relations.json 只在 check.ok 时写',
  /check\.ok \? 'relations\.json' : 'relations\.rejected\.json'/.test(rel),
  '无条件写正式产物会把阶段错误推进到 mapped',
)

console.log('\n' + '─'.repeat(62))
console.log('\n5. 写入口与取数不重复')

check(
  '追问只有一个写入点',
  (client.match(/api\('\/term'/g) ?? []).length === 1,
  '两处各 POST 一次会生成两条待答记录，答案判据永远为假',
)
check(
  '阶段表只请求一次',
  (client.match(/api\('\/stages'\)/g) ?? []).length === 1,
  'Workbench 与 DockBar 各取一次，白白多一个请求且失败面翻倍',
)
check(
  '精读页按资料 id 挂载',
  /key: project\.id/.test(client),
  '按固定 key 挂载会把上一份资料的 paused/recalls 串到新资料上',
)

if (fail > 0) {
  console.log('\n架构不变量被破坏：\n')
  problems.forEach((p, i) => console.log(`${i + 1}. ${p}`))
}
console.log(`通过 ${pass}　失败 ${fail}`)
process.exit(fail === 0 ? 0 : 1)
