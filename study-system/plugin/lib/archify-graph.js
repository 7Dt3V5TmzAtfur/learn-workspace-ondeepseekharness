/**
 * 知识点关系图 → Archify 原生 diagram 候选。
 *
 * 为什么用 archify 而不是自己画 SVG：
 * 关系图的价值在"关系表达清楚"，而布局、正交走线、避让、图例、
 * 深浅色主题、缩放交互这些是硬件活。自己写这套等于重造一个半成品引擎，
 * 且每加一种关系都要改渲染代码。archify 已经把这些做完了。
 *
 * 选用 architecture 类型：它支持 row/col 网格布局 + 任意 from/to 连线，
 * 正好承载"分层 + 多种关系"。workflow 是泳道式、tree 只允许单父级，都不合适。
 */

/** 关系类型 → archify 连线语义（用 4 种 variant 表达各类关系） */
const REL_VARIANT = {
  prerequisite: 'emphasis', // 前置：主线，最重要
  'part-of': 'default', // 整体部分
  partof: 'default',
  contains: 'default',
  contrast: 'dashed', // 对比：虚线，视觉上"不是主流程"
  cause: 'emphasis', // 因果：主线
  'example-of': 'default', // 例证
  example: 'default',
  application: 'default', // 应用
  apply: 'default',
  sequence: 'default', // 次序
  analogy: 'dashed', // 类比：虚线
  related: 'dashed',
}

/** 参与"知识依赖"分层的关系：有方向、表示"要先懂前者" */
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

/** 知识节点 → archify 组件种类（用颜色区分知识性质） */
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

/** 每种关系的图例说明 */
export const REL_LEGEND = {
  prerequisite: '前置：要先懂 A 才能懂 B',
  'part-of': '整体-部分：A 是 B 的组成部分',
  partof: '整体-部分：A 是 B 的组成部分',
  contains: '包含：A 含有 B',
  contrast: '对比：A 与 B 常被混淆或相反',
  cause: '因果：A 导致 B',
  'example-of': '例证：B 是 A 的例子',
  example: '例证：B 是 A 的例子',
  application: '应用：A 用在哪',
  apply: '应用：A 用在哪',
  sequence: '次序：先 A 后 B',
  analogy: '类比：A 像 B',
  related: '相关',
}

/**
 * 把 relations 转成 archify architecture 候选。
 * @param {{nodes:Array, edges:Array, direction?:string}} relations
 * @param {{title?:string, output?:string, width?:number}} options
 */
