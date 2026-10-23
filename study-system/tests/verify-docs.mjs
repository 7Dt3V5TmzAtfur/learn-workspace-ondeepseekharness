/** 核对：文档里承诺的功能，代码里是否真的存在。 */
import { readFileSync } from 'node:fs'

const md = readFileSync('D:\\learn\\study-system\\plugin\\lib\\markdown.js', 'utf8')
const cl = readFileSync('D:\\learn\\study-system\\plugin\\client.js', 'utf8')
const ix = readFileSync('D:\\learn\\study-system\\plugin\\index.js', 'utf8')
const sv = readFileSync('D:\\learn\\study-system\\plugin\\lib\\service.js', 'utf8')

const checks = [
  ['Markdown: 标题', md.includes('sc-md-h')],
  ['Markdown: 粗体', md.includes('<strong>')],
  ['Markdown: 斜体', md.includes('<em>')],
  ['Markdown: 删除线', md.includes('<del>')],
  ['Markdown: 高亮', md.includes('<mark>')],
  ['Markdown: 行内代码', md.includes('<code>')],
  ['Markdown: 代码围栏', md.includes('sc-code')],
  ['Markdown: 表格+对齐', md.includes('text-align')],
  ['Markdown: 列表嵌套', md.includes('nested')],
  ['Markdown: 引用块', md.includes('sc-quote')],
  ['Markdown: 图片', md.includes('<img')],
  ['Markdown: 链接', md.includes('<a href')],
  ['Markdown: 脚注', md.includes('sc-footnote')],
  ['Markdown: 分隔线', md.includes('<hr />')],
  ['安全: HTML 转义', md.includes('escapeHtml')],
  ['安全: 拦 javascript:', md.includes('safeUrl')],
  ['图谱: parseMermaid', md.includes('export function parseMermaid')],
  ['图谱: layoutGraph', md.includes('export function layoutGraph')],
  ['图谱: 拓扑分层', md.includes('indeg')],
  ['图谱: 重心法降交叉', md.includes('bary')],
  ['图谱: 节点宽度自适应', md.includes('MAX_NODE_W')],
  ['图谱: 折线拐点', md.includes('points')],
  ['图谱: 层间空隙横移', md.includes('gapBand')],
  ['宿主: project 返回 mermaid', sv.includes('mermaid,')],
  ['宿主: project 返回 graphLayout', sv.includes('graphLayout,')],
  ['宿主: segments 带 html', sv.includes('html: renderMarkdown')],
  ['宿主: preflightHtml', sv.includes('preflightHtml')],
  ['宿主: quizHtml', sv.includes('quizHtml')],
  ['宿主: refsHtml', sv.includes('refsHtml')],
  ['宿主: 图片资源路由', ix.includes('/asset/')],
  ['宿主: 资源穿越防护', ix.includes('forbidden')],
  ['宿主: 工作区记忆', ix.includes('lastAgentWorkspace')],
  ['宿主: 工作区自动发现', ix.includes('discoverWorkspaces')],
  ['界面: 插入 HTML', cl.includes('__html')],
  ['界面: SVG 图谱', cl.includes("'svg'")],
  ['界面: 节点聚焦', cl.includes('setSelNode')],
  ['界面: 悬停提示', cl.includes('sc-gtip')],
  ['界面: 选区 toString', cl.includes('sel.toString()')],
  ['界面: 按 points 画线', cl.includes('e.points')],
  ['界面: 诊断面板', cl.includes('showDiag')],
  ['界面: 手动指定工作区', cl.includes('manualWs')],
  ['界面: 只看已标注', cl.includes('onlyAnnotated')],
]

let bad = 0
for (const [n, ok] of checks) {
  if (!ok) {
    bad += 1
    console.log(`  ✗ ${n}`)
  }
}
console.log(`检查 ${checks.length} 项，缺失 ${bad} 项`)
if (bad > 0) process.exitCode = 1
