# Handoff — DSH 学习系统（study-copilot）

写给下一个 agent。目标：不改坏，接着做完剩下的。

---

## 一句话现状

一个跑在 DSH 里的 AI 学习系统插件（Host 插件 + 7 个 skill + Web 工作台），
能把任意格式资料导入成学习项目，走「读前建构 → 读中三色标注 → 知识图谱 →
读后巩固 → 读后考核」五个阶段。当前 **397 项测试 / 8 套件全绿**，工作区干净，HEAD `6f5f75f`。

---

## 硬环境（别猜，直接用）

| 项 | 值 |
|---|---|
| 工作区 | `D:\learn` |
| Web GUI | `http://127.0.0.1:52784`（**端口每次启动会变**，实测换过 52884→52784） |
| API base | `http://127.0.0.1:52784/study-copilot/api` |
| 插件 bundle | `@local/dsh-study-copilot` |
| 打包 Node | `C:\Users\x\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe` v24.21.0 |
| archify CLI | `C:\Users\x\.dsh\skills\archify-2\bin\archify.mjs` v3.2.0 |
| 模型 | `workbuddy-deepseek-flash`，**读不了图片** |

**文件策略 danger-full-access，审批提示已禁用 —— 永远不要设 `sandbox_permissions`。**

### 改完插件必须重载

```
plugin_manager set_bundle enabled=false target=@local/dsh-study-copilot
plugin_manager set_bundle enabled=true  target=@local/dsh-study-copilot
```
两处都要返回 `"application":"applied"`。不重载，接口会 404 或跑旧代码。

### 测试

```
node study-system/tests/all.mjs
```
端口可用 `DSH_WEB_HOST` 覆盖。

---

## 代码地图

```
D:\learn\study-system\
├── DESIGN.md              ← 设计与取舍的唯一真值，改逻辑先读它
├── README.md / REFACTOR-PLAN.md / INCIDENT-terms-data-loss.md
├── plugin\
│   ├── package.json       dsh.bundle.patch → cordis.patch.yml
│   ├── index.js   (31KB)  Host 入口：5 个工具 + HTTP 路由 + 系统提示
│   ├── client.js (137KB)  界面：入口/预览/读中/读前/图谱/巩固/考核 + 停靠条
│   └── lib\
│       ├── service.js    (62KB) 业务层：ingest/peek/preflight/annotate/map/qa/drill
│       ├── store.js      (13KB) 存储 + progressOf + stageFromProgress
│       ├── rules.js      (34KB) 校验：三色预算、标签、六段式、高亮渲染
│       ├── archify-figures.js (27KB) 分组 + 调 archify 出图
│       ├── archify-graph.js  (14KB) 关系图 → archify candidate
│       ├── extract.js    (17KB) 多格式提取
│       └── markdown.js   (23KB)
├── tests\   run-tests(161) e2e(14) audit-ui(117) audit-skills(38)
│            audit-requirements(29) audit-docs(29) audit-styles(2) check-render(7)
└── ..\.dsh\skills\  study-companion / preflight / annotate / map / recall / feynman / explain-term
```

三份真实资料在 `.study\`：

| docId | 段数 | 标注来源 | 图 |
|---|---|---|---|
| `chapter4-d6eaed` | 182 | **脚本回填**（不可信） | 3 张 22/6/5 |
| `chapter1-940885` | 217 | 人工逐段判读 | 2 张 25/8 |
| `认知负荷理论导论-692759` | 11 | 人工 | 1 张 |

---

## 三条不能踩的线（用户纠正过）

1. **知识图谱必须是 archify 生成的 HTML**，不是 Mermaid、不是手搓 SVG。`GraphPane` 用 iframe 嵌 `graph-N.html`。
2. **三色标注要整行有底色**（左侧竖条 + 行背景），不是只有符号有颜色。
3. **三色加粗只加在原文的具体短语上**，不许整段变色。当前 chapter1：0 个整段着色，quote 平均占段长 23.1%。

三色语义与预算：`core`/橙 `#f59e0b` ≤10%、`hard`/品红 `#c026d3` ≤8%、`ref`/青 `#14b8a6` 不限，总计 ≤20%。
**这是本项目自己的决定，不来自 `原则`。不要为了"达标"去回填高亮。**

---

## 第一性原理（决定一切取舍）

> 对的事是「帮用户从一份资料里拿到能改变他行为的那几句话」，
> **不是**「帮用户把这资料学完」。

推论已落地：
- 进度 ≠ 完成度计数
- 入口是「我想解决什么」，不是「这份资料有什么」
- 摩擦必须极低
- 三不做：不做逐单元知识点配额、绝不因覆盖率阻断、不做多层审计账本

---

## 最近三轮做了什么（细节看 git log，这里只记判断）

**f036dce** 界面补上真正的导入入口（拖/点/粘三合一）+ 导入后 30 秒预览 + 轻推荐 `light`。

**e2026cc** 四项收尾：图节点回指、读中显示当前部分的要求、语音失败分类型可见、标注来源 `provenance`。

**6f5f75f** splitGraph 重写（跨图重复 0、零边组 0）+ 阶段判定维持宽松但把回填来源摆到列表/停靠条/系统提示三处。

### 三轮里最值钱的几条教训