export function relationsToArchify(relations, options = {}) {
  const nodes = relations?.nodes ?? []
  const edges = relations?.edges ?? []
  const title = options.title ?? '知识点逻辑衔接图'

  // ---- 分层 ----
  // 只用"知识依赖"类关系分层。对比/类比/例证不参与，否则会造出假层级。
  const layerEdges = edges.filter((e) => DEPENDENCY_RELATIONS.has(e.relation))
  const layerOf = layering(
    nodes.map((n) => n.id),
    layerEdges,
  )

  // ---- 同层内排序：按"与上一层邻接节点的平均列位置"排，减少线交叉 ----
  const byLayer = new Map()
  for (const n of nodes) {
    const l = layerOf.get(n.id) ?? 0
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l).push(n)
  }
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b)

  const colOf = new Map()
  for (const l of layerKeys) {
    byLayer.get(l).sort((p, q) => {
      const pc = avgNeighborCol(p.id, edges, colOf)
      const qc = avgNeighborCol(q.id, edges, colOf)
      return pc - qc
    })
    byLayer.get(l).forEach((n, i) => colOf.set(n.id, i))
  }

  // ---- 组装 components：自己算绝对坐标 ----
  //
  // 排布目标：让整张图缩到 1440 宽时字仍然看得清。
  // archify 的 browser-check 会按缩放比判断字号，所以画布不能太宽。
  // 做法：按层分行，但同层节点数超过 maxPerRow 时折成多行，
  // 把总宽压在 ~2200px 以内（1440 视口下缩放不超过 1.6 倍）。
  const cellW = Math.max(...nodes.map((n) => labelWidth(n.label ?? n.id)), 120)
  const cellH = 58
  const GAP_X = 44
  const GAP_Y = 84
  const PAD = 40
  const MAX_CANVAS_W = 2200
  const maxPerRow = Math.max(1, Math.floor((MAX_CANVAS_W - PAD * 2 + GAP_X) / (cellW + GAP_X)))

  // 每一层可能被折成 subRows 行；记录每个节点最终的 (row, col)
  const slots = new Map()
  let cursorRow = 0
  for (const l of layerKeys) {
    const group = byLayer.get(l)
    group.forEach((n, i) => {
      const sub = Math.floor(i / maxPerRow)
      const inRow = i % maxPerRow
      slots.set(n.id, { row: cursorRow + sub, col: inRow, countInRow: Math.min(maxPerRow, group.length - sub * maxPerRow) })
    })
    cursorRow += Math.ceil(group.length / maxPerRow)
  }

  const rowCount = cursorRow
  const maxCols = Math.max(...[...slots.values()].map((s) => s.countInRow), 1)
  const canvasW = PAD * 2 + maxCols * cellW + (maxCols - 1) * GAP_X

  const components = [...slots.entries()].map(([id, slot]) => {
    const n = nodes.find((x) => x.id === id)
    const kind = n.kind ?? 'concept'
    const rowW = slot.countInRow * cellW + (slot.countInRow - 1) * GAP_X
    const startX = PAD + (canvasW - PAD * 2 - rowW) / 2
    const comp = {
      id: safeId(n.id),
      type: KIND_TYPE[kind] ?? KIND_TYPE.default,
      label: String(n.label ?? n.id),
      pos: [Math.round(startX + slot.col * (cellW + GAP_X)), PAD + slot.row * (cellH + GAP_Y)],
      size: [cellW, cellH],
    }
    if (n.note) comp.sublabel = clip(n.note, 60)
    if (n.kind && n.kind !== 'concept') comp.tag = kind
    return comp
  })

  // 记录每个节点的矩形，供连线选边
  const rectOf = new Map(components.map((c) => [c.id, { x: c.pos[0], y: c.pos[1], w: c.size[0], h: c.size[1] }]))
  const rects = components.map((c) => ({ id: c.id, ...rectOf.get(c.id) }))
  const canvasRight = Math.max(...rects.map((r) => r.x + r.w))

  const idMap = new Map(nodes.map((n) => [n.id, safeId(n.id)]))

  // ---- 组装 connections ----
  // 出入边按两节点的相对位置决定，尽量走"最短且不穿别人"的方向：
  // 目标在下一行 → 下出上进；同行 → 右出左进；目标在上方 → 上出下进。
  const connections = edges
    .filter((e) => idMap.has(e.from) && idMap.has(e.to) && e.from !== e.to)
    .map((e, i) => {
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
        const rowGap = Math.abs(b.y - a.y)
        const oneRow = rowGap <= cellH + GAP_Y + 8

        if (b.y > a.y) {
          conn.fromSide = 'bottom'
          conn.toSide = 'top'
          if (!oneRow) {
            // 先到自己下方空隙横移到目标列，再看沿目标列下落会不会撞人
            const laneY = a.y + a.h + GAP_Y * 0.4
            const probeX = bcx
            if (columnBlocked(rects, probeX, laneY, b.y, [conn.from, conn.to])) {
              // 目标列中途有节点：绕到右侧边道
              conn.via = rightLaneVia(a, b, acx, bcx, canvasRight, rects, [conn.from, conn.to])
            } else {
              conn.via = [
                [acx, laneY],
                [bcx, laneY],
              ]
            }
          }
        } else if (b.y < a.y) {
          conn.fromSide = 'top'
          conn.toSide = 'bottom'
          if (!oneRow) {
            const laneY = a.y - GAP_Y * 0.4
            if (columnBlocked(rects, bcx, b.y, laneY, [conn.from, conn.to])) {
              conn.via = rightLaneVia(a, b, acx, bcx, canvasRight, rects, [conn.from, conn.to])
            } else {
              conn.via = [
                [acx, laneY],
                [bcx, laneY],
              ]
            }
          }
        } else if (Math.abs(bcx - acx) <= a.w + 80) {
          // 同层且相邻：直接左右连
          conn.fromSide = bcx >= acx ? 'right' : 'left'
          conn.toSide = bcx >= acx ? 'left' : 'right'
        } else {
          // 同层但隔得远：从底部绕到本行下方再过去，
          // 否则直线会从中间那些节点身上穿过去。
          const laneY = a.y + a.h + 40
          conn.fromSide = 'bottom'
          conn.toSide = 'bottom'
          conn.via = [
            [acx, laneY],
            [bcx, laneY],
          ]
        }
      }
      // 连线文字在大图上会被整体缩放得看不清（archify 的 browser-check 会拦），
      // 所以默认不加；关系类型由线型（实线/虚线）+ 图例表达。
      if (options.edgeLabels && ['prerequisite', 'cause', 'contrast'].includes(e.relation)) {
        conn.label = REL_SHORT[e.relation] ?? e.relation
      }
      return conn
    })

  // ---- 卡片：图例 + 分层说明 ----
  const usedRels = [...new Set(edges.map((e) => e.relation))]
  const cards = [
    {
      dot: 'cyan',
      title: '关系类型',
      items: usedRels.slice(0, 6).map((r) => REL_LEGEND[r] ?? r),
    },
    {
      dot: 'rose',
      title: '怎么读这张图',
      items: [
        '从上往下：越靠上是越基础的先修知识',
        '实线是知识依赖，虚线是对比或类比',
        '点节点可以聚焦它直接相关的关系',
      ],
    },
  ]

  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title,
      quality_profile: 'showcase',
      ...(options.output ? { output: options.output } : {}),
    },
    // 坐标已在 components.pos 里给全，不再声明 grid 布局
    components,
    connections,
    cards,
  }
}

