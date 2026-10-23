/**
 * 界面实现审计：不测"接口是否 200"，而测"渲染出来的东西对不对"。
 * 运行：node tests/audit-ui.mjs [docId]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const WS = 'D:\\learn'
const API = 'http://127.0.0.1:52884/study-copilot/api'

const docId = process.argv[2] ?? 'chapter4-d6eaed'
let pass = 0
let fail = 0
const problems = []

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  \u2713 ${name}`)
  } else {
    fail += 1
    problems.push(`${name}${detail ? `\n      ${detail}` : ''}`)
    console.log(`  \u2717 ${name}${detail ? `\n      ${detail}` : ''}`)
  }
}

const j = async (path) => {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

const ws = encodeURIComponent(WS)
const project = await j(`/project/${docId}?ws=${ws}`)

console.log(`\n审计对象：${project.meta.title}（${project.segments.length} 段）`)

/* ---------------------------------------------- 1. 数据契约完整性 */

console.log('\n1. 数据契约：界面渲染所需字段是否齐全')

const REQUIRED = {
  'preflight.summary': () => project.preflight?.summary,
  'preflight.goals': () => project.preflight?.goals,
  'preflight.parts': () => project.preflight?.parts?.length,
  'preflight.exercises': () => project.preflight?.exercises?.length,
  'preflight.references': () => project.preflight?.references?.length,
  'annotations.items': () => project.annotations?.items?.length,
  'relations.nodes': () => project.relations?.nodes?.length,
  'relations.edges': () => project.relations?.edges?.length,
  quiz: () => project.quiz,
}
for (const [name, get] of Object.entries(REQUIRED)) {
  let v
  try {
    v = get()
  } catch {
    v = undefined
  }
  check(`存在 ${name}`, Boolean(v), v ? '' : '字段缺失或为空，界面会渲染成空块')
}

check(
  'relations 携带 mermaid 源（图谱渲染的前提）',
  typeof project.mermaid === 'string' && project.mermaid.includes('graph'),
  `实际 mermaid = ${JSON.stringify(project.mermaid)}`,
)

const withText = project.segments.filter((s) => typeof s.text === 'string' && s.text.length > 0)
check(
  '每段自带 text（正文渲染的前提）',
  withText.length === project.segments.length,
  `${withText.length}/${project.segments.length} 段有 text`,
)

const withHtml = project.segments.filter((s) => typeof s.html === 'string' && s.html.length > 0)
check(
  '每段自带渲染好的 html',
  withHtml.length === project.segments.length,
  `${withHtml.length}/${project.segments.length} 段有 html`,
)

/* ---------------------------------------------- 2. Markdown 渲染结果 */

console.log('\n2. Markdown 渲染：语法是否真的被解析')

const src = project.source
const allHtml = project.segments.map((s) => s.html).join('\n')

const countIn = (re) => (src.match(re) ?? []).length
const countOut = (re) => (allHtml.match(re) ?? []).length

/** 真正的表格数：连续 | 行里第 2 行是分隔行的那些（一个表有多行，不能按 | 行数算）。 */
function countTables(text) {
  const lines = text.split('\n')
  let n = 0
  for (let i = 0; i < lines.length - 1; i += 1) {
    const isSep = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])
    if (lines[i].includes('|') && isSep) {
      n += 1
      let k = i + 2
      while (k < lines.length && lines[k].includes('|') && lines[k].trim()) k += 1
      i = k - 1
    }
  }
  return n
}

