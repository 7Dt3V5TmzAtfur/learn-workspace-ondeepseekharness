# 领域文档

Engineering skills 探索这个 repo 时，如何消费它的领域知识。
本仓库是 **single-context**：一个插件、一套技能、一份设计真值，没有子包边界。

## 词汇与决策的出处（2026-10-24 更新）

`GLOSSARY.md` 已建立；`docs/adr/` 仍不存在。按下面顺序取：

| 顺序 | 来源 | 取什么 |
|---|---|---|
| 1 | `GLOSSARY.md` | 已定死的项目术语：资料 / 学习项目 / 资料库 / 导入 / 预览 / 右键菜单 |
| 2 | `study-system/DESIGN.md` | 设计取舍、§0 第一性原理、§1「哪条学习规律落到哪个模块」 |
| 3 | `study-system/README.md` | 用户可见行为：六阶段、三色预算、`quote` 校验错误码 |
| 4 | `.dsh/skills/study-*/SKILL.md` | 流程词汇：每个阶段做什么、产物叫什么 |
| 5 | `原则/` | 学习规律原文，引用时必须给完整路径 |

`GLOSSARY.md` 里标注了 `_Avoid_` 的同义词不要再使用——例如「上传」应说「导入」，「文档/文件」在指代学习对象时应说「资料」。

`原则/` 是三级的：`原则/C1.03_深度阅读_以我为主/C1.03.b_阅读战略_知识生态/反完成主义阅读.md`。
`DESIGN.md` 里的 `C1.03.b/反完成主义阅读.md` 只是简写，**不是可解析路径**，写给用户或写进 issue 时要展开。

## 必须沿用原义的词

| 词 | 定义 | 权威出处 |
|---|---|---|
| 六阶段 | `ingested → planned → annotated → mapped → recalled → drilled` | `plugin/lib/service.js` 的 `STAGE_ORDER` |
| quote | 原文中逐字存在的一句短语，建议 8–30 字；概括、改写、跨行拼接都不算 | `README.md`「高亮是短语级」 |
| 三色 / 档 | `core` 蓝 ≤10%、`hard` 红 ≤8%、`ref` 绿不占预算、合计 ≤20% | `README.md`「三色注意力是硬约束」 |
| 单元 unit | v4 的组织骨架：原文小节 ↔ 读前 parts ↔ 图谱知识点 用同一套 ID 串起来 | `wayfinder/map/MAP-v4.md` |
| frontier | 未关闭、无未完成阻塞、未被 claim 的 ticket | `docs/agents/issue-tracker.md` |
| 渐构标签 | 七类段落角色 `#d` 定义 / `#e` 例子 / `#q` 提问 / `#s` 总结 / `#t` 迁移 / `#c` 备注 / `#v` 验证 | `tools/渐构+文案拆解标注.md` |

写 issue 标题、spec、refactor 提案、测试名时用这些词，不要另造同义词——把「单元」叫成「章节块」、把 `quote` 叫成「摘录」，会让 grep 与技能约束同时失效。

## 决策记录在哪

`docs/adr/` 目前不存在。决策散在三处，按权威度排序：

1. `study-system/DESIGN.md` §0 / §1 —— 跨轮次仍成立的取舍（第一性原理、明确不做什么）。
2. ticket 的 `## Resolution` —— 单个问题的结论与证据，形如 `wayfinder/tickets/11-recalled-stage-missing.md`。
3. `wayfinder/map/MAP-*.md` 的 `Decisions so far` —— 只有一行 gist，细节在 ticket。

**什么时候才建 ADR**：当某条决策脱离原 ticket 单独成立、且后续改动会反复引用它（例：「`quote` 必须逐字存在」「高亮是预算不是装饰」「覆盖率只提示不阻断」），提炼成 `docs/adr/NNNN-<slug>.md`，并在原 ticket 里回链。只有这种时候才建目录。

## 与既有决策冲突时

不要静默覆盖。按本仓库写法直接指出来，并给出可点开的出处：

> 与 `DESIGN.md` §0「不设每单元 N 个知识点配额」冲突，但值得重开，因为……

冲突对象在 `原则/` 里时，引具体文件（含三级目录）；在 ticket 里时，给编号 + 标题，不要只写裸 `#11`。
