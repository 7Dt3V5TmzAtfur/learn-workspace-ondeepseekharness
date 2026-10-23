# 学习资料 AI 辅助系统 · 架构设计

> 目标：上传任意格式文档 → 读前建构 → 读中加工 → 读后考核，全程遵循 `原则/` 目录中的学习规律。

## 0. 设计依据（来自 原则/ 与 tools/）

| 来源 | 被采纳的约束 | 落到哪里 |
|---|---|---|
| `C1.03.a_阅读认知_主客关系/阅读主客体原则` | 以我为主：先答"这份资料对我有什么用"再来读 | 技能 `study-preflight` |
| `C1.03.b/深度阅读的二八法则` | 80% 精力给 20% 精华；高亮不超过全文 10–20% | 插件 `attention budget` 校验 |
| `C1.03.c.01/AI预构阅读框架` | 读前先给框架，降低即时认知负荷 | 技能 `study-preflight` |
| `C1.03.c.03/3W1H结构化提问` | What/Why/Where/How 四维拆解 | 技能 `study-preflight`、`study-feynman` |
| `tools/渐构+文案拆解标注.md` | 七类段落角色标签 `#d #e #q #s #t #c #v` | 技能 `study-annotate` + 插件 `validateAnnotation` |
| `C1.03.c.04/多色编码阅读标记` | 七色语义 → 收敛为**三色注意力** | 插件三色渲染 + `study-annotate` |
| `C1.03.c.04/思维地图八大可视化模组` | 逻辑关系定式（定义/对比/分类/部分整体/流程/因果/类比） | 技能 `study-map` + `relations.json` |
| `C1.02.a/主动重述原则` | 合上书本用自己的话复述 | 技能 `study-feynman` |
| `C1.02.a/AI作为费曼陪练闭环` | 输入→输出→复盘→再输出，AI 当听众与杠精 | 技能 `study-feynman` |
| `C1.03/阅读流程_SOP` | 检视分诊 → 执行阅读 → 内化 → 行动闭环 | 插件状态机 `stage` |
| `C1.03/pdf2skill` | 语义拆解、逻辑建模、技能封装 | 本系统整体（文档→知识点→技能） |

## 1. 三层拆分

```
┌─────────────────────────────────────────────────────────────┐
│  界面层  Client 插件  @local/dsh-study-copilot (client.js)    │
│  ├ 侧栏面板 "学习工作台"（main 面板，key = study-copilot）    │
│  ├ 输入框停靠条：当前文档 · 阶段 · 下一步                      │
│  ├ 三色注意力阅读器（渲染宿主给好的 HTML）                     │
│  ├ 术语追问（选中文字 → 带 ¶N 上下文）                        │
│  ├ 知识图谱（iframe 嵌入 archify 生成的 HTML）                 │
│  └ 费曼考核 / 读前建构                                        │
├─────────────────────────────────────────────────────────────┤
│  能力层  Host 插件  @local/dsh-study-copilot (index.js)       │
│  ├ 多格式提取  extract.js（pdf/docx/pptx/xlsx/html/epub/…）   │
│  ├ 项目存储    store.js    <workspace>/.study/<docId>/        │
│  ├ 规则校验    rules.js    标签/三色预算/六段式/目标分级       │
│  ├ 内容渲染    markdown.js Markdown→HTML（短语级高亮）         │
│  ├ 图谱生成    archify-figures.js → archify CLI → HTML        │
│  ├ Agent 工具  study_ingest · study_read · study_save         │
│  │             study_term · study_status · study_drill        │
│  ├ HTTP API    /study-copilot/api/*（数据 + 图片资源）         │
│  └ 提示词段落  systemPrompt.section（声明工作流）              │
├─────────────────────────────────────────────────────────────┤
│  方法层  技能  .dsh/skills/study-*                            │
│  study-companion 总控 → preflight → annotate → map            │
│                     → recall → explain-term → feynman         │
└─────────────────────────────────────────────────────────────┘
```

**为什么这样切分**

