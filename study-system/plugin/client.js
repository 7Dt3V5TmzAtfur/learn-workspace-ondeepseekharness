/**
 * @local/dsh-study-copilot — Client 半身（浏览器）
 *
 * 两个挂载点：
 * 1. sidebar.panellist + main：左侧栏书本图标 → 学习工作台主面板
 * 2. conversation.composer.dock：输入框上方显示当前项目与阶段，随时提示下一步
 *
 * 数据全部来自 Host 的 /study-copilot/api/*，界面不自己算任何规则，
 * 保证与 Agent 看到的是同一份真值。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-study-copilot',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useMemo, useRef } = React

    const API = '/study-copilot/api'
    const PANEL_ID = 'study-copilot'

    /* ------------------------------------------------------------ 样式 */

    const CSS = `
/* ============================================================
 * 设计令牌
 *
 * 为什么要有这一层：原来 CSS 里散着 15 种字号、21 种 padding、6 个硬编码
 * 色值，改一处要动十几个地方，而且深浅两套主题根本没法对齐。
 * 这里把"能变的"集中成变量，后面的规则只引用变量。
 *
 * 三色为什么不是蓝/红/绿：蓝 #4f8ff7、红 #e5484d、绿 #30a46c 正好是 DSH
 * 的 info/error/success 语义色，用户在同一个界面里看到红会读成"报错"。
 * 改用 橙→品红→青：橙表达"这是骨架"，品红表达"这里要停下来想"，
 * 青表达"需要时回来查"，与状态色彻底解耦。
 * ============================================================ */
.sc-root{
  /* 字号阶：7 档，正文 13.5px */
  --sc-fs-xs:11px; --sc-fs-sm:12px; --sc-fs-base:13.5px;
  --sc-fs-md:14px; --sc-fs-lg:16px; --sc-fs-xl:19px; --sc-fs-2xl:24px;
  /* 间距：4px 基栅 */
  --sc-sp-1:4px; --sc-sp-2:8px; --sc-sp-3:12px; --sc-sp-4:16px; --sc-sp-5:24px; --sc-sp-6:32px;
  /* 行高 */
  --sc-lh-tight:1.4; --sc-lh-body:1.8;
  /* 圆角 */
  --sc-r-sm:4px; --sc-r-md:8px; --sc-r-lg:12px;
  /* 三色注意力（浅色主题） */
  --sc-core-fg:#b45309; --sc-core-bg:#fff7ed; --sc-core-line:#f59e0b; --sc-core-row:rgba(245,158,11,.09);
  --sc-hard-fg:#a21caf; --sc-hard-bg:#fdf4ff; --sc-hard-line:#c026d3; --sc-hard-row:rgba(192,38,211,.08);
  --sc-ref-fg:#0f766e;  --sc-ref-bg:#f0fdfa;  --sc-ref-line:#14b8a6; --sc-ref-row:rgba(20,184,166,.07);
  --sc-hl-pad:0 2px;
  --sc-lv-color:var(--dsw-alias-label-secondary);
}
/* 深色必须单独给值。原来全部靠 rgba(x,.10) 叠在深色底上，
 * 实测深底 #2c2c2e 上 10% 蓝 ≈ #313a4a，几乎看不见。 */
body[data-ds-dark-theme] .sc-root{
  --sc-core-fg:#fdba74; --sc-core-bg:#3a2617; --sc-core-line:#f59e0b; --sc-core-row:rgba(245,158,11,.14);
  --sc-hard-fg:#f0abfc; --sc-hard-bg:#3b1d3f; --sc-hard-line:#c026d3; --sc-hard-row:rgba(192,38,211,.14);
  --sc-ref-fg:#5eead4;  --sc-ref-bg:#12332f;  --sc-ref-line:#14b8a6; --sc-ref-row:rgba(20,184,166,.12);
}
.sc-root{display:flex;flex-direction:column;height:100%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:var(--sc-fs-base)}
.sc-head{display:flex;align-items:center;gap:var(--sc-sp-2);padding:10px var(--sc-sp-4);border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.sc-title{font-size:var(--sc-fs-md);font-weight:600}
.sc-muted{color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm)}
.sc-body{display:flex;flex:1;min-height:0}
.sc-side{width:230px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:var(--sc-sp-2)}
.sc-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.sc-doc{display:block;width:100%;text-align:left;padding:var(--sc-sp-2) 10px;border-radius:6px;border:1px solid transparent;background:none;color:inherit;cursor:pointer;font:inherit;margin-bottom:var(--sc-sp-1)}
.sc-doc:hover{background:var(--dsw-alias-bg-layer-2)}
.sc-doc:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.sc-doc[data-active=true]{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l2)}
.sc-doc-name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-tabs{display:flex;gap:2px;padding:6px var(--sc-sp-3) 0;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;overflow-x:auto}
.sc-tab{border:none;background:none;color:var(--dsw-alias-label-secondary);padding:7px var(--sc-sp-3);border-radius:6px 6px 0 0;cursor:pointer;font:inherit;border-bottom:2px solid transparent;white-space:nowrap}
.sc-tab:hover{color:var(--dsw-alias-label-primary)}
.sc-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.sc-tab[data-active=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
.sc-tab i{font-style:normal;opacity:.55;margin-left:4px;font-size:var(--sc-fs-xs)}
.sc-pane{flex:1;overflow:auto;padding:var(--sc-sp-4) var(--sc-sp-5)}
.sc-stage{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
/* 阶段徽标：不再用 brand 填充。
 * 原来 .sc-pill[data-on]{background:brand;color:#fff} 在深色主题下
 * brand 变成近白色 → 白底白字，整个阶段条像被抹掉。 */
.sc-pill{font-size:var(--sc-fs-xs);padding:2px var(--sc-sp-2);border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.sc-pill[data-on=true]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-label-primary);font-weight:600}
.sc-bar{height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;margin-top:6px}
.sc-bar>i{display:block;height:100%;background:var(--dsw-alias-brand-primary);transition:width .3s}
@media (prefers-reduced-motion:reduce){.sc-bar>i{transition:none}}

/* ============================================================
 * 标注段落
 *
 * 用户原话：「这一个标注整一个行是有颜色的，而不是整个段落都是颜色，
 * 也不是只有符号有颜色。」
 *
 * 所以做两级着色：
 *   1. 段落整行：data-tier 上极淡的行底色 + 左侧 3px 色条（横向贯穿，不是整段大色块）
 *   2. 原文短语：三色加粗 + 同色下划线，字重和颜色都变
 * 行底色只有 7-9% 透明度，保证"一眼看出这段被标了"，但不会变成色斑。
 * ============================================================ */
.sc-seg{border-left:3px solid transparent;padding:7px var(--sc-sp-3);border-radius:0 var(--sc-r-md) var(--sc-r-md) 0;margin-bottom:var(--sc-sp-2);scroll-margin-top:80px}
.sc-seg[data-tier=core]{border-left-color:var(--sc-core-line);background:var(--sc-core-row)}
.sc-seg[data-tier=hard]{border-left-color:var(--sc-hard-line);background:var(--sc-hard-row)}
.sc-seg[data-tier=ref]{border-left-color:var(--sc-ref-line);background:var(--sc-ref-row)}
.sc-seg:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-seg p{margin:0 0 5px;line-height:var(--sc-lh-body)}
.sc-seg p:last-child{margin-bottom:0}
.sc-seg .sc-h{font-weight:600;margin:2px 0 5px}

/* 三色短语：加粗 + 文字色 + 下划线三件事一起做。
 * 原来只写了 border-left-color，但 <strong> 是行内元素且没设 border-style，
 * 这条规则完全无效 —— 实际只有 10% 的背景色，三色几乎看不出差别。 */
.sc-hl-core,.sc-hl-hard,.sc-hl-ref{font-weight:700;color:inherit;border-radius:2px;padding:var(--sc-hl-pad)}
.sc-hl-core{background:var(--sc-core-bg);box-shadow:inset 0 -2px 0 var(--sc-core-line);color:var(--sc-core-fg)}
.sc-hl-hard{background:var(--sc-hard-bg);box-shadow:inset 0 -2px 0 var(--sc-hard-line);color:var(--sc-hard-fg)}
.sc-hl-ref{background:var(--sc-ref-bg);box-shadow:inset 0 -2px 0 var(--sc-ref-line);color:var(--sc-ref-fg)}

/* 渐构标签徽标：#d 定义|Definition */
.sc-tag{display:inline-flex;align-items:baseline;gap:5px;font-size:var(--sc-fs-xs);line-height:1.6;padding:1px 7px;border-radius:var(--sc-r-sm);margin-bottom:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500}
/* 英文副标签：原来是硬挤在中文后面的。
 * 现在单独一档 9.5px、半透明、有分隔点，读起来是「五类工具的审视特征 · Definition」 */
.sc-tag-en{font-size:9.5px;letter-spacing:.03em;text-transform:none;opacity:.5;font-weight:400}
.sc-tag-d{background:rgba(245,158,11,.18)}
.sc-tag-e{background:rgba(20,184,166,.18)}
.sc-tag-q{background:rgba(192,38,211,.16)}
.sc-tag-s{background:rgba(37,99,235,.16)}
.sc-tag-t{background:rgba(249,115,22,.18)}
.sc-tag-c{background:rgba(100,116,139,.20)}
.sc-tag-v{background:rgba(13,148,136,.18)}
/* 段落备注：原来是裸文本，和正文同色分不清。
 * 现在左侧竖线 + 斜体 + 小一号，明确是批注不是原文。 */
.sc-seg-note{margin-top:6px;padding:5px var(--sc-sp-2);border-left:2px solid var(--dsw-alias-border-l2);font-size:var(--sc-fs-sm);line-height:1.7;color:var(--dsw-alias-label-secondary);font-style:italic}
.sc-seg-note::before{content:'批注 · ';font-style:normal;opacity:.6}
/* 段落头：标签 + 概括 + 字数 */
.sc-seg-head{display:flex;align-items:center;gap:var(--sc-sp-2);flex-wrap:wrap;margin-bottom:5px}
.sc-seg-chars{font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);opacity:.7;margin-left:auto;white-space:nowrap}
.sc-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:5px var(--sc-sp-3);border-radius:6px;cursor:pointer;font:inherit}
.sc-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.sc-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.sc-btn[disabled]{opacity:.5;cursor:not-allowed}
.sc-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base);font-weight:500}
.sc-btn-sm{padding:2px var(--sc-sp-2);font-size:var(--sc-fs-xs)}
.sc-card{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-md);padding:var(--sc-sp-3) 14px;margin-bottom:10px;background:var(--dsw-alias-bg-layer-1)}
.sc-card h4{margin:0 0 6px;font-size:var(--sc-fs-sm);letter-spacing:.02em;color:var(--dsw-alias-label-secondary);font-weight:600}
.sc-kv{display:grid;grid-template-columns:88px 1fr;gap:var(--sc-sp-1) 10px;line-height:1.6}
.sc-kv>span:first-child{color:var(--dsw-alias-label-secondary)}
.sc-empty{color:var(--dsw-alias-label-secondary);text-align:center;padding:40px 10px;line-height:1.8}
.sc-issue{font-size:var(--sc-fs-sm);line-height:1.6;padding:5px var(--sc-sp-2);border-radius:5px;margin-bottom:var(--sc-sp-1);background:rgba(229,72,77,.10);border-left:2px solid var(--dsw-alias-state-error-primary)}
.sc-issue[data-level=warn]{background:rgba(245,158,11,.14);border-left-color:var(--dsw-alias-state-warn-primary)}
.sc-legend{display:flex;gap:var(--sc-sp-3);flex-wrap:wrap;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);margin-bottom:10px;align-items:center}
.sc-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.sc-dock{display:flex;align-items:center;gap:var(--sc-sp-2);padding:6px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-md);background:var(--dsw-alias-bg-layer-1);font-size:var(--sc-fs-sm);color:var(--dsw-alias-label-secondary)}
.sc-dock b{color:var(--dsw-alias-label-primary);font-weight:500}
.sc-seg-meta{display:flex;align-items:center;gap:6px;margin-bottom:var(--sc-sp-1);font-size:var(--sc-fs-sm)}
.sc-details{margin-top:var(--sc-sp-2)}
.sc-details>summary{cursor:pointer;font-size:var(--sc-fs-sm);color:var(--dsw-alias-label-secondary);user-select:none}
.sc-details>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-details[open]>summary{margin-bottom:var(--sc-sp-1)}
.sc-pop{max-width:min(460px,calc(100% - 32px));right:16px;bottom:16px;position:absolute;z-index:20;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--sc-r-md);padding:10px var(--sc-sp-3);box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:var(--sc-fs-sm);min-width:200px}
/* 复习到期横幅：只在真的到期时出现 */
.sc-review{display:flex;flex-direction:column;gap:6px;padding:var(--sc-sp-3);margin-bottom:var(--sc-sp-3);border:1px solid var(--sc-core-line);border-radius:var(--sc-r-md);background:var(--sc-core-bg)}
.sc-review-title{font-size:var(--sc-fs-sm);font-weight:700;color:var(--sc-core-fg)}
.sc-review-item{display:flex;align-items:center;gap:var(--sc-sp-2);font-size:var(--sc-fs-sm);flex-wrap:wrap}
.sc-review-name{font-weight:600;max-width:32ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 追问等待中的转圈：没有它的话，用户点了按钮只看到一行字，会以为没反应 */
.sc-spin{width:12px;height:12px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;display:inline-block;animation:sc-spin .8s linear infinite}
@keyframes sc-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sc-spin{animation:none;border-top-color:var(--dsw-alias-border-l2)}}
.sc-pre{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.65;background:var(--dsw-alias-bg-layer-2);padding:10px;border-radius:6px;overflow:auto;max-height:340px;margin:0}
/* ---- Markdown 渲染结果 ---- */
.sc-md{line-height:1.85;overflow-wrap:anywhere}
.sc-md p{margin:0 0 9px}
.sc-md h1,.sc-md h2,.sc-md h3,.sc-md h4,.sc-md h5,.sc-md h6{margin:var(--sc-sp-4) 0 var(--sc-sp-2);line-height:var(--sc-lh-tight);font-weight:600}
.sc-md h1{font-size:var(--sc-fs-xl)}
.sc-md h2{font-size:17px}
.sc-md h3{font-size:var(--sc-fs-lg)}
.sc-md h4,.sc-md h5,.sc-md h6{font-size:var(--sc-fs-base);font-weight:600}
.sc-md ul,.sc-md ol{margin:0 0 9px;padding-left:22px}
.sc-md li{margin-bottom:3px}
.sc-md li>ul,.sc-md li>ol{margin:3px 0 0}
.sc-md code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:var(--sc-r-sm);border:1px solid var(--dsw-alias-border-l1)}
.sc-md .sc-code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:10px var(--sc-sp-3);overflow:auto;margin:0 0 10px}
.sc-md .sc-code code{background:none;border:none;padding:0;font-size:11.5px;line-height:1.7;display:block;white-space:pre}
.sc-md blockquote{margin:0 0 10px;padding:6px var(--sc-sp-3);border-left:3px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:0 6px 6px 0;color:var(--dsw-alias-label-secondary)}
.sc-md .sc-quote p{margin:0 0 4px}
.sc-md .sc-quote p:last-child{margin:0}
.sc-md .sc-table-wrap{overflow-x:auto;margin:0 0 var(--sc-sp-3);border:1px solid var(--dsw-alias-border-l1);border-radius:6px}
.sc-md table{border-collapse:collapse;width:100%;font-size:12.5px}
.sc-md th,.sc-md td{border-bottom:1px solid var(--dsw-alias-border-l1);border-right:1px solid var(--dsw-alias-border-l1);padding:6px 10px;text-align:left;vertical-align:top}
.sc-md th{background:var(--dsw-alias-bg-layer-2);font-weight:600;white-space:nowrap}
.sc-md tr:last-child td{border-bottom:none}
.sc-md th:last-child,.sc-md td:last-child{border-right:none}
.sc-md img{max-width:100%;height:auto;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:#fff;display:block;margin:6px 0}
.sc-md a{color:var(--dsw-alias-brand-primary);text-decoration:none}
.sc-md a:hover{text-decoration:underline}
.sc-md hr{border:none;border-top:1px solid var(--dsw-alias-border-l1);margin:14px 0}
.sc-md .sc-fn{font-size:.75em;color:var(--dsw-alias-brand-primary)}
.sc-md .sc-footnote{font-size:11.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);padding:5px var(--sc-sp-2);border-top:1px dashed var(--dsw-alias-border-l1);overflow-wrap:anywhere}
.sc-md .sc-fn-id{display:inline-block;margin-right:6px;padding:0 5px;border-radius:var(--sc-r-sm);background:var(--dsw-alias-bg-layer-2);font-family:ui-monospace,monospace;font-size:10.5px}
.sc-md mark{background:rgba(255,243,163,.5);color:inherit;padding:0 2px;border-radius:2px}
.sc-md del{opacity:.7}
/* 正文里裸出现的表格/列表（宿主直接产出，没有 sc-md 外层） */
.sc-seg table,.sc-table{border-collapse:collapse;width:100%;font-size:12.5px;margin:0 0 var(--sc-sp-3)}
.sc-seg th,.sc-seg td,.sc-table th,.sc-table td{border:1px solid var(--dsw-alias-border-l1);padding:6px 10px;text-align:left;vertical-align:top}
.sc-seg th,.sc-table th{background:var(--dsw-alias-bg-layer-2);font-weight:600}
.sc-seg .sc-table-wrap{overflow-x:auto;margin:0 0 var(--sc-sp-3);border:1px solid var(--dsw-alias-border-l1);border-radius:6px}
.sc-seg ul,.sc-seg ol{margin:0 0 var(--sc-sp-2);padding-left:22px}
.sc-seg li{margin-bottom:3px;line-height:var(--sc-lh-body)}
/* ---- 读前建构 ---- */
/* 六段式分节布局：左侧目录 200px + 右侧单节内容。
 * 原来 15KB 一次性渲染，用户要滚六屏；现在一屏一节。 */
.sc-pf-layout{display:grid;grid-template-columns:196px 1fr;gap:var(--sc-sp-4);align-items:start}
.sc-pf-nav{position:sticky;top:0;display:flex;flex-direction:column;gap:2px}
.sc-pf-navitem{display:flex;gap:var(--sc-sp-2);align-items:flex-start;text-align:left;padding:7px var(--sc-sp-2);
  border:none;border-left:2px solid transparent;background:none;color:var(--dsw-alias-label-secondary);
  cursor:pointer;font:inherit;border-radius:0 6px 6px 0}
.sc-pf-navitem:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sc-pf-navitem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.sc-pf-navitem[data-on=true]{border-left-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.sc-pf-navnum{flex:none;font-size:var(--sc-fs-base);line-height:1.5;opacity:.9}
.sc-pf-navtext{min-width:0;display:flex;flex-direction:column}
.sc-pf-navlabel{font-size:var(--sc-fs-sm);line-height:1.5;font-weight:500}
.sc-pf-navitem[data-on=true] .sc-pf-navlabel{font-weight:600}
.sc-pf-navhint{font-size:10.5px;line-height:1.45;opacity:.65;margin-top:1px}
.sc-pf-content{min-width:0;max-width:80ch}
.sc-pf-foot{display:flex;gap:var(--sc-sp-2);align-items:center;margin-top:var(--sc-sp-4);
  padding-top:var(--sc-sp-3);border-top:1px solid var(--dsw-alias-border-l1)}
.sc-pf{font-size:var(--sc-fs-base);line-height:1.75}
/* 六段式区块：原来是裸 <section>，六段之间没有任何分隔，13KB 糊成一片。
 * 现在每段一张卡、有圆角、有间隔，扫一眼就知道"这是第几段"。 */
.sc-pf-sec{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-md);
  padding:var(--sc-sp-3) var(--sc-sp-4);margin:0 0 var(--sc-sp-3);background:var(--dsw-alias-bg-layer-1)}
.sc-pf-sec:last-child{margin-bottom:0}
.sc-pf-h{font-size:var(--sc-fs-md);font-weight:600;margin:0 0 var(--sc-sp-3);
  padding-bottom:var(--sc-sp-2);border-bottom:1px solid var(--dsw-alias-border-l1);
  display:flex;align-items:baseline;gap:var(--sc-sp-2);line-height:var(--sc-lh-tight)}
.sc-pf-h em{font-style:normal;color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm);font-weight:400}
.sc-pf-body{min-width:0}
.sc-pf-body>p:last-child{margin-bottom:0}
.sc-pf h3{font-size:var(--sc-fs-base);font-weight:600;margin:0 0 10px;padding-bottom:6px;
  border-bottom:1px solid var(--dsw-alias-border-l1);line-height:1.5}
.sc-pf section,.sc-pf .sc-part{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-md);
  padding:var(--sc-sp-3) 14px;margin:0 0 10px;background:var(--dsw-alias-bg-layer-1)}
.sc-pf-part+.sc-part{margin-top:0}
.sc-pf ul,.sc-pf ol{margin:0;padding-left:20px}
.sc-pf li{margin-bottom:5px;line-height:1.75}
.sc-pf li::marker{color:var(--dsw-alias-label-secondary)}
.sc-pf p{margin:0 0 var(--sc-sp-2)}
.sc-pf p:last-child{margin-bottom:0}
.sc-list{margin:0;padding-left:20px}
.sc-list>li{margin-bottom:4px;line-height:1.75}
.sc-list>li::marker{color:var(--dsw-alias-label-secondary)}
.sc-req{color:var(--dsw-alias-label-secondary);margin:0 0 10px;padding:7px 10px;
  border-radius:6px;background:var(--dsw-alias-bg-layer-2)}
/* 键值卡片：左侧窄标签、右侧内容 */
.sc-kv2{display:grid;grid-template-columns:56px 1fr;gap:2px var(--sc-sp-3);margin-bottom:var(--sc-sp-2);
  align-items:start;line-height:1.75}
.sc-kv2:last-child{margin-bottom:0}
.sc-kv2-k{color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm);line-height:1.75;
  white-space:nowrap;padding-top:1px}
.sc-kv2-v{min-width:0}
.sc-kv2-v>ul,.sc-kv2-list{margin:0;padding-left:18px}
.sc-kv2-v>p:last-child{margin-bottom:0}
.sc-kv2-list>li>p{margin:0}
/* 知识点块 */
.sc-kp{border-left:2px solid var(--sc-core-line);padding:2px 0 2px 10px;margin:10px 0}
.sc-kp:last-child{margin-bottom:0}
.sc-kp-h{font-weight:600;margin-bottom:3px;line-height:1.6}
.sc-kp-b{margin:0}
.sc-kp-b>p{margin:0 0 4px}
.sc-kp-b>p:last-child{margin-bottom:0}
.sc-kp-note{color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm);margin-top:var(--sc-sp-1);line-height:1.7}
/* 档位标签：了解/理解/掌握/熟练掌握 四档用同一强调色的 4 级不透明度 */
.sc-lv{display:inline-block;font-size:var(--sc-fs-xs);line-height:16px;padding:0 6px;border-radius:var(--sc-r-sm);
  color:var(--dsw-alias-label-primary);margin-left:5px;vertical-align:1px;white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l2)}
.sc-lv[data-lv=了解]{background:rgba(100,116,139,.14)}
.sc-lv[data-lv=理解]{background:rgba(100,116,139,.26)}
.sc-lv[data-lv=掌握]{background:rgba(100,116,139,.40)}
.sc-lv[data-lv=熟练掌握]{background:rgba(100,116,139,.58);color:var(--dsw-alias-label-primary);font-weight:600}
.sc-assessment{margin-left:var(--sc-sp-2)}
/* 思考题 / 参考资料列表 */
.sc-ex-list,.sc-ref-list{margin:0;padding-left:20px}
.sc-ex{margin-bottom:var(--sc-sp-3);line-height:1.75}
.sc-ex:last-child{margin-bottom:0}
.sc-ex-q{font-weight:500}
.sc-ex-q>p{margin:0}
.sc-rubric{margin:2px 0 0;padding-left:20px;color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm)}
.sc-rubric>li{margin-bottom:2px;line-height:1.7}
.sc-muted{color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm);margin-top:3px;line-height:1.7}
.sc-ref{display:flex;gap:var(--sc-sp-2);align-items:baseline;margin-bottom:6px;line-height:1.7}
.sc-ref-kind{flex:none;font-size:var(--sc-fs-xs);padding:0 6px;border-radius:var(--sc-r-sm);white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.sc-ref-kind[data-kind=原文]{background:var(--sc-core-bg);color:var(--sc-core-fg);border-color:var(--sc-core-line)}
.sc-ref-kind[data-kind=联网检索]{background:var(--sc-ref-bg);color:var(--sc-ref-fg);border-color:var(--sc-ref-line)}
.sc-ref-kind[data-kind=我的知识]{background:var(--dsw-alias-bg-layer-2)}
.sc-ref-body{min-width:0}
.sc-ref-note{color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm)}
/* ---- 图谱 SVG（archify iframe 的降级路径） ---- */
.sc-graph-wrap{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-md);background:var(--dsw-alias-bg-layer-1);overflow:auto;max-height:70vh}
.sc-graph{display:block;min-width:100%}
.sc-glegend{display:flex;gap:10px;flex-wrap:wrap;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);margin-bottom:var(--sc-sp-2)}
.sc-glegend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.sc-gtip{position:absolute;z-index:30;max-width:300px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--sc-r-md);padding:var(--sc-sp-2) 10px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:var(--sc-fs-sm);line-height:1.7;pointer-events:none}
`

    if (typeof document !== 'undefined' && !document.getElementById('sc-style')) {
      const style = document.createElement('style')
      style.id = 'sc-style'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    /* ------------------------------------------------------------ 数据 */

    async function api(path, init) {
      const res = await fetch(`${API}${path}`, {
        headers: { 'content-type': 'application/json' },
        ...init,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `请求失败 ${res.status}`)
      return body
    }

    const q = (ws) => (ws ? `?ws=${encodeURIComponent(ws)}` : '')

    const STAGES = [
      { key: 'ingested', label: '导入' },
      { key: 'planned', label: '读前' },
      { key: 'annotated', label: '读中' },
      { key: 'mapped', label: '图谱' },
      { key: 'drilled', label: '考核' },
    ]

    function stageIndex(progress) {
      if (!progress) return -1
      let idx = 0
      for (let i = 0; i < STAGES.length; i += 1) if (progress[STAGES[i].key]) idx = i
      return progress.ingested ? idx : -1
    }

    const pct = (v) => `${Math.max(0, Math.min(100, Math.round((v ?? 0) * 100)))}%`

    /* --------------------------------------------------------- 小组件 */

    function StagePills({ progress }) {
      const idx = stageIndex(progress)
      return h(
        'div',
        { className: 'sc-stage' },
        STAGES.map((s, i) =>
          h('span', { key: s.key, className: 'sc-pill', 'data-on': i <= idx && idx >= 0 }, s.label),
        ),
      )
    }

    function IssueList({ issues }) {
      const list = (issues ?? []).filter(Boolean)
      if (list.length === 0) return null
      return h(
        'div',
        { style: { marginTop: 10 } },
        list.map((it, i) =>
          h(
            'div',
            { key: i, className: 'sc-issue', 'data-level': it.level },
            `${it.level === 'warn' ? '⚠ ' : '✕ '}${it.message}${it.where ? `（${it.where}）` : ''}`,
          ),
        ),
      )
    }

    const Empty = ({ children }) => h('div', { className: 'sc-empty' }, children)

    /* -------------------------------------------------------- 读前面板 */

    /* -------------------------------------------------------- 读前面板 */

    /**
     * 读前建构面板。
     *
     * 解决两个问题：
     * 1. 六段式原来是 15KB HTML 一次性塞进去，要滚六屏才能看完。
     *    改成左侧分节目录 + 右侧只渲染当前一节，「一眼看到学什么/怎么考」。
     * 2. 降级路径原来只实现了 ①②，③④⑤⑥ 完全缺失（数据在，代码没写）。
     *
     * 六段本身仍然由宿主渲染（见 service.renderPreflightHtml），界面不再自己拼字段，
     * 保证 Agent 看到的结构和用户看到的一致。
     */
    const PF_SECTIONS = [
      { key: '①', label: '资料摘要', hint: '300 字看懂这份资料讲什么' },
      { key: '②', label: '对我的帮助与目标', hint: '为什么学、学到什么程度' },
      { key: '③', label: '目标·要求·重点·难点', hint: '每一部分要盯住什么' },
      { key: '④', label: '考核方式与知识点', hint: '了解/理解/掌握/熟练掌握' },
      { key: '⑤', label: '思考题与作业', hint: '费曼式自测' },
      { key: '⑥', label: '参考资料', hint: '原文 / 联网检索 / 我的知识' },
    ]

    /** 把六段式 HTML 按 <section class="sc-pf-sec"> 切成六块，供分节渲染。 */
    function splitPreflight(html) {
      if (!html) return {}
      const out = {}
      const re = /<section class="sc-pf-sec">([\s\S]*?)<\/section>/g
      let m
      let i = 0
      while ((m = re.exec(html)) !== null) {
        const key = PF_SECTIONS[i]?.key
        if (key) out[key] = `<section class="sc-pf-sec">${m[1]}</section>`
        i += 1
      }
      return out
    }

    function PreflightPane({ project, onJump }) {
      const plan = project.preflight
      const [cur, setCur] = useState('①')

      const blocks = useMemo(() => splitPreflight(project.preflightHtml), [project.preflightHtml])

      if (!plan) {
        return h(
          Empty,
          null,
          h('div', null, '还没有读前建构。'),
          h('div', { className: 'sc-muted', style: { marginTop: 8 } }, '在对话里说「帮我做读前建构」，Agent 会加载 study-preflight 技能生成六段式。'),
        )
      }

      // 宿主没给 HTML 时的降级：仍要六段齐全，缺哪段就明说缺
      if (!project.preflightHtml) {
        return h(
          'div',
          null,
          h(IssueList, { issues: plan.check?.issues }),
          h(FallbackPreflight, { plan }),
        )
      }

      const body = blocks[cur]
      return h(
        'div',
        { className: 'sc-pf-layout' },
        h(
          'nav',
          { className: 'sc-pf-nav', role: 'tablist', 'aria-label': '读前建构分节' },
          PF_SECTIONS.map((s) =>
            h(
              'button',
              {
                key: s.key,
                role: 'tab',
                'aria-selected': cur === s.key ? 'true' : 'false',
                className: 'sc-pf-navitem',
                'data-on': cur === s.key ? 'true' : 'false',
                onClick: () => setCur(s.key),
              },
              h('span', { className: 'sc-pf-navnum' }, s.key),
              h(
                'span',
                { className: 'sc-pf-navtext' },
                h('span', { className: 'sc-pf-navlabel' }, s.label),
                h('span', { className: 'sc-pf-navhint' }, s.hint),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'sc-pf-content' },
          h(IssueList, { issues: plan.check?.issues }),
          body
            ? h('div', { className: 'sc-md', dangerouslySetInnerHTML: { __html: body } })
            : h('div', { className: 'sc-muted' }, `第 ${cur} 部分还没有内容。`),
          h(
            'div',
            { className: 'sc-pf-foot' },
            h(
              'button',
              {
                className: 'sc-btn',
                disabled: cur === '①',
                onClick: () => {
                  const i = PF_SECTIONS.findIndex((s) => s.key === cur)
                  if (i > 0) setCur(PF_SECTIONS[i - 1].key)
                },
              },
              '← 上一节',
            ),
            h(
              'button',
              {
                className: 'sc-btn sc-btn-primary',
                disabled: cur === '⑥',
                onClick: () => {
                  const i = PF_SECTIONS.findIndex((s) => s.key === cur)
                  if (i >= 0 && i < PF_SECTIONS.length - 1) setCur(PF_SECTIONS[i + 1].key)
                },
              },
              cur === '⑥' ? '看完了，去读正文 →' : '下一节 →',
            ),
            cur === '⑥' && onJump
              ? h('button', { className: 'sc-btn', onClick: () => onJump('read') }, '进入读中加工')
              : null,
          ),
        ),
      )
    }

    /** 降级渲染：宿主没给 preflightHtml 时用的兜底，六段都要有。 */
    function FallbackPreflight({ plan }) {
      const md = (t) => h('div', { style: { whiteSpace: 'pre-wrap', lineHeight: 1.8 } }, String(t ?? '—'))
      const sec = (num, title, body) =>
        h(
          'section',
          { className: 'sc-pf-sec' },
          h('h3', { className: 'sc-pf-h' }, `${num}　${title}`),
          h('div', { className: 'sc-pf-body' }, body),
        )
      const parts = plan.parts ?? []
      return h(
        'div',
        { className: 'sc-pf' },
        sec('①', '资料摘要', md(plan.summary)),
        sec(
          '②',
          '对我的帮助与目标',
          h(
            'div',
            { className: 'sc-kv' },
            h('span', null, '对我的帮助'), md(plan.goals?.help),
            h('span', null, '总目标'), md(plan.goals?.main),
            h('span', null, '子目标'), md((plan.goals?.subgoals ?? []).map((s) => (typeof s === 'string' ? s : s.text)).join('\n')),
          ),
        ),
        sec(
          '③',
          '每一部分的目标、要求、重点、难点',
          parts.length
            ? h(
                'div',
                null,
                parts.map((p, i) =>
                  h(
                    'div',
                    { className: 'sc-part', key: i },
                    h('h3', null, p.title ?? `第 ${i + 1} 部分`),
                    h('div', { className: 'sc-kv2' }, h('span', { className: 'sc-kv2-k' }, '重点'), h('div', { className: 'sc-kv2-v' }, md((p.keyPoints ?? []).join('\n')))),
                    h('div', { className: 'sc-kv2' }, h('span', { className: 'sc-kv2-k' }, '难点'), h('div', { className: 'sc-kv2-v' }, md((p.difficulties ?? []).join('\n')))),
                  ),
                ),
              )
            : h('div', { className: 'sc-muted' }, '（还没有分部分内容）'),
        ),
        sec(
          '④',
          '每一部分的考核方式与知识点',
          parts.length
            ? h(
                'div',
                null,
                parts.map((p, i) =>
                  h(
                    'div',
                    { className: 'sc-part', key: i },
                    h('h3', null, p.title ?? `第 ${i + 1} 部分`, h('span', { className: 'sc-lv', 'data-lv': p.assessment?.level ?? '' }, p.assessment?.level ?? '—')),
                    p.assessment?.requirement ? h('div', { className: 'sc-req' }, p.assessment.requirement) : null,
                    (p.knowledgePoints ?? []).map((kp, j) =>
                      h(
                        'div',
                        { className: 'sc-kp', key: j },
                        h('div', { className: 'sc-kp-h' }, `知识点 ${j + 1}　${kp.name ?? ''}`),
                        h('div', { className: 'sc-kp-b' }, md(kp.content)),
                        kp.note ? h('div', { className: 'sc-kp-note' }, `备注：${kp.note}`) : null,
                      ),
                    ),
                  ),
                ),
              )
            : h('div', { className: 'sc-muted' }, '（还没有考核要求）'),
        ),
        sec(
          '⑤',
          '思考题与作业（费曼）',
          (plan.exercises ?? []).length
            ? h('ol', { className: 'sc-ex-list' }, plan.exercises.map((ex, i) => h('li', { className: 'sc-ex', key: i }, h('div', { className: 'sc-ex-q' }, ex.question ?? '') )))
            : h('div', { className: 'sc-muted' }, '（还没有思考题）'),
        ),
        sec(
          '⑥',
          '参考资料',
          (plan.references ?? []).length
            ? h(
                'ol',
                { className: 'sc-ref-list' },
                plan.references.map((r, i) =>
                  h(
                    'li',
                    { className: 'sc-ref', key: i },
                    h('span', { className: 'sc-ref-kind', 'data-kind': r.kind ?? '我的知识' }, r.kind ?? '我的知识'),
                    h('div', { className: 'sc-ref-body' }, r.title ?? r.name ?? '', r.note ? h('div', { className: 'sc-ref-note' }, r.note) : null),
                  ),
                ),
              )
            : h('div', { className: 'sc-muted' }, '（还没有参考资料）'),
        ),
      )
    }

    /* -------------------------------------------------------- 精读面板 */

    /**
     * 读中加工面板。
     *
     * 关键：正文用宿主渲染好的 annotatedHtml —— 三色高亮已经加在
     * 原文的具体短语上（<strong class="sc-hl-core">…</strong>），
     * 界面只负责把它塞进 DOM，不再自己拼颜色。
     *
     * 早期版本按段落套 class 整段变色，导致"每段都是一块颜色"、
     * 注意力机制完全失效；现在高亮是短语级的。
     */
    function ReadingPane({ project, onAsk, onLocate, workspace }) {
      const [sel, setSel] = useState(null)
      const [selText, setSelText] = useState('')
      const [onlyAnnotated, setOnlyAnnotated] = useState(false)
      const [asking, setAsking] = useState(false)
      const [answer, setAnswer] = useState(null)
      const [listening, setListening] = useState(false)

      const items = project.annotations?.items ?? []
      const stats = project.annotations?.stats
      const issues = project.annotations?.issues
      const byId = useMemo(() => new Map(items.map((it) => [it.segmentId, it])), [items])
      const segments = project.segments ?? []

      // 宿主已经把整篇渲染成带高亮的 HTML；这里按 ¶N 切回来以便逐段交互
      const htmlBySeg = useMemo(() => {
        const raw = project.annotatedHtml ?? ''
        const out = new Map()
        const re = /<section class="sc-seg"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g
        let m
        while ((m = re.exec(raw))) out.set(m[1], m[2])
        return out
      }, [project.annotatedHtml])

      const shown = onlyAnnotated ? segments.filter((s) => byId.has(s.id)) : segments

      /** 读当前选中的文字（Selection 必须 toString() 才是文字） */
      const readSelection = () => {
        const sel = window.getSelection?.()
        return String(sel ? sel.toString() : '').trim()
      }

      /**
       * 语音提问。
       *
       * 用户场景是"手在翻页、正在读"，打字会打断节奏，所以语音是刚需。
       * 但浏览器语音识别依赖厂商服务，可能不可用——因此做成"增强"：
       * 有 SpeechRecognition 就显示麦克风，没有就完全不显示，
       * 手打输入始终可用。
       */
      const canVoice =
        typeof window !== 'undefined' &&
        Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

      /**
       * 发起追问。
       *
       * 这里只负责"带上段落上下文记录这次追问"，答案必须由 Agent 在对话里给出
       * （解释词语要看上下文，界面端没有模型）。
       *
       * 为了让用户点了就真的能得到回答，这里把问题写进剪贴板并给出明确指引：
       * 用户按 Ctrl+V 回车即可。试过直接写输入框，但输入框不在本插件的控制范围内，
       * 硬改 DOM 很脆弱；宁可让用户多按一次，也不能让按钮点了没反应。
       */
      /**
       * 选中词 → 落库 → 等 Agent 回填答案 → 就地显示。
       *
       * 原来是"把问题复制到剪贴板，让用户自己去输入框粘贴"——按钮点了没结果，
       * 用户必须离开面板操作。现在改成：
       * 1. POST /term 建立一条待答记录（带上下文，后端按 id 直查，不再丢后 82 段）
       * 2. 界面上立刻显示"正在结合上下文解释…"
       * 3. 每 1.2 秒轮询 /terms-pending，Agent 调 study_term 回填后自动显示
       *
       * 仍然保留"复制问题"按钮作为兜底：万一 Agent 没被叫醒，用户可以手动发一次。
       */
      const doAsk = async (word, segmentId) => {
        if (!word) return
        setAsking(true)
        setAnswer(null)
        try {
          const r = await api('/term', {
            method: 'POST',
            body: JSON.stringify({
              workspace,
              docId: project.id,
              term: word,
              segmentId,
              question: `「${word}」在这里是什么意思？`,
              source: 'ui',
            }),
          })
          const prompt = `在《${project.title ?? project.id}》${segmentId ?? ''} 这段里，「${word}」是什么意思？请结合上下文解释，不要只给字典释义。`
          setAnswer({ word, segmentId, prompt, pending: true, context: r?.context ?? '' })
          if (onAsk) onAsk(word, segmentId)
        } catch (e) {
          setAnswer({ word, text: `追问失败：${e.message}`, error: true })
        } finally {
          setAsking(false)
        }
      }

      // 轮询待答记录：Agent 回填后把答案显示出来
      useEffect(() => {
        if (!answer?.pending) return undefined
        let alive = true
        const tick = async () => {
          try {
            const r = await api(`/terms-pending/${encodeURIComponent(project.id)}${q(workspace)}`)
            const items = r?.items ?? []
            if (!alive) return
            // 这条已经不在待答列表里了 → 说明被答过，去拿全量找到它
            if (!items.some((it) => it.term === answer.word)) {
              const p = await api(`/project/${encodeURIComponent(project.id)}${q(workspace)}`)
              if (!alive) return
              const hit = [...(p.terms ?? [])]
                .reverse()
                .find((it) => it.term === answer.word && it.answer)
              if (hit) {
                setAnswer((a) => (a ? { ...a, pending: false, text: hit.answer } : a))
              }
            }
          } catch {
            /* 轮询失败不打扰用户，下次再试 */
          }
        }
        const timer = window.setInterval(tick, 1200)
        tick()
        return () => {
          alive = false
          window.clearInterval(timer)
        }
      }, [answer?.pending, answer?.word, project.id, workspace])

      // 语音识别的实例要留住，否则"聆听中"无法停止，用户只能等它自己超时
      const recRef = useRef(null)

      const stopVoice = () => {
        try {
          recRef.current?.stop()
        } catch {
          /* 已经停了 */
        }
        recRef.current = null
        setListening(false)
      }

      const startVoice = () => {
        const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!Ctor) return
        const rec = new Ctor()
        recRef.current = rec
        rec.lang = 'zh-CN'
        rec.interimResults = false
        rec.maxAlternatives = 1
        rec.onresult = (e) => {
          const said = String(e.results?.[0]?.[0]?.transcript ?? '').trim()
          setListening(false)
          recRef.current = null
          if (said) {
            setSelText(said)
            if (sel) doAsk(said, sel.seg.id)
          }
        }
        rec.onerror = () => {
          recRef.current = null
          setListening(false)
        }
        rec.onend = () => {
          recRef.current = null
          setListening(false)
        }
        setListening(true)
        try {
          rec.start()
        } catch {
          recRef.current = null
          setListening(false)
        }
      }

      return h(
        'div',
        { style: { position: 'relative' } },

        // ---- 顶部图例：三色语义 + 预算进度 ----
        // 颜色必须跟 CSS 里的 --sc-*-line 一致，否则用户看到的图例和正文对不上
        h(
          'div',
          { className: 'sc-legend' },
          h('span', null, h('i', { style: { background: 'var(--sc-core-line)' } }), '核心 ≤10%'),
          h('span', null, h('i', { style: { background: 'var(--sc-hard-line)' } }), '攻坚 ≤8%'),
          h('span', null, h('i', { style: { background: 'var(--sc-ref-line)' } }), '参考 不限'),
          stats
            ? h(
                'span',
                { title: '高亮字数 / 全文总字数' },
                `已标 ${stats.total}/${segments.length} 段 · 高亮 ${stats.highlightedChars}/${stats.totalChars} 字（${pct(stats.ratio)}）`,
              )
            : h('span', { className: 'sc-muted' }, '还没有标注'),
          h(
            'label',
            { style: { marginLeft: 'auto', cursor: 'pointer', userSelect: 'none' } },
            h('input', {
              type: 'checkbox',
              checked: onlyAnnotated,
              onChange: (e) => setOnlyAnnotated(e.target.checked),
              style: { verticalAlign: '-2px', marginRight: 4 },
            }),
            '只看已标注',
          ),
        ),

        h(IssueList, { issues }),

        // ---- 正文：直接用宿主的 annotatedHtml，高亮已在原文位置上 ----
        // 选中词有两种触发方式：mouseup（鼠标拖选）与 selectionchange
        // （键盘 shift+方向键、以及触屏长按）。只监听 mouseup 会漏掉后两种。
        h(
          'div',
          {
            className: 'sc-md',
            onMouseUp: () => setSelText(readSelection()),
            onTouchEnd: () => setSelText(readSelection()),
            onKeyUp: () => setSelText(readSelection()),
          },
          shown.map((seg) => {
            const a = byId.get(seg.id)
            const inner = htmlBySeg.get(seg.id)
            return h(
              'section',
              {
                key: seg.id,
                className: 'sc-seg',
                'data-seg': seg.id,
                onClick: () => {
                  // 只有真的选中了词才弹追问层。
                  // 原来点空白处也会弹，读文章时经常误触。
                  const picked = readSelection()
                  if (!picked) return
                  setSelText(picked)
                  setSel({ seg })
                  setAnswer(null)
                },
              },
              h(
                'div',
                { className: 'sc-seg-meta' },
                a
                  ? h('span', { className: `sc-tag sc-tag-${a.label}` }, `#${a.label}`)
                  : h('span', { className: 'sc-tag' }, seg.id),
                seg.chapter ? h('span', { className: 'sc-muted' }, seg.chapter) : null,
                h('span', { className: 'sc-muted', style: { marginLeft: 'auto' } }, `${seg.chars} 字`),
              ),
              // 有宿主渲染的高亮版就用它；否则退回纯文本 Markdown
              inner !== undefined
                ? h('div', { dangerouslySetInnerHTML: { __html: inner } })
                : h('div', { dangerouslySetInnerHTML: { __html: seg.html || '' } }),
            )
          }),
        ),

        // ---- 追问浮层 ----
        sel
          ? h(
              'div',
              { className: 'sc-pop' },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                h('b', null, `${sel.seg.id}`),
                h('span', { className: 'sc-muted' }, `${sel.seg.chars} 字`),
                h(
                  'button',
                  {
                    className: 'sc-btn',
                    style: { marginLeft: 'auto' },
                    onClick: () => {
                      setSel(null)
                      setSelText('')
                      setAnswer(null)
                    },
                  },
                  '关闭',
                ),
              ),
              selText
                ? h('div', { style: { marginTop: 6 } }, '选中：', h('b', null, selText.length > 40 ? `${selText.slice(0, 40)}…` : selText))
                : h('div', { className: 'sc-muted', style: { marginTop: 6 } }, '在正文里选中不懂的词，或直接说/打出来'),
              h(
                'div',
                { style: { marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' } },
                h(
                  'button',
                  { className: 'sc-btn sc-btn-primary', disabled: !selText || asking, onClick: () => doAsk(selText, sel.seg.id) },
                  asking ? '追问中…' : '问选中的词',
                ),
                canVoice
                  ? h(
                      'button',
                      {
                        className: `sc-btn ${listening ? 'sc-btn-primary' : ''}`,
                        onClick: listening ? stopVoice : startVoice,
                        title: listening ? '点一下停止聆听' : '用麦克风说你要问的词',
                      },
                      listening ? '🎙 聆听中…（点击停止）' : '🎙 语音提问',
                    )
                  : h(
                      // 不支持语音时不留一个点了没反应的按钮，直接说明原因
                      'span',
                      { className: 'sc-muted', title: '当前浏览器不支持语音识别，可用 Chrome 或 Edge' },
                      '（此浏览器不支持语音）',
                    ),
                h(
                  'button',
                  {
                    className: 'sc-btn',
                    onClick: () => {
                      const word = prompt('要问哪个词？') || ''
                      if (word.trim()) {
                        setSelText(word.trim())
                        doAsk(word.trim(), sel.seg.id)
                      }
                    },
                  },
                  '手动输入',
                ),
              ),
              answer
                ? h(
                    'div',
                    { style: { marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--dsw-alias-border-l1)' } },
                    h('div', { className: 'sc-muted' }, `「${answer.word}」在这段话里的意思`),
                    answer.pending
                      ? h(
                          'div',
                          { style: { marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' } },
                          h('span', { className: 'sc-spin', 'aria-hidden': 'true' }),
                          h('span', null, '正在结合这段上下文解释…'),
                        )
                      : h(
                          'div',
                          { style: { marginTop: 6, lineHeight: 1.75, whiteSpace: 'pre-wrap' } },
                          answer.text ?? '',
                        ),
                    // 兜底：Agent 没被叫醒时，用户可以手动把问题发出去
                    answer.pending
                      ? h(
                          'button',
                          {
                            className: 'sc-btn sc-btn-sm',
                            style: { marginTop: 10 },
                            onClick: async () => {
                              try {
                                await navigator.clipboard.writeText(answer.prompt)
                                setAnswer((a) => (a ? { ...a, copied: true } : a))
                              } catch {
                                /* 剪贴板不可用时下方文本仍然可选 */
                              }
                            },
                          },
                          answer.copied ? '✓ 已复制' : '复制问题，自己去输入框问',
                        )
                      : null,
                    answer.pending && answer.copied
                      ? h(
                          'div',
                          { className: 'sc-muted', style: { marginTop: 6, userSelect: 'all' } },
                          answer.prompt,
                        )
                      : null,
                  )
                : null,
            )
          : null,
      )
    }

    /* -------------------------------------------------------- 图谱面板 */



    /** 按节点像素宽度折行，中英混排各自计宽。 */
    function wrapToWidth(text, pxWidth, fontSize = 11.5, maxLines = 3) {
      const src = String(text ?? '')
      const widthOf = (ch) =>
        /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.56
      const lines = []
      let cur = ''
      let curW = 0
      for (const ch of src) {
        const w = widthOf(ch)
        if (curW + w > pxWidth && cur) {
          lines.push(cur)
          cur = ch
          curW = w
          if (lines.length === maxLines) break
        } else {
          cur += ch
          curW += w
        }
      }
      if (cur && lines.length < maxLines) lines.push(cur)
      // 如果还有没排完的内容，最后一行加省略号
      const shown = lines.join('')
      if (shown.length < src.length && lines.length) {
        const last = [...lines[lines.length - 1]]
        while (last.length && (last.join('') + '…').length * fontSize > pxWidth) last.pop()
        lines[lines.length - 1] = `${last.join('')}…`
      }
      return lines
    }

    /**
     * 知识图谱面板。
     *
     * 用户明确要求「知识点之间的逻辑衔接图用 archify 技能实现」，
     * 所以这里不自己画 SVG，而是内嵌 archify 生成好的独立 HTML。
     * 那些 HTML 自带暗色/亮色主题、缩放、节点详情，比自己画的信息量大得多。
     *
     * 关系图节点多时 archify 会拆成多张（保证字号可读），
     * so 这里做成多张切换，而不是硬塞一张大图。
     */
    function GraphPane({ project }) {
      const figures = project.figures ?? []
      const [active, setActive] = useState(0)
      const nodes = project.relations?.nodes ?? []
      const edges = project.relations?.edges ?? []

      const current = figures[active]

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 10, height: '100%' } },

        // ---- 概览 ----
        h(
          'div',
          { className: 'sc-legend' },
          h('span', null, `知识点 ${nodes.length} 个`),
          h('span', null, `关系 ${edges.length} 条`),
          figures.length
            ? h('span', null, `archify 图 ${figures.length} 张`)
            : h('span', { className: 'sc-muted' }, '尚未生成图'),
          h(
            'a',
            {
              href: current ? current.url : '#',
              target: '_blank',
              rel: 'noreferrer',
              className: 'sc-btn',
              style: { marginLeft: 'auto', textDecoration: 'none', opacity: current ? 1 : 0.4 },
            },
            '新窗口打开',
          ),
        ),

        // ---- 多张图的切换 ----
        figures.length > 1
          ? h(
              'div',
              { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
              figures.map((f, i) =>
                h(
                  'button',
                  {
                    key: f.index,
                    className: `sc-btn ${i === active ? 'sc-btn-primary' : ''}`,
                    onClick: () => setActive(i),
                    title: `第 ${f.index} 张：${f.nodeCount} 个知识点、${f.edgeCount} 条关系`,
                  },
                  f.title,
                ),
              ),
            )
          : null,

        // ---- 图本体：archify 的 HTML 直接用 iframe 内嵌 ----
        current
          ? h('iframe', {
              key: current.url,
              src: current.url,
              title: current.title,
              style: {
                flex: 1,
                minHeight: 520,
                width: '100%',
                border: '1px solid var(--dsw-alias-border-l1)',
                borderRadius: 10,
                background: 'var(--dsw-alias-bg-base)',
              },
            })
          : h(
              Empty,
              null,
              nodes.length
                ? '关系数据已有，但还没生成 archify 图。让 Agent 重新保存一次知识点关系图即可。'
                : '还没有知识点关系图。先完成读前建构与标注，再让 Agent 生成知识点关系。',
            ),

        // ---- 关系清单：图看的是结构，清单用来核对 ----
        nodes.length
          ? h(
              'details',
              { className: 'sc-details' },
              h('summary', null, `关系清单（${edges.length} 条）`),
              h(
                'div',
                { style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 } },
                edges.slice(0, 200).map((e, i) => {
                  const label = (id) => nodes.find((n) => n.id === id)?.label ?? id
                  const rel = REL_ZH_UI[e.relation] ?? e.relation
                  return h(
                    'div',
                    { key: i, className: 'sc-muted', style: { fontSize: 12 } },
                    `${label(e.from)} ——${rel}→ ${label(e.to)}`,
                  )
                }),
              ),
            )
          : null,
      )
    }

    /** 关系中文名，与宿主 archify-figures.js 的 REL_ZH 保持一致 */
    const REL_ZH_UI = {
      prerequisite: '前置',
      'part-of': '整体-部分',
      partof: '整体-部分',
      contains: '包含',
      contrast: '对比',
      cause: '因果',
      'example-of': '例证',
      example: '例证',
      application: '应用',
      apply: '应用',
      sequence: '次序',
      analogy: '类比',
      related: '相关',
    }

    /**
     * QA 自测卡片。
     *
     * 答案默认折叠——这是「主动回忆」的关键：
     * 先自己回想，再点开核对。答案直接摊开会让人不假思索地读过去，
     * 那就退化成"又读了一遍"，起不到自测作用。
     */
    function QaCard({ pairs }) {
      const [open, setOpen] = useState({})
      if (!pairs?.length) {
        return h(
          'div',
          { className: 'sc-card' },
          h('h4', null, '读完自测（QA）'),
          h('div', { className: 'sc-muted' }, '还没有 QA。读完全文后让 Agent 生成一份速查问答，每条不超过 100 字。'),
        )
      }
      return h(
        'div',
        { className: 'sc-card' },
        h('h4', null, `读完自测（QA，${pairs.length} 条）`),
        h('div', { className: 'sc-muted', style: { marginBottom: 8 } }, '先在心里答一遍，再点开核对答案。'),
        pairs.map((p, i) =>
          h(
            'div',
            { key: i, style: { padding: '7px 0', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
            h(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'flex-start' } },
              h('span', { className: 'sc-muted', style: { minWidth: 18 } }, `${i + 1}.`),
              h('div', { style: { flex: 1, lineHeight: 1.65 } }, p.q),
              h(
                'button',
                {
                  className: 'sc-btn',
                  style: { flex: 'none' },
                  onClick: () => setOpen((v) => ({ ...v, [i]: !v[i] })),
                },
                open[i] ? '收起' : '看答案',
              ),
            ),
            open[i]
              ? h(
                  'div',
                  { style: { marginTop: 6, marginLeft: 26, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } },
                  p.a,
                  (p.segmentIds ?? []).length
                    ? h('span', { className: 'sc-muted' }, `　（${p.segmentIds.join('、')}）`)
                    : null,
                )
              : null,
          ),
        ),
      )
    }

    /**
     * 读完自测面板。
     *
     * 为什么要单独一个页签：QA 原来是塞在"费曼考核"页底部的，
     * 而它其实是考核**之前**的那一步（先能回忆细节，再能完整复述）。
     * 混在一起用户根本不知道有这一步，进度也一直推不动。
     */
    function RecallPane({ project }) {
      const pairs = project.qa ?? []
      const [cov, setCov] = useState(null)
      useEffect(() => {
        let alive = true
        api(`/coverage/${encodeURIComponent(project.id)}`)
          .then((d) => alive && setCov(d))
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [project.id, project.annotations])

      const total = cov?.total ?? project.progress?.segmentCount ?? 0
      const doneCount = cov?.done ?? project.progress?.annotatedCount ?? 0
      const pct = cov?.percent ?? (total ? Math.round((doneCount / total) * 1000) / 10 : 0)
      const left = cov?.skippedCount ?? Math.max(0, total - doneCount)

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, '这一步做什么'),
          h(
            'div',
            { style: { lineHeight: 1.8 } },
            '闭上书，按顺序过一遍下面的问答。先在心里答，再点开核对。',
            '答不上来的说明那段只是"看过"，不是"记住"——回到读中加工把那段的三色高亮再看一遍。',
          ),
          // 覆盖率必须带分母。只说"已标注 37"没有意义，
          // 用户看不出还有 145 段没碰。
          h(
            'div',
            { className: 'sc-muted', style: { marginTop: 8 } },
            `加工进度 ${doneCount}/${total} 段（${pct}%），还剩 ${left} 段没标；QA ${pairs.length} 条。`,
          ),
          left > 0 && (cov?.groups ?? []).length
            ? h(
                'details',
                { style: { marginTop: 8 } },
                h('summary', { className: 'sc-muted', style: { cursor: 'pointer' } }, '哪几节还没标？'),
                h(
                  'div',
                  { style: { marginTop: 6 } },
                  cov.groups.slice(0, 6).map((g, i) =>
                    h(
                      'div',
                      { key: i, className: 'sc-muted', style: { fontSize: 'var(--sc-fs-sm)', padding: '2px 0' } },
                      `${g.heading}　${g.count} 段 · ${g.chars} 字`,
                    ),
                  ),
                ),
              )
            : null,
        ),
        h(QaCard, { pairs }),
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, '怎么补 QA'),
          h(
            'div',
            { className: 'sc-muted', style: { lineHeight: 1.8 } },
            '在对话里说「我读完了，帮我留点自测题」，Agent 会加载 study-recall 技能生成 6-12 条问答，每条问题和回答都不超过 100 字，并给一个明天能做完的最小行动。',
          ),
        ),
      )
    }

    function QuizPane({ project }) {
      const [terms, setTerms] = useState(project.terms ?? [])
      useEffect(() => setTerms(project.terms ?? []), [project.terms])
      return h(
        'div',
        null,
        h(QaCard, { pairs: project.qa }),
        // 参考资料：宿主早就渲染好了 refsHtml，但界面从来没显示过。
        // 用户明确要求第 6 段要有参考资料清单并标注 原文/我的知识/联网检索。
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, '参考资料（原文 / 联网检索 / 我的知识）'),
          project.refsHtml
            ? h('div', { className: 'sc-md', dangerouslySetInnerHTML: { __html: project.refsHtml } })
            : h('div', { className: 'sc-muted' }, '还没有参考资料。让 Agent 做读前建构时会一并生成。'),
        ),
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, '思考题与费曼作业'),
          project.quizHtml
            ? h('div', { className: 'sc-md', dangerouslySetInnerHTML: { __html: project.quizHtml } })
            : project.quiz
              ? h('pre', { className: 'sc-pre' }, project.quiz)
              : h('div', { className: 'sc-muted' }, '还没有生成考核材料。'),
        ),
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, `术语追问记录（${terms.length}）`),
          terms.length === 0
            ? h('div', { className: 'sc-muted' }, '还没有追问记录。在精读页选中词后面板右下角可以「问选中的词」。')
            : terms.map((t, i) =>
                h(
                  'div',
                  { key: i, style: { marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
                  h('div', null, h('b', null, t.term), t.segmentId ? h('span', { className: 'sc-muted' }, `　${t.segmentId}`) : null),
                  h('div', { className: 'sc-muted' }, t.question),
                  t.answer ? h('div', { style: { marginTop: 4, lineHeight: 1.7 } }, t.answer) : null,
                ),
              ),
        ),
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, `我的复述记录（${(project.drills ?? []).length}）`),
          (project.drills ?? []).length === 0
            ? h(
                'div',
                { className: 'sc-muted' },
                '还没有复述记录。请在对话里说「考考我」，用自己的话讲一遍；只有真的讲过，进度才会走到「考核」。',
              )
            : project.drills.map((d, i) =>
                h(
                  'div',
                  { key: i, style: { marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
                  h('div', { className: 'sc-muted' }, d.prompt ? `题：${d.prompt}` : '（自由复述）'),
                  h('div', { style: { marginTop: 4, lineHeight: 1.7 } }, d.answer),
                  d.verdict ? h('div', { style: { marginTop: 4 } }, h('b', null, '判卷：'), d.verdict) : null,
                  (d.rubricHit ?? []).length
                    ? h('div', { className: 'sc-muted' }, `达标要点：${d.rubricHit.join('、')}`)
                    : null,
                  d.minimalAction ? h('div', { className: 'sc-muted' }, `下一步最小行动：${d.minimalAction}`) : null,
                ),
              ),
        ),
      )
    }

    /* ------------------------------------------------------ 工作台主面板 */

    /**
     * 复习到期横幅。
     *
     * 只在"真的有资料到期"时出现，其余时候不占地方——
     * 一个永远存在的横幅等于没有提示。
     */
    function ReviewBanner({ onOpen }) {
      const [state, setState] = useState(null)
      const [done, setDone] = useState({})
      useEffect(() => {
        let alive = true
        api('/review')
          .then((d) => alive && setState(d))
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [])

      const due = (state?.due ?? []).filter((i) => !done[i.docId])
      if (!due.length) return null

      const mark = async (docId) => {
        // 先乐观更新，避免点了没反应
        setDone((v) => ({ ...v, [docId]: true }))
        try {
          await api('/review-done', { method: 'POST', body: JSON.stringify({ docId }) })
          const d = await api('/review')
          setState(d)
        } catch {
          setDone((v) => ({ ...v, [docId]: false }))
        }
      }

      return h(
        'div',
        { className: 'sc-review' },
        h('div', { className: 'sc-review-title' }, `今天该复习 ${due.length} 份`),
        due.map((i) =>
          h(
            'div',
            { key: i.docId, className: 'sc-review-item' },
            h('span', { className: 'sc-review-name' }, i.title),
            i.overdueDays > 0 ? h('span', { className: 'sc-muted' }, `已拖 ${i.overdueDays} 天`) : null,
            h(
              'button',
              { className: 'sc-btn sc-btn-sm', onClick: () => onOpen?.(i.docId) },
              '打开',
            ),
            h(
              'button',
              { className: 'sc-btn sc-btn-sm', onClick: () => mark(i.docId), title: '标记这次复习完成，下次间隔会拉长' },
              '复习过了',
            ),
          ),
        ),
      )
    }

    function Workbench(props) {
      const { useWorkspaces } = props
      const snapshot = useWorkspaces ? useWorkspaces((s) => s) : null
      // 手动指定的工作区要跨刷新保留，否则每次 F5 都退回默认目录
      const LS_KEY = 'study-copilot.workspace'
      const [manualWs, setManualWsRaw] = useState(() => {
        try {
          return window.localStorage.getItem(LS_KEY) || null
        } catch {
          return null
        }
      })
      const setManualWs = useCallback((v) => {
        setManualWsRaw(v)
        try {
          if (v) window.localStorage.setItem(LS_KEY, v)
          else window.localStorage.removeItem(LS_KEY)
        } catch {
          /* 隐私模式下不可写，忽略 */
        }
      }, [])
      const [wsInput, setWsInput] = useState('')
      const fromSnapshot =
        snapshot?.workspaces?.[0]?.path ??
        snapshot?.activeWorkspace?.path ??
        snapshot?.active?.path ??
        snapshot?.list?.[0]?.path ??
        (Array.isArray(snapshot) ? snapshot[0]?.path : null) ??
        null
      const wsPath = manualWs ?? fromSnapshot
      const [projects, setProjects] = useState([])
      const [docId, setDocId] = useState(null)
      const [project, setProject] = useState(null)
      const [tab, setTab] = useState('read')
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      const [showDiag, setShowDiag] = useState(false)
      const [diag, setDiag] = useState(null)
      const [candidates, setCandidates] = useState([])

      const refresh = useCallback(async () => {
        try {
          const data = await api(`/projects${q(wsPath)}`)
          // 后端在发现“别的目录里有项目”时会给出 suggested，直接采用并记住
          if (!manualWs && data.suggested && data.suggested !== wsPath) {
            setManualWs(data.suggested)
            return
          }
          setProjects(data.items ?? [])
          setDiag({
            workspace: data.workspace,
            requested: data.requested,
            resolvedTo: data.resolvedTo,
            hint: data.hint,
            candidates: data.candidates,
          })
          if (data.candidates) setCandidates(data.candidates.filter((c) => c.count > 0))
          setError(null)
          if (!docId && data.items?.length) setDocId(data.items[0].id)
        } catch (e) {
          setError(e.message)
        }
      }, [wsPath, docId, manualWs, setManualWs])

      useEffect(() => {
        refresh()
      }, [refresh])

      useEffect(() => {
        if (!docId) {
          setProject(null)
          return
        }
        let alive = true
        api(`/project/${encodeURIComponent(docId)}${q(wsPath)}`)
          .then((data) => alive && setProject(data))
          .catch((e) => alive && setError(e.message))
        return () => {
          alive = false
        }
      }, [docId, wsPath])

      const ask = useCallback(
        async (term, segmentId) => {
          if (!term || !docId) return
          setBusy(true)
          try {
            await api('/term', {
              method: 'POST',
              body: JSON.stringify({ docId, term, segmentId, source: 'ui' }),
            })
            const data = await api(`/project/${encodeURIComponent(docId)}${q(wsPath)}`)
            setProject(data)
            // 注意：这里不再 setTab('quiz')。用户正在读，追问后应该留在原地，
            // 答案由 ReadingPane 就地显示；跳到别的页签会打断阅读。
          } catch (e) {
            setError(e.message)
          } finally {
            setBusy(false)
          }
        },
        [docId, wsPath],
      )

      /* Tab 顺序 = 学习流程顺序。
       * 原来第一个 Tab 是"精读加工"、默认也停在它，而学习第一步是读前建构，
       * 用户一进来看到的是一堆正文，却看不到"我要学什么、怎么考"。 */
      const tabs = [
        { key: 'plan', label: '读前建构', stage: 'planned' },
        { key: 'read', label: '读中加工', stage: 'annotated' },
        { key: 'graph', label: '知识图谱', stage: 'mapped' },
        { key: 'recall', label: '读完自测', stage: 'recalled' },
        { key: 'quiz', label: '费曼考核', stage: 'drilled' },
      ]

      // 默认落在"下一步该做的那一步"上，用户打开就知道从哪开始
      const nextTabKey = useMemo(() => {
        const action = project?.next?.action ?? ''
        if (!action) return 'plan'
        if (action === 'study-preflight' || action === 'study_ingest') return 'plan'
        if (action === 'study-annotate') return 'read'
        if (action === 'study-map') return 'graph'
        if (action === 'study-recall') return 'recall'
        if (action === 'study-feynman') return 'quiz'
        return 'plan'
      }, [project?.next?.action])

      // 用户没手动点过 Tab 时，跟随 next 走；点过之后就尊重他的选择
      const [tabTouched, setTabTouched] = useState(false)
      useEffect(() => {
        if (!tabTouched && project) setTab(nextTabKey)
      }, [nextTabKey, tabTouched, project])

      return h(
        'div',
        { className: 'sc-root' },
        h(
          'div',
          { className: 'sc-head' },
          h('span', { className: 'sc-title' }, '学习工作台'),
          project ? h(StagePills, { progress: project.progress }) : null,
          h('span', { style: { flex: 1 } }),
          h('button', { className: 'sc-btn', onClick: refresh, disabled: busy }, '刷新'),
          h(
            'button',
            { className: 'sc-btn', style: { marginLeft: 6 }, onClick: () => setShowDiag((v) => !v), title: '诊断：查看工作区解析情况' },
            '诊断',
          ),
        ),
        error ? h('div', { className: 'sc-issue', style: { margin: '8px 16px' } }, error) : null,
        showDiag
          ? h(
              'div',
              { className: 'sc-card', style: { margin: '8px 16px' } },
              h('h4', null, '定位学习项目'),
              h(
                'div',
                { className: 'sc-muted', style: { lineHeight: 1.8 } },
                '可以直接填你的资料文件路径（如 ',
                h('code', null, 'D:\\learn\\学习资料\\book\\chapter4.md'),
                '），或填项目根目录。系统会自动向上找到存放学习项目的目录。',
              ),
              diag?.workspace
                ? h('div', { style: { marginTop: 6 } }, '当前使用：', h('b', null, diag.workspace))
                : null,
              diag?.requested && diag?.resolvedTo && diag.requested !== diag.resolvedTo
                ? h('div', { className: 'sc-muted', style: { marginTop: 4 } }, `「${diag.requested}」→ 已解析为 ${diag.resolvedTo}`)
                : null,
              diag?.hint ? h('div', { className: 'sc-issue', 'data-level': 'warn', style: { marginTop: 8 } }, diag.hint) : null,
              h(
                'div',
                { style: { marginTop: 8, display: 'flex', gap: 6 } },
                h('input', {
                  className: 'sc-btn',
                  style: { flex: 1, minWidth: 0, cursor: 'text' },
                  placeholder: '粘贴资料路径或目录，如 D:\\learn',
                  value: wsInput,
                  onChange: (e) => setWsInput(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') {
                      const v = wsInput.trim()
                      if (v) setManualWs(v)
                    }
                  },
                }),
                h(
                  'button',
                  {
                    className: 'sc-btn',
                    onClick: () => {
                      const v = wsInput.trim()
                      if (v) setManualWs(v)
                    },
                  },
                  '定位',
                ),
                manualWs
                  ? h(
                      'button',
                      {
                        className: 'sc-btn',
                        onClick: () => {
                          setManualWs(null)
                          setWsInput('')
                        },
                      },
                      '恢复自动',
                    )
                  : null,
              ),
              candidates.length
                ? h(
                    'div',
                    { style: { marginTop: 10 } },
                    h('div', { className: 'sc-muted' }, '这些目录里发现了学习项目，点一下即可切换：'),
                    candidates.map((c) =>
                      h(
                        'button',
                        {
                          key: c.path,
                          className: 'sc-btn',
                          style: { display: 'block', width: '100%', textAlign: 'left', marginTop: 4 },
                          onClick: () => setManualWs(c.path),
                        },
                        `${c.path}　（${c.count} 个项目）`,
                      ),
                    ),
                  )
                : null,
            )
          : null,
        h(
          'div',
          { className: 'sc-body' },
          h(
            'div',
            { className: 'sc-side' },
            h('div', { className: 'sc-muted', style: { padding: '4px 6px 8px' } }, `资料库（${projects.length}）`),
            projects.length === 0
              ? h(
                  'div',
                  { className: 'sc-muted', style: { padding: '4px 6px', lineHeight: 1.8 } },
                  h('div', null, '这个目录下没有学习项目。'),
                  h('div', { style: { marginTop: 6 } }, '可能的原因：'),
                  h('div', { style: { marginTop: 4 } }, '· 填的是资料所在文件夹，而不是导入过资料的目录'),
                  h('div', null, '· 项目被导入到了别的工作区'),
                  h(
                    'button',
                    { className: 'sc-btn', style: { marginTop: 8 }, onClick: () => setShowDiag(true) },
                    '打开定位，填资料路径',
                  ),
                )
              : projects.map((p) =>
                  h(
                    'button',
                    {
                      key: p.id,
                      className: 'sc-doc',
                      'data-active': p.id === docId,
                      onClick: () => setDocId(p.id),
                    },
                    h('div', { className: 'sc-doc-name' }, p.title),
                    h('div', { className: 'sc-muted' }, `${p.format} · ${p.chars} 字 · ${p.progress?.annotatedCount ?? 0}/${p.segmentCount} 段`),
                  ),
                ),
          ),
          h(
            'div',
            { className: 'sc-main' },
            project
              ? h(
                  React.Fragment,
                  null,
                  // 复习到期提醒：间隔重复的关键是"该复习时被提醒"，
                  // 而不是让用户自己记着哪天学过什么。
                  h(ReviewBanner, { onOpen: setDocId }),
                  h(
                    'div',
                    { className: 'sc-tabs' },
                    tabs.map((t) =>
                      h(
                        'button',
                        { key: t.key, className: 'sc-tab', 'data-active': tab === t.key, onClick: () => { setTabTouched(true); setTab(t.key) } },
                        t.label,
                      ),
                    ),
                  ),
                  h(
                    'div',
                    { className: 'sc-pane' },
                    tab === 'read'
                      ? h(ReadingPane, { project, onAsk: ask, workspace: wsPath })
                      : tab === 'plan'
                        ? h(PreflightPane, { project, onJump: setTab })
                        : tab === 'graph'
                          ? h(GraphPane, { project })
                          : tab === 'recall'
                            ? h(RecallPane, { project })
                            : h(QuizPane, { project }),
                  ),
                )
              : h(Empty, null, '从左侧选一份资料，或先在对话里导入一份。'),
          ),
        ),
      )
    }

    /* ------------------------------------------------------ 输入框停靠条 */

    function DockBar(props) {
      const { useWorkspaces } = props
      const snapshot = useWorkspaces ? useWorkspaces((s) => s) : null
      const wsPath = snapshot?.workspaces?.[0]?.path ?? null
      const [current, setCurrent] = useState(null)

      useEffect(() => {
        let alive = true
        api(`/projects${q(wsPath)}`)
          .then((d) => alive && setCurrent(d.items?.[0] ?? null))
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [wsPath])

      if (!current) return null
      const idx = stageIndex(current.progress)
      return h(
        'div',
        { className: 'sc-dock' },
        h('b', null, current.title),
        h(StagePills, { progress: current.progress }),
        h('span', { style: { flex: 1 } }),
        h('span', null, current.next?.message ?? ''),
        idx >= 0
          ? h(
              'span',
              { style: { width: 60 } },
              h('div', { className: 'sc-bar' }, h('i', { style: { width: pct((idx + 1) / STAGES.length) } })),
            )
          : null,
      )
    }

    /* ------------------------------------------------------------ 图标 */

    function BookIcon({ size = 18 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z' }),
        h('path', { d: 'M4 17.5A2.5 2.5 0 0 1 6.5 15H20' }),
      )
    }

    /* ------------------------------------------------------------ 组装 */

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => '学习工作台' }, BookIcon),
        )

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, Workbench),
        )

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({ name: 'conversation.composer.dock', id: 'study-copilot-dock', order: 8 }, DockBar),
        )
      },
      components: { Workbench, DockBar, BookIcon },
    }
  },
})
