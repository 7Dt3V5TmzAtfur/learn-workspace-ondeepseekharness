/**
 * 技能文档与实现同步审计。
 *
 * 为什么要这个：插件加了新门槛（闭卷、时长、抄原文检测、复习调度、
 * 待答回填），但 6 个 study-* 技能文档是 Agent 的说明书。
 * 文档不说，Agent 就不会填这些参数 —— 功能做了等于没做。
 *
 * 这类漂移用肉眼很难发现：文档读起来完全正常，只是少了东西。
 * 所以这里逐条断言"文档必须提到这个机制"。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS = 'D:/learn/.dsh/skills'

let pass = 0
const fails = []

function check(name, ok, why) {
  if (ok) {
    pass += 1
    console.log(`  ✓ ${name}`)
  } else {
    fails.push({ name, why })
    console.log(`  ✗ ${name}\n      ${why}`)
  }
}

function has(skill, pattern) {
  const p = join(SKILLS, skill, 'SKILL.md')
  if (!existsSync(p)) return false
  return pattern.test(readFileSync(p, 'utf8'))
}

function hasAll(skill, patterns) {
  return patterns.every((p) => has(skill, p))
}

console.log('技能文档 × 实现 同步审计\n')

// ---- 七个技能都在 ----
console.log('1. 七个技能齐备')
for (const s of [
  'study-companion',
  'study-preflight',
  'study-annotate',
  'study-map',
  'study-recall',
  'study-feynman',
  'study-explain-term',
]) {
  check(s, existsSync(join(SKILLS, s, 'SKILL.md')), '技能文档不存在，Agent 看不到这个阶段')
}

// ---- study-feynman 必须讲清三道门槛 ----
console.log('\n2. study-feynman：考核有效性的三道门槛')
check(
  '说明 closedBook 必须为 true',
  has('study-feynman', /closedBook/),
  '不写 closedBook，Agent 不会填，记录永远不推进进度',
)
check(
  '说明 durationSec 与 60 秒下限',
  has('study-feynman', /durationSec/) && has('study-feynman', /60/),
  '不写时长，随手两行也会被当成认真复述',
)
check(
  '说明抄原文会被识别',
  has('study-feynman', /drill-copied|抄原文|抄的/),
  '用户整段贴原文也算通过的话，考核就失去意义',
)
check(
  '说明开卷记录照样存档但不推进',
  has('study-feynman', /不推进|不点亮|不算数/),
  'Agent 会以为开卷就该拒绝记录，其实应该如实记但不算通过',
)

// ---- study-feynman 必须说明复习调度 ----
console.log('\n3. study-feynman / study-recall：复习调度')
check(
  'feynman 提到 study_review',
  has('study-feynman', /study_review/),
  'Agent 不知道有这个工具，用户问"今天复习什么"就答不上来',
)
check(
  'feynman 说明 1/3/7 间隔且不要提前催',
  hasAll('study-feynman', [/1 → 3 → 7|1.*3.*7/, /不要提前/]),
  '提前复习会把间隔效应作废',
)
check(
  'recall 说明复习不是重出 QA',
  has('study-recall', /不要重出 QA/),
  '否则每复习一次就生成一批新题，旧的永远没被回想',
)

// ---- study-annotate 必须讲清会被拒的约束 ----
console.log('\n4. study-annotate：三条会被直接拒的约束')
check(
  '一段只能一条标注',
  has('study-annotate', /duplicate/) && has('study-annotate', /一段只能一条/),
  'Agent 会给同一段标两个档位然后反复报错',
)
check(
  '#c 要两字关键词',
  has('study-annotate', /c-needs-keyword/),
  '#c 不带关键词直接报错，Agent 会卡在这里反复试',
)
check(
  '标题段与正文段要分开',
  has('study-annotate', /quote-not-found/) && has('study-annotate', /标题段/),
  '把正文 quote 挂到纯标题段上，逐字校验必然失败',
)
check(
  'quote 不能跨 ** 加粗标记',
  has('study-annotate', /\*\*/) && has('study-annotate', /逐字/),
  '这是最容易踩的坑：看起来是同一句话，中间藏着 **',
)
check(
  '说明暂停回顾只盖 core 档',
  has('study-annotate', /暂停回顾/) && has('study-annotate', /core/),
  'Agent 不知道 core 会触发停顿，就会滥标 core 把阅读切成碎片',
)

