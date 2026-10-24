# Study Copilot：AI 辅助学习系统

一套装进 DSH 的学习流水线：把任意格式的资料变成"可逐段精读、可追问、可自测"的学习项目。

- **插件**（`plugin/`）＝ 机制层：多格式提取、项目落盘、规则校验、HTTP 接口、界面。
- **技能**（`../.dsh/skills/`）＝ 认知层：怎么拆、怎么标、怎么问、怎么考。
- 界面与 Agent 调**同一套** `StudyService` 方法，规则只实现一次，界面不自己算。

## 一分钟上手

把一份资料丢给对话，说"帮我学这份材料"，或直接：

```
study_ingest  path=D:\path\to\资料.pdf
study_status  docId=…
```

之后按 `next.action` 走六个阶段：`读前建构 → 读中标注 → 知识图谱 → 读后自测 → 费曼考核`。

界面在侧栏「学习工作台」，也可以在对话下方的状态条看到进度。

已经选中一份资料时，导入入口在左栏「资料库」：**在空白处右键**，或点标题右侧的 `＋`。
菜单里两条：`导入资料…`（选本地文件）、`粘贴路径…`（填绝对路径）。
导入成功后自动选中新资料并给 30 秒预览；失败的原因显示在面板顶部，不会弹一下就消失。

## 六个阶段

| 阶段 | 谁做 | 产物 |
|---|---|---|
| 导入 | `study_ingest` | `source.md`、`segments.json`、`segment-texts.json` |
| 读前建构 | 技能 `study-preflight` | `preflight.json`（六段式）、`quiz.md`、`refs.md` |
| 读中标注 | 技能 `study-annotate` | `annotations.json`、`annotated.md` |
| 知识图谱 | 技能 `study-map` | `relations.json` + `figures.json` + archify HTML |
| 读后自测 | 技能 `study-recall` | `qa.json`（每问每答 ≤100 字）+ 最小行动 |
| 费曼考核 | 技能 `study-feynman` | `drills.jsonl`（学习者原话） |

追问随时可做：`study_term` 会把"词 + 所在段落"一起存进 `terms.jsonl`。

## 高亮是短语级，不是整段

每条标注必须给出 `quote`：**原文里逐字存在的一句短语**（建议 8–30 字）。
系统在原文的对应位置把它加粗上色，其余正文保持黑色。

为什么不做整段染色：整段变色后人眼无法判断"这句里哪个词最关键"，三色退化成贴纸；
而且一段 200 字的高亮会一次吃掉半个预算额度。

校验会拒掉这些情况：

| 错误码 | 含义 |
|---|---|
| `no-quote` | 忘了给 quote |
| `quote-not-found` | quote 不是原文里的字（自己概括了、或表格跨行） |
| `quote-too-long`（警告） | quote 占了这段 90% 以上 |
| `budget-*` | 三色预算超了 |

## 三色注意力是硬约束

高亮**不是**装饰，是注意力预算，用来对抗"每句都标等于没标"：

| 档 | 颜色 | 标签 | 上限 |
|---|---|---|---|
| core | 蓝 | `#d` 定义、`#s` 总结 | ≤ 全文 10% |
| hard | 红 | `#q` 提问、`#v` 验证 | ≤ 全文 8% |
| ref | 绿 | `#e` 例子、`#t` 迁移、`#c` 备注 | 不占预算 |
| 合计 | | | ≤ 全文 20% |

超预算会被 `study_save` **拒绝**。这是故意的：拒绝本身就是教学反馈。
参考档（绿）不计入预算，因为"需要时回查"不等于"要停下来想"。

## 找不到资料怎么办

学习项目存在 `<工作区>/.study/<docId>/`。界面里看到"0 个资料"，绝大多数是
**路径指错了**，而不是导入失败。

点右上角「诊断」，那一栏可以填**任意**路径，系统会自己往上找：

| 你填的 | 实际用的 |
|---|---|
| `D:\learn\学习资料\book\chapter4.md`（资料文件） | `D:\learn` |
| `D:\learn\学习资料\book`（资料所在文件夹） | `D:\learn` |
| `D:\learn`（项目根目录） | `D:\learn` |
| `D:/learn`（正斜杠） | `D:\learn` |

