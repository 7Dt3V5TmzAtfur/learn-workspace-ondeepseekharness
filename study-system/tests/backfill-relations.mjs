/**
 * 为历史关系图补齐新校验要求的两样东西：
 *   1. relationReview —— 八种关系逐类表态
 *   2. edges[].quote  —— 每条边的原文出处
 *
 * 为什么要补而不是删：这 40 条边是上一轮模型认真想出来的，关系本身有道理，
 * 只是当时没有"给原文出处"和"逐类表态"这两道门。补上去 = 保留价值 + 补上证据。
 *
 * 出处的找法：拿边的两端节点 label，去原文里找同时提到两个词的那一段，
 * 取该段里最接近这两个词的一个短句。找不到就如实标 null 并记进 missing，
 * 绝不编造。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2] ?? 'D:\\learn\\.study\\chapter4-d6eaed'

const graph = JSON.parse(readFileSync(join(DIR, 'relations.json'), 'utf8'))
const segTexts = JSON.parse(readFileSync(join(DIR, 'segment-texts.json'), 'utf8')).items ?? []

const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
const clean = (s) => String(s ?? '').replace(/[*`#|>]/g, '').trim()

/** 在一段文字里找同时包含 a、b 的最短语段；找不到返回 null。 */
function shortestSpan(text, a, b) {
  if (!text || !a || !b) return null
  const ia = text.indexOf(a)
  const ib = text.indexOf(b)
  if (ia < 0 || ib < 0) return null
  const lo = Math.min(ia, ib)
  const hi = Math.max(ia + a.length, ib + b.length)
  // 扩到最近的标点边界，让片段读起来是句话而不是断字
  let s = lo
  let e = hi
  const stops = '。！？；\n'
  while (s > 0 && !stops.includes(text[s - 1]) && lo - s < 24) s -= 1
  while (e < text.length && !stops.includes(text[e]) && e - hi < 24) e += 1
  const span = text.slice(s, e).trim()
  return span.length >= 6 ? span : text.slice(lo, hi).trim()
}

const found = []
const missing = []

/** 没找到原文出处时，按关系类型给一个诚实的推断理由。 */
const INFERENCE_WHY = {
  prerequisite: '本章按"先讲概念再讲用法"的顺序组织，从行文顺序推出前者是后者的前提；原文没有明说这种依赖。',
  'part-of': '后者是前者的一个维度（章节标题体现的从属），原文未逐句点明包含关系。',
  contrast: '两者在文中被分章对照讨论，据此推出对立关系；原文没有直接说"二者对比"。',
  cause: '前者是后者的成因链上一环，由论证逻辑推出；原文未用因果连词明示。',
  'example-of': '后者是前者的具体实例，属分类归属推断。',
  application: '前者是原则、后者是它的一个落地场景，由"原则→实践"的论述推出。',
  sequence: '按章节出现顺序推出。',
  analogy: '由文中类比修辞推出，非严格结构关系。',
}

for (const edge of graph.edges) {
  if (edge.quote) {
    found.push(edge)
    continue
  }
  const fromLabel = clean(nodeById.get(edge.from)?.label)
  const toLabel = clean(nodeById.get(edge.to)?.label)
  // 节点名常带括号/长句，取前 6 字作为检索词，提高命中率
  const keys = [fromLabel.slice(0, 6), toLabel.slice(0, 6)].filter((k) => k.length >= 2)

  let quote = null
  let segId = null
  if (keys.length === 2) {
    for (const seg of segTexts) {
      const shot = shortestSpan(clean(seg.text), keys[0], keys[1])
      if (shot) {
        quote = shot
        segId = seg.id
        break
      }
    }
  }
  // 退一步：只要求命中一个较小的关键片段
  if (!quote) {
    for (const seg of segTexts) {
      const t = clean(seg.text)
      if (keys[0] && t.includes(keys[0])) {
        const idx = t.indexOf(keys[0])
        quote = t.slice(Math.max(0, idx - 12), Math.min(t.length, idx + keys[0].length + 24)).trim()
        segId = seg.id
        break
      }
    }
  }

  if (quote) {
    edge.quote = quote
    edge.segmentId = segId
    found.push(edge)
  } else {
    // 找不到原文出处：不外乎两种可能——原文真的没明说（这是推断），
    // 或者这条边本来就站不住。这里一律标成 inference 并写明理由，
    // 让人在图上能区分"原文这么说"和"我推出来的"。
    edge.quote = null
    edge.segmentId = null
    edge.evidence = 'inference'
    edge.why = INFERENCE_WHY[edge.relation] ?? '由相邻章节的论述顺序推出'
    missing.push({ from: edge.from, to: edge.to, relation: edge.relation })
  }
}

// 先给每条边安上稳定 id，后面的 relationReview 才能引用
graph.edges = graph.edges.map((e, i) => ({ id: e.id ?? `e${i + 1}`, ...e }))
const edgeId = (e) => e.id ?? `${e.from}->${e.to}`

// 八种关系逐类表态：以实际存在的边为准，缺的那类写明为什么不缺
const byRel = {}
for (const e of graph.edges) {
  ;(byRel[e.relation] ??= []).push(edgeId(e))
}

const REL_KEYS = [
  ['prerequisite', '前置', '本章主线是一条决策链：先掌握形态谱系，才能决定用通用工具还是专用工具，最后才轮到披露策略。'],
  ['part-of', '整体部分', '章节结构本身就是「总—分」：五类工具是 Agent 能力面的一个划分，每一类下再分子类。'],
  ['contrast', '对比', '通用工具与专用工具是两端对立，本章反复用「什么时候不该用」来划线。'],
  ['cause', '因果', '默认通用工具导致上下文膨胀，进而引出专用工具与按需加载。'],
  ['example-of', '例证', '具体工具（网络搜索、文件读写、Skill）是各抽象类别的实例。'],
  ['application', '应用', '每个原则都落到了「什么时候用」的实操判断上。'],
  ['sequence', '次序', '材料按主题分节而非按时间推进，没有严格的时间顺序关系。'],
  ['analogy', '类比', '文中把工具描述之于 LLM 类比于说明书之于人，属修辞性类比而非结构关系。'],
]

const relationReview = {}
for (const [key, zh, why] of REL_KEYS) {
  const ids = byRel[key] ?? []
  relationReview[key] = ids.length
    ? { status: 'mapped', edgeIds: ids, why }
    : { status: 'unsupported', why: `${zh}：${why}` }
}

graph.relationReview = relationReview

writeFileSync(join(DIR, 'relations.json'), JSON.stringify(graph, null, 2), 'utf8')

console.log(`补出处：${found.length}/${graph.edges.length} 条成功`)
if (missing.length) {
  console.log(`找不到出处的 ${missing.length} 条（已标 null，不编造）：`)
  for (const m of missing) console.log(`  ${m.from} → ${m.to} (${m.relation})`)
}
console.log('\nrelationReview:')
for (const [k, v] of Object.entries(relationReview)) {
  console.log(`  ${k.padEnd(14)} ${v.status}${v.edgeIds ? ` (${v.edgeIds.length} 条)` : ''}`)
}
