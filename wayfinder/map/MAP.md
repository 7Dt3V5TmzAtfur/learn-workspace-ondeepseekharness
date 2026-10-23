# MAP: 学习工作台 v3 重构

> wayfinder 地图。这是 **index**，不是 store：每条决策只存在它自己的 ticket 里，这里只给一句话 gist + 链接。
> 用法：每次开工只读这个文件，然后挑一张 frontier ticket 深入。**不要在这里写细节。**

## Destination

产出一份**可执行的 v3 重构方案**：一个逻辑自洽的学习工作台——用户打开就知道"这份资料学什么、怎么考、哪里是重点"；读的时候关键短语三色浮出、每段有渐构标签与整行底色；读完整章能做 QA 自测与费曼考核；知识点关系图是 archify 出的可交互 HTML。

判据：用户逐项审阅签字。**本 map 只产出决策与方案，不写实现代码**（实现是签字后的下一件事）。

## Notes

- 领域：DSH 插件（Host `index.js` + Client `client.js`）+ 7 个技能（`.dsh/skills/study-*`）+ 本地 issue tracker（`wayfinder/`）
- 必读技能：`grilling`（HITL 决策）、`domain-modeling`（术语统一）、`archify`（关系图）
- 参照：`dmoshehun-prog/learn-from-materials`（1070★）——吸其长，不照抄其重（它自己承认"审计体量超过知识体量"）
- 硬约束：必须落到 `D:\learn\原则\` 下的学习规律（28 条已提炼，见 `research/principles.md`）
- 用户原话三条不可违背：
  1. 「标注整一个行是有颜色的，而不是整个段落都是颜色，也不是只有符号有颜色」
  2. 「三种不同的颜色来加粗原文内容」做注意力机制，不是每句都一样
  3. 图谱子页面「嵌入 archify 生成的 HTML」，不是 Mermaid、不是手绘 SVG
- 现状基线：v2.0 tag；单测 95 / 需求审计 18 / 端到端 13 / 界面审计 44 全绿——**但测试全绿不等于界面可用**（见下）
- 调研已归档：`research/lfm.md`（参考项目）、`research/principles.md`（学习规律）

## 现状体检结论（四路并行调研的共同发现）

用户说"很多错误"，程序化核实后确认这些都是真的：

| # | 问题 | 证据 | 严重度 |
|---|---|---|---|
| 1 | 正文 Markdown 完全没渲染 | `annotatedHtml` 里 `**` 字面量 **422 处**；表格被逐行转成 `<p>` 竖排崩坏 | 致命 |
| 2 | 7 个宿主 class 没有 CSS | `sc-tag-en`/`sc-seg-note`/`sc-pf-sec`/`sc-list`/`sc-table`/`sc-pf-body`/`sc-kp-b`；`audit-styles.mjs` 可复现 | 致命 |
| 3 | 「整行有颜色」没实现 | `data-tier` 输出到 DOM（37 处），但**零个 CSS 选择器用它**；`.sc-seg` 背景 transparent | 致命 |
| 4 | 三色撞状态色且深色不可见 | 蓝`#4f8ff7`/红`#e5484d`/绿`#30a46c` = DSH error/warn/success；全 `rgba(...,.10)`；`data-ds-dark-theme` 出现 0 次 | 严重 |
| 5 | 参考资料从未渲染 | `refsHtml`/`refs[]` 在 client.js 里 0 处引用 | 严重 |
| 6 | 读前六段糊成一页 | 13,224 字符一次性渲染，无分节目录 | 严重 |
| 7 | 读前与读中断裂 | `parts[].title` 在精读页不出现；182 段只有 `seg.chapter` | 严重 |
| 8 | Tab 顺序反向 | 默认 `read`（精读），"读前建构"排第 2 | 中 |
| 9 | 同段多条 quote 可整段染色 | `quoteRanges` 收集了区间但**从未被读取**（死代码） | 中 |
| 10 | 考核只校验"非空" | 一句"我学完了"就能推进到 `drilled` | 严重 |
| 11 | 关系图零连接也能过 | `isolated` 只是 warn | 中 |
| 12 | 无复习调度 | 到 `done` 就结束，存的数据永不召回 | 严重 |
| 13 | 无覆盖审计 | 182 段只标 37 段，界面不告诉用户还剩 145 段 | 中 |
| 14 | 字号 15 种 / padding 21 种 / aria 0 处 | 无设计令牌 | 中 |

