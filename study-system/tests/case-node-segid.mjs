/**
 * 给关系图的每个节点补 segmentId —— 让「点节点」能回到它出自的那段原文。
 *
 * 为什么值得做：33 个节点里 0 个挂 segmentId，也就是说图上每一个方块
 * 点下去都没有下文。用户看到「粒度偏向整合而非细分」这种缩写标签，
 * 想知道原文怎么说，只能自己滚回正文去找。
 *
 * 为什么不能靠猜：点到一个"差不多相关"的段落，比没有链接更糟 ——
 * 用户会照着错的原文去理解概念，而且他不会知道那是错的。
 * 所以这里的规则是：**证据不足就留空**，宁可少也不要有错的。
 *
 * 只用一级证据：**边继承**，而且只给边的 from 端。
 * 一条边带 quote 与段号，但那条 quote 讲的是**主概念**，也就是 from 端；
 * to 端常是"另一个相关概念"，未必出现在这段原文里。
 *
 * 抽查证实了这一点：
 *   agent-goal → aci @ ¶2     quote 讲的是通用 Agent 已实现《Her》里的能力，
 *                             既不是 Agent 的目标，更不是 ACI 的定义（¶15 才是）
 *   gen-default → dedicated-cases @ ¶21   quote 正是"默认取向"本身
 *   four-dims → form-spectrum @ ¶26       quote 正是"四个决策维度"本身
 * 把两端都算证据，等于把 ACI 指到电影开场。主语在前，这件事必须尊重。
 *
 * 试过、并且放弃的做法：拿节点标签里的关键词去原文里搜，命中唯一一处就采用。
 * 它系统性出错：
 *   「工具爆炸」唯一命中 ¶182 —— 那是本章思考题，不是定义处
 *   「代理工具」唯一命中 ¶65  —— 那段讲的是 Pi 的架构取舍
 *   「信任边界」唯一命中 ¶176 —— 那是全章小结
 * 关键词只知道"这几个字出现在这里"，不知道"这里是不是在讲它"。
 * 这种错看起来很像对的，比空白危险得多。
 *
 * 用法：
 *   node tests/case-node-segid.mjs <docId>            # 干跑，只报告
 *   node tests/case-node-segid.mjs <docId> --write    # 写回 relations.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WS = process.env.STUDY_WS || 'D:\\learn'
const docId = process.argv[2]
const write = process.argv.includes('--write')
if (!docId) {
  console.error('用法: node case-node-segid.mjs <docId> [--write]')
  process.exit(1)
}

const dir = join(WS, '.study', docId)
const rel = JSON.parse(readFileSync(join(dir, 'relations.json'), 'utf8'))
const texts = JSON.parse(readFileSync(join(dir, 'segment-texts.json'), 'utf8')).items
const textOf = new Map(texts.map((t) => [t.id, String(t.text ?? '')]))

/**
 * 这一段是不是"在讲 from 这个概念"。
 *
 * 光有 quote 不够：quote 是建图时人手写的摘要，可能只是顺带提了一句。
 * 抽查发现的例子：agent-goal → aci @ ¶2，那段是电影开场，
 * 讲的是"Samantha 拥有强大的工具"，既不是 Agent 的目标，更不是 ACI 的定义。
 *
 * 所以要再检查一次这段原文的**主题**对不对。两个可操作的判据：
 *   A. quote 出现在标题行或加粗小标题里 —— 那一段的主题就是它
 *   B. 该段足够短（≤ 240 字）—— 短段基本只讲一件事，quote 在其中就说明它在讲这件事
 * 两条都不满足就判定"证据不足"，留空。
 */
