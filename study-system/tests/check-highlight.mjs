import { renderAnnotatedHtml, validateAnnotation } from '../plugin/lib/rules.js'

const segments = [
  { id: '¶1', chars: 60, text: '工具设计有两个常被混为一谈的决策：能力做成什么形态，以及一次让模型看见多少条。' },
  { id: '¶2', chars: 40, text: '默认取向是通用优于专用，只在四种情况下退回专用工具。' },
]

const items = [
  { segmentId: '¶1', label: 'd', quote: '能力做成什么形态', tier: 'core', title: '形态与披露是两个决策' },
  { segmentId: '¶2', label: 's', quote: '默认取向是通用优于专用', tier: 'core', title: '通用优先' },
]

const ctx = { segments, totalChars: 100 }
const v = validateAnnotation(items, ctx)
console.log('校验:', v.ok, JSON.stringify(v.stats))
if (!v.ok) v.issues.forEach((i) => console.log('  ', i.code, i.message))

const html = renderAnnotatedHtml(segments, { items })
console.log('\n渲染结果：')
console.log(html)

console.log('\n--- 断言 ---')
const strongCount = (html.match(/<strong class="sc-hl-/g) ?? []).length
console.log(`${strongCount === items.length ? '✓' : '✗'} 高亮数量 == 标注条数 (${strongCount}/${items.length})`)
for (const it of items) {
  const ok = html.includes(`><strong`) && html.includes(it.quote)
  console.log(`${ok ? '✓' : '✗'} 「${it.quote}」出现在 strong 里`)
}
console.log(`${!html.includes('class="sc-seg sc-hl') ? '✓' : '✗'} 段落本身不再整体变色`)

// 找不到 quote 应报错（错误级，优先于缺 title 这类警告）
const bad = validateAnnotation(
  [{ segmentId: '¶1', label: 'd', quote: '这段原文里没有的话', title: '随便' }],
  ctx,
)
const errCodes = bad.issues.filter((i) => i.level === 'error').map((i) => i.code)
console.log(`${!bad.ok ? '✓' : '✗'} 引用不存在的原文被拒绝：${errCodes.join(',')}`)
console.log(`${errCodes.includes('quote-not-found') ? '✓' : '✗'} 错误码是 quote-not-found`)

// 缺 quote 也要报错
const noQuote = validateAnnotation([{ segmentId: '¶1', label: 'd', title: '随便' }], ctx)
console.log(`${!noQuote.ok ? '✓' : '✗'} 缺 quote 被拒绝：${noQuote.issues.map((i) => i.code).join(',')}`)
