/**
 * 知识点关系图 → archify 可执行流程。
 *
 * 用户明确要求「知识点之间的逻辑衔接图用 archify 技能实现」，
 * 所以这里不是自己画图，而是把关系数据翻译成 archify 的 architecture
 * 候选文件，再调它的 CLI 跑完 validate/deliver/check/browser-check 四道门。
 *
 * 关键设计约束（都是实测踩出来的）：
 * 1. archify 的 browser-check 会按视口缩放判断字号可读性，
 *    画布宽度超过约 2200px 时 12.5px 字会被判定"看不清"。
 * 2. 节点数超过约 18 个时，一张图必然超宽。
 *    → 所以按上层分组拆成多张图，每张控制在可读规模。
 * 3. 同一列跨多层的连线一定穿过中间节点，
 *    → 走线时必须找到"全高度无遮挡"的竖直通道。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/* ------------------------------------------------------------ 常量表 */

/** 关系类型 → archify 连线语义 */
const REL_VARIANT = {
  prerequisite: 'emphasis',
  'part-of': 'default',
  partof: 'default',
  contains: 'default',
  contrast: 'dashed',
  cause: 'emphasis',
  'example-of': 'default',
  example: 'default',
  application: 'default',
  apply: 'default',
  sequence: 'default',
  analogy: 'dashed',
  related: 'dashed',
}

/** 参与"知识依赖"分层的关系（有方向、表示要先懂前者） */
const DEPENDENCY_RELATIONS = new Set([
  'prerequisite',
  'part-of',
  'partof',
  'contains',
  'sequence',
  'cause',
  'application',
  'apply',
])

/** 知识节点性质 → archify 组件类型（决定颜色） */
const KIND_TYPE = {
  concept: 'backend',
  premise: 'database',
  principle: 'security',
  method: 'frontend',
  example: 'external',
  'anti-pattern': 'security',
  problem: 'external',
  protocol: 'messagebus',
  risk: 'security',
  taxonomy: 'database',
  'tool-type': 'messagebus',
  fact: 'database',
  tool: 'messagebus',
  default: 'backend',
}

/** 关系中文名，用于图例 */
export const REL_ZH = {
  prerequisite: '前置',
  'part-of': '整体-部分',
  partof: '整体-部分',
  contains: '包含',
  contrast: '对比',
  cause: '因果',
  'example-of': '例证',
  example: '例证',
  application: '应用',
  apply: '应用',
  sequence: '次序',
  analogy: '类比',
  related: '相关',
}

/* ------------------------------------------------------------ 工具函数 */

/** archify 组件 id 只能用安全字符，中文 id 用哈希兜底 */
function safeId(id) {
  const s = String(id ?? '')
  if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(s)) return s
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return `n${Math.abs(h).toString(36)}`
}

function clip(s, n) {
  const t = String(s ?? '')
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/** 估算标签显示宽度：中文按 1 字宽、ASCII 按 0.56 字宽 */
function labelWidth(label) {
  const fontSize = 12.5
  let w = 0
  for (const ch of String(label ?? '')) {
    w += /[\u2000-\u9fff\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.56
  }
  return Math.min(420, Math.max(120, Math.ceil((w + 34) / 10) * 10))
}

/**
 * 按"到最远下游节点的距离"分层。
 *
 * 不用 Kahn 的"入度 0 就是第 0 层"——那会把所有互不相关的知识点堆在同一行，
 * 实测 33 个节点里 11 个全在顶层。按最长依赖链分层能让链自然展开。
 */
function layering(allIds, edges) {
  const idSet = new Set(allIds)
  const adj = new Map(allIds.map((id) => [id, []]))
  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to) || e.from === e.to) continue
    adj.get(e.from).push(e.to)
  }
  const memo = new Map()
  const depthOf = (id, stack) => {
    if (memo.has(id)) return memo.get(id)
    if (stack.has(id)) return 0
    stack.add(id)
    let best = 0
    for (const to of adj.get(id) ?? []) best = Math.max(best, depthOf(to, stack) + 1)
    stack.delete(id)
    memo.set(id, best)
    return best
  }
  const depth = new Map(allIds.map((id) => [id, depthOf(id, new Set())]))
  const maxDepth = Math.max(0, ...depth.values())
  return new Map(allIds.map((id) => [id, maxDepth - depth.get(id)]))
}

