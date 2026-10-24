/**
 * 悬停提示的真实行为与配色验收（需要 Playwright + 本机 Chromium）。
 *
 * 纯 CSS 的交互，源码正则只能证明"写了规则"，证明不了"鼠标移上去真的会显示、
 * 而且读得清"。这里把 client.js 里的 CSS 抽出来，用最小 DOM 复现一个段落，
 * 真鼠标悬停，读计算样式与对比度。
 *
 * 无 Playwright 时跳过（打印说明，退出码 0），不让其他机器整套变红。
 * 可用 CLIENT_JS 指向旧版 client.js，验证这份验收能抓住回归。
 */
import { readFileSync } from 'node:fs'
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
    console.log('未安装 Playwright，跳过悬停验收')
    console.log('通过 0　失败 0')
    process.exit(0)
  }
}

// 允许指定别的 client.js（对旧版本跑同一份验收，确认它会变红）
const CLIENT = process.env.CLIENT_JS || join(ROOT, 'plugin', 'client.js')
const source = readFileSync(CLIENT, 'utf8')
const start = source.indexOf('const CSS = `')
const end = source.indexOf('\n`', start)
if (start < 0 || end < 0) {
  console.error('取不到 client.js 里的 CSS 模板')
  process.exit(1)
}
const css = source.slice(start + 'const CSS = `'.length, end)

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;background:#fff;font:14px/1.8 system-ui,"Microsoft YaHei"}
  body[data-ds-dark-theme]{background:#1c1c1e}
  ${css}
</style></head>
<body>
<div style="height:160px"></div>
<div class="sc-root" style="--sc-scale:1;width:720px">
  <div class="sc-md">
    <section class="sc-seg" data-id="¶3" data-tier="core">
      <span class="sc-seg-mark" aria-hidden="true">¶3</span>
      <span class="sc-seg-role">#d</span>
      <span class="sc-seg-role-full">#d · 全章的判断标准 · Agent 与普通对话的区别</span>
      <div>这些产品的形态各异，但有一个共同点：它们不再是“你问一句、它答一句”的被动对话，而是能够自主规划执行步骤的智能系统。</div>
    </section>
  </div>
</div>
</body></html>`

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

/* ---------- 颜色解析与对比度（WCAG 相对亮度） */

function parseColor(text) {
  const m = String(text).match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const parts = m[1].split(',').map((v) => Number(v.trim()))
  return parts.length >= 3 ? parts.slice(0, 3) : null
}

function luminance([r, g, b]) {
  const f = (v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

const CHROME = 'C:/Users/x/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
let browser
try {
  browser = await chromium.launch({ executablePath: CHROME })
} catch (e) {
  console.log('启动 Chromium 失败，跳过悬停验收：' + e.message.split('\n')[0])
  console.log('通过 0　失败 0')
  process.exit(0)
}

try {
  /* ---------- 1. 行为：悬停显示、不遮正文 */

  const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
  await page.setContent(html, { waitUntil: 'load' })

  const panel = page.locator('.sc-seg-role-full')
  check('未悬停时面板不可见', !(await panel.isVisible()))

  const roleEvents = await page.locator('.sc-seg-role').evaluate((el) => getComputedStyle(el).pointerEvents)
  check('角色标记可被鼠标命中', roleEvents !== 'none', `pointer-events=${roleEvents}`)

  await page.locator('.sc-seg').hover()
  await page.waitForTimeout(120)

  check('悬停段落后面板出现', await panel.isVisible())
  const box = await panel.boundingBox()
  check('面板有实际尺寸', Boolean(box && box.width > 40 && box.height > 10), JSON.stringify(box))

  const overlaps = await page.evaluate(() => {
    const p = document.querySelector('.sc-seg-role-full').getBoundingClientRect()
    const text = document.querySelector('.sc-seg > div').getBoundingClientRect()
    return p.bottom > text.top + 2 && p.top < text.top + 24
  })
  check('面板不遮挡正文首行', !overlaps)
  await page.close()

  /* ---------- 2. 配色：明暗两套都必须读得清 */

  for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width: 900, height: 600 } })
    await p.setContent(theme === 'dark' ? html.replace('<body>', '<body data-ds-dark-theme>') : html)
    await p.locator('.sc-seg').hover()
    await p.waitForTimeout(120)
    const { bg, fg } = await p.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.sc-seg-role-full'))
      return { bg: cs.backgroundColor, fg: cs.color }
    })
    const bgc = parseColor(bg)
    const fgc = parseColor(fg)
    check(`${theme} 弹层背景不透明`, Boolean(bgc) && !/rgba\([^)]+,\s*0\)/.test(bg), `bg=${bg}`)
    const ratio = bgc && fgc ? contrast(bgc, fgc) : 0
    check(`${theme} 文字与背景对比度 ≥ 4.5`, ratio >= 4.5, `fg=${fg} on bg=${bg}，对比度 ${ratio.toFixed(2)}`)
    await p.close()
  }
} finally {
  await browser.close()
}

console.log(`通过 ${pass}　失败 ${fail}`)
process.exit(fail === 0 ? 0 : 1)
