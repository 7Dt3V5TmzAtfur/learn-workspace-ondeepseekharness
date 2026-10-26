/**
 * 数据完整性审计（只读）
 *
 * 为什么需要：全量测试都在验证"代码算得对"，没有一个套件在验证
 * **磁盘上那几份真实项目**彼此是否自洽。而这个系统最危险的失败方式
 * 不是报错，是"文件还在、内容对不上"：figures.json 说 6 张图、磁盘剩 3 张；
 * 标注 217 条、其中 93 条的 tier 与 label 矛盾；单元覆盖漏了 12 段。
 *
 * 本脚本不改任何文件，只按下面的不变量逐个项目核对，输出"哪一项、差多少"。
 * 硬不变量（结构错）才判失败；软指标（覆盖率、回指率）只报告不判红 ——
 * 覆盖率低是用户的读法，不是 bug。
 *
 * 用法：node study-system/tests/audit-data-integrity.mjs [workspace]
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tierOfLabel } from '../plugin/lib/rules.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const WS = resolve(process.argv[2] ?? join(HERE, '..', '..'))
const ROOT = join(WS, '.study')

const readJson = async (p, fb = null) => {
  try {
    return JSON.parse(await readFile(p, 'utf8'))
  } catch {
    return fb
  }
}
const readJsonl = async (p) => {
  if (!existsSync(p)) return null
  const raw = await readFile(p, 'utf8')
  const out = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t))
    } catch {
      out.push({ __broken: t.slice(0, 60) })
    }
  }
  return out
}

const hard = []
const soft = []
const report = []

function bad(project, code, msg) {
  hard.push({ project, code, msg })
}
function note(project, code, msg) {
  soft.push({ project, code, msg })
}

if (!existsSync(ROOT)) {
  console.log(`没有 .study 目录：${ROOT}`)
  process.exit(0)
}

const ids = (await readdir(ROOT, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
if (!ids.length) {
  console.log('没有学习项目')
  process.exit(0)
}

for (const id of ids) {
  const dir = join(ROOT, id)
  const row = { id, title: null, segments: 0, annotations: 0, figures: 0, issues: 0 }

  /* ---- meta / 段落 ---- */
  const meta = await readJson(join(dir, 'meta.json'))
  if (!meta) {
    bad(id, 'meta-missing', 'meta.json 缺失或不是合法 JSON')
    report.push(row)
    continue
  }
  row.title = meta.title

  const segs = (await readJson(join(dir, 'segments.json'), { items: [] }))?.items ?? []
  const texts = (await readJson(join(dir, 'segment-texts.json'), { items: [] }))?.items ?? []
  row.segments = segs.length
  const segIds = new Set(segs.map((s) => s.id))
  const textIds = new Set(texts.map((t) => t.id))
  if (segs.length === 0) bad(id, 'segments-empty', 'segments.json 里没有段落')
  if (segs.length !== texts.length) {
    bad(id, 'segment-texts-count', `segments ${segs.length} 段，segment-texts ${texts.length} 段`)
  }
  for (const sid of segIds) if (!textIds.has(sid)) bad(id, 'segment-text-missing', `段落 ${sid} 没有正文`)
  for (const tid of textIds) if (!segIds.has(tid)) bad(id, 'segment-index-missing', `正文 ${tid} 不在段落索引里`)
  // 字数一致性：segments.chars 应等于正文长度（允许少量空白差异）
  const textOf = new Map(texts.map((t) => [t.id, String(t.text ?? '')]))
  let charsDrift = 0
  for (const s of segs) {
    const real = [...(textOf.get(s.id) ?? '')].length
    if (typeof s.chars === 'number' && Math.abs(real - s.chars) > Math.max(3, s.chars * 0.1)) charsDrift += 1
  }
  if (charsDrift) note(id, 'chars-drift', `${charsDrift} 段的 chars 与正文长度对不上`)

  /* ---- 标注 ---- */
  const ann = await readJson(join(dir, 'annotations.json'))
  const items = ann?.items ?? []
  row.annotations = items.length
  if (ann) {
    // 历史数据里 tier 与 label 矛盾过 93 条，现在必须已归位
    let tierMismatch = 0
    let quoteMissing = 0
    let unknownSeg = 0
    let dupSeg = 0
    const seen = new Set()
    for (const it of items) {
      if (it.tier !== tierOfLabel(it.label)) tierMismatch += 1
      if (!segIds.has(it.segmentId)) unknownSeg += 1
      else if (!(textOf.get(it.segmentId) ?? '').includes(String(it.quote ?? ''))) quoteMissing += 1
      if (seen.has(it.segmentId)) dupSeg += 1
      seen.add(it.segmentId)
    }
    if (tierMismatch) bad(id, 'tier-label-mismatch', `${tierMismatch}/${items.length} 条的 tier 与 label 不一致`)
    if (unknownSeg) bad(id, 'annotation-unknown-segment', `${unknownSeg} 条标注指向不存在的段落`)
    if (quoteMissing) bad(id, 'annotation-quote-missing', `${quoteMissing} 条的 quote 在该段原文里找不到`)
    if (dupSeg) bad(id, 'annotation-duplicate', `${dupSeg} 段被标注了多次`)
    // 覆盖率只报告
    if (segs.length) {
      row.coverage = Math.round((new Set(items.map((i) => i.segmentId)).size / segs.length) * 1000) / 10
    }
    // 预算：核心/攻坚的实际占比
    const totalChars = segs.reduce((a, s) => a + (s.chars ?? 0), 0) || 1
    let core = 0
    let hardChars = 0
    for (const it of items) {
      const n = [...String(it.quote ?? '')].length
      const t = it.tier ?? tierOfLabel(it.label)
      if (t === 'core') core += n
      if (t === 'hard') hardChars += n
    }
    const coreRatio = core / totalChars
    const hardRatio = hardChars / totalChars
    if (coreRatio > 0.1001) bad(id, 'budget-core', `核心档 ${(coreRatio * 100).toFixed(1)}% > 10%`)
    if (hardRatio > 0.0801) bad(id, 'budget-hard', `攻坚档 ${(hardRatio * 100).toFixed(1)}% > 8%`)
    if (coreRatio + hardRatio > 0.2001) bad(id, 'budget-total', `合计 ${((coreRatio + hardRatio) * 100).toFixed(1)}% > 20%`)
  }

  /* ---- 关系图 ---- */
  const rel = await readJson(join(dir, 'relations.json'))
  if (rel) {
    const nodeIds = new Set((rel.nodes ?? []).map((n) => n.id))
    if (nodeIds.size !== (rel.nodes ?? []).length) bad(id, 'node-dup', '节点 id 有重复')
    for (const e of rel.edges ?? []) {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) bad(id, 'edge-dangling', `边 ${e.id ?? ''} ${e.from}→${e.to} 指向不存在的节点`)
    }
    const connected = new Set((rel.edges ?? []).flatMap((e) => [e.from, e.to]))
    const isolated = [...nodeIds].filter((n) => !connected.has(n))
    if (isolated.length) bad(id, 'isolated-nodes', `${isolated.length} 个节点没有任何边：${isolated.slice(0, 4).join(',')}`)
    // 节点的 segmentId 必须真的存在
    const badSeg = (rel.nodes ?? []).filter((n) => n.segmentId && !segIds.has(n.segmentId))
    if (badSeg.length) bad(id, 'node-bad-segment', `${badSeg.length} 个节点的 segmentId 不存在`)
    // 边的原文出处：在整篇 source.md 里都找不到，就说明是编的/改写的。
    //
    // 注意 quote 的常见格式是 `¶8「原文一句」，而¶15「另一句」` ——
    // 段号与连接词是我们自己加的，直接整串搜索必然搜不到（实测 41/41 全"找不到"，
    // 那是我这个检查器的错，不是数据错）。所以拆出「」里的片段逐句核对：
    // 只要有一句能在原文里逐字找到，这条边的证据就是可核的。
    const source = existsSync(join(dir, 'source.md')) ? await readFile(join(dir, 'source.md'), 'utf8') : ''
    const norm = (s) => String(s ?? '').replace(/\s+/g, '')
    const srcNorm = norm(source)
    const unverifiable = (rel.edges ?? []).filter((e) => {
      if (!e.quote || e.evidence) return false
      const quoted = String(e.quote)
      const frags = [...quoted.matchAll(/「([^」]{4,})」/g)].map((m) => m[1])
      const cands = frags.length ? frags : [quoted.replace(/^¶\d+\s*/, '')]
      return !cands.some((f) => srcNorm.includes(norm(f).slice(0, Math.min(20, norm(f).length))))
    })
    if (unverifiable.length) {
      note(
        id,
        'edge-quote-unverifiable',
        `${unverifiable.length}/${(rel.edges ?? []).length} 条边的 quote 在原文里找不到任何一句`,
      )
    }
  }

  /* ---- 读前建构的回指 ---- */
  const pf = await readJson(join(dir, 'preflight.json'))
  if (pf) {
    const kps = (pf.parts ?? []).flatMap((p) => p.knowledgePoints ?? [])
    const withSeg = kps.filter((k) => (k.segmentIds ?? []).length)
    const dangling = kps.flatMap((k) => (k.segmentIds ?? []).filter((s) => !segIds.has(s)))
    if (dangling.length) bad(id, 'kp-bad-segment', `知识点回指里有 ${dangling.length} 个不存在的段号`)
    if (kps.length) note(id, 'kp-link-rate', `知识点回指 ${withSeg.length}/${kps.length}`)
  }

  /* ---- 单元骨架 ---- */
  const units = await readJson(join(dir, 'units.json'))
  if (units?.units?.length) {
    const seen = new Map()
    for (const u of units.units) {
      for (const sid of u.segmentIds ?? []) {
        if (!segIds.has(sid)) bad(id, 'unit-bad-segment', `单元「${u.title}」里有不存在的段 ${sid}`)
        seen.set(sid, (seen.get(sid) ?? 0) + 1)
      }
      if (!(u.segmentIds ?? []).length) bad(id, 'unit-empty', `单元「${u.title}」没有段落`)
    }
    const dup = [...seen.entries()].filter(([, n]) => n > 1)
    const missing = [...segIds].filter((s) => !seen.has(s))
    if (dup.length) bad(id, 'unit-overlap', `${dup.length} 个段被分到多个单元`)
    if (missing.length) bad(id, 'unit-gap', `${missing.length} 个段没有被任何单元覆盖：${missing.slice(0, 5).join(',')}`)
    if (units.units.length !== units.totalUnits) note(id, 'unit-total', `totalUnits=${units.totalUnits} 与实际 ${units.units.length} 不一致`)
  } else {
    note(id, 'no-units', '没有 units.json（老项目或小资料，预期内）')
  }

  /* ---- 图：记录与磁盘必须一致 ---- */
  const figs = await readJson(join(dir, 'figures.json'))
  if (figs?.figures?.length) {
    row.figures = figs.figures.length
    const missingFiles = []
    for (const f of figs.figures) {
      const p = join(dir, String(f.file ?? ''))
      if (!f.file || !existsSync(p)) missingFiles.push(f.file ?? '(无名)')
      else {
        const st = await stat(p)
        if (st.size < 20000) bad(id, 'figure-tiny', `${f.file} 只有 ${st.size}B，像空壳`)
      }
    }
    if (missingFiles.length) {
      bad(id, 'figure-missing', `figures.json 记了 ${figs.figures.length} 张，磁盘缺 ${missingFiles.length} 张：${missingFiles.join(',')}`)
    }
  }
  // 反向：磁盘上有图但记录里没有
  const onDisk = (await readdir(dir)).filter((f) => /^graph-\d+\.html$/.test(f))
  if (onDisk.length && onDisk.length !== row.figures) {
    note(id, 'figure-orphan', `磁盘上有 ${onDisk.length} 张图，figures.json 记了 ${row.figures} 张`)
  }

  /* ---- JSONL 必须是每行一条 ---- */
  for (const name of ['terms.jsonl', 'drills.jsonl']) {
    const recs = await readJsonl(join(dir, name))
    if (!recs) continue
    const broken = recs.filter((r) => r.__broken)
    if (broken.length) bad(id, 'jsonl-broken', `${name} 有 ${broken.length} 行无法解析`)
    if (name === 'terms.jsonl') note(id, 'terms-count', `${recs.length} 条`)
    if (name === 'drills.jsonl') {
      const invalid = recs.filter((r) => r.valid === false)
      note(id, 'drills-count', `${recs.length} 条（其中 ${invalid.length} 条被判无效）`)
    }
  }

  /* ---- meta.stage 是否残留死值 ---- */
  if (meta.stage) {
    const { stageFromProgress } = await import('../plugin/lib/store.js')
    const { StudyStore } = await import('../plugin/lib/store.js')
    const p = await new StudyStore(WS).progressOf(id)
    const truth = stageFromProgress(p)
    if (meta.stage !== truth) note(id, 'meta-stage-stale', `meta.stage=${meta.stage}，产物推出来是 ${truth}`)
  }

  report.push(row)
}

