# TICKET: 视觉体系——15 种字号、21 种 padding、6 个硬编码色、"整行底色"设计

- **状态**: open
- **类型**: `prototype`（HITL — 视觉必须看到才能定）
- **阻塞**: 无
- **所属**: [MAP](../../map/MAP.md)

## Question

界面组量化出的视觉问题：

| 项 | 现状 | 问题 |
|---|---|---|
| 字号 | **15 种**：9.5/10/10.5/11/11.5/12/12.5/13/13.5/14/15/17/19px + .9em/.75em | 9.5px 和 10px 在 1080p 下不可读 |
| padding | **21 种**：6/7/8/10/12/14/16/20/40/5/1/2/4… | 无 4px 基栅，视觉零碎 |
| gap | **16 种** | 同上 |
| 硬编码色 | **6 个**：`#4f8ff7 #e5484d #30a46c #ab7aef #ffb86c #00a0a0` | 不走主题 token，深色主题下失效 |
| 深色主题适配 | `data-ds-dark-theme` 出现 **0 次** | 完全没有深色适配 |
| 焦点态 | `:focus`/`focus-visible` **0 次** | 键盘用户看不到焦点 |
| ARIA | `aria-` **0 次** | Tab 没有 `role=tablist`/`aria-selected` |

### 最严重的视觉问题：三色撞了状态色

现在的三色：
```css
.sc-hl-core{border-left-color:#4f8ff7;background:rgba(79,143,247,.10)}  /* 蓝 */
.sc-hl-hard{border-left-color:#e5484d;background:rgba(229,72,77,.10)}   /* 红 */
.sc-hl-ref {border-left-color:#30a46c;background:rgba(48,164,108,.10)}  /* 绿 */
```

问题：
1. **蓝/红/绿正是 DSH 的 error/warn/success 语义色**。用户在同一个界面里看到的红 = "报错"，绿 = "成功"。用在"攻坚/参考"上，语义直接冲突
2. 全部 `rgba(...,.10)`，深色底（`#2c2c2e`）上 10% 蓝 ≈ `#313a4a`，**几乎不可见**
3. `border-left-color` 作用在 `<strong>` 上但没设 `border-style`，**这条规则完全无效**
4. 只有 10% 背景，没有文字色区分 —— 用户要的是"三种不同的颜色来加粗"，现在字都是黑的

### 用户明确要的"整行有颜色"没做

```css
.sc-seg{border-left:3px solid transparent;padding:6px 10px;border-radius:0 6px 6px 0;margin-bottom:6px}
```

`data-tier` 属性已经输出到 DOM（37 处），**但没有任何 CSS 选择器用它**。

## 三个维度的思考

**维度一：颜色语义（避免撞车）**
用户要三色表达三种注意力级别，但红绿蓝已被状态色占用。可选方向：
- **A. 换色相**：橙（核心）/ 品红（攻坚）/ 青（参考）—— 与状态色无冲突，且深浅两套都能调
- **B. 改用同色相不同深浅**：蓝的 3 个明度 —— 表达"程度"而非"类别"，但用户要的是三色区分
- **C. 保留色相但改用法**：不用背景块，改用**下划线 + 文字色**

倾向 A + C 组合：橙色系表达"核心"（暖、显眼但不报警），品红表达"攻坚"（特殊、需注意），青色表达"参考"（冷、后退）。同时用**文字色 + 加粗 + 下划线**承载，背景只做极轻辅助。

**维度二：整行底色到底怎么画**
用户："整一个行是有颜色的，而不是整个段落都是颜色，也不是只有符号有颜色。"

三种解读（需要在 prototype 里让用户看到）：
- **A. 标签行通栏着色**：`#d 五类工具的审视特征` 那一行整条有底色，正文白
- **B. 左侧竖色条**：段落左边缘 3px 竖条 + 标签有底色，正文白
- **C. A + 极淡正文底**：标签行彩色，正文 5% 同色底

关键约束：**不能变成"整段都是颜色"**（用户明确否决过 v1 的做法）。所以 C 的正文底色必须极淡（≤5%），且只到文字为止，不能整块铺满。

**维度三：设计令牌**
必须建立一套变量，否则改一处要动 15 个地方：

```css
.sc-root{
  /* 字号：7 阶，正文固定 14px */
  --sc-fs-xs:11px; --sc-fs-sm:12px; --sc-fs-base:13px;
  --sc-fs-md:14px; --sc-fs-lg:16px; --sc-fs-xl:20px; --sc-fs-2xl:26px;
  /* 间距：4px 基栅，6 档 */
  --sc-sp-1:4px; --sc-sp-2:8px; --sc-sp-3:12px; --sc-sp-4:16px; --sc-sp-5:24px; --sc-sp-6:32px;
  /* 行高 */
  --sc-lh-tight:1.35; --sc-lh-body:1.75; --sc-lh-loose:1.95;
  /* 圆角 */
  --sc-r-sm:4px; --sc-r-md:8px; --sc-r-lg:12px;
  /* 三色（橙/品红/青）—— 浅色主题 */
  --sc-core-fg:#c2410c; --sc-core-bg:#fff7ed; --sc-core-line:#f97316;
  --sc-hard-fg:#a21caf; --sc-hard-bg:#fdf4ff; --sc-hard-line:#c026d3;
  --sc-ref-fg:#0f766e;  --sc-ref-bg:#f0fdfa;  --sc-ref-line:#14b8a6;
}
/* 深色必须单独给，不能靠 rgba 叠 */
body[data-ds-dark-theme] .sc-root{
  --sc-core-fg:#fdba74; --sc-core-bg:#3a2617; --sc-core-line:#f97316;
  --sc-hard-fg:#f0abfc; --sc-hard-bg:#3b1d3f; --sc-hard-line:#d946ef;
  --sc-ref-fg:#5eead4;  --sc-ref-bg:#12332f;  --sc-ref-line:#14b8a6;
}
```

## 需要用户拍板

1. **三色换成橙/品红/青**，可以吗？（理由：现在的蓝红绿和"报错/成功"撞了）
2. **整行底色**：A（标签行通栏）/ B（左侧竖条）/ C（A+极淡正文底）——选哪个？
3. 需要我做 3 个 HTML 原型让你直接看图选吗？（我做不了截图，但可以生成 HTML 让你打开看）

## Resolution

（待填）