- **插件 = 机制，技能 = 方法。** 提取格式、落盘、算覆盖率、渲染三色、算图坐标，这些是确定性计算，写成插件；"怎么拆解语义、怎么定重难点、怎么出思考题"是判断，写成技能让模型执行。两者不重叠。
- **同一个操作两个调用者。** 界面上的"导入文档""保存标注"和 Agent 的 `study_ingest`/`study_save` 调的是同一个 Host 服务方法（`StudyService.*`），没有两套逻辑。
- **界面不自己算，也不自己解析。** 宿主返回的 `/project` 里，每段都带渲染好的 `html`
  （高亮已经嵌在里面），图谱给出 `figures[]` 的 URL。界面只做三件事：插入 HTML、填 iframe 的 src、处理点击。
  这样"什么算粗体""标签怎么折行"只实现一次。**这条是踩过坑之后加的**：早期版本让客户端
  自己逐行输出 `<p>`，结果是粗体显示成字面星号、表格塌成一堆竖线、图片显示成链接源码。
- **技能可单独使用。** 不安装插件时，技能仍能靠纯文本工作（降级路径在技能里写明）。


## 2. 数据契约（唯一真值）

目录：`<workspace>/.study/<docId>/`

| 文件 | 内容 | 写入者 |
|---|---|---|
| `meta.json` | 标题、源文件、格式、字数、阶段、时间 | 插件 |
| `source.md` | 归一化后的正文（段落带 `¶N` 锚点） | 插件 |
| `segments.json` | 段落索引：id/章节/字数/首句 | 插件 |
| `preflight.md` | 读前六段式（人读） | 技能+工具 |
| `preflight.json` | 读前六段式（机读，界面渲染） | 技能+工具 |
| `annotations.json` | 段落渐构标签 + 三色注意力 | 技能+工具 |
| `relations.json` | 知识点节点与关系边（供 archify 出图） | 技能+工具 |
| `terms.jsonl` | 术语追问流水（词、上下文、解释） | 界面/工具 |
| `quiz.md` | 思考题、作业、费曼复述 | 技能+工具 |
| `refs.md` | 参考资料清单 | 技能+工具 |

**读前六段式**（对应你的第 1–6 项要求）

1. `summary` — 300 字左右摘要
2. `goals` — ①这份资料对我（学习者）的帮助（第一、第二） ②总目标 ③子目标
3. `difficulty` — 每一部分的重点、难点
4. `assessment` — 每一部分的考核方式（了解/理解/掌握/熟练掌握 + 目的 + 达标要求）+ 知识点与内容、备注
5. `exercises` — 思考题与作业（费曼驱动）
6. `references` — 参考资料清单

## 3. 阅读中的三色注意力

七色语义（`多色编码阅读标记.md`）收敛为三档，避免"每句都标 = 没标"：

| 档位 | 颜色 | 语义来源标签 | 用途 | 预算 |
|---|---|---|---|---|
| 1 核心 | 蓝 `--sc-ink-blue` | `#d` 定义 / `#s` 结论 | 必须能复述的骨架 | ≤ 全文 10% |
| 2 攻坚 | 红 `--sc-ink-red` | `#q` 疑问难点 / `#v` 验证 | 必须停下来想的地方 | ≤ 全文 8% |
| 3 参考 | 绿 `--sc-ink-green` | `#e` 例子 / `#t` 迁移 / `#c` 备注 | 需要时回查 | 不限，但不参与精读 |

插件在保存标注时校验：总高亮占比 ≤ 20%（二八法则），每段至多 1 个档位，`#c` 标签必须带两字关键词。

## 4. 六个阶段（状态机）

```
ingested ──preflight──▶ planned ──annotate──▶ annotated ──map──▶ mapped
   导入        读前建构         读中标注            知识图谱
                                      │
                                      ├──qa──▶ recalled ──drill──▶ drilled ──▶ done
                                      │        读后自测              费曼考核
                                      └─（terms 随时记录，不占阶段）
```

图谱与自测都只依赖 `annotated`，可以任选顺序；`quiz.md` 在读前就生成，
所以"考核"阶段只由 `drills.jsonl` 的真实记录点亮。

每个阶段插件都返回"下一步该调什么"，技能里写明该阶段要交付什么、达标标准是什么。

## 5. 界面设计

