# Triage 标签

本仓库没有 label 机制（无 GitHub/GitLab，也没有 label 文件）。
五个 canonical triage role 用 ticket 头部的**中文字段**表达，写入 `wayfinder/tickets/NN-slug.md`。

## Role 与字段的映射

| Role | 本仓库写法 | 含义 |
|---|---|---|
| `needs-triage` | 不写 `- **Triage**:` 行 | 还没评估过。**缺这行即视为未 triage**，不必显式写 |
| `needs-info` | `- **Triage**: needs-info` | 等用户补信息；agent 不得自行往下推 |
| `ready-for-agent` | `- **Triage**: ready-for-agent` | 规格够清楚，AFK agent 可独立做完 |
| `ready-for-human` | `- **Triage**: ready-for-human` | 只有用户本人能定：审美、取舍、门槛松紧 |
| `wontfix` | `- **Triage**: wontfix` + `- **状态**: resolved` | 明确不做；原因写进 `## Resolution`，并进 map 的 `Out of scope` |

`- **Triage**:` 是新增字段，**只在 triage 真正跑过之后才写**。不要为了整齐给存量 ticket 批量补值。

## 与 `- **类型**:` 的区别

两者混用会把「怎么解」当成「处理到哪一步」：

| 字段 | 回答什么 | 取值 |
|---|---|---|
| `- **类型**:` | 这张 ticket 靠什么方式解决 | `research` / `prototype` / `grilling` / `task` |
| `- **Triage**:` | 它现在处在 triage 的哪个状态 | 五个 role |

类型后缀的 `AFK` / `HITL` 是**执行方式**，不是 triage 状态。一张 `grilling` ticket 在 triage 里可能先 `needs-info`、再去 `ready-for-human`；一张 `task` ticket 也可能因为缺细节卡在 `needs-info`。

## 单人仓库的语义偏移

maintainer 只有用户一人，没有外部 reporter，几个 role 的含义要跟着调整：

- `ready-for-human` ≈ **需要用户拍板**。凡是涉及视觉形态、指标松紧、品味判断的，agent 不得替用户回答——`grilling` 型 ticket 尤其如此。
- `needs-info` 的"reporter"就是用户本人，triage notes 直接写成待确认问题清单。
- `wontfix` 必须留原因。本项目已有一份成文的"不做什么"，见 `MAP-v4.md` 的 `Out of scope`。

## 现状校准（2026-10-24）

12 张 ticket 都没有 `Triage` 行，按未 triage 处理。按 `类型` 可先给粗判：

| 初判 | tickets |
|---|---|
| 倾向 `ready-for-agent`（AFK） | 01、04、05、06、08（11 已 resolved） |
| 倾向 `ready-for-human`（HITL） | 02、03、07、09、10、12 |

这只是从执行方式推出来的初判，**不是 triage 结论**。真跑 `/triage` 时仍要逐张核规格是否够——AFK 只说明"不需要用户答"，不说明"规格已写清"。
