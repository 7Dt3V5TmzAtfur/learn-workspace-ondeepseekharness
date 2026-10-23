/**
 * 零依赖 Markdown → HTML 渲染器。
 *
 * 为什么放在宿主而不是客户端：
 * 1) 解析规则只实现一次，界面不自己算（沿用全系统的分层原则）。
 * 2) 客户端只需 dangerouslySetInnerHTML 插入结果，不用手搓 DOM 拼接。
 * 3) 篇幅可控，纯函数、易测。
 *
 * 安全：输入来自用户自己的本地资料，但仍转义所有文本节点，
 * 并且只放行白名单内的标签与属性，避免资料里夹带 script。
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/** 行内渲染：code → 粗体 → 斜体 → 删除线 → 链接 → 图片。图片先于链接匹配。 */
function renderInline(text) {
  // 行内代码最先，避免里面的星号被当强调
  const slots = []
  const hold = (html) => `\u0000${slots.push(html) - 1}\u0000`

  let out = String(text ?? '')

  out = out.replace(/`([^`\n]+)`/g, (_m, code) => hold(`<code>${escapeHtml(code)}</code>`))

  // 图片
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, alt, src, title) =>
    hold(
      `<img src="${escapeHtml(safeUrl(src))}" alt="${escapeHtml(alt)}"${
        title ? ` title="${escapeHtml(title)}"` : ''
      } loading="lazy" />`,
    ),
  )

  // 链接
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, label, href, title) =>
    hold(
      `<a href="${escapeHtml(safeUrl(href))}" target="_blank" rel="noopener noreferrer"${
        title ? ` title="${escapeHtml(title)}"` : ''
      }>${renderInline(label)}</a>`,
    ),
  )

  // 脚注引用 [^id]
  out = out.replace(/\[\^([^\]]+)\]/g, (_m, id) => hold(`<sup class="sc-fn">${escapeHtml(id)}</sup>`))

  out = escapeHtml(out)

  // 转义后 emphasis 标记还在，可以安全替换
  out = out
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')

  // 还原占位
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i) => slots[Number(i)])
}

/** 只允许 http(s)、mailto、相对路径与 data:image；挡掉 javascript:。 */
function safeUrl(url) {
  const raw = String(url ?? '').trim()
  if (/^(https?:|mailto:)/i.test(raw)) return raw
  if (/^data:image\//i.test(raw)) return raw
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '#' // 其他协议一律拦下
  return raw
}

/** 表格分隔行：允许 |---|:--|:-:|--:| 等各种写法（至少一个短横线）。 */
function isTableSeparator(line) {
  const t = String(line ?? '').trim()
  if (!t.includes('-')) return false
  if (!/^[|\s:-]+$/.test(t)) return false
  const cells = t
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
  if (cells.length === 0) return false
  return cells.every((c) => /^\s*:?-+:?\s*$/.test(c))
}

function splitRow(line) {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())
}

/**
 * 逐块渲染。
 * @param {string} markdown
 * @param {{ imageBase?: string, inline?: boolean }} options
 *   imageBase 用于把相对图片路径改写成 HTTP 路由
 *   inline=true 时**不包 <p>**，只做行内转换。
 *   用于往标题、表格单元格、卡片标签里塞文字——那些地方本来就不能有块级元素，
 *   硬塞 <p> 会被 HTML 解析器强行闭合，把整块排版拆坏。
 */
export function renderMarkdown(markdown, options = {}) {
  const imageBase = options.imageBase ?? ''
  const inline = options.inline === true
  const rewriteImg = (html) =>
    imageBase
      ? html.replace(/src="(?!https?:|mailto:|data:|\/)([^"]+)"/g, (_m, src) => {
          const clean = src.replace(/^\.\//, '')
          // 逐段编码，保留路径分隔符，避免 %2F 让静态路由匹配不上
          const encoded = clean.split('/').map(encodeURIComponent).join('/')
          return `src="${escapeHtml(`${imageBase}${encoded}`)}"`
        })
      : html

  if (inline) {
    // 行内模式：把换行压成空格，去掉块级语法标记，只保留强调/代码/链接等
    const oneLine = String(markdown ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\n+/g, ' ')
      .trim()
    return rewriteImg(renderInline(oneLine))
  }

  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  const html = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 空行
    if (!line.trim()) {
      i += 1
      continue
    }

    // 代码围栏
    const fence = /^\s*(```|~~~)(.*)$/.exec(line)
    if (fence) {
      const marker = fence[1]
      const lang = fence[2].trim()
      const body = []
      i += 1
      while (i < lines.length && !new RegExp(`^\\s*${marker}`).test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1
      html.push(
        `<pre class="sc-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(
          body.join('\n'),
        )}</code></pre>`,
      )
      continue
    }

    // 标题
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level} class="sc-md-h${level}">${renderInline(heading[2].trim())}</h${level}>`)
      i += 1
      continue
    }

    // 分隔线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html.push('<hr />')
      i += 1
      continue
    }

    // 表格：当前行是表头，下一行是分隔行
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line)
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const left = c.startsWith(':')
        const right = c.endsWith(':')
        if (left && right) return 'center'
        if (right) return 'right'
        if (left) return 'left'
        return ''
      })
      i += 2
      const rows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]))
        i += 1
      }
      const th = header
        .map((c, k) => `<th${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${renderInline(c)}</th>`)
        .join('')
      const tb = rows
        .map(
          (cells) =>
            `<tr>${header
              .map(
                (_h, k) =>
                  `<td${aligns[k] ? ` style="text-align:${aligns[k]}"` : ''}>${renderInline(cells[k] ?? '')}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')
      html.push(`<div class="sc-table-wrap"><table class="sc-table"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`)
      continue
    }

    // 引用（可含粗体等行内语法，支持连续 > 行）
    if (/^\s*>/.test(line)) {
      const body = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      html.push(`<blockquote class="sc-quote">${body.map((b) => `<p>${renderInline(b)}</p>`).join('')}</blockquote>`)
      continue
    }

    // 脚注定义
    const footnote = /^\s*\[\^([^\]]+)\]:\s*(.*)$/.exec(line)
    if (footnote) {
      const id = footnote[1]
      const body = [footnote[2]]
      i += 1
      while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
        body.push(lines[i].trim())
        i += 1
      }
      html.push(
        `<div class="sc-footnote"><span class="sc-fn-id">${escapeHtml(id)}</span>${renderInline(body.join(' '))}</div>`,
      )
      continue
    }

    // 列表（有序/无序，支持一层嵌套）
    const listStart = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (listStart) {
      const ordered = /\d/.test(listStart[2])
      const items = []
      let baseIndent = listStart[1].length
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
        if (!m) {
          // 续行：缩进且非空
          if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
            items[items.length - 1].text += ` ${lines[i].trim()}`
            i += 1
            continue
          }
          break
        }
        if (m[1].length < baseIndent) break
        if (m[1].length > baseIndent) {
          // 嵌套一层
          const nested = []
          while (i < lines.length) {
            const nm = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
            if (!nm || nm[1].length <= baseIndent) break
            nested.push(nm[3])
            i += 1
          }
          if (nested.length && items.length) {
            items[items.length - 1].nested = nested
          }
          continue
        }
        items.push({ text: m[3] })
        i += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      const body = items
        .map((it) => {
          const inner = it.nested?.length
            ? `<ul>${it.nested.map((n) => `<li>${renderInline(n)}</li>`).join('')}</ul>`
            : ''
          return `<li>${renderInline(it.text)}${inner}</li>`
        })
        .join('')
      html.push(`<${tag} class="sc-list">${body}</${tag}>`)
      continue
    }

    // 段落：吃掉连续的普通行
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*(```|~~~)/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i].trim())
      i += 1
    }
    if (para.length) html.push(`<p>${renderInline(para.join(' '))}</p>`)
  }

  return rewriteImg(html.join('\n'))
}

