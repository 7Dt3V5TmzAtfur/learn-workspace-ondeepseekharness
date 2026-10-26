/**
 * 测试用例：提取 / 规则 / 服务端到端。
 * 运行：node tests/run-tests.mjs
 */
import { strict as assert } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(HERE, 'fixtures')

const LIB = join(HERE, '..', 'plugin', 'lib')
const { extractFile, segmentText, extractDocument } = await import(`file://${join(LIB, 'extract.js')}`)
const { StudyService } = await import(`file://${join(LIB, 'service.js')}`)
const { renderMarkdown, parseMermaid, layoutGraph } = await import(`file://${join(LIB, 'markdown.js')}`)
const { findWorkspaceRoot, findWorkspaceRoots } = await import(`file://${join(LIB, 'store.js')}`)
const rules = await import(`file://${join(LIB, 'rules.js')}`)
const { splitGraph, buildArchifyFigures } = await import(`file://${join(LIB, 'archify-figures.js')}`)

let passed = 0
let failed = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed += 1
    failures.push({ name, error })
    console.log(`  ✗ ${name}\n      ${error.message.split('\n')[0]}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

/* ------------------------------------------------------------ 1. 提取 */

section('1. 多格式提取')

const EXPECT_MARKERS = ['认知负荷', 'Sweller', '外在负荷']

async function assertExtracted(file, minChars = 300) {
  const { text, format } = await extractFile(join(FIXTURES, file))
  assert.ok(text.length >= minChars, `${file} 提取仅 ${text.length} 字符，不足 ${minChars}`)
  for (const marker of EXPECT_MARKERS) {
    assert.ok(text.includes(marker), `${file} 缺少关键内容「${marker}」`)
  }
  assert.ok(!text.includes('\u0000'), `${file} 含空字节`)
  return { text, format }
}

await test('docx：提取正文且保留标题', async () => {
  const { text, format } = await assertExtracted('sample.docx')
  assert.equal(format, 'docx')
  assert.match(text, /^#\s+认知负荷理论导论/m)
})

await test('pptx：提取幻灯片文字并分节', async () => {
  const { text, format } = await assertExtracted('sample.pptx', 200)
  assert.equal(format, 'pptx')
  assert.match(text, /## 幻灯片 1/)
  assert.match(text, /## 幻灯片 3/)
})

await test('xlsx：提取单元格并用 | 分隔', async () => {
  const { text, format } = await extractFile(join(FIXTURES, 'sample.xlsx'))
  assert.equal(format, 'xlsx')
  assert.ok(text.length >= 30, `xlsx 提取仅 ${text.length} 字符`)
  for (const marker of ['内在负荷', '外在负荷', '相关负荷', '负荷类型']) {
    assert.ok(text.includes(marker), `xlsx 缺少「${marker}」`)
  }
  assert.ok(text.includes('|'), '未用 | 分隔单元格')
})

await test('html：剥掉标签与 script', async () => {
  const { text, format } = await assertExtracted('sample.html')
  assert.equal(format, 'html')
  assert.ok(!text.includes('<p>'), 'HTML 标签未清除')
  assert.ok(!text.includes('console.log'), 'script 内容未剔除')
})

await test('md：原样保留结构', async () => {
  const { text, format } = await assertExtracted('sample.md')
  assert.equal(format, 'md')
  assert.match(text, /^# 认知负荷理论导论/)
})

await test('txt（GB18030 编码）：中文不乱码', async () => {
  const { text, format } = await assertExtracted('sample_gbk.txt')
  assert.equal(format, 'txt')
  assert.ok(text.includes('认知负荷'), 'GBK 解码失败')
})

await test('rtf：剥离控制符', async () => {
  const { text, format } = await extractFile(join(FIXTURES, 'sample.rtf'))
  assert.equal(format, 'rtf')
  assert.ok(!text.includes('\\rtf1'), 'RTF 控制符未剥离')
})

await test('pdf：走 pdftotext 提取文本层', async () => {
  const { text, format } = await extractFile(join(FIXTURES, 'sample.pdf'))
  assert.equal(format, 'pdf')
  assert.ok(text.includes('Cognitive Load'), `PDF 提取内容不对：${text.slice(0, 60)}`)
})

await test('epub：按 spine 顺序拼章节', async () => {
  const { text, format } = await extractFile(join(FIXTURES, 'sample.epub'))
  assert.equal(format, 'epub')
  assert.ok(text.includes('第一章'), '缺第一章')
  assert.ok(text.includes('第二章'), '缺第二章')
  assert.ok(text.indexOf('第一章') < text.indexOf('第二章'), '章节顺序错乱')
})

await test('不存在的格式：给出可读错误而不是崩溃', async () => {
  await assert.rejects(
    () => extractDocument('x.unknown', Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00, 0x00])),
    /不支持的文件格式|没有可提取/,
  )
})

/* ------------------------------------------------------------ 2. 分段 */

section('2. 段落切分')

await test('分段产生稳定 ¶N 锚点与章节归属', async () => {
  const { text } = await extractFile(join(FIXTURES, 'sample.md'))
  const segs = segmentText(text)
  assert.ok(segs.length >= 8, `只切出 ${segs.length} 段`)
  assert.equal(segs[0].id, '¶1')
  assert.ok(segs.every((s) => /^¶\d+$/.test(s.id)), '锚点格式错误')
  assert.ok(segs.some((s) => s.chapter === '认知负荷理论导论'), '章节未继承')
  assert.ok(
    segs.every((s) => s.chars > 0 && s.lead.length > 0),
    '存在空段落或空 lead',
  )
})

await test('超长段落会被兜底切开，不出现几千字单段', async () => {
  const long = Array.from({ length: 200 }, (_, i) => `第${i}句话说明一个观点，并且给出一个细节。`).join('')
  assert.ok(long.length > 3000, '测试输入应当足够长')
  const segs = segmentText(long)
  assert.ok(segs.length > 1, `超长文本没有被切分（${long.length} 字 → ${segs.length} 段）`)
  const maxChars = Math.max(...segs.map((s) => s.chars))
  assert.ok(maxChars <= 1400, `存在过长段落 ${maxChars} 字`)
  // 内容不能丢
  const total = segs.reduce((a, s) => a + s.chars, 0)
  assert.ok(total >= long.length * 0.95, `切分丢失内容：${total}/${long.length}`)
})

/* ------------------------------------------------------------ 3. 规则 */

section('3. 标注规则与三色预算')

// 8 段 × 100 字 = 800 字。核心档上限 10% = 80 字，所以核心最多标 0 段；
// 用 20 段 × 100 字 = 2000 字做预算测试，1 段核心 = 5%（合规），1 段攻坚 = 5%（合规）。
// 每段 100 字正文。正文里嵌一个固定的可引用短语，供 quote 命中；
// 新的三色高亮规则要求"高亮加在原文短语上"，所以测试必须提供真实正文。
const SEGS = Array.from({ length: 20 }, (_, i) => {
  const key = `关键短语${i + 1}`
  const filler = '填充内容'.repeat(20)
  const text = `${filler}${key}${filler}`.slice(0, 100)
  return { id: `¶${i + 1}`, chars: 100, text }
})
const CTX = { segments: SEGS, totalChars: 2000 }

await test('合法标注通过', async () => {
  const r = rules.validateAnnotation(
    [
      { segmentId: '¶2', label: 'd', title: '负荷的定义' , quote: '关键短语2' },
      { segmentId: '¶4', label: 'q', title: '为何上限是20%' , quote: '关键短语4' },
    ],
    CTX,
  )
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.stats.byTier.core, 1)
  assert.equal(r.stats.byTier.hard, 1)
  // 预算按 quote 字数算（每段 5 字），不再按整段 100 字
  assert.equal(r.stats.highlightedChars, 10)
  assert.equal(r.stats.ratio, 0.005)
})

await test('非法标签被拒', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'x', title: 'x' , quote: '关键短语1' }], CTX)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'bad-label'))
})

await test('同一段重复标注被拒', async () => {
  const r = rules.validateAnnotation(
    [
      { segmentId: '¶1', label: 'd', title: 'a' , quote: '关键短语1' },
      { segmentId: '¶1', label: 'e', title: 'b' , quote: '关键短语1' },
    ],
    CTX,
  )
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'duplicate'))
})

await test('#c 缺两字关键词被拒', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'c', title: '补充' , quote: '关键短语1' }], CTX)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'c-needs-keyword'))
})

await test('#c 带两字关键词则通过', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'c', title: '作者背景', keyword: '背景' , quote: '关键短语1' }], CTX)
  assert.ok(r.ok, JSON.stringify(r.issues))
})

await test('总高亮超 20% 被拒（二八法则）', async () => {
  // 5 段核心 = 500/2000 = 25% > 20%
  const r = rules.validateAnnotation(
    SEGS.slice(0, 5).map((s) => ({ segmentId: s.id, label: 'd', title: 't', quote: s.text })),
    CTX,
  )
  assert.equal(r.ok, false)
  assert.ok(
    r.issues.some((i) => i.code === 'budget-total' || i.code === 'budget-core'),
    `未触发预算错误：${r.issues.map((i) => i.code)}`,
  )
})

await test('核心档单独超 10% 被拒', async () => {
  // 3 段核心 = 300/2000 = 15%，总量 15% 未超但核心档已超 10%
  const r = rules.validateAnnotation(
    SEGS.slice(0, 3).map((s) => ({ segmentId: s.id, label: 's', title: 't', quote: s.text })),
    CTX,
  )
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'budget-core'))
})

await test('参考档不占预算，可以多标', async () => {
  const r = rules.validateAnnotation(
    [
      { segmentId: '¶1', label: 'e', title: 'a' , quote: '关键短语1' },
      { segmentId: '¶2', label: 'e', title: 'b' , quote: '关键短语2' },
      { segmentId: '¶3', label: 't', title: 'c' , quote: '关键短语3' },
      { segmentId: '¶5', label: 'd', title: '核心一段' , quote: '关键短语5' },
    ],
    CTX,
  )
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.stats.byTier.ref, 3)
  assert.equal(r.stats.highlightedChars, 5, '参考档不应计入高亮字数，只剩核心那段的 quote 字数')
})

await test('未知段落锚点被拒', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶99', label: 'd', title: 't' , quote: '关键短语99' }], CTX)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'unknown-segment'))
})

/* ---- 高亮密度：只有上限会让系统"奖励偷懒" ---- */

section('3b. 高亮密度（上界与下界都要有）')

// 造一段足够长的正文，用来验证"段内密度"规则
const LONG = '这是一段足够长的正文内容用来验证段内高亮密度规则是否生效我们需要至少六十个字符才能触发检查'.repeat(4)
const LONG_CTX = {
  totalChars: [...LONG].length,
  segments: [{ id: '¶L', chars: [...LONG].length, text: LONG }],
}

await test('高亮过少给出警告（实测 0.85% 时注意力机制已失效）', async () => {
  // 180 字里只标 1 个字 → 0.56%，远低于 2%
  const r = rules.validateAnnotation([{ segmentId: '¶L', label: 'd', tier: 'core', title: 'x', quote: '正' }], LONG_CTX)
  assert.ok(
    r.issues.some((i) => i.code === 'budget-too-sparse'),
    `应有 budget-too-sparse 警告，实际：${r.issues.map((i) => i.code).join(',')}`,
  )
  // 只是警告，不该阻塞
  assert.equal(r.ok, true, '高亮过少应该是提醒而不是拒绝')
})

await test('单条 quote 占段落一半以上 → 拒绝（等于整段染色）', async () => {
  // 180 字的段落里标 100 字：单条检查（≥90%）放行，只有段内密度能拦住
  const r = rules.validateAnnotation(
    [{ segmentId: '¶L', label: 't', tier: 'ref', title: 'x', quote: LONG.slice(0, 100) }],
    LONG_CTX,
  )
  assert.ok(
    r.issues.some((i) => i.code === 'segment-over-highlighted'),
    `单条 quote 占段 56% 必须被拦下，实际：${r.issues.map((i) => i.code).join(',')}`,
  )
  assert.equal(r.ok, false)
})

await test('每段只能有一条标注（所以"同段多条拼成整段"在数据层就不可能）', async () => {
  const parts = LONG.match(/.{1,20}/g).slice(0, 3)
  const r = rules.validateAnnotation(
    parts.map((q, i) => ({ segmentId: '¶L', label: 't', tier: 'ref', title: `p${i}`, quote: q })),
    LONG_CTX,
  )
  assert.ok(
    r.issues.some((i) => i.code === 'duplicate'),
    '同段多条必须报 duplicate',
  )
})

await test('短段落不参与密度检查（12 字里标 5 字是正常做法）', async () => {
  const r = rules.validateAnnotation(
    [{ segmentId: '¶1', label: 'd', tier: 'core', title: 'x', quote: '关键短语1' }],
    { totalChars: 24, segments: [{ id: '¶1', chars: 12, text: '这是第一段的原文内容关键短语1' }] },
  )
  assert.ok(
    !r.issues.some((i) => i.code === 'segment-over-highlighted'),
    '短段落不该被判整段染色',
  )
})

await test('同一段 quote 重叠时提示标重了', async () => {
  // duplicate 会先拦下同段第二条，所以这里直接验证区间合并能识别重叠
  const r = rules.validateAnnotation(
    [{ segmentId: '¶L', label: 't', tier: 'ref', title: 'a', quote: LONG.slice(0, 10) }],
    LONG_CTX,
  )
  // 单条不应误报重叠
  assert.ok(!r.issues.some((i) => i.code === 'quote-overlap'), '单条不该报重叠')
})

/* ------------------------------------------------------- 读前六段式 */

section('4. 读前六段式校验')

function goodPlan() {
  return {
    summary: '这'.repeat(300),
    goals: {
      help: '第一，能判断讲义排版问题；第二，能改写自己的技术文档。',
      main: '能应用认知负荷理论改造一份现有讲义',
      subgoals: [
        { text: '区分三种负荷', level: '理解' },
        { text: '改造一份讲义', level: '掌握' },
      ],
    },
    parts: [
      {
        title: '第一部分 三种负荷',
        requirements: '能分别举例',
        keyPoints: ['内在负荷', '外在负荷'],
        difficulties: ['相关负荷与内在负荷难区分：都发生在工作记忆里'],
        assessment: { level: '掌握', purpose: '否则无法判断该改哪里', requirement: '能对三个新例子正确归类' },
        knowledgePoints: [
          { name: '内在负荷', content: '来自元素交互复杂度', note: '易混：它不等于内容难' },
          { name: '外在负荷', content: '来自不当设计', note: '可控，是改造重点' },
        ],
      },
    ],
    exercises: [
      { question: '合上书说出三种负荷的区别', kind: '回想', rubric: ['三者都对', '各举一例'], minimalAction: '明早默写三行' },
      { question: '向你奶奶解释外在负荷', kind: '解释', rubric: ['不用术语'], minimalAction: '录一段 60 秒语音' },
      { question: '给一个新讲义判断哪里是外在负荷', kind: '应用', rubric: ['指出至少两处'], minimalAction: '改一页' },
      { question: '这套逻辑能用在别处吗', kind: '迁移', rubric: ['举一个自己领域例子'], minimalAction: '写一句' },
      { question: '作者哪里跳过了论证', kind: '批判', rubric: ['指出证据缺口'], minimalAction: '列一条' },
    ],
    references: [
      { title: '认知负荷理论原文', kind: '原文' },
      { title: 'Sweller 1988 Cognitive Science', kind: '我的知识' },
      { title: '某高校教学发展中心指南', kind: '联网检索', url: 'https://example.org/guide' },
    ],
  }
}

await test('完整的六段式通过', async () => {
  const r = rules.validatePreflight(goodPlan())
  assert.ok(r.ok, JSON.stringify(r.issues, null, 2))
  assert.equal(r.missingSections.length, 0)
  assert.equal(r.stats.exercises, 5)
})

await test('缺摘要时报错并列出缺失段', async () => {
  const plan = goodPlan()
  plan.summary = ''
  const r = rules.validatePreflight(plan)
  assert.equal(r.ok, false)
  assert.ok(r.missingSections.some((s) => s.key === 'summary'))
})

await test('摘要字数偏离过大只警告不阻断', async () => {
  const plan = goodPlan()
  plan.summary = '太短了'
  const r = rules.validatePreflight(plan)
  assert.ok(r.ok, '字数问题不应该阻断')
  assert.ok(r.issues.some((i) => i.code === 'summary-length'))
})

await test('缺重点或难点报错', async () => {
  const plan = goodPlan()
  plan.parts[0].keyPoints = []
  plan.parts[0].difficulties = []
  const r = rules.validatePreflight(plan)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'part-keypoints'))
  assert.ok(r.issues.some((i) => i.code === 'part-difficulties'))
})

await test('掌握档位不在四档内报错', async () => {
  const plan = goodPlan()
  plan.parts[0].assessment.level = '精通'
  const r = rules.validatePreflight(plan)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'part-level'))
})

await test('知识点缺内容报错，缺备注只警告', async () => {
  const plan = goodPlan()
  plan.parts[0].knowledgePoints[0].content = ''
  plan.parts[0].knowledgePoints[1].note = ''
  const r = rules.validatePreflight(plan)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'kp-content'))
  assert.ok(r.issues.some((i) => i.code === 'kp-note' && i.level === 'warn'))
})

await test('缺参考资料报错', async () => {
  const plan = goodPlan()
  plan.references = []
  const r = rules.validatePreflight(plan)
  assert.equal(r.ok, false)
  assert.ok(r.missingSections.some((s) => s.key === 'references'))
})

/* ------------------------------------------------------- 知识关系 */

section('5. 知识点关系校验')

/** 八种关系都表态的辅助器：mapped 的给出边 id，其余写理由。 */
const reviewOf = (byRel) => {
  const out = {}
  for (const k of ['prerequisite', 'part-of', 'contrast', 'cause', 'example-of', 'application', 'sequence', 'analogy']) {
    const ids = byRel[k] ?? []
    out[k] = ids.length
      ? { status: 'mapped', edgeIds: ids, why: '材料里有明确论述' }
      : { status: 'unsupported', why: '材料没有论述这类关系' }
  }
  return out
}

await test('合法图通过（边带原文出处 + 八类表态齐全）', async () => {
  const r = rules.validateRelations({
    nodes: [
      { id: 'a', label: '内在负荷' },
      { id: 'b', label: '外在负荷' },
      { id: 'c', label: '设计原则' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'c', relation: 'prerequisite', quote: '内在负荷决定教学设计' },
      { id: 'e2', from: 'b', to: 'c', relation: 'prerequisite', quote: '外在负荷要靠设计消除' },
      { id: 'e3', from: 'a', to: 'b', relation: 'contrast', quote: '两者来源不同' },
    ],
    relationReview: reviewOf({ prerequisite: ['e1', 'e2'], contrast: ['e3'] }),
  })
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.stats.edges, 3)
})

await test('边没有原文出处被拒（拦编造连线）', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause' }],
    relationReview: reviewOf({ cause: ['e1'] }),
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'edge-no-evidence'))
})

await test('标了 inference 的无出处边可以放行，但必须写 why', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause', evidence: 'inference' }],
    relationReview: reviewOf({ cause: ['e1'] }),
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'inference-no-reason'), '推断边必须给理由')

  const r2 = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause', evidence: 'inference', why: '由行文顺序推出' }],
    relationReview: reviewOf({ cause: ['e1'] }),
  })
  assert.ok(r2.ok, JSON.stringify(r2.issues))
})

await test('一条边都没有被拒（原来只报 warn，散点图也能过）', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [],
    relationReview: reviewOf({}),
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'no-edges'))
})

await test('缺少 relationReview 被拒（必须逐类想过）', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause', quote: '有原文' }],
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'review-missing'))
})

await test('unsupported 不给理由被拒（"没画线"不算理由）', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause', quote: '有原文' }],
    relationReview: {
      ...reviewOf({ cause: ['e1'] }),
      analogy: { status: 'unsupported' },
    },
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'review-no-reason'))
})

await test('前置关系成环被拒', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [
      { id: 'e1', from: 'a', to: 'b', relation: 'prerequisite', quote: 'A 在 B 之前' },
      { id: 'e2', from: 'b', to: 'a', relation: 'prerequisite', quote: 'B 在 A 之前' },
    ],
    relationReview: reviewOf({ prerequisite: ['e1', 'e2'] }),
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'cycle'))
})

await test('非法关系类型被拒', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'related-to', quote: '瞎连' }],
    relationReview: reviewOf({}),
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'edge-type'))
})

await test('孤立知识点是错误，但可以用独立节点声明豁免', async () => {
  const graph = {
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause', quote: 'A 导致 B' }],
    relationReview: reviewOf({ cause: ['e1'] }),
  }
  const r = rules.validateRelations(graph)
  assert.equal(r.ok, false, '孤立节点默认是错误')
  assert.ok(r.issues.some((i) => i.code === 'isolated'))

  const r2 = rules.validateRelations({
    ...graph,
    independentNodes: [{ id: 'c', why: '它是背景设定，不参与本章任何论证' }],
  })
  assert.ok(r2.ok, `声明后应放行：${JSON.stringify(r2.issues)}`)
})

await test('标签决定档位：tier 写错也按标签归位', async () => {
  // 真实数据里 217 条标注有 93 条的 #d（定义）被写成 ref，
  // 于是徽标说"定义"、颜色是"参考"——用户只能怀疑颜色标错了。
  const r = rules.validateAnnotation(
    [{ segmentId: '¶2', label: 'd', tier: 'ref', title: '定义', quote: '关键短语2' }],
    CTX,
  )
  assert.equal(r.stats.byTier.core, 1, '统计应按标签算进核心档')
  assert.equal(r.stats.byTier.ref, 0, '不应按写错的 tier 算进参考档')
  assert.ok(
    r.issues.some((i) => i.code === 'tier-mismatch' && i.level === 'warn'),
    '应保留一条说明档位被归位的 warn',
  )
})

await test('分档占比按标签现算（老项目没有 tierRatio 也能显示）', async () => {
  const stat = rules.summarizeAnnotations(
    [
      { label: 'd', tier: 'ref', quote: '关键短语2' },
      { label: 'q', tier: 'core', quote: '关键短语4' },
      { label: 'e', quote: '补充' },
    ],
    1000,
  )
  assert.deepEqual(stat.byTier, { core: 1, hard: 1, ref: 1 })
  assert.equal(stat.tierRatio.core, 0.005)
  assert.equal(stat.tierRatio.hard, 0.005)
  assert.equal(stat.ratio, 0.01, '只有核心/攻坚计入注意力预算')
})

await test('总高亮预算按三档合计判（参考档不能无限标）', async () => {
  /**
   * 早期只把核心+攻坚计入总预算，参考档"不限"于是真的可以标到满页。
   * 实测同一份资料的两种口径差近一倍（chapter4：核心+攻坚 6.3%，三档合计 11.1%）——
   * 需求里"高亮 10%-20%"说的显然是后者。
   */
  // 20 段 × 100 字：每段标 15 字参考档 = 300 字 = 15%，再加核心/攻坚仍在 20% 内
  const refsOnly = SEGS.map((s, i) => ({
    segmentId: s.id,
    label: 'e',
    title: `例子${i}`,
    quote: '填充内容'.repeat(3) + '填',
  }))
  const view = rules.summarizeAnnotations(refsOnly, CTX.totalChars)
  assert.equal(view.ratio, 0, '参考档不进分档预算')
  assert.ok(view.colorRatio > 0.1, `三档合计应计入参考档，实际 ${view.colorRatio}`)

  // 把参考档标到 30%：分档预算完全没超，但读者看到的是一页颜色，必须拒
  const heavy = SEGS.map((s, i) => ({
    segmentId: s.id,
    label: 'e',
    title: `例子${i}`,
    quote: ('填充内容'.repeat(6) + s.text.slice(0, 30)).slice(0, 30),
  }))
  const r = rules.validateAnnotation(heavy, CTX)
  assert.equal(r.ok, false, '参考档把 30% 的正文染满竟然通过了')
  assert.ok(
    r.check === undefined && r.issues.some((i) => i.code === 'budget-total'),
    '没有报 budget-total，模型不知道是总量超了',
  )
  assert.ok(r.stats.colorRatio > 0.2)
})

await test('渲染时颜色跟着标签走，不跟 tier', async () => {
  const html = rules.renderAnnotatedHtml(
    [{ id: '¶2', text: '关键短语2 是定义', html: '' }],
    { items: [{ segmentId: '¶2', label: 'd', tier: 'ref', title: '定义', quote: '关键短语2' }] },
  )
  assert.ok(html.includes('data-tier="core"'), '段落档位没按标签归位')
  assert.ok(html.includes('sc-hl-core'), '高亮颜色没按标签归位')
})

/* ------------------------------------------------------------ 6. 服务 */

section('6. 服务端到端（真实落盘）')

const workspace = await mkdtemp(join(tmpdir(), 'study-test-'))
let DOC_ID = null

/** 取完整项目（含 segments 原文），list() 只返回摘要。 */
async function loadProject(svc) {
  return svc.project(DOC_ID)
}

await test('ingest → 文件落盘 → 状态推进', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.ingest(join(FIXTURES, 'sample.md'), { title: '认知负荷' })
  assert.ok(res.docId, '没有返回 docId')
  DOC_ID = res.docId
  assert.ok(res.segmentCount >= 8, `段数 ${res.segmentCount}`)
  assert.equal(res.next.stage, 'ingested')

  const source = await readFile(join(workspace, '.study', res.docId, 'source.md'), 'utf8')
  assert.ok(source.includes('认知负荷理论'), 'source.md 内容不对')

  const list = await svc.list()
  assert.equal(list.length, 1)
  assert.equal(list[0].progress.ingested, true)
})

await test('read 分批返回带 ¶N 与正文', async () => {
  const svc = new StudyService(workspace)
  const batch = await svc.read(DOC_ID, { offset: 0, limit: 3 })
  assert.equal(batch.segments.length, 3)
  assert.ok(batch.segments[0].text.length > 0, '段落正文为空')
  const proj = await loadProject(svc)
  assert.equal(batch.total, proj.segments.length)
})

await test('保存读前建构后阶段推进到 planned', async () => {
  const svc = new StudyService(workspace)
  const before = await loadProject(svc)
  const res = await svc.savePreflight(DOC_ID, goodPlan())
  assert.ok(res.check.ok, JSON.stringify(res.check.issues))
  // 尚未标注，所以下一步是标注
  assert.equal(res.next.stage, 'planned')
  assert.equal(res.next.action, 'study-annotate')
  const after = await loadProject(svc)
  assert.equal(after.progress.planned, true)
  assert.equal(after.progress.annotated, false)
  assert.ok(after.quiz.includes('费曼'), 'quiz.md 未生成')
  assert.ok(after.refs.includes('参考资料'), 'refs.md 未生成')
  assert.ok(before.progress.planned === false)
})

await test('保存超预算标注被拒且不推进阶段', async () => {
  const svc = new StudyService(workspace)
  const proj = await loadProject(svc)
  const all = proj.segments.map((s) => ({ segmentId: s.id, label: 'd', title: '全部', quote: (s.text || '').slice(0, 12) || 'x' }))
  const res = await svc.saveAnnotation(DOC_ID, all)
  assert.equal(res.check.ok, false, '全部标为核心档应当被拒')
  const after = await loadProject(svc)
  assert.equal(after.progress.annotated, false, '不应被标记为已标注')
})

await test('修正后的标注通过并产出 annotated.md', async () => {
  const svc = new StudyService(workspace)
  const proj = await loadProject(svc)
  const first = proj.segments[0].id
  const res = await svc.saveAnnotation(DOC_ID, [
    { segmentId: first, label: 'd', title: '认知负荷理论提出者', quote: (proj.segments[0].text || '').slice(0, 10) },
  ])
  assert.ok(res.check.ok, JSON.stringify(res.check.issues))
  const md = await readFile(join(workspace, '.study', DOC_ID, 'annotated.md'), 'utf8')
  assert.match(md, /^#d 认知负荷理论提出者\|Definition/m)
})

await test('关系图保存并产出 Mermaid', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveRelations(DOC_ID, {
    nodes: [{ id: 'a', label: '内在负荷' }, { id: 'b', label: '设计原则' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'prerequisite', quote: '内在负荷决定设计原则' }],
    relationReview: reviewOf({ prerequisite: ['e1'] }),
  })
  assert.ok(res.check.ok, JSON.stringify(res.check.issues))
  assert.match(res.mermaid, /graph TD/)
  assert.match(res.mermaid, /a.*-->.*b/)
})

await test('关系图拒绝凭空连线（缺原文出处）', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveRelations(DOC_ID, {
    nodes: [{ id: 'a', label: '内在负荷' }, { id: 'b', label: '设计原则' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause' }],
    relationReview: reviewOf({ cause: ['e1'] }),
  })
  assert.equal(res.check.ok, false)
  assert.ok(res.check.issues.some((i) => i.code === 'edge-no-evidence'))
})

await test('关系图校验失败：只留失败痕迹，不写正式产物、不推进阶段', async () => {
  // 曾经 relations.json 无条件落盘，而 progressOf 用"文件在不在"判 mapped，
  // 于是被规则判错的图也会把阶段推到 mapped，下一步直接建议去做读后巩固。
  const ws = await mkdtemp(join(tmpdir(), 'study-reject-'))
  const svc = new StudyService(ws)
  const ing = await svc.ingest(join(FIXTURES, 'sample.md'), { title: '拒绝落盘' })
  const res = await svc.saveRelations(ing.docId, {
    nodes: [{ id: 'a', label: '内在负荷' }, { id: 'b', label: '设计原则' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'cause' }],
    relationReview: reviewOf({ cause: ['e1'] }),
  })
  assert.equal(res.check.ok, false)

  const dir = join(ws, '.study', ing.docId)
  assert.equal(await readFile(join(dir, 'relations.json'), 'utf8').catch(() => null), null, '校验失败却写了正式产物')
  const rejected = await readFile(join(dir, 'relations.rejected.json'), 'utf8').catch(() => null)
  assert.ok(rejected, '失败产物没有留痕')
  assert.equal(JSON.parse(rejected).check.ok, false)

  const proj = await svc.project(ing.docId)
  assert.equal(proj.progress.mapped, false, '阶段不应推进到 mapped')
  assert.notEqual(proj.stage, 'mapped')
})

await test('术语追问带上下文落库并可检索', async () => {
  const svc = new StudyService(workspace)
  const proj = await loadProject(svc)
  const rec = await svc.askTerm(DOC_ID, {
    term: '图式',
    segmentId: proj.segments[1].id,
    answer: '这里的图式指…',
  })
  assert.ok(rec.context.length > 0, '没有带上段落上下文')
  const hits = await svc.searchTerms(DOC_ID, '图式')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].answer, '这里的图式指…')
})

await test('渲染产出带三色 class 的 HTML', async () => {
  const svc = new StudyService(workspace)
  const html = await svc.render(DOC_ID)
  assert.match(html, /sc-seg/)
  assert.match(html, /sc-hl-core/)
  assert.match(html, /data-id="¶1"/)
})

await test('非法 docId 触发路径穿越防护', async () => {
  const svc = new StudyService(workspace)
  await assert.rejects(() => svc.project('../../etc'), /非法的 docId/)
})

await test('导入不存在的文件给出明确错误', async () => {
  const svc = new StudyService(workspace)
  await assert.rejects(() => svc.ingest('nope-does-not-exist.md'), /文件不存在/)
})

/* ------------------------------------------------------------ 7. 考核语义 */

section('7. 考核阶段语义')

await test('生成思考题不等于完成考核', async () => {
  const svc = new StudyService(workspace)
  await svc.saveQuiz(DOC_ID, '# 思考题\n\n1. 说说三类负荷。\n')
  const proj = await loadProject(svc)
  assert.equal(proj.progress.drilled, false, 'quiz.md 存在不应被视为已考核')
  // 阶段顺序是 … → mapped → recalled → drilled。此刻还没做 QA 自测，
  // 所以下一步应先去做读后自测，而不是直接跳到费曼考核。
  assert.equal(proj.next.action, 'study-recall', '下一步应先做读后自测')
})

await test('空复述被拒，不能空手过关', async () => {
  const svc = new StudyService(workspace)
  await assert.rejects(() => svc.recordDrill(DOC_ID, { answer: '   ' }), /缺少你的复述/)
})

/* ---- 读后自测（recalled）阶段：新加的阶段必须真的接进状态机 ---- */

await test('没做 QA 时 next 指向 study-recall，不能直接跳到考核', async () => {
  const svc = new StudyService(workspace)
  const st = await svc.status(DOC_ID)
  assert.equal(st.progress.recalled, false, 'qa.json 为空时不该算完成自测')
  assert.equal(st.next.action, 'study-recall', `实际 next=${st.next.action}`)
})

await test('保存 QA 后 recalled 点亮，next 才指向 study-feynman', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveQa(DOC_ID, [
    { q: '三类认知负荷分别是什么？', a: '内在、外在、相关。', segmentIds: [] },
  ])
  assert.equal(res.accepted, true, JSON.stringify(res.issues))
  // saveQa 必须也返回 next，否则界面和 Agent 都不知道下一步
  assert.ok(res.next, 'saveQa 应返回 next')
  assert.equal(res.next.action, 'study-feynman', `实际 next=${res.next.action}`)
  const st = await svc.status(DOC_ID)
  assert.equal(st.progress.recalled, true, 'recalled 应已点亮')
  assert.equal(st.counts.qa, 1)
})

await test('QA 超 100 字被拒（原则要求每条不超过 100 字）', async () => {
  const svc = new StudyService(workspace)
  const long = '啊'.repeat(101)
  const res = await svc.saveQa(DOC_ID, [{ q: long, a: '短答案' }])
  assert.equal(res.accepted, false, '超长问题应被拒')
  assert.ok(
    res.issues.some((i) => i.code === 'qa-question-too-long'),
    JSON.stringify(res.issues),
  )
})

await test('status() 不含正文，避免每轮烧掉几十 KB 上下文', async () => {
  const svc = new StudyService(workspace)
  const st = await svc.status(DOC_ID)
  const size = JSON.stringify(st).length
  assert.ok(size < 8 * 1024, `status() 应小于 8KB，实际 ${(size / 1024).toFixed(1)}KB`)
  assert.equal(st.segments, undefined, 'status 不该带 segments 全量')
  assert.equal(st.annotatedHtml, undefined, 'status 不该带渲染好的正文')
})

await test('开卷复述只记录、不推进进度（门槛不能被绕过）', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.recordDrill(DOC_ID, {
    prompt: '说说三类负荷',
    answer: '内在的是内容自带的，外在的是排版造成的浪费，相关的是用来建图式的努力。',
    rubricHit: ['三类名字全对'],
    verdict: '部分达标',
    minimalAction: '补一个例子',
    // 没传 closedBook → 开卷
  })
  assert.equal(res.record.valid, false, '开卷不算有效复述')
  assert.equal(res.progress.drilled, false, '开卷不该点亮 drilled')
  assert.ok(
    res.record.warnings.some((w) => w.code === 'drill-open-book'),
    '应提示开卷不计入',
  )
  // 但记录本身要留下——这是宝贵的学习痕迹
  assert.equal((await svc.drills(DOC_ID)).length, 1, '记录仍应保存')
})

await test('合书 + 够时长 + 没抄原文 → 才推进到 drilled', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.recordDrill(DOC_ID, {
    prompt: '合上材料说说三类负荷',
    answer: '我的理解是：内容本身难的那部分怎么讲都得花力气；排版乱、图注找不到地方会额外耗掉脑力，是纯浪费；剩下花在建立联系上的那部分才是有用的学习。',
    rubricHit: ['三类名字全对', '来源说对'],
    verdict: '部分达标：三者区别说清了，但没举例',
    minimalAction: '补一个原文之外的例子',
    closedBook: true,
    durationSec: 240,
  })
  assert.equal(res.record.valid, true, `应有效：${JSON.stringify(res.record.warnings)}`)
  assert.equal(res.progress.drilled, true)
  assert.equal(res.record.minutes, 4, '应记下花了多少分钟')
})

await test('几十秒就交的复述被标为太快', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.recordDrill(DOC_ID, {
    answer: '三类负荷就是内在、外在、相关这三种。',
    closedBook: true,
    durationSec: 20,
  })
  assert.equal(res.record.valid, false)
  assert.ok(res.record.warnings.some((w) => w.code === 'drill-too-fast'))
})

await test('把原文复制一遍会被识别为抄录', async () => {
  const svc = new StudyService(workspace)
  const proj = await loadProject(svc)
  // 直接拿几段原文拼起来当"复述"
  const copied = proj.segments.slice(0, 3).map((s) => s.text).join('')
  const res = await svc.recordDrill(DOC_ID, { answer: copied, closedBook: true, durationSec: 300 })
  assert.equal(res.record.valid, false, `抄原文不该算有效：copied=${res.record.copiedRatio}`)
  assert.ok(res.record.warnings.some((w) => w.code === 'drill-copied'), '应识别为抄录')
})

await test('多次考核累积为记录，不覆盖历史', async () => {
  const svc = new StudyService(workspace)
  const before = (await svc.drills(DOC_ID)).length
  await svc.recordDrill(DOC_ID, { answer: '第二次复述：外在负荷＝来回搜索的浪费。' })
  const list = await svc.drills(DOC_ID)
  assert.equal(list.length, before + 1, '新记录应当追加而不是覆盖')
})

/* ---- 复习调度 ---- */

await test('有效考核后登记 1 天后到期，完成复习推进到 3 天', async () => {
  const svc = new StudyService(workspace)
  const meta = await svc.store.meta(DOC_ID)
  assert.ok(meta.review?.dueAt, '有效考核后应登记到期日')
  const days = (Date.parse(meta.review.dueAt) - Date.now()) / 86400000
  assert.ok(days > 0.9 && days < 1.1, `第一次到期应在 1 天后，实际 ${days.toFixed(2)} 天`)

  const r1 = await svc.completeReview(DOC_ID)
  assert.equal(r1.stage, 1)
  assert.equal(r1.intervalDays, 3, '第二次间隔应为 3 天')

  const r2 = await svc.completeReview(DOC_ID)
  assert.equal(r2.intervalDays, 7, '第三次间隔应为 7 天')

  const r3 = await svc.completeReview(DOC_ID)
  assert.equal(r3.intervalDays, 7, '之后维持 7 天')
})

await test('reviewDue 能把到期和未到期的分开', async () => {
  const svc = new StudyService(workspace)
  const r = await svc.reviewDue()
  assert.ok(Array.isArray(r.due) && Array.isArray(r.upcoming), '应返回 due/upcoming 两组')
  const all = [...r.due, ...r.upcoming]
  assert.ok(all.every((i) => i.docId && i.dueAt), '每条都要有 docId 和 dueAt')
  assert.ok(r.due.every((i) => i.isDue === true))
  assert.ok(r.upcoming.every((i) => i.isDue === false))
})

/* ---- 覆盖审计 ---- */

await test('覆盖审计列出没加工的段落（不能只报已标注数）', async () => {
  const svc = new StudyService(workspace)
  const cov = await svc.coverage(DOC_ID)
  assert.ok(cov.total > 0, '要有总段数')
  assert.equal(cov.total, cov.done + cov.skippedCount, '已加工 + 未加工 必须等于总段数')
  assert.ok(Array.isArray(cov.skipped), '要有未加工的段落清单')
  assert.ok(cov.skipped.every((s) => s.id), '每条都要有段落锚点')
  assert.ok(cov.percent >= 0 && cov.percent <= 100, `百分比越界：${cov.percent}`)
  assert.ok(Array.isArray(cov.groups), '要有按小节的聚合')
})

await test('覆盖审计：全部标完后未加工清零', async () => {
  const svc = new StudyService(workspace)
  const proj = await loadProject(svc)
  // 把每段都标上（用很短的两字 quote，避免触发预算）
  const items = proj.segments.map((s, i) => ({
    segmentId: s.id,
    label: ['d', 'e', 'q', 's', 't', 'c', 'v'][i % 7],
    keyword: i % 7 === 5 ? '两字' : undefined,
    title: `要点${i}`,
    quote: s.text.replace(/[*`#>|\s]/g, '').slice(0, 2),
  }))
  await svc.saveAnnotation(DOC_ID, items)
  const cov = await svc.coverage(DOC_ID)
  assert.equal(cov.skippedCount, 0, `应无未加工段落，实际还剩 ${cov.skippedCount}`)
  assert.equal(cov.percent, 100)
})

