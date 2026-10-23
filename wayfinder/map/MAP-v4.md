# MAP: 学习工作台 v4 —— 引入「单元」骨架

> wayfinder 地图。**index，不是 store**：每条决策只存在它自己的 ticket 里，这里只给 gist + 链接。
> 每次开工只读这个文件，然后挑一张 frontier ticket 深入。

## Destination

把「单元 unit」立为学习工作台的组织骨架，让三件断裂的事接上：

1. **原文 20 个真实小节 ↔ preflight 的"部分" ↔ 图谱知识点** 用同一套 ID 串起来
2. **每个知识点能一键跳回原文那一句**（现状：18 个知识点，0 个有段落回指）
3. **进度按"单元"算**，按段落算没有意义（"3/20 单元"比"37/182 段"清楚）

判据：用户在一份真实资料上能回答"这份资料分几块、我现在在第几块、这块讲了什么、这块的原文在哪"，且这是**从数据里读出来的，不是模型临时编的**。

**本轮只做数据层**（用户选择 C）：`units.json` + 双向映射 + 校验。界面下一轮。

## Notes

- 领域：DSH 插件（Host `index.js` + Client `client.js`）+ 7 个技能 + 本地 markdown tracker（`wayfinder/`）
- 用户明确指示：
  - **「界面设计不学它，我们自己的更好；只学内容组织、结构、导航、流程、视觉逻辑」**
  - **「不要太复杂」** —— 这是硬约束，任何"再加一层账本"的方案直接否决
  - 判断由我做，不要把判断推回给用户
- 必读：`research/borrow-analysis.md`（三维度借鉴分析）、`research/lfm.md`（参考项目原始调研）
- 参考项目：`dmoshehun-prog/learn-from-materials`（MIT）。**只抄三条**：单元作为骨架、双向映射、关系必须落回原文。
- 硬约束：`D:\learn\原则\` 下的学习规律；用户三色/整行底色/archify 三条不可回退

## 已程序化证实的缺陷（本轮新证据）

| # | 缺陷 | 硬数字 | 后果 |
|---|---|---|---|
| A | 知识点无法回到原文 | **18 个知识点，0 个带 segmentIds** | 用户看到"两个审视特征"，不知道原文哪一段说的 |
| B | 图谱节点与段落脱钩 | **33 节点，0 个带 segmentId**；40 边仅 25 条有 | 图上点节点无法跳原文；边是"空中连线" |
| C | preflight 的 parts 与原文小节无关 | 4 个 parts，**0 个带 segmentIds**；原文有 **20 个真实小节** | 模型编的切法 ≠ 资料本身的结构 |
| D | 正向审计掩盖质量问题 | 覆盖 182/182 = 100%，但 **16 条 quote ≤ 4 字** | "维度""按需""比单写"这种词等于没提炼 |

D 是 A/B/C 的必然结果：没有单元层，标注就只能逐段孤立体地做，做出来自然碎。

## Decisions so far

- [借鉴分析：抄什么不抄什么](research/borrow-analysis.md) — 三维度 × 每维 3 角度；结论：只抄"单元骨架 / 双向映射 / 关系落回原文"，坚决不抄它的十层审计文书与两档深度模式

## Open tickets

| Ticket | 类型 | 要决定什么 |
|---|---|---|
| [13 单元的定义与粒度](tickets/13-unit-definition.md) | grilling | 一个单元对应原文小节的哪一层？20 个三级小节全要，还是按一级/二级合并成 8 个？ |
| [14 单元内部装什么](tickets/14-unit-content.md) | grilling | 参考项目有 10 个格子，砍到几个？ |
| [15 双向映射怎么校验](tickets/15-bidirectional-mapping.md) | task | takeaway ↔ 段落 两侧断裂怎么判、报什么错 |
| [16 现有数据的迁移路径](tickets/16-data-migration.md) | task | 182 段 / 18 知识点 / 33 节点怎么无损挂到单元上 |

## Frontier

**无阻塞，可立刻做**：16（迁移路径）
**需要我判断后再做**：13（粒度）、14（格子）、15（校验口径）

## Not yet specified

- 界面上单元列表长什么样（本轮不做，但要为它留位置）
- 一份多章的书怎么组织（现在一个 docId 一份资料；20 个小节是单章内部结构）
- QA 是按单元出还是整章出？（现在整章 12 条，按单元可能更聚焦）

## Out of scope

- 它的十层审计文书（coverage-audit / reverse-coverage / summary-ledger / content-review / action-rule-ledger / relation-ledger / source-manifest / source-map / material-security / performance-report）
- 它的两档深度模式（quick / systematic）—— 用户没提，加了只是多一个选择负担
- 它的界面与视觉设计 —— 用户明确说我们自己的更好
- `unit-dependency-map.json` 增量更新表 —— 单用户本地工具，无增量场景
- 移动端、协作、云同步