/**
 * 把 Mermaid 源里常用的节点/边语法抽成结构，供 SVG 布局使用。
 * 只支持本项目 relations 用到的子集：graph TD/LR、A["label"]、A -->|rel| B、A -.-> B、A -.-|x| B
 */
/**
 * Mermaid 解析 + 布局：**降级路径**，不是主路径。
 *
 * 主路径是 archify（见 archify-figures.js）——它产出带交互和明暗主题的独立 HTML。
 * 这两个函数保留是因为：
 * 1. archify CLI 不可用时，界面至少还能画出一张静态图，而不是一片空白；
 * 2. `relations.json` 存的是关系数据，转成 Mermaid 源便于用户复制到别的工具里看。
 *
 * 所以：不要在正常流程里优先用它，也不要删——删了就没有兜底了。
 */
export function parseMermaid(source) {
  const nodes = new Map()
  const edges = []
  let direction = 'TD'
  for (const raw of String(source ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const dir = /^graph\s+(TD|LR|BT|RL)/i.exec(line)
    if (dir) {
      direction = dir[1].toUpperCase()
      continue
    }
    // 纯节点声明：id["label"]
    const solo = /^([A-Za-z0-9_-]+)\["?([^"\]]*)"?\]$/.exec(line)
    if (solo) {
      nodes.set(solo[1], { id: solo[1], label: solo[2].trim() })
      continue
    }
    // 边：A <arrow>|label| B  或  A --> B
    const edge = /^([A-Za-z0-9_-]+)(?:\["[^"]*"\])?\s*(-\.->|-\.-|-->|---|==>)\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_-]+)/.exec(
      line,
    )
    if (edge) {
      const [, from, arrow, label, to] = edge
      for (const id of [from, to]) if (!nodes.has(id)) nodes.set(id, { id, label: id })
      edges.push({
        from,
        to,
        label: label ?? '',
        dashed: arrow.startsWith('-.-'),
        relation: label ?? '',
      })
    }
  }
  return { direction, nodes: [...nodes.values()], edges }
}