await test('status().counts.coverage 带分母', async () => {
  const svc = new StudyService(workspace)
  const st = await svc.status(DOC_ID)
  assert.match(st.counts.coverage, /^\d+\/\d+（[\d.]+%）$/, `覆盖率格式应带分母，实际 ${st.counts.coverage}`)
})

/* ---- 需求⑥：原则目录里的学习规律必须真的落到代码里 ---- */

section('9b. 学习规律的实现（原则/ 目录）')

await test('三档注意力预算与七类标签对得上', async () => {
  // 七类标签必须全部有归属，否则标注时会出现"没档位"的角色
  const byLabel = {}
  for (const [tier, def] of Object.entries(rules.ATTENTION_TIERS)) {
    for (const l of def.labels) byLabel[l] = tier
  }
  const all = Object.keys(rules.ROLE_LABELS).sort()
  assert.equal(all.length, 7, `七类标签，实际 ${all.length}`)
  for (const l of all) assert.ok(byLabel[l], `标签 #${l} 没有归到任何档位`)
})

await test('档位预算符合二八法则：核心≤10% 攻坚≤8% 合计≤20%', async () => {
  assert.equal(rules.ATTENTION_TIERS.core.budget, 0.1)
  assert.equal(rules.ATTENTION_TIERS.hard.budget, 0.08)
  assert.equal(rules.ATTENTION_TIERS.ref.budget, null, '参考档不设上限')
  assert.equal(rules.TOTAL_HIGHLIGHT_BUDGET, 0.2)
})

