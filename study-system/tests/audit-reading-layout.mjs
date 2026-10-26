/**
 * 用真实项目数据在真浏览器里检查读中页的版面不变量。
 *
 * 静态断言能证明 class 名在、标签配平；证明不了"颜色真的画出来了"、
 * "表格没有撑破容器"、"留白里的段号没有压在正文上"。
 * 这三类都是这个项目真实出过的问题。
 *
 * 用法：node study-system/tests/audit-reading-layout.mjs [docId...]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const require = createRequire(import.meta.url)

let chromium = null
try {
  ;({ chromium } = require('playwright'))
} catch {
  try {
    ;({ chromium } = require('C:/Users/x/node_modules/playwright'))
  } catch {
    console.log('未安装 Playwright，跳过版面验收')
    console.log('通过 0　失败 0')
    process.exit(0)
  }
}

const { renderAnnotatedHtml } = await import('../plugin/lib/rules.js')

const source = readFileSync(join(ROOT, 'plugin', 'client.js'), 'utf8')
const start = source.indexOf('const CSS = `')
const end = source.indexOf('\n`', start)
const css = source.slice(start + 'const CSS = `'.length, end)

const WS = process.argv[2] && existsSync(join(process.argv[2], '.study')) ? process.argv[2] : join(ROOT, '..')
const docs = process.argv.slice(3).length ? process.argv.slice(3) : ['chapter1-940885', 'chapter3-10dde6']

let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) {
    pass += 1
    console.log(`  ✓ ${name}`)
  } else {
    fail += 1
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`)
  }
}

const browser = await launchBrowser()
if (!browser) {
  console.log('启动 Chromium 失败，跳过版面验收')
  console.log('通过 0　失败 0')
  process.exit(0)
}

/** 找一台能用的 Chromium：先用系统 Chrome，再扫 Playwright 的下载目录（取最新的）。 */
async function launchBrowser() {
  const tries = [{}, { channel: 'chrome' }]
  const root = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'ms-playwright') : ''
  if (root && existsSync(root)) {
    const revs = readdirSync(root)
      .filter((n) => /^chromium-\d+$/.test(n))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    for (const r of revs) tries.push({ executablePath: join(root, r, 'chrome-win64', 'chrome.exe') })
  }
  for (const opt of tries) {
    if (opt.executablePath && !existsSync(opt.executablePath)) continue
    try {
      return await chromium.launch(opt)
    } catch {
      /* 换下一个 */
    }
  }
  return null
}