规则是：**从你给的路径逐级向上找，第一个含 `.study` 的目录就是工作区。**
一个都找不到时会明确提示"这个目录下没有 .study"，不会静默失败。

**你选过的路径会记住**：存进 `~/.dsh/study-copilot.state.json`，
刷新页面、重启 Harness 之后仍然直接回到那个目录，不用重填。
「恢复自动」可以清掉这个记忆。



界面**不自己解析内容**，宿主把内容渲染好，界面只负责显示：

| 内容 | 怎么渲染 |
|---|---|
| 正文段落 | 宿主 `markdown.js` 转 HTML，客户端按段插入 |
| 六段式读前建构 | 宿主生成结构化 HTML（卡片/表格/列表） |
| 思考题、参考资料 | Markdown → HTML |
| 图片 | 相对路径改写成 `/study-copilot/api/asset/<docId>/<path>`，由宿主提供文件 |
| 知识图谱 | 宿主调 archify CLI 生成独立 HTML，客户端用 iframe 嵌入 |

支持的 Markdown 语法：标题、粗体/斜体/删除线/高亮、行内代码、代码围栏、
有序/无序列表（含一层嵌套）、表格（含对齐）、引用块、图片、链接、脚注、分隔线。

**为什么放宿主**：解析规则只实现一次，界面不重复实现"什么算粗体"；
也避免客户端手搓 DOM 拼接。代价是宿主代码量大一些，换来 UI 与 Agent 永远一致。

**安全**：所有文本节点转义，`javascript:` 等危险协议被替换成 `#`；
图片路由只允许访问源文件所在目录及其子目录，`../` 穿越返回 403/404。

## 知识图谱怎么画：交给 archify

图谱页面里嵌的是 **archify 生成的 HTML 文件**，不是 Mermaid 源码，也不是手绘 SVG。

流程（`study_save kind=relations` 保存成功后自动触发，无需手动操作）：

1. `archify-figures.js` 把关系图翻译成 archify 的 `architecture` 图候选（JSON）；
2. 按 `kind` 映射节点配色、按 `relation` 映射线型（前置/因果→粗实线，对比/类比→虚线）；
3. 调 `archify.mjs finalize` 跑四道质量门：`validate` → `deliver` → `check` → `browser-check`；
4. 产物 `graph-N.html` 落在 `.study/<docId>/`，`figures.json` 记录清单；
5. 界面「知识图谱」页签用 `<iframe>` 嵌入，附带图例与"新窗口打开"。

### 节点多为什么要拆图

archify 的 `browser-check` 会按视口缩放判断字号可读性。33 个节点铺出来画布宽 4348px，
缩到 1440 视口后 12.5px 的字变成 4px，直接判定不可读并拒绝出图。

所以超过 18 个节点会自动**按根节点拆成多张图**，每张是一个知识簇。
实测 chapter4 的 33 节点 / 40 条边拆成 6 张（18/11/11/2/5/4），全部一次通过质量门。

这不是妥协：一张 33 节点的蜘蛛网本来也没人看得清。

### 失败时

archify 出图失败**不会阻塞**阶段推进 —— 关系数据已经存好了。
`figures.ok === false` 时看 `reason` 与每个子图的 `diagnostics`：

| code | 原因 | 处理 |
|---|---|---|
| `projected-text-readability` | 图太宽、字缩得看不清 | 合并同义节点，减少总数 |
| `component-overlap` | 标签太长互相压住 | 缩短 `label`（≤20 字） |

### 静态资源路由

`GET /study-copilot/api/asset/<docId>/<相对路径>` 按顺序在两个根目录找：
项目目录 `.study/<docId>/` → 原文档所在目录。只允许这两个根及其子目录，`../` 越界返回 404。
`.html` 以 `text/html` 返回且 `no-cache`（重画后能立刻看到新图）。



pdf / docx / pptx / xlsx / epub / html / md / txt / rtf / doc，未知格式会给出可操作错误。

纯 JS 实现 ZIP + XML 解析（无 Python、无 pandoc 依赖）；PDF 优先走 `pdftotext`，
内置 FlateDecode 兜底，失败时明确提示改用 OCR。