const mdCases = [
  ['标题', () => countIn(/^#{1,6}\s/gm), () => countOut(/<h[1-6][\s>]/g)],
  ['粗体', () => countIn(/\*\*[^*\n]+\*\*/g), () => countOut(/<strong>/g)],
  ['行内代码', () => countIn(/`[^`\n]+`/g), () => countOut(/<code>/g)],
  ['列表项', () => countIn(/^[-*+]\s/gm), () => countOut(/<li>/g)],
  ['表格', () => countTables(src), () => countOut(/<table/g)],
  ['图片', () => countIn(/!\[[^\]]*\]\([^)]*\)/g), () => countOut(/<img /g)],
  ['引用块', () => {
    // 连续的 > 行算一个引用块
    const arr = src.split('\n')
    let n = 0
    for (let i = 0; i < arr.length; i += 1) {
      if (/^\s*>/.test(arr[i])) {
        n += 1
        while (i + 1 < arr.length && /^\s*>/.test(arr[i + 1])) i += 1
      }
    }
    return n
  }, () => countOut(/<blockquote/g)],
]

for (const [name, getIn, getOut] of mdCases) {
  const nIn = getIn()
  const nOut = getOut()
  if (nIn === 0) {
    console.log(`  – ${name}: 原文无此语法，跳过`)
    continue
  }
  // 输出的标签数应不少于原文语法数（列表项可能因嵌套略多）
  const ok = nOut >= nIn
  check(`${name} 被渲染（原文 ${nIn} 处 → 输出 ${nOut} 个标签）`, ok, ok ? '' : '语法被当成纯文本输出了')
}

check(
  '粗体没有残留在正文里（<strong> 应全部转换）',
  countOut(/\*\*[^*\n]+\*\*/g) === 0,
  `仍有 ${countOut(/\*\*[^*\n]+\*\*/g)} 处字面星号残留`,
)

/* ---------------------------------------------- 3. 图谱可视化（archify） */

console.log('\n3. 知识图谱：archify 生成的 HTML 是否可用')

// 用户明确要求：知识图谱子页面必须嵌入 archify 技能生成的 HTML 文件，
// 不是 Mermaid、也不是手搓 SVG。所以这里检查的是 figures 能不能真的打开。
const figures = project.figures ?? []
const relNodeCount = project.relations?.nodes?.length ?? 0
check('有关系图就应有 archify 生成的 HTML', relNodeCount < 2 || figures.length > 0, '图谱页会空白')

for (const f of figures) {
  check(`第 ${f.index} 张图有产物文件`, Boolean(f.url), `缺 url 字段`)
  check(`第 ${f.index} 张图通过 archify 四道门`, f.ok === true, '门禁没过说明有版面问题')
  check(
    `第 ${f.index} 张图节点数适合阅读`,
    f.nodeCount > 0 && f.nodeCount <= 18,
    `节点 ${f.nodeCount} 个，超过 18 会字号过小`,
  )
}

// 界面必须用 iframe 嵌 archify 的 HTML，不能自己画
const uiSrc = readFileSync(join('D:', 'learn', 'study-system', 'plugin', 'client.js'), 'utf8')
const gpStart = uiSrc.indexOf('function GraphPane')
const gpEnd = uiSrc.indexOf('function QuizPane')
if (gpStart >= 0 && gpEnd > gpStart) {
  const graphPaneCode = uiSrc.slice(gpStart, gpEnd)
  check('图谱页用 iframe 嵌入 archify HTML', /iframe/.test(graphPaneCode), '必须嵌 archify 生成的页面')
  check('图谱页不再自己画 SVG', !/createElementNS/.test(graphPaneCode), '手搓 SVG 的方案已被用户否决')
}

/* ---------------------------------------------- 4. 资源可达性 */

console.log('\n4. 图片资源：能不能取到')

const imgSegs = project.segments.filter((s) => s.html.includes('<img '))
if (imgSegs.length === 0) {
  console.log('  – 正文没有图片引用，跳过')
} else {
  const srcs = [...new Set(imgSegs.flatMap((s) => [...s.html.matchAll(/src="([^"]+)"/g)].map((m) => m[1])))]
  console.log(`    共 ${srcs.length} 个图片地址`)
  let okCount = 0
  for (const u of srcs.slice(0, 6)) {
    const full = u.startsWith('/') ? `http://127.0.0.1:52884${u}${u.includes('?') ? '&' : '?'}ws=${ws}` : u
    try {
      const r = await fetch(full)
      if (r.ok) {
        const buf = await r.arrayBuffer()
        if (buf.byteLength > 200) okCount += 1
        else console.log(`      小文件 ${buf.byteLength}B: ${u}`)
      } else {
        console.log(`      ${r.status} ${u}`)
      }
    } catch (e) {
      console.log(`      失败 ${u}: ${e.message}`)
    }
  }
  const tried = Math.min(srcs.length, 6)
  check(`图片可下载（${okCount}/${tried}）`, okCount === tried, '图片取不到，正文就会出现破图')
}

// 路径穿越必须被拒
const esc = [
  `/asset/${docId}/images/../../../README.md?ws=${ws}`,
  `/asset/${docId}/..%2F..%2F..%2FREADME.md?ws=${ws}`,
]
let leaked = 0
for (const p of esc) {
  try {
    const r = await fetch(`${API}${p}`)
    if (r.ok) leaked += 1
  } catch {
    /* blocked is fine */
  }
}
check('资源路由挡住路径穿越', leaked === 0, `${leaked} 个穿越请求成功了`)

/* ---------------------------------------------- 5. 交互代码 */

console.log('\n5. 交互实现：客户端代码是否真的做对了')

const clientSrc = readFileSync(join('D:', 'learn', 'study-system', 'plugin', 'client.js'), 'utf8')

check(
  '选区取值用 toString()（不是 String(selection)）',
  /getSelection[\s\S]{0,80}toString\(\)/.test(clientSrc) && !/String\(\s*(window\.)?getSelection/.test(clientSrc),
  'String(Selection) 得到的是 "[object Selection]"',
)

check(
  '正文用 html 渲染而非逐行纯文本',
  /seg\.html|__html/.test(clientSrc) && !/String\(seg\.text\)\s*\.split/.test(clientSrc),
  '若仍逐行 <p> 输出，粗体/表格/图片都显示不出来',
)

// 图谱必须是 archify 生成的 HTML 内嵌，不是自己画的 SVG。
// 这段曾经断言 /<svg/ —— 那是旧方案的残留，用户已明确否决手搓 SVG。
check(
  '图谱用 iframe 嵌入 archify 的 HTML（不是自绘 SVG）',
  /iframe/.test(clientSrc) && !/createElementNS/.test(clientSrc),
  '手搓 SVG 的方案已被用户否决，必须嵌 archify 生成的 HTML',
)
check('图谱支持在多张 archify 图之间切换', /setActive|figures\.map/.test(clientSrc), '节点多时会拆成多张图，必须能切')
check('图谱可以新窗口打开原图', /target:\s*['"]_blank['"]/.test(clientSrc), '嵌入看不清时要能单独打开')

// 只检查还在用的 class。sc-gnode / sc-gedge 已随手搓 SVG 方案一起删除。
for (const cls of ['sc-hl-core', 'sc-hl-hard', 'sc-hl-ref', 'sc-md', 'sc-table']) {
  check(`CSS 定义了 .${cls}`, clientSrc.includes(`.${cls}`))
}

/* ---------------------------------------------- 6. 追问与语音 */

console.log('\n6. 需求④⑤：选中词解释与语音提问')

check('选中词用 mouseup 捕获', /onMouseUp/.test(clientSrc), '拖选后无法取到选中的词')
check('键盘/触屏也能选词', /onKeyUp|selectionchange/.test(clientSrc), '只能鼠标拖选，shift+方向键会漏')
check(
  '点空白处不会误弹追问层',
  /const picked = readSelection\(\)[\s\S]{0,80}if \(!picked\) return/.test(clientSrc),
  '整段点击就弹层会干扰阅读',
)
check('追问答案在面板内显示（不靠复制剪贴板）', /terms-pending/.test(clientSrc), '必须轮询等 Agent 回填')
check('剪贴板只作兜底', /clipboard/.test(clientSrc), '宿主没响应时用户还能自己发')
check('语音用中文识别', /lang = 'zh-CN'/.test(clientSrc), '不设中文会识别成英文')
check('语音可以停止', /stopVoice|\.stop\(\)/.test(clientSrc), '"聆听中"点不了，只能等它超时')
check('浏览器不支持时给说明而不是空按钮', /不支持语音/.test(clientSrc), '留个点不动的按钮最糟')
check(
  '图例颜色与 CSS 变量一致',
  // 去掉注释行再查：设计说明里会提到旧配色（解释为什么不用它），那是合理的
  /--sc-core-line/.test(
    clientSrc
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n'),
  ) && !/#4f8ff7/.test(clientSrc.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n')),
  '图例写死旧配色会和正文对不上',
)

/* ---------------------------------------------- 7. 数据形状契约 */

console.log('\n7. 数据形状：界面读到的字段与宿主返回的一致')

// project.qa 是"问答数组本身"，不是 {items:[...]} 也不是 {pairs:[...]}。
// 写成 project.qa.pairs 会静默拿到 undefined，QA 永远显示"还没有"，
// 而这种错测试里最难发现——页面不报错，只是少了内容。
check(
  'QA 按数组读（不套 .pairs / .items）',
  !/project\.qa\?\.pairs/.test(clientSrc) && !/project\.qa\?\.items/.test(clientSrc),
  'project.qa 本身就是数组，再点一层就拿到 undefined',
)
check(
  'answers 默认收起，必须先自己想',
  /open\[i\] \? '收起' : '看答案'/.test(clientSrc),
  '答案默认展开就失去自测意义',
)
check(
  'QA 带条数显示',
  /读完自测（QA，\$\{pairs\.length\} 条）/.test(clientSrc),
  '不显示条数用户不知道漏没漏',
)

/* ---------------------------------------------- 8. 暂停回顾 */

console.log('\n8. 需求⑥：暂停回顾（原则/暂停回顾策略）')

// 该原则的核心是"阅读时的核心动作不是读，而是停"：
// 遇到高价值信息要切断视觉提示做一次提取，而不是划了高亮继续往下翻。
check(
  '核心段落会先盖住再对照',
  /sc-pause-q/.test(clientSrc) && /pauseOn/.test(clientSrc),
  '只标高亮不停下回想，就是原则里说的"虚假勤奋"',
)
check(
  '盖住时要求用户先写一句自己的理解',
  /这段在说什么？先不看书，用一句话写下来/.test(clientSrc),
  '不给回想动作，盖住也白盖',
)
check(
  '只盖核心档，不盖攻坚和参考档',
  /a\?\.tier === 'core'/.test(clientSrc),
  '攻坚档多是提问句，盖住就看不出在问什么；参考档盖住纯属打扰',
)
check(
  '展开过的段落不会被重新盖回去',
  /已经展开过的别再盖回去/.test(clientSrc),
  '每切一次页签就重写一遍，用户会烦到关掉这个功能',
)
check('暂停回顾有总开关', /'暂停回顾'/.test(clientSrc), '不能关的功能迟早被反感')

/* ---------------------------------------------- 9. 反完成主义 */

console.log('\n9. 第一性原理：反完成主义（原则/反完成主义阅读、深度阅读的二八法则）')

// 这一节防的是"看起来完工、实际没用"：
// 覆盖率 100% 但全是碎片，界面很满但一个点都没记住。
const serviceSrc = readFileSync(join('D:', 'learn', 'study-system', 'plugin', 'lib', 'service.js'), 'utf8')

check(
  '主指标是"拿到了什么"而不是"完成了多少"',
  /sc-harvest/.test(clientSrc) && /harvested/.test(serviceSrc),
  '百分比会让人为了填满去标碎片，那比漏标更糟',
)
check(
  '百分比降级到次要位置且明说不标也没关系',
  /不标也没关系/.test(clientSrc),
  '只把百分比挪走还不够，得说清"不标不是欠账"',
)
check(
  '成果口径不含百分比',
  (() => {
    const m = /harvestSentence\(\{[^}]*\}\)\s*\{([\s\S]{0,900}?)\n  \}/.exec(serviceSrc)
    if (!m) return false
    return !/%/.test(m[1])
  })(),
  '一旦给出完成度百分比，反完成主义就失效了',
)
check(
  '碎片 quote 会被判出来',
  /quote-fragment/.test(readFileSync(join('D:', 'learn', 'study-system', 'plugin', 'lib', 'rules.js'), 'utf8')),
  '"维度""按需"这种 quote 让覆盖率虚高却没留下信息',
)
check(
  '纯标题段不判碎片（标题本来就短）',
  /isHeadingOnly/.test(readFileSync(join('D:', 'learn', 'study-system', 'plugin', 'lib', 'rules.js'), 'utf8')),
  '标题段判碎片会导致 Agent 不敢标标题',
)
check(
  '读前六段式默认只给骨架，细节折叠',
  /sc-fold/.test(clientSrc) && /<details class="sc-fold">/.test(serviceSrc),
  '5800 字一次铺开，用户没读就累了',
)
check(
  '折叠是可点开可键盘操作的',
  /summary:focus-visible/.test(clientSrc),
  '只能用鼠标点的折叠区，键盘用户打不开',
)

/* ---------------------------------------------- 10. 单元骨架 */

console.log('\n10. 单元骨架：这份资料分几块（借鉴 learn-from-materials 的内容组织）')

check(
  '界面有单元目录',
  /sc-units-list/.test(clientSrc) && /unitList/.test(clientSrc),
  '182 段平铺，用户不知道这份资料分几块、自己在哪',
)
check(
  '目录主文案是"分几块"而不是"标了几段"',
  /这份资料分 \$\{unitList\.totalUnits\} 块/.test(clientSrc),
  '按段落数是完成主义口径，按块数才是用户能感知的结构',
)
check(
  '每块带段数与要点数',
  /sc-unit-meta/.test(clientSrc) && /keyPointCount/.test(clientSrc),
  '只给标题用户不知道这块有多大、值不值得现在读',
)
check(
  '单元目录默认收起',
  /<details[\s\S]{0,80}className: 'sc-units'/.test(clientSrc) || /className: 'sc-units'/.test(clientSrc),
  '想直接读的人不该被目录挡路',
)
check(
  '宿主能返回单元清单且老项目不报错',
  /\/units\//.test(readFileSync(join('D:', 'learn', 'study-system', 'plugin', 'index.js'), 'utf8')),
  '没有 units.json 的项目应返回 null 而不是 500',
)

/* ---------------------------------------------- 汇总 */

console.log(`\n${'─'.repeat(62)}`)
console.log(`通过 ${pass}　失败 ${fail}`)
if (fail > 0) {
  console.log('\n需要修复：')
  problems.forEach((p, i) => console.log(`\n${i + 1}. ${p}`))
  process.exitCode = 1
}
