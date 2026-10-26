/**
 * 把 Host 插件挂到一个真实 HTTP 服务上，供测试用。
 *
 * 为什么需要：HTTP 那几套验收一直是打**运行中的 DSH**。好处是能抓
 * "改完没重载"这类部署问题，坏处是：改了代码必须先重启桌面端才能验，
 * 而且端口每次启动都变。于是「先验证再重载」这个顺序做不了，
 * 实际变成了「先重载再祈祷」。
 *
 * 这里用最小假宿主（只实现插件真正碰到的几个面）把路由挂到
 * 进程内的 http.createServer 上：真实 req/res、真实端口、真实流式请求体，
 * 但代码来自源码，与部署无关。
 *
 * 注意 DSH_HOME：插件会往 <DSH_HOME>/study-copilot.state.json 记
 * "最近一次有项目的工作区"。测试用临时工作区时必须把它指到别处，
 * 否则会污染真机状态，让桌面端下次默认打开一个临时目录。
 */
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

/**
 * @param {{workspace: string, dshHome?: string}} options
 * @returns {Promise<{host: string, close: () => Promise<void>, workspace: string}>}
 */
export async function startHarness({ workspace, dshHome } = {}) {
  if (!workspace) throw new Error('startHarness 需要 workspace')
  if (dshHome) process.env.DSH_HOME = dshHome

  const routes = []
  const disposers = []

  const webServer = {
    register(route) {
      routes.push(route)
      return () => {
        const at = routes.indexOf(route)
        if (at >= 0) routes.splice(at, 1)
      }
    },
  }

  const ctx = {
    get(name) {
      if (name === 'webServer') return webServer
      if (name === 'workingDirectory') {
        return { defaultDirectory: workspace, ensure: async () => workspace }
      }
      return undefined
    },
    effect(fn) {
      const d = fn()
      if (typeof d === 'function') disposers.push(d)
      return d
    },
    tools: { register() {} },
    systemPrompt: { section() {} },
    // cordis：依赖齐了立刻回调
    inject(deps, cb) {
      cb(ctx)
    },
  }
  // 真实 cordis 把注入的服务直接挂在 ctx 上
  Object.defineProperty(ctx, 'webServer', { get: () => webServer })

  const mod = await import(`file://${fileURLToPath(new URL('../plugin/index.js', import.meta.url))}`)
  mod.apply(ctx, { workspace })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const hit = routes.find((r) => r.kind === 'prefix' && url.pathname.startsWith(r.path))
    if (!hit) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return
    }
    Promise.resolve(hit.handler(req, res)).catch((e) => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: String(e?.message ?? e) }))
    })
  })

  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address()

  return {
    host: `http://127.0.0.1:${port}`,
    workspace,
    async close() {
      for (const d of disposers.reverse()) {
        try {
          d()
        } catch {
          /* 关服务时的清理错误不该掩盖测试结果 */
        }
      }
      await new Promise((done) => server.close(done))
    },
  }
}
