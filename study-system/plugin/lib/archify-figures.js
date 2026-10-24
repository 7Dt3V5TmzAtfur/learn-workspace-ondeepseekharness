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
 * 2. 一张图的节点上限是量出来的，不是猜的：从 18 逐档加到 26 拿去跑，
 *    四道门全过。实际取 25（见 DEFAULT_MAX_NODES 的说明）。
 * 3. 同一列跨多层的连线一定穿过中间节点，
 *    → 走线时必须找到"全高度无遮挡"的竖直通道。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

/** 表示"层级/依赖"的关系。拆图时它是骨架，其余关系只是旁证。 */
const DEPENDENCY_EDGES = new Set(['prerequisite', 'part-of', 'partof', 'contains', 'sequence', 'cause'])

/**
 * 把整张关系图拆成若干张可读的小图。
 *
 * 为什么要拆：archify 的 browser-check 判定字号可读，
 * 33 个节点铺出来的画布必然超宽，缩到 1440 视口后字就看不清了。
 * 拆到每张 ≤ maxNodes 个后，画布宽度能压住。所以拆不是审美选择，是硬约束。
 *
 * ---- 旧实现的两个错误（都被实测抓到了）----
 *
 * 1) 同一个节点出现在多张图里。
 *    旧代码从所有入度 0 的节点各做一次 BFS，每次都能走到共同的汇聚节点，
 *    于是「能力形态谱系」「默认取向」「披露策略」这些在 chapter4 的 6 张图里
 *    出现在 3 张。用户在两张图里看到同一个方块，会以为是两个不同的概念 ——
 *    这比少画一张图严重得多。
 *
 * 2) 碎片图。
 *    BFS 走到 maxNodes 就截断，剩下的节点开新组，于是出现
 *    18 / 11 / 11 / 2 / 5 / 4 这种分布：那张 2 节点的图其实是第 1 张图
 *    被截断的残渣，它内部的关系在别处已经画过了，单独成图没有任何信息量。
 *
 * ---- 现在的拆法 ----
 *
 *   第一步 按「依赖边」求连通分量。
 *          依赖边（前置 / 整体-部分 / 包含 / 次序 / 因果）是骨架，
 *          对比、例证、类比、应用是旁证 —— 旁证不该决定谁和谁同一张图，
 *          否则几乎所有节点都会被拉到一起。
 *          实测依赖边占全部边的 68%~73%，说明这个区分是有数据的、不是拍脑袋。
 *
 *   第二步 分量超过 maxNodes 才继续切：按拓扑层号二分，
 *          让每张图覆盖一段"从基础到派生"的连续层级，语义上仍然是完整的一段。
 *
 *   第三步 单点分量（没有任何依赖关系的孤立概念）合并成一张「其他概念」，
 *          不为它们各开一张图。它们本来就没有依赖可言，
 *          硬画成一张两三个方块的图只是浪费一次出图。
 *
 *   保证：**每个节点只归属一张图**。跨图的联系不再靠重复画节点表达，
 *   改由 buildFigureTitle 之外的界面提示去说（见 figures.json 的 crossRefs）。
 */
/**
 * 每张图最多几个节点。
 *
 * 这个数不是拍的，是量出来的：用 chapter1 / chapter4 的真实关系数据，
 * 从 18 逐档加到 26 拿去跑 archify，四道门（validate → deliver → check →
 * browser-check）全都过。18 是当初保守猜的，实测上限比它高。
 *
 * 取 25 而不是最大值，是因为 25 刚好让两份资料的"零边组"都归零：
 *   chapter4  3 图  22 / 6 / 5
 *   chapter1  2 图  25 / 8
 * 再往上加，组数不再减少，只是让单张图更挤。
 */
const DEFAULT_MAX_NODES = 25

