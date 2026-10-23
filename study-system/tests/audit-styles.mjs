/**
 * 核对：宿主渲染 HTML 时生成的 class，客户端有没有对应的 CSS 规则。
 *
 * 为什么需要这个检查：出过一次事故——宿主输出 <span class="sc-tag-en">Definition</span>，
 * 但 client.js 里没有任何 .sc-tag-en 规则，于是英文副标签直接挤在中文标题后面，
 * 变成「#d 五类工具的审视特征Definition」。这类问题接口测试查不出来（HTML 结构合法），
 * 只有对比两边才知道。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugin')
const read = (p) => readFileSync(join(LIB, p), 'utf8')

const client = read('client.js')
const sources = {
  'lib/rules.js': read(join('lib', 'rules.js')),
  'lib/markdown.js': read(join('lib', 'markdown.js')),
  'lib/service.js': read(join('lib', 'service.js')),
}

// 收集宿主侧所有 class 名
const hostClasses = new Set()
for (const [file, src] of Object.entries(sources)) {
  for (const m of src.matchAll(/class="([a-zA-Z0-9 _-]+)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) hostClasses.add(c)
  }
  // 模板字符串里的 class="..."
  for (const m of src.matchAll(/class=\\?"([a-zA-Z0-9 _-]+)\\?"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) hostClasses.add(c)
  }
}

// 客户端里有没有这个类的 CSS 规则（.xxx{ 或 .xxx 后跟空格/逗号/:）
const hasRule = (c) => {
  const esc = c.replace(/[-]/g, '\\-')
  return new RegExp(`\\.${esc}(?=[\\s,{:.\\[])`).test(client)
}

const dynamicPrefix = ['sc-hl-', 'sc-tag-', 'sc-lv']

// 注释里举的例子（如 class="sc-hl-x"）不是真实输出，不该算缺失
const DOC_EXAMPLES = new Set(['sc-hl-x'])

const missing = []
const covered = []
for (const c of [...hostClasses].sort()) {
  if (hasRule(c)) covered.push(c)
  else if (!DOC_EXAMPLES.has(c)) missing.push(c)
}

console.log(`宿主生成的 class：${hostClasses.size} 个`)
console.log(`客户端有 CSS 规则：${covered.length} 个`)
console.log(`缺失：${missing.length} 个\n`)

if (missing.length) {
  console.log('=== 没有 CSS 规则的 class（会导致样式丢失/元素挤在一起）===')
  for (const c of missing) {
    const isDynamic = dynamicPrefix.some((p) => c.startsWith(p))
    console.log(`  .${c}${isDynamic ? '  ← 动态前缀，检查前缀规则是否存在' : ''}`)
  }
}

console.log('\n=== 已覆盖 ===')
console.log('  ' + covered.join('  '))

process.exitCode = missing.length ? 1 : 0
