/**
 * chapter1 的读后自测问答。
 *
 * 规矩（校验器会管，但我先自己守住）：
 *   q 和 a 各自 ≤100 字 —— 超了就不是"自测"，是小作文
 *   segmentIds 必须真实存在 —— 答完能点回去看原文
 *   每题只问一件事，答完能自己判断对错
 */
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'D:/learn/.study/chapter1-940885'
const segIds = new Set(JSON.parse(readFileSync(`${DIR}/segments.json`, 'utf8')).items.map((s) => s.id))

const items = [
  {
    q: 'Agent 的公式是什么？其中的加号是什么意思？',
    a: 'Agent = LLM + 上下文 + 工具。加号表示工程组件的组合，不是强化学习里的形式化定义；公式只描述 Agent 边界之内，不含 Environment。',
    segmentIds: ['¶7'],
  },
  {
    q: '为什么说观察空间和动作空间决定了一个 Agent 的能力上限？',
    a: '没进上下文的信息对模型等于不存在；没被接口允许的操作，模型只能停在文字建议上。所以模型固定时，扩展这两个空间往往比换更强模型更有效。',
    segmentIds: ['¶17', '¶18'],
  },
  {
    q: 'ReAct 名字只有两个词，为什么实际有三个环节？',
    a: 'Reasoning 和 Acting 之外还有独立的"观察"：模型先想该做什么，调工具行动，再看工具返回的结果并继续想。想→做→看循环到任务完成。',
    segmentIds: ['¶67'],
  },
  {
    q: '一次 LLM 调用的上下文由哪两部分组成？各含什么？',
    a: '静态前缀（系统提示词 + 工具定义）和轨迹（用户消息 + 模型回复 + 工具执行结果）。前者不变，后者随交互不断追加增长。',
    segmentIds: ['¶61', '¶68'],
  },
  {
    q: 'Harness 到底是什么？它包含环境吗？',
    a: 'Harness 是 Agent 边界内、模型之外的运行与治理层：上下文管理 + 工具接口 + 约束、验证、纠正三层保障。它可以代理环境，但不包含环境自身。',
    segmentIds: ['¶96', '¶98'],
  },
  {
    q: '一个能跑的 Demo 和一个可靠的产品之间差什么？',
    a: '差在脆弱点的处理：模型会产生幻觉、选错工具、遇错无法自我恢复。这些正是三层保障要解决的——约束防越界，验证抓错误，纠正兜后果。',
    segmentIds: ['¶93', '¶103'],
  },
  {
    q: '工作流和自主 Agent 该怎么选？判据是什么？',
    a: '看任务的可预测性。步骤能预先固定的用工作流，更稳更省且攻击面被限制在单节点；步骤难以预测、需要按反馈调整的才用自主 Agent。',
    segmentIds: ['¶135', '¶140', '¶153'],
  },
  {
    q: '什么样的情况该用自主 Agent？它有什么代价？',
    a: '适用于步骤数难以预测的开放式任务。代价是成本更高、复合错误风险更大，所以要在沙盒里充分测试、设护栏监控，并在关键决策点加人工检查点。',
    segmentIds: ['¶158', '¶159'],
  },
  {
    q: '三层护栏是按什么顺序排的？为什么这么排？',
    a: '按被绕过的难度排，不是按处理先后：上下文层、执行层、数据层。越靠下越不依赖模型自己的判断，因此越难被一次成功的攻击穿透。',
    segmentIds: ['¶176'],
  },
  {
    q: '为什么只在上下文层设防不够？',
    a: '因为处在同一个上下文里的 Agent，很难判断自己是否已经被注入。上下文层只能降低攻击成功率，给不出保证——所以必须有执行层和数据层。',
    segmentIds: ['¶180'],
  },
  {
    q: '"适配层"是什么？它为什么可能会消失？',
    a: '指专门给工具能力短板打补丁的 Harness 代码，比如给文生图模型改写提示词。模型有了原生能力后这层就不需要了——本章已经在发生好几轮。',
    segmentIds: ['¶148', '¶149', '¶151'],
  },
  {
    q: '五个设计模式是哪五个？',
    a: '提议者—审核者、渐进式披露、只增不改、边界集 + 保留集、最小 diff + 可回滚。它们贯穿全书，因为都用来对付"改动会带来不可预期的连带影响"。',
    segmentIds: ['¶199', '¶200', '¶201', '¶202', '¶203'],
  },
  {
    q: '提议者—审核者为什么能成立？',
    a: '前提是自审不可靠：同一上下文中的模型难以发现自己的认知盲区，也难判断自己是否已被注入。所以产出与评判要由两个不共享上下文的角色承担。',
    segmentIds: ['¶199'],
  },
  {
    q: '消融实验 1-1 最重要的两个洞察是什么？',
    a: '一是各组件不等价，衡量标准是它承载的信息能否从别处重建；二是"给出了回答"不等于"完成了任务"——上下文残缺时是给出一个无破绽的错答案。',
    segmentIds: ['¶64'],
  },
  {
    q: '工程范式那五个阶段是并列的还是嵌套的？',
    a: '层层包含：提示工程 ⊂ 上下文工程 ⊂ Harness 工程 ⊂ Loop 工程 ⊂ Graph 工程。单个 Agent 循环只是执行图里的一个节点。',
    segmentIds: ['¶116'],
  },
  {
    q: '能力更新的三条路径分别是什么？',
    a: '上下文适应（当前任务内即时生效）、外部产物更新（跨任务保留，可审计可修订）、参数更新（内化难以显式表达的能力）。它们按时间尺度协同。',
    segmentIds: ['¶52', '¶56'],
  },
]

// ---- 校验 ----
const problems = []
for (const it of items) {
  if (it.q.length > 100) problems.push(`问题超 100 字（${it.q.length}）：${it.q.slice(0, 20)}`)
  if (it.a.length > 100) problems.push(`回答超 100 字（${it.a.length}）：${it.q.slice(0, 20)}`)
  if (!it.segmentIds?.length) problems.push(`没有 segmentIds：${it.q.slice(0, 20)}`)
  for (const id of it.segmentIds ?? []) {
    if (!segIds.has(id)) problems.push(`段号 ${id} 不存在：${it.q.slice(0, 20)}`)
  }
}
if (problems.length) {
  console.error(`校验不通过（${problems.length} 条）：`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

const out = {
  docId: 'chapter1-940885',
  savedAt: new Date().toISOString(),
  items: items.map((it) => ({ ...it, chars: { q: it.q.length, a: it.a.length } })),
}
writeFileSync(`${DIR}/qa.json`, JSON.stringify(out, null, 2), 'utf8')
console.log(`${out.items.length} 道自测题，题长 ${Math.min(...items.map((i) => i.q.length))}-${Math.max(...items.map((i) => i.q.length))}，答长 ${Math.min(...items.map((i) => i.a.length))}-${Math.max(...items.map((i) => i.a.length))}`)
