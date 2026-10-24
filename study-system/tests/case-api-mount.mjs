/**
 * 回归用例：webServer 晚于本插件就绪时，HTTP API 仍必须挂上。
 *
 * 真实故障（2026-10-24）：桌面端侧栏「学习工作台」能渲染，但
 *   GET  /study-copilot/api/projects  → 404
 *   POST /study-copilot/api/ingest    → 405
 * 原因不是路径错，是 index.js 里
 *   const webServer = ctx.get('webServer')
 *   if (!webServer) return
 * 这一句：apply 只跑一次，webServer 只要那时还没就绪，路由就永久缺失，
 * 而客户端界面照常加载，于是「界面在、接口全 404」。
 *
 * 本用例用假宿主复现同一时序：先 apply，后提供 webServer。
 * 不依赖运行中的 DSH，秒级、确定性。
 *
 * 运行：node tests/case-api-mount.mjs
 */
import { strict as assert } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const { apply } = await import(`file://${join(HERE, '..', 'plugin', 'index.js')}`)

const API = '/study-copilot/api'

/** 假宿主：只实现 apply 真正会碰到的几个面。 */
function makeHost({ webServerAtApply = null } = {}) {
  const routes = []
  const pending = []
  const effects = []
  let webServer = webServerAtApply

  const effect = (fn) => {
    const disposer = fn()
    effects.push(disposer)
    return disposer
  }

  const base = {
    // 服务不存在时 cordis 返回 undefined，而不是 null —— 用 ?? undefined 对齐，
    // 否则 ready() 会把 null 当成"已就绪"，测出来的时序就是假的。
    get: (name) => (name === 'webServer' ? (webServer ?? undefined) : undefined),
    effect,
    tools: { register() {} },
    systemPrompt: { section() {} },
  }
  // 真实 cordis 会把注入的服务直接挂在 ctx 上（ctx.webServer）。
  // 用 getter 复刻这一点，否则测的就不是插件的真实取法。
  Object.defineProperty(base, 'webServer', { get: () => webServer })

  /**
   * cordis 的 inject：依赖齐了就立刻回调，没齐就等。
   * 这里用 pending 队列模拟"服务晚到"。
   */
  base.inject = (deps, callback) => {
    const ready = () => deps.every((d) => base.get(d) !== undefined)
    if (ready()) callback(base)
    else pending.push({ deps, callback })
  }

  return {
    ctx: base,
    routes,
    effects,
    /** 服务晚到：补上 webServer，再把等待中的 inject 回调放行。 */
    provideWebServer() {
      webServer = {
        register(route) {
          routes.push(route)
          return () => {
            const at = routes.indexOf(route)
            if (at >= 0) routes.splice(at, 1)
          }
        },
      }
      for (const item of pending.splice(0)) item.callback(base)
    },
    pendingCount: () => pending.length,
  }
}

/** 假响应对象：记录状态码与正文。 */
function fakeResponse() {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(chunk) {
      this.body += chunk ?? ''
    },
  }
}

async function callRoute(routes, method, path) {
  const route = routes.find((r) => r.kind === 'prefix' && path.startsWith(r.path))
  assert.ok(route, `没有匹配 ${path} 的 prefix 路由`)
  const res = fakeResponse()
  await route.handler({ method, url: path }, res)
  return res
}

let passed = 0
let failed = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed += 1
    failures.push({ name, error })
    console.log(`  ✗ ${name}\n      ${error.message}`)
  }
}

console.log('\n宿主挂载：HTTP API 的时序')

await test('webServer 在 apply 之后才就绪，路由仍要挂上', async () => {
  const host = makeHost()
  apply(host.ctx, {})
  assert.equal(host.routes.length, 0, 'apply 时还没有 webServer，此刻不该有路由')

  host.provideWebServer()
  assert.equal(host.routes.length, 1, 'webServer 就绪后必须补挂 prefix 路由')
  assert.equal(host.routes[0].kind, 'prefix')
  assert.equal(host.routes[0].path, API)
})

await test('挂上之后，请求真的进到本插件的处理器（而不是宿主的 404）', async () => {
  const host = makeHost()
  apply(host.ctx, {})
  host.provideWebServer()

  // 宿主的兜底是纯文本 "Not Found"；本插件的兜底是 JSON {"error":"未知接口 …"}。
  // 用一个必然不存在的子路径，就能判别请求到底进了谁。
  const res = await callRoute(host.routes, 'GET', `${API}/__mount-probe__`)
  assert.equal(res.status, 404)
  assert.match(res.headers['content-type'] ?? '', /application\/json/)
  assert.match(res.body, /未知接口/)
})

await test('POST 不再落到宿主的 405', async () => {
  const host = makeHost()
  apply(host.ctx, {})
  host.provideWebServer()

  const res = await callRoute(host.routes, 'POST', `${API}/__mount-probe__`)
  assert.equal(res.status, 404, 'POST 未匹配时应由插件自己回 404 JSON，而不是宿主的 405')
  assert.match(res.body, /未知接口/)
})

await test('webServer 一开始就在：注册一次，不重复挂', async () => {
  const host = makeHost({
    webServerAtApply: {
      register(route) {
        host.routes.push(route)
        return () => {}
      },
    },
  })
  apply(host.ctx, {})
  assert.equal(host.routes.length, 1, '服务已就绪时应立即挂一次')
  assert.equal(host.pendingCount(), 0)
})

console.log(`\n通过 ${passed}　失败 ${failed}\n`)
process.exitCode = failed === 0 ? 0 : 1