export function splitGraph(graph, maxNodes = DEFAULT_MAX_NODES) {
  const nodes = graph.nodes ?? []
  const edges = graph.edges ?? []
  if (!nodes.length) return []
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // ---- 第一步：依赖边上的连通分量 ----
  const adj = new Map(nodes.map((n) => [n.id, new Set()]))
  for (const e of edges) {
    if (!DEPENDENCY_EDGES.has(e.relation)) continue
    if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to) continue
    adj.get(e.from).add(e.to)
    adj.get(e.to).add(e.from)
  }

  const seen = new Set()
  const comps = []
  for (const n of nodes) {
    if (seen.has(n.id)) continue
    const stack = [n.id]
    const comp = []
    seen.add(n.id)
    while (stack.length) {
      const cur = stack.pop()
      comp.push(cur)
      for (const nx of adj.get(cur) ?? []) {
        if (!seen.has(nx)) {
          seen.add(nx)
          stack.push(nx)
        }
      }
    }
    comps.push(comp)
  }

  // ---- 第三步（先挑出来）：单点分量攒在一起 ----
  const singles = comps.filter((c) => c.length === 1).flat()
  const multi = comps.filter((c) => c.length > 1).sort((a, b) => b.length - a.length)

  // ---- 第二步：过大的分量按依赖层级切 ----
  const layerOf = (ids) => {
    const set = new Set(ids)
    const indeg = new Map(ids.map((id) => [id, 0]))
    const out = new Map(ids.map((id) => [id, []]))
    for (const e of edges) {
      if (!DEPENDENCY_EDGES.has(e.relation)) continue
      if (!set.has(e.from) || !set.has(e.to) || e.from === e.to) continue
      out.get(e.from).push(e.to)
      indeg.set(e.to, indeg.get(e.to) + 1)
    }
    // Kahn 分层；环里的节点拿不到层号，最后统一放到最大层 + 1
    const lv = new Map(ids.map((id) => [id, 0]))
    const q = ids.filter((id) => indeg.get(id) === 0)
    const deg = new Map(indeg)
    let maxLv = 0
    while (q.length) {
      const cur = q.shift()
      for (const nx of out.get(cur) ?? []) {
        lv.set(nx, Math.max(lv.get(nx), lv.get(cur) + 1))
        maxLv = Math.max(maxLv, lv.get(nx))
        deg.set(nx, deg.get(nx) - 1)
        if (deg.get(nx) === 0) q.push(nx)
      }
    }
    for (const id of ids) if (!deg.has(id) || deg.get(id) > 0) lv.set(id, maxLv + 1)
    return lv
  }

  const chunks = []
  for (const comp of multi) {
    if (comp.length <= maxNodes) {
      chunks.push(comp)
      continue
    }
    // 按层号升序排列，然后按上限顺序装入，
    // 这样每块都是一个连续的层级区间，而不是随机的一把节点
    const lv = layerOf(comp)
    const sorted = [...comp].sort((a, b) => (lv.get(a) ?? 0) - (lv.get(b) ?? 0))
    for (let i = 0; i < sorted.length; i += maxNodes) {
      chunks.push(sorted.slice(i, i + maxNodes))
    }
  }

  // 孤立概念合成一张，最多也受 maxNodes 限制（真到那么多就再分）
  for (let i = 0; i < singles.length; i += maxNodes) {
    chunks.push(singles.slice(i, i + maxNodes))
  }

  // 单点的图排在最后：它们最不像"一个知识簇"
  const singleSet = new Set(singles)
  const ordered = [
    ...chunks.filter((c) => !singleSet.has(c[0]) || c.length > 1),
    ...chunks.filter((c) => singleSet.has(c[0]) && c.length === 1),
  ]

  const groups = ordered.map((ids, i) => {
    const set = new Set(ids)
    return {
      index: i + 1,
      nodes: ids.map((id) => byId.get(id)).filter(Boolean),
      edges: edges.filter((e) => set.has(e.from) && set.has(e.to)),
      // 这张图里没有依赖边的节点，图上会是散点，界面据此说明一句
      isolated: ids.filter((id) => {
        const nb = adj.get(id)
        return !nb || ![...nb].some((x) => set.has(x))
      }),
    }
  })

  /*
   * 收尾：把"不值得单独成图"的组并回去。
   *
   * 什么不值得：一条边都没有的组。它画出来就是几个互不相连的方块，
   * 既看不出关系，也占掉一次 archify 出图。实测这确实会发生 ——
   * 那些只有入边没有出边的末端概念，按层号切完后落在最后一块，
   * 而它们的邻居全在前一张图里。
   *
   * 并给谁：它在全图里连接最多的那张图。并回去以后至少还有边可看。
   * 硬约束：并完不能超过 maxNodes，否则宁可让它单独成图 ——
   * 超宽会被 archify 的 browser-check 判为字不可读，那比散点更糟。
   */
  const mergeInto = (target, from) => {
    target.nodes.push(...from.nodes)
    target.isolated = target.isolated.filter((id) => adj.get(id) && [...adj.get(id)].some((x) => target.nodes.some((n) => n.id === x)))
    const set = new Set(target.nodes.map((n) => n.id))
    target.edges = edges.filter((e) => set.has(e.from) && set.has(e.to))
  }

  let merged = true
  while (merged) {
    merged = false
    // 只有还存在"有边的组"时才并。整张图本来就没有关系时保持原样，
    // 否则会全部并成一张、再撑爆 maxNodes
    if (!groups.some((g) => g.edges.length > 0)) break
    // 从最小的、没有边的组开始并
    const cand = groups
      .filter((g) => g.nodes.length && g.edges.length === 0)
      .sort((a, b) => a.nodes.length - b.nodes.length)[0]
    if (!cand) break
    // 找 cand 的邻居最多、且并完不超限的目标组
    let best = null
    let bestScore = 0
    for (const g of groups) {
      if (g === cand) continue
      if (g.nodes.length + cand.nodes.length > maxNodes) continue
      const ids = new Set(g.nodes.map((n) => n.id))
      let score = 0
      for (const e of edges) {
        const a = ids.has(e.from)
        const b = ids.has(e.to)
        if (a !== b) {
          const other = a ? e.to : e.from
          if (cand.nodes.some((n) => n.id === other)) score += 1
        }
      }
      if (score > bestScore) {
        bestScore = score
        best = g
      }
    }
    if (best) {
      mergeInto(best, cand)
      groups.splice(groups.indexOf(cand), 1)
      merged = true
    }
  }

  // 全部都是散点时（整张图本来就没有关系），保留原样，不要并成空
  groups.forEach((g, i) => {
    g.index = i + 1
  })

  // ---- 跨图引用：节点不重复画，但关系不该消失 ----
  const groupOf = new Map()
  groups.forEach((g) => g.nodes.forEach((n) => groupOf.set(n.id, g.index)))
  const crossRefs = []
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue
    const a = groupOf.get(e.from)
    const b = groupOf.get(e.to)
    if (a && b && a !== b) {
      crossRefs.push({ from: e.from, to: e.to, relation: e.relation, groups: [a, b] })
    }
  }
  for (const g of groups) g.crossRefs = crossRefs.filter((c) => c.groups.includes(g.index))

  return groups.filter((g) => g.nodes.length > 0)
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
 * @param {string} opts.workDir  唯一的输出目录：候选文件、html、archify 回执都落在这里
 * @param {string} opts.docTitle 资料标题，用作图标题
 * @param {number} [opts.maxNodes] 每张图的节点上限，默认见 DEFAULT_MAX_NODES
 * @returns {Promise<{ok:boolean, cli:string|null, figures:Array, reason?:string}>}
 *
 * 注意：以前这里还有一个 opts.outDir，文档说"html 放哪"，
 * 但代码从没读过它 —— workDir 才是唯一的输出目录。
 * 两个字段指向同一个地方时看不出问题，一旦有人传了不同的值，
 * 图会落在 workDir，而调用方以为在 outDir，静默错位。
 * 已删掉这个字段，只留一个真值。
 */
