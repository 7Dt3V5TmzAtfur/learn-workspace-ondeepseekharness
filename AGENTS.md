# AGENTS.md

个人的学习工作区，同时是一个跑在 DSH 里的学习系统 **study-copilot** 的源码仓库。
把任意格式资料导入成学习项目，依次走五个阶段：
`preflight（读前建构）→ annotate（读中加工·三色标注）→ map（知识图谱）→ recall（读后巩固）→ feynman（读后考核）`。
进度状态另有一套值：`empty → ingested → planned → annotated → mapped → recalled → done`（由产物推导，不写死）。

## 目录速览

| 路径 | 是什么 |
|---|---|
| `study-system/` | 插件源码（Host `index.js` + Client `client.js` + `lib/`）与测试 |
| `.dsh/skills/study-*/` | 认知层技能：怎么拆、怎么标、怎么问、怎么考 |
| `.study/<docId>/` | 学习项目数据，全是普通文件；部分在 git 之外（见 `.gitignore`） |
| `学习资料/` | 原始资料（`book/`），不要改 |
| `原则/` | 被引用的学习规律原文，206 篇，按 C1.02 / C1.03 分层 |
| `tools/` | 提示词模板（Z4.02 信息提炼、Z4.05 深度学习等） |
| `wayfinder/` | 工作项跟踪：`map/` 决策地图 + `tickets/` 工单 + `research/` |

## 先读什么

1. `study-system/DESIGN.md` —— 设计与取舍的唯一真值。改逻辑前必读，尤其 §0 第一性原理。
2. `handoff-study-copilot.md` —— 当前状态、端口、插件重载方式、测试入口。
3. `wayfinder/map/MAP-v4.md` —— 当前 effort（「单元」骨架）的决策索引；`MAP.md` 是上一个 effort，已收尾。
4. `study-system/INCIDENT-terms-data-loss.md` —— 数据丢失事故。动存储代码前必读。

## 三层结构，别混层

- **机制层** `study-system/plugin/`：提取、落盘、规则校验、HTTP、界面。
- **认知层** `.dsh/skills/study-*/`：拆解、标注、提问、考核的方法论。
- **数据层** `.study/<docId>/`：`annotations.json`、`relations.json`、`qa.json`、`terms.jsonl`、`drills.jsonl` 等。

界面与 Agent 调**同一套** `StudyService` 方法。规则只实现一次，界面不自己算。

## 硬约束（违反即返工）

1. **短语级高亮**：每条标注必须给 `quote`，且是原文中逐字存在的一句短语（建议 8–30 字）。概括、改写、跨行拼接都不算。
2. **三色是预算，不是装饰**：core ≤10%、hard ≤8%、合计 ≤20%，ref 不占预算。超预算 `study_save` 直接拒绝。
3. **考核只由 `drills.jsonl` 点亮**：`quiz.md` 存在不等于考过；用户没用自己话说过，就不算学会。
4. **不编造来源**：参考资料必须标 `原文` / `我的知识` / `联网检索`；没联网就不给链接，凭记忆写的要注明未核对。
5. **JSONL 只追加，不当 JSON 数组写**：`terms.jsonl` 曾因此丢 20 条且无法恢复——`.study/` 只有加工成果被 `.gitignore` 逐个捞回，原始正文与中间产物在版本控制之外。

## 验证

```bash
# 端口每次启动会变：先看当前实例，再传给测试
DSH_WEB_HOST=http://127.0.0.1:<当前端口> node study-system/tests/all.mjs
```

一次跑 11 套件（单测 / 挂载时序 / 真实 HTTP / 界面内容 / 技能文档 / 需求逐条 / 文档一致 / 架构不变量 / 组件渲染冒烟 / 样式 / Markdown 渲染），任一红即整体失败。不带 `DSH_WEB_HOST` 时三个 HTTP 套件会连默认端口而崩，不是代码坏了。
改完插件必须重载 bundle（先 `enabled=false` 再 `enabled=true`），否则接口跑旧代码。

## Agent skills

### Issue tracker

工作项在 `wayfinder/`（`map/` + `tickets/` + `research/`），**不是** `.scratch/`。见 `docs/agents/issue-tracker.md`。

### Triage labels

没有 label 机制：五个 triage role 由 ticket 头部的中文字段表达。见 `docs/agents/triage-labels.md`。

### Domain docs

词汇以 `GLOSSARY.md` 为准（领域词 + `_Avoid_` 禁词），架构与取舍以 `DESIGN.md` 为准；`docs/adr/` 尚不存在，决策沉在 ticket 的 `## Resolution`。见 `docs/agents/domain.md`。
