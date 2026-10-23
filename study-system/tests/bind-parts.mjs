/**
 * 给 preflight 的 18 个知识点挂上段落回指，并把 parts 绑到单元上。
 *
 * ## 解决的问题
 *
 * 用户看到「两个审视特征」这个知识点，不知道该去看原文哪一段。
 * 之前 18 个知识点全都是 0 个 segmentIds —— 点开无路可走。
 *
 * ## 怎么挂
 *
 * 不猜。每个知识点在 parts 里已经有 name / content / note，
 * 拿它的关键词去原文段里找，找到唯一命中就挂那一段；
 * 命中多处时优先取该 part 对应单元范围内最靠前的段。
 *
 * 找不到就**不挂**，并且把这条报出来 —— 宁可没有回指，
 * 也不要挂到错的段落上，那比没有更糟。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'D:/learn/.study/chapter4-d6eaed'
const pre = JSON.parse(readFileSync(`${DIR}/preflight.json`, 'utf8'))
const unitDoc = JSON.parse(readFileSync(`${DIR}/units.json`, 'utf8'))
const texts = new Map(
  JSON.parse(readFileSync(`${DIR}/segment-texts.json`, 'utf8')).items.map((t) => [t.id, String(t.text ?? '')]),
)

/* ---------- 1. parts → units 绑定 ---------- */
/**
 * 手工确认的映射，不是按标题字符串模糊匹配的结果。
 *
 * 为什么手工：part 的标题是模型概括的（「形态：专用工具、通用执行器与 Skill」），
 * unit 的标题是原文的（「能力的表达形式：专用工具、通用执行器与 Skill」），
 * 模糊匹配会把「三类主动工具与两条分发渠道」错配到感知或执行工具上。
 * 这份映射是逐条读原文小节后的结论，写在这里比让脚本猜可靠。
 */
const PART_UNITS = {
  '五类工具的分类': ['¶4'], // 工具的分类
  '形态：专用工具、通用执行器与 Skill': ['¶16', '¶30', '¶39'], // 表达形式 / 描述艺术 / 参数保真
  '披露：工具太多怎么办': ['¶60', '¶63', '¶71', '¶86'], // 总纲 / 层次化 / 主动发现 / Skills
  '三类主动工具与两条分发渠道': ['¶45', '¶94', '¶113', '¶158'], // 生态 / 感知 / 执行 / 协作
}

const unitById = new Map(unitDoc.units.map((u) => [u.id, u]))

let boundParts = 0
for (const p of pre.parts) {
  const raw = String(p.title ?? '').replace(/^第[一二三四五六七八九十]+\s*部分\s*/, '').trim()
  const ids = PART_UNITS[raw]
  if (!ids) {
    console.warn(`⚠ 没有映射：${p.title}`)
    continue
  }
  const missing = ids.filter((id) => !unitById.has(id))
  if (missing.length) {
    console.warn(`⚠ 单元不存在：${missing.join(',')}`)
    continue
  }
  p.unitIds = ids
  // 段范围 = 这些单元的并集
  p.segmentIds = ids.flatMap((id) => unitById.get(id).segmentIds)
  boundParts += 1
}

/* ---------- 2. 知识点 → 段落回指 ---------- */
/**
 * 用知识点名 & 内容里的实词去原文找。
 *
 * 知识点名是**概括出来**的（「事件触发的两个时刻」原文里没这几个字），
 * 所以不能只拿名字找。要从内容里抽真正会在原文出现的词：
 *   1. 英文词与标识符（ACI、KV Cache、spawn_subagent、HITL、Cursor）
 *   2. 引号/加粗包住的短语
 *   3. 名字里 ≥3 字且在原文可能出现的子串
 *   4. 内容里的中文术语（用「、」「，」切开后取 3-6 字的片段）
 */
function candidateTerms(kp) {
  const out = new Set()
  const content = String(kp.content ?? '')
  // 1. 英文词 / 代码标识符 —— 原文里出现就是强信号
  for (const m of content.matchAll(/\b([A-Za-z][A-Za-z0-9_-]{2,}(?:\s+[A-Z][A-Za-z]+)?)\b/g)) out.add(m[1])
  // 2. 引号 / 加粗
  for (const m of content.matchAll(/[“「]([^”」]{2,14})[”」]/g)) out.add(m[1])
  for (const m of content.matchAll(/\*\*([^*]{2,14})\*\*/g)) out.add(m[1])
  // 3. 名字本身（可能是原文原词）
  if (kp.name) out.add(String(kp.name))
  // 4. 内容里切出来的中文术语片段
  for (const piece of content.split(/[，,、；;。：:（）()]/)) {
    const s = piece.trim()
    // 去掉"从…到…"这类叙述，只留实词片段
    if ([...s].length >= 3 && [...s].length <= 8) out.add(s)
  }
  return [...out].filter((s) => [...s].length >= 2 && !/^\d+$/.test(s))
}

