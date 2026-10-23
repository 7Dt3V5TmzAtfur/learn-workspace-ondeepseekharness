/**
 * 学习规则的机械校验。规则来源见 DESIGN.md「设计依据」表。
 *
 * 这里只做"确定性判断"：标签合不合法、三色预算超没超、六段式齐不齐、
 * 目标分级用没用规定动词。语义质量（写得对不对、好不好）由技能+模型负责。
 */

/** 渐构七类段落角色标签（tools/渐构+文案拆解标注.md）。 */
export const ROLE_LABELS = Object.freeze({
  d: { en: 'Definition', zh: '定义', means: '对概念、论点、过程或事物的清晰定义' },
  e: { en: 'Example', zh: '例子', means: '示例、例子、论据、案例或示范' },
  q: { en: 'Question', zh: '提问', means: '明确的问题、质疑、疑问、难点' },
  s: { en: 'Summary', zh: '总结', means: '结论、总结、归纳' },
  t: { en: 'Transfer', zh: '迁移', means: '过渡、推广到新情境、启发式迁移、行动方案' },
  c: { en: 'Comment', zh: '备注', means: '注释、补充说明、无法归入其他类别的描述' },
  v: { en: 'Verification', zh: '验证', means: '检验、测试、证明或确认' },
})

/** 三色注意力档位（七色语义收敛为三档，见 DESIGN.md 第 3 节）。 */
export const ATTENTION_TIERS = Object.freeze({
  core: { zh: '核心', color: 'blue', labels: ['d', 's'], budget: 0.10, why: '必须能复述的骨架' },
  hard: { zh: '攻坚', color: 'red', labels: ['q', 'v'], budget: 0.08, why: '必须停下来想的地方' },
  ref: { zh: '参考', color: 'green', labels: ['e', 't', 'c'], budget: null, why: '需要时回查' },
})

export const TOTAL_HIGHLIGHT_BUDGET = 0.20
export const SUMMARY_TARGET_CHARS = 300
export const SUMMARY_TOLERANCE = 0.4

/** 四档掌握程度 + 各自要求的可观察动词。 */
export const MASTERY_LEVELS = Object.freeze({
  了解: ['知道', '说出', '列举', '认出', '描述'],
  理解: ['解释', '说明', '举例', '归纳', '推断', '比较'],
  掌握: ['应用', '使用', '解决', '操作', '计算', '分析'],
  熟练掌握: ['综合', '迁移', '重构', '设计', '优化', '教给别人'],
})

export const PREFLIGHT_SECTIONS = Object.freeze([
  { key: 'summary', index: 1, title: '资料摘要', required: true },
  { key: 'goals', index: 2, title: '对我的帮助与目标', required: true },
  { key: 'difficulty', index: 3, title: '重点与难点', required: true },
  { key: 'assessment', index: 4, title: '考核方式与知识点', required: true },
  { key: 'exercises', index: 5, title: '思考题与作业', required: true },
  { key: 'references', index: 6, title: '参考资料', required: true },
])

// where 缺省时不要留 undefined 键：上层要把结果当无损 JSON 传给模型
const issue = (level, code, message, where) =>
  where === undefined || where === null
    ? { level, code, message }
    : { level, code, message, where }

/* ------------------------------------------------------------ 标注校验 */

function tierOf(label) {
  for (const [key, def] of Object.entries(ATTENTION_TIERS)) {
    if (def.labels.includes(label)) return key
  }
  return null
}

/**
 * 校验段落标注。
 *
 * 关键：三色高亮的是**原文里的短语（quote）**，不是整段。
 * 早期版本按整段字数算预算，导致一个 200 字的段落一标就超预算、
 * 而且渲染出来整段变色，注意力机制完全失效。
 * 现在每条标注必须给出原文片段，预算按片段字数算。
 *
 * @param {Array<{segmentId:string,label:string,quote:string,title?:string,keyword?:string,tier?:string,note?:string}>} items
 * @param {{segments:Array<{id:string,chars:number}>, totalChars:number}} context
 */