export async function buildArchifyFigures(graph, opts) {
  const cli = findArchifyCli()
  if (!cli) {
    return { ok: false, cli: null, figures: [], reason: '未找到 archify 技能（bin/archify.mjs）' }
  }

  const groups = splitGraph(graph, opts.maxNodes ?? DEFAULT_MAX_NODES)
  if (!groups.length) {
    return { ok: false, cli, figures: [], reason: '关系图为空，没有可画的节点' }
  }

  await mkdir(opts.workDir, { recursive: true })
  const figures = []

  /*
   * 先清掉上一轮的 archify 证据文件。
   *
   * 不清会怎样：archify 的 browser-check 拒绝覆盖"不是本次运行产生"的证据文件，
   * 报 viewer/evidence-path-conflict / ownership-receipt-schema-mismatch，
   * 整张图判失败。实测确认过：目录里预置一个旧格式的同名
   * graph-N.browser-check.json，finalize 立刻 ok:false。
   *
   * 这个坑只在"以前出过图、后来升级过 archify"的机器上出现，
   * 也就是所有真正用过的机器 —— 所以必须主动清，不能指望环境干净。
   *
   * 可以安全删的理由：这几类文件都是派生产物，
   * 每次 finalize 都会重新生成，删掉不丢任何用户数据。
   * 只删 archify 自己的证据/回执，不动 graph-N.html 之外的东西。
   */
  const ARCHIFY_EVIDENCE_SUFFIXES = ['browser-check', 'finalize', 'finalize-summary', 'delivery', 'check', 'validate']
  for (let n = 1; n <= groups.length; n += 1) {
    for (const suffix of ARCHIFY_EVIDENCE_SUFFIXES) {
      const p = join(opts.workDir, `graph-${n}.${suffix}.json`)
      if (existsSync(p)) await rm(p, { force: true }).catch(() => {})
    }
  }
  // 上一轮图比这轮多时，多出来的 graph-N.html 也要清，
  // 否则界面会列出已经不存在的分组
  for (let n = groups.length + 1; n < groups.length + 12; n += 1) {
    for (const ext of ['html', 'candidate.json', 'browser-check.json', 'finalize.json', 'finalize-summary.json', 'delivery.json']) {
      const p = join(opts.workDir, `graph-${n}.${ext}`)
      if (existsSync(p)) await rm(p, { force: true }).catch(() => {})
    }
  }

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
