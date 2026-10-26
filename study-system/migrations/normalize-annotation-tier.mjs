/**
 * 一次性迁移：把磁盘上的标注归位、把 meta.stage 死值清掉、补内容指纹。
 *
 * 背景（三件都是"读的时候已经绕过、但文件还在说谎"）：
 *
 * 1. `tier` 字段与 `label` 矛盾。档位的唯一规则是"由标签推"（rules.tierOfLabel），
 *    但历史版本把两者各存了一份。实测 chapter1-940885 有 93/217 条对不上，
 *    其中 73 条 #d 定义被存成 ref —— 于是"拿到 123 处核心要点"被数成 50 处。
 *    service 读的时候已经改成按标签推，这里把磁盘也改成一致的，
 *    免得脚本、导出、用户手看 json 时看到另一套数字。
 *
 * 2. `meta.stage` 是从没人维护的死值。实测两个项目里它和产物推导出的阶段
 *    互相矛盾（写着 mapped，产物其实是 recalled）。没有读取方，但留着就是
 *    第二个真相。saveMeta 现在会主动剔掉它，这里把历史文件一起清干净。
 *
 * 3. 老项目没有 `contentHash`，重复导入认不出"这份已经在库里了"。
 *    优先按 `original/<源文件>` 的字节算（和 ingest 时同一份输入），
 *    没有原件才退回 source.md —— 后者只对 md/txt 类成立，其他格式宁可不补，
 *    也不能给一个错的指纹（错指纹会让"改过的文件"被误判成同一份）。
 *
 * 为什么不用 writeArtifact：它会顺带 saveMeta({}) 刷新 updatedAt，
 * 而列表按 updatedAt 排序 —— 一次迁移把整个资料库的顺序打乱，是不可接受的副作用。
 * 所以这里自己写文件（临时文件 + rename），meta 只改必要的键、保留时间戳。
 *
 * 用法：
 *   node study-system/migrations/normalize-annotation-tier.mjs            # 预演，只报不改
 *   node study-system/migrations/normalize-annotation-tier.mjs --apply     # 真写
 *   ... --ws=D:\learn                                                     # 指定工作区
 */
import { readFile, writeFile, rename, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const WS = resolve(process.argv.find((a) => a.startsWith('--ws='))?.slice(5) ?? join(HERE, '..', '..'))
const APPLY = process.argv.includes('--apply')
const ROOT = join(WS, '.study')

const { summarizeAnnotations, tierOfLabel } = await import(
  `file://${join(HERE, '..', 'plugin', 'lib', 'rules.js')}`
)

const readJson = async (p, fb = null) => {
  try {
    return JSON.parse(await readFile(p, 'utf8'))
  } catch {
    return fb
  }
}
async function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
  await rename(tmp, file)
}

/** 只对这些格式，source.md 与源文件字节等价（纯文本抽取不改变内容）。 */
const TEXT_FORMATS = new Set(['md', 'markdown', 'txt', 'text', 'html', 'htm'])

if (!existsSync(ROOT)) {
  console.log(`没有 .study 目录：${ROOT}`)
  process.exit(0)
}

console.log('迁移：标注归位 + 清理 meta.stage + 补内容指纹')
console.log(`工作区 ${WS}`)
console.log(APPLY ? '模式：真写' : '模式：预演（加 --apply 才会改文件）')
console.log('='.repeat(68))

const docs = (await readdir(ROOT, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
let touched = 0

for (const id of docs) {
  const dir = join(ROOT, id)
  const changes = []
  let writeAnn = null
  let writeMeta = null

  /* ---- 1. 标注归位 ---- */
  const ann = await readJson(join(dir, 'annotations.json'))
  if (ann?.items?.length) {
    const segs = (await readJson(join(dir, 'segments.json'), { items: [] }))?.items ?? []
    const totalChars = ann.stats?.totalChars || segs.reduce((a, s) => a + (s.chars || 0), 0)
    let fixed = 0
    const items = ann.items.map((it) => {
      const want = tierOfLabel(it?.label) ?? it?.tier
      if (want && it?.tier !== want) {
        fixed += 1
        return { ...it, tier: want }
      }
      return it
    })
    const before = ann.stats ?? {}
    const stats = summarizeAnnotations(items, totalChars)
    // 逐键比较，不比较 JSON 字符串：对象键序不同会被误判成"变了"，
    // 于是每次预演都报"需要改写"，真跑一遍又只是把同样的内容重写一次。
    const sameFlat = (a, b) =>
      a && b && Object.keys({ ...a, ...b }).every((k) => Number(a[k] ?? 0) === Number(b[k] ?? 0))
    const statsChanged =
      !before.tierRatio ||
      before.colorRatio === undefined ||
      !sameFlat(before.tierRatio, stats.tierRatio) ||
      !sameFlat(before.byTier, stats.byTier) ||
      Number(before.ratio ?? -1) !== Number(stats.ratio) ||
      Number(before.colorRatio ?? -1) !== Number(stats.colorRatio)
    if (fixed || statsChanged) {
      writeAnn = { ...ann, items, stats }
      changes.push(`标注 ${ann.items.length} 条：${fixed} 条 tier 归位${statsChanged ? '，stats 重算' : ''}`)
      if (fixed) {
        const coreBefore = ann.items.filter((i) => i.tier === 'core').length
        const coreAfter = items.filter((i) => i.tier === 'core').length
        changes.push(`核心要点数 ${coreBefore} → ${coreAfter}`)
      }
    }
  }

  /* ---- 2. meta：删死值、补指纹 ---- */
  const metaPath = join(dir, 'meta.json')
  const meta = await readJson(metaPath)
  if (meta) {
    const next = { ...meta }
    let dirty = false
    if ('stage' in next) {
      const stale = next.stage
      delete next.stage
      dirty = true
      changes.push(`meta.stage=${stale} 删除（阶段由产物推导）`)
    }
    if (!next.contentHash) {
      const original = next.sourceName ? join(dir, 'original', next.sourceName) : null
      let from = null
      if (original && existsSync(original)) from = original
      else if (TEXT_FORMATS.has(String(next.format ?? '').toLowerCase()) && existsSync(join(dir, 'source.md'))) {
        from = join(dir, 'source.md')
      }
      if (from) {
        next.contentHash = createHash('sha1').update(await readFile(from)).digest('hex')
        dirty = true
        changes.push(`补 contentHash（取自 ${from === original ? 'original/' + next.sourceName : 'source.md'}）`)
      }
    }
    if (dirty) writeMeta = next
  }

  if (changes.length) {
    touched += 1
    console.log(`\n• ${id}`)
    for (const c of changes) console.log(`    ${c}`)
    if (APPLY) {
      if (writeAnn) await writeJsonAtomic(join(dir, 'annotations.json'), writeAnn)
      if (writeMeta) await writeJsonAtomic(metaPath, writeMeta)
    }
  }
}

console.log('\n' + '='.repeat(68))
console.log(`${touched} 个项目${APPLY ? '已改写' : '需要改写'}`)
if (!APPLY && touched) console.log('确认无误后加 --apply 执行。')
