/**
 * 学习规则的机械校验。规则来源见 DESIGN.md「设计依据」表。
 *
 * 这里只做"确定性判断"：标签合不合法、三色预算超没超、六段式齐不齐、
 * 目标分级用没用规定动词。语义质量（写得对不对、好不好）由技能+模型负责。
 */

import { renderMarkdown } from './markdown.js'

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
/**
 * 三档注意力的语义与预算。
 *
 * token 名与 client.js 的 CSS 变量一一对应：--sc-core-line / -bg / -fg。
 * 早期这里写的是 blue/red/green（跟 DSH 状态色撞了），
 * 后来换成橙/品红/青，所以这里也跟着改成 token 名，
 * 免得读代码的人以为界面还是蓝红绿。
 */
export const ATTENTION_TIERS = Object.freeze({
  core: { zh: '核心', token: 'core', labels: ['d', 's'], budget: 0.10, why: '必须能复述的骨架' },
  hard: { zh: '攻坚', token: 'hard', labels: ['q', 'v'], budget: 0.08, why: '必须停下来想的地方' },
  ref: { zh: '参考', token: 'ref', labels: ['e', 't', 'c'], budget: null, why: '需要时回查' },
})

export const TOTAL_HIGHLIGHT_BUDGET = 0.20

/**
 * 段内高亮密度的生效门槛：段落至少这么长才检查"这一段是否被整段染色"。
 * 太短的段落里标一半字是正常做法，密度没有参考意义。
 */
export const SEGMENT_DENSITY_MIN_CHARS = 60
/**
 * 段长不超过这个数时，不判 quote-too-long。
 *
 * 一段 30 字、quote 28 字，比例 93%，但这一段本来就只有一个信息点，
 * 不存在"挑哪句"的余地。要求它更短只能把 quote 截成半句，反而更差。
 * 60 与 SEGMENT_DENSITY_MIN_CHARS 取同一个数：低于 60 字的段落，
 * 密度和取舍都谈不上。
 */
export const SHORT_SEGMENT_FOR_QUOTE = 60
/**
 * quote 不超过这个字数，且所在段落不是纯标题时，判为"碎片"。
 *
 * 依据：这类 quote 让覆盖率好看，但用户读到那里什么都得不到。
 * 系统会因此显得"完工"，实际一个能用的点都没留下 —— 这比漏标更糟，
 * 因为它把"没做"伪装成"做了"。
 */