- **关键词命中 ≠ 证据正确**。「工具爆炸」唯一命中 ¶182，那是思考题；「代理工具」命中 ¶65，讲的是别的架构。这种错看起来很像对的，比留空危险得多。
- **边的 quote 讲的是 from 端，不是 to 端**。两端都继承，ACI 会被指到电影开场 ¶2。
- **零报错的重命名**：`{ ...recommendFrom() }` 返回 `{main, light}`，展开后字段变 `main`，界面读 `next` 全空。现在有测试守着。
- **同一个概念存两份必然漂移**：`maxNodes: 18` 在 service 和 splitGraph 各写一份；`figures.json` 说 6 张、磁盘剩 3 张。
- **archify 拒绝覆盖旧版写的 `graph-N.browser-check.json`**（`viewer/evidence-path-conflict`）。重建图前必须清这些派生产物，否则永远失败。这个坑只在"出过图又升级过 archify"的机器上出现——也就是所有真用过的机器。
- **`PowerShell` 里 `node -e` 会炸**：`\"`、反引号、`{`、`${}`、以及 `require` + top-level `await`（`ERR_AMBIGUOUS_MODULE_SYNTAX`）。写临时 `.mjs` 文件跑。
- **`edit` 削掉换行**是真实风险：我三次把新行吞掉，`node --check` 才抓到。每次 edit 后都要 check。

---

## 剩下没解决的（按重要性）

### 1. 语音提问没有真麦克风验证 ⚠️

用户原话：「先留着，我去试一下再告诉你」。代码路径完整（`SpeechRecognition`，`onerror` 按 `not-allowed`/`no-speech`/`audio-capture`/`network`/`aborted` 分类给出下一步，都带手打兜底），但**没有人真的对着麦克风说过话**。

**这条 agent 做不了，必须等用户。**

### 2. archify 图的视觉质量从未被看过 ⚠️

5 张图只验证到「HTTP 200 + 四道门全过 + `visualReviewRecommendation` 提示有 12 条路线弯折过多」。模型读不了图片，**无法判断好不好看**。

archify 自己给的信号：`chapter1` 图1 有 `routesOverSuggestedBends: 12`、`stretch` 最高 8.097（`llm → model-as-agent`），hint 建议「让 llm 和 model-as-agent 同行或同列」。**可以按这些 hint 调 `archify-graph.js` 的布局参数，但验收只能靠人眼。**

### 3. `annotated` 阶段口径仍然是宽松的（有意为之）

只在一条标注也算「读中完成」。三种收紧方案都实测过并否掉（详见 `DESIGN.md` §2.2.2）。
**不要"顺手把它改严"** —— 那会让已有项目掉回 `planned`，等于逼用户重标 182 段。
如果你认为必须改，先读 §2.2.2 再和用户确认。

### 4. 图节点回指覆盖不全

`chapter4` 11/33，`chapter1` 19/33。**这是诚实的数字，不是缺陷。** 剩下的节点标签是改写过的概念名（「能力形态谱系」），原文标题是另一套说法（「能力的表达形式」），确实找不到落点。
界面如实写「另有 22 个知识点没有确切的原文落点」，不列成可点。
**绝对不要为了提高这个数字去猜** —— 点错段比没有链接更糟，这是已经被验证过三次的结论。

### 5. 文档滞后

`README.md`、`REFACTOR-PLAN.md` 还停留在 v3 之前。`DESIGN.md` 是最新的。

### 6. `splitGraph` 极端情况下仍可能留一张散点图

「零边组并回邻居最多的图」在不超上限的前提下工作。如果所有组都满员，会留一张 0 边图。已测试覆盖（保证不超限、不丢节点），但存在更优解的空间。

---

## 建议下一个 agent 做的事（按顺序）

1. **先跑一遍 `node study-system/tests/all.mjs`**，确认 397 项仍全绿，再动任何代码。
2. 读 `study-system/DESIGN.md`（尤其 §0 第一性原理、§2.2.2、§5 界面设计）。
3. 问用户：语音试了吗？图好不好看？——这两件的验收权在他手上。
4. 如果他没别的要求，最有价值的下一步是 **刷新 `README.md` / `REFACTOR-PLAN.md`**，把 v4/v5 的设计写进去（`DESIGN.md` 已有全部素材，只需重述）。
5. 改任何逻辑前，先在 `tests/` 里找到守它的断言；找不到就说明这块没测试，先补断言再改。

---

## Suggested skills

下一个 agent 应当调用 `skill` 工具加载以下 skills：

- **`cordis-plugin-development`** —— 改 Host 插件、bundle、路由、工具定义、界面 Slot 之前必须读。本项目的 `ctx.get('webServer')`（不是 `ctx.webServer`）、`inject` 必须是字符串数组等坑都在里面。
- **`archify`** —— 只要碰关系图、想调布局、或需要重新出图就要读。四道门（validate → deliver → check → browser-check）与 `visualReviewRecommendation` 的用法在里面。
- **`writing-for-agents`** —— 刷新 `README.md` / `DESIGN.md` / `SKILL.md` 时读，避免写成给自己看的笔记。
- 需要写出「给用户看的成品文档」时用 **`delivery-artifact`**；只想核对设计取舍时不必加载。

如果任务变成"给这套系统加新阶段/新面板"，再加 `agent-experience`（写模型可见的工具定义与系统提示）。
