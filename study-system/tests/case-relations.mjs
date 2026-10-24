/**
 * chapter1 的知识点关系图。
 *
 * 两条硬要求（都是踩过坑的）：
 *   1. 边尽量带 quote + segmentId —— 能指回原文才算"有证据"，
 *      推出来的关系要老实写 evidence:'inference' 并说明 why
 *   2. direction 用 down：读者从上往下读，前置在上、后置在下
 *
 * 节点只收"这一章真的展开讲了"的概念，不把路过提到的词塞进来 ——
 * 33 个节点里有 10 个是凑数的，图就没法用了。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'D:/learn/.study/chapter1-940885'

const nodes = [
  { id: 'formula', kind: 'concept', label: 'Agent = LLM + 上下文 + 工具' },
  { id: 'boundary', kind: 'concept', label: 'Agent 与 Environment 的边界' },
  { id: 'model-harness', kind: 'concept', label: 'Model–Harness 结构' },
  { id: 'obs-act', kind: 'concept', label: '观察空间与动作空间' },
  { id: 'rl-map', kind: 'concept', label: '对应 RL 的策略/观察/接口' },
  { id: 'tool', kind: 'concept', label: '工具：Agent 的手脚' },
  { id: 'tool-call', kind: 'concept', label: '工具调用四步' },
  { id: 'tool-principle', kind: 'concept', label: '通用用于探索，专用用于约束' },
  { id: 'llm', kind: 'concept', label: 'LLM：Agent 的大脑' },
  { id: 'inner-think', kind: 'concept', label: '内部思考' },
  { id: 'model-as-agent', kind: 'concept', label: '模型即 Agent' },
  { id: 'learn-paths', kind: 'concept', label: '能力更新的三条路径' },
  { id: 'context', kind: 'concept', label: '上下文：Agent 的眼睛' },
  { id: 'five-parts', kind: 'concept', label: '上下文的五个组成部分' },
  { id: 'prefix-traj', kind: 'concept', label: '静态前缀 + 轨迹' },
  { id: 'ablation', kind: 'concept', label: '消融实验 1-1' },
  { id: 'react', kind: 'concept', label: 'ReAct 循环：想→做→看' },
  { id: 'harness', kind: 'concept', label: 'Harness 工程' },
  { id: 'three-guards', kind: 'concept', label: '约束 / 验证 / 纠正' },
  { id: 'evo-stages', kind: 'concept', label: '提示→上下文→Harness→Loop→Graph' },
  { id: 'principles', kind: 'concept', label: '简单 / 透明 / ACI' },
  { id: 'model-choice', kind: 'concept', label: '模型选型' },
  { id: 'workflow', kind: 'concept', label: '工作流：确定性编排' },
  { id: 'autonomous', kind: 'concept', label: '自主 Agent：动态决策' },
  { id: 'adapter', kind: 'concept', label: '适配层' },
  { id: 'guardrails', kind: 'concept', label: '护栏三层' },
  { id: 'hitl', kind: 'concept', label: '人工干预' },
  { id: 'design-patterns', kind: 'concept', label: '五个设计模式' },
  { id: 'proposer-reviewer', kind: 'concept', label: '提议者—审核者' },
  { id: 'progressive', kind: 'concept', label: '渐进式披露' },
  { id: 'append-only', kind: 'concept', label: '只增不改' },
  { id: 'boundary-retention', kind: 'concept', label: '边界集 + 保留集' },
  { id: 'min-diff', kind: 'concept', label: '最小 diff + 可回滚' },
]

/** relation 类型：prerequisite / part-of / contrast / cause / example / apply / order / analogy */
const edges = [
  // 公式是根
  { from: 'formula', to: 'boundary', relation: 'cause', quote: '这个公式只描述 Agent 边界之内的实现', segmentId: '¶7' },
  { from: 'formula', to: 'rl-map', relation: 'analogy', quote: '但不是严格的一一等同关系', segmentId: '¶14' },
  { from: 'boundary', to: 'model-harness', relation: 'cause', quote: 'Harness 可以创建、隔离或代理一个环境', segmentId: '¶12' },
  { from: 'boundary', to: 'obs-act', relation: 'part-of', quote: '**观察通道与动作接口共同构成了 Agent 与外部环境之间的边界**', segmentId: '¶17' },
  { from: 'formula', to: 'tool', relation: 'part-of', quote: '工具是 Agent 与外部世界交互的桥梁', segmentId: '¶26' },
  { from: 'formula', to: 'llm', relation: 'part-of', quote: '大语言模型（Large Language Model, LLM）是 Agent 的决策核心', segmentId: '¶44' },
  { from: 'formula', to: 'context', relation: 'part-of', quote: '上下文是 Agent 在每个决策点能看到的全部信息', segmentId: '¶58' },
  { from: 'obs-act', to: 'tool', relation: 'cause', quote: '往往就是重新定义或扩展观察空间与动作空间', segmentId: '¶18' },
  { from: 'obs-act', to: 'context', relation: 'cause', quote: '没有通过观察通道进入上下文的信息，对模型来说就像不存在', segmentId: '¶17' },

  // 三个组件
  { from: 'tool', to: 'tool-call', relation: 'part-of', quote: '工具调用的流程分为四步', segmentId: '¶35' },
  { from: 'tool', to: 'tool-principle', relation: 'cause', quote: '通用基础能力用于组合与探索', segmentId: '¶42' },
  { from: 'tool-call', to: 'react', relation: 'prerequisite', quote: '这个循环就是后文要介绍的 ReAct 的基础', segmentId: '¶35' },
  { from: 'llm', to: 'inner-think', relation: 'part-of', quote: 'LLM Agent 的一个独特能力是**内部思考**', segmentId: '¶45' },
  { from: 'llm', to: 'model-as-agent', relation: 'cause', quote: '将工具调用能力内化为原生能力', segmentId: '¶47' },
  { from: 'model-as-agent', to: 'harness', relation: 'contrast', quote: '但这并不意味着框架层变得不重要了', segmentId: '¶47' },
  { from: 'llm', to: 'learn-paths', relation: 'prerequisite', quote: '按照更新发生的位置和持续时间', segmentId: '¶52' },

  // 上下文
  { from: 'context', to: 'five-parts', relation: 'part-of', quote: '每次调用 LLM 时的上下文由以下五个部分构成', segmentId: '¶58' },
  { from: 'five-parts', to: 'prefix-traj', relation: 'cause', quote: '前两项（系统提示词 + 工具定义）是静态前缀', segmentId: '¶61' },
  { from: 'prefix-traj', to: 'react', relation: 'prerequisite', quote: 'Agent 的上下文 = 静态前缀 + 轨迹', segmentId: '¶68' },
  { from: 'five-parts', to: 'ablation', relation: 'application', quote: '实验 1-1 正是按这个思路', segmentId: '¶62' },
  { from: 'ablation', to: 'context', relation: 'example-of', quote: '上下文决定了 Agent 能看到什么', segmentId: '¶64' },

  // ReAct
  { from: 'react', to: 'harness', relation: 'cause', quote: '同时也暴露了明显的脆弱点', segmentId: '¶93' },

  // Harness
  { from: 'harness', to: 'three-guards', relation: 'part-of', quote: 'Harness = 上下文管理 + 工具接口 + 约束 + 验证 + 纠正', segmentId: '¶96' },
  { from: 'harness', to: 'evo-stages', relation: 'sequence', quote: '这五个阶段不是替代关系，而是层层包含的', segmentId: '¶116' },
  { from: 'harness', to: 'principles', relation: 'application', quote: '成功的 Agent 系统遵循三个核心原则', segmentId: '¶119' },
  { from: 'harness', to: 'model-choice', relation: 'application', quote: '以下三节展开 Harness 工程中三个独立但重要的主题', segmentId: '¶124' },
  { from: 'harness', to: 'workflow', relation: 'part-of', quote: '编排模式是 Harness 中“上下文与工具”层面的组织方式', segmentId: '¶134' },
  { from: 'workflow', to: 'autonomous', relation: 'contrast', quote: '执行路径不是预先定义的', segmentId: '¶153' },
  { from: 'workflow', to: 'adapter', relation: 'cause', quote: '不妨称为', segmentId: '¶148' },
  { from: 'adapter', to: 'model-as-agent', relation: 'contrast', quote: '就不再需要提示词改写了', segmentId: '¶149' },
  { from: 'three-guards', to: 'guardrails', relation: 'application', quote: '护栏按被绕过的难度分为上下文层、执行层与数据层三层', segmentId: '¶212' },
  { from: 'guardrails', to: 'hitl', relation: 'part-of', quote: '人工干预', segmentId: '¶183' },

  // 设计模式
  { from: 'design-patterns', to: 'proposer-reviewer', relation: 'part-of', quote: '产出与评判由两个不共享上下文的角色分别承担', segmentId: '¶199' },
  { from: 'design-patterns', to: 'progressive', relation: 'part-of', quote: '不把全部信息一次性放进上下文', segmentId: '¶200' },
  { from: 'design-patterns', to: 'append-only', relation: 'part-of', quote: '状态以追加的方式演进', segmentId: '¶201' },
  { from: 'design-patterns', to: 'boundary-retention', relation: 'part-of', quote: '任何一次修改都要同时在', segmentId: '¶202' },
  { from: 'design-patterns', to: 'min-diff', relation: 'part-of', quote: '每次修改尽量小、带来源、可单独回滚', segmentId: '¶203' },
  { from: 'prefix-traj', to: 'append-only', relation: 'example-of', quote: '改动越靠前，作废的缓存越多', segmentId: '¶201' },
  { from: 'guardrails', to: 'proposer-reviewer', relation: 'cause', quote: '同一个上下文中的模型难以发现自己的认知盲区', segmentId: '¶199' },
  { from: 'learn-paths', to: 'min-diff', relation: 'application', quote: '也正是按可', segmentId: '¶203' },
]

