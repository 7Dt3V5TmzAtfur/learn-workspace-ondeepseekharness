# learn

> 个人学习工作区 + study-copilot 学习系统源码

把任意格式资料导入学习项目，走通五个阶段：
`preflight（读前建构）→ annotate（读中加工·三色标注）→ map（知识图谱）→ recall（读后巩固）→ feynman（读后考核）`。

---

## 目录结构

| 路径 | 内容 |
|---|---|
| `study-system/` | 插件源码（Host `index.js` + Client `client.js` + `lib/`）与测试 |
| `.dsh/skills/study-*/` | 认知层技能：怎么拆、怎么标、怎么问、怎么考 |
| `.study/<docId>/` | 学习项目数据（加工成果入库，原始正文不入库） |
| `原则/` | 被引用的学习规律原文，206 篇 |
| `学习资料/` | 原始资料（不入库） |
| `tools/` | 提示词模板 |
| `wayfinder/` | 工作项跟踪：决策地图 + 工单 |

---

## 快速开始

### 先读什么

1. `AGENTS.md` —— 项目定位、三层结构、硬约束
2. `study-system/DESIGN.md` —— 设计与取舍的唯一真值
3. `handoff-study-copilot.md` —— 当前状态与测试入口
4. `wayfinder/map/MAP-v4.md` —— 当前 effort 的决策索引

### 验证

```bash
# 先验源码（自带进程内 HTTP 服务，不需桌面端在跑）
node study-system/tests/e2e-user-path.mjs

# 打真实部署（验有没有忘记重载）
node study-system/tests/e2e-user-path.mjs --live

# 只读：核对磁盘上真实项目是否自洽
node study-system/tests/audit-data-integrity.mjs

# 跑全部 15 套件（需传当前端口）
DSH_WEB_HOST=http://127.0.0.1:<当前端口> node study-system/tests/all.mjs
```

---

## 硬约束（违反即返工）

1. **短语级高亮**：每条标注必须给 `quote`，且是原文中逐字存在的一句短语（建议 8–30 字）
2. **三色是预算**：core ≤10%、hard ≤8%、合计 ≤20%，ref 不占预算；超预算 `study_save` 直接拒绝
3. **考核只由 `drills.jsonl` 点亮**：`quiz.md` 存在不等于考过；用户没用自己话说过，就不算学会
4. **不编造来源**：参考资料必须标 `原文` / `我的知识` / `联网检索`
5. **JSONL 只追加，不当 JSON 数组写**：`terms.jsonl` 曾因此丢 20 条且无法恢复

---

## 三层结构（别混层）

| 层 | 位置 | 职责 |
|---|---|---|
| 机制层 | `study-system/plugin/` | 提取、落盘、规则校验、HTTP、界面 |
| 认知层 | `.dsh/skills/study-*/` | 拆解、标注、提问、考核的方法论 |
| 数据层 | `.study/<docId>/` | annotations / relations / qa / terms / drills 等加工成果 |

界面与 Agent 调**同一套** `StudyService` 方法，规则只实现一次。

---

## 提交范围约定

- ✅ 入库：源码、`.gitignore` 用 `!` 捞回的 `.study/` 加工成果（`meta.json` / `annotations.json` / `relations.json` / `qa.json` / `terms.jsonl` / `drills.jsonl` / `quiz.md` 等）
- ❌ 不入库：原始资料（`_inbox/`、`学习资料/`、`.study/*/source.md`、`segments.json` 等中间产物）、运行时产物（`.workbuddy/`、`.dsh-acl-report/`、`.tmp-*.cjs`）

---

## 相关文档

- `AGENTS.md` — 项目说明
- `GLOSSARY.md` — 领域词汇与禁词
- `docs/agents/` — Agent 协作指南（issue tracker / triage labels / domain docs）
- `study-system/INCIDENT-terms-data-loss.md` — 数据丢失事故复盘（动存储代码前必读）

---

## License

个人学习工作区，未设置开源协议。
