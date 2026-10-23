# TICKET: 关系图允许"零连接"通过——编造与遗漏都拦不住

- **状态**: open
- **类型**: `task`（AFK — 规则收紧，不需决策）
- **阻塞**: 无
- **所属**: [MAP](../../map/MAP.md)

## Question

`validateRelations` 现在的检查项：

| 检查 | 级别 | 问题 |
|---|---|---|
| `no-nodes` | error | 正常 |
| `node-dup` | error | 正常 |
| `edge-from` / `edge-to` | error | 端点必须存在，正常 |
| `edge-type` | error | 必须八种之一，正常 |
| `cycle` | error | 前置关系成环，正常 |
| `isolated` | **warn** | **孤立节点只是警告，不阻塞** |

后果：

1. **33 个节点可以有 0 条边，全部通过校验** —— 因为 `isolated` 只 warn
2. 就算出图成功，archify 画出来是一堆散点，用户看到的是"没有关系"
3. 更糟：模型可以编造关系（八种定式里随便挑一个），系统只检查类型合法，**不检查关系是否真的成立**

## 参考项目怎么做的

`relation-gate.md` + `relation-ledger.md` 的设计，调研结论摘录：

> 门禁口径对准**用户实际看到的图**：只统计 `framework→framework` 边，`framework→rule` 边存在也不计
>
> 默认 ERROR：≥2 框架 0 条可见边；有边但框架孤立。放行必须写 `relationStatus:"unsupported"` + `relationReason`，或 `independentFrameworks` 逐项写 ID+理由——**"没画线"不算理由**
>
> `relationReview` 必须**逐类**填：框架 9 种（prerequisite/sequence/causes/supports/contrasts/part_of/applies/feedback/parallel），每类 `mapped`(列真实 edgeId) 或 `unsupported`(材料理由)。**不是要求每种都存在，是要求逐个想过**

关键洞察：**"没画线"不算理由**。要么给出这条关系，要么说明为什么材料里不存在这种关系。

## 三个维度的思考

**维度一：编造 vs 遗漏（两个相反的错误）**
- 编造：模型为了"图好看"硬连一条不存在的边 → 用户学到错的关系
- 遗漏：模型懒得想，33 个节点连 5 条边 → 用户以为"这些概念没关系"

现在的校验**两个都拦不住**。

**维度二：怎么判"关系成立"？**
机械检查做不到（无法判断"方差"是否真是"标准差"的前置）。只能：
- 要求每条边带 `quote`（原文里说明这个关系的句子）
- 要求逐类表态（8 种关系各自 mapped/unsupported + 理由）

这正是参考项目的做法，而且调研明确指出：**成本最低、收益最大的一条**。

**维度三：会不会太重？**
参考项目搞了 `relation-ledger.json`（18KB）+ `content-review.json`（61KB）。这是过度设计。

我的体量应该小得多：
```json
{
  "nodes": [...33...],
  "edges": [...40...],
  "relationReview": {
    "prerequisite": { "status": "mapped", "edgeIds": ["e1","e2",...], "why": "本章主线是形态→披露的决策链" },
    "contrast": { "status": "mapped", "edgeIds": ["e17"], "why": "专用工具 vs Skill 两端对立" },
    "analogy": { "status": "unsupported", "why": "本章没有类比论证，全部是工程权衡" }
  },
  "independentNodes": [{ "id": "k31", "why": "它是背景设定，不参与本章任何论证" }]
}
```
只需要这 3 个字段，就能堵住两种错误，且体量增加不到 2KB。

## 具体要加的校验

1. `edges.length === 0 && nodes.length >= 2` → **error**（不再是 warn）
2. 每条边必须有 `quote`，且 quote 逐字出现在某段原文里 → 否则 error `edge-no-evidence`
3. `relationReview` 必须覆盖 8 种关系类型（全部出现，哪怕是 unsupported）→ 否则 error `review-incomplete`
4. `isolated` 从 warn 升级为 **error**，但可以通过 `independentNodes` 显式豁免（带理由）
5. 出图前检查：`relationReview` 里 mapped 的 edgeIds 必须真实存在于 edges 中 → 否则 error `review-edge-mismatch`

## 需要确认

1. 要求每条边给原文出处（`quote`），会不会让 Agent 生成关系图变得很慢/很啰嗦？
2. 8 种关系"逐个表态"——你愿意接受吗？还是觉得太形式主义？

## Resolution

（待填）