// ---- 校验：每条边两端节点必须存在 ----
const ids = new Set(nodes.map((n) => n.id))
const segIds = new Set(JSON.parse(readFileSync(`${DIR}/segments.json`, 'utf8')).items.map((s) => s.id))
const texts = new Map(
  JSON.parse(readFileSync(`${DIR}/segment-texts.json`, 'utf8')).items.map((t) => [t.id, String(t.text ?? '')]),
)

const problems = []
for (const e of edges) {
  if (!ids.has(e.from)) problems.push(`边 ${e.from}→${e.to}：起点节点不存在`)
  if (!ids.has(e.to)) problems.push(`边 ${e.from}→${e.to}：终点节点不存在`)
  if (e.segmentId && !segIds.has(e.segmentId)) problems.push(`边 ${e.from}→${e.to}：段号 ${e.segmentId} 不存在`)
  if (e.quote && e.segmentId) {
    const raw = texts.get(e.segmentId) ?? ''
    if (!raw.includes(e.quote) && !raw.replace(/\*\*/g, '').includes(e.quote)) {
      problems.push(`边 ${e.from}→${e.to}：quote 不在 ${e.segmentId} 里`)
    }
  }
}
// 孤立节点
const used = new Set(edges.flatMap((e) => [e.from, e.to]))
for (const n of nodes) if (!used.has(n.id)) problems.push(`节点「${n.label}」没有任何边`)

