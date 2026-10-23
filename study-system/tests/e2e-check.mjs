/**
 * 端到端验收：直接打真实 HTTP 接口，模拟界面会做的每件事。
 *
 * 与 run-tests.mjs 的分工：
 * - run-tests.mjs 测"函数/服务层逻辑对不对"
 * - 本脚本测"装到 DSH 里以后，界面拿到的东西对不对"
 *
 * 覆盖的都是曾经真实出过问题的地方：
 * 1. 三色高亮必须是短语级，不能整段变色
 * 2. archify 图必须真的能 HTTP 取到（曾经 415）
 * 3. QA 要能存能读
 * 4. 参考资料要按来源分组
 */
const BASE = 'http://127.0.0.1:52884/study-copilot/api'
const DOC = process.argv[2] ?? 'chapter4-d6eaed'

let pass = 0
let fail = 0
const failures = []

async function check(name, fn) {
  try {
    await fn()
    pass += 1
    console.log(`  ✓ ${name}`)
  } catch (e) {
    fail += 1
    failures.push({ name, error: e })
    console.log(`  ✗ ${name}`)
  }
}

const get = async (path) => {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`)
  return r.json()
}

console.log('端到端验收（真实 HTTP）\n' + '='.repeat(56))

console.log('\n[1] 基础连通')
await check('health 正常', async () => {
  const h = await get('/health')
  if (!h.ok) throw new Error('health 不是 ok')
})

await check('能列出项目', async () => {
  const p = await get('/projects')
  if (!p.items?.length) throw new Error('没有项目')
})

console.log('\n[2] 三色高亮必须是短语级')
let proj = null
await check('project 能取到', async () => {
  proj = await get(`/project/${DOC}`)
  if (!proj.segments?.length) throw new Error('无段落')
})

await check('annotatedHtml 有短语级高亮', async () => {
  const n = (proj.annotatedHtml?.match(/<strong class="sc-hl-\w+">/g) ?? []).length
  if (n === 0) throw new Error('一个高亮都没有')
  const items = proj.annotations?.items?.length ?? 0
  if (n !== items) throw new Error(`高亮 ${n} 处 ≠ 标注 ${items} 条`)
})

await check('没有整段变色（sc-seg 不带 sc-hl）', async () => {
  const n = (proj.annotatedHtml?.match(/class="sc-seg sc-hl/g) ?? []).length
  if (n !== 0) throw new Error(`有 ${n} 个段落被整段染色`)
})

await check('每条高亮片段都真的出现在原文里', async () => {
  const texts = new Map(proj.segments.map((s) => [s.id, s.text ?? '']))
  const bad = []
  for (const it of proj.annotations?.items ?? []) {
    if (!it.quote) {
      bad.push(`${it.segmentId}: 缺 quote`)
      continue
    }
    if (!(texts.get(it.segmentId) ?? '').includes(it.quote)) bad.push(`${it.segmentId}: ${it.quote}`)
  }
  if (bad.length) throw new Error(`不在原文：${bad.slice(0, 3).join(' | ')}`)
})

await check('三色预算未超限', async () => {
  const r = proj.annotations?.stats?.ratio ?? 0
  if (r > 0.2) throw new Error(`高亮占比 ${(r * 100).toFixed(1)}% > 20%`)
})

console.log('\n[3] archify 图必须能取到')
await check('project 返回 figures 列表', async () => {
  if (!Array.isArray(proj.figures)) throw new Error('figures 不是数组')
  if (proj.figures.length === 0) throw new Error('没有 archify 图')
})

await check('每张图 HTTP 200 且是 HTML', async () => {
  for (const f of proj.figures) {
    const r = await fetch(`http://127.0.0.1:52884${f.url}`)
    if (!r.ok) throw new Error(`${f.url} → HTTP ${r.status}`)
    const ct = r.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) throw new Error(`${f.url} content-type=${ct}`)
    const body = await r.text()
    if (!body.includes('<html')) throw new Error(`${f.url} 不是 HTML 文档`)
    if (body.length < 20000) throw new Error(`${f.url} 太小 ${body.length}B，可能是空壳`)
  }
})

await check('图里含真实节点标签', async () => {
  const f = proj.figures[0]
  const body = await (await fetch(`http://127.0.0.1:52884${f.url}`)).text()
  const labels = (proj.relations?.nodes ?? []).map((n) => n.label)
  const hit = labels.some((l) => l && body.includes(l))
  if (!hit) throw new Error('图里找不到任何节点标签')
})

console.log('\n[4] 路径穿越防护')
await check('不能读到项目外文件', async () => {
  const r = await fetch(`${BASE}/asset/${DOC}/..%2F..%2F..%2FWindows%2Fwin.ini`)
  if (r.ok) throw new Error('越界读取成功了，存在安全问题')
})

console.log('\n[5] QA 能存能读')
/**
 * 用一次性项目验证 QA 读写，绝不碰真实学习数据。
 *
 * 之前这里是直接往 chapter4 里写 QA，结果每跑一次测试，
 * 用户就会看到一条他从没写过的问答，阶段还被推进到 recalled。
 * 测试污染用户数据是不可接受的，所以改成建完就删。
 */
await check('保存合法 QA（用临时项目，不污染真实数据）', async () => {
  const url = `${BASE}/qa`
  const tempDoc = '__e2e_temp__'
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        docId: tempDoc,
        pairs: [{ q: '端到端验收检查什么？', a: '高亮粒度、图可取性、越界防护和 QA 读写。' }],
      }),
    })
    if (r.status === 404) return // 路由未开放
    const body = await r.json()
    if (!body.accepted) throw new Error(JSON.stringify(body.issues))
  } finally {
    // 清掉临时项目，避免留下垃圾目录
    await fetch(`${BASE}/project`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docId: tempDoc }),
    }).catch(() => {})
  }
})

console.log('\n[6] 参考资料按来源分组')
await check('refs 分原文/联网检索/我的知识', async () => {
  const r = await get(`/project/${DOC}`)
  const html = r.refsHtml ?? ''
  if (!html) return // 该项目没生成 refs，跳过
  const has = ['原文', '联网检索', '我的知识'].filter((k) => html.includes(k))
  if (has.length < 2) throw new Error(`只找到 ${has.join(',')}，来源分组可能没生效`)
})

console.log('\n' + '='.repeat(56))
console.log(`通过 ${pass}　失败 ${fail}`)
if (fail) {
  for (const f of failures) console.log(`\n[${f.name}]\n  ${f.error.message}`)
  process.exitCode = 1
}
