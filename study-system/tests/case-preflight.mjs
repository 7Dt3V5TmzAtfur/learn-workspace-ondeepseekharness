/**
 * 为 chapter1（AI Agent 入门，217 段）写读前六段式。
 *
 * 结构对齐 chapter4 的真实 schema：
 *   parts[i] = { title, requirements, keyPoints, difficulties,
 *                assessment: {level, purpose, requirement},
 *                knowledgePoints[], unitIds[], segmentIds[] }
 * assessment 与 knowledgePoints 挂在 part 上，不是独立数组 ——
 * 一个部分只对应一个档位，拆开写就会丢掉"哪个知识点属于哪个档位"的对应。
 */
import { writeFileSync, readFileSync } from 'node:fs'

const DIR = 'D:/learn/.study/chapter1-940885'

// 段号必须真实存在，写文件前先核对
const segIds = new Set(JSON.parse(readFileSync(`${DIR}/segments.json`, 'utf8')).items.map((s) => s.id))

const parts = [
  {
    title: '第一部分　公式与边界：Agent 是什么',
    requirements:
      '先把公式记牢，再弄清边界。关键不是背下三个词，而是理解"广义但边界清楚"——上下文不只是输入文本，而是每个决策点能看到的全部信息。',
    keyPoints: [
      'Agent = LLM（大脑）+ 上下文（眼睛）+ 工具（手脚）',
      '加号是工程组件的组合，不是强化学习中的形式化定义',
      '公式只描述 Agent 边界之内，不包含 Environment',
      '三组件映射到 RL 的策略、观察与历史、观察/行动接口，但不是严格一一等同',
      '观察空间与动作空间共同构成 Agent 与外部环境的边界',
      '底层模型固定时，扩展观察/动作空间往往比换更聪明的模型更有效',
    ],
    difficulties: [
      '容易把 Environment 也算进 Agent——本章特别澄清环境是闭环的另一方，不是组成部分',
      '容易把 RL 策略直接等同于 LLM，但上下文并不等于整个观察空间',
      '「加号」容易被误解成形式化定义，本章明确说是工程组合',
    ],
    assessment: {
      level: '理解',
      purpose: '这一部分是全章地基。后面所有讨论都默认你心里有一张"边界图"，分不清边界就无法判断问题出在哪一层',
      requirement:
        '能用自己的话说清三个组件各自是什么、边界在哪，并举一个例子说明"加号"为什么是工程组合而非形式化定义',
    },
    knowledgePoints: [
      {
        name: 'Agent 三组件公式',
        content: 'Agent = LLM + 上下文 + 工具，对应大脑 + 眼睛 + 手脚。',
        note: '这是全书地质，后面每一章都在展开其中一项。记忆钩子：大脑想、眼睛看、手脚动。',
        segmentIds: ['¶6'],
      },
      {
        name: 'Agent 与 Environment 的边界',
        content: '环境是闭环交互的另一方，不属于 Agent；Agent 只能通过观察和行动接口与它交互。Harness 可以创建、隔离或代理环境，但不因此包含环境自身的状态与转移规律。',
        note: '易错点：很多人把"Agent 系统"理解成"模型 + 环境"。这条边界决定了能力边界与接口设计的关系。',
        segmentIds: ['¶10', '¶11'],
      },
      {
        name: '观察空间与动作空间',
        content: '两者共同构成 Agent 与外部环境之间的边界。没进入上下文的信息对模型等于不存在；没被接口允许的操作，模型只能停在文字建议上。',
        note: '本章最实用的一条判断。Manus 是把三类 Agent 的空间并起来，OpenClaw 是把边界推到用户的数字生活里。',
        segmentIds: ['¶16', '¶17', '¶18'],
      },
    ],
    unitIds: ['¶6', '¶16'],
    segmentIds: ['¶6', '¶7', '¶8', '¶9', '¶10', '¶11', '¶16', '¶17', '¶18'],
  },

  {
    title: '第二部分　三个组件逐个展开',
    requirements:
      '本章最长的一段。工具、LLM、上下文各有一节，最后由 ReAct 循环把三者串起来。重点在于每个组件"边界之外还有什么"——工具不只是函数调用，LLM 不只是参数，上下文不只是输入。',
    keyPoints: [
      '工具是 Agent 感知或改变外部世界的接口，包含工具定义、调用协议与适配器',
      'LLM 的能力来自预训练（世界知识与语言）与后训练（决策策略）两部分',
      '内部思考：行动前先规划推演，不改变环境但提升行动质量',
      '上下文由系统提示词、工具定义、用户消息、模型回复、工具执行结果五部分构成',
      'ReAct = Reasoning + Acting，实际是「想→做→看」三环节循环',
      '上下文 = 静态前缀（系统提示词 + 工具定义）+ 轨迹（动态消息历史）',
      '累计缓存读取量随轮数近似二次方增长',
    ],
    difficulties: [
      '五部分上下文里哪些属于静态前缀、哪些属于轨迹，最容易记混',
      '「模型即 Agent」与「Harness 更重要」两个趋势看似矛盾，实为互补',
      'ReAct 名字只有两个词却有三个环节，观察环节最容易被漏掉',
      '轨迹的二次方增长要结合实现细节才想得明白',
    ],
    assessment: {
      level: '熟练掌握',
      purpose: '这一部分是唯一"必须能在白板上画出来"的。后面设计任何 Agent，你都要在脑子里跑一轮 ReAct',
      requirement:
        '能完整讲出 ReAct 循环的三个环节与「上下文 = 静态前缀 + 轨迹」这个等式，并能在白板上画出一轮交互的信息流，指出第二轮相比第一轮轨迹多了什么',
    },
    knowledgePoints: [
      {
        name: '工具的广义定义',
        content: '工具指 Agent 用来感知或改变外部世界的接口，包括工具定义、调用协议和适配器——从预定义的工具调用到动态生成代码，从委托子 Agent 到主动与用户沟通。',
        note: '不要只理解成"函数调用"。动态生成代码、委托子 Agent、与用户沟通都算工具。',
        segmentIds: ['¶25'],
      },
      {
        name: 'LLM 的能力来源',
        content: '预训练积累世界知识与语言能力，后训练固化决策策略（监督微调与强化学习，详见第八章）。',
        note: '这个二分很重要：知识来自预训练，策略来自后训练。Agent 的"决策"能力在后训练里。',
        segmentIds: ['¶44'],
      },
      {
        name: '内部思考',
        content: 'Agent 在采取实际行动前先规划与推演。这一过程不改变外部环境，却能显著提升后续行动质量；遵循的是预训练习得的逻辑规则，而非盲目随机探索。',
        note: '与传统 RL Agent 的关键区别。这也是"想-做-看"里"想"那一步的合法性来源。',
        segmentIds: ['¶45'],
      },
      {
        name: '上下文的五个组成部分',
        content: '系统提示词（岗位说明书，含用户记忆与环境状态）、工具定义、用户消息、模型回复（reasoning + content 或 tool_calls）、工具执行结果。',
        note: '前三项偏静态，后两项随交互增长。注意工具定义与系统提示词合称静态前缀。',
        segmentIds: ['¶58', '¶59', '¶60'],
      },
      {
        name: 'ReAct 循环',
        content: 'Reasoning + Acting。实际包含三个环节：思考当前该做什么、调用工具行动、观察结果并继续思考。循环重复直到任务完成。',
        note: '名字只有两个词，但"观察"是独立环节。漏掉它就会以为模型是"想完直接做"。',
        segmentIds: ['¶67'],
      },
      {
        name: '上下文 = 静态前缀 + 轨迹',
        content: '静态前缀 = 系统提示词 + 工具定义（对应五组件前两项）；轨迹 = 用户消息 + 模型回复 + 工具结果（随交互不断增长）。每次响应又追加到轨迹中供下次调用。',
        note: '这是本章最该背下来的一条等式。它同时解释了为什么上下文会涨、以及缓存为什么重要。',
        segmentIds: ['¶68'],
      },
    ],
    unitIds: ['¶25', '¶43', '¶57', '¶65'],
    segmentIds: ['¶25', '¶43', '¶44', '¶45', '¶57', '¶58', '¶59', '¶60', '¶65', '¶66', '¶67', '¶68'],
  },

  {
    title: '第三部分　Harness 工程：从能跑到可靠',
    requirements:
      '本章的转折点。前半部分回答"Agent 是什么"，这里开始回答"怎么让它可靠"。要抓住一个对照：Demo 和产品之间的差距，具体是哪些脆弱点。',
    keyPoints: [
      'Harness = 上下文管理 + 工具接口 + 三层保障（约束 / 验证 / 纠正）',
      '从提示工程到 Loop 工程的范式演进',
      '构建有效 Agent 的核心原则',
      '如何选择模型',
      '编排模式：工作流（确定性）与自主（动态决策），以及两者的混合',
      '护栏的类型与人工干预机制',
      'Harness 五要素与全书「构建」部分的对应关系',
    ],
    difficulties: [
      '工作流与自主没有绝对优劣，判据是任务的可预测性，最容易一刀切',
      '三层保障（约束/验证/纠正）容易只记住名字，说不清各自应对什么脆弱点',
      '人工干预要求「优雅地移交控制」，但用户不在线时怎么办，本章留成了思考题',
      '几节内容并列，容易读成知识清单而看不出它们都在回答同一个问题',
    ],
    assessment: {
      level: '掌握',
      purpose: '这是从"会用"到"能造"的分界。判断标准不是记住几个名词，而是拿到一个故障场景知道该动哪一层',
      requirement:
        '给定一个 Agent 故障场景（例如反复调用一个不存在的工具、或遇错后不断重试直到耗尽预算），能指出该由约束、验证还是纠正来兜，并说出具体做法',
    },
    knowledgePoints: [
      {
        name: 'Harness 的定义与三层保障',
        content: 'Harness = 上下文管理 + 工具接口，再加三层保障：约束（限定能做什么不能做什么）、验证（检查做得对不对）、纠正（做错了怎么补救）。',
        note: '三层保障各自对应不同脆弱点，别混：约束防越界，验证抓错误，纠正兜后果。',
        segmentIds: ['¶94'],
      },
      {
        name: '从提示工程到 Loop 工程',
        content: '工程重心从设计单次提示词，转向设计整个循环的上下文、工具与状态。',
        note: '这个范式转变是 Harness 概念成立的前提。',
        segmentIds: ['¶108'],
      },
      {
        name: '工作流与自主模式',
        content: '工作流是确定性编排（步骤预先定好），自主 Agent 是动态决策（边做边定）。选择取决于任务的可预测性，实践中常混合使用。',
        note: '没有优劣，只有匹配。可预测的重复任务用工作流更省更稳。',
        segmentIds: ['¶133', '¶139', '¶152', '¶160'],
      },
      {
        name: '护栏与人工干预',
        content: '护栏限定 Agent 的行为边界与可触达范围；人工干预在关键节点把控制权移交给人。',
        note: '人工干预的难点在"优雅地移交"——用户可能不在线、响应慢、指令模糊。',
        segmentIds: ['¶171', '¶175', '¶183'],
      },
    ],
    unitIds: ['¶92', '¶108', '¶118', '¶125', '¶133', '¶171', '¶190'],
    segmentIds: ['¶92', '¶93', '¶94', '¶108', '¶118', '¶133', '¶139', '¶152', '¶171', '¶175', '¶183', '¶190'],
  },

  {
    title: '第四部分　贯穿全书的设计模式',
    requirements: '这一部分是坐标，不是知识点。读的时候留意哪些模式会在后面的章节反复出现，读完全书可以回来对照。',
    keyPoints: ['贯穿全书的设计模式', '本章小结'],
    difficulties: ['这是概念地图的收口，信息密度低但跨度大，容易一扫而过'],
    assessment: {
      level: '了解',
      purpose: '不需要现在记住。它的作用是给后面每一章留一个挂点，读到对应章节时知道回来查',
      requirement: '能说出本章小结里印象最深的两个结论即可，不必逐条记忆',
    },
    knowledgePoints: [
      {
        name: '全书设计模式索引',
        content: '本章埋下的设计模式，后续章节会逐一展开。',
        note: '读完全书回来对照，比现在硬记有效得多。',
        segmentIds: ['¶197', '¶204'],
      },
    ],
    unitIds: ['¶197', '¶204'],
    segmentIds: ['¶197', '¶204'],
  },
]

