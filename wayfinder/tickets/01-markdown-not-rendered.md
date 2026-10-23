# TICKET: 阅读正文的 Markdown 行内语法全没渲染

- **状态**: open
- **类型**: `task`（AFK — 修复确定，无需决策）
- **阻塞**: 无
- **所属**: [MAP](../../map/MAP.md)

## Question

`renderAnnotatedHtml` 渲染正文时只做了 HTML 转义，没有解析 Markdown 行内语法。

具体证据（真实接口 `GET /project/chapter4-d6eaed`）：

- `annotatedHtml` 里 `**` 字面量出现 **422 次**——用户会看到满屏 `**工具**`、`**调用方向**`
- 表格行被原样输出成 `<p>| 工具类型 | 调用方向 | 作用对象 |</p>`，不是 `<table>`
- 段落里的 `<strong class="sc-hl-core">作用对象</strong>` 是**唯一**被解析的语法（因为那是高亮注入的）

根因代码（`lib/rules.js` `renderAnnotatedHtml`）：

```js
const body = String(seg.text)
  .split('\n')
  .map((line) => {
    if (!line.trim()) return ''
    if (line.startsWith('#')) return `<div class="sc-h">${highlightQuote(line, quote, tierClass)}</div>`
    return `<p>${highlightQuote(line, quote, tierClass)}</p>`
  })
  .join('')
```

`highlightQuote(text, quote, tierClass)` 内部：切片 → 每片 `escHtml` → 拼接 `<strong>`。**纯转义，零 Markdown 解析。**

而项目里明明有 `lib/markdown.js` 提供 `renderMarkdown`（preflight / quiz / refs 都在用），阅读页却没用。

## 为什么这是个真问题（不是小瑕疵）

1. 用户读的是技术书，`**加粗**` 是作者用来标术语的主要手段。全变成星号 = 原文可读性直接崩坏。
2. 表格是本资料的核心内容载体（五类工具、四层应对手段都是表）。全压成一行竖线文本 = 信息结构丢失。
3. 用户在对话里说"很多错误"——满屏 `**` 就是最刺眼的那个。

## 约束：不能简单套 renderMarkdown

不能直接 `renderMarkdown(line)`，因为：

- 高亮必须**在 Markdown 解析前**插入，否则 `**调用方向**` 里的短语被 `**` 包住后位置计算会错位
- 反过来，高亮后插入 `<strong>` 再交给 Markdown 解析，`<strong>` 里的 `*` 可能被误判

正确顺序：**先按 quote 切分文本 → 对每片过 Markdown 行内解析 → 命中片包 `<strong>`**。

但如果 quote 跨越了 `**` 边界（例如 quote 是 `**工具**` 中间的一部分），手工切分会破坏语法配对。

## 待定的实现路线（3 选 1）

| 方案 | 做法 | 风险 |
|---|---|---|
| A. 先解析后高亮 | `renderMarkdown` 全文 → 在生成的 HTML 上做字符串级 quote 定位 → 包 `<strong>` | quote 可能跨 HTML 标签边界（如跨越 `<strong>`），定位失败率高 |
| B. 先高亮后解析 | 按 quote 切片，命中片先打占位符 `\x00N\x00`，整行过 `renderMarkdown`，最后把占位符换成 `<strong>` | 占位符不会被 Markdown 破坏，配对天然正确。**倾向这个** |
| C. 结构化解析 | 写一个轻量 inline parser，同时输出 tokens 与高亮区间 | 工作量最大，但最正确 |

选 B 的理由：占位符方案让 Markdown 解析器看到的是「完整合法的一行」，只要占位符不落在 `*`/`|`/`` ` `` 这些语法字符上就安全。而 quote 取自原文连续片段，天然不会拆开语法字符。

需要验证：占位符放在 `**...**` 内部时（如 `**作用对象**` 只命中「作用」），`renderMarkdown` 输出 `<strong>作用对象</strong>` 后，把占位符换回来能得到 `<strong><strong>作用</strong>对象</strong>`——嵌套 `<strong>` 合法但冗余，需要合并。

## Resolution

（待填）