/* ------------------------------------------------------------ 主转换 */

const CELL_H = 58
const GAP_X = 44
const GAP_Y = 84
const PAD = 40
/** 画布宽度上限：超过这个值，1440 视口下缩放后字就看不清了 */
const MAX_CANVAS_W = 2000

/**
 * 把一组节点+边转换成 archify 候选对象。
 *
 * @param {{nodes:Array, edges:Array}} graph 已经筛过的子图
 * @param {{title:string, subtitle?:string, note?:string}} meta
 */
function subgraphToCandidate(graph, meta) {
  const nodes = graph.nodes ?? []
  const edges = (graph.edges ?? []).filter(
    (e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to) && e.from !== e.to,
  )
  const idMap = new Map(nodes.map((n) => [n.id, safeId(n.id)]))

  // ---- 分层 + 层内排序 ----
  const layerOf = layering(
    nodes.map((n) => n.id),
    edges.filter((e) => DEPENDENCY_RELATIONS.has(e.relation)),
  )
  const byLayer = new Map()
  for (const n of nodes) {
    const l = layerOf.get(n.id) ?? 0
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l).push(n)
  }
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b)

  // 层内按"邻居已分配列的平均值"排序，减少连线交叉
  const colOf = new Map()
  for (const l of layerKeys) {
    const group = byLayer.get(l)
    const score = (n) => {
      const cols = []
      for (const e of edges) {
        const other = e.from === n.id ? e.to : e.to === n.id ? e.from : null
        if (other && colOf.has(other)) cols.push(colOf.get(other))
      }
      return cols.length ? cols.reduce((a, b) => a + b, 0) / cols.length : Number.POSITIVE_INFINITY
    }
    group.sort((p, q) => score(p) - score(q))
    group.forEach((n, i) => colOf.set(n.id, i))
  }

  // ---- 坐标：层 = 行，层内 = 列；超宽则折行保证可读 ----
  const cellW = Math.max(...nodes.map((n) => labelWidth(n.label ?? n.id)), 120)
  const maxPerRow = Math.max(1, Math.floor((MAX_CANVAS_W - PAD * 2 + GAP_X) / (cellW + GAP_X)))

  const slots = new Map()
  let cursorRow = 0
  for (const l of layerKeys) {
    const group = byLayer.get(l)
    group.forEach((n, i) => {
      const sub = Math.floor(i / maxPerRow)
      const inRow = i % maxPerRow
      slots.set(n.id, {
        row: cursorRow + sub,
        col: inRow,
        countInRow: Math.min(maxPerRow, group.length - sub * maxPerRow),
      })
    })
    cursorRow += Math.ceil(group.length / maxPerRow)
  }

  const maxCols = Math.max(...[...slots.values()].map((s) => s.countInRow), 1)
  const canvasW = PAD * 2 + maxCols * cellW + (maxCols - 1) * GAP_X

  const components = nodes.map((n) => {
    const slot = slots.get(n.id)
    const kind = n.kind ?? 'concept'
    const rowW = slot.countInRow * cellW + (slot.countInRow - 1) * GAP_X
    const startX = PAD + (canvasW - PAD * 2 - rowW) / 2
    const comp = {
      id: idMap.get(n.id),
      type: KIND_TYPE[kind] ?? KIND_TYPE.default,
      label: String(n.label ?? n.id),
      pos: [Math.round(startX + slot.col * (cellW + GAP_X)), PAD + slot.row * (CELL_H + GAP_Y)],
      size: [cellW, CELL_H],
    }
    if (n.kind && n.kind !== 'concept') comp.tag = KIND_TYPE[kind] === 'security' ? '风险' : kind
    return comp
  })

  const rectOf = new Map(components.map((c) => [c.id, { x: c.pos[0], y: c.pos[1], w: c.size[0], h: c.size[1] }]))
  const rects = components.map((c) => ({ id: c.id, ...rectOf.get(c.id) }))
  const canvasRight = Math.max(...rects.map((r) => r.x + r.w))

  const sidePoint = (r, side) => {
    if (side === 'top') return [r.x + r.w / 2, r.y]
    if (side === 'bottom') return [r.x + r.w / 2, r.y + r.h]
    if (side === 'left') return [r.x, r.y + r.h / 2]
    return [r.x + r.w, r.y + r.h / 2]
  }

  /** 竖直段 x=px 从 y1 到 y2，是否被别的节点挡住 */
  const columnBlocked = (px, y1, y2, skip) => {
    const top = Math.min(y1, y2)
    const bottom = Math.max(y1, y2)
    for (const r of rects) {
      if (skip.includes(r.id)) continue
      if (px > r.x - 6 && px < r.x + r.w + 6 && r.y + r.h > top && r.y < bottom) return true
    }
    return false
  }

  /** 找一条从 lo 到 hi 之间"全高度无遮挡"的竖直通道，优先靠近两端 */
  const findLane = (lo, hi, yTop, yBottom, skip) => {
    const cands = []
    for (let x = Math.min(lo, hi) + 10; x < Math.max(lo, hi); x += 10) cands.push(x)
    cands.sort(
      (p, q) =>
        Math.min(Math.abs(p - lo), Math.abs(p - hi)) - Math.min(Math.abs(q - lo), Math.abs(q - hi)),
    )
    for (const x of cands) {
      let free = true
      for (const r of rects) {
        if (skip.includes(r.id)) continue
        if (x > r.x - 10 && x < r.x + r.w + 10 && r.y + r.h > yTop && r.y < yBottom) {
          free = false
          break
        }
      }
      if (free) return x
    }
    return canvasRight + 64
  }

  // ---- 连线：按相对位置选边，跨层绕通道 ----
  const connections = edges.map((e, i) => {
    const fromId = idMap.get(e.from)
    const toId = idMap.get(e.to)
    const a = rectOf.get(fromId)
    const b = rectOf.get(toId)
    const conn = {
      id: `r${i}-${fromId}-${toId}`.slice(0, 60),
      from: fromId,
      to: toId,
      variant: REL_VARIANT[e.relation] ?? 'default',
    }
    if (a && b) {
      const acx = a.x + a.w / 2
      const bcx = b.x + b.w / 2
      const oneRow = Math.abs(b.y - a.y) <= CELL_H + GAP_Y + 8
      const skip = [fromId, toId]

      if (b.y > a.y) {
        conn.fromSide = 'bottom'
        conn.toSide = 'top'
        if (!oneRow) {
          const laneY = a.y + a.h + GAP_Y * 0.4
          const laneX = columnBlocked(bcx, laneY, b.y, skip) ? findLane(acx, bcx, a.y, b.y + b.h, skip) : bcx
          conn.via = [
            [acx, laneY],
            [laneX, laneY],
            [laneX, b.y - GAP_Y * 0.3],
            [bcx, b.y - GAP_Y * 0.3],
          ]
        }
      } else if (b.y < a.y) {
        conn.fromSide = 'top'
        conn.toSide = 'bottom'
        if (!oneRow) {
          const laneY = a.y - GAP_Y * 0.4
          const laneX = columnBlocked(bcx, b.y + b.h, laneY, skip) ? findLane(acx, bcx, b.y, laneY, skip) : bcx
          conn.via = [
            [acx, laneY],
            [laneX, laneY],
            [laneX, b.y + b.h + GAP_Y * 0.3],
            [bcx, b.y + b.h + GAP_Y * 0.3],
          ]
        }
      } else if (Math.abs(bcx - acx) <= a.w + 80) {
        conn.fromSide = bcx >= acx ? 'right' : 'left'
        conn.toSide = bcx >= acx ? 'left' : 'right'
      } else {
        const laneY = a.y + a.h + 40
        conn.fromSide = 'bottom'
        conn.toSide = 'bottom'
        conn.via = [
          [acx, laneY],
          [bcx, laneY],
        ]
      }
    }
    return conn
  })

  // ---- 图例卡片：把"线型 → 关系"的映射写清楚，否则用户看不懂图 ----
  const usedRels = [...new Set(edges.map((e) => e.relation))].filter((r) => REL_ZH[r])
  const cards = []
  if (usedRels.length) {
    cards.push({
      dot: 'cyan',
      title: '线型含义',
      items: usedRels.map((r) => {
        const v = REL_VARIANT[r]
        const style = v === 'emphasis' ? '粗实线' : v === 'dashed' ? '虚线' : '细实线'
        return `${style} → ${REL_ZH[r]}`
      }),
    })
  }
  cards.push({
    dot: 'emerald',
    title: '怎么读这张图',
    items: [
      '从上往下：越靠上是越基础的概念，先懂上面再看下面',
      '同一层里的节点彼此不构成前置依赖，可以任选顺序',
      meta.note ?? '节点颜色区分知识性质：蓝=概念、青=工具/协议、红=风险与反模式',
    ].filter(Boolean),
  })

  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title: meta.title,
      output: meta.output,
      quality_profile: 'standard',
    },
    components,
    connections,
    cards,
  }
}

