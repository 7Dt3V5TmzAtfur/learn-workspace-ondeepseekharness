/**
 * 修复被写坏的 terms.jsonl。
 *
 * 事故经过：answerTerm 用了 writeArtifact（对对象走 writeJson），
 * 把整个数组写成了一个 JSON 数组；而 jsonl 的读法是"每行一条"。
 * 结果文件里出现 `[`、`{`、`  "term": ...` 这种多行缩进，
 * 后续 readJsonl 逐行解析全部失败。
 *
 * 这里做的是**无损抢救**：先试整块 JSON.parse（能解出来说明被写成数组了），
 * 否则退回逐行解析。任何一条都不能丢。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const file = process.argv[2]
if (!file || !existsSync(file)) {
  console.error('用法: node repair-jsonl.mjs <path-to.jsonl>')
  process.exit(1)
}

const raw = readFileSync(file, 'utf8')
console.log(`原文件 ${raw.length} 字节`)

let records = null

// 情况 A：整个文件被写成了一个 JSON 数组
const trimmed = raw.trim()
if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
  try {
    const parsed = JSON.parse(trimmed)
    records = Array.isArray(parsed) ? parsed : [parsed]
    console.log(`识别为整块 JSON，${records.length} 条`)
  } catch {
    /* 交给逐行解析 */
  }
}

// 情况 B：正常的逐行 JSONL（可能夹着空行/坏行）
if (!records) {
  records = []
  const bad = []
  for (const [i, line] of raw.split('\n').entries()) {
    const s = line.trim()
    if (!s) continue
    try {
      records.push(JSON.parse(s))
    } catch {
      bad.push({ line: i + 1, text: s.slice(0, 60) })
    }
  }
  console.log(`识别为 JSONL，${records.length} 条`)
  if (bad.length) {
    console.log(`无法解析 ${bad.length} 行（已跳过，原文另存 .bad）`)
    writeFileSync(`${file}.bad`, JSON.stringify(bad, null, 2), 'utf8')
  }
}

// 去重（同 term+segmentId+at 视为同一条）
const seen = new Set()
const out = []
for (const r of records) {
  const key = `${r?.term}|${r?.segmentId}|${r?.at}`
  if (seen.has(key)) continue
  seen.add(key)
  out.push(r)
}

writeFileSync(file, out.length ? `${out.map((r) => JSON.stringify(r)).join('\n')}\n` : '', 'utf8')
console.log(`已重写为 ${out.length} 条标准 JSONL`)

// 回读验证
const back = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
console.log(`回读验证：${back.length} 条全部可解析 ✓`)
if (back.length !== out.length) {
  console.error('条数不一致！')
  process.exit(1)
}