编码：BOM → 严格 UTF-8 → GB18030 → latin1，中文 GBK 文本不会乱码。

## 数据在哪

```
<工作区>/.study/<docId>/
  meta.json  source.md  segments.json  segment-texts.json
  preflight.json  annotations.json  annotated.md  relations.json
  figures.json  graph-1.html  graph-2.html …
  qa.json  quiz.md  refs.md  terms.jsonl  drills.jsonl
```

全部是普通文件，可以直接 `git diff`、直接改、直接带走。

## 两条设计纪律

1. **生成思考题 ≠ 完成考核。** `quiz.md` 在读前建构就存在，所以进度条的"考核"
   只由 `drills.jsonl` 里的真实记录点亮 —— 用户没说自己的话，就不算学会。
2. **不编造来源。** 参考资料必须标 `原文` / `我的知识` / `联网检索`；凭记忆写的要注明
   "未核对"，没联网就不给链接。

## 开发

```powershell
# 语法检查
node --check plugin/index.js
node --check plugin/client.js

# 单元测试（95 个用例：提取/分段/规则/高亮/关系/端到端/考核语义/无损 JSON/读前排版/Markdown/工作区）
node tests/run-tests.mjs

# 需求符合度审计（16 项：摘要字数、六段式、考核四档、三色预算、archify、QA、语音…）
node tests/audit-requirements.mjs

# 端到端验收：打真实 HTTP 接口，模拟界面会做的每件事
#   需要插件已加载并运行
node tests/e2e-check.mjs [docId]

# 界面实现审计：断言"渲染出来的内容对不对"
node tests/audit-ui.mjs [docId]

# 读前建构的 HTML 结构审计：查非法嵌套、标签配对、内容丢失
node tests/audit-preflight.mjs [docId]

# 重新生成测试样本
python tests/make_fixtures.py
```

### 四层测试各自防什么

| 脚本 | 层次 | 防的问题 |
|---|---|---|
| `run-tests.mjs` | 函数/服务层 | 规则算错、预算算错、无损 JSON 破坏 |
| `audit-requirements.mjs` | 需求层 | 用户提的 16 条要求哪条没实现 |
| `e2e-check.mjs` | 真实 HTTP | 接口通但拿不到东西（曾出现 `.html` 返回 415） |
| `audit-ui.mjs` / `audit-preflight.mjs` | 渲染内容 | 接口 200 但界面一个字都显示不出来 |

**为什么四层都要有**：只测"接口返回 200"是自欺。本系统真出过：正文没 HTML、
图谱没坐标、选区取成 `[object Selection]`、archify HTML 因 MIME 不对渲染成空白。
每一层都在拦不同的失败模式。

**为什么有 `audit-ui.mjs`**：只测"接口返回 200"是自欺——接口对了但界面可能
一个字都显示不出来（本系统就出过：正文没 HTML、图谱没坐标、选区取成
`[object Selection]`）。审计脚本改为断言输出内容：粗体是否变成 `<strong>`、
表格是否成为 `<table>`、边是否穿过节点。

安装（改动 Host 代码后需要重载）：

```
plugin_manager set_bundle enabled=false target=@local/dsh-study-copilot
plugin_manager set_bundle enabled=true  target=@local/dsh-study-copilot
```

## 已知限制

- 单个核心/攻坚标签的上限按**段落字数**算。在**极短文档**（约 800 字以下）上，
  8% 预算只有几十字，连一个正常段落都装不下，标注会连续被拒；长文档无此问题
  （chapter4 29831 字，预算 5966 字，实际用了 11%）。
- 语音提问依赖 Harness 自带的语音输入把文字送进输入框；本插件不做离线 ASR。
  术语回答始终带段落上下文，语义由模型负责，插件只管上下文与落盘。
- 界面**视觉外观未经截图验证**（本会话无浏览器控制、当前模型不支持读图）。
  已验证的是：接口契约、渲染输出的 HTML 内容、图谱布局的几何指标
  （节点不重叠、走线不穿节点、标签不溢出、拐点在画布内）、资源可取。
  **像素级的配色/间距/字号观感需要你自己刷新页面看一眼。**

