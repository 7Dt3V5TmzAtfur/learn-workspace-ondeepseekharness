import { readFileSync, writeFileSync } from 'node:fs'
const M = await import('file:///D:/learn/study-system/plugin/lib/rules.js')

const DIR = 'D:/learn/.study/chapter1-940885'
const segs = JSON.parse(readFileSync(`${DIR}/segments.json`, 'utf8')).items
const texts = new Map(
  JSON.parse(readFileSync(`${DIR}/segment-texts.json`, 'utf8')).items.map((t) => [t.id, String(t.text)]),
)
const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8'))

const html = M.renderAnnotatedHtml(
  segs.map((s) => ({ id: s.id, text: texts.get(s.id) ?? '', chars: s.chars })),
  { items: ann.items },
)
writeFileSync('D:/learn/_ann.html', html, 'utf8')

const count = (re) => (html.match(re) ?? []).length
console.log('HTML 长度:', html.length)
console.log('段 <section sc-seg>:', count(/class="sc-seg"/g))
console.log('高亮标记:', count(/sc-hl/g))
for (const t of ['core', 'hard', 'ref']) {
  console.log(`  ${t}: ${count(new RegExp(`data-tier="${t}"`, 'g'))}`)
}
console.log('未解析的 **:', count(/\*\*/g))
console.log('未解析的 ##:', count(/^#{2,4}\s/gm))

// 抽查一段高亮是否只包住短语
const i = html.indexOf('sc-hl')
console.log('\n高亮片段样例:')
console.log(html.slice(Math.max(0, i - 160), i + 200).replace(/\n/g, ' '))
