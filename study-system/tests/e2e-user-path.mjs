/**
 * 端到端 · 真实用户路径
 *
 * 与既有套件的分工：
 * - e2e-check.mjs   对着**已有项目**做只读验收（高亮粒度、图可取、越界防护）
 * - 本脚本           从零建一个项目，按用户的真实顺序走完五个阶段，
 *                    每一步都检查"界面上会看到什么"，最后删掉，不留痕迹
 *
 * 为什么需要它：既有套件都是"某一份数据本来就该长这样"的断言。
 * 它们证明不了"一个新用户从导入到考核这条路是通的" ——
 * 中间任何一步写坏了文件、阶段没推进、界面拿到空数组，都不在它们的视野里。
 *
 * 用法：
 *   DSH_WEB_HOST=http://127.0.0.1:<端口> node study-system/tests/e2e-user-path.mjs
 *   STUDY_E2E_WS=D:\learn            可选，默认取当前仓库根
 *   STUDY_E2E_KEEP=1                 跑完不删项目，方便人工看界面
 */
import { mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { StudyService } from '../plugin/lib/service.js'
import { startHarness } from './harness-server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
/**
 * 两种跑法：
 *   默认    自己把插件挂到进程内 HTTP 服务上，用临时工作区。验的是**源码**，
 *           不依赖运行中的桌面端，`node tests/e2e-user-path.mjs` 即可。
 *   --live  打真实部署（DSH_WEB_HOST）与真实资料库（STUDY_E2E_WS）。验的是
 *           **部署**：改了代码没重载，凡是走 HTTP 的那几步就会红。
 *           注意 preflight/annotation/relations/drill 没有 HTTP 入口（它们由 Agent
 *           工具调用），这几步无论哪种模式都走源码 —— 所以 --live 红了不等于业务
 *           逻辑错，只说明部署里的插件是旧的。
 */
const LIVE = process.argv.includes('--live')
const LIVE_HOST = process.env.DSH_WEB_HOST ?? 'http://127.0.0.1:52784'
const LIVE_WS = resolve(process.env.STUDY_E2E_WS ?? REPO)

let HOST = LIVE_HOST
let WS = LIVE_WS
let BASE = `${HOST}/study-copilot/api`
let Q = `ws=${encodeURIComponent(WS)}`
let harness = null
let tempRoot = null

let pass = 0
let fail = 0
const failures = []
/** 每个"模块"下的检查结果，最后按模块汇总 */
const modules = []
let bucket = null

function startModule(name) {
  bucket = { name, checks: [] }
  modules.push(bucket)
  console.log(`\n── ${name} ──`)
}

async function check(name, fn) {
  try {
    const note = await fn()
    pass += 1
    bucket?.checks.push({ name, ok: true, note: note ?? null })
    console.log(`  ✓ ${name}${note ? `　（${note}）` : ''}`)
  } catch (e) {
    fail += 1
    bucket?.checks.push({ name, ok: false, error: e?.message ?? String(e) })
    console.log(`  ✗ ${name}\n      ${e?.message ?? e}`)
    failures.push({ module: bucket?.name, name, error: e })
  }
}

/** 断言工具：不引第三方库，报错信息直接说人话 */
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
function assertEq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
}

const api = async (path, init) => {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}${Q}`
  const r = await fetch(url, init)
  const text = await r.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: r.status, ok: r.ok, body, bytes: Buffer.byteLength(text), headers: r.headers }
}
const get = async (path) => {
  const r = await api(path)
  assert(r.ok, `${path} → HTTP ${r.status} ${JSON.stringify(r.body)?.slice(0, 200)}`)
  return r.body
}
const post = async (path, payload) =>
  api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })

/* --------------------------------------------------------------- 样本 */

const FIXTURE_NAME = 'e2e-用户路径样本.md'
const FIXTURE = `# 端到端验收样本

## 一、为什么要做端到端

一份学习资料从导入到考核要经过五个阶段。每个阶段都可能失败，而失败方式各不相同：导入时可能提取不到正文，读前建构可能缺段落，标注可能引用不存在的原文，图谱可能画不出来。

单元测试只能证明函数算得对，证明不了用户走完这条路是通的。所以需要在真实环境里，按真实顺序走一遍。

## 二、检查点怎么定

检查点必须落在用户能看到的东西上，而不是接口返回二百。一个页面可以接口全通、渲染全空。

| 检查点 | 观测手段 |
| --- | --- |
| 正文能读 | 段落数与首句 |
| 高亮落在短语 | strong 标签包住的字符 |
| 图能打开 | iframe 的 src 返回 HTML |

## 三、失败也要说清