await test('四档掌握度各自有可观察动词', async () => {
  const levels = ['了解', '理解', '掌握', '熟练掌握']
  for (const lv of levels) {
    assert.ok(Array.isArray(rules.MASTERY_LEVELS[lv]), `缺「${lv}」`)
    assert.ok(rules.MASTERY_LEVELS[lv].length >= 3, `「${lv}」的动词太少`)
  }
})

await test('六段式规定的段落标题齐全且顺序固定', async () => {
  // 顺序必须与需求一致：摘要 → 帮助与目标 → 重点难点 → 考核方式与知识点 → 思考题 → 参考资料
  const keys = rules.PREFLIGHT_SECTIONS.map((s) => s.key)
  assert.deepEqual(
    keys,
    ['summary', 'goals', 'difficulty', 'assessment', 'exercises', 'references'],
    `六段顺序不对：${keys.join(' → ')}`,
  )
  for (const s of rules.PREFLIGHT_SECTIONS) {
    assert.equal(s.required, true, `第 ${s.index} 段应标为必需`)
    assert.ok(s.title, `第 ${s.index} 段缺标题`)
  }
})

await test('八种关系类型齐全', async () => {
  assert.equal(Object.keys(rules.RELATION_TYPES).length, 8)
})

/* ------------------------------------------------------------ 9. 汇总 */

