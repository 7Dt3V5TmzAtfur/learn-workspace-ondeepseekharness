/**
 * 校验 DESIGN.md 与代码不脱节。
 *
 * 为什么需要：这份文档上一轮写着「核心 = 蓝 --sc-ink-blue」，
 * 而实际 CSS 是橙 #f59e0b，变量名也早就改成了 --sc-core-line。
 * 文档写错比文档缺失更糟 —— 后来的人会照着做，然后发现对不上。
 *
 * 这里只查"能被程序判定"的硬事实：颜色值、变量名、节号、文件清单。
 * 措辞好坏查不了，那靠人。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'D:/learn/study-system'
const doc = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8')
const client = readFileSync(join(ROOT, 'plugin/client.js'), 'utf8')
const rules = readFileSync(join(ROOT, 'plugin/lib/rules.js'), 'utf8')

let pass = 0
const fails = []

function check(name, ok, why) {
  if (ok) {
    pass += 1
    console.log(`  ✓ ${name}`)
  } else {
    fails.push({ name, why })
    console.log(`  ✗ ${name}\n      → ${why}`)
  }
}

console.log('\n1. 三色：文档写的颜色要和 CSS 一致')

// 从 client.js 里读实际值，而不是把值再写一遍
function cssVar(name) {
  const m = new RegExp(`--sc-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(client)
  return m ? m[1].toLowerCase() : null
}

for (const [tier, label] of [
  ['core', '核心'],
  ['hard', '攻坚'],
  ['ref', '参考'],
]) {
  const line = cssVar(`${tier}-line`)
  check(
    `${label}档颜色 ${line} 出现在文档里`,
    Boolean(line) && doc.includes(line),
    line ? `CSS 里 --sc-${tier}-line 是 ${line}，文档没写这个值` : `CSS 里找不到 --sc-${tier}-line`,
  )
  check(
    `${label}档变量名 --sc-${tier}-line 出现在文档里`,
    doc.includes(`--sc-${tier}-line`),
    `文档没提 --sc-${tier}-line，读者不知道去改哪个变量`,
  )
}

console.log('\n2. 文档里不该留不存在的变量')

// 收集 client.js 里真实定义的 --sc-* 变量
const defined = new Set([...client.matchAll(/(--sc-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))
// 文档正文里提到的 --sc-* 变量（跳过 CSS 代码块里的示例）
const mentioned = [...doc.matchAll(/(--sc-[a-z0-9-]+)/g)].map((m) => m[1])
const ghost = [...new Set(mentioned)].filter((v) => !defined.has(v))
check(
  '文档提到的 CSS 变量都真实存在',
  ghost.length === 0,
  `文档写了不存在的变量：${ghost.join(', ')}`,
)

console.log('\n3. 字节号不重复')

const sections = [...doc.matchAll(/^## (\S+)\.?\s/gm)].map((m) => m[1])
const dup = sections.filter((s, i) => sections.indexOf(s) !== i)
check('一级节号不重复', dup.length === 0, `重复节号：${[...new Set(dup)].join(', ')}`)

console.log('\n4. 数据契约表列全了落盘文件')

// service/store 实际会读写的产物
const ARTIFACTS = [
  'meta.json',
  'segments.json',
  'units.json',
  'preflight.json',
  'annotations.json',
  'relations.json',
  'terms.jsonl',
  'quiz.md',
  'refs.md',
]
const missing = ARTIFACTS.filter((f) => !doc.includes(f))
check('每个产物文件都在文档里', missing.length === 0, `文档漏了：${missing.join(', ')}`)

console.log('\n5. 第一性原理写在文档最前面')

const fpIdx = doc.indexOf('## 0. 第一性原理')
const firstSec = doc.indexOf('## 1.')
check(
  '第 0 节就是第一性原理',
  fpIdx > 0 && fpIdx < firstSec,
  '第一性原理不写在最前面，后面的取舍就没有依据',
)
check(
  '写明了错误的第一性原理',
  /错误的第一性原理[\s\S]{0,200}学完/.test(doc),
  '只写对的、不写错过的，读者不知道为什么要这么改',
)
check(
  '写了三条推论分别决定什么',
  /推论.*设计后果|设计后果/s.test(doc),
  '没有推论就只是口号',
)

console.log('\n6. 三色来源要如实标注')

check(
  '说明三色收敛与配色是本系统自定',
  /我们自己定的|不是原则里的/.test(doc),
  '原则只给了七类语义，没说收敛成几档、用什么颜色；写成"来自原则"是错的',
)
check(
  '说明哪部分真的来自原则',
  /来自 `原则\/` 的是/.test(doc),
  '要区分哪些是原则要求、哪些是自己的决定',
)

console.log('\n7. 文档提到的预算与实际校验一致')

const budget = /TOTAL_HIGHLIGHT_BUDGET\s*=\s*([\d.]+)/.exec(rules)
check(
  `文档写的 10–20% 与代码一致（代码 ${budget ? budget[1] : '?'}）`,
  Boolean(budget) && doc.includes('10–20%') && Number(budget[1]) === 0.2,
  '文档说 20% 而代码是别的值，用户会以为被多标了',
)

const frag = /FRAGMENT_QUOTE_MAX_CHARS\s*=\s*(\d+)/.exec(rules)
check(
  '碎片阈值写进了文档',
  Boolean(frag) && doc.includes('FRAGMENT_QUOTE_MAX_CHARS'),
  '文档不提这个规则，Agent 不会知道碎片会被判',
)

console.log('\n8. 阶段名的三种叫法必须统一')

/**
 * 之前界面叫「读完自测」「费曼考核」，服务端叫「读后自测」「读后考核」，
 * 技能文档叫「读后巩固」「读后考核」——三套名字。
 * 用户说"我要做费曼考核"，Agent 却在找 study-recall，就串线了。
 */