导入失败有四种：无后缀、空文件、路径不存在、路径是文件夹。系统必须分别说清是哪一种，不能只说失败两个字。

- 无后缀：认不出类型
- 空文件：没有内容
- 路径不存在：找不到文件
- 路径是文件夹：不是一个文件

## 四、收尾

走完这条路，应该得到一份能被复述的要点、一组能自测的问答，以及一次合书复述的记录。没有这些，流程再完整也只是空转。
`

/* --------------------------------------------------------------- 主流程 */

const created = { docs: [], inbox: [] }
let docId = null
let svc = null

if (LIVE) {
  svc = new StudyService(WS)
} else {
  // 临时工作区 + 临时 DSH_HOME：不碰真实资料，也不改真机"上次打开的目录"
  tempRoot = await mkdtemp(join(tmpdir(), 'study-e2e-'))
  WS = tempRoot
  await mkdir(join(tempRoot, '.study'), { recursive: true })
  harness = await startHarness({ workspace: tempRoot, dshHome: join(tempRoot, '.dsh') })
  HOST = harness.host
  BASE = `${HOST}/study-copilot/api`
  Q = `ws=${encodeURIComponent(WS)}`
  svc = new StudyService(WS)
}

console.log('端到端 · 真实用户路径')
console.log(`  模式 ${LIVE ? '真实部署（--live）' : '源码自挂载'}`)
console.log(`  宿主 ${HOST}`)
console.log(`  工作区 ${WS}`)

try {
  /* ============================================================ 0 环境 */
  startModule('0 环境与挂载')

  await check('健康检查返回工作区', async () => {
    const h = await get('/health')
    assertEq(h.ok, true, 'health.ok')
    assert(typeof h.workspace === 'string' && h.workspace.length, 'workspace 为空')
    return h.workspace
  })

  await check('/stages 五个阶段齐全且带 progressKey', async () => {
    const { stages } = await get('/stages')
    assertEq(stages.length, 5, '阶段数')
    const keys = stages.map((s) => s.key).join(',')
    assertEq(keys, 'preflight,annotate,map,recall,feynman', '阶段顺序')
    for (const s of stages) {
      assert(s.progressKey, `${s.key} 缺 progressKey`)
      assert(s.name && s.action && s.redo, `${s.key} 缺展示字段`)
    }
  })

  await check('项目列表可读且每项带 next', async () => {
    const { items } = await get('/projects')
    assert(Array.isArray(items), 'items 不是数组')
    for (const it of items) assert(it.next?.stage, `${it.id} 缺 next.stage`)
  })

  /* ========================================================== 1 导入 */
  startModule('1 导入（拖入文件 / 给路径 / 失败分类）')

  await check('浏览器导入：落的文件名带时间戳，标题保持干净', async () => {
    const res = await fetch(`${BASE}/ingest-upload?name=${encodeURIComponent(FIXTURE_NAME)}&${Q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from(FIXTURE, 'utf8'),
    })
    const body = await res.json()
    assertEq(res.status, 200, 'HTTP')
    assert(body.docId, '没有返回 docId')
    docId = body.docId
    created.docs.push(docId)
    assertEq(body.title, 'e2e-用户路径样本', '标题被时间戳污染了')
    assert(body.segmentCount >= 8, `段落数偏少：${body.segmentCount}`)
    // _inbox 里必须有一份带时间戳的原件，用户能自己找回来
    const inbox = join(WS, '_inbox')
    const { readdir } = await import('node:fs/promises')
    const files = (await readdir(inbox)).filter((f) => f.includes(FIXTURE_NAME))
    assert(files.length, '_inbox 里没有落盘原件')
    created.inbox.push(...files.map((f) => join(inbox, f)))
    return `docId=${docId} 段=${body.segmentCount} 字=${body.chars}`
  })

  await check('路径导入同一份文件：复用已有项目，不再造一个', async () => {
    const before = (await get('/projects')).items.length
    const res = await post('/ingest', { path: created.inbox[0] })
    assertEq(res.status, 200, 'HTTP')
    if (res.body.docId !== docId) created.docs.push(res.body.docId)
    assertEq(res.body.docId, docId, '同一份正文应当复用同一个 docId')
    assertEq(res.body.reused, true, '没有告诉调用方这是复用')
    const after = (await get('/projects')).items.length
    assertEq(after, before, `项目数从 ${before} 变成 ${after}，重复导入又建了一个`)
    return `docId=${res.body.docId}`
  })

  await check('再导入同一份内容也不新建（_inbox 不留孤儿副本）', async () => {
    const before = (await get('/projects')).items.length
    const res = await fetch(`${BASE}/ingest-upload?name=${encodeURIComponent('换个名字也一样.md')}&${Q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from(FIXTURE, 'utf8'),
    })
    const body = await res.json()
    assertEq(res.status, 200, 'HTTP')
    if (body.docId !== docId) {
      // 部署还跑着旧代码时会新建一个项目；登记下来，收尾时一并删掉
      created.docs.push(body.docId)
      const { readdir } = await import('node:fs/promises')
      const inbox = await readdir(join(WS, '_inbox')).catch(() => [])
      created.inbox.push(...inbox.filter((f) => f.includes('换个名字')).map((f) => join(WS, '_inbox', f)))
    }
    assertEq(body.docId, docId, '内容相同应当复用')
    assertEq((await get('/projects')).items.length, before, '又新建了一个项目')
    const { readdir } = await import('node:fs/promises')
    const orphans = (await readdir(join(WS, '_inbox'))).filter((f) => f.includes('换个名字'))
    assertEq(orphans.length, 0, `_inbox 里留了孤儿副本：${orphans.join(',')}`)
  })

  await check('失败分类：路径不存在 / 不是文件 / 无后缀 / 空文件', async () => {
    const missing = await post('/ingest', { path: join(WS, '__不存在__.md') })
    assertEq(missing.status, 400, '不存在路径的 HTTP')
    assert(/不存在/.test(missing.body?.error ?? ''), `文案没说清：${missing.body?.error}`)

    const dir = await post('/ingest', { path: HERE })
    assertEq(dir.status, 400, '文件夹的 HTTP')
    assert(/不是文件/.test(dir.body?.error ?? ''), `文案没说清：${dir.body?.error}`)

    const noExt = await fetch(`${BASE}/ingest-upload?name=${encodeURIComponent('没有后缀')}&${Q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from('hello', 'utf8'),
    })
    assertEq(noExt.status, 400, '无后缀的 HTTP')
    const noExtBody = await noExt.json()
    assert(/后缀|类型/.test(noExtBody?.error ?? ''), `文案没说清：${noExtBody?.error}`)

    const empty = await fetch(`${BASE}/ingest-upload?name=${encodeURIComponent('空.md')}&${Q}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.alloc(0),
    })
    assertEq(empty.status, 400, '空文件的 HTTP')
    const emptyBody = await empty.json()
    assert(/空/.test(emptyBody?.error ?? ''), `文案没说清：${emptyBody?.error}`)
  })

  /* ========================================================== 2 预览 */
  startModule('2 预览（30 秒决定要不要读）')

  await check('peek：字数/分钟/块数/目录/三个抓手都在', async () => {
    const { peek } = await get(`/peek/${encodeURIComponent(docId)}`)
    assert(peek, 'peek 为 null')
    assert(peek.chars > 300, `字数异常：${peek.chars}`)
    assert(peek.minutes >= 1, '估算分钟 <1')
    assert(peek.outline.length >= 3, `目录只认出 ${peek.outline.length} 条小标题`)
    for (const k of ['start', 'end', 'biggest']) {
      assert(peek.hooks?.[k]?.text, `抓手 ${k} 为空`)
    }
    assert(peek.hooks.start.text !== peek.hooks.end.text, '开头与结尾抓手是同一句')
    return `${peek.unitCount} 块 / ${peek.minutes} 分钟`
  })

  await check('units：没有 units.json 时返回 null 而不是 404', async () => {
    const { units } = await get(`/units/${encodeURIComponent(docId)}`)
    assertEq(units, null, 'units 应为 null')
  })

  await check('project：stage=ingested，段落带已渲染 html', async () => {
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'ingested', 'stage')
    assert(p.segments.length >= 8, '段落数')
    assert(p.segments.every((s) => typeof s.html === 'string' && s.html.length), '有段落没有 html')
    assert(p.next?.stage === 'ingested', 'next.stage 与 stage 不一致')
    return `${p.segments.length} 段`
  })

  /* ====================================================== 3 读前建构 */
  startModule('3 读前建构（六段式）')

  await check('缺段落的 preflight：校验必须报错，且不应推进阶段', async () => {
    const bad = await svc.savePreflight(docId, { summary: '只写了摘要，其余五段全缺。' })
    assertEq(bad.check.ok, false, '校验竟然通过了')
    const after = await get(`/project/${encodeURIComponent(docId)}`)
    // 这一条是在验证设计一致性：标注与图谱被拒时不推进阶段，读前也应如此
    if (after.stage === 'planned') {
      throw new Error(
        `校验失败（${bad.check.issues.filter((i) => i.level === 'error').length} 条 error）却仍推进到 planned —— ` +
          '与标注/图谱的「被拒不推进」不一致',
      )
    }
    return `stage 保持 ${after.stage}`
  })

  await check('完整 preflight：校验通过并推进到 planned', async () => {
    const segments = await svc.store.segments(docId)
    const texts = await svc.store.segmentTexts(docId)
    const long = segments.filter((s) => (texts.get(s.id) ?? '').length > 80)
    const kp = (s, name) => ({ content: '这一部分讲的是判据与做法。', note: '读完能自己复述一遍' })
    const plan = {
      summary:
        '这是一份用于端到端验收的样本资料。它不长，但覆盖了导入、预览、读前建构、读中标注、知识图谱、读后巩固与读后考核这五个阶段所需的全部要素：有三级标题，有表格，有列表，有需要停下想的判断句。它的价值不在内容本身，而在它把整条链路串起来，让每个阶段的产物都能被检查。',
      goals: {
        help: '帮助我发现端到端链路上真实会断的那一处，而不是靠单元测试给自己壮胆。',
        main: '走完五个阶段，得到可以复述的要点、能自测的问答与一次合书复述的记录。',
        subgoals: [
          { text: '能在不看原文的情况下说出端到端要检查的三类东西', level: '理解' },
          { text: '能把失败分成四种并说出各自的提示', level: '掌握' },
        ],
      },
      parts: [
        {
          title: '为什么要做端到端',
          requirements: '能说出单元测试覆盖不到的那一类失败。',
          keyPoints: ['阶段之间会断，函数内部的测试抓不到', '接口全通不等于页面有内容'],
          difficulties: ['容易把「接口 200」当成「功能正常」'],
          assessment: { level: '理解', requirement: '用自己的话说明为什么需要端到端', purpose: '避免自欺' },
          knowledgePoints: [
            { name: '链路断裂', content: '每一阶段都可能写坏产物或没推进阶段。', note: '重点看阶段与产物是否一致' },
          ],
        },
        {
          title: '检查点怎么定',
          requirements: '检查点必须落在用户能看到的东西上。',
          keyPoints: ['观测手段要与用户感知一致', '表格与列表是渲染的硬骨头'],
          difficulties: ['高亮粒度容易退化成整段变色'],
          assessment: { level: '掌握', requirement: '能指出一个「接口通但页面空」的例子', purpose: '把验收做实' },
          knowledgePoints: [
            { name: '可观测性', content: '断言输出内容，而不是断言 HTTP 状态码。', note: '这条踩过坑' },
          ],
        },
        {
          title: '失败也要说清',
          requirements: '四种导入失败必须分别说清是哪一种。',
          keyPoints: ['无后缀/空文件/路径不存在/路径是文件夹'],
          difficulties: ['统一回「失败」等于没说'],
          assessment: { level: '了解', requirement: '能列举四类失败', purpose: '减少无效重试' },
          knowledgePoints: [{ name: '失败分类', content: '每一种失败给出下一步动作。', note: '文案即产品' }],
        },
      ],
      exercises: [
        {
          question: '为什么「接口返回 200」不能证明功能正常？举一个你见过的例子。',
          kind: '批判',
          rubric: ['指出接口与渲染是两段链路', '给出一个页面为空的实例'],
          minimalAction: '在浏览器里打开一次，看有没有字。',
        },
        {
          question: '合上书，用三句话说明这份样本资料要验的是什么。',
          kind: '回想',
          rubric: ['说出五个阶段', '说出至少两个真实会断的地方'],
          minimalAction: '说完再对照原文补漏。',
        },
      ],
      references: [
        { title: '端到端验收样本（本资料）', source: '原文', kind: '一手材料' },
        { title: '现有测试套件 all.mjs', source: '原文', kind: '代码', note: '看它断言了什么、没断言什么' },
      ],
    }
    const ok = await svc.savePreflight(docId, plan)
    assertEq(ok.check.ok, true, `校验未通过：${JSON.stringify(ok.check.issues.filter((i) => i.level === 'error'))}`)
    const after = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(after.stage, 'planned', 'stage')
    assert(after.preflightHtml, 'preflightHtml 为空')
    // 六段式必须真的渲染成六段，而不是一段
    const secs = (after.preflightHtml.match(/class="sc-pf-sec"/g) ?? []).length
    assertEq(secs, 6, '六段式渲染出的段数')
    assert(/看原文/.test(after.preflightHtml) || /原文位置待定位/.test(after.preflightHtml), '知识点既没有回指也没说明缺失')
    // 题库在读前就生成，但它不等于考过
    assert(after.quizHtml, 'quizHtml 为空')
    return `六段 ${secs} 个`
  })

  /* ====================================================== 4 读中标注 */
  startModule('4 读中加工（三色短语级高亮）')

  let goodItems = null
  await check('quote 不在原文里：必须拒绝，且不写正式产物', async () => {
    const segments = await svc.store.segments(docId)
    const res = await svc.saveAnnotation(docId, [
      { segmentId: segments[2].id, label: 'd', title: '编造的片段', quote: '这句话原文里根本不存在' },
    ])
    assertEq(res.accepted, false, '竟然接受了不存在的 quote')
    const codes = res.check.issues.map((i) => i.code)
    assert(codes.includes('quote-not-found'), `没有 quote-not-found：${codes.join(',')}`)
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'planned', '被拒后阶段被推进了')
    const onDisk = await svc.store.artifact(docId, 'annotations.json').catch(() => null)
    assertEq(onDisk, null, '被拒的标注写了正式文件名')
    const rejected = await svc.store.artifact(docId, 'annotations.rejected.json').catch(() => null)
    assert(rejected, '没有留 rejected 草稿')
  })

  await check('超预算：必须拒绝（核心档 >10%）', async () => {
    const segments = await svc.store.segments(docId)
    const texts = await svc.store.segmentTexts(docId)
    const total = segments.reduce((a, s) => a + (s.chars || 0), 0)
    // 把所有长段的正文都当 quote，必然超 20%
    const items = segments
      .filter((s) => (texts.get(s.id) ?? '').length > 40)
      .slice(0, 6)
      .map((s) => ({ segmentId: s.id, label: 'd', title: '整段照抄', quote: texts.get(s.id).slice(0, 60) }))
    const res = await svc.saveAnnotation(docId, items)
    assertEq(res.accepted, false, `竟然接受了 ${(items.length * 60 / total * 100).toFixed(0)}% 的高亮`)
    const codes = res.check.issues.map((i) => i.code)
    assert(codes.some((c) => c === 'budget-total' || c === 'segment-over-highlighted'), `没命中预算检查：${codes.join(',')}`)
  })

  await check('合法标注：接受，高亮只包住短语', async () => {
    const segments = await svc.store.segments(docId)
    const texts = await svc.store.segmentTexts(docId)
    // 从真实段落里挑句子，保证逐字存在
    const pick = (id, from, len) => {
      const t = texts.get(id) ?? ''
      const i = t.indexOf(from)
      assert(i >= 0, `样本里找不到「${from}」`)
      return t.slice(i, i + len)
    }
    const s = (kw) => segments.find((x) => (texts.get(x.id) ?? '').includes(kw))?.id
    const idA = s('单元测试只能证明函数算得对')
    const idB = s('检查点必须落在用户能看到的东西上')
    const idC = s('导入失败有四种')
    assert(idA && idB && idC, '样本段落定位失败')
    goodItems = [
      { segmentId: idA, label: 's', title: '单元测试证明不了链路通', quote: pick(idA, '证明不了用户走完这条路是通的', 15) },
      { segmentId: idB, label: 'q', title: '接口通不等于页面有内容', quote: pick(idB, '接口全通、渲染全空', 9) },
      { segmentId: idC, label: 'd', title: '四类失败', quote: pick(idC, '无后缀、空文件、路径不存在、路径是文件夹', 23) },
    ]
    const res = await svc.saveAnnotation(docId, goodItems)
    assertEq(res.accepted, true, `被拒：${JSON.stringify(res.check.issues.filter((i) => i.level === 'error'))}`)
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'annotated', 'stage')
    const n = (p.annotatedHtml.match(/<strong class="sc-hl-\w+">/g) ?? []).length
    assertEq(n, goodItems.length, '高亮处数 ≠ 标注条数')
    assertEq((p.annotatedHtml.match(/class="sc-seg sc-hl/g) ?? []).length, 0, '有段落被整段染色')
    // 高亮里的文字必须就是 quote
    const inner = [...p.annotatedHtml.matchAll(/<strong class="sc-hl-\w+">([\s\S]*?)<\/strong>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, ''),
    )
    for (const it of goodItems) {
      assert(inner.some((x) => x.includes(it.quote.slice(0, 8))), `高亮里找不到「${it.quote.slice(0, 8)}」`)
    }
    const stats = p.annotations.stats
    assert(stats.ratio > 0 && stats.ratio <= 0.2, `占比异常：${stats.ratio}`)
    return `占比 ${(stats.ratio * 100).toFixed(1)}%`
  })

  await check('标注来源如实标注（不是「已读完」）', async () => {
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assert(p.provenance?.kind, '没有 provenance')
    assertEq(p.provenance.kind, 'judged', 'provenance.kind')
    assertEq(p.provenance.reliable, true, 'provenance.reliable')
  })

  /* ====================================================== 5 知识图谱 */
  startModule('5 知识图谱（archify 出真图）')

  await check('关系缺 relationReview：必须拒绝且不推进', async () => {
    const res = await svc.saveRelations(docId, {
      nodes: [{ id: 'a', label: '导入' }, { id: 'b', label: '考核' }],
      edges: [{ id: 'e1', from: 'a', to: 'b', relation: 'prerequisite', quote: '从导入到考核' }],
    })
    assertEq(res.check.ok, false, '竟然通过了')
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'annotated', '被拒后阶段被推进了')
    assertEq(await svc.store.artifact(docId, 'relations.json').catch(() => null), null, '被拒的图写了正式文件名')
  })

  await check('合法关系图：保存并生成可打开的 HTML 图', async () => {
    const nodes = [
      { id: 'ingest', label: '导入' },
      { id: 'preflight', label: '读前建构' },
      { id: 'annotate', label: '读中加工' },
      { id: 'map', label: '知识图谱' },
      { id: 'recall', label: '读后巩固' },
      { id: 'feynman', label: '读后考核' },
    ]
    const chain = nodes.slice(0, -1).map((n, i) => ({
      id: `e${i + 1}`,
      from: n.id,
      to: nodes[i + 1].id,
      relation: 'prerequisite',
      quote: '一份学习资料从导入到考核要经过五个阶段',
    }))
    const unsupported = {}
    for (const k of ['part-of', 'contrast', 'cause', 'example-of', 'application', 'sequence', 'analogy']) {
      unsupported[k] = { status: 'unsupported', why: '这份样本只描述线性流程，材料里没有这一类关系的证据。' }
    }
    const res = await svc.saveRelations(docId, {
      nodes,
      edges: chain,
      direction: 'TD',
      relationReview: { prerequisite: { status: 'mapped', edgeIds: chain.map((e) => e.id) }, ...unsupported },
    })
    assertEq(res.check.ok, true, `校验未通过：${JSON.stringify(res.check.issues.filter((i) => i.level === 'error'))}`)
    assert(res.figures?.ok, `出图失败：${res.figures?.reason ?? '（无 reason）'}`)
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'mapped', 'stage')
    assert(p.figures.length >= 1, 'figures 为空')
    for (const f of p.figures) {
      const r = await fetch(`${HOST}${f.url}`)
      assertEq(r.status, 200, `${f.url} 的 HTTP`)
      const ct = r.headers.get('content-type') ?? ''
      assert(ct.includes('text/html'), `${f.url} 的 content-type=${ct}`)
      const body = await r.text()
      assert(body.includes('<html'), `${f.url} 不是 HTML 文档`)
      assert(body.length > 20000, `${f.url} 只有 ${body.length}B，可能是空壳`)
      const hit = nodes.some((n) => body.includes(n.label))
      assert(hit, `${f.url} 里找不到任何节点标签`)
    }
    return `${p.figures.length} 张图`
  })

  /* ====================================================== 6 读后巩固 */
  startModule('6 读后巩固（闭卷快问快答）')

  await check('超过 100 字的问答必须拒绝', async () => {
    const res = await post('/qa', {
      docId,
      pairs: [{ q: '这一条问题故意写得非常长'.repeat(10), a: '答案也故意写得很长'.repeat(10) }],
    })
    assertEq(res.body?.accepted, false, '竟然接受了超长问答')
    const codes = (res.body?.issues ?? []).map((i) => i.code)
    assert(codes.includes('qa-question-too-long'), `没有 qa-question-too-long：${codes.join(',')}`)
  })

  await check('合法问答：接受并推进到 recalled', async () => {
    const res = await post('/qa', {
      docId,
      pairs: [
        { q: '为什么接口返回 200 不能证明功能正常？', a: '接口与渲染是两段链路，页面可以全空而接口全通。' },
        { q: '导入失败要分成哪四种说清？', a: '无后缀、空文件、路径不存在、路径是文件夹。' },
      ],
    })
    assertEq(res.body?.accepted, true, `被拒：${JSON.stringify(res.body?.issues)}`)
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'recalled', 'stage')
    assertEq(p.qa.length, 2, 'qa 条数')
  })

  /* ====================================================== 7 读后考核 */
  startModule('7 读后考核（只有真实复述才点亮）')

  await check('开卷复述：记录但不推进', async () => {
    const r = await svc.recordDrill(docId, {
      prompt: '讲讲为什么要做端到端',
      answer: '因为接口通了不代表页面有东西，得真的走一遍才知道哪儿断了。',
      closedBook: false,
      durationSec: 180,
    })
    assertEq(r.record.valid, false, '开卷竟然算有效')
    assert(r.record.warnings.some((w) => w.code === 'drill-open-book'), '没有开卷警告')
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'recalled', '开卷把阶段推进了')
    assertEq(p.drills.length, 1, '记录没落库')
  })

  await check('太快：60 秒内不算有效', async () => {
    const r = await svc.recordDrill(docId, {
      prompt: '再讲一次',
      answer: '端到端要看的是用户能不能走完，而不是函数算得对不对。',
      closedBook: true,
      durationSec: 20,
    })
    assertEq(r.record.valid, false, '20 秒竟然算有效')
    assert(r.record.warnings.some((w) => w.code === 'drill-too-fast'), '没有太快警告')
  })

  await check('抄原文：不算有效', async () => {
    const r = await svc.recordDrill(docId, {
      prompt: '复述第三部分',
      answer: '导入失败有四种：无后缀、空文件、路径不存在、路径是文件夹。系统必须分别说清是哪一种，不能只说失败两个字。',
      closedBook: true,
      durationSec: 300,
    })
    assertEq(r.record.valid, false, '抄原文竟然算有效')
    assert(r.record.warnings.some((w) => w.code === 'drill-copied'), `没有抄录警告：${JSON.stringify(r.record.warnings)}`)
  })

  await check('合书 + 够时长 + 自己话：有效并推进到 done', async () => {
    const r = await svc.recordDrill(docId, {
      prompt: '合书复述：这套系统验的是什么',
      answer:
        '我理解它验的是链路，不是函数。函数算错会被单元测试抓住，但文件写坏、阶段没推进、页面拿到空数组这三种错不会。所以得从上传一份文件开始，一路走到合书复述，每一步都看界面能拿到什么。',
      rubricHit: ['说出五个阶段', '说出至少两个会断的地方'],
      verdict: '达标：说清了链路与函数的分工，也点出了产物与阶段两类断裂。',
      minimalAction: '下次改动后先跑一遍这条路径，再看单测。',
      closedBook: true,
      durationSec: 210,
    })
    assertEq(r.record.valid, true, `被判无效：${JSON.stringify(r.record.warnings)}`)
    const p = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(p.stage, 'done', 'stage')
    assertEq(p.next?.stage, 'done', 'next.stage')
    assertEq(p.next?.action, null, 'done 阶段不该还有 action')
    return `重合度 ${(r.record.copiedRatio * 100).toFixed(0)}%`
  })

  /* ====================================================== 8 复习调度 */
  startModule('8 复习调度（艾宾浩斯 1→3→7）')

  await check('有效复述后出现在今天的复习清单里', async () => {
    const { due, upcoming } = await get('/review')
    const all = [...due, ...upcoming]
    const mine = all.find((i) => i.docId === docId)
    assert(mine, '复习清单里没有这个项目')
    assertEq(mine.isDue, false, '首次复习不该当天到期')
    assertEq(mine.nextIntervalDays, 3, '下一档间隔')
    return `到期 ${mine.dueAt.slice(0, 10)}`
  })

  await check('完成一次复习：推进到 3 天档', async () => {
    const r = await post('/review-done', { docId })
    assertEq(r.status, 200, 'HTTP')
    assertEq(r.body.stage, 1, 'review.stage')
    assertEq(r.body.intervalDays, 3, 'intervalDays')
  })

  /* ====================================================== 9 术语追问 */
  startModule('9 术语追问（点词 → 待答 → 回填）')

  await check('界面点词：写一条待答记录，带段落上下文', async () => {
    const segments = await svc.store.segments(docId)
    const texts = await svc.store.segmentTexts(docId)
    const target = segments.find((s) => (texts.get(s.id) ?? '').includes('观测手段'))
    assert(target, '样本里找不到目标段落')
    const r = await post('/term', {
      docId,
      term: '观测手段',
      segmentId: target.id,
      question: '这里的观测手段指什么？',
      source: 'ui',
    })
    assertEq(r.status, 200, 'HTTP')
    assertEq(r.body.segmentId, target.id, 'segmentId')
    assert(r.body.context && r.body.context.length > 20, `上下文为空：${r.body.context}`)
    const pending = await get(`/terms-pending/${encodeURIComponent(docId)}`)
    assertEq(pending.items.length, 1, '待答条数')
  })

  await check('Agent 回填：待答清空，记录可读', async () => {
    const r = await post('/term-answer', {
      docId,
      term: '观测手段',
      answer: '指你在界面上真正能看到的东西，比如高亮包住了哪几个字，而不是一个状态码。',
    })
    assertEq(r.body?.updated, true, '没找到待答记录')
    const pending = await get(`/terms-pending/${encodeURIComponent(docId)}`)
    assertEq(pending.items.length, 0, '回填后仍有待答')
    const { terms } = await get(`/project/${encodeURIComponent(docId)}`)
    assert(terms.some((t) => t.term === '观测手段' && t.answer), 'terms 里读不到答案')
  })

  /* ================================================ 10 覆盖 / 收获 / 渲染 */
  startModule('10 覆盖审计与收获视图')

  await check('coverage：带分母，按小节聚合，不凭空造标题', async () => {
    const c = await get(`/coverage/${encodeURIComponent(docId)}`)
    assertEq(c.total > 0, true, 'total')
    assert(c.done + c.skippedCount === c.total, `done+skipped ≠ total（${c.done}+${c.skippedCount}≠${c.total}）`)
    assert(typeof c.percent === 'number', 'percent 不是数字')
    assert(c.groups.length > 0, '没有分组')
    for (const g of c.groups) assert(g.heading && g.count > 0 && g.sampleIds.length, '分组字段缺失')
    return `已加工 ${c.done}/${c.total}（${c.percent}%）`
  })

  await check('harvested：只数拿到的东西，不给完成度百分比', async () => {
    const h = await get(`/harvested/${encodeURIComponent(docId)}`)
    assertEq(h.keyPoints > 0, true, 'keyPoints 为 0')
    assertEq(h.selfTests, 2, 'selfTests')
    assertEq(h.actions, 1, 'actions')
    assert(/已经拿到/.test(h.summary), `总结语不对：${h.summary}`)
    assert(!/%/.test(h.summary), '收获视图里出现了百分比')
    return h.summary
  })

  await check('render 接口与 project 的标注一致', async () => {
    const { html } = await get(`/render/${encodeURIComponent(docId)}`)
    const n = (html.match(/<strong class="sc-hl-\w+">/g) ?? []).length
    assertEq(n, goodItems.length, '高亮处数')
  })

  /* =================================================== 11 全链路一致性 */
  startModule('11 全链路一致性')

  await check('/projects 与 /project 的 stage 一致', async () => {
    const { items } = await get('/projects')
    const row = items.find((i) => i.id === docId)
    assert(row, '列表里找不到刚建的项目')
    const detail = await get(`/project/${encodeURIComponent(docId)}`)
    assertEq(row.stage, detail.stage, '列表 stage 与详情')
    assertEq(detail.stage, detail.next?.stage, '详情 stage 与 next.stage')
    assertEq(row.next?.action, detail.next?.action, '列表与详情的下一步')
    return detail.stage
  })

  await check('阶段与产物一一对应（删产物即掉阶段）', async () => {
    const before = (await get(`/project/${encodeURIComponent(docId)}`)).stage
    // 只动 drills.jsonl：有效复述没了，就不该再是 done
    const drills = await svc.drills(docId)
    assert(drills.length === 4, `drill 记录数异常：${drills.length}`)
    await rm(join(WS, '.study', docId, 'drills.jsonl'))
    const after = (await get(`/project/${encodeURIComponent(docId)}`)).stage
    assertEq(before, 'done', '删前 stage')
    assertEq(after, 'recalled', '删后 stage')
  })
} catch (e) {
  fail += 1
  console.log(`\n✗ 流程中断：${e?.stack ?? e}`)
  failures.push({ module: bucket?.name, name: '流程中断', error: e })
} finally {
  /* ------------------------------------------------------------ 清理 */
  const keep = process.env.STUDY_E2E_KEEP === '1'
  if (LIVE) {
    if (!keep) {
      for (const id of created.docs) {
        const dir = join(WS, '.study', id)
        if (existsSync(dir)) await rm(dir, { recursive: true, force: true }).catch(() => {})
      }
      for (const f of created.inbox) {
        if (existsSync(f)) await rm(f, { force: true }).catch(() => {})
      }
    } else if (docId) {
      console.log(`
（保留项目 ${docId}，人工看界面用）`)
    }
    const leftoverInbox = created.inbox.filter((f) => existsSync(f))
    if (leftoverInbox.length) console.log(`
注意：_inbox 有残留 ${leftoverInbox.join(', ')}`)
  }
  if (harness) await harness.close().catch(() => {})
  if (tempRoot && !keep) await rm(tempRoot, { recursive: true, force: true }).catch(() => {})
}

console.log('\n' + '='.repeat(64))
for (const m of modules) {
  const bad = m.checks.filter((c) => !c.ok)
  console.log(`${bad.length ? '✗' : '✓'} ${m.name.padEnd(28)} ${m.checks.length - bad.length}/${m.checks.length}`)
  for (const b of bad) console.log(`    └ ${b.name}\n      ${b.error}`)
}
console.log('='.repeat(64))
console.log(`通过 ${pass}　失败 ${fail}`)
if (fail) process.exitCode = 1