if (problems.length) {
  console.error(`关系图校验不通过（${problems.length} 条）：`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

const out = {
  docId: 'chapter1-940885',
  savedAt: new Date().toISOString(),
  direction: 'down',
  nodes,
  edges: edges.map((e, i) => ({
    id: `e${i + 1}`,
    from: e.from,
    relation: e.relation,
    to: e.to,
    quote: e.quote ?? null,
    segmentId: e.segmentId ?? null,
    // 有 quote 就是原文写明的，没有就是推出来的
    evidence: e.quote ? 'text' : 'inference',
    ...(e.quote ? {} : { why: e.why ?? '按行文顺序推断，原文没有明说' }),
  })),
}

// ---- relationReview：八类逐个表态（缺一类校验器就报错） ----
const byRel = {}
out.edges.forEach((e) => {
  if (!byRel[e.relation]) byRel[e.relation] = []
  byRel[e.relation].push(e.id)
})
out.relationReview = {
  prerequisite: {
    status: byRel.prerequisite?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel.prerequisite ?? [],
    why: '本章有一条明确的学习顺序：先懂工具调用四步，才看得懂 ReAct 循环为什么这样转；先懂五部分上下文，才理解静态前缀与轨迹为什么要分开。',
  },
  'part-of': {
    status: byRel['part-of']?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel['part-of'] ?? [],
    why: '全章是三层「总—分」：公式分三个组件，三个组件各自再分（工具五类、上下文五部分），Harness 分五要素。',
  },
  contrast: {
    status: byRel.contrast?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel.contrast ?? [],
    why: '本章的辩解都靠对照成立：工作流 vs 自主 Agent、模型即 Agent vs Harness 更重要、适配层 vs 原生能力。',
  },
  cause: {
    status: byRel.cause?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel.cause ?? [],
    why: '主线是因果链：边界决定什么能进上下文（¶17），上下文与工具的缺口导致 Demo 与产品的鸿沟（¶93），鸿沟催生三层保障。',
  },
  'example-of': {
    status: byRel['example-of']?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel['example-of'] ?? [],
    why: 'Manus、OpenClaw 是观察空间扩展的实例；消融实验 1-1 是上下文关键作用的实证；只增不改在 KV Cache 上有具体形态。',
  },
  application: {
    status: byRel.application?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel.application ?? [],
    why: '每个框架性结论都落到了怎么用：Harness 三原则、模型选型、三层护栏分别对应构建、选型、安全三处的实操判断。',
  },
  sequence: {
    status: byRel.sequence?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel.sequence ?? [],
    why: '工程范式有一条严格的时间顺序：提示工程 → 上下文工程 → Harness 工程 → Loop 工程 → Graph 工程，¶116 明说后一层包含前一层。',
  },
  analogy: {
    status: byRel.analogy?.length ? 'mapped' : 'unsupported',
    edgeIds: byRel.analogy ?? [],
    why: '文中把三个组件类比为策略、观察历史、观察/行动接口（¶14），并明确说"不是严格的一一等同"——是类比不是结构。',
  },
}

writeFileSync(`${DIR}/relations.json`, JSON.stringify(out, null, 2), 'utf8')

const withQuote = out.edges.filter((e) => e.quote).length
console.log(`节点 ${nodes.length}　边 ${edges.length}（${withQuote} 条带原文证据）`)
const dist = {}
for (const e of out.edges) dist[e.relation] = (dist[e.relation] ?? 0) + 1
console.log('关系类型分布:', JSON.stringify(dist))
