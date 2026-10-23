/**
 * @local/dsh-study-copilot — Host 半身
 *
 * 提供三样东西：
 * 1. Agent 工具：study_ingest / study_read / study_save / study_term / study_status
 * 2. HTTP API：/study-copilot/api/*，给界面读写同一份数据
 * 3. 系统提示段落：告诉模型这套流程怎么用
 */
import { resolve, dirname, extname, sep, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { StudyService, nextStepOf } from './lib/service.js'
import { StudyStore, findWorkspaceRoot, findWorkspaceRoots } from './lib/store.js'

export const name = 'study-copilot'
export const inject = ['tools', 'systemPrompt']

const API_PREFIX = '/study-copilot/api'
/** DSH 用户目录：优先用环境变量，取不到就用 ~/.dsh。 */
const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')

/** 每个工作区一个 StudyService，随工作区路径缓存。 */
const services = new Map()
function serviceFor(workspace) {
  const key = resolve(workspace)
  if (!services.has(key)) services.set(key, new StudyService(key))
  return services.get(key)
}

/**
 * 最近一次由 Agent 工具调用确认过的真实工作区。
 * HTTP 请求没有 Agent 上下文（process.cwd() 是 profile 目录，不是用户工作区），
 * 所以界面拿不到路径时，用这个值兜底——它来自真正执行过 study_* 的那个会话目录。
 */
let lastAgentWorkspace = null
export function rememberWorkspace(path) {
  if (path) lastAgentWorkspace = resolve(path)
}


/* ------------------------------------------------------------------ 工具 */

function jsonSchema(properties, required = []) {
  return { type: 'object', properties, required, additionalProperties: false }
}

/** 让返回值只含可无损 JSON 表达的数据：去掉 undefined、函数、循环引用。 */
function sanitize(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') return null
  if (typeof value === 'bigint') return Number(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((v) => sanitize(v, seen))
  if (typeof value === 'object') {
    if (seen.has(value)) return null
    seen.add(value)
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const clean = sanitize(v, seen)
      if (clean !== null || v === null) out[k] = clean
    }
    return out
  }
  return null
}

const TOOLS = [
  {
    name: 'study_ingest',
    description:
      '把一份任意格式的资料（pdf/docx/pptx/xlsx/epub/html/md/txt/rtf…）导入学习项目：' +
      '提取正文、切分段落、生成 .study/<docId>/ 下的 source.md 与 segments.json。' +
      '导入后用 study_status 看下一步。',
    parameters: jsonSchema(
      {
        path: { type: 'string', description: '文件路径，绝对路径或相对当前工作区' },
        title: { type: 'string', description: '可选：文档标题，默认取文件名' },
      },
      ['path'],
    ),
  },
  {
    name: 'study_read',
    description:
      '分批读取已导入资料的原文段落（带 ¶N 锚点、章节、字数）。长文档务必用 offset/limit 分批，不要一次读全文。',
    parameters: jsonSchema(
      {
        docId: { type: 'string', description: '学习项目 id' },
        offset: { type: 'number', description: '起始段落序号，默认 0' },
        limit: { type: 'number', description: '本次读取段落数，默认 20，上限 100' },
      },
      ['docId'],
    ),
  },
  {
    name: 'study_save',
    description:
      '保存某个阶段的产物并做规则校验。kind 取值：' +
      'preflight（读前六段式）、annotation（逐段渐构标签+三色注意力）、' +
      'relations（知识点关系图）、quiz（思考题与费曼作业）、refs（参考资料清单）。' +
      '校验不通过会返回 issues，请按提示修正后重存。',
    parameters: jsonSchema(
      {
        docId: { type: 'string', description: '学习项目 id' },
        kind: {
          type: 'string',
          enum: ['preflight', 'annotation', 'relations', 'quiz', 'refs'],
          description: '保存哪一类产物',
        },
        payload: {
          type: 'object',
          description:
            'preflight: {summary,goals{help,main,subgoals[]},parts[],exercises[],references[]}；' +
            'annotation: {items:[{segmentId,label,title,tier?,keyword?,note?}]}；' +
            'relations: {nodes:[{id,label,kind?}],edges:[{from,to,relation,label?}],direction?}；' +
            'quiz: {markdown}；refs: {markdown} 或 {references[]}',
          additionalProperties: true,
        },
      },
      ['docId', 'kind'],
    ),
  },
  {
    name: 'study_term',
    description:
      '记录一次术语追问：学习者问某个词在这段话里什么意思。会自动带上该段落上下文，' +
      '并把答案存进 terms.jsonl 供以后复习。回答时必须结合上下文的专业语境，不要给字典释义。',
    parameters: jsonSchema(
      {
        docId: { type: 'string', description: '学习项目 id' },
        term: { type: 'string', description: '被追问的词或短语' },
        segmentId: { type: 'string', description: '该词所在段落锚点，如 ¶12' },
        question: { type: 'string', description: '学习者的原始问法（可空）' },
        answer: { type: 'string', description: '结合上下文的解释' },
      },
      ['docId', 'term'],
    ),
  },
  {
    name: 'study_status',
    description:
      '查看学习项目状态：各阶段完成度、标注统计、校验问题、下一步该做什么。' +
      '不传 docId 时列出工作区里全部学习项目。',
    parameters: jsonSchema({
      docId: { type: 'string', description: '可选：只查这一个项目' },
    }),
  },
  {
    name: 'study_drill',
    description:
      '记录一次费曼考核：学习者真的用自己的话复述/作答之后，把原文、他的说法、达标要点与判卷结论存下来。' +
      '这是"读后考核"阶段唯一能推进进度的地方——只生成思考题不算完成考核。',
    parameters: jsonSchema(
      {
        docId: { type: 'string', description: '学习项目 id' },
        prompt: { type: 'string', description: '本次问的题目或复述任务' },
        answer: { type: 'string', description: '学习者自己的说法（原话，不要替他改写）' },
        rubricHit: {
          type: 'array',
          items: { type: 'string' },
          description: '达标了哪几条要点',
        },
        verdict: { type: 'string', description: '判卷结论：达标/部分达标/未达标，附一句理由' },
        minimalAction: { type: 'string', description: '下一步最小行动' },
      },
      ['docId', 'answer'],
    ),
  },
]

const SYSTEM_SECTION = `## 学习资料辅助（study-copilot）

用户导入的资料存在工作区 \`.study/<docId>/\`，全部阶段产物都是普通文件。
标准流程（阶段状态机）：\`导入 → 读前建构 → 读中标注 → 知识图谱 → 费曼考核\`。

- 用 \`study_ingest\` 导入，用 \`study_status\` 随时确认下一步。
- 读前建构、渐构标注、知识图谱、费曼考核的具体方法在技能里：
  \`study-preflight\`、\`study-annotate\`、\`study-map\`、\`study-feynman\`、\`study-explain-term\`。
  收到资料相关请求时先加载对应技能，再动手。
- 三色注意力是硬约束：高亮总占比不得超过全文 20%，核心档 ≤10%，攻坚档 ≤8%。
  \`study_save\` 会拒绝超预算的标注 —— 这是刻意的，用来防止"每句都标等于没标"。
- 标注标签只有七类：\`#d\` 定义、\`#e\` 例子、\`#q\` 提问、\`#s\` 总结、\`#t\` 迁移、\`#c\` 备注（需两字关键词）、\`#v\` 验证。
- 考核阶段只有 \`study_drill\` 能推进：只把思考题写进 quiz.md 不算完成考核，
  必须等学习者真的说了自己的话，再用原话记录进 drills.jsonl。
`

/* ------------------------------------------------------------------ 插件 */

export function apply(ctx, config = {}) {
  /**
   * 解析当前会话的工作区：
   * 1) 工具调用时优先用发起本次调用的 Agent 的真实目录（尊重用户 cd）
   * 2) 退化到部署默认目录
   * 3) 最后才是 config 指定的固定目录
   */
  const workspaceOf = async () => {
    const wd = ctx.get('workingDirectory')
    const agents = ctx.get('agents')
    if (wd) {
      try {
        const agent = agents?.currentInitiator()
        if (agent) return await wd.ensure(agent)
        if (wd.defaultDirectory) return wd.defaultDirectory
      } catch {
        /* 目录失效等情况下继续退化 */
      }
    }
    return config.workspace || process.cwd()
  }

  /* ---- 工具注册 ---- */
  for (const def of TOOLS) {
    ctx.tools.register({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
      // 结果里含任意嵌套的对象（issues/stats/next…）。宿主只支持单一 type 的 schema，
      // 因此顶层声明为 object，内部用 additionalProperties 放开。
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, result) => [
          { type: 'text', text: JSON.stringify(sanitize(result), null, 2) },
        ],
      },
      async execute(args) {
        const workspace = await workspaceOf()
        rememberWorkspace(workspace)
        const svc = serviceFor(workspace)
        switch (def.name) {
          case 'study_ingest':
            return svc.ingest(args.path, { title: args.title })
          case 'study_read':
            return svc.read(args.docId, { offset: args.offset, limit: args.limit })
          case 'study_save': {
            const { docId, kind, payload } = args
            if (kind === 'preflight') return svc.savePreflight(docId, payload)
            if (kind === 'annotation') return svc.saveAnnotation(docId, payload?.items ?? payload)
            if (kind === 'relations') return svc.saveRelations(docId, payload)
            if (kind === 'quiz') return svc.saveQuiz(docId, payload?.markdown ?? String(payload ?? ''))
            if (kind === 'refs') {
              const markdown = payload?.markdown ?? svc.renderRefs(payload?.references ?? [])
              return svc.store.writeArtifact(docId, 'refs.md', markdown).then(() => ({ docId, kind }))
            }
            throw new Error(`未知的 kind: ${kind}`)
          }
          case 'study_term':
            return svc.askTerm(args.docId, {
              term: args.term,
              segmentId: args.segmentId,
              question: args.question,
              answer: args.answer,
              source: 'agent',
            })
          case 'study_status': {
            if (args.docId) return svc.project(args.docId)
            return { projects: await svc.list() }
          }
          case 'study_drill':
            return svc.recordDrill(args.docId, {
              prompt: args.prompt,
              answer: args.answer,
              rubricHit: args.rubricHit,
              verdict: args.verdict,
              minimalAction: args.minimalAction,
            })
          default:
            throw new Error(`未实现的工具 ${def.name}`)
        }
      },
    })
  }

  /* ---- 系统提示 ---- */
  ctx.systemPrompt.section({
    name: 'study-copilot',
    text: SYSTEM_SECTION,
    order: 60,
  })

  /* ---- HTTP API（供界面使用） ---- */
  const webServer = ctx.get('webServer')
  if (!webServer) return

  const send = (res, status, body) => {
    const payload = JSON.stringify(body)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(payload),
    })
    res.end(payload)
  }

  const MIME = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  }

  /**
   * 提供文档目录下的图片资源。
   * 只允许访问"源文件所在目录"及其子目录，防止用 ../ 跳到别处。
   */
  const serveAsset = async (res, svc, docId, relPath) => {
    try {
      const meta = await svc.store.meta(docId)
      if (!meta?.sourcePath) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('not found')
        return
      }
      const root = dirname(resolve(meta.sourcePath))
      const target = resolve(root, relPath)
      const normRoot = root.endsWith(sep) ? root : root + sep
      if (target !== root && !target.startsWith(normRoot)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('forbidden')
        return
      }
      const ext = extname(target).toLowerCase()
      const type = MIME[ext]
      if (!type) {
        res.writeHead(415, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('unsupported media type')
        return
      }
      if (!existsSync(target)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('not found')
        return
      }
      const buf = await readFile(target)
      res.writeHead(200, {
        'content-type': type,
        'content-length': buf.length,
        'cache-control': 'public, max-age=86400',
      })
      res.end(buf)
    } catch (e) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: `资源读取失败：${e?.message ?? e}`, docId, relPath }))
    }
  }

  const readBody = (req) =>
    new Promise((resolveBody, rejectBody) => {
      const chunks = []
      let size = 0
      req.on('data', (c) => {
        size += c.length
        if (size > 8 * 1024 * 1024) rejectBody(new Error('请求体过大'))
        else chunks.push(c)
      })
      req.on('end', () => {
        if (!chunks.length) return resolveBody({})
        try {
          resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch {
          rejectBody(new Error('请求体不是合法 JSON'))
        }
      })
      req.on('error', rejectBody)
    })

  /**
   * 工作区来自查询参数；没带时按顺序找：
   * 最近一次 Agent 用过的工作区 → 配置 → 会话默认目录 → 进程 cwd。
   * 注意 process.cwd() 是 profile 目录，不是用户工作区，放在最后仅作兜底。
   */
  const defaultWorkspace = () => {
    const wd = ctx.get('workingDirectory')
    return lastGoodWorkspace || lastAgentWorkspace || config.workspace || wd?.defaultDirectory || process.cwd()
  }

  /**
   * 把用户给的任意路径解析成真实工作区。
   * 用户点"诊断"通常填的是**资料文件路径**（如 D:\learn\学习资料\book\chapter4.md），
   * 不是工作区。所以这里逐级向上找含 .study 的目录；找不到就退回原路径。
   */
  const resolveWorkspace = (raw) => {
    if (!raw) return defaultWorkspace()
    const hit = findWorkspaceRoot(raw)
    return hit ?? resolve(raw)
  }

  /**
   * 记住最近一次成功定位到项目的工作区，并落盘。
   * 界面刷新/插件重载后，靠它立刻回到用户真正在用的目录，
   * 而不是退回 profile 目录导致"一个文件都没有"。
   */
  let lastGoodWorkspace = null
  const STATE_FILE = () => resolve(DSH_HOME, 'study-copilot.state.json')
  const loadState = () => {
    try {
      const raw = readFileSync(STATE_FILE(), 'utf8')
      const v = JSON.parse(raw)
      if (v?.workspace && existsSync(findWorkspaceRoot(v.workspace) ?? v.workspace)) {
        lastGoodWorkspace = v.workspace
      }
    } catch {
      /* 首次运行没有状态文件，正常 */
    }
  }
  const saveState = (ws) => {
    try {
      writeFileSync(STATE_FILE(), JSON.stringify({ workspace: ws, at: new Date().toISOString() }, null, 2), 'utf8')
    } catch {
      /* profile 目录不可写时忽略，只是下次要重新定位 */
    }
  }
  const rememberGood = (ws, count) => {
    if (count > 0 && ws !== lastGoodWorkspace) {
      lastGoodWorkspace = ws
      saveState(ws)
    }
  }
  loadState()

  const svcOf = (url) => {
    const ws = resolveWorkspace(url.searchParams.get('ws'))
    return serviceFor(ws)
  }

  /** 列出各候选工作区下已有的学习项目，帮界面在拿不到路径时自我修复。 */
  const discoverWorkspaces = async () => {
    const candidates = []
    const push = (p) => {
      if (p && !candidates.includes(p)) candidates.push(p)
    }
    push(lastGoodWorkspace)
    push(lastAgentWorkspace)
    push(config.workspace)
    push(ctx.get('workingDirectory')?.defaultDirectory)
    push(process.cwd())
    // 再往下扫有限层，把 .study 真在的地方都找出来
    for (const extra of findWorkspaceRoots(candidates, 4)) push(extra)
    // 仍然一个项目都没找到时，扫各盘符根下一层：用户常在 D:\ 或 E:\ 下建项目
    const hasAny = candidates.some((p) => {
      try {
        return existsSync(join(p, '.study'))
      } catch {
        return false
      }
    })
    if (!hasAny) {
      for (const drive of ['C:', 'D:', 'E:', 'F:']) {
        if (!existsSync(`${drive}\\`)) continue
        for (const extra of findWorkspaceRoots([`${drive}\\`], 2)) push(extra)
      }
    }
    const out = []
    for (const path of candidates) {
      try {
        const items = await serviceFor(path).list()
        out.push({ path, count: items.length, titles: items.slice(0, 20).map((i) => i.title) })
      } catch {
        out.push({ path, count: 0, titles: [], error: true })
      }
    }
    return out.sort((a, b) => b.count - a.count)
  }

  ctx.effect(() => {
    const dispose = webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      async handler(req, res) {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const route = url.pathname.slice(API_PREFIX.length) || '/'
        try {
          if (req.method === 'GET' && route === '/health') {
            return send(res, 200, {
              ok: true,
              workspace: svcOf(url).ws,
              defaultWorkspace: defaultWorkspace(),
              hasWsParam: Boolean(url.searchParams.get('ws')),
            })
          }
          if (req.method === 'GET' && route === '/workspaces') {
            return send(res, 200, { items: await discoverWorkspaces() })
          }
          // 图片等静态资源：/asset/<docId>/<相对路径>
          if (req.method === 'GET' && route.startsWith('/asset/')) {
            const rest = route.slice('/asset/'.length)
            const slash = rest.indexOf('/')
            if (slash < 0) return send(res, 400, { error: '缺少资源路径' })
            const safeDecode = (v) => {
              try {
                return decodeURIComponent(v)
              } catch {
                return v
              }
            }
            const docId = safeDecode(rest.slice(0, slash))
            // route 来自 url.pathname，本身仍是百分号编码的，这里只需解码一次
            const relPath = safeDecode(rest.slice(slash + 1))
            await serveAsset(res, svcOf(url), docId, relPath)
            return
          }
          if (req.method === 'GET' && route === '/projects') {
            const raw = url.searchParams.get('ws')
            const svc = svcOf(url)
            const items = await svc.list()
            rememberGood(svc.ws, items.length)
            const body = { items, workspace: svc.ws }
            // 用户给了路径但没解析到东西：说清"我把它当成了哪个目录"
            if (raw && items.length === 0) {
              body.requested = raw
              body.resolvedTo = svc.ws
              body.hint =
                svc.ws === resolve(raw)
                  ? '这个目录下没有 .study，也没在它的上级目录里找到。请填工作区目录（通常是你放资料的项目根目录）。'
                  : '已向上找到工作区，但那里还没有学习项目。'
            }
            // 没带 ws 且当前目录是空的：顺手告诉界面哪个候选目录里有项目
            if (!raw && items.length === 0) {
              const found = await discoverWorkspaces()
              body.suggested = found.find((it) => it.count > 0)?.path ?? null
              body.candidates = found
            }
            return send(res, 200, body)
          }
          if (req.method === 'GET' && route.startsWith('/project/')) {
            const docId = decodeURIComponent(route.slice('/project/'.length))
            return send(res, 200, await svcOf(url).project(docId))
          }
          if (req.method === 'GET' && route === '/vocabulary') {
            return send(res, 200, svcOf(url).vocabulary())
          }
          if (req.method === 'POST' && route === '/ingest') {
            const body = await readBody(req)
            return send(res, 200, await svcOf(url).ingest(body.path, body))
          }
          if (req.method === 'POST' && route === '/term') {
            const body = await readBody(req)
            return send(res, 200, await svcOf(url).askTerm(body.docId, body))
          }
          if (req.method === 'GET' && route.startsWith('/render/')) {
            const docId = decodeURIComponent(route.slice('/render/'.length))
            return send(res, 200, { html: await svcOf(url).render(docId) })
          }
          return send(res, 404, { error: `未知接口 ${route}` })
        } catch (error) {
          return send(res, 400, { error: error?.message ?? String(error) })
        }
      },
    })
    return () => dispose?.()
  })
}

export { StudyService, StudyStore, nextStepOf }