section('8. 工具返回值必须是无损 JSON')

await test('校验失败的结果里不含 undefined（否则宿主拒绝回传模型）', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveAnnotation(DOC_ID, [{ segmentId: '¶2', label: 'd', title: 'x' , quote: '关键短语2' }])
  const undefinedPaths = []
  const walk = (value, path) => {
    if (value === undefined) return undefinedPaths.push(path)
    if (value === null || typeof value !== 'object') return
    for (const key of Object.keys(value)) walk(value[key], `${path}.${key}`)
  }
  walk(res, 'root')
  assert.deepEqual(undefinedPaths, [], `存在 undefined：${undefinedPaths.join(', ')}`)
  assert.equal(JSON.parse(JSON.stringify(res)).docId, DOC_ID, 'JSON 往返后应保持完整')
})

await test('预检与关系结果同样无损', async () => {
  const svc = new StudyService(workspace)
  const bad = goodPlan()
  bad.summary = ''
  const r1 = await svc.savePreflight(DOC_ID, bad)
  const r2 = await svc.saveRelations(DOC_ID, { nodes: [{ id: 'a', label: 'A' }], edges: [] })
  for (const [name, value] of [['preflight', r1], ['relations', r2]]) {
    const round = JSON.parse(JSON.stringify(value))
    assert.deepEqual(round, JSON.parse(JSON.stringify(round)), `${name} 不是无损 JSON`)
    assert.ok(!JSON.stringify(value).includes('undefined'), `${name} 序列化后仍出现 undefined 字面量`)
  }
})

/* ------------------------------------------------ 12. 读前建构排版 */

section('9. 读前建构的 HTML 结构（排版不能乱）')
// 编号按执行顺序排：这一组要复用上面还活着的 workspace，所以放在落盘目录被删之前。

// 先单独导一份，避免和前面"超预算被拒"的文档状态纠缠
{
  const svc = new StudyService(workspace)
  // 必须是另一份**内容不同**的资料：同一份正文再导入会复用已有项目（去重），
  // 那样这里就不是"单独导一份"，而是把前面那份的状态搅进来。
  const copy = join(workspace, 'typeset.md')
  await writeFile(
    copy,
    `${await readFile(join(FIXTURES, 'sample.md'), 'utf8')}

排版专用段落：这一份只用来验读前页的 HTML 结构。
`,
    'utf8',
  )
  const r = await svc.ingest(copy, { title: '排版测试' })
  const id = r.docId ?? r.id
  await svc.savePreflight(id, goodPlan())
}

await test('行内模式不产生 <p>', async () => {
  const html = renderMarkdown('**重点**内容\n第二行', { inline: true })
  assert.ok(!html.includes('<p'), '行内模式不应出现 <p>')
  assert.match(html, /<strong>重点<\/strong>/)
})

await test('行内模式把多个段落压成一行', async () => {
  const html = renderMarkdown('第一段\n\n第二段', { inline: true })
  assert.match(html, /第一段 第二段/)
})

await test('读前建构 HTML 里没有非法嵌套的 <p>', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  assert.ok(docId, '应已导入排版测试文档')
  const view = await svc.project(docId)
  const html = view.preflightHtml

  // 标题里不能有块级元素
  const badH3 = html.match(/<h3>[^<]*(<p>|<div>|<ul>|<ol>)/g) ?? []
  assert.equal(badH3.length, 0, `标题内含块级元素：${badH3.join(' ')}`)

  // span / b / i 里不能有块级元素
  const badInline = html.match(/<(span|b|i)\b[^>]*>(?:(?!<\/\1>).)*?<(p|div|ul|ol)\b/gs) ?? []
  assert.equal(badInline.length, 0, `行内标签里套了块级元素：${badInline.slice(0, 3).join(' ')}`)

  // <p> 不能嵌套 <p>
  assert.ok(!/<p\b[^>]*>(?:(?!<\/p>).)*?<p\b/s.test(html), '<p> 不能嵌套 <p>')
})

await test('读前建构各段内容都真的渲染出来了', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  const html = (await svc.project(docId)).preflightHtml
  // 六段必须连续编号出现，③④ 不能缺（早期版本直接插 parts，界面上只看到 1,2,1,2,3,4）
  for (const [n, title] of [
    ['①', '资料摘要'],
    ['②', '对我的帮助与目标'],
    ['③', '每一部分的目标、要求、重点、难点'],
    ['④', '每一部分的考核方式与知识点'],
    ['⑤', '思考题与作业'],
    ['⑥', '参考资料'],
  ]) {
    assert.ok(html.includes(n) && html.includes(title), `缺少第 ${n} 段「${title}」`)
  }
  assert.equal((html.match(/class="sc-pf-sec"/g) ?? []).length, 6, '应正好六段')
  assert.match(html, /class="sc-part"/, '应有分部卡片')
  assert.match(html, /class="sc-kp"/, '应有知识点块')
  assert.match(html, /class="sc-req"/, '应有要求块')
  assert.ok(!/\*\*[^*]+\*\*/.test(html), '不应残留 ** 星号')
})