export function validateAnnotation(items, context) {
  const issues = []
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, issues: [issue('error', 'empty', '标注为空：至少要标注一个段落')], stats: null }
  }
  if (!context?.segments?.length) {
    return { ok: false, issues: [issue('error', 'no-segments', '缺少段落索引，先导入文档')], stats: null }
  }

  const known = new Set(context.segments.map((s) => s.id))
  const seen = new Map()
  const byTier = { core: 0, hard: 0, ref: 0 }
  let highlightedChars = 0
  const tierCharsMap = { core: 0, hard: 0, ref: 0 }
  const quoteRanges = new Map() // segmentId -> [[start,end], ...] 用于检测片段重叠

  for (const item of items) {
    const where = item?.segmentId ?? '(缺少 segmentId)'
    if (!item || typeof item.segmentId !== 'string') {
      issues.push(issue('error', 'missing-id', '标注项缺少 segmentId', where))
      continue
    }
    if (!known.has(item.segmentId)) {
      issues.push(issue('error', 'unknown-segment', `段落 ${item.segmentId} 不存在`, where))
      continue
    }
    if (seen.has(item.segmentId)) {
      issues.push(issue('error', 'duplicate', `段落 ${item.segmentId} 被标注了多次，每段只能有一个档位`, where))
      continue
    }
    seen.set(item.segmentId, item)

    const label = String(item.label ?? '').replace(/^#/, '').toLowerCase()
    if (!ROLE_LABELS[label]) {
      issues.push(issue('error', 'bad-label', `标签 "${item.label}" 不在七类之内（d/e/q/s/t/c/v）`, where))
      continue
    }
    if (!String(item.title ?? '').trim()) {
      issues.push(issue('warn', 'no-title', '标签后缺少高度概括短语（应写成 "#标签 概括内容|English"）', where))
    }
    if (label === 'c') {
      const kw = String(item.keyword ?? '').trim()
      if (!kw) issues.push(issue('error', 'c-needs-keyword', '#c 备注必须带两个字的类目关键词', where))
      else if ([...kw].length !== 2) issues.push(issue('warn', 'c-keyword-len', `#c 关键词建议两字，当前是 "${kw}"`, where))
    }

    // ---- 原文片段：必须原样出现在该段落里 ----
    const quote = String(item.quote ?? '').trim()
    const segText = context.segments.find((s) => s.id === item.segmentId)?.text ?? ''
    let quoteChars = 0
    if (!quote) {
      issues.push(
        issue(
          'error',
          'no-quote',
          '缺少 quote：三色高亮要加在原文的具体短语上，请给出原文片段（不要整段照抄）',
          where,
        ),
      )
    } else if (segText) {
      const idx = segText.indexOf(quote)
      if (idx < 0) {
        issues.push(
          issue(
            'error',
            'quote-not-found',
            `quote 在段落里找不到：「${quote.slice(0, 30)}${quote.length > 30 ? '…' : ''}」。必须逐字照抄原文`,
            where,
          ),
        )
      } else {
        quoteChars = [...quote].length
        const segChars = [...segText].length
        if (quoteChars >= segChars * 0.9) {
          issues.push(
            issue(
              'warn',
              'quote-too-long',
              'quote 几乎等于整段：挑一句最关键的短语即可，整段加粗等于没有重点',
              where,
            ),
          )
        }
        if (!quoteRanges.has(item.segmentId)) quoteRanges.set(item.segmentId, [])
        quoteRanges.get(item.segmentId).push([idx, idx + quote.length])
      }
    }

    const expected = tierOf(label)
    const tier = item.tier ?? expected
    if (!ATTENTION_TIERS[tier]) {
      issues.push(issue('error', 'bad-tier', `档位 "${item.tier}" 无效（core/hard/ref）`, where))
      continue
    }
    if (item.tier && item.tier !== expected) {
      issues.push(
        issue('warn', 'tier-mismatch', `标签 ${label} 自然归属 ${expected}，这里标成 ${tier}；如确有必要请保留`, where),
      )
    }
    byTier[tier] += 1
    tierCharsMap[tier] += quoteChars
    // 参考档是"需要时回查"，不算注意力高亮，不进预算
    if (tier !== 'ref') highlightedChars += quoteChars
  }

  const totalChars = context.totalChars || context.segments.reduce((a, s) => a + s.chars, 0) || 1
  const ratio = highlightedChars / totalChars

  if (ratio > TOTAL_HIGHLIGHT_BUDGET) {
    issues.push(
      issue(
        'error',
        'budget-total',
        `高亮覆盖 ${(ratio * 100).toFixed(1)}%，超过二八法则上限 ${TOTAL_HIGHLIGHT_BUDGET * 100}%。` +
          '请缩短 quote，或减少核心/攻坚档的条数。',
      ),
    )
  }

  for (const [key, def] of Object.entries(ATTENTION_TIERS)) {
    if (def.budget === null) continue
    if (!byTier[key]) continue
    const tierRatio = tierCharsMap[key] / totalChars
    if (tierRatio > def.budget) {
      issues.push(
        issue(
          'error',
          `budget-${key}`,
          `${def.zh}档占 ${(tierRatio * 100).toFixed(1)}%，超过该档上限 ${(def.budget * 100).toFixed(0)}%。` +
            `${def.zh}档只留${def.why}。`,
        ),
      )
    }
  }

  const labels = items.map((i) => String(i.label ?? '').replace(/^#/, '').toLowerCase())
  if (byTier.core === 0 && byTier.hard === 0) {
    issues.push(issue('warn', 'no-focus', '没有任何核心或攻坚档标注：这份材料可能被平均用力了'))
  }

  return {
    ok: !issues.some((i) => i.level === 'error'),
    issues,
    stats: {
      total: items.length,
      byTier,
      highlightedChars,
      totalChars,
      ratio: Number(ratio.toFixed(4)),
      tierChars: tierCharsMap,
      labelCounts: Object.fromEntries(Object.keys(ROLE_LABELS).map((k) => [k, labels.filter((l) => l === k).length])),
    },
  }
}

/* -------------------------------------------------------- 读前六段式 */

export function validatePreflight(plan) {
  const issues = []
  if (!plan || typeof plan !== 'object') {
    return { ok: false, issues: [issue('error', 'empty', '读前建构为空')] }
  }

  const summary = String(plan.summary ?? '').trim()
  if (!summary) issues.push(issue('error', 'summary-missing', '第 1 部分缺失：资料摘要'))
  else {
    const len = [...summary].length
    const min = SUMMARY_TARGET_CHARS * (1 - SUMMARY_TOLERANCE)
    const max = SUMMARY_TARGET_CHARS * (1 + SUMMARY_TOLERANCE)
    if (len < min || len > max) {
      issues.push(
        issue('warn', 'summary-length', `摘要 ${len} 字，建议 ${SUMMARY_TARGET_CHARS} 字左右（${Math.round(min)}–${Math.round(max)}）`),
      )
    }
  }

  const goals = plan.goals ?? {}
  if (!String(goals.help ?? '').trim()) issues.push(issue('error', 'goals-help', '第 2 部分缺失：这份资料对我的帮助'))
  const subgoals = Array.isArray(goals.subgoals) ? goals.subgoals : []
  if (!String(goals.main ?? '').trim()) issues.push(issue('error', 'goals-main', '第 2 部分缺失：总目标'))
  if (subgoals.length === 0) issues.push(issue('error', 'goals-sub', '第 2 部分缺失：子目标（至少 1 条）'))
  subgoals.forEach((sg, i) => {
    const text = typeof sg === 'string' ? sg : sg?.text
    if (!String(text ?? '').trim()) issues.push(issue('error', 'subgoal-empty', `子目标 ${i + 1} 为空`))
    if (typeof sg === 'object' && sg?.level && !MASTERY_LEVELS[sg.level]) {
      issues.push(issue('warn', 'subgoal-level', `子目标 ${i + 1} 的掌握档位 "${sg.level}" 不在四档之内`))
    }
  })

  const parts = Array.isArray(plan.parts) ? plan.parts : []
  if (parts.length === 0) issues.push(issue('error', 'parts-missing', '第 3 部分缺失：没有划分资料部分'))
  parts.forEach((part, i) => {
    const name = part?.title ?? `第 ${i + 1} 部分`
    if (!String(part?.title ?? '').trim()) issues.push(issue('error', 'part-title', `部分 ${i + 1} 缺标题`))
    if (!Array.isArray(part?.keyPoints) || part.keyPoints.length === 0) {
      issues.push(issue('error', 'part-keypoints', `${name}：缺少重点（第 3 部分要求逐条列出）`))
    }
    if (!Array.isArray(part?.difficulties) || part.difficulties.length === 0) {
      issues.push(issue('error', 'part-difficulties', `${name}：缺少难点（第 3 部分要求逐条列出）`))
    }
    const assessment = part?.assessment
    if (!assessment?.level || !MASTERY_LEVELS[assessment.level]) {
      issues.push(issue('error', 'part-level', `${name}：考核方式缺掌握档位（了解/理解/掌握/熟练掌握）`))
    }
    if (!String(assessment?.requirement ?? '').trim()) {
      issues.push(issue('error', 'part-requirement', `${name}：考核方式缺"达到什么要求"`))
    }
    if (!String(assessment?.purpose ?? '').trim()) {
      issues.push(issue('warn', 'part-purpose', `${name}：考核方式缺"我的目的是什么"`))
    }
    const kps = Array.isArray(part?.knowledgePoints) ? part.knowledgePoints : []
    if (kps.length === 0) issues.push(issue('error', 'part-kp', `${name}：缺少知识点（第 4 部分要求）`))
    kps.forEach((kp, j) => {
      if (!String(kp?.name ?? '').trim()) issues.push(issue('error', 'kp-name', `${name} 知识点 ${j + 1}：缺名称`))
      if (!String(kp?.content ?? '').trim()) issues.push(issue('error', 'kp-content', `${name} 知识点 ${j + 1}：缺内容`))
      if (kp?.note === undefined || String(kp.note).trim() === '') {
        issues.push(issue('warn', 'kp-note', `${name} 知识点 ${j + 1}：缺备注`))
      }
    })
  })

  const exercises = Array.isArray(plan.exercises) ? plan.exercises : []
  if (exercises.length === 0) issues.push(issue('error', 'exercises-missing', '第 5 部分缺失：思考题与作业'))
  exercises.forEach((ex, i) => {
    if (!String(ex?.question ?? '').trim()) issues.push(issue('error', 'exercise-empty', `思考题 ${i + 1} 为空`))
    if (!String(ex?.kind ?? '').trim()) issues.push(issue('warn', 'exercise-kind', `思考题 ${i + 1} 未标注类型（回想/解释/应用/迁移/批判）`))
  })

  const references = Array.isArray(plan.references) ? plan.references : []
  if (references.length === 0) issues.push(issue('error', 'refs-missing', '第 6 部分缺失：参考资料清单'))
  references.forEach((ref, i) => {
    if (!String(ref?.title ?? ref?.name ?? '').trim()) {
      issues.push(issue('error', 'ref-title', `参考资料 ${i + 1} 缺标题`))
    }
  })

  const missing = PREFLIGHT_SECTIONS.filter((s) => {
    if (s.key === 'summary') return !summary
    if (s.key === 'goals') return !goals.help || !goals.main || subgoals.length === 0
    if (s.key === 'difficulty') return parts.length === 0
    if (s.key === 'assessment') return parts.length === 0
    if (s.key === 'exercises') return exercises.length === 0
    if (s.key === 'references') return references.length === 0
    return false
  })

  return {
    ok: !issues.some((i) => i.level === 'error'),
    issues,
    missingSections: missing.map((s) => ({ index: s.index, key: s.key, title: s.title })),
    stats: {
      summaryChars: [...summary].length,
      parts: parts.length,
      knowledgePoints: parts.reduce((a, p) => a + (Array.isArray(p.knowledgePoints) ? p.knowledgePoints.length : 0), 0),
      exercises: exercises.length,
      references: references.length,
    },
  }
}

/* --------------------------------------------------------- 知识点关系 */

export const RELATION_TYPES = Object.freeze({
  'prerequisite': '前置：A 是理解 B 的前提',
  'part-of': '整体部分：A 属于 B',
  'contrast': '对比：A 与 B 相互区分',
  'cause': '因果：A 导致 B',
  'example-of': '例证：A 是 B 的例子',
  'application': '应用：A 用于 B',
  'sequence': '次序：A 先于 B',
  'analogy': '类比：A 与 B 同构',
})

export function validateRelations(graph) {
  const issues = []
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
  const edges = Array.isArray(graph?.edges) ? graph.edges : []
  if (nodes.length === 0) return { ok: false, issues: [issue('error', 'no-nodes', '知识图谱没有知识点节点')], stats: null }

  const ids = new Set()
  for (const node of nodes) {
    if (!String(node?.id ?? '').trim()) issues.push(issue('error', 'node-id', '知识点缺 id'))
    else if (ids.has(node.id)) issues.push(issue('error', 'node-dup', `知识点 id 重复：${node.id}`))
    else ids.add(node.id)
    if (!String(node?.label ?? '').trim()) issues.push(issue('error', 'node-label', `知识点 ${node?.id ?? '?'} 缺名称`))
  }
  for (const edge of edges) {
    if (!ids.has(edge?.from)) issues.push(issue('error', 'edge-from', `关系起点不存在：${edge?.from}`))
    if (!ids.has(edge?.to)) issues.push(issue('error', 'edge-to', `关系终点不存在：${edge?.to}`))
    if (!RELATION_TYPES[edge?.relation]) {
      issues.push(issue('error', 'edge-type', `关系类型 "${edge?.relation}" 无效`))
    }
  }

  // 前置关系必须无环，否则学习顺序不存在
  const pre = edges.filter((e) => e?.relation === 'prerequisite')
  const adj = new Map([...ids].map((id) => [id, []]))
  for (const e of pre) if (adj.has(e.from)) adj.get(e.from).push(e.to)
  const state = new Map()
  const cyclic = []
  const walk = (node, path) => {
    if (state.get(node) === 'done') return
    if (state.get(node) === 'doing') {
      cyclic.push([...path, node].join(' → '))
      return
    }
    state.set(node, 'doing')
    for (const next of adj.get(node) ?? []) walk(next, [...path, node])
    state.set(node, 'done')
  }
  for (const id of ids) walk(id, [])
  for (const cycle of cyclic) issues.push(issue('error', 'cycle', `前置关系成环：${cycle}`))

  const connected = new Set(edges.flatMap((e) => [e?.from, e?.to]))
  for (const id of ids) if (!connected.has(id)) issues.push(issue('warn', 'isolated', `知识点 ${id} 没有任何关系边`))

  return {
    ok: !issues.some((i) => i.level === 'error'),
    issues,
    stats: { nodes: nodes.length, edges: edges.length, relationCounts: Object.fromEntries(Object.keys(RELATION_TYPES).map((k) => [k, edges.filter((e) => e?.relation === k).length])) },
  }
}

/* ----------------------------------------------------------- 渲染工具 */

const TIER_CLASS = { core: 'sc-hl-core', hard: 'sc-hl-hard', ref: 'sc-hl-ref' }

const escHtml = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/**
 * 在段落文字里把 quote 包成三色 <strong>，返回转义安全的 HTML。
 *
 * 这是"三色加粗原文"的唯一实现点：
 * - 命中：`<strong class="sc-hl-core">原文片段</strong>`
 * - 未命中：原样输出（校验阶段已经拦过，这里只是兜底）
 *
 * 为什么不用 innerHTML 拼字符串再替换：原文可能有 <、& 等字符，
 * 必须先转义再插入标签，否则会出现 XSS 或标签错乱。这里采用
 * "按命中位置切片 + 逐片转义"的方式，天然安全。
 */
function highlightQuote(text, quote, tierClass) {
  if (!quote) return escHtml(text)
  const idx = text.indexOf(quote)
  if (idx < 0) return escHtml(text)
  const before = text.slice(0, idx)
  const hit = text.slice(idx, idx + quote.length)
  const after = text.slice(idx + quote.length)
  return `${escHtml(before)}<strong class="${tierClass}">${escHtml(hit)}</strong>${escHtml(after)}`
}

/**
 * 把原文 + 标注渲染成 HTML：整篇按 ¶N 分段，段内在原文位置做三色加粗。
 *
 * @param {Array<{id:string,text:string}>} segments
 * @param {{items:Array}} annotation
 */
export function renderAnnotatedHtml(segments, annotation) {
  const byId = new Map((annotation?.items ?? []).map((it) => [it.segmentId, it]))
  return segments
    .map((seg) => {
      const a = byId.get(seg.id)
      const tierClass = a ? TIER_CLASS[a.tier] ?? TIER_CLASS.core : ''

      // 段落角色徽标：#d 定义|Definition 形式（渐构要求的输出格式）
      let tag = ''
      if (a) {
        const role = ROLE_LABELS[String(a.label).replace(/^#/, '').toLowerCase()]
        const en = role?.en ?? ''
        const zh = role?.zh ?? ''
        const kw = a.keyword ? `${escHtml(a.keyword)} ` : ''
        tag =
          `<span class="sc-tag sc-tag-${escHtml(a.label)}" title="${escHtml(zh)}｜${escHtml(en)}">` +
          `#${escHtml(a.label)} ${kw}${escHtml(a.title ?? '')}` +
          `<span class="sc-tag-en">${escHtml(en)}</span></span>`
      }

      // 正文：如果是标题行就渲染成标题，否则做三色高亮
      const quote = a?.quote ? String(a.quote).trim() : ''
      const body = String(seg.text)
        .split('\n')
        .map((line) => {
          if (!line.trim()) return ''
          if (line.startsWith('#')) return `<div class="sc-h">${highlightQuote(line, quote, tierClass)}</div>`
          return `<p>${highlightQuote(line, quote, tierClass)}</p>`
        })
        .join('')

      // 备注单独一行，不参与高亮
      const note = a?.note ? `<div class="sc-seg-note">${escHtml(a.note)}</div>` : ''
      const tierAttr = a ? ` data-tier="${escHtml(a.tier ?? '')}"` : ''
      return `<section class="sc-seg" data-id="${escHtml(seg.id)}"${tierAttr}>${tag}${body}${note}</section>`
    })
    .join('\n')
}