## Decisions so far

<!-- 已关闭的 ticket：一行一条，够判断相关性即可，细节点链接进去看 -->

- （尚无 — 全部在等用户拍板）

## Open tickets

| Ticket | 类型 | 要决定什么 | 需要用户 |
|---|---|---|---|
| [01 正文 Markdown 未渲染](tickets/01-markdown-not-rendered.md) | task | 422 处 `**` 怎么修 | 否（方案已定，占位符法） |
| [02 「整行有颜色」没实现](tickets/02-row-color-not-implemented.md) | grilling | 整行底色是 A 标签行通栏 / B 左侧竖条 / C 两者 | **是** |
| [03 考核门槛太松](tickets/03-drill-gate-too-loose.md) | grilling | 要不要 60 秒/150 字硬门槛 | **是** |
| [04 无复习调度](tickets/04-no-review-schedule.md) | task | 1/3/7 天间隔复习怎么做 | 部分 |
| [05 quote 密度无约束](tickets/05-quote-density-unguarded.md) | task | 段内密度上限 + 死代码接上 | 否 |
| [06 7 个 class 无 CSS](tickets/06-missing-css-classes.md) | task | 补样式，3 处需选形态 | 部分 |
| [07 无覆盖审计](tickets/07-no-coverage-audit.md) | grilling | 要不要显示"已加工 37/182" | **是** |
| [08 关系门禁缺失](tickets/08-relation-gate-missing.md) | task | 八种关系逐类表态 + 边要原文出处 | 部分 |
| [09 信息架构](tickets/09-information-architecture.md) | prototype | 3 个方案选 1 | **是** |
| [10 视觉体系](tickets/10-visual-system.md) | prototype | 三色换橙/品红/青？整行底色形态？ | **是** |

## Frontier（可以立刻推进的）

无阻塞、不需要用户拍板的：**01 / 05 / 04（部分）**。
需要用户先回答才能推进的：**02 / 03 / 07 / 09 / 10**。
依赖 09/10 结论的：**06**（3 个形态待选）。

## Not yet specified

<!-- 战争迷雾：感觉到会来、但现在还说不清的问题 -->

- **「美观」的具体含义**：用户说"不美观"，但我读不了图。视觉好坏只能靠用户看 prototype 反馈。三次迭代够不够，还不知道
- **182 段 vs 37 标注的比例对不对**：现在只标 20%。是不是该标更多？还是 20% 正是原则原文说的"二八法则"？没想清
- **多章节一本书怎么组织**：现在一个 docId 一份资料，用户有 10 章。章节之间要不要有总图、总考核？没想清
- **术语追问的答案从哪来**：现在只把问题复制到剪贴板，让用户去对话里问。真正的解法是面板内直接出答案——但那要求宿主能调模型。DSH 的插件有没有这个能力，还没查
- **`study-feynman` 的双身份追问**（8 岁小孩 / 专家杠精）：技能文档写了，机制没实现。要不要做进界面
- **重写 vs 修补的边界**：client.js 1250 行，改信息架构（ticket 09）几乎等于重写。这次是重写还是渐进？

## Out of scope

<!-- destination 之外的工作。永不 graduate。 -->

- 移动端适配（用户只在桌面 DSH 里用）
- 多人协作 / 云端同步（本地单用户工具）
- 语音合成朗读（用户要的是语音*输入*提问，不是听书）
- 把 archify 技能本身重写（外部技能，只用不改）
- 参考项目的三层账本（coverage-audit + reverse-coverage + summary-ledger）：调研确认"审计体量超过知识体量"，**明确不抄**