// 段号真实性自检
const bad = []
for (const p of parts) {
  for (const id of p.segmentIds ?? []) if (!segIds.has(id)) bad.push(`${p.title}: ${id}`)
  for (const kp of p.knowledgePoints ?? []) {
    for (const id of kp.segmentIds ?? []) if (!segIds.has(id)) bad.push(`${p.title} / ${kp.name}: ${id}`)
  }
  for (const id of p.unitIds ?? []) if (!segIds.has(id)) bad.push(`${p.title} unitIds: ${id}`)
}
if (bad.length) {
  console.error('有段号不存在，拒绝写入：')
  for (const b of bad) console.error('  ' + b)
  process.exit(1)
}

const plan = {
  summary:
    '本章给 AI Agent 建了一张概念地图。核心公式是 Agent = LLM + 上下文 + 工具，换成直觉说法是大脑 + 眼睛 + 手脚，三个组件又分别对应强化学习里的策略、观察历史、观察/行动接口。' +
    '公式之上是边界：环境不算 Agent 的一部分，Agent 只能通过观察和行动接口与它交互。' +
    '把公式落到运行机制就是 ReAct 循环——想、做、看，反复直到任务完成；每次调用的上下文都等于「静态前缀 + 轨迹」。' +
    '后半部分转到工程视角：Demo 能跑不代表产品可靠，幻觉、选错工具、遇错无法恢复要靠 Harness 解决。' +
    'Harness = 上下文管理 + 工具接口 + 三层保障（约束、验证、纠正），围绕它展开模型选择、编排模式、护栏与人工干预。' +
    '作者反复强调一个判断：模型固定时，扩展观察空间与动作空间往往比换更强的模型更有效——许多"需要更聪明模型"的问题其实只是接口问题。',

  goals: {
    help:
      '如果你要动手做 Agent 产品，这一章给的是那张"先想清楚再写代码"的图：知道自己在加的是脑子、眼睛还是手脚，就不会把接口问题误判成模型能力问题。' +
      '如果你只是 Agent 的使用者，这一章能让你看懂那些产品为什么长成那样——Manus 的突破不是换了更强的模型，而是把三类 Agent 的观察空间和动作空间并了起来。',
    main: '能用一个统一框架（LLM + 上下文 + 工具 / 策略 + 观察 + 接口）解释任意一个 Agent 产品的行为，并判断它的问题出在哪一层',
    subgoals: [
      '能默写 Agent = LLM + 上下文 + 工具，并说清每个词"广义但边界清楚"是什么意思',
      '能解释为什么 Environment 不属于 Agent，这条边界带来什么实际后果',
      '能说出观察空间与动作空间如何决定 Agent 的能力上限',
      '能完整描述 ReAct 循环的三个环节，并解释「上下文 = 静态前缀 + 轨迹」',
      '能说明 Harness 的三层保障各自解决什么脆弱点',
      '能判断一个任务该用工作流还是自主 Agent，并说出判据',
    ],
  },

  parts,

  exercises: [
    {
      kind: '应用',
      question:
        '选一个你每天在用的 AI 产品（不是本章举例的那五个），用「眼睛 / 手脚 / 策略」三个维度把它拆开。拆完回答：如果只允许你改一个维度来提升它，你改哪个，为什么？',
      why: '检验你是否真的会用这套框架，而不只是记住了三个词。关键在最后那个"为什么"——它逼你判断瓶颈在哪一层。',
      hint: '先问自己：它是因为"看不到某样东西"而做错，还是因为"做不到某件事"？前者是眼睛，后者是手脚。',
    },
    {
      kind: '迁移',
      question:
        '本章说「在底层模型固定时，提升 Agent 任务表现最主要的系统工程手段，往往就是重新定义或扩展观察空间与动作空间」。举一个你自己遇到过的例子：某个 AI 工具"看起来很笨"，但其实只是没拿到需要的信息、或没有需要的操作。',
      why: '这是本章最有迁移价值的判断。能举出真实例子，说明你已经把它接进自己的经验里了。',
      hint: '想想那些"如果你把文档贴给它，它就能做对"的场景。',
    },
    {
      kind: '解释',
      question: '用你自己的话讲清：为什么 Environment 不属于 Agent？如果把环境也算进去，会带来什么实际后果？',
      why: '边界感是这一章的核心。答得出"实际后果"，说明不是背下来的。',
      hint: '想想 Model–Harness 结构：Harness 可以创建、隔离或代理环境，但环境自身的状态与转移规律属于环境。',
    },
    {
      kind: '回想',
      question:
        '把 ReAct 循环的一轮完整走一遍：假设你让 Agent 汇总三个城市今天的天气。写下第 1 轮的静态前缀、轨迹、模型输出、工具结果分别是什么；再写第 2 轮相比第 1 轮，上下文多了什么。',
      why: '这是本章最硬的一个点——很多人能背"静态前缀 + 轨迹"，但只有真的写过一轮才明白轨迹是怎么增长的。',
      hint: '第 1 轮时轨迹里只有用户消息；工具结果是追加到轨迹末尾的。',
    },
    {
      kind: '批判',
      question:
        '画一张图，把「Agent = LLM + 上下文 + 工具」和「Harness = 上下文管理 + 工具接口 + 三层保障」两个视角叠在一起，标出哪些部分重合、哪些是 Harness 新增的。',
      why: '本章明确说这两个视角"并非替代关系，而是不同抽象层次上对同一实现的描述"。能画出重叠关系，才算真懂。',
      hint: '原公式里的三个词，在 Harness 视角下哪个变成"核心组件"、哪两个变成"Harness 的职责"？',
    },
  ],

  references: [
    { title: '本章正文（217 段，约 3 万字）', source: '原文', note: '所有论断的出处都在这里，重点是 ¶6–¶68 的公式与循环部分' },
    { title: 'Manus 官方博客：Sandbox / Google Drive Connector / My Computer', source: '原文', note: '原文脚注 [^ch1-agent-products] 直接引用，是"观察空间与动作空间演进"论断的证据' },
    { title: 'OpenClaw README 与 tools 文档', source: '原文', note: '同上，用于说明本地优先与多渠道接入如何扩展边界' },
    { title: 'ReAct 原始论文（Yao et al., ReAct: Synergizing Reasoning and Acting in Language Models）', source: '联网检索', note: '本章 ReAct 命名的来源。读原文能看清"想-做-看"最初的设计动机' },
    { title: 'Sutton & Barto, Reinforcement Learning: An Introduction（第一章）', source: '联网检索', note: '本章多处借用 RL 的策略/观察/动作概念，读第一章即可建立对照' },
    { title: '我自己做过的 Agent 调试经验', source: '我的知识', note: '建议读完第一部分后补上：哪一次是"接口问题"被误判成"模型太笨"' },
  ],

  unitBinding: {
    note: 'parts 的 unitIds 是各部分的起始单元，segmentIds 是代表段，不是全部段落',
    source: 'units.json（25 块 / 217 段）',
  },
}

writeFileSync(`${DIR}/preflight.json`, JSON.stringify(plan, null, 2), 'utf8')
console.log('已写入 preflight.json')

const kp = parts.reduce((n, p) => n + p.knowledgePoints.length, 0)
const withIds = parts.reduce((n, p) => n + p.knowledgePoints.filter((k) => k.segmentIds?.length).length, 0)
console.log(`四个部分，${kp} 个知识点，${withIds} 个带原文段号`)