**入口**：左侧栏新增一个书本图标（`sidebar.panellist` id = `study-copilot`），点击进入主面板。
**主面板**：四个 Tab —— 精读加工 / 读前建构 / 知识图谱 / 费曼考核（自测 QA 在精读页底部）。
**输入框停靠条**：显示当前文档 + 阶段进度条 + 「继续」按钮，随时知道读到哪。

**渲染职责划分**

| 内容 | 宿主产出 | 界面动作 |
|---|---|---|
| 段落正文 | `segments[].html` | 插入 HTML |
| 六段式 | `preflightHtml` | 插入 HTML |
| 思考题 / 参考 | `quizHtml` / `refsHtml` | 插入 HTML |
| 图谱 | `figures[]`（archify HTML 的 URL） | `<iframe src>` |
| 图片 | `/asset/<docId>/<path>` 路由 | `<img src>` |

**术语追问（对应 3min.top 那种"指着词就问"）**
- 选中正文任意词 → 面板右下浮出气泡，显示选中的字 → 点「问这个词」
- 选区取值必须用 `getSelection().toString()`（写成 `String(selection)` 会拿到 `[object Selection]`）
- 语音提问走 Harness 自带语音输入：追问框获取焦点后按下麦克风即可说话
- 回答必须结合**当前段落上下文**：提问时自动带上 `¶N` 段落原文

**知识图谱**
- 嵌的是 **archify 生成的 HTML**，不是 Mermaid 源码，也不是手绘 SVG
- `relations.json` 保存成功后宿主自动调 archify，产物 `graph-N.html` 落在 `.study/<docId>/`
- 超过 18 节点按根节点自动拆图：archify 的 `browser-check` 会按视口缩放判断字号可读性，
  33 节点铺 4348px 宽缩到 1440 后 12.5px 字变成 4px，会被判定不可读而拒绝出图
- 界面上方一排按钮切换子图，下方 `<details>` 列关系清单，附"新窗口打开"
- 出图失败不阻塞阶段推进（关系数据已存好），界面显示失败原因

**三色高亮**
- 宿主端在段落 HTML 里把 `quote` 逐字命中处包成 `<strong class="sc-hl-{tier}">`
- 界面按 `data-id="¶N"` 切出每段 HTML，用 `dangerouslySetInnerHTML` 插入
- 段落本身**不染色**（`<section class="sc-seg">` 没有颜色 class）——整段变色等于没标

## 6. 测试策略

| 层 | 测什么 | 用例 |
|---|---|---|
| 提取 | 10 种格式都能出正文、中文不乱码 | `tests/run-tests.mjs` §1 |
| 分段 | 段落切分不碎不黏 | `§2` |
| 规则 | 三色预算、标签合法性、六段式完备、目标分级 | `§3–5` |
| 端到端 | 导入→读前→标注→校验→考核 全链路 | `§6` |
| 语义 | 生成思考题 ≠ 完成考核 | `§7` |
| 无损 | 工具返回值必须是无损 JSON | `§8` |
| **渲染** | **Markdown 语法真的被解析（含 XSS 转义）** | **`§9`** |
| **高亮** | **quote 必须逐字在原文、预算按 quote 字数算、段落不整段染色** | **`§11`** |
| **需求** | **用户提的 16 条要求逐条断言** | **`tests/audit-requirements.mjs`** |
| **接口** | **真实 HTTP：图能取到且是 HTML、越界被拒、QA 能存能读** | **`tests/e2e-check.mjs`** |
| **界面** | **渲染出来的内容对不对（不是接口 200）** | **`tests/audit-ui.mjs`** |
| 界面审计 | 实际接口返回的内容能否正确渲染 | `tests/audit-ui.mjs` |
| 图谱质量 | 几何指标 + Pillow 预览图 | `tests/check-graph-quality.mjs` |
| 技能 | frontmatter 合法、可被发现 | 技能目录自查 |

**一条教训**：只断言"接口 200"和"HTML 里出现 class 名"是不够的——
这两个都通过的情况下，界面仍然可能一个字都不显示。测试必须断言**输出的内容**
（粗体是不是 `<strong>`、表格是不是 `<table>`、边有没有穿过节点）。

