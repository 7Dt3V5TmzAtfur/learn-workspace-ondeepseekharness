/**
 * 组件渲染冒烟：不连浏览器、不需要 DOM，直接调用组件函数。
 *
 * 为什么需要：面板崩掉时用户只看到"什么也不显示"，而错误往往是一句
 * ReferenceError（曾经是 onBodyClick 跨了组件作用域）。audit-ui 断的是源码文本，
 * 抓不到这类问题；这里用假的 React 执行组件体，能抓到"渲染时才会炸"的引用错误。
 *
 * 它不验证视觉，只验证"给定 props 能算出树，不抛错"。
 *
 * 已知边界：useState 用初值，Workbench 的"选中项目后"那一支（需要 docId 非空）
 * 走不到；那一支靠 PanelBoundary + 运行时上报兜底。其余九个组件是直接喂 props。
 *
 * 运行：node tests/audit-client-render.mjs
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const source = readFileSync(join(ROOT, 'plugin', 'client.js'), 'utf8')

let pass = 0
let fail = 0
const problems = []

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  ✓ ${name}`)
  } else {
    fail += 1
    problems.push(`${name}${detail ? `\n      ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`)
  }
}

/* ---------------------------------------------- 假 React */

function createElement(type, props, ...children) {
  return { type, props: { ...(props ?? {}), children: children.filter((c) => c !== undefined) } }
}

const React = {
  createElement,
  Fragment: 'Fragment',
  useState(init) {
    const value = typeof init === 'function' ? init() : init
    return [value, () => {}]
  },
  useEffect() {},
  useLayoutEffect() {},
  useCallback(fn) {
    return fn
  },
  useMemo(fn) {
    return fn()
  },
  useRef(value) {
    return { current: value }
  },
  useSyncExternalStore(getSnapshot) {
    return getSnapshot()
  },
  Component: class {
    constructor(props) {
      this.props = props
      this.state = {}
    }

    setState() {}
  },
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  Intl,
  Math,
  Date,
  JSON,
  String,
  Number,
  Array,
  Object,
  Map,
  Set,
  Promise,
  Error,
  TextEncoder,
  TextDecoder,
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  fetch: () => Promise.reject(new Error('渲染冒烟不应发起真实请求')),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  window: {
    location: { href: 'dsh-app://app/' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: () => {},
    clearInterval,
    setInterval,
    innerHeight: 900,
    innerWidth: 1400,
  },
  document: {
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    createElement: () => ({
      style: {},
      setAttribute: () => {},
      appendChild: () => {},
      classList: { add: () => {}, remove: () => {} },
    }),
  },
  __loaderConfig: null,
  __ModuleLoader__: {
    load(config) {
      sandbox.__loaderConfig = config
    },
  },
}
sandbox.globalThis = sandbox
sandbox.self = sandbox
// client.js 通过 window.__ModuleLoader__.load(...) 注册；两处指向同一个对象
sandbox.window.__ModuleLoader__ = sandbox.__ModuleLoader__

vm.createContext(sandbox)
let loaded = true
let loadError = null
try {
  vm.runInContext(source, sandbox, { filename: 'client.js' })
} catch (e) {
  loaded = false
  loadError = e
}

check('client.js 能在无 DOM 环境求值', loaded, loadError ? String(loadError.stack).slice(0, 400) : '')

const config = sandbox.__loaderConfig
check('插件工厂可被捕获', Boolean(config?.factory), '模块没有调用 __ModuleLoader__.load')

let plugin = null
if (config?.factory) {
  try {
    plugin = config.factory((name) => (name === 'react' ? React : {}))
  } catch (e) {
    check('工厂执行不抛错', false, String(e.stack).slice(0, 400))
  }
}

const components = plugin?.components ?? {}
check('工厂导出了组件', Object.keys(components).length >= 3, `实际：${Object.keys(components).join(', ')}`)

/* ---------------------------------------------- 样例数据 */

const stages = [
  { key: 'preflight', tab: 'plan', name: '读前建构', progressKey: 'planned', short: '读前', action: '生成读前建构', redo: '重做读前建构' },
  { key: 'annotate', tab: 'read', name: '读中加工', progressKey: 'annotated', short: '读中', action: '开始读中标注', redo: '重新标注' },
  { key: 'map', tab: 'graph', name: '知识图谱', progressKey: 'mapped', short: '图谱', action: '生成知识图谱', redo: '重画知识图谱' },
  { key: 'recall', tab: 'recall', name: '读后巩固', progressKey: 'recalled', short: '巩固', action: '生成读后自测', redo: '重出自测' },
  { key: 'feynman', tab: 'quiz', name: '读后考核', progressKey: 'drilled', short: '考核', action: '开始费曼考核', redo: '重新考核' },
]

const project = {
  id: 'chapterX',
  title: '样例',
  sourceName: 'sample.md',
  format: 'md',
  chars: 1200,
  segmentCount: 12,
  stage: 'planned',
  progress: { ingested: true, planned: true, annotated: false, mapped: false, recalled: false, drilled: false },
  segments: [{ id: '¶1', html: '<p>一</p>', chars: 10 }],
  annotations: { items: [] },
  preflight: { summary: '摘要', goals: [], parts: [], exercises: [{ question: '问题', rubric: ['要点'], minimalAction: '写一遍' }], references: [] },
  preflightHtml: '<section class="sc-pf-sec"><h2 class="sc-pf-h">① 摘要</h2></section>',
  quiz: '# 题',
  quizHtml: '<p>题</p>',
  refsHtml: '<p>参考</p>',
  relations: { nodes: [], edges: [] },
  qa: [{ q: '问', a: '答' }],
  drills: [],
  terms: [],
  next: { action: 'study-annotate', message: '下一步' },
  light: null,
}

const useWorkspaces = (selector) => selector({ workspaces: [{ path: 'D:\\learn' }] })
const useSessions = (selector) => selector({ ids: [], byId: {} })

const cases = [
  ['StagePills', { progress: project.progress, stages }],
  ['StageBar', { name: '读前建构', action: '生成读前建构', redo: '重做读前建构', done: true, busy: false, onRun: () => {} }],
  ['QuizPane', { project, onOpenPlan: () => {} }],
  ['RecallPane', { project }],
  ['PreflightPane', { project, onJump: () => {} }],
  ['ReadingPane', { project, onAsk: () => {}, jumpTo: null, onJumped: () => {} }],
  ['GraphPane', { project, onGoto: () => {} }],
  ['TermsCard', { project }],
  ['DockBar', {}],
  ['Workbench', { useWorkspaces, useSessions }],
]

for (const [name, props] of cases) {
  const Component = components[name]
  if (typeof Component !== 'function') {
    check(`${name} 存在且是组件`, false, '组件没导出，渲染冒烟无法覆盖')
    continue
  }
  try {
    const tree = Component(props)
    check(`${name} 用样例数据能渲染`, tree !== undefined, '返回了 undefined，React 会报错')
  } catch (e) {
    check(`${name} 用样例数据能渲染`, false, String(e.stack).split('\n').slice(0, 3).join('\n      '))
  }
}

console.log('\n' + '─'.repeat(62))
if (fail > 0) {
  console.log('\n组件渲染失败：\n')
  problems.forEach((p, i) => console.log(`${i + 1}. ${p}`))
}
console.log(`通过 ${pass}　失败 ${fail}`)
process.exit(fail === 0 ? 0 : 1)
