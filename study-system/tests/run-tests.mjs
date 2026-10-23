/**
 * 测试用例：提取 / 规则 / 服务端到端。
 * 运行：node tests/run-tests.mjs
 */
import { strict as assert } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(HERE, 'fixtures')

const LIB = join(HERE, '..', 'plugin', 'lib')
const { extractFile, segmentText, extractDocument } = await import(`file://${join(LIB, 'extract.js')}`)
const { StudyService } = await import(`file://${join(LIB, 'service.js')}`)
const { renderMarkdown, parseMermaid, layoutGraph } = await import(`file://${join(LIB, 'markdown.js')}`)
const { findWorkspaceRoot, findWorkspaceRoots } = await import(`file://${join(LIB, 'store.js')}`)
const rules = await import(`file://${join(LIB, 'rules.js')}`)

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
const SEGS = Array.from({ length: 20 }, (_, i) => ({ id: `¶${i + 1}`, chars: 100 }))
const CTX = { segments: SEGS, totalChars: 2000 }

await test('合法标注通过', async () => {
  const r = rules.validateAnnotation(
    [
      { segmentId: '¶2', label: 'd', title: '负荷的定义' },
      { segmentId: '¶4', label: 'q', title: '为何上限是20%' },
    ],
    CTX,
  )
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.stats.byTier.core, 1)
  assert.equal(r.stats.byTier.hard, 1)
  assert.equal(r.stats.ratio, 0.1)
})

await test('非法标签被拒', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'x', title: 'x' }], CTX)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'bad-label'))
})

await test('同一段重复标注被拒', async () => {
  const r = rules.validateAnnotation(
    [
      { segmentId: '¶1', label: 'd', title: 'a' },
      { segmentId: '¶1', label: 'e', title: 'b' },
    ],
    CTX,
  )
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'duplicate'))
})

await test('#c 缺两字关键词被拒', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'c', title: '补充' }], CTX)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'c-needs-keyword'))
})

await test('#c 带两字关键词则通过', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶1', label: 'c', title: '作者背景', keyword: '背景' }], CTX)
  assert.ok(r.ok, JSON.stringify(r.issues))
})

await test('总高亮超 20% 被拒（二八法则）', async () => {
  // 5 段核心 = 500/2000 = 25% > 20%
  const r = rules.validateAnnotation(
    SEGS.slice(0, 5).map((s) => ({ segmentId: s.id, label: 'd', title: 't' })),
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
    SEGS.slice(0, 3).map((s) => ({ segmentId: s.id, label: 's', title: 't' })),
    CTX,
  )
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'budget-core'))
})

await test('参考档不占预算，可以多标', async () => {
  const r = rules.validateAnnotation(
    [
      { segmentId: '¶1', label: 'e', title: 'a' },
      { segmentId: '¶2', label: 'e', title: 'b' },
      { segmentId: '¶3', label: 't', title: 'c' },
      { segmentId: '¶5', label: 'd', title: '核心一段' },
    ],
    CTX,
  )
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.stats.byTier.ref, 3)
  assert.equal(r.stats.highlightedChars, 100, '参考档不应计入高亮字数')
})

await test('未知段落锚点被拒', async () => {
  const r = rules.validateAnnotation([{ segmentId: '¶99', label: 'd', title: 't' }], CTX)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'unknown-segment'))
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

await test('合法图通过', async () => {
  const r = rules.validateRelations({
    nodes: [
      { id: 'a', label: '内在负荷' },
      { id: 'b', label: '外在负荷' },
      { id: 'c', label: '设计原则' },
    ],
    edges: [
      { from: 'a', to: 'c', relation: 'prerequisite' },
      { from: 'b', to: 'c', relation: 'prerequisite' },
      { from: 'a', to: 'b', relation: 'contrast' },
    ],
  })
  assert.ok(r.ok, JSON.stringify(r.issues))
  assert.equal(r.stats.edges, 3)
})