/* ------------------------------------------------- 分组：把大图拆成可读的小图 */

/**
 * 把整张关系图按"根节点的可达集合"拆成若干张可读的图。
 *
 * 为什么要拆：archify 的 browser-check 判定字号可读，
 * 33 个节点铺出来的画布必然超宽，缩到 1440 视口后字就看不清了。
 * 拆到每张 ≤ maxNodes 个后，画布宽度能压住。
 *
 * 拆法：从入度为 0 的节点（"最基础的几个概念"）出发做 BFS，
 * 已分配过的节点不重复分配；剩余零散节点单独成一张。
 * 这样每张图都是一个"从一个基础概念长出来的知识簇"，语义完整。
 */
export function splitGraph(graph, maxNodes = 18) {
  const nodes = graph.nodes ?? []
  const edges = graph.edges ?? []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map(nodes.map((n) => [n.id, []]))
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to) continue
    out.get(e.from).push(e.to)
    indeg.set(e.to, indeg.get(e.to) + 1)
  }

  // 入度 0 = 没有前置，是最基础的起点
  const roots = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id)
  const order = roots.length ? roots : nodes.map((n) => n.id)
  const assigned = new Set()
  const groups = []

  for (const r of order) {
    if (assigned.has(r)) continue
    const seen = new Set([r])
    const queue = [r]
    const members = []
    while (queue.length && members.length < maxNodes) {
      const cur = queue.shift()
      if (!byId.has(cur)) continue
      members.push(cur)
      for (const nxt of out.get(cur) ?? []) {
        if (!seen.has(nxt)) {
          seen.add(nxt)
          queue.push(nxt)
        }
      }
    }
    if (!members.length) continue
    members.forEach((m) => assigned.add(m))
    groups.push(members)
  }

  // 剩下没被任何根覆盖的（成环等），按顺序补齐
  const leftover = nodes.map((n) => n.id).filter((id) => !assigned.has(id))
  for (let i = 0; i < leftover.length; i += maxNodes) {
    groups.push(leftover.slice(i, i + maxNodes))
  }

  return groups
    .map((ids, i) => {
      const set = new Set(ids)
      return {
        index: i + 1,
        nodes: ids.map((id) => byId.get(id)).filter(Boolean),
        edges: edges.filter((e) => set.has(e.from) && set.has(e.to)),
      }
    })
    .filter((g) => g.nodes.length > 0)
}