const REL_SHORT = {
  prerequisite: '前置',
  cause: '因果',
  contrast: '对比',
}

/** archify 的 id 只接受简单标识，把中文/符号都换成安全形式 */
function safeId(raw) {
  const s = String(raw ?? '')
  if (/^[A-Za-z0-9_-]{1,64}$/.test(s)) return s
  // 非 ASCII id 用短哈希，保证稳定且唯一
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return `n${Math.abs(h).toString(36)}`
}

function clip(s, n) {
  const t = String(s ?? '')
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/** 两个节点是否占同一列（横向范围重叠） */
function sameColumn(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w
}

/** 竖直段 x=px、从 y1 到 y2 之间，有没有别的节点挡着（排除端点节点） */
function columnBlocked(rects, px, y1, y2, skipIds) {
  const top = Math.min(y1, y2)
  const bottom = Math.max(y1, y2)
  for (const r of rects) {
    if (skipIds.includes(r.id)) continue
    if (px > r.x - 6 && px < r.x + r.w + 6 && r.y + r.h > top && r.y < bottom) return true
  }
  return false
}

/**
 * 跨多层时的走法：找一条"源列与目标列之间、全高度无节点"的竖直通道。
 *
 * 优先用中间的空隙（近、绕路短），都不行才退回画布最右侧边道。
 * 直接上下连会穿过中间行的同列节点，所以必须借一条无遮挡的通道。
 */
function rightLaneVia(a, b, acx, bcx, canvasRight, rects, skipIds) {
  const yTop = Math.min(a.y, b.y)
  const yBottom = Math.max(a.y + a.h, b.y + b.h)
  const yA = a.y < b.y ? a.y + a.h + 22 : a.y - 22
  const yB = a.y < b.y ? b.y - 22 : b.y + b.h + 22

  const lo = Math.min(acx, bcx)
  const hi = Math.max(acx, bcx)
  const candidates = []
  for (let x = lo + 10; x < hi; x += 10) candidates.push(x)
  // 靠近两端的候选优先：绕路最短
  candidates.sort(
    (p, q) => Math.min(Math.abs(p - lo), Math.abs(p - hi)) - Math.min(Math.abs(q - lo), Math.abs(q - hi)),
  )

  for (const x of candidates) {
    let free = true
    for (const r of rects) {
      if (skipIds.includes(r.id)) continue
      if (x > r.x - 10 && x < r.x + r.w + 10 && r.y + r.h > yTop && r.y < yBottom) {
        free = false
        break
      }
    }
    if (free) {
      return [
        [acx, yA],
        [x, yA],
        [x, yB],
        [bcx, yB],
      ]
    }
  }

  const laneX = canvasRight + 64
  return [
    [acx, yA],
    [laneX, yA],
    [laneX, yB],
    [bcx, yB],
  ]
}

/**
 * 估算一个标签需要多宽才不被裁掉。
 * archify 默认节点宽 120px，标签超宽会报 component-label-overflow。
 * 中文按 1 个字号宽、ASCII 约 0.56 个字号宽，再加左右内边距。
 */
function labelWidth(label) {
  const fontSize = 12.5
  let w = 0
  for (const ch of String(label ?? '')) {
    w += /[\u2000-\u9fff\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.56
  }
  return Math.min(420, Math.max(120, Math.ceil((w + 34) / 10) * 10))
}

/** 把"前置"类关系的权重平均，粗略估算节点在层内的期望列 */
function avgNeighborCol(id, edges, colOf) {
  const cols = []
  for (const e of edges) {
    if (e.from === id && colOf.has(e.to)) cols.push(colOf.get(e.to))
    if (e.to === id && colOf.has(e.from)) cols.push(colOf.get(e.from))
  }
  if (!cols.length) return 0
  return cols.reduce((a, b) => a + b, 0) / cols.length
}

/**
 * 分层：自顶向下按"知识依赖深度"排。
 *
 * 不用 Kahn 的"入度为 0 就是第 0 层"——那样会把所有彼此无关的知识点
 * 全堆在同一行（实测 33 个节点里有 11 个挤在顶层），网格必然重叠。
 *
 * 这里改成：以"到最远下游节点的距离"作为层号，让长依赖链自然展开，
 * 同层节点数大幅下降。有环时用 stack 集合截断，不会死循环。
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
  // 深度大 = 更靠上（更基础）；层号从上往下递增
  return new Map(allIds.map((id) => [id, maxDepth - depth.get(id)]))
}