await test('每段的知识点都出现在 HTML 里（没被吞掉）', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  const html = (await svc.project(docId)).preflightHtml
  const plan = JSON.parse(await readFile(join(workspace, '.study', docId, 'preflight.json'), 'utf8'))
  for (const part of plan.parts ?? []) {
    for (const kp of part.knowledgePoints ?? []) {
      const name = String(kp.name).replace(/[*`]/g, '')
      assert.ok(html.includes(name.slice(0, 6)), `知识点「${name}」没出现在 HTML 里`)
    }
  }
})

/* ------------------------------------------------ 8b. JSONL 数据安全 */

section('9. JSONL 不能被写坏或写少（见 INCIDENT-terms-data-loss.md）')

await test('writeJsonl 写 N 条读回还是 N 条', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  const records = Array.from({ length: 7 }, (_, i) => ({ term: `词${i}`, answer: null, source: 'agent' }))
  await svc.store.writeJsonl(docId, 'probe.jsonl', records)
  const back = await svc.store.jsonl(docId, 'probe.jsonl')
  assert.equal(back.length, 7, `应读回 7 条，实际 ${back.length}`)
  assert.equal(back[3].term, '词3', '内容和顺序都要保住')
})

await test('writeJsonl 写的是每行一条，不是 JSON 数组', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  await svc.store.writeJsonl(docId, 'probe2.jsonl', [{ a: 1 }, { a: 2 }])
  const text = await readFile(join(workspace, '.study', docId, 'probe2.jsonl'), 'utf8')
  assert.ok(!text.trim().startsWith('['), '不能写成 JSON 数组，jsonl 的读法是每行一条')
  assert.equal(text.trim().split('\n').length, 2, '应有 2 行')
})

await test('回填术语答案不会丢掉其他历史记录', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  // 造 5 条历史（4 条已答 + 1 条待答）
  for (let i = 0; i < 4; i += 1) {
    await svc.askTerm(docId, { term: `历史${i}`, segmentId: null, answer: `答案${i}`, source: 'agent' })
  }
  await svc.askTerm(docId, { term: '待答词', segmentId: null, source: 'ui' })

  const before = await svc.store.jsonl(docId, 'terms.jsonl')
  assert.equal(before.length, 5, `起点应是 5 条，实际 ${before.length}`)

  const res = await svc.answerTerm(docId, { term: '待答词', answer: '补上的答案' })
  assert.equal(res.updated, true, JSON.stringify(res))

  const after = await svc.store.jsonl(docId, 'terms.jsonl')
  assert.equal(after.length, 5, `回填后应仍是 5 条（不能丢历史），实际 ${after.length}`)
  assert.ok(after.find((r) => r.term === '待答词')?.answer === '补上的答案', '待答词应被填上答案')
  assert.ok(after.filter((r) => r.term.startsWith('历史')).length === 4, '4 条历史必须还在')
})

await test('pendingTerms 只算界面点出来的，不算历史 Agent 记录', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  await svc.askTerm(docId, { term: '界面待答', segmentId: null, source: 'ui' })
  const pending = await svc.pendingTerms(docId)
  assert.ok(
    pending.every((r) => r.source === 'ui'),
    `待答列表里混进了非界面记录：${pending.map((r) => r.source).join(',')}`,
  )
  assert.ok(pending.some((r) => r.term === '界面待答'), '界面点的那条应出现')
})

await test('术语上下文取第 100 段之后也不会空（read 有 limit 截断）', async () => {
  const svc = new StudyService(workspace)
  const docId = (await svc.list()).find((d) => d.title === '排版测试')?.id
  const segs = await svc.store.segments(docId)
  const last = segs[segs.length - 1]
  const rec = await svc.askTerm(docId, { term: '末段词', segmentId: last.id, source: 'ui' })
  assert.ok(rec.context.length > 0, `${last.id} 的上下文不该是空的（原实现 limit 被截到 100）`)
})

await rm(workspace, { recursive: true, force: true })

/* ------------------------------------------------ 9. Markdown 渲染 */

section('10. Markdown 渲染（界面显示的前提）')

await test('标题/粗体/斜体/行内代码被正确解析', async () => {
  assert.equal(renderMarkdown('### 标题'), '<h3 class="sc-md-h3">标题</h3>')
  assert.match(renderMarkdown('**粗**'), /<strong>粗<\/strong>/)
  assert.match(renderMarkdown('*斜*'), /<em>斜<\/em>/)
  assert.match(renderMarkdown('用 `read_document` 工具'), /<code>read_document<\/code>/)
})

await test('行内代码里的标识符完整保留，不被强调语法吃掉', async () => {
  const html = renderMarkdown('用 `read_document` 工具，再用 `a_b_c` 和 `**x**`')
  assert.match(html, /<code>read_document<\/code>/, 'read_document 应完整')
  assert.match(html, /<code>a_b_c<\/code>/)
  assert.match(html, /<code>\*\*x\*\*<\/code>/, '代码块内的星号应原样保留，不被当成粗体')
  assert.ok(!html.includes('<strong>'), '代码块内不应产生 strong')
  // 首字母不能被占位符吞掉
  assert.ok(!/<code>ead_document/.test(html), '首字母不应丢失')
})

await test('表格渲染成真正的 table（不是一堆竖线）', async () => {
  const md = '| 工具类型 | 作用 |\n|---|---|\n| 感知 | 取信息 |\n| 执行 | 改世界 |'
  const html = renderMarkdown(md)
  assert.match(html, /<table class="sc-table">/)
  assert.match(html, /<th>工具类型<\/th>/)
  assert.equal((html.match(/<tr>/g) ?? []).length, 3, '表头 + 2 数据行')
  assert.ok(!html.includes('|---|'), '分隔行不应出现在输出里')
})

await test('表格对齐方式被识别', async () => {
  const md = '| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |'
  const html = renderMarkdown(md)
  assert.match(html, /style="text-align:left"/)
  assert.match(html, /style="text-align:center"/)
  assert.match(html, /style="text-align:right"/)
})

await test('列表渲染，含嵌套', async () => {
  const md = '- 一级\n  - 二级\n- 另一个'
  const html = renderMarkdown(md)
  assert.match(html, /<ul class="sc-list">/)
  assert.equal((html.match(/<ul>/g) ?? []).length, 1, '内层嵌套 ul 不带 class')
  assert.match(html, /<li>一级<ul><li>二级<\/li><\/ul><\/li>/)
})

await test('有序列表与引用块', async () => {
  const html = renderMarkdown('1. 第一步\n2. 第二步\n\n> **实验 4-5**：某事')
  assert.match(html, /<ol class="sc-list">/)
  assert.match(html, /<blockquote class="sc-quote">/)
  assert.match(html, /<blockquote class="sc-quote"><p><strong>实验 4-5<\/strong>/)
})

await test('图片被解析，相对路径改写成资源路由', async () => {
  const html = renderMarkdown('![图4-1](images/fig4-1.svg)', {
    imageBase: '/study-copilot/api/asset/doc1/',
  })
  assert.match(html, /<img src="\/study-copilot\/api\/asset\/doc1\/images\/fig4-1\.svg"/)
  assert.match(html, /alt="图4-1"/)
  assert.ok(!html.includes('%2F'), '路径分隔符不应被编码成 %2F')
})

await test('外部图片与链接不被改写', async () => {
  const html = renderMarkdown('![a](https://x.com/a.png)', { imageBase: '/base/' })
  assert.match(html, /src="https:\/\/x\.com\/a\.png"/)
})

await test('脚注定义渲染成可读块', async () => {
  const html = renderMarkdown('[^ch4-pi]: Pi Coding Agent, https://github.com/x')
  assert.match(html, /class="sc-footnote"/)
  assert.match(html, /ch4-pi/)
})

await test('代码围栏保留原样内容', async () => {
  const html = renderMarkdown('```js\nconst a = 1 < 2\n```')
  assert.match(html, /<pre class="sc-code" data-lang="js">/)
  assert.match(html, /const a = 1 &lt; 2/, 'HTML 特殊字符必须转义')
})

await test('HTML 注入被转义（资料里夹带 script 也不会执行）', async () => {
  const html = renderMarkdown('<script>alert(1)</script>')
  assert.ok(!html.includes('<script>'), '不应输出可执行 script 标签')
  assert.match(html, /&lt;script&gt;/)
})

await test('javascript: 协议被拦下', async () => {
  const html = renderMarkdown('[点我](javascript:alert(1))')
  assert.ok(!html.includes('javascript:alert'), '危险协议必须被替换')
  assert.match(html, /href="#"/)
})

/* ------------------------------------------------ 10. 图谱布局 */

section('11. 知识图谱布局（可视化检查）')

const sampleGraph = `graph TD
  a["起点概念"]
  b["中间概念"]
  c["终点概念"]
  d["旁支概念"]
  a -->|prerequisite| b
  b -->|prerequisite| c
  a -->|cause| c
  a -.->|contrast| d`

await test('Mermaid 被解析成节点与边', async () => {
  const parsed = parseMermaid(sampleGraph)
  // 样例显式声明 4 个节点（a/b/c/d），4 条边（含一条虚线对比边）
  assert.equal(parsed.nodes.length, 4)
  assert.equal(parsed.edges.length, 4)
  assert.equal(parsed.direction, 'TD')
  const dashed = parsed.edges.filter((e) => e.dashed)
  assert.equal(dashed.length, 1, '虚线边应被识别为 dashed')
  assert.equal(dashed[0].from, 'a')
  assert.equal(dashed[0].to, 'd')
})

await test('按前置关系分层，层级递增', async () => {
  const g = layoutGraph(sampleGraph)
  const layerOf = new Map(g.nodes.map((n) => [n.id, n.layer]))
  assert.ok(layerOf.get('a') < layerOf.get('b'), 'a 应在 b 之前')
  assert.ok(layerOf.get('b') < layerOf.get('c'), 'b 应在 c 之前')
})

await test('节点不重叠', async () => {
  const g = layoutGraph(sampleGraph)
  for (let i = 0; i < g.nodes.length; i += 1) {
    for (let k = i + 1; k < g.nodes.length; k += 1) {
      const p = g.nodes[i]
      const q = g.nodes[k]
      const overlap = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
      assert.ok(!overlap, `${p.id} 与 ${q.id} 重叠`)
    }
  }
})

await test('节点宽度随标签自适应（长标签不被裁切）', async () => {
  const short = layoutGraph('graph TD\n  a["短"]')
  const long = layoutGraph('graph TD\n  a["这是一个相当长的一个知识点标签用来测试宽度"]')
  assert.ok(long.nodes[0].w > short.nodes[0].w, '长标签应得到更宽的节点')
  assert.ok(long.nodes[0].w <= 260, '但不超过上限')
})

await test('每条边都有折线拐点，且都在画布内', async () => {
  const g = layoutGraph(sampleGraph)
  for (const e of g.edges) {
    assert.ok(Array.isArray(e.points) && e.points.length >= 2, `${e.from}->${e.to} 缺少 points`)
    for (const [x, y] of e.points) {
      assert.ok(x >= -2 && x <= g.width + 2, `x=${x} 超出画布 ${g.width}`)
      assert.ok(y >= -2 && y <= g.height + 2, `y=${y} 超出画布 ${g.height}`)
    }
  }
})

await test('走线不穿过无关节点', async () => {
  const g = layoutGraph(sampleGraph)
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  for (const e of g.edges) {
    const pts = []
    for (let k = 1; k < e.points.length; k += 1) {
      const [x1, y1] = e.points[k - 1]
      const [x2, y2] = e.points[k]
      for (let t = 0; t <= 1; t += 0.05) pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t])
    }
    for (const n of g.nodes) {
      if (n.id === e.from || n.id === e.to) continue
      const hit = pts.some(([x, y]) => x >= n.x + 5 && x <= n.x + n.w - 5 && y >= n.y + 5 && y <= n.y + n.h - 5)
      assert.ok(!hit, `${e.from}->${e.to} 穿过 ${byId.get(n.id).label}`)
    }
  }
})

await test('成环的图也能布局（不死循环）', async () => {
  const g = layoutGraph('graph TD\n  a["A"]\n  b["B"]\n  a --> b\n  b --> a')
  assert.equal(g.nodes.length, 2)
  assert.ok(Number.isFinite(g.width) && g.width > 0)
})

await test('空图返回空布局而不是报错', async () => {
  const g = layoutGraph('graph TD')
  assert.equal(g.nodes.length, 0)
  assert.equal(g.edges.length, 0)
})

/* ------------------------------------------------ 11. 工作区定位 */

section('12. 工作区定位（用户填的路径五花八门）')

const wsWs = await mkdtemp(join(tmpdir(), 'sc-ws-'))
// 造一个真实的工作区：<root>/.study/<doc>/meta.json
const wsRoot = join(wsWs, 'proj')
const wsDeep = join(wsRoot, '资料', 'book')
await mkdir(join(wsDeep), { recursive: true })
await mkdir(join(wsRoot, '.study', 'd1'), { recursive: true })
await writeFile(join(wsRoot, '.study', 'd1', 'meta.json'), JSON.stringify({ id: 'd1', title: 'T' }), 'utf8')
const someFile = join(wsDeep, 'chapter4.md')
await writeFile(someFile, '# 标题', 'utf8')

await test('填资料文件路径 → 向上找到工作区', async () => {
  assert.equal(findWorkspaceRoot(someFile), wsRoot)
})

await test('填深层子目录 → 向上找到工作区', async () => {
  assert.equal(findWorkspaceRoot(wsDeep), wsRoot)
})

await test('填工作区本身 → 原样返回', async () => {
  assert.equal(findWorkspaceRoot(wsRoot), wsRoot)
})

await test('正斜杠写法也能认', async () => {
  assert.equal(findWorkspaceRoot(wsRoot.replace(/\\/g, '/')), wsRoot)
})

await test('完全没有 .study 的路径返回 null（不瞎猜）', async () => {
  assert.equal(findWorkspaceRoot(join(wsWs, 'nowhere')), null)
  assert.equal(findWorkspaceRoot(''), null)
})

await test('向下搜索能发现 .study', async () => {
  const found = findWorkspaceRoots([wsWs], 5)
  assert.ok(found.includes(wsRoot), `应找到 ${wsRoot}，实际 ${JSON.stringify(found)}`)
})

await rm(wsWs, { recursive: true, force: true })


/* ------------------------------------------- 13. 三色高亮落在原文短语上 */

section('13. 三色高亮：加粗原文短语，而不是整段变色')

await test('quote 命中时高亮落在原文位置', () => {
  const segs = [
    { id: '¶1', chars: 40, text: '默认取向是通用优于专用，只在四种情况下退回专用工具。' },
  ]
  const html = rules.renderAnnotatedHtml(segs, {
    items: [{ segmentId: '¶1', label: 's', tier: 'core', title: '通用优先', quote: '通用优于专用' }],
  })
  assert.ok(html.includes('<strong class="sc-hl-core">通用优于专用</strong>'), html)
  // 段落容器本身不带高亮 class，否则整段变色
  assert.ok(!/class="sc-seg sc-hl/.test(html), '段落不应整体变色')
})

await test('quote 不在原文时校验报 quote-not-found', () => {
  const segs = [{ id: '¶1', chars: 20, text: '原始文字' }]
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'd', title: 't', quote: '不存在的片段' }], {
    segments: segs,
    totalChars: 20,
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'quote-not-found'), JSON.stringify(r.issues))
})

await test('缺 quote 被拒（不允许整段标注）', () => {
  const segs = [{ id: '¶1', chars: 20, text: '原始文字' }]
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'd', title: 't' }], {
    segments: segs,
    totalChars: 20,
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'no-quote'))
})

await test('预算按 quote 字数算，不按整段字数', () => {
  // 10 段 × 100 字 = 1000 字。核心档上限 10% = 100 字。
  // quote 各 8 字 × 3 段 = 24 字 = 2.4%，远低于上限 → 应通过。
  const segs = Array.from({ length: 10 }, (_, i) => ({
    id: `¶${i + 1}`,
    chars: 100,
    text: `前文${'填'.repeat(46)}关键短语${i + 1}${'填'.repeat(46)}`,
  }))
  const items = [0, 1, 2].map((i) => ({
    segmentId: `¶${i + 1}`,
    label: 'd',
    title: 'x',
    quote: `关键短语${i + 1}`,
  }))
  const r = rules.validateAnnotation(items, { segments: segs, totalChars: 1000 })
  assert.ok(r.ok, `按片段算应当通过：${JSON.stringify(r.issues)}`)
  // 「关键短语N」每个 5 字（关键短语=4 + 数字=1），3 段共 15 字
  assert.equal(r.stats.highlightedChars, 15)
})

await test('标题行里的 quote 也能高亮', () => {
  const segs = [{ id: '¶1', chars: 20, text: '## 三种负荷的区分' }]
  const html = rules.renderAnnotatedHtml(segs, {
    items: [{ segmentId: '¶1', label: 'd', tier: 'core', title: '小结', quote: '三种负荷' }],
  })
  assert.ok(html.includes('<strong class="sc-hl-core">三种负荷</strong>'), html)
})

await test('HTML 特殊字符先转义再高亮，不会注入', () => {
  const segs = [{ id: '¶1', chars: 20, text: '用 <script> 攻击 & 测试' }]
  const html = rules.renderAnnotatedHtml(segs, {
    items: [{ segmentId: '¶1', label: 'd', tier: 'core', title: 't', quote: '<script>' }],
  })
  assert.ok(!html.includes('<script>'), '未转义，存在注入风险')
  assert.ok(html.includes('&lt;script&gt;'), html)
})

/* --------------------------------------------------- 14. QA 自测问答 */

section('14. QA 自测问答（每条 ≤100 字）')

await test('合法 QA 落盘并可读回', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveQa(DOC_ID, [
    { q: '三种负荷分别来自哪里？', a: '内在来自材料复杂度，外在来自设计不当，相关来自学习者的加工努力。' },
  ])
  assert.equal(res.accepted, true, JSON.stringify(res.issues))
  assert.equal(res.count, 1)
  const back = await svc.qa(DOC_ID)
  assert.equal(back.length, 1)
  assert.match(back[0].q, /三种负荷/)
})

await test('问题超 100 字被拒', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveQa(DOC_ID, [{ q: '问'.repeat(101), a: '答' }])
  assert.equal(res.accepted, false)
  assert.ok(res.issues.some((i) => i.code === 'qa-question-too-long'))
})

await test('回答超 100 字被拒', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveQa(DOC_ID, [{ q: '问题', a: '答'.repeat(101) }])
  assert.equal(res.accepted, false)
  assert.ok(res.issues.some((i) => i.code === 'qa-answer-too-long'))
})

await test('空 QA 列表被拒', async () => {
  const svc = new StudyService(workspace)
  await assert.rejects(() => svc.saveQa(DOC_ID, []), /QA 为空/)
})

/* ------------------------------------ 15. 参考资料标注来源类型 */

section('15. 参考资料区分来源')

await test('refs 按「原文 / 联网检索 / 我的知识」分组', () => {
  const svc = new StudyService(workspace)
  const md = svc.renderRefs([
    { title: '原始讲义', source: '原文', kind: 'pdf' },
    { title: 'Sweller 1988', source: '联网检索', url: 'https://example.com/a' },
    { title: '我记忆里的定义', source: '我的知识' },
  ])
  assert.match(md, /## 原文/)
  assert.match(md, /## 联网检索/)
  assert.match(md, /## 我的知识/)
  assert.match(md, /https:\/\/example\.com\/a/)
})

await test('未标来源的条目归入「我的知识」而不是无声丢弃', () => {
  const svc = new StudyService(workspace)
  const md = svc.renderRefs([{ title: '某本书' }])
  assert.match(md, /## 我的知识/)
  assert.match(md, /某本书/)
})

/* --------------------------------- 16. archify 拆图与生成 */

section('16. 知识点逻辑图交给 archify')

await test('大图按根节点拆成多张可读规模的小图', () => {
  // 造一条 40 节点的长链，必须被拆开，否则画布超宽、字号被判定不可读
  const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, label: `知识点${i}` }))
  const edges = Array.from({ length: 39 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}`, relation: 'prerequisite' }))
  const groups = splitGraph({ nodes, edges }, 18)
  assert.ok(groups.length > 1, `应拆成多张，实际 ${groups.length}`)
  for (const g of groups) assert.ok(g.nodes.length <= 18, `单张不应超过 18 节点，实际 ${g.nodes.length}`)
  // 所有节点都被分到，不丢
  const total = groups.reduce((a, g) => a + g.nodes.length, 0)
  assert.equal(total, 40)
})

