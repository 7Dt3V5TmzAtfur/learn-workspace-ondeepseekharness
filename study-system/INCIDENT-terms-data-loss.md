# 事故记录：terms.jsonl 被覆盖，20 条追问记录丢失

- **发生时间**：本轮（2026-10-24）
- **影响**：`D:\learn\.study\chapter4-d6eaed\terms.jsonl` 原有 22 条记录，丢失约 20 条
- **不可恢复**：`.study/` 在 `.gitignore` 里，没有 git 版本可回溯

## 怎么丢的

我为术语追问加了"回填答案"功能：

```js
// service.js answerTerm（错误版本）
const all = await this.store.artifact(docId, 'terms.jsonl')   // 读：按行解析
all[idx] = { ...all[idx], answer: text }
await this.store.writeArtifact(docId, 'terms.jsonl', all)     // 写：走 writeJson → 整个数组
```

两个独立错误叠在一起：

1. **格式错误**：`writeArtifact` 对任何对象都调 `writeJson`，把数组写成
   `[{...},{...}]` 的 JSON 数组；而 `artifact()` 读 `.jsonl` 时是"每行一条"。
   写进去的格式和读出来的格式不是同一种。
2. **覆盖而非合并**：即便格式对了，这里也是"读全量 → 改一条 → 覆盖写全量"。
   中间只要有一次读到的不是全量（比如上一次写坏了，`readJsonl` 跳过了坏行），
   覆盖写就会把跳过的那些永久抹掉。

实际发生的就是第 2 条：第一次写坏之后我跑修复脚本，脚本按"整块 JSON"解析出 2 条，
重写后文件只剩 2 条——**修复脚本忠实执行了错误的数据**，把丢失固化了。

## 为什么没早发现

- `terms.jsonl` 没有任何测试覆盖（`run-tests.mjs` 里只有 `askTerm` 的写入测试，没有"写回后不丢历史"的断言）
- 界面上只显示条数，从 22 变 2 没有明显视觉差异
- 数据在 `.gitignore` 里，`git status` 看不到变化

## 已做的修复

1. `store.js` 新增 `writeJsonl(docId, name, records)`：明确按"每行一条"写，
   与 `artifact()` 的读法严格对称。
2. `answerTerm` 改用 `writeJsonl`。
3. `pendingTerms` 只认 `source === 'ui'` 的记录——
   否则历史里所有 `answer` 为空的 Agent 记录都会被算成"待答"，界面永远显示几十条。
4. 新增 `tests/repair-jsonl.mjs`：把被写成 JSON 数组的文件无损转回 JSONL，
   并在无法解析的行另存 `.bad` 而不是静默丢弃。

## 应该做但还没做的（防止再犯）

- [ ] **`appendJsonl` / `writeJsonl` 的往返测试**：写 N 条 → 读回 → 必须还是 N 条，
      且字段一致。这是最直接的护栏。
- [ ] **`answerTerm` 的"不丢历史"测试**：造 5 条历史 → 回填其中 1 条 → 必须还有 5 条。
- [ ] **`.study/` 纳入 git**：用户的学习数据（标注、QA、追问、复述）是他真正在乎的资产，
      现在完全没有版本保护。至少应该有一个显式的备份动作。
- [ ] **写前校验**：`writeJsonl` 写完立即回读一次，条数不对就抛错而不是静默成功。

## 教训

"读全量 → 改一条 → 覆盖写全量" 这个模式，用在 append-only 的文件上是危险的：
它把一个本来只会增长的文件，变成了可以一次写少一大截的文件。
JSONL 的正确改法是**追加新版本记录**，或者至少写完立即校验条数。