const { STAGES } = await import('../plugin/lib/rules.js')
const service = readFileSync(join(ROOT, 'plugin/lib/service.js'), 'utf8')
const index = readFileSync(join(ROOT, 'plugin/index.js'), 'utf8')

const canonical = Object.values(STAGES).map((s) => s.name)
check(
  '五个阶段的正式名唯一',
  canonical.length === 5 && new Set(canonical).size === 5,
  `STAGES 里的名字有重复：${canonical.join(', ')}`,
)

// 界面兜底数组里的名字必须与 STAGES 完全一致
const fallbackNames = [...client.matchAll(/label: '([^']+)', stage:/g)].map((m) => m[1])
check(
  '界面的兜底页签与 STAGES 同名同序',
  fallbackNames.join('|') === canonical.join('|'),
  `界面兜底是 [${fallbackNames.join(', ')}]，STAGES 是 [${canonical.join(', ')}]`,
)

// 服务端的提示语不能自己写死旧名字
const deadNames = ['读后自测', '费曼考核']
for (const dead of deadNames) {
  check(
    `服务端提示语不再出现旧名「${dead}」`,
    !service.includes(dead),
    `service.js 里还有「${dead}」，与界面和技能文档不一致`,
  )
}

// 注释里可以提旧名（那是解释为什么改名），代码里的文案不行
const clientCodeOnly = client
  .split('\n')
  .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
  .join('\n')
check(
  '界面文案里不再出现旧名「读完自测」',
  !clientCodeOnly.includes('读完自测'),
  'client.js 的界面文案还有「读完自测」，与 STAGES 的「读后巩固」不一致',
)

check(
  '有 /stages 接口供界面取真值',
  /route === '\/stages'/.test(index),
  '界面写死名字，改一处要改三处，迟早再次漂移',
)

check(
  '文档写明阶段状态也只有一个真值',
  /stageFromProgress/.test(doc),
  'meta.stage 与 progress 打架过一次，文档要留下这条教训',
)

check(
  '文档写明 nextStepOf 与 stageFromProgress 必须恒等',
  /恒等于|恒等/.test(doc),
  '两处各算一套就会"列表说 A、提示说 B"',
)

console.log('\n9. 技能文档的正式名与 STAGES 一致')

for (const s of Object.values(STAGES)) {
  const md = readFileSync(join('D:/learn/.dsh/skills', s.skill, 'SKILL.md'), 'utf8')
  const first = (md.match(/^description:\s*(.+)$/m) ?? [])[1] ?? ''
  // description 前半句就是阶段正式名
  check(
    `${s.skill} 的 description 以「${s.name}」开头`,
    first.startsWith(s.name),
    `实际是「${first.slice(0, 24)}…」，用户和模型看到的叫法对不上`,
  )
}

console.log('\n' + '─'.repeat(60))
console.log(`通过 ${pass}　失败 ${fails.length}`)
if (fails.length) {
  console.log('\n需要修复：')
  fails.forEach((f, i) => console.log(`${i + 1}. ${f.name}\n   ${f.why}`))
  process.exitCode = 1
}