await test('前置关系成环被拒', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [
      { from: 'a', to: 'b', relation: 'prerequisite' },
      { from: 'b', to: 'a', relation: 'prerequisite' },
    ],
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'cycle'))
})

await test('非法关系类型被拒', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [{ from: 'a', to: 'b', relation: 'related-to' }],
  })
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.code === 'edge-type'))
})

await test('孤立知识点只警告', async () => {
  const r = rules.validateRelations({
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
    edges: [{ from: 'a', to: 'b', relation: 'cause' }],
  })
  assert.ok(r.ok)
  assert.ok(r.issues.some((i) => i.code === 'isolated'))
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
  const all = proj.segments.map((s) => ({ segmentId: s.id, label: 'd', title: '全部' }))
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
    { segmentId: first, label: 'd', title: '认知负荷理论提出者' },
  ])
  assert.ok(res.check.ok, JSON.stringify(res.check.issues))
  const md = await readFile(join(workspace, '.study', DOC_ID, 'annotated.md'), 'utf8')
  assert.match(md, /^#d 认知负荷理论提出者\|Definition/m)
})

await test('关系图保存并产出 Mermaid', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveRelations(DOC_ID, {
    nodes: [{ id: 'a', label: '内在负荷' }, { id: 'b', label: '设计原则' }],
    edges: [{ from: 'a', to: 'b', relation: 'prerequisite' }],
  })
  assert.ok(res.check.ok)
  assert.match(res.mermaid, /graph TD/)
  assert.match(res.mermaid, /a.*-->.*b/)
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
  assert.equal(proj.next.action, 'study-feynman', '下一步仍应是费曼考核')
})

await test('空复述被拒，不能空手过关', async () => {
  const svc = new StudyService(workspace)
  await assert.rejects(() => svc.recordDrill(DOC_ID, { answer: '   ' }), /缺少你的复述/)
})

await test('记录真实复述后才推进到 drilled', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.recordDrill(DOC_ID, {
    prompt: '合上材料说说三类负荷',
    answer: '内在的是内容自带的，外在的是排版造成的浪费，相关的是用来建图式的努力。',
    rubricHit: ['三类名字全对', '来源说对'],
    verdict: '部分达标：三者区别说清了，但没举例',
    minimalAction: '补一个原文之外的例子',
  })
  assert.equal(res.progress.drilled, true)
  assert.equal(res.progress.drillCount, 1)
  const list = await svc.drills(DOC_ID)
  assert.equal(list.length, 1)
  assert.match(list[0].answer, /内在的是内容自带的/, '应保存学习者的原话')
})

await test('多次考核累积为记录，不覆盖历史', async () => {
  const svc = new StudyService(workspace)
  await svc.recordDrill(DOC_ID, { answer: '第二次复述：外在负荷＝来回搜索的浪费。' })
  const list = await svc.drills(DOC_ID)
  assert.equal(list.length, 2, '第二条记录应当追加而不是覆盖')
})

/* ------------------------------------------------------------ 9. 汇总 */

section('8. 工具返回值必须是无损 JSON')

await test('校验失败的结果里不含 undefined（否则宿主拒绝回传模型）', async () => {
  const svc = new StudyService(workspace)
  const res = await svc.saveAnnotation(DOC_ID, [{ segmentId: '¶2', label: 'd', title: 'x' }])
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
  const r = await svc.ingest(join(FIXTURES, 'sample.md'), { title: '排版测试' })
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
  assert.match(html, /① 资料摘要/)
  assert.match(html, /② 对我的帮助与目标/)
  assert.match(html, /⑤ 思考题与作业/)
  assert.match(html, /⑥ 参考资料/)
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

console.log(`\n${'─'.repeat(52)}`)
console.log(`通过 ${passed}　失败 ${failed}`)
if (failed > 0) {
  console.log('\n失败详情：')
  for (const f of failures) console.log(`\n[${f.name}]\n${f.error.stack}`)
  process.exitCode = 1
}