for (const docId of docs) {
  const dir = join(WS, '.study', docId)
  if (!existsSync(join(dir, 'annotations.json'))) {
    console.log(`\n${docId}：没有标注，跳过`)
    continue
  }
  const segmentsRaw = JSON.parse(readFileSync(join(dir, 'segments.json'), 'utf8'))
  const segments = Array.isArray(segmentsRaw) ? segmentsRaw : (segmentsRaw.items ?? [])
  const texts = new Map(
    (JSON.parse(readFileSync(join(dir, 'segment-texts.json'), 'utf8')).items ?? []).map((t) => [t.id, t.text]),
  )
  const ann = JSON.parse(readFileSync(join(dir, 'annotations.json'), 'utf8'))
  const withText = segments.map((s) => ({ ...s, text: texts.get(s.id) ?? s.lead ?? '' }))
  const body = renderAnnotatedHtml(withText, ann)

  console.log(`\n── ${docId}（${segments.length} 段 / ${ann.items.length} 条标注）──`)

  for (const dark of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0}
        body{background:${dark ? '#1c1c1e' : '#fff'};font:14px/1.9 system-ui,"Microsoft YaHei";color:${dark ? '#e5e5e7' : '#1f2328'}}
        ${dark ? 'body[data-ds-dark-theme]{color-scheme:dark}' : ''}
        ${css}
      </style></head>
      <body ${dark ? 'data-ds-dark-theme' : ''}>
        <div class="sc-root" style="--sc-scale:1;width:720px;padding:16px">
          <div class="sc-md">${body}</div>
        </div>
      </body></html>`,
      { waitUntil: 'load' },
    )

    const tag = dark ? '深色' : '浅色'

    const m = await page.evaluate(() => {
      const root = document.querySelector('.sc-md')
      const segs = [...document.querySelectorAll('.sc-seg')]
      const hl = [...document.querySelectorAll('.sc-hl-core,.sc-hl-hard,.sc-hl-ref')]
      const bgOf = (el) => getComputedStyle(el).backgroundColor
      const parse = (c) => {
        const x = String(c).match(/rgba?\(([^)]+)\)/)
        if (!x) return null
        const p = x[1].split(',').map(Number)
        return p.slice(0, 3)
      }
      const segBg = bgOf(document.body)
      const invisible = hl.filter((el) => {
        const b = parse(bgOf(el))
        const p = parse(segBg)
        if (!b) return true
        return b[0] === p[0] && b[1] === p[1] && b[2] === p[2]
      }).length
      const tiers = [...new Set(segs.map((s) => s.dataset.tier).filter(Boolean))]
      const borderWidths = [...new Set(segs.filter((s) => s.dataset.tier).map((s) => getComputedStyle(s).borderLeftWidth))]
      const borderColors = [...new Set(segs.filter((s) => s.dataset.tier).map((s) => getComputedStyle(s).borderLeftColor))]
      // 竖排迹象：元素很窄但文字很长
      const narrow = [...document.querySelectorAll('.sc-md *')].filter((el) => {
        const r = el.getBoundingClientRect()
        const t = (el.textContent ?? '').trim()
        return r.width > 0 && r.width < 60 && t.length > 30 && el.children.length === 0
      }).length
      // 表格是否撑破容器
      const rootRect = root.getBoundingClientRect()
      const tables = [...document.querySelectorAll('.sc-md table')]
      const overflowingTables = tables.filter((t) => t.getBoundingClientRect().width > rootRect.width + 1).length
      const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      // 高亮是否真的应用了背景色（不是靠字重）
      const hlStyles = hl.map((el) => {
        const cs = getComputedStyle(el)
        return { bg: cs.backgroundColor, fw: cs.fontWeight }
      })
      const distinctBg = new Set(hlStyles.map((h) => h.bg)).size
      return {
        segs: segs.length,
        hl: hl.length,
        invisible,
        tiers,
        borderWidths,
        borderColors,
        narrow,
        tables: tables.length,
        overflowingTables,
        overflowX,
        distinctBg,
        fontSizes: [...new Set(hl.slice(0, 5).map((el) => getComputedStyle(el).fontSize))],
        tierOfHl: hl.map((el) => el.className),
      }
    })

    // 先证明样本非空：没有高亮时，下面几条都会"自动通过"，
    // 那是空集合自证，不是版面没问题。
    check(`${tag}：样本里确实有高亮（否则后面的断言没有意义）`, m.hl > 0, '这一份没有任何高亮')
    check(`${tag}：${m.hl} 处高亮都真的画出了底色`, m.invisible === 0, `${m.invisible} 处背景与正文同色`)
    check(`${tag}：三档颜色互不相同`, m.distinctBg >= Math.min(3, m.tiers.length), `只出现 ${m.distinctBg} 种底色（档位 ${m.tiers.join('/')}）`)
    check(`${tag}：段落只用左边线标档位（无整段底色）`, m.borderWidths.every((w) => w === '2px'), `左边线宽度 ${m.borderWidths.join(',')}`)
    check(`${tag}：没有竖排（窄容器里塞长文本）`, m.narrow === 0, `${m.narrow} 处窄元素装着长文本`)
    check(`${tag}：表格没有撑破容器`, m.overflowingTables === 0, `${m.overflowingTables}/${m.tables} 个表格超宽`)
    check(`${tag}：页面没有横向滚动`, !m.overflowX)
    check(`${tag}：高亮字号没有被缩到不可读`, m.fontSizes.every((s) => parseFloat(s) >= 12), `字号 ${m.fontSizes.join(',')}`)

    await page.close()
  }
}

await browser.close()
console.log('\n' + '='.repeat(48))
console.log(`通过 ${pass}　失败 ${fail}`)
if (fail) process.exitCode = 1
