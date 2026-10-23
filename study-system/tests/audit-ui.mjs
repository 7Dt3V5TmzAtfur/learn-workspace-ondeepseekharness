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

/* ---------------------------------------------- 3. 图谱可视化 */

console.log('\n3. 知识图谱：是否真的能画出图')

const layout = project.graphLayout
check('提供 graphLayout（含坐标）', Boolean(layout), '缺它界面只能退化成文字列表')
if (layout) {
  check(
    '布局节点数等于 relations 节点数',
    layout.nodes.length === (project.relations?.nodes ?? []).length,
    `${layout.nodes.length} vs ${project.relations?.nodes?.length}`,
  )
  check(
    '布局边数等于 relations 边数',
    layout.edges.length === (project.relations?.edges ?? []).length,
    `${layout.edges.length} vs ${project.relations?.edges?.length}`,
  )
  const bad = layout.nodes.filter(
    (n) => !Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.w) || !Number.isFinite(n.h),
  )
  check('所有节点坐标都是有效数字', bad.length === 0, `${bad.length} 个节点坐标非法`)

  // 重叠检测：同层节点矩形不应相交
  let overlaps = 0
  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let k = i + 1; k < layout.nodes.length; k += 1) {
      const a = layout.nodes[i]
      const b = layout.nodes[k]
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps += 1
    }
  }
  check('节点矩形互不重叠', overlaps === 0, `${overlaps} 处重叠，图会糊成一团`)

  const outOfCanvas = layout.edges.filter((e) => {
    const pts = e.points ?? [
      [e.x1, e.y1],
      [e.x2, e.y2],
    ]
    return pts.some(
      ([x, y]) =>
        !Number.isFinite(x) || !Number.isFinite(y) || x < -2 || x > layout.width + 2 || y < -2 || y > layout.height + 2,
    )
  })
  check('所有走线拐点都落在画布内', outOfCanvas.length === 0, `${outOfCanvas.length} 条边的拐点超出画布，箭头会被裁掉`)

  const noPoints = layout.edges.filter((e) => !Array.isArray(e.points) || e.points.length < 2)
  check('每条边都有折线拐点', noPoints.length === 0, `${noPoints.length} 条边缺少 points`)

  // 走线不得穿过其他节点：这是"图能不能看"的核心指标
  const sample = (e) => {
    const pts = e.points ?? []
    const out = []
    for (let k = 1; k < pts.length; k += 1) {
      const [x1, y1] = pts[k - 1]
      const [x2, y2] = pts[k]
      for (let t = 0; t <= 1; t += 0.04) out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t])
    }
    return out
  }
  let crossings = 0
  for (const e of layout.edges) {
    const pts = sample(e)
    for (const n of layout.nodes) {
      if (n.id === e.from || n.id === e.to) continue
      if (pts.some(([x, y]) => x >= n.x + 5 && x <= n.x + n.w - 5 && y >= n.y + 5 && y <= n.y + n.h - 5)) {
        crossings += 1
        break
      }
    }
  }
  check('走线不穿过其他节点', crossings === 0, `${crossings} 条边从别的节点身上穿过，图会糊成一团`)

  // 标签必须能放进节点
  const widthOf = (ch) => (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch) ? 11.5 : 11.5 * 0.56)
  const wrap3 = (text, px, maxLines = 3) => {
    const lines = []
    let cur = ''
    let curW = 0
    for (const ch of text) {
      const w = widthOf(ch)
      if (curW + w > px && cur) {
        lines.push(cur)
        cur = ch
        curW = w
        if (lines.length === maxLines) break
      } else {
        cur += ch
        curW += w
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur)
    return lines
  }
  const overflow = layout.nodes.filter((n) => {
    const lines = wrap3(n.label, n.w - 20)
    return lines.some((l) => [...l].reduce((a, c) => a + widthOf(c), 0) > n.w - 10)
  })
  check('节点标签折行后放得下', overflow.length === 0, `${overflow.length} 个节点的标签会溢出`)

  const layers = new Set(layout.nodes.map((n) => n.layer))
  check('做了分层（layer 数 > 1）', layers.size > 1, '全挤在一层就不是逻辑图')
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

check('图谱有 SVG 渲染', /<svg|'svg'/.test(clientSrc), '没有 svg 元素就不是可视化')
check('图谱支持节点聚焦', /setSelNode|data-sel/.test(clientSrc), '缺少交互，图只是静态图片')
check('图谱支持悬停提示', /onMouseEnter|sc-gtip/.test(clientSrc), '看不到节点的完整定义')

for (const cls of ['sc-hl-core', 'sc-hl-hard', 'sc-hl-ref', 'sc-md', 'sc-table', 'sc-gnode', 'sc-gedge']) {
  check(`CSS 定义了 .${cls}`, clientSrc.includes(`.${cls}`))
}

/* ---------------------------------------------- 汇总 */

console.log(`\n${'─'.repeat(62)}`)
console.log(`通过 ${pass}　失败 ${fail}`)
if (fail > 0) {
  console.log('\n需要修复：')
  problems.forEach((p, i) => console.log(`\n${i + 1}. ${p}`))
  process.exitCode = 1
}