// ---- study-explain-term 必须讲清两步回填 ----
console.log('\n5. study-explain-term：待答 → 回填')
check(
  '说明界面点词会留下待答项',
  has('study-explain-term', /待答/),
  'Agent 不知道要去取待答项，用户点了词就一直转圈',
)
check(
  '说明带 answer 调 study_term 就是回填',
  has('study-explain-term', /回填/),
  '不写这句，Agent 会新开一条记录，界面上那条永远不消失',
)
check(
  '说明回填要带 segmentId',
  has('study-explain-term', /segmentId/),
  '同一个词在不同段落语境不同，按词名匹配会答错位置',
)

// ---- study-preflight 六段式 ----
console.log('\n6. study-preflight：六段式')
check(
  '六段全部提到',
  hasAll('study-preflight', [/摘要/, /目标/, /难点|重点/, /考核/, /思考题/, /参考资料/]),
  '漏一段就等于需求①没做完',
)
check(
  '四档掌握度提到',
  hasAll('study-preflight', [/了解/, /理解/, /掌握/]),
  '只写"掌握程度"而不给四档，Agent 会自己编一套等级',
)

// ---- study-map archify ----
console.log('\n7. study-map：archify 出图')
check(
  '说明必须调 archify 生成 HTML',
  has('study-map', /archify/i),
  '需求②明确要求用 archify，不是 Mermaid 也不是自绘 SVG',
)
check(
  '八种关系类型提到',
  has('study-map', /前置/) && has('study-map', /类比/),
  '关系类型不全，图谱就只剩"相关"一种关系',
)

// ---- study-companion 单元切块 ----
console.log('\n8. study-companion：切块是读前之前的一步')
check(
  '流程里有切块阶段',
  has('study-companion', /units\.json/),
  '不切块，六段式的"每一部分"就是模型编的切法，跟原文小节无 ID 关联',
)
check(
  '说明为什么要认两种小标题',
  has('study-companion', /加粗单独成段|小标题/),
  '只认 Markdown 标题会切出 45 段和 2 段并存的不均衡块',
)
check(
  '说明切完要自检不重不漏',
  has('study-companion', /不重|不漏/),
  '漏了用户找不到那段，重了进度算两次',
)
check(
  '说明做不到时宁可不做也不造假',
  has('study-companion', /宁可.*不做|不要编/),
  '假的 units.json 比没有更糟：用户会以为结构是对的',
)

// ---- study-preflight 知识点回指 ----
console.log('\n9. study-preflight：知识点与 part 都要能回到原文')
check(
  '要求知识点挂 segmentIds',
  has('study-preflight', /segmentIds/),
  '没有段号，用户看到一个知识点无路可走',
)
check(
  '说明找不到就不挂、挂错比不挂更糟',
  has('study-preflight', /挂错比不挂|宁缺毋滥/),
  '挂到错的段落上，用户会以为自己记错了',
)
check(
  '要求 part 挂 unitIds',
  has('study-preflight', /unitIds/),
  'part 标题是模型概括的，不挂单元就跟原文小节对不上',
)

/* ---------------------------------------------- 切块脚本的两个坑 */

console.log('\n10. 切块脚本：代码注释不能当标题、docId 不能写死')

const unitSrc = readFileSync('D:/learn/study-system/tests/build-units.mjs', 'utf8')

check(
  '识别代码围栏，代码块内的 # 注释不当标题',
  /inCode\[/.test(unitSrc) && /fenceToggles/.test(unitSrc),
  'Python 注释 `# 第一次迭代 - …` 会被当成一级标题，凭空多出小节',
)
check(
  '标题误取自代码块时拒绝写文件',
  /有小节标题取自代码块注释/.test(unitSrc),
  '只做识别不做校验，将来改坏了也没人知道',
)
check(
  'docId 取自目录名而非写死',
  /docId: basename\(DIR\)/.test(unitSrc),
  '写死的话第二个项目生成的 units.json 会自称是第一个项目的',
)
check(
  '目录可由参数指定',
  /process\.argv\[2\]/.test(unitSrc),
  '换个项目就要改代码，第二个案例进来时一定忘',
)
check(
  '超大单元只提示不主张硬切',
  /只是提示，不一定要动/.test(unitSrc),
  '原文内部没小标题时硬切就是编目录，比块大更糟',
)

console.log(`\n${'─'.repeat(60)}`)
console.log(`通过 ${pass}　失败 ${fails.length}`)

if (fails.length) {
  console.log('\n需要修复：')
  fails.forEach((f, i) => console.log(`${i + 1}. ${f.name}\n   ${f.why}`))
  process.exit(1)
}