/* --------------------------------------------------------- 调用 archify */

/** 找 archify CLI：优先 DSH_HOME/skills，其次 ~/.dsh/skills */
function findArchifyCli() {
  const homes = [process.env.DSH_HOME, join(homedir(), '.dsh')].filter(Boolean)
  for (const h of homes) {
    for (const name of ['archify-2', 'archify']) {
      const p = join(h, 'skills', name, 'bin', 'archify.mjs')
      if (existsSync(p)) return p
    }
  }
  return null
}

function runNode(args, opts = {}) {
  return new Promise((done) => {
    const child = spawn(process.execPath, args, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    child.on('error', (e) => done({ code: -1, stdout, stderr: String(e?.message ?? e) }))
    child.on('close', (code) => done({ code, stdout, stderr }))
    if (opts.timeoutMs) setTimeout(() => child.kill(), opts.timeoutMs)
  })
}

/**
 * 生成 archify 图。返回每张图的状态，失败不影响主流程（关系图数据已落盘）。
 *
 * @param {{nodes:Array, edges:Array}} graph relations.json 内容
 * @param {object} opts
 * @param {string} opts.outDir   生成的 html 放在哪（相对 outDir 的正式目录）
 * @param {string} opts.workDir  跑 archify 的工作目录（候选文件与输出都相对它）
 * @param {string} opts.docTitle 资料标题，用作图标题
 * @returns {Promise<{ok:boolean, cli:string|null, figures:Array, reason?:string}>}
 */
export async function buildArchifyFigures(graph, opts) {
  const cli = findArchifyCli()
  if (!cli) {
    return { ok: false, cli: null, figures: [], reason: '未找到 archify 技能（bin/archify.mjs）' }
  }

  const groups = splitGraph(graph, opts.maxNodes ?? 18)
  if (!groups.length) {
    return { ok: false, cli, figures: [], reason: '关系图为空，没有可画的节点' }
  }

  await mkdir(opts.workDir, { recursive: true })
  const figures = []

  for (const g of groups) {
    const stem = `graph-${g.index}`
    const candidatePath = join(opts.workDir, `${stem}.candidate.json`)
    const htmlName = `${stem}.html`
    // archify 要求 meta.output 相对 cwd，所以用 workDir 内的相对名
    const candidate = subgraphToCandidate(g, {
      title: `${opts.docTitle}（${g.index}/${groups.length}）`,
      output: htmlName,
      note: `${g.nodes.length} 个知识点、${g.edges.length} 条关系`,
    })
    await writeFile(candidatePath, JSON.stringify(candidate, null, 2), 'utf8')

    const r = await runNode([cli, 'finalize', 'architecture', stem + '.candidate.json', htmlName, '--quality', 'standard', '--json'], {
      cwd: opts.workDir,
      timeoutMs: 90_000,
    })

    let diag = null
    try {
      diag = JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop() ?? '{}')
    } catch {
      diag = null
    }

    // 即使 archify 判定不完全合格，只要 html 产出了就可用——先给用户看到东西
    const htmlPath = join(opts.workDir, htmlName)
    const produced = existsSync(htmlPath)

    figures.push({
      index: g.index,
      file: htmlName,
      nodeCount: g.nodes.length,
      edgeCount: g.edges.length,
      nodeIds: g.nodes.map((n) => n.id),
      ok: Boolean(diag?.ok),
      produced,
      failedStage: diag?.failedStage ?? null,
      diagnostics: (diag?.diagnostics ?? []).slice(0, 6).map((d) => ({
        severity: d.severity,
        code: d.code,
        message: clip(d.message, 200),
      })),
      sizeBytes: produced ? (await readFile(htmlPath)).length : 0,
    })
  }

  const usable = figures.filter((f) => f.produced).length
  return {
    ok: usable > 0,
    cli,
    figures,
    reason: usable === figures.length ? undefined : `${figures.length - usable} 张图未产出`,
  }
}

export { subgraphToCandidate as _subgraphToCandidate }
