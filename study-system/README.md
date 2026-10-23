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

之后按 `next.action` 走五个阶段：`读前建构 → 读中标注 → 知识图谱 → 费曼考核`。

界面在侧栏「学习工作台」，也可以在对话下方的状态条看到进度。

## 五个阶段

| 阶段 | 谁做 | 产物 |
|---|---|---|
| 导入 | `study_ingest` | `source.md`、`segments.json`、`segment-texts.json` |
| 读前建构 | 技能 `study-preflight` | `preflight.json`（六段式）、`quiz.md`、`refs.md` |
| 读中标注 | 技能 `study-annotate` | `annotations.json`、`annotated.md` |
| 知识图谱 | 技能 `study-map` | `relations.json` + Mermaid |
| 费曼考核 | 技能 `study-feynman` | `drills.jsonl`（学习者原话） |

追问随时可做：`study_term` 会把"词 + 所在段落"一起存进 `terms.jsonl`。

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
| 知识图谱 | 宿主算出坐标与折线拐点，客户端画纯 SVG |

支持的 Markdown 语法：标题、粗体/斜体/删除线/高亮、行内代码、代码围栏、
有序/无序列表（含一层嵌套）、表格（含对齐）、引用块、图片、链接、脚注、分隔线。

**为什么放宿主**：解析规则只实现一次，界面不重复实现"什么算粗体"；
也避免客户端手搓 DOM 拼接。代价是宿主代码量大一些，换来 UI 与 Agent 永远一致。

**安全**：所有文本节点转义，`javascript:` 等危险协议被替换成 `#`；
图片路由只允许访问源文件所在目录及其子目录，`../` 穿越返回 403/404。

## 知识图谱怎么画

没有引任何前端图库（Mermaid.js 走 CDN 会断网失效、企业网络常被拦）。

1. `parseMermaid` 从 Mermaid 源里抽节点与边；
2. Kahn 拓扑排序分层（虚线对比边不参与分层，避免成环卡死）；
3. **重心法**迭代排序，减少相邻层之间的交叉；
4. 节点宽度按标签实际像素宽度自适应（96–260px），标签折行最多 3 行；
5. 走线：**横移只发生在层间空隙**（空隙里没有节点），跨多层的竖移走右侧专用边道。

这样 40 条边、33 个节点可以做到 **0 处穿节点**（有测试守着）。
交互：点节点聚焦它的直接关系，悬停看完整定义，可切换查看 Mermaid 源。



pdf / docx / pptx / xlsx / epub / html / md / txt / rtf / doc，未知格式会给出可操作错误。

纯 JS 实现 ZIP + XML 解析（无 Python、无 pandoc 依赖）；PDF 优先走 `pdftotext`，
内置 FlateDecode 兜底，失败时明确提示改用 OCR。

编码：BOM → 严格 UTF-8 → GB18030 → latin1，中文 GBK 文本不会乱码。

## 数据在哪

```
<工作区>/.study/<docId>/
  meta.json  source.md  segments.json  segment-texts.json
  preflight.json  annotations.json  annotated.md  relations.json
  quiz.md  refs.md  terms.jsonl  drills.jsonl
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

# 测试（79 个用例：提取/分段/规则/关系/端到端/考核语义/无损 JSON/读前排版/Markdown/图布局/工作区）
node tests/run-tests.mjs

# 界面实现审计：不打接口，直接断言"渲染出来的内容对不对"
#   需要插件已加载并在运行（会真的请求 HTTP 接口）
node tests/audit-ui.mjs [docId]

# 读前建构的 HTML 结构审计：查非法嵌套、标签配对、内容丢失
node tests/audit-preflight.mjs [docId]

# 图谱布局质量（Pillow 预览图 + 结构指标）
node tests/check-graph-quality.mjs

# 重新生成测试样本
python tests/make_fixtures.py
```

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