/** 估算一段文字的像素宽度：中文按字号全宽，ASCII 按约 0.55 倍。 */
function textWidth(text, fontSize = 11.5) {
  let w = 0
  for (const ch of String(text ?? '')) {
    if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch)) w += fontSize
    else w += fontSize * 0.56
  }
  return w
}

/**
 * 分层布局：按前置关系做最长路径分层，同一层内均匀分布。
 * 节点宽度按标签实际宽度自适应，避免长标签被裁切。
 * 返回带坐标的节点与带路径的边，客户端只负责画。
 */
export function layoutGraph(source, options = {}) {
  const minWidth = options.width ?? 920
  const { direction, nodes, edges } = parseMermaid(source)
  if (nodes.length === 0) return { width: minWidth, height: 200, direction, nodes: [], edges: [] }

  const FONT = 11.5
  const PAD_X = 16
  const MIN_NODE_W = 96
  const MAX_NODE_W = 260
  const NODE_H = 44
  const H_GAP = 22
  const V_GAP = 74
  const PAD = 28

  // 每个节点的自适应宽度：最长一行决定宽度（行数上限 3，超出后面折）
  const nodeW = new Map()
  for (const n of nodes) {
    const raw = textWidth(n.label, FONT) + PAD_X * 2
    nodeW.set(n.id, Math.round(Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, raw))))
  }

  // 只把"实线有向边"当层级依据，虚线对比边不参与分层，避免成环就卡死
  const solid = edges.filter((e) => !e.dashed)
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of solid) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)

  // Kahn 拓扑分层：层号 = 到达它的最长路径
  const layer = new Map(nodes.map((n) => [n.id, 0]))
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id)
  const seen = new Set(queue)
  const outEdges = new Map(nodes.map((n) => [n.id, []]))
  for (const e of solid) outEdges.get(e.from)?.push(e)
  let guard = 0
  while (queue.length && guard < 10000) {
    guard += 1
    const id = queue.shift()
    for (const e of outEdges.get(id) ?? []) {
      layer.set(e.to, Math.max(layer.get(e.to) ?? 0, (layer.get(id) ?? 0) + 1))
      if (!seen.has(e.to)) {
        seen.add(e.to)
        queue.push(e.to)
      }
    }
  }
  // 成环残留节点：按出度放到底部一层，避免它们全挤在 0 层
  for (const n of nodes) if (!seen.has(n.id)) layer.set(n.id, (layer.get(n.id) ?? 0) + 1)

  const byLayer = new Map()
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0
    if (!byLayer.has(l)) byLayer.set(l, [])
    byLayer.get(l).push(n)
  }

  const layerOrder = [...byLayer.keys()].sort((a, b) => a - b)

  /* ---- 重心法减少相邻层之间的交叉 ----
   * 迭代若干轮：每一层节点按其在相邻层的邻居的平均位置（重心）重新排序。
   * 这是分层图布局里代价最低、收益最明显的降交叉手段。
   */
  const posInLayer = new Map()
  for (const l of layerOrder) byLayer.get(l).forEach((n, i) => posInLayer.set(n.id, i))

  const neighborsOf = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (e.from === e.to) continue
    neighborsOf.get(e.from)?.push(e.to)
    neighborsOf.get(e.to)?.push(e.from)
  }

  const reorder = (l, useUpper) => {
    const group = byLayer.get(l)
    const refLayer = useUpper ? l - 1 : l + 1
    const scored = group.map((n) => {
      const refs = (neighborsOf.get(n.id) ?? [])
        .map((id) => posInLayer.get(id))
        .filter((v) => v !== undefined)
      const bary = refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : posInLayer.get(n.id) ?? 0
      return { n, bary }
    })
    scored.sort((a, b) => a.bary - b.bary)
    byLayer.set(
      l,
      scored.map((s) => s.n),
    )
    scored.forEach((s, i) => posInLayer.set(s.n.id, i))
  }

  for (let round = 0; round < 4; round += 1) {
    for (let k = 1; k < layerOrder.length; k += 1) reorder(layerOrder[k], true)
    for (let k = layerOrder.length - 2; k >= 0; k -= 1) reorder(layerOrder[k], false)
  }
  void layerOrder

  const isVertical = direction === 'TD' || direction === 'BT'
  const layerWidth = (group) =>
    group.reduce((a, n) => a + nodeW.get(n.id), 0) + Math.max(0, group.length - 1) * H_GAP
  const layerList = [...byLayer.keys()].sort((a, b) => a - b)
  const widestLayer = Math.max(...layerList.map((l) => layerWidth(byLayer.get(l))))
  // 右侧 / 底部预留边道宽度：跨层边从这里绕行，绝不穿过节点区
  const LANE_W = 46
  const usedWidth = Math.max(minWidth, widestLayer + PAD * 2 + LANE_W)

  const placed = new Map()
  const maxPerLayer = Math.max(...layerList.map((l) => byLayer.get(l).length))
  // 节点区可用宽度要扣掉右侧边道
  const areaWidth = usedWidth - LANE_W
  layerList.forEach((l, li) => {
    const group = byLayer.get(l)
    if (isVertical) {
      const totalW = layerWidth(group)
      let cursor = (areaWidth - totalW) / 2
      group.forEach((n) => {
        const w = nodeW.get(n.id)
        placed.set(n.id, {
          ...n,
          x: cursor,
          y: PAD + li * (NODE_H + V_GAP),
          w,
          h: NODE_H,
          layer: l,
        })
        cursor += w + H_GAP
      })
    } else {
      const totalH = group.length * NODE_H + Math.max(0, group.length - 1) * 14
      const startY = PAD + (maxPerLayer * (NODE_H + 14) - totalH) / 2
      let colX = PAD
      for (let k = 0; k < li; k += 1) {
        colX += Math.max(...byLayer.get(layerList[k]).map((n) => nodeW.get(n.id))) + H_GAP * 2
      }
      group.forEach((n, k) => {
        placed.set(n.id, {
          ...n,
          x: colX,
          y: startY + k * (NODE_H + 14),
          w: nodeW.get(n.id),
          h: NODE_H,
          layer: l,
        })
      })
    }
  })

  const height = isVertical
    ? PAD * 2 + layerList.length * NODE_H + Math.max(0, layerList.length - 1) * V_GAP
    : PAD * 2 + maxPerLayer * (NODE_H + 14)

  /**
   * 边端点与走线通道。
   * - span=1：走目标层上方的空隙通道，横段不压任何节点。
   * - span=0（同层）：从节点侧边绕出，走本层上方的空隙。
   * - span>=2：横段改走画布最左/最右侧的专用边道，避免穿过中间层。
   */
  const layerTop = new Map()
  const layerBottom = new Map()
  for (const l of layerList) {
    const g = byLayer.get(l)
    const ys = g.map((n) => placed.get(n.id).y)
    layerTop.set(l, Math.min(...ys))
    layerBottom.set(l, Math.max(...ys) + NODE_H)
  }

  /* ---- 统一走线：所有边"下出上进"，横移只发生在层间空隙 ----
   * 空隙（相邻两层之间的空白带）里没有任何节点，因此横线永远不会压到节点。
   * 跨多层的边逐层下降，每一跳都借用对应的空隙。
   */
  const gapBand = (upperLayer) => {
    const top = layerBottom.has(upperLayer) ? layerBottom.get(upperLayer) : PAD
    const bottom = layerTop.get(upperLayer + 1) ?? top + V_GAP
    return { top, bottom, usable: Math.max(6, bottom - top) }
  }

  // 每层空隙内有多条边时，分配不同子通道，避免叠成一条粗线
  const gapDemand = new Map()
  for (const e of edges) {
    const a = placed.get(e.from)
    const b = placed.get(e.to)
    if (!a || !b || !isVertical) continue
    const lo = Math.min(a.layer, b.layer)
    const hi = Math.max(a.layer, b.layer)
    for (let g = lo; g < hi; g += 1) {
      if (!gapDemand.has(g)) gapDemand.set(g, [])
      gapDemand.get(g).push(e)
    }
  }
  const slotOf = new Map() // `${gap}:${from}->${to}` -> y
  for (const [gap, list] of gapDemand) {
    const band = gapBand(gap)
    list.sort((p1, q1) => {
      const a1 = placed.get(p1.from)
      const b1 = placed.get(p1.to)
      const a2 = placed.get(q1.from)
      const b2 = placed.get(q1.to)
      return (a1.x + a1.w / 2 + b1.x + b1.w / 2) / 2 - (a2.x + a2.w / 2 + b2.x + b2.w / 2) / 2
    })
    const n = list.length
    list.forEach((e, idx) => {
      // 在空隙内 25%~75% 区间错开，留出与节点的间距
      const frac = n === 1 ? 0.5 : 0.25 + (0.5 * idx) / (n - 1)
      slotOf.set(`${gap}:${e.from}->${e.to}`, band.top + band.usable * frac)
    })
  }

  const laidEdges = edges
    .map((e) => {
      const a = placed.get(e.from)
      const b = placed.get(e.to)
      if (!a || !b) return null

      if (!isVertical) {
        // 横向布局：左出右进，竖移发生在列间空隙
        const outX = a.x + a.w
        const outY = a.y + a.h / 2
        const inX = b.x
        const inY = b.y + b.h / 2
        const sameCol = b.layer === a.layer
        const channelX = sameCol
          ? Math.max(a.x + a.w, b.x + b.w) + 20
          : (Math.max(...byLayer.get(Math.min(a.layer, b.layer)).map((n) => placed.get(n.id).x + placed.get(n.id).w)) + inX) / 2
        const points = sameCol
          ? [
              [a.x + a.w / 2, a.y + a.h],
              [a.x + a.w / 2, channelX * 0 + Math.max(a.y + a.h, b.y + b.h) + 20],
              [b.x + b.w / 2, Math.max(a.y + a.h, b.y + b.h) + 20],
              [b.x + b.w / 2, b.y + b.h],
            ]
          : [
              [outX, outY],
              [channelX, outY],
              [channelX, inY],
              [inX, inY],
            ]
        return { ...e, points, vertical: false, route: sameCol ? 'below' : 'gap' }
      }

      const startX = a.x + a.w / 2
      const startY = a.y + a.h
      const endX = b.x + b.w / 2
      const endY = b.y

      if (a.layer === b.layer) {
        // 同层：从底部绕到本层下方的空隙，再折回目标底部
        const gap = a.layer
        const band = gapBand(gap)
        const cy = band.top + band.usable * 0.5
        const points = [
          [startX, startY],
          [startX, cy],
          [endX, cy],
          [endX, endY],
        ]
        return { ...e, points, vertical: true, route: 'same-layer' }
      }

      // 跨层：横移只发生在层间空隙里；跨多层的竖移走画布右侧专用边道，
      // 这样竖线段永远在节点区之外，不会从任何节点身上穿过。
      const dir = b.layer > a.layer ? 1 : -1
      const layerGapCount = Math.abs(b.layer - a.layer)

      if (layerGapCount === 1) {
        const gap = dir > 0 ? a.layer : a.layer - 1
        const band = gapBand(gap)
        const cy = slotOf.get(`${gap}:${e.from}->${e.to}`) ?? band.top + band.usable * 0.5
        const points = [
          [startX, startY],
          [startX, cy],
          [endX, cy],
          [endX, endY],
        ]
        return { ...e, points, vertical: true, route: 'gap' }
      }

      const lane = areaWidth + LANE_W / 2
      const firstGap = dir > 0 ? a.layer : a.layer - 1
      const lastGap = dir > 0 ? b.layer - 1 : b.layer
      const band1 = gapBand(firstGap)
      const band2 = gapBand(lastGap)
      const y1Slot = slotOf.get(`${firstGap}:${e.from}->${e.to}`) ?? band1.top + band1.usable * 0.5
      const y2Slot = slotOf.get(`${lastGap}:${e.from}->${e.to}`) ?? band2.top + band2.usable * 0.5
      const points = [
        [startX, startY],
        [startX, y1Slot],
        [lane, y1Slot],
        [lane, y2Slot],
        [endX, y2Slot],
        [endX, endY],
      ]
      return { ...e, points, vertical: true, route: 'lane' }
    })
    .filter(Boolean)

  return {
    width: Math.round(usedWidth),
    height: Math.round(height),
    direction,
    nodes: [...placed.values()],
    edges: laidEdges,
  }
}