export const FRAGMENT_QUOTE_MAX_CHARS = 6
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
        // 短段落（本身就只有一句话）不该被判"整段加粗"：
        // 段长 30 字、quote 28 字，比例 93% 触发了阈值，但这段根本没法再短。
        // 阈值只在段落长到"里面确实有多个信息点可供取舍"时才成立。
        const tooShortToSplit = segChars <= SHORT_SEGMENT_FOR_QUOTE
        if (!tooShortToSplit && quoteChars >= segChars * 0.9) {
          issues.push(
            issue(
              'warn',
              'quote-too-long',
              'quote 几乎等于整段：挑一句最关键的短语即可，整段加粗等于没有重点',
              where,
            ),
          )
        }
        // ---- 碎片检查 ----
        // 「维度」「按需」「比单写」这种 quote 也算"标了"，覆盖率会很好看，
        // 但用户读到那里得不到任何信息 —— 系统看起来完工，实际一个点都没留下。
        // 纯标题段豁免：标题本身就只有几个字，标标题是正确做法。
        const isHeadingOnly = /^#{1,6}\s/.test(segText.trim()) || /^\*\*[^*]+\*\*[.。]?$/.test(segText.trim())
        if (!isHeadingOnly && quoteChars <= FRAGMENT_QUOTE_MAX_CHARS) {
          issues.push(
            issue(
              'warn',
              'quote-fragment',
              `quote 只有 ${quoteChars} 字，用户看到「${quote}」得不到信息。请换成一句完整的判断（建议 12-30 字）`,
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

  /* 下界：只有上限没有下限，系统会"奖励偷懒"——标得越少越安全。
   * 原则原文《深度阅读的二八法则》说的是「不超过 10%-20%」，
   * 理想值就在这个区间里，不是"越少越好"。实测某份 29831 字的资料
   * 只标了 0.85%（253 字），翻一页只看到 7 个字有颜色，注意力机制等于没有。 */
  if (ratio < 0.02) {
    issues.push(
      issue(
        'warn',
        'budget-too-sparse',
        `高亮只占 ${(ratio * 100).toFixed(2)}%（${highlightedChars}/${totalChars} 字）。` +
          '原则建议 10%-20%，低于 2% 时三色注意力基本失效——' +
          '请回头给关键段落补标，而不是只标几处。',
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

  /* 段内密度：单条 quote 不超过段落的 90% 还不够。
   * 一段 200 字可以标 5 条 30 字的 quote，每条都能过单条检查，
   * 但合起来 150 字 = 段的 75%，用户看到的仍然是"整段都是颜色"。
   * 三色预算的分母是全文，所以这种局部染色永远不会被总量检查发现。
   *
   * 必须先做区间**并集**再算覆盖率：多条 quote 可能互相重叠，
   * 直接相加会把实际覆盖算多。 */
  for (const [segId, ranges] of quoteRanges) {
    const seg = context.segments.find((s) => s.id === segId)
    const segChars = seg?.chars || [...(seg?.text ?? '')].length
    if (!segChars) continue
    // 短段落不参与密度检查：一段 12 个字里标 5 个字就是 42%，
    // 但这是正常做法（整段就那么长），密度在这里没有意义。
    if (segChars < SEGMENT_DENSITY_MIN_CHARS) continue
    const merged = []
    for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
      const last = merged[merged.length - 1]
      if (last && a <= last[1]) last[1] = Math.max(last[1], b)
      else merged.push([a, b])
    }
    const covered = merged.reduce((sum, [a, b]) => sum + (b - a), 0)
    const density = covered / segChars
    if (density > 0.5) {
      issues.push(
        issue(
          'error',
          'segment-over-highlighted',
          `段落 ${segId} 有 ${(density * 100).toFixed(0)}% 的字被高亮（${covered}/${segChars}），` +
            '这等于整段染色。请把这一段收缩到一两处最关键的短语。',
        ),
      )
    } else if (density > 0.35) {
      issues.push(
        issue(
          'warn',
          'segment-dense',
          `段落 ${segId} 有 ${(density * 100).toFixed(0)}% 的字被高亮，偏多；建议再挑一挑。`,
        ),
      )
    }
    if (merged.length < ranges.length) {
      issues.push(
        issue('warn', 'quote-overlap', `段落 ${segId} 的 quote 有重叠，可能标重了同一处。`),
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
      // 分档占比：让模型和界面都能看出"是不是某一档用超了"，
      // 只有总 ratio 的话，超预算时不知道是哪一档的问题。
      tierRatio: Object.fromEntries(
        Object.keys(ATTENTION_TIERS).map((k) => [k, Number((tierCharsMap[k] / totalChars).toFixed(4))]),
      ),
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
    if (edge?.from && edge?.to && edge.from === edge.to) {
      issues.push(issue('error', 'edge-self', `关系自己指向自己：${edge.from}`))
    }
    // 每条边都要有原文出处。模型很容易为了"图好看"硬连一条材料里
    // 并不存在的关系，而类型检查看不出真假——只有让它给出原文才拦得住。
    //
    // 允许一种诚实的例外：明确标 evidence: 'inference' 的推断边。
    // 有些关系是读者/模型自己推出来的（原文没说"因此"），
    // 这类边不是编造，但必须自我标注，不能伪装成原文事实。
    const hasQuote = String(edge?.quote ?? '').trim()
    const isInference = edge?.evidence === 'inference'
    if (!hasQuote && !isInference) {
      issues.push(
        issue(
          'error',
          'edge-no-evidence',
          `关系 ${edge?.from} → ${edge?.to}（${edge?.relation}）缺原文出处：` +
            '请给出说明这条关系的那句原文；如果原文并没有明说、是你自己推出来的，请标 evidence:"inference" 并写 why',
        ),
      )
    }
    if (!hasQuote && isInference && !String(edge?.why ?? '').trim()) {
      issues.push(
        issue('error', 'inference-no-reason', `关系 ${edge?.from} → ${edge?.to} 标了推断但没有 why，说说你凭什么这么推的`),
      )
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

  /* 零连接 = 图没有意义。
   * 原来 edges.length===0 只会让每个节点各报一条 isolated 警告，
   * 全部 warn 都不阻塞，于是"33 个节点 0 条边"也能通过校验。
   * 用户打开图谱看到的是一堆散点。 */
  if (nodes.length >= 2 && edges.length === 0) {
    issues.push(
      issue(
        'error',
        'no-edges',
        '有多个知识点但一条关系都没有：知识图谱至少要能看出谁先谁后、谁包含谁。' +
          '如果这份材料确实彼此独立，请在 relationReview 里逐类说明理由。',
      ),
    )
  }

  /* 八种关系逐类表态。
   * 不是要求每种关系都存在——是要求逐个想过。
   * "没画线"永远不是理由，要么给出这条边，要么说明材料里为什么没有。 */
  const review = graph?.relationReview ?? null
  if (nodes.length >= 2) {
    if (!review || typeof review !== 'object') {
      issues.push(
        issue(
          'error',
          'review-missing',
          '缺少 relationReview：八种关系（前置/整体部分/对比/因果/例证/应用/次序/类比）要逐类说明' +
            '「有就列边 id，没有就说材料里为什么没有」',
        ),
      )
    } else {
      for (const key of Object.keys(RELATION_TYPES)) {
        const entry = review[key]
        if (!entry) {
          issues.push(issue('error', 'review-incomplete', `relationReview 漏了「${RELATION_TYPES[key].zh}」这一类`))
          continue
        }
        const status = entry.status
        if (status !== 'mapped' && status !== 'unsupported') {
          issues.push(
            issue('error', 'review-bad-status', `relationReview.${key}.status 只能是 mapped 或 unsupported`),
          )
          continue
        }
        if (status === 'mapped') {
          const list = Array.isArray(entry.edgeIds) ? entry.edgeIds : []
          if (!list.length) {
            issues.push(issue('error', 'review-no-edges', `relationReview.${key} 说是 mapped，却没列出任何边`))
          }
          const real = new Set(edges.map((e) => String(e?.id ?? '')))
          for (const id of list) {
            if (!real.has(String(id))) {
              issues.push(
                issue('error', 'review-edge-mismatch', `relationReview.${key} 引用了不存在的边 ${id}`),
              )
            }
          }
        } else if (!String(entry.why ?? '').trim()) {
          issues.push(
            issue(
              'error',
              'review-no-reason',
              `relationReview.${key} 标了 unsupported，但没写理由；「没画线」不算理由，要说明材料里为什么没有这种关系`,
            ),
          )
        }
      }
    }
  }

  const connected = new Set(edges.flatMap((e) => [e?.from, e?.to]))
  // 孤立节点可以被独立节点声明豁免（带理由），否则是错误
  const independent = new Set(
    (Array.isArray(graph?.independentNodes) ? graph.independentNodes : [])
      .filter((n) => String(n?.why ?? '').trim())
      .map((n) => String(n.id)),
  )
  for (const id of ids) {
    if (connected.has(id)) continue
    if (independent.has(id)) continue
    issues.push(
      issue(
        'error',
        'isolated',
        `知识点 ${id} 没有任何关系边。要么给它连上关系，要么在 independentNodes 里说明它为什么不参与论证`,
      ),
    )
  }

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
 * 占位符：用私用区字符包住序号，保证 Markdown 解析器不会吃掉它。
 *
 * 为什么不用 <strong> 直接插入：如果先插标签再交给 Markdown 解析，
 * 解析器会把标签当普通字符转义掉；反过来先解析再插标签，则无法
 * 在跨语法边界的文本上定位 quote。
 *
 * 用 U+E000 私用区字符的理由：它不会被任何 Markdown 语法识别
 * （不是 * _ ` | # [ ] 这些），且几乎不可能出现在正文里。
 */
const PH_OPEN = '\uE000'
const PH_CLOSE = '\uE001'
const PH_OPEN_HARD = '\uE002'
const PH_CLOSE_HARD = '\uE003'
const PH_OPEN_REF = '\uE004'
const PH_CLOSE_REF = '\uE005'

const TIER_MARK = {
  'sc-hl-core': [PH_OPEN, PH_CLOSE],
  'sc-hl-hard': [PH_OPEN_HARD, PH_CLOSE_HARD],
  'sc-hl-ref': [PH_OPEN_REF, PH_CLOSE_REF],
}

/**
 * 给一段 Markdown 文本打上高亮占位符。
 *
 * quote 可能落在 `**…**` 内部（如 `**作用对象**` 里只标「作用」）。
 * 占位符包在语法字符**内部**时，Markdown 解析后仍能正确配对，
 * 但会产出 `<strong class="sc-hl-x"><strong>…</strong></strong>` 这种嵌套。
 * 因此解析完还有一步 reserve()：先剥掉内层无属性的 <strong>，再插真正的标签。
 *
 * @param {string} text  一段原始 Markdown
 * @param {string} quote 要标出的原文片段
 * @param {string} tierClass  sc-hl-core / sc-hl-hard / sc-hl-ref
 * @returns {string} 已解析成 HTML、且高亮已落位的片段
 */
function markQuote(text, quote, tierClass) {
  const marks = TIER_MARK[tierClass]
  const src = String(text ?? '')

  // 块级语法（表格 / 列表 / 标题 / 代码围栏）必须走块级解析，
  // 否则 renderMarkdown 的 inline 模式会把这些标记直接删掉，
  // 表格就会退化成一行竖线文本。
  const isBlock = /(^|\n)\s*(\||[-*+]\s|\d+\.\s|#{1,6}\s|```|>)/.test(src)

  const render = (s) => (isBlock ? renderMarkdown(s) : renderMarkdown(s, { inline: true }))

  if (!marks) return render(src)
  const [open, close] = marks
  if (!quote) return render(src)

  const idx = src.indexOf(quote)
  if (idx < 0) return render(src)

  // 用占位符夹住命中片段，其余原样
  const marked = `${src.slice(0, idx)}${open}${src.slice(idx, idx + quote.length)}${close}${src.slice(idx + quote.length)}`

  // 整段过 Markdown（保留 ** | ` 等语法）
  let html = render(marked)

  // 占位符可能被解析进 <strong> 里，导致 <strong class=hl><strong>文字</strong></strong>
  // 先去掉紧邻的嵌套层，避免无意义的双重加粗
  html = html
    .replace(new RegExp(`<strong>\\s*${open}`, 'g'), open)
    .replace(new RegExp(`${close}\\s*</strong>`, 'g'), close)

  // 占位符换回真正的标签
  return html
    .split(open)
    .join(`<strong class="${tierClass}">`)
    .split(close)
    .join('</strong>')
}

/**
 * 把原文 + 标注渲染成 HTML：整篇按 ¶N 分段，段内在原文位置做三色加粗。
 *
 * 关键：正文必须按 **整段** 交给 Markdown 解析，不能逐行——
 * 表格（`| a | b |` 多行）和列表（连续 `- ` 行）都是跨行语法，
 * 逐行解析会把它们拆成一个个 <p>，在界面上变成竖排竖线。
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

      // 正文：整段过一次 Markdown，高亮用占位符法落位
      const quote = a?.quote ? String(a.quote).trim() : ''
      const body = markQuote(String(seg.text), quote, a ? tierClass : '')

      // 备注单独一行，不参与高亮
      const note = a?.note ? `<div class="sc-seg-note">${escHtml(a.note)}</div>` : ''
      const tierAttr = a ? ` data-tier="${escHtml(a.tier ?? '')}"` : ''
      return `<section class="sc-seg" data-id="${escHtml(seg.id)}"${tierAttr}>${tag}${body}${note}</section>`
    })
    .join('\n')
}