await test('拆图保留组内关系，不产生悬空边', () => {
  const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, label: `K${i}` }))
  const edges = Array.from({ length: 29 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}`, relation: 'prerequisite' }))
  const groups = splitGraph({ nodes, edges }, 10)
  for (const g of groups) {
    const ids = new Set(g.nodes.map((n) => n.id))
    for (const e of g.edges) {
      assert.ok(ids.has(e.from) && ids.has(e.to), `悬空边 ${e.from}->${e.to}`)
    }
  }
})

await test('archify 能把关系图生成为可打开的 HTML', async () => {
  const rel = {
    nodes: [
      { id: 'a', label: '内在负荷', kind: 'concept' },
      { id: 'b', label: '外在负荷', kind: 'concept' },
      { id: 'c', label: '降低外在负荷', kind: 'method' },
    ],
    edges: [
      { from: 'a', to: 'c', relation: 'prerequisite' },
      { from: 'b', to: 'c', relation: 'prerequisite' },
    ],
  }
  const dir = await mkdtemp(join(tmpdir(), 'arch-'))
  const r = await buildArchifyFigures(rel, { workDir: dir, outDir: dir, docTitle: '测试图' })
  assert.ok(r.cli, '没找到 archify CLI')
  assert.ok(r.figures.length >= 1)
  const made = r.figures.filter((f) => f.produced)
  assert.ok(made.length >= 1, `未产出 HTML：${JSON.stringify(r.figures)}`)
  const html = await readFile(join(dir, made[0].file), 'utf8')
  assert.ok(html.length > 10000, `HTML 太小，可能是空壳：${html.length}`)
  assert.match(html, /内在负荷/, '图里应包含节点标签')
  await rm(dir, { recursive: true, force: true })
})

await test('保存关系图后 project() 能拿到 archify 图列表', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveRelations(DOC_ID, {
    nodes: [
      { id: 'x', label: '节点甲' },
      { id: 'y', label: '节点乙' },
    ],
    edges: [{ id: 'e1', from: 'x', to: 'y', relation: 'prerequisite', quote: '甲在乙之前' }],
    relationReview: reviewOf({ prerequisite: ['e1'] }),
  })
  assert.ok(res.check.ok, JSON.stringify(res.check.issues))
  assert.ok(res.figures, '保存结果里应带 figures')
  const proj = await svc.project(DOC_ID)
  assert.ok(Array.isArray(proj.figures), 'project() 应返回 figures 数组')
  if (proj.figures.length) {
    assert.match(proj.figures[0].url, /graph-\d+\.html$/, `url 形状不对：${proj.figures[0].url}`)
  }
})

/* ---- 第一性原理：反完成主义 ---- */

section('17. 反完成主义（原则/反完成主义阅读、深度阅读的二八法则）')

await test('碎片 quote 被判出，完整判断句放行', async () => {
  // 「维度」这种标了等于没标：覆盖率好看，用户读不到东西。
  const frag = rules.validateAnnotation(
    [{ segmentId: '¶1', label: 'd', tier: 'core', quote: '维度', title: '表格' }],
    { totalChars: 1000, segments: [{ id: '¶1', chars: 200, text: '这是一段两百字的正文，里面写了维度以及其他很多东西，足够长到可以挑出一句完整的判断。' }] },
  )
  assert.ok(
    frag.issues.some((i) => i.code === 'quote-fragment'),
    '短 quote 应判 quote-fragment',
  )
  const good = rules.validateAnnotation(
    [{ segmentId: '¶1', label: 'd', tier: 'core', quote: '这是一段两百字的正文', title: '示例' }],
    { totalChars: 1000, segments: [{ id: '¶1', chars: 200, text: '这是一段两百字的正文，里面写了维度以及其他很多东西，足够长到可以挑出一句完整的判断。' }] },
  )
  assert.ok(
    !good.issues.some((i) => i.code === 'quote-fragment'),
    '完整判断句不应被判碎片',
  )
})

await test('纯标题段不判碎片', async () => {
  // 标题本身就是几个字，标标题是正确做法，判碎片会逼 Agent 去标正文。
  const res = rules.validateAnnotation(
    [{ segmentId: '¶1', label: 'c', tier: 'ref', quote: '执行工具', title: '执行工具', keyword: '小节' }],
    { totalChars: 1000, segments: [{ id: '¶1', chars: 10, text: '## 执行工具' }] },
  )
  assert.ok(
    !res.issues.some((i) => i.code === 'quote-fragment'),
    '标题段不该判碎片',
  )
})

await test('短段落不判 quote-too-long', async () => {
  // 段长 30 字、quote 28 字，比例 93%，但这一段只有一个信息点，没法更短。
  const res = rules.validateAnnotation(
    [{ segmentId: '¶1', label: 's', tier: 'core', quote: '执行工具的安全不应依赖单一机制', title: '分层防护' }],
    { totalChars: 1000, segments: [{ id: '¶1', chars: 30, text: '执行工具的安全不应依赖单一机制，而应构建多层防护体系。' }] },
  )
  assert.ok(
    !res.issues.some((i) => i.code === 'quote-too-long'),
    '短段落不该被判整段加粗',
  )
})

await test('成果口径不含百分比，且四个桶都数得到', async () => {
  const svc = new StudyService(workspace)
  const hv = await svc.harvested(DOC_ID)
  assert.ok(!/%/.test(hv.summary), `成果文案不该出现百分比：${hv.summary}`)
  for (const k of ['keyPoints', 'selfTests', 'actions', 'terms']) {
    assert.equal(typeof hv[k], 'number', `${k} 应是数字`)
  }
  assert.ok(hv.summary.length > 0, '成果文案不能是空的')
})

await test('没有任何成果时给的是引导而不是 0%', async () => {
  const svc = new StudyService(workspace)
  const sentence = svc.harvestSentence({ core: 0, qa: 0, actions: 0, terms: 0 })
  assert.ok(!/%|0 /.test(sentence), `空状态不该出现百分比或 0：${sentence}`)
  assert.match(sentence, /先读一段|还没/, `空状态应是引导语气：${sentence}`)
})

section('18. 单元骨架（借鉴 learn-from-materials 的内容组织）')

/**
 * 单元数据在测试里现场造，不读 .study/ 里的真实文件。
 * 理由：单元切分是 study_save 之外的一次性生成步骤，
 * 让它成为测试的隐含依赖，会让测试在别的机器上莫名失败。
 *
 * 但"真实数据切得对不对"必须验 —— 那部分放在 build-units.mjs 的自校验里
 * （不重不漏、无空单元、有原文范围），生成时就已经断言过了。
 */
const unitsFixture = {
  totalUnits: 3,
  totalSegments: 6,
  units: [
    { id: '¶1', title: '甲块', segmentIds: ['¶1', '¶2'], segmentCount: 2, chars: 400, keyPoints: [], sourceRange: { from: '¶1', to: '¶2' } },
    { id: '¶3', title: '乙块', segmentIds: ['¶3', '¶4'], segmentCount: 2, chars: 600, keyPoints: [], sourceRange: { from: '¶3', to: '¶4' } },
    { id: '¶5', title: '丙块', segmentIds: ['¶5', '¶6'], segmentCount: 2, chars: 500, keyPoints: [], sourceRange: { from: '¶5', to: '¶6' } },
  ],
}

await test('单元清单能读出来，且每个单元带原文范围', async () => {
  const store = { artifact: async (id, name) => (name === 'units.json' ? unitsFixture : null) }
  const svc = new StudyService(tmpdir())
  svc.store = store
  const u = await svc.units(DOC_ID)
  assert.ok(u, 'units.json 存在时应返回数据')
  assert.equal(u.totalUnits, 3)
  for (const x of u.units) {
    assert.ok(x.sourceRange?.from && x.sourceRange?.to, `单元「${x.title}」没有原文范围`)
  }
})

await test('没有 units.json 时返回 null，不抛错', async () => {
  // 老项目不该因为缺这个文件而 500
  const store = { artifact: async () => null }
  const svc = new StudyService(tmpdir())
  svc.store = store
  const u = await svc.units(DOC_ID)
  assert.equal(u, null, '缺文件应返回 null')
})

await test('单元清单不重不漏', async () => {
  // 漏了用户找不到那段，重了进度会算两次
  const flat = unitsFixture.units.flatMap((x) => x.segmentIds)
  assert.equal(new Set(flat).size, flat.length, '有段被多个单元收进去')
  assert.equal(flat.length, unitsFixture.totalSegments, '有段不属于任何单元')
})

section('19. 费曼三门闸的判定（真实调用 recordDrill）')

/**
 * 这块测的是"闸门开得对不对"，不是"能不能存进去"。
 *
 * 背景：真实项目里 drills.jsonl 一直是 0 条 —— 这条路径从没被走过。
 * 三道闸（必须闭卷 / 至少 60 秒 / 不许抄）很容易把所有用户都挡在外面，
 * 挡多了功能就等于不存在。所以四种典型行为都要有明确结论。
 */
const ORIGINAL_TEXT =
  '执行工具的安全不应依赖单一机制，而应构建多层防护体系。第一层是输入验证——在执行任何操作之前，检查所有参数的合法性：文件路径是否存在路径遍历攻击。在此之上是权限控制。'

/**
 * 用真实 workspace 让抄录检测能读到真实原文，只把写入与进度换成假的。
 *
 * 如果连 artifact 也 mock 掉，抄原文的检测就永远不会触发 ——
 * 那这条测试等于在测一个空实现，永远绿。
 */
const REAL_WS = 'D:/learn'
const FIXTURE_DOC = 'chapter4-d6eaed'

function drillSvc() {
  const svc = new StudyService(REAL_WS)
  const real = svc.store
  svc.store = Object.create(real)
  svc.store.appendJsonl = async () => {}
  svc.store.saveMeta = async () => {}
  svc.store.progressOf = async () => ({ stage: 'annotated' })
  svc.store.meta = async () => ({ stage: 'annotated' })
  return svc
}

await test('认真闭卷复述 → 计入', async () => {
  const r = await drillSvc().recordDrill(FIXTURE_DOC, {
    prompt: '讲清执行工具的三层防护',
    answer:
      '执行工具能改外部世界，所以安全不能只有一道关。先验参数把路径穿越挡掉，再限权限只能碰指定目录，最后对不可逆操作加独立审查，一个模型提议另一个批准。三层叠起来，单点失效不会直接造成事故。',
    closedBook: true,
    durationSec: 180,
    rubricHit: ['参数验证', '权限控制', '独立审查'],
    verdict: '达标',
  })
  assert.equal(r.record.valid, true, '认真复述应计入')
})

await test('开卷 → 记录但不计入，并说明原因', async () => {
  const r = await drillSvc().recordDrill(FIXTURE_DOC, {
    answer: '执行工具要安全，要验证参数、控制权限、加独立审查。',
    closedBook: false,
    durationSec: 200,
    verdict: '部分达标',
  })
  assert.equal(r.record.valid, false, '开卷不该计入')
  assert.ok(
    r.record.warnings.some((w) => w.code === 'drill-open-book'),
    '要明说是因为开卷，否则用户不知道下次怎么改',
  )
})

await test('十秒随手打两行 → 记录但不计入', async () => {
  const r = await drillSvc().recordDrill(FIXTURE_DOC, {
    answer: '就讲了执行工具要安全。',
    closedBook: true,
    durationSec: 10,
    verdict: '未达标',
  })
  assert.equal(r.record.valid, false, '太快不该计入')
  assert.ok(
    r.record.warnings.some((w) => w.code === 'drill-too-fast'),
    '要明说是因为太快',
  )
})

await test('闭卷但真的抄原文 → 判为抄', async () => {
  const r = await drillSvc().recordDrill(FIXTURE_DOC, {
    answer: ORIGINAL_TEXT,
    closedBook: true,
    durationSec: 150,
    verdict: '达标',
  })
  assert.equal(r.record.valid, false, '抄原文不该计入')
  assert.ok(
    r.record.warnings.some((w) => w.code === 'drill-copied') || r.record.copiedRatio > 0,
    `抄原文应被识别，实际 copiedRatio=${r.record.copiedRatio}`,
  )
})

await test('每条复述都带可改进的依据', async () => {
  // 界面要把"为什么没计入"显示出来；记录里没有 warnings 就显示不出来
  const r = await drillSvc().recordDrill(FIXTURE_DOC, {
    answer: '太短',
    closedBook: false,
    durationSec: 5,
    verdict: '未达标',
  })
  assert.ok(Array.isArray(r.record.warnings), 'warnings 应是数组')
  assert.ok(r.record.warnings.length > 0, '被拦下时必须给原因')
  assert.ok(
    r.record.warnings.every((w) => w.message && w.message.length > 8),
    '原因要是一句人话，不能只有错误码',
  )
})

section('20. 阶段只有唯一真相（stage 必须由 progress 推导）')

/**
 * 踩过：meta.json 里存着 stage:"drilled"，但 drills.jsonl 是空的。
 * 于是列表显示"已考核"，下一句却提示"去做读后考核"。
 * 两份数据各自为真，界面必然自相矛盾。
 */
const { stageFromProgress } = await import(`file://${join(LIB, 'store.js')}`)
const { StudyStore } = await import(`file://${join(LIB, 'store.js')}`)
const { nextStepOf } = await import(`file://${join(LIB, 'service.js')}`)

await test('stageFromProgress 七个阶段都对', async () => {
  const cases = [
    [{ ingested: false }, 'empty'],
    [{ ingested: true, planned: false }, 'ingested'],
    [{ ingested: true, planned: true, annotated: false }, 'planned'],
    [{ ingested: true, planned: true, annotated: true, mapped: false }, 'annotated'],
    [{ ingested: true, planned: true, annotated: true, mapped: true, recalled: false }, 'mapped'],
    [{ ingested: true, planned: true, annotated: true, mapped: true, recalled: true, drilled: false }, 'recalled'],
    [{ ingested: true, planned: true, annotated: true, mapped: true, recalled: true, drilled: true }, 'done'],
  ]
  for (const [p, want] of cases) {
    assert.equal(stageFromProgress(p), want, `${JSON.stringify(p)} 应推导为 ${want}`)
  }
})

await test('nextStepOf 的 stage 与 stageFromProgress 完全一致', async () => {
  // 这两处若各算一套，就会出现"列表说 A、提示说 B"
  const combos = []
  for (const planned of [false, true]) {
    for (const annotated of [false, true]) {
      for (const mapped of [false, true]) {
        for (const recalled of [false, true]) {
          for (const drilled of [false, true]) {
            combos.push({ ingested: true, planned, annotated, mapped, recalled, drilled })
          }
        }
      }
    }
  }
  for (const p of combos) {
    const want = stageFromProgress(p)
    const got = nextStepOf(p).stage
    assert.equal(got, want, `${JSON.stringify(p)}：nextStepOf 给 ${got}，推导应为 ${want}`)
  }
})

await test('done 阶段不该再给出下一个动作', async () => {
  const p = { ingested: true, planned: true, annotated: true, mapped: true, recalled: true, drilled: true }
  const n = nextStepOf(p)
  assert.equal(n.stage, 'done')
  assert.equal(n.action, null, '流程走完了还在推动作，用户会以为没做完')
})

/* ---------------------------------------------------------------- 轻路径
 *
 * 五段流程按顺序走完才有资格做费曼复述 —— 但那次复述才是唯一
 * 真正改变行为的事。实测三份资料两份都停在 recalled，一次复述都没做。
 * 所以 recommendFrom 在"主推荐"之外还要给一个"轻的那一步"。
 */
const { recommendFrom } = await import(`file://${join(LIB, 'service.js')}`)

await test('一标完核心要点就该看到「也可以直接去讲」', async () => {
  const r = recommendFrom({ ingested: 1, planned: 1, annotated: 1, keyPointCount: 3 })
  assert.equal(r.main.action, 'study-map', '主推荐还是按顺序走')
  assert.ok(r.light, '什么都没标完就让人合书复述是折磨；但标出核心要点之后就该给这条路')
  assert.equal(r.light.action, 'study-feynman')
})

await test('还没拿到任何东西时不推轻路径', async () => {
  const r = recommendFrom({ ingested: 1, planned: 1 })
  assert.equal(r.light, null, '一段都没读就让合书复述，只会让人放弃')
})

await test('轻路径不与主推荐重复', async () => {
  // 主推荐本来就是考核时，再推荐一遍等于把同一句话说两次
  const r = recommendFrom({ ingested: 1, planned: 1, annotated: 1, mapped: 1, recalled: 1, qaCount: 8 })
  assert.equal(r.main.action, 'study-feynman')
  assert.equal(r.light, null)
})

await test('已经考核过就不再推轻路径', async () => {
  const r = recommendFrom({ ingested: 1, planned: 1, annotated: 1, mapped: 1, recalled: 1, drilled: 1, keyPointCount: 5 })
  assert.equal(r.light, null, '做过一次有效复述了，别再催')
})

await test('/projects 的每一项都必须同时有 next 和 light 字段', async () => {
  // 布局要求：recommendFrom 返回 { main, light }，
  // 曾直接 { ...recommendFrom() } 展开，字段名变成 main，
  // 界面读 next 全是空 —— 而且没有任何报错。
  const WS = process.env.STUDY_WS || 'D:\\learn'
  const svc = new StudyService(WS)
  const items = await svc.list().catch(() => [])
  for (const it of items) {
    assert.ok('next' in it, `${it.title || it.id} 没有 next 字段，界面会显示空白提示`)
    assert.ok('light' in it, `${it.title || it.id} 没有 light 字段`)
    assert.ok(it.next && typeof it.next === 'object', 'next 必须是对象')
  }
})

await test('列表的 stage 不信 meta 里的陈旧值', async () => {
  // 造一个 meta.stage 写错、但没有任何产物的项目，看列表怎么报
  const ws = await mkdtemp(join(tmpdir(), 'study-stage-'))
  const store = new StudyStore(ws)
  const docId = 'x-fake'
  await store.saveMeta(docId, { title: 'x', stage: 'drilled' }) // 故意写"已完成"
  const list = await store.list()
  const row = list.find((r) => r.id === docId)
  assert.ok(row, '应该列出这个项目')
  assert.notEqual(row.stage, 'drilled', 'meta 说已考核，但没有任何产物，不能信')
  assert.equal(row.stage, 'empty', `实际推导为 ${row.stage}`)
  await rm(ws, { recursive: true, force: true })
})

/* ------------------------------------------------------------------ 预览
 *
 * 入口之后的第一个问题不是"该怎么读"，而是"要不要读"。
 * peek 只用已有产物拼出三样东西：结构、成本、三句原话。
 *
 * 这一组是为了守住三个已经踩过的坑 —— 它们都不会报错，只会让预览悄悄变空：
 *   1. 单元的 id 只指向标题段，正文在 segmentIds 里（否则抓手全是 null）
 *   2. 没有 units.json 时 list 是空数组，list.length-1 = -1，循环不执行
 *   3. 一次失败的编辑曾把 pick 的函数体插进了句子中间（语法能过，行为全错）
 */
await test('peek：抓手不能是空的，也不能指错段', async () => {
  const ws = await mkdtemp(join(tmpdir(), 'study-peek-'))
  const store = new StudyStore(ws)
  await store.ensure()
  const docId = 'p1'
  await store.saveMeta(docId, { title: '测试文章', chars: 120, segmentCount: 4 })
  await store.writeArtifact(docId, 'segment-texts.json', {
    items: [
      { id: '¶1', text: '# 测试文章' },
      { id: '¶2', text: '这是第一段真正有内容的正文，用来当开头的抓手。' },
      { id: '¶3', text: '中间这段是空的标题行。' },
      { id: '¶4', text: '这是最后一段正文，应该被当成结尾的抓手。' },
    ],
  })
  const svc = new StudyService(ws)
  const p = await svc.peek(docId)
  assert.ok(p, 'peek 不该返回 null')
  assert.ok(p.hooks.start, '开头抓手不能为空')
  assert.ok(p.hooks.end, '结尾抓手不能为空')
  assert.equal(p.hooks.start.segId, '¶2', `开头该是 ¶2，实际 ${p.hooks.start.segId}`)
  assert.equal(p.hooks.end.segId, '¶4', `结尾该是 ¶4，实际 ${p.hooks.end.segId}`)
  assert.notEqual(p.hooks.start.text, p.hooks.end.text, '开头和结尾不能是同一句')
  // 标题行不能被抓成正文
  assert.ok(!p.hooks.start.text.startsWith('#'), '标题行不是正文')
  await rm(ws, { recursive: true, force: true })
})

await test('peek：没有切过块的小资料也要给出目录', async () => {
  const ws = await mkdtemp(join(tmpdir(), 'study-peek2-'))
  const store = new StudyStore(ws)
  await store.ensure()
  const docId = 'p2'
  await store.saveMeta(docId, { title: '小笔记', chars: 80, segmentCount: 3 })
  await store.writeArtifact(docId, 'segment-texts.json', {
    items: [
      { id: '¶1', text: '## 第一小节' },
      { id: '¶2', text: '正文内容在这里，长度够当抓手。' },
      { id: '¶3', text: '## 第二小节' },
    ],
  })
  const svc = new StudyService(ws)
  const p = await svc.peek(docId)
  assert.equal(p.outline.length, 2, `该从段落里认出 2 个标题，实际 ${p.outline.length}`)
  assert.equal(p.outline[0].title, '第一小节')
  assert.ok(p.unitCount >= 1, '不能报 0 块')
  await rm(ws, { recursive: true, force: true })
})

await test('peek：资料不存在时返回 null 而不是抛错', async () => {
  const ws = await mkdtemp(join(tmpdir(), 'study-peek3-'))
  const svc = new StudyService(ws)
  const p = await svc.peek('never-existed')
  assert.equal(p, null)
  await rm(ws, { recursive: true, force: true })
})

/* -------------------------------------------------------------- 标注来源
 *
 * `annotated` 只看有没有标注条目，于是脚本批量回填出来的 182 条
 * 也点亮了"读中完成"。chapter4 的 annotations.json 自己就写着
 * "quote 由脚本从原文机械回填" —— 系统明知这些是机械产物，
 * 却仍然对外说这一段读完了。
 *
 * 不改判定（那会让老项目从"已完成"掉回"没读"，而"读过"无法被机器验证），
 * 但必须把来源如实报出来。
 */
await test('机械回填的标注不能被当成"逐段判读"', async () => {
  const svc = new StudyService(tmpdir())
  const p = svc.provenanceOf({
    items: [{ segmentId: '¶1' }],
    backfillNote: 'quote 由脚本从原文机械回填，建议让模型重新精标',
  })
  assert.equal(p.kind, 'backfilled')
  assert.equal(p.reliable, false, '回填出来的标注不能标成可信')
  assert.ok(p.advice, '要给出可执行的下一步')
})

await test('机械摘取的 quote 也要标出来', async () => {
  const svc = new StudyService(tmpdir())
  const p = svc.provenanceOf({
    items: [{ segmentId: '¶1' }],
    issues: [{ code: 'mechanical-quote', level: 'warn', message: 'x' }],
  })
  assert.equal(p.kind, 'mechanical')
  assert.equal(p.reliable, false)
})

await test('人工逐段判读的标注才是可信的', async () => {
  const svc = new StudyService(tmpdir())
  const p = svc.provenanceOf({ items: [{ segmentId: '¶1', quote: 'q' }], issues: [] })
  assert.equal(p.kind, 'judged')
  assert.equal(p.reliable, true)
})

await test('没有标注时不说"可信"也不说"不可信"', async () => {
  const svc = new StudyService(tmpdir())
  const p = svc.provenanceOf(null)
  assert.equal(p.kind, 'none')
  assert.equal(p.reliable, false)
})

/* ------------------------------------------------------------- 图的分组
 *
 * 旧实现有两个被实测抓到的错误：同一个节点出现在多张图里（chapter4 有 9 个
 * 节点跨 2~3 张图），以及 2 节点 0 条边的碎片图。
 */
await test('每个节点只属于一张图', async () => {
  const graph = {
    nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id })),
    edges: [
      { from: 'a', to: 'b', relation: 'prerequisite' },
      { from: 'a', to: 'c', relation: 'prerequisite' },
      { from: 'b', to: 'd', relation: 'prerequisite' },
    ],
  }
  const groups = splitGraph(graph, 2)
  const seen = new Map()
  for (const g of groups) for (const n of g.nodes) seen.set(n.id, (seen.get(n.id) ?? 0) + 1)
  const dup = [...seen.entries()].filter(([, c]) => c > 1)
  assert.equal(dup.length, 0, `节点被画进了多张图：${JSON.stringify(dup)}`)
  assert.equal(seen.size, 4, '不能因为拆分而丢掉节点')
})