function isAboutSegment(segId, quote) {
  const raw = textOf.get(segId) ?? ''
  if (!raw || !quote) return false
  if (!raw.includes(quote)) return false // quote 不在这一段里，直接否
  const head = raw
    .split('\n')
    .map((x) => x.trim())
    .find(Boolean) ?? ''
  const quoteInHead = /^(#{1,6}\s|\*\*)/.test(head) && head.includes(quote.replace(/^\*\*|\*\*$/g, ''))
  if (quoteInHead) return true
  return raw.length <= 240
}

// ---- 证据：只从带 quote 的边的 from 端继承，且该段必须真的在讲它 ----
const fromEdges = new Map()
for (const e of rel.edges ?? []) {
  if (!e.segmentId || !e.quote) continue
  if (!fromEdges.has(e.from)) fromEdges.set(e.from, [])
  fromEdges.get(e.from).push({ seg: e.segmentId, via: `边 ${e.from}→${e.to}`, quote: e.quote })
}

/**
 * 证据二：节点标签就是某个小标题。
 *
 * 这是最强的一类证据：`## 感知工具` 这样的标题段，内容就只有这一句，
 * 而节点 `感知工具` 与它一字不差。段号本身就是定义的落点，不需要再判断主题。
 *
 * 只在全篇唯一匹配时采用 —— 同名标题出现两次说明它们不是同一个东西。
 */
function byHeading(node) {
  const label = String(node.label ?? '')
    .replace(/[：:].*$/, '')
    .trim()
  if (label.length < 2) return null
  const hits = texts.filter((t) => {
    const raw = textOf.get(t.id) ?? ''
    const first = raw.split('\n').map((x) => x.trim()).find(Boolean) ?? ''
    const m = /^#{1,6}\s+(.+)$/.exec(first)
    // 标题段常常只有标题一行，所以拿整段（去空白）与标题比
    return m && m[1].trim() === label && raw.trim() === first
  })
  return hits.length === 1 ? hits[0].id : null
}

const report = { edge: 0, heading: 0, rejected: 0, none: 0 }
const unresolved = []
const rejectedDetail = []

for (const n of rel.nodes ?? []) {
  // 已经挂过就不动：可能是人工指定的，比任何自动推断都可靠
  if (n.segmentId) continue

  // 先查标题：节点名与小标题一字不差时，那一段就是它的定义处，
  // 比边的 quote 更确定（quote 只是顺带提到，标题就是专门讲它）
  const headId = byHeading(n)
  if (headId) {
    n.segmentId = headId
    n.segmentSource = 'heading'
    report.heading += 1
    continue
  }

  const fromEdge = fromEdges.get(n.id)
  // 只保留"那一段确实在讲它"的证据，其余丢弃
  const usable = (fromEdge ?? []).filter((f) => isAboutSegment(f.seg, f.quote))
  if (!usable.length && fromEdge?.length) {
    report.rejected += 1
    rejectedDetail.push(`${n.id}（边的 quote 出自 ${fromEdge[0].seg}，但那一段不是在讲它）`)
  }
  if (usable.length) {
    // 多条边指向不同段落时，取出现次数最多的那一段（最常被引用的通常是定义处）
    const count = new Map()
    for (const f of usable) count.set(f.seg, (count.get(f.seg) ?? 0) + 1)
    const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
    n.segmentId = best[0]
    n.segmentSource = 'edge'
    // 同分时记下来，提醒这里可能该人工看一眼
    const ties = [...count.values()].filter((c) => c === best[1]).length
    if (ties > 1) n.segmentAmbiguous = true
    report.edge += 1
    continue
  }

  report.none += 1
  unresolved.push(n.id)
}

const total = rel.nodes.length
const covered = total - report.none
console.log(`=== ${docId} 节点回指原文 ===`)
console.log(`  节点总数      ${total}`)
console.log(`  从边继承      ${report.edge}`)
console.log(`  标题段精确匹配 ${report.heading}`)
console.log(`  有边但主题不符  ${report.rejected}`)
console.log(`  证据不足留空  ${report.none}  ${unresolved.length ? '→ ' + unresolved.join(', ') : ''}`)
console.log(`  覆盖率        ${covered}/${total} (${((covered / total) * 100).toFixed(0)}%)`)
if (rejectedDetail.length) {
  console.log('  被拒的证据：')
  for (const d of rejectedDetail) console.log(`    · ${d}`)
}
const amb = (rel.nodes ?? []).filter((n) => n.segmentAmbiguous).length
if (amb) console.log(`  注意：${amb} 个节点的证据段落并列最多，已标 segmentAmbiguous`)

if (write) {
  rel.nodeLink = {
    updatedAt: new Date().toISOString(),
    rule: '只从带 quote 的边继承；证据不足留空，不猜（点错段比没有链接更糟）',
    covered,
    total,
    unresolved,
  }
  writeFileSync(join(dir, 'relations.json'), `${JSON.stringify(rel, null, 2)}\n`, 'utf8')
  console.log('  已写回 relations.json')
} else {
  console.log('  （干跑，未写入；加 --write 生效）')
}
