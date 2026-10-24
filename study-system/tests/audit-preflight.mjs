/** 检查读前建构 HTML 的结构合法性：有没有非法嵌套、内容有没有丢。 */
// DSH 的 Web 端口每次启动可能不同（实测从 52884 变到 52784），
// 写死端口会让整套测试因为"连不上"而全军覆没，看起来像代码坏了。
const HOST = process.env.DSH_WEB_HOST ?? 'http://127.0.0.1:52784'
const BASE = `${HOST}/study-copilot/api`
const WS = encodeURIComponent('D:\\learn')
const DOC = process.argv[2] ?? 'chapter4-d6eaed'

const res = await fetch(`${BASE}/project/${DOC}?ws=${WS}`)
const p = await res.json()
const html = p.preflightHtml ?? ''

console.log(`HTML 长度：${html.length}`)

const report = (name, bad) => {
  const ok = bad.length === 0
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `（${bad.length} 处）`}`)
  if (!ok) bad.slice(0, 4).forEach((b) => console.log(`    ${b.slice(0, 130)}`))
}

// 1. <p> 嵌套 <p>
report('<p> 不嵌套 <p>', html.match(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?<p\b/g) ?? [])

// 2. h3 里没有块级元素
report('标题内无块级元素', html.match(/<h3>[^<]*(<p>|<div>|<ul>|<ol>)/g) ?? [])

// 3. span/b 里没有块级元素
report('行内标签内无块级元素', html.match(/<(span|b|i)\b[^>]*>(?:(?!<\/\1>)[\s\S])*?<(p|div|ul|ol)\b/g) ?? [])

// 4. li 里不能直接跟 p 之外的双重包裹（<li><p><p>）
report('li 内无嵌套段落', html.match(/<li\b[^>]*>\s*<p\b[^>]*>\s*<p\b/g) ?? [])

// 5. 标签配对
const count = (tag) => ({
  open: (html.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length,
  close: (html.match(new RegExp(`</${tag}>`, 'g')) ?? []).length,
})
for (const tag of ['div', 'section', 'p', 'ul', 'ol', 'li', 'span', 'h3']) {
  const { open, close } = count(tag)
  const ok = open === close
  console.log(`${ok ? '✓' : '✗'} <${tag}> 配对 ${open}/${close}`)
}

// 6. 残留 Markdown 语法
report('无残留 ** 星号', (html.match(/\*\*[^*\n]+\*\*/g) ?? []).map(String))
report('无残留 markdown 标题标记', (html.match(/(^|\n)#{1,6}\s/g) ?? []).map(String))

// 7. 关键结构存在
for (const [name, re] of [
  ['① 摘要', /① 资料摘要/],
  ['② 目标', /② 对我的帮助与目标/],
  ['⑤ 思考题', /⑤ 思考题与作业/],
  ['⑥ 参考', /⑥ 参考资料/],
  ['分部卡片', /class="sc-part"/],
  ['知识点', /class="sc-kp"/],
  ['要求块', /class="sc-req"/],
  ['档位标签', /class="sc-lv"/],
]) {
  console.log(`${re.test(html) ? '✓' : '✗'} ${name}`)
}

// 8. 内容完整：每条重点/难点都出现
const plan = await (await fetch(`${BASE}/project/${DOC}?ws=${WS}`)).json()
let missing = 0
for (const part of p.preflight?.parts ?? []) {
  for (const k of [...(part.keyPoints ?? []), ...(part.difficulties ?? [])]) {
    const probe = String(k).replace(/[*`]/g, '').slice(0, 8)
    if (!html.includes(probe)) {
      missing += 1
      console.log(`    丢失：${probe}`)
    }
  }
}
console.log(`${missing === 0 ? '✓' : '✗'} 重点/难点全部出现（缺 ${missing}）`)

// 9. 采样开头，人眼可读
console.log('\n--- 前 900 字符 ---')
console.log(html.slice(0, 900))
