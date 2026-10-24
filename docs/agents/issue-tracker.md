# Issue tracker：本地 Markdown（`wayfinder/`）

这个 repo 的工作项是普通 markdown 文件，存放在 **`wayfinder/`**。
**不是 `.scratch/`** —— setup 之前这套目录已经跑了 12 张 ticket、2 张 map，迁移没有收益。
任何 skill 默认往 `.scratch/` 写时，改写到这里。

## 目录

```
wayfinder/
├── map/
│   ├── MAP-v4.md      ← 当前 effort：「单元」骨架 v4
│   └── MAP.md         ← 上一个 effort：v3 重构（已收尾，只作历史）
├── tickets/
│   ├── 01-markdown-not-rendered.md
│   └── …              ← 平铺，全局连续编号，不按 effort 建子目录
└── research/
    ├── borrow-analysis.md
    ├── first-principles.md
    └── lfm.md
```

## 一张 map 对应一个 effort

- 命名 `wayfinder/map/MAP-<effort>.md`；当前活跃的那张写进 `AGENTS.md` 的「先读什么」。
- **只保留一个活跃 map**。旧 map 不删，标为历史，避免"两张都像真的"。
- map 是 **index 不是 store**：只放 Destination / Notes / Decisions so far / Open tickets / Frontier / Not yet specified / Out of scope；每条决策一句话 gist + 链接，细节留在 ticket 里。

## ticket 文件格式

```markdown
# TICKET: <一句话标题，写成问题而不是任务名>

- **状态**: open | claimed | resolved
- **类型**: `research` | `prototype` | `grilling` | `task`（后缀 AFK / HITL）
- **阻塞**: 无 | 13, 15
- **所属**: [MAP](../map/MAP-v4.md)

## Question

<要决定的那个问题。本仓库惯例：把证据一并写进来——真实数字、代码位置、复现方式>

## Resolution

<解决后写这里：做了什么、结论是什么、后续 ticket 依赖哪些事实>
```

字段名是中文，这是本项目既有写法。不要换成 `Status:` / `Blocked by:` 之类英文键，否则已有 12 张 ticket 与 skill 的读取逻辑会分裂成两套。

## Wayfinding 操作

- **Frontier**：扫 `tickets/`，取 `状态: open` 且「阻塞」列出的 ticket 全部 `resolved` 的；编号最小的先做。
- **Claim**：动手前把 `状态` 改成 `claimed` 并保存，避免并发 session 撞车。
- **Resolve**：追加 `## Resolution`（结论 + 证据）→ `状态` 改 `resolved` → 回活跃 map 的 `Decisions so far` 加一行 `- [标题](../tickets/NN-slug.md) — gist`。
- **Research**：结论写 `wayfinder/research/<topic>.md`，ticket 里只留指针，不粘贴全文。

## 已知偏差（先修再用）

| 偏差 | 规模 | 正确写法 |
|---|---|---|
| ticket 回指地图写成 `../../map/MAP.md`，实际解析到 `/map/`，是断链 | 12/12 | `../map/MAP-v4.md` |
| 两张 map 指 ticket 写成 `tickets/NN-…`，实际解析到 `map/tickets/` | 2 张 map | `../tickets/NN-…` |
| `MAP-v4.md` 列了 13–16 四张 ticket，文件不存在 | 4 处 | 建文件，或从 Open tickets 移除 |
| `MAP.md` 的 Notes 引用 `research/principles.md`，文件不存在 | 1 处 | 改指 `first-principles.md` 或补文件 |
| `MAP.md` 说 01 已修，`01-markdown-not-rendered.md` 仍是 `状态: open` | 1 处 | 改 `resolved` |

markdown 相对路径是相对**当前文件所在目录**解析的。地图与 ticket 各在子目录里，所以两边都要加一级 `../`。链坏了在编辑器里点不开，地图就退化成断头路。

## 当 skill 说……

- **publish to the issue tracker** → 在 `wayfinder/tickets/` 新建 `NN-<slug>.md`，编号接当前最大值；同时在活跃 map 的 `Open tickets` 加一行。
- **fetch the relevant ticket** → 读 `wayfinder/tickets/` 下对应文件。用户通常直接给路径或编号。
- **create the map** → 写 `wayfinder/map/MAP-<effort>.md`，并把上一张标为历史。
- **spec** → 本项目没有 `.scratch/<feature>/spec.md` 惯例；spec 作为 ticket 的 `## Question` 主体，或单独放 `wayfinder/research/` 并在 ticket 里链过去。
