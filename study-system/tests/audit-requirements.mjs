/**
 * 需求符合度审计：逐条对照用户原始需求，检查代码是否真的实现了。
 * 只做静态检查 + 数据契约检查，不依赖浏览器。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'D:\\learn'
const P = join(ROOT, 'study-system', 'plugin')
const read = (f) => {
  try {
    return readFileSync(join(P, f), 'utf8')
  } catch {
    return ''
  }
}

const files = {
  index: read('index.js'),
  client: read('client.js'),
  service: read(join('lib', 'service.js')),
  rules: read(join('lib', 'rules.js')),
  markdown: read(join('lib', 'markdown.js')),
  store: read(join('lib', 'store.js')),
  // archify-figures.js 是主路径；archify-graph.js 是旧的降级原型，仍然读入以便检查兜底存在
  archify: read(join('lib', 'archify-figures.js')),
  archifyFallback: read(join('lib', 'archify-graph.js')),
  extract: read(join('lib', 'extract.js')),
}
const all = Object.values(files).join('\n')

const results = []
const add = (id, need, pass, note) => results.push({ id, need, pass, note })

/* ---------- 需求 4：三色加粗「原文」而非另起文字 ---------- */
add(
  'R4a',
  '三色加粗必须加在原文上（原文里出现 <strong>）',
  /renderAnnotatedHtml/.test(files.rules) && /<strong/.test(files.rules),
  'rules.js 有 renderAnnotatedHtml 且输出 strong',
)
add(
  'R4b',
  '标注结果要能回到正文里高亮，而不是单独列一份标注清单',
  files.markdown.length > 0 && files.service.includes('annotatedHtml'),
  'service 提供 annotatedHtml',
)

/* ---------- 需求 3：逐段标注 + 七类渐构标签 ---------- */
const labels = ['d', 'e', 'q', 's', 't', 'c', 'v']
add(
  'R3a',
  '七类渐构标签齐全（d/e/q/s/t/c/v）',
  labels.every((l) => new RegExp(`${l}\\s*:`).test(files.rules) || files.rules.includes(`'${l}'`)),
  'rules.js ROLE_LABELS',
)
add(
  'R3b',
  '#c 标签必须带"两字关键词"',
  /keyword/.test(files.rules),
  'rules 里有 keyword 校验',
)
add(
  'R3c',
  '标签要带"高度概括内容 + 英文"（渐构输出格式）',
  /title/.test(files.rules) && /(english|en\b|英文)/i.test(files.rules),
  'rules 里 title/英文 的要求',
)

/* ---------- 需求：每段后 QA（≤100 字）+ 最小 MVP ---------- */
add(
  'QA1',
  '每个文件读完后产出 QA 问答（每条 ≤100 字）',
  /qa/i.test(all) && /100/.test(all),
  '需要生成 QA 对并限制 100 字',
)
add(
  'QA2',
  'QA 要落盘并可查看',
  /qa/i.test(files.store) || /qa/i.test(files.service),
  'store/service 里应有 qa 支持',
)

/* ---------- 需求 6：参考资料必须标注来源类型 ---------- */
add(
  'R6',
  '参考资料要区分「原文 / 我的知识 / 联网检索」',
  /原文/.test(all) && /联网检索/.test(all),
  '需在 refs 里标来源',
)

/* ---------- 需求：知识点逻辑衔接图用 archify ---------- */
add(
  'G1',
  '地图要由 archify 生成 HTML（而不是自己画 SVG）',
  existsSync(join(P, 'lib', 'archify-figures.js')) && /buildArchifyFigures/.test(files.service),
  'service 是否真的调用 archify',
)
add(
  'G2',
  '学习工作台要能展示 archify 产出的 HTML',
  /buildArchifyFigures/.test(files.service) && /figures/.test(files.service) && /figures/.test(files.client),
  'service 生成 figures，client 读取 figures',
)
add(
  'G2b',
  '图谱页签必须用 iframe 嵌入 archify 的 HTML（不是 Mermaid 源码 / 手绘 SVG）',
  /iframe/.test(files.client) && /\.html/.test(files.archify),
  'client 里 <iframe src={...url}>；archify-figures 产出 graph-N.html',
)
add(
  'G2c',
  '静态资源路由要能返回 .html（否则 iframe 一片空白）',
  /'\.html':\s*'text\/html/.test(files.index),
  'index.js 的 MIME 表含 .html',
)

/* ---------- 需求：术语追问要"结合当前段落上下文" ---------- */
add(
  'T1',
  '术语追问要带 ¶N 段落上下文',
  /segmentId/.test(files.service) && /context|上下文/.test(files.service),
  'service.askTerm 的上下文',
)
add(
  'T2',
  '术语问答要落库可复习',
  /terms\.jsonl|appendJsonl/.test(files.store),
  'store 的 jsonl',
)

/* ---------- 需求：语音提问 ---------- */
add(
  'V1',
  '界面要有语音输入入口',
  /SpeechRecognition|webkitSpeech|mediaDevices|麦克风|语音/.test(files.client),
  'client 里的语音相关代码',
)

/* ---------- 需求 1：摘要 300 字左右 ---------- */
add(
  'R1',
  '摘要目标 300 字左右',
  /SUMMARY_TARGET_CHARS\s*=\s*300/.test(files.rules),
  'rules.SUMMARY_TARGET_CHARS',
)

/* ---------- 需求 4：四级掌握程度 ---------- */
add(
  'R4c',
  '考核方式四档（了解/理解/掌握/熟练掌握）',
  ['了解', '理解', '掌握', '熟练掌握'].every((x) => files.rules.includes(x)),
  'rules.MASTERY_LEVELS',
)

/* ---------- 原则目录 ---------- */
add(
  'PR1',
  '技能里要落实到「原则」目录的学习规律',
  /原则|渐构|认知负荷|主动思考|间隔|费曼/.test(
    readFileSync(join(ROOT, '.dsh', 'skills', 'study-companion', 'SKILL.md'), 'utf8'),
  ),
  'study-companion 是否引用原则',
)

/* ---------- 报告 ---------- */
console.log('需求符合度审计\n' + '='.repeat(64))
let pass = 0
for (const r of results) {
  if (r.pass) pass += 1
  console.log(`${r.pass ? '✓' : '✗'} [${r.id}] ${r.need}`)
  if (!r.pass) console.log(`      → ${r.note}`)
}
console.log('='.repeat(64))
console.log(`符合 ${pass}/${results.length}`)
const missing = results.filter((r) => !r.pass)
if (missing.length) {
  console.log('\n未实现/实现不足：')
  missing.forEach((r) => console.log(`  [${r.id}] ${r.need}`))
}