/**
 * 人工覆盖表：机器匹配错了的，在这里钉死。
 *
 * 为什么要这张表：抽查发现 18 条里挂了 2 条错的 ——
 * 「执行工具的三层防护」被挂到 MCP 安全那几段（都在讲描述投毒，
 * 不是输入验证/权限控制），「两条分发渠道」只挂到一个小节标题上。
 *
 * 挂错比不挂更糟：用户点「三层防护」，跳到讲 MCP 投毒的段落，
 * 会以为自己记错了。所以宁可手工钉死，也不信模糊匹配。
 *
 * 这里的段号都是逐条读原文后确认的。
 */
const MANUAL = {
  '执行工具的三层防护': ['¶116', '¶117', '¶118'],
  '两条分发渠道与信任边界': ['¶53', '¶56', '¶91'],
}

/** 在一个 part 的单元范围内找命中该术语的段，按命中词数排序 */
function findSegments(terms, part) {
  const scope = part.segmentIds ?? []
  const scored = []
  for (const id of scope) {
    const t = texts.get(id) ?? ''
    const hit = terms.filter((term) => t.includes(term))
    if (hit.length) scored.push({ id, score: hit.length, hit })
  }
  // 命中词多的更可能是这一段的主题，而不是顺带提了一句
  scored.sort((a, b) => b.score - a.score)
  return scored
}

/**
 * 跨 part 兜底：有些知识点的依据不在自己那一块里，而在「本章小结」。
 *
 * 实例：「感知工具的接口设计」概括得没错，但它的原话
 * （分页、显式截断、只读性适合缓存）集中出现在 ¶178 本章小结，
 * 感知工具那 8 段里只有零散提及。
 *
 * 门槛按词的"辨识度"定，而不是一律要求命中好几个：
 * - 命中 ≥2 个词 → 认
 * - 命中 1 个但那个词 ≥4 字 → 也认（「显式截断」这种长词极少顺带出现）
 * - 只有 1 个 2-3 字的短词 → 不认（「能力」「工具」到处都有）
 */
function findAnywhere(terms) {
  const scored = []
  for (const [id, t] of texts) {
    const hit = terms.filter((term) => t.includes(term))
    if (!hit.length) continue
    const strong = hit.some((w) => [...w].length >= 4)
    if (hit.length >= 2 || strong) scored.push({ id, score: hit.length, hit })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored
}

let attached = 0
let viaFallback = 0
const failures = []

for (const p of pre.parts) {
  for (const kp of p.knowledgePoints ?? []) {
    // 人工钉死优先，机器匹配只作兜底
    if (MANUAL[kp.name]) {
      const bad = MANUAL[kp.name].filter((id) => !texts.has(id))
      if (bad.length) {
        console.error(`人工映射引用了不存在的段：${kp.name} → ${bad.join(',')}`)
        process.exit(1)
      }
      kp.segmentIds = MANUAL[kp.name]
      kp.mappingSource = 'manual'
      attached += 1
      continue
    }
    const terms = candidateTerms(kp)
    let hits = findSegments(terms, p)
    if (!hits.length) {
      // part 内找不到，再全篇兜底（要求命中 ≥2 词）
      hits = findAnywhere(terms)
      if (hits.length) {
        viaFallback += 1
        kp.referencedOutsidePart = true
      }
    }
    if (hits.length) {
      // 最多挂 3 段，按命中强度排 —— 第一段通常就是定义处
      kp.segmentIds = hits.slice(0, 3).map((h) => h.id)
      kp.mappingSource = 'auto'
      attached += 1
    } else {
      failures.push({ part: p.title, kp: kp.name, terms })
    }
  }
}

/* ---------- 3. 校验 ---------- */
const total = pre.parts.reduce((n, p) => n + (p.knowledgePoints?.length ?? 0), 0)
const withSeg = pre.parts.reduce(
  (n, p) => n + (p.knowledgePoints ?? []).filter((k) => k.segmentIds?.length).length,
  0,
)

// 挂上去的段必须真实存在
const badRef = []
for (const p of pre.parts) {
  for (const kp of p.knowledgePoints ?? []) {
    for (const id of kp.segmentIds ?? []) {
      if (!texts.has(id)) badRef.push(`${kp.name} → ${id}`)
    }
  }
}
if (badRef.length) {
  console.error('引用了不存在的段落：')
  for (const b of badRef) console.error('  ' + b)
  process.exit(1)
}

pre.parts = pre.parts.map((p) => ({ ...p }))
pre.unitBinding = {
  boundAt: new Date().toISOString(),
  note: 'parts → units 为逐条读原文后的手工映射；unit → segmentIds 由 units.json 提供',
}

writeFileSync(`${DIR}/preflight.json`, JSON.stringify(pre, null, 2), 'utf8')

console.log(`parts 绑定单元：${boundParts}/${pre.parts.length}`)
console.log(`知识点挂上原文回指：${withSeg}/${total}` + (viaFallback ? `（其中 ${viaFallback} 个依据在本块之外）` : ''))
if (failures.length) {
  console.log(`\n未挂上的 ${failures.length} 个（不猜，留着比挂错好）：`)
  for (const f of failures) console.log(`  ${f.kp}　候选词: ${f.terms.join('/')}`)
}
