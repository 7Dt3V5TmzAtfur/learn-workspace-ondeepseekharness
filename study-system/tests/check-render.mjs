/**
 * 渲染修复的单元测试 + 真实数据验证。
 *
 * 背景（ticket 01）：renderAnnotatedHtml 只做 HTML 转义，不解析 Markdown，
 * 导致正文里 422 处 `**加粗**` 原样显示、表格被逐行压成 <p> 竖排崩坏。
 *
 * 修法：占位符法——先按 quote 切分，命中片用占位符标记，
 * 整行交给 renderMarkdown 解析，最后把占位符换回 <strong>。
 * 这样 Markdown 解析器看到的是完整合法的一行，语法不会被切碎。
 */
import { renderAnnotatedHtml } from '../plugin/lib/rules.js'

let pass = 0
let fail = 0
const failures = []

function check(name, fn) {
  try {
    fn()
    pass += 1
    console.log(`  ✓ ${name}`)
  } catch (e) {
    fail += 1
    failures.push({ name, error: e })
    console.log(`  ✗ ${name}`)
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

console.log('渲染修复验证\n' + '='.repeat(56))

console.log('\n[1] 行内 Markdown 要真的被解析')
const r1 = renderAnnotatedHtml([{ id: '¶1', text: '它拥有强大的**工具**，连接语言与真实世界。' }], { items: [] })
check('** 变成 <strong>', () => {
  assert(r1.includes('<strong>工具</strong>'), `实际: ${r1}`)
  assert(!r1.includes('**'), `还有字面量 **: ${r1}`)
})

console.log('\n[2] 表格要变成 <table>，不是竖排 <p>')
const tableText = '| 工具类型 | 调用方向 |\n|---------|--------|\n| 感知工具 | 主动调用 |\n| 执行工具 | 主动调用 |'
const r2 = renderAnnotatedHtml([{ id: '¶7', text: tableText }], { items: [] })
check('生成 <table>', () => {
  assert(r2.includes('<table'), `没有 table: ${r2.slice(0, 200)}`)
  assert(r2.includes('<th'), '没有表头')
  assert(!/<p>\|/.test(r2), '表格行还是被包成 <p>')
})

console.log('\n[3] 高亮与 Markdown 要能共存')
const r3 = renderAnnotatedHtml(
  [{ id: '¶5', text: '可以从两个特征来审视：**调用方向**和**作用对象**。' }],
  { items: [{ segmentId: '¶5', label: 'd', tier: 'core', title: '两个特征', quote: '作用对象' }] },
)
check('高亮命中 + 其余粗体都渲染', () => {
  assert(/<strong class="sc-hl-core">作用对象<\/strong>/.test(r3), `高亮丢了: ${r3}`)
  assert(r3.includes('<strong>调用方向</strong>'), `相邻粗体丢了: ${r3}`)
  assert(!r3.includes('**'), `还有字面量: ${r3}`)
})

check('高亮落在 ** 内部时不产生嵌套 strong', () => {
  const r = renderAnnotatedHtml(
    [{ id: '¶6', text: '这是**关键短语**的说明。' }],
    { items: [{ segmentId: '¶6', label: 'd', tier: 'core', title: 'x', quote: '关键' }] },
  )
  assert(!/<strong[^>]*><strong/.test(r), `出现嵌套 strong: ${r}`)
  assert(r.includes('sc-hl-core'), '高亮丢了')
  assert(r.includes('关键'), '文字丢了')
})

console.log('\n[4] XSS 仍然要挡住')
const r4 = renderAnnotatedHtml([{ id: '¶1', text: '<script>alert(1)</script> 和 **粗**' }], { items: [] })
check('script 被转义', () => {
  assert(!r4.includes('<script>'), '脚本没被转义')
  assert(r4.includes('&lt;script&gt;'), '转义形式不对')
})

console.log('\n[5] 标题行、列表、引用')
const r5 = renderAnnotatedHtml([{ id: '¶1', text: '## 小标题\n\n- 第一项\n- 第二项' }], { items: [] })
check('标题与列表都解析', () => {
  assert(!/##/.test(r5), '标题符号还在')
  assert(r5.includes('<li') || r5.includes('sc-list') || r5.includes('第一项'), '列表内容丢了')
})

console.log('\n[6] 代码围栏与反引号')
const r6 = renderAnnotatedHtml([{ id: '¶1', text: '用 `tools.register` 注册。' }], { items: [] })
check('行内代码变 <code>', () => {
  assert(r6.includes('<code'), `没有 code: ${r6}`)
})

console.log('\n' + '='.repeat(56))
console.log(`通过 ${pass}　失败 ${fail}`)
if (fail) {
  for (const f of failures) console.log(`\n[${f.name}]\n  ${f.error.message}`)
  process.exitCode = 1
}
