---
name: study-map
description: 知识图谱。也就是知识点逻辑衔接图——把一份资料里的知识点抽成节点，用八种定式关系（前置/整体部分/对比/因果/例证/应用/次序/类比）连成有向图，校验前置关系不成环；保存后系统自动调用 archify 技能生成可交互的 HTML 图（节点多时自动拆成多张，保证字号可读）。当用户要求"画知识结构图"、"知识点之间什么关系"、"给我一张逻辑图"、"学习顺序怎么排"时使用。
whenToUse: 已有标注（stage = annotated）；用户想要结构图/关系图/学习路径；需要判断先学哪个再学哪个。
---

# 知识图谱（study-map）

## 为什么需要这张图

单点知识靠记忆，**关系**靠理解。读完之后脑子里只有一堆散点，等于没学会。

这张图要回答三个问题：
1. 哪个知识点是**地基**（别人都依赖它）？
2. 哪两个容易**混**（对比关系）？
3. 我的**学习顺序**应该是什么（前置链的拓扑序）？

## 图是怎么画出来的：交给 archify

**你不需要自己画图，也不该给用户 Mermaid 源码了事。**

`study_save { kind: 'relations' }` 保存成功后，系统会**自动**：

1. 把关系数据翻译成 archify 的 architecture 图
2. 调 archify CLI 跑完 validate → deliver → check → browser-check 四道质量门
3. 产出独立 HTML，存到项目目录
4. 界面「知识图谱」页签用 iframe 直接展示

所以你的任务是**把关系想清楚**，不是操心排版。

### 为什么节点多会自动拆图

archify 的 browser-check 会按视口缩放判断字号可读性。33 个节点铺出来的画布会超过 2200px 宽，
缩到 1440 视口后 12.5px 的字变成 4px，就直接判定"看不清"并拒绝出图。

所以系统会把大图**按根节点拆成多张**（每张 ≤18 节点），每张是一个"从一个基础概念长出来的知识簇"。
实测 chapter4 的 33 个节点拆成 6 张后，全部一次通过质量门。

**这不是妥协，是必要的**：一张 33 节点的蜘蛛网本来也没人看得清。

## 关系定式（八选一，别自创）

参照 `思维地图八大可视化模组`：

| relation | 含义 | 例句 |
|---|---|---|
| `prerequisite` | A 是理解 B 的前提 | 「方差」是「标准差」的前置 |
| `part-of` | A 属于 B | 「中位数」属于「集中趋势度量」 |
| `contrast` | A 与 B 相互区分、易混 | 「精确率」对比「召回率」 |
| `cause` | A 导致 B | 「样本偏差」导致「结论失效」 |
| `example-of` | A 是 B 的例子 | 「抛硬币」是「伯努利试验」的例子 |
| `application` | A 用于 B | 「大数定律」用于「保险定价」 |
| `sequence` | A 先于 B（纯先后） | 「先归一化」先于「再降维」 |
| `analogy` | A 与 B 同构 | 「信息熵」类比「热力学熵」 |

**这些关系会映射成不同的线型**：
- `prerequisite` / `cause` → 粗实线（主线）
- `contrast` / `analogy` → 虚线（"不是主流程"）
- 其余 → 细实线

用户看图的图例里会写明，所以你用对关系类型很重要。

## 流程

1. 从 `preflight.json` 的 `knowledgePoints` 拿候选，从 `annotations.json` 的 `#d`/`#s` 段补漏。
2. 节点要**可数**：15–40 个。超过 40 说明切太碎，合并同义项。
3. 每个节点给：
   - `id`：短英文（`variance`、`proxy-tool`），别用中文，archify 的 id 有字符限制
   - `label`：中文名，**这是图上显示的字**，控制在 20 字内
   - `kind`：`concept` / `premise` / `principle` / `method` / `example` / `problem` / `anti-pattern` / `risk` / `protocol` / `taxonomy` / `tool-type`（决定节点颜色）
4. 连边。每个节点**至少一条边**（孤立节点说明你还没想清它和谁有关）。
5. 提交：

```
study_save { docId, kind: 'relations', payload: {
  direction: 'TD',
  nodes: [
    { id: 'aci', label: 'ACI：工具对应 Agent 的目标', kind: 'concept' },
    { id: 'form-spectrum', label: '能力形态谱系', kind: 'concept' },
    { id: 'gen-default', label: '默认取向：通用优于专用', kind: 'principle' }
  ],
  edges: [
    { from: 'aci', to: 'form-spectrum', relation: 'prerequisite' },
    { from: 'gen-default', to: 'form-spectrum', relation: 'cause' }
  ]
} }
```

6. 看返回：
   - `check.issues` 有 `cycle` → 前置关系成环，说明理解有问题，**必须**重想依赖方向，别绕过。
   - `isolated` 警告 → 补边或删节点。
   - `figures` → archify 生成结果。`figures.ok === true` 说明出图成功；`figures.figures[]` 里每张有 `index`/`nodeCount`/`sizeBytes`。
   - 如果 `figures.ok === false`，看 `reason` 和每张的 `diagnostics`。

## archify 失败时怎么办

`diagnostics` 里常见两类：

| code | 原因 | 你该做什么 |
|---|---|---|
| `browser-check/projected-text-readability` | 图太宽，字缩得看不清 | 节点太多，合并同义节点，或减少数值型节点 |
| `layout/component-overlap` | 节点标签太长互相压住 | 缩短 `label` |

**不要**去改 `direction` 或硬塞坐标绕过 —— 那是系统的事，绕过只会产出更差的图。

## 回答里必须给出

1. 一句话概括图的形状（"一棵以 X 为根的树" / "两个中心 + 若干卫星" / "一条链"）
2. **地基节点**：入度为 0 的那几个 —— 这是先学的
3. **枢纽节点**：出度最高 —— 通吃关键，值得多花时间
4. **易混对**：所有 `contrast` 边，建议做成对比表
5. 学习顺序（拓扑序）
6. 一共生成了几张图、每张多少节点 —— 用户要知道去界面哪里看

## 常见失败

- **把章节目录当知识点** → 那不是知识点，是标题。知识点要能被考。
- **所有关系都用 prerequisite** → 八种定式白设计了。对比用 `contrast`，例证用 `example-of`。
- **节点太细**（一句话一个节点）→ 图不可读，也过不了 archify 的可读性门。
- **label 太长** → archify 报 component-overlap。`label` 是图上的字，不是解释。
- **不校验就交付** → 环没被发现，学习顺序是错的，用户按它学要返工。
- **只给 Mermaid 源码** → 用户要的是能看的图。系统已自动生成 HTML，告诉用户去「知识图谱」页签看。