await test('没有边的散点不单独成图，并回有关系的组', async () => {
  const graph = {
    nodes: ['a', 'b', 'c', 'solo'].map((id) => ({ id, label: id })),
    edges: [
      { from: 'a', to: 'b', relation: 'prerequisite' },
      { from: 'b', to: 'c', relation: 'prerequisite' },
      // solo 只有一条弱边指向 a，没有依赖边
      { from: 'solo', to: 'a', relation: 'application' },
    ],
  }
  const groups = splitGraph(graph, 10)
  const zeroEdge = groups.filter((g) => g.edges.length === 0)
  assert.equal(
    zeroEdge.length,
    0,
    `出现 ${zeroEdge.length} 张 0 边的图：${zeroEdge.map((g) => g.nodes.length).join(',')}`,
  )
})

await test('整张图本来就没有关系时，不强行并成一张超限的图', async () => {
  const graph = {
    nodes: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, label: `n${i}` })),
    edges: [],
  }
  const groups = splitGraph(graph, 2)
  assert.ok(groups.length > 1, '没有关系也要按上限拆开，否则超宽出不了图')
  for (const g of groups) assert.ok(g.nodes.length <= 2, `某张图有 ${g.nodes.length} 个节点，超过上限 2`)
})

await test('分组不超过节点上限，也不丢节点', async () => {
  const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, label: `n${i}` }))
  // 一条长链：最容易被切成超限的一组
  const edges = nodes.slice(1).map((n, i) => ({ from: `n${i}`, to: n.id, relation: 'prerequisite' }))
  const groups = splitGraph({ nodes, edges }, 7)
  for (const g of groups) {
    assert.ok(g.nodes.length <= 7, `某张图 ${g.nodes.length} 个节点 > 7，会被 archify 判字不可读`)
  }
  const total = groups.reduce((s, g) => s + g.nodes.length, 0)
  assert.equal(total, 40, '拆完不能丢节点')
})