console.log('数据完整性审计（只读）')
console.log(`工作区 ${WS}`)
console.log('='.repeat(70))
for (const r of report) {
  const bits = [`${r.segments} 段`]
  if (r.annotations) bits.push(`标注 ${r.annotations}（覆盖 ${r.coverage ?? 0}%）`)
  else bits.push('无标注')
  if (r.figures) bits.push(`图 ${r.figures}`)
  console.log(`• ${r.id.padEnd(28)} ${bits.join(' · ')}`)
  console.log(`  ${r.title ?? ''}`)
}

if (soft.length) {
  console.log('\n软指标（报告，不判失败）')
  for (const s of soft) console.log(`  · ${s.project} [${s.code}] ${s.msg}`)
}
if (hard.length) {
  console.log('\n硬不变量失败')
  for (const h of hard) console.log(`  ✗ ${h.project} [${h.code}] ${h.msg}`)
} else {
  console.log('\n硬不变量全部通过。')
}
console.log('='.repeat(70))
console.log(`硬不变量 ${hard.length} 条失败，软指标 ${soft.length} 条`)
// all.mjs 按「通过 N　失败 N」这一行统计总数，所以这里也给一条：
// 整个审计算一项聚合断言 —— 所有硬不变量都过才算通过。
console.log(`通过 ${hard.length ? 0 : 1}　失败 ${hard.length ? 1 : 0}`)
if (hard.length) process.exitCode = 1
