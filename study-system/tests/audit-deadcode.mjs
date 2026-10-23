/**
 * 死代码盘点。
 *
 * 只报告、不删除。删代码前必须确认：不是被动态引用、不是留给下一轮的接口。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'D:/learn/study-system'
const files = {
  'plugin/lib/markdown.js': ['parseMermaid', 'layoutGraph', 'toMermaid', 'wrapToWidth'],
  'plugin/lib/service.js': ['searchTerms', 'renderMermaid', 'graphLayout'],
  'plugin/client.js': ['KIND_LABEL', 'REL_LABEL', 'REL_ZH_UI', 'graphLayout', 'toMermaid'],
  'plugin/index.js': ['/workspaces', '/render/', "'/ingest'"],
}

let total = 0
for (const [rel, names] of Object.entries(files)) {
  const path = join(ROOT, rel)
  if (!existsSync(path)) continue
  const src = readFileSync(path, 'utf8')
  console.log(`\n=== ${rel} (${src.split('\n').length} 行) ===`)
  for (const name of names) {
    // 数出现次数：定义 1 次 + 每处调用
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'g')
    const hits = src.match(re)?.length ?? 0
    const verdict = hits <= 1 ? '只定义未使用 → 可删' : hits === 2 ? '仅 1 处引用' : `${hits} 处`
    console.log(`  ${name.padEnd(16)} ${String(hits).padStart(3)} 次  ${verdict}`)
    if (hits <= 1) total += 1
  }
}

// 跨文件引用检查：lib 里导出但全项目没人 import
console.log('\n=== 模块导出但无人 import ===')
for (const mod of ['markdown.js', 'archify-figures.js', 'rules.js']) {
  const src = readFileSync(join(ROOT, 'plugin/lib', mod), 'utf8')
  const exported = [...src.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1])
  for (const name of exported) {
    let used = 0
    for (const f of ['plugin/index.js', 'plugin/client.js', 'plugin/lib/service.js', 'plugin/lib/rules.js', 'plugin/lib/markdown.js', 'plugin/lib/store.js']) {
      const p = join(ROOT, f)
      if (!existsSync(p)) continue
      const t = readFileSync(p, 'utf8')
      if (f.endsWith(mod)) continue
      if (new RegExp(`\\b${name}\\b`).test(t)) used += 1
    }
    if (used === 0) console.log(`  ${mod} → ${name}  无人引用`)
  }
}

console.log(`\n合计疑似死代码：${total} 项`)