/* ------------------------------ 21. 被拒的产物 / 重复导入 / 档位只有一个算法 */

section('21. 被拒的不推进阶段 · 同一份资料不重复建项目 · 档位只有一个算法')

/**
 * 三条都是端到端验收里真实抓到的：
 *
 * 1. 读前六段式只写了①摘要、其余五段全缺，校验 6 条 error，
 *    产物却照写 preflight.json，阶段照样推进到 planned ——
 *    而标注和图谱被拒时只留 .rejected，三个阶段的语义不一致。
 * 2. 同一份正文导入两次就是两个项目（docId 带时间戳）。实测仓库里
 *    已经有两个 chapter1，正文哈希完全相同，用户分不清哪个是自己在读的。
 * 3. 磁盘上的 tier 可能与 label 矛盾（chapter1 93/217），
 *    信的代码会把 123 处核心要点数成 50 处。
 */
const ws21 = await mkdtemp(join(tmpdir(), 'study-gate-'))
const svc21 = new StudyService(ws21)
const fixture21 = join(ws21, 'sample.md')
await writeFile(
  fixture21,
  [
    '# 验收样本',
    '',
    '第一段：这里讲的是为什么要按用户路径验收，而不是只跑单元测试。接口通了不代表页面有东西。',
    '',
    '## 小节一',
    '',
    '第二段：这里讲的是检查点要落在用户能看到的东西上，比如高亮包住了哪几个字。',
    '',
    '第三段：这里讲的是失败要分类说清，无后缀、空文件、路径不存在、路径是文件夹。',
    '',
  ].join('\n'),
  'utf8',
)
const ing21 = await svc21.ingest(fixture21, { title: '验收样本' })
const DOC21 = ing21.docId

await test('读前计划缺五段：只留 rejected 草稿，阶段不许推进', async () => {
  const res = await svc21.savePreflight(DOC21, { summary: '只写了摘要，其余五段全缺。' })
  assert.equal(res.check.ok, false, '六段缺五段竟然通过了校验')
  assert.equal(res.accepted, false, '没有告诉调用方这次没被接受')
  const proj = await svc21.project(DOC21)
  assert.equal(proj.stage, 'ingested', '被拒的读前计划把阶段推进了')
  const dir = join(ws21, '.study', DOC21)
  assert.equal(existsSync(join(dir, 'preflight.json')), false, '被拒的计划写了正式文件名')
  assert.equal(existsSync(join(dir, 'preflight.rejected.json')), true, '被拒后没留草稿，用户丢了刚写的内容')
  assert.equal(existsSync(join(dir, 'quiz.md')), false, '被拒的计划还生成了残缺题库')
  assert.equal(existsSync(join(dir, 'refs.md')), false, '被拒的计划还生成了残缺参考资料')
})

await test('完整的读前计划：接受并推进到 planned', async () => {
  const res = await svc21.savePreflight(DOC21, goodPlan())
  assert.ok(res.check.ok, JSON.stringify(res.check.issues))
  assert.equal(res.accepted, true)
  const proj = await svc21.project(DOC21)
  assert.equal(proj.stage, 'planned')
  assert.ok(proj.quizHtml, '题库没生成')
})

await test('同一份正文再导入：复用同一个项目', async () => {
  const again = await svc21.ingest(fixture21, { title: '换个标题也一样' })
  assert.equal(again.docId, DOC21, '同一份正文又建了一个项目')
  assert.equal(again.reused, true, '没有告诉调用方这是复用')
  assert.equal((await svc21.list()).length, 1, '资料库里出现了两条')
  // 复用不许顺手改名：导入是"放进来"，不是"改已有项目的名字"
  const list = await svc21.list()
  assert.equal(list[0].title, '验收样本', '复用路径把已有项目改名了')
})

await test('同名但内容变了：必须新建（段号会位移，复用会把旧标注挂错段）', async () => {
  await writeFile(fixture21, '# 验收样本\n\n改过之后的正文：这一版的段落数不一样了。\n', 'utf8')
  const changed = await svc21.ingest(fixture21)
  assert.notEqual(changed.docId, DOC21, '内容变了还复用旧项目，旧标注会挂到别的段落上')
  assert.equal((await svc21.list()).length, 2)
})

await test('核心要点数按标签算，不信磁盘上的 tier', async () => {
  // 模拟 chapter1 的历史数据：73 条 #d 被存成 ref
  const segs = await svc21.store.segments(DOC21)
  const texts = await svc21.store.segmentTexts(DOC21)
  const q = (id) => (texts.get(id) ?? '').slice(0, 12)
  await svc21.store.writeArtifact(DOC21, 'annotations.json', {
    items: [
      { segmentId: segs[0].id, label: 'd', tier: 'ref', quote: q(segs[0].id) },
      { segmentId: segs[1].id, label: 's', tier: 'ref', quote: q(segs[1].id) },
      { segmentId: segs[2].id, label: 'e', tier: 'core', quote: q(segs[2].id) },
    ],
  })
  const p = await svc21.store.progressOf(DOC21)
  assert.equal(p.keyPointCount, 2, '#d 与 #s 应算核心要点，与 tier 字段写什么无关')
  const h = await svc21.harvested(DOC21)
  assert.equal(h.keyPoints, 2, '收获视图的核心要点数用了磁盘上的 tier')
})

await test('读出来的标注 tier 已归位（界面按 tier 判断才不会漏）', async () => {
  const proj = await svc21.project(DOC21)
  const tiers = Object.fromEntries(proj.annotations.items.map((i) => [i.label, i.tier]))
  assert.equal(tiers.d, 'core', 'project() 没把 tier 归位，读中页的「核心档盖住待回想」会漏')
  assert.equal(tiers.s, 'core')
  assert.equal(tiers.e, 'ref')
  assert.equal(proj.annotations.stats.byTier.core, 2)
})

await test('老 stats 缺 tierRatio 时，status 仍给出分档占比', async () => {
  const st = await svc21.status(DOC21)
  assert.ok(st.highlight, 'highlight 为空，模型失去预算判断依据')
  assert.equal(typeof st.highlight.coreRatio, 'number', 'coreRatio 应为数字')
  assert.equal(typeof st.highlight.hardRatio, 'number')
})

await test('meta.stage 写不进去（阶段只有产物这一个真相）', async () => {
  await svc21.store.saveMeta(DOC21, { stage: 'drilled' })
  const meta = JSON.parse(await readFile(join(ws21, '.study', DOC21, 'meta.json'), 'utf8'))
  assert.equal('stage' in meta, false, 'meta.json 里又出现了和界面打架的阶段值')
  const proj = await svc21.project(DOC21)
  assert.notEqual(proj.stage, 'done', '写 meta.stage 竟然影响了真实阶段')
})

await test('关系边的原文出处不许用省略号拼（无法核对等于没有出处）', async () => {
  // 实测 chapter3 有 8/41 条边写成「前半句…后半句」，与原文字符串永远对不上。
  const res = await svc21.saveRelations(DOC21, {
    nodes: [{ id: 'a', label: '甲' }, { id: 'b', label: '乙' }],
    edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'prerequisite', quote: '前半句…后半句' }],
    relationReview: Object.fromEntries(
      ['prerequisite', 'part-of', 'contrast', 'cause', 'example-of', 'application', 'sequence', 'analogy'].map((k) => [
        k,
        k === 'prerequisite'
          ? { status: 'mapped', edgeIds: ['e1'] }
          : { status: 'unsupported', why: '这份样本没有这一类关系' },
      ]),
    ),
  })
  assert.equal(res.check.ok, false, '带省略号的出处被当成合格证据了')
  assert.ok(
    res.check.issues.some((i) => i.code === 'edge-quote-ellipsis'),
    '没有指出省略号问题，模型不知道该改成逐字原文',
  )
  assert.equal(await svc21.store.artifact(DOC21, 'relations.json').catch(() => null), null, '被拒的图写了正式产物')
})

await rm(ws21, { recursive: true, force: true })

console.log(`\n${'─'.repeat(52)}`)
console.log(`通过 ${passed}　失败 ${failed}`)

if (failed > 0) {
  console.log('\n失败详情：')
  for (const f of failures) console.log(`\n[${f.name}]\n${f.error.stack}`)
  process.exitCode = 1
}
