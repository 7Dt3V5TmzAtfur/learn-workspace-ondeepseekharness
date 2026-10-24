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
  /* 字号随 --sc-scale 缩放：不同屏幕/视力下同一份正文的可读性不一样 */
  --sc-scale:1;
  --sc-fs-xs:calc(11px * var(--sc-scale)); --sc-fs-sm:calc(12px * var(--sc-scale)); --sc-fs-base:calc(13.5px * var(--sc-scale));
  --sc-fs-md:calc(14px * var(--sc-scale)); --sc-fs-lg:calc(16px * var(--sc-scale));
  --sc-fs-xl:calc(19px * var(--sc-scale)); --sc-fs-2xl:calc(24px * var(--sc-scale));
  /* 间距：4px 基栅 */
  --sc-sp-1:4px; --sc-sp-2:8px; --sc-sp-3:12px; --sc-sp-4:16px; --sc-sp-5:24px; --sc-sp-6:32px;
  /* 行高 */
  --sc-lh-tight:1.4; --sc-lh-body:1.8;
  /* 圆角 */
  --sc-r-sm:4px; --sc-r-md:8px; --sc-r-lg:12px;
  /* 三色注意力（浅色主题） */
  --sc-core-fg:#b45309; --sc-core-bg:#fff7ed; --sc-core-line:#f59e0b;
  --sc-hard-fg:#a21caf; --sc-hard-bg:#fdf4ff; --sc-hard-line:#c026d3;
  --sc-ref-fg:#0f766e;  --sc-ref-bg:#f0fdfa;  --sc-ref-line:#14b8a6;
  --sc-hl-pad:0 2px;
  --sc-lv-color:var(--dsw-alias-label-secondary);
}
/* 深色必须单独给值。原来全部靠 rgba(x,.10) 叠在深色底上，
 * 实测深底 #2c2c2e 上 10% 蓝 ≈ #313a4a，几乎看不见。 */
body[data-ds-dark-theme] .sc-root{
  --sc-core-fg:#fdba74; --sc-core-bg:#3a2617; --sc-core-line:#f59e0b;
  --sc-hard-fg:#f0abfc; --sc-hard-bg:#3b1d3f; --sc-hard-line:#c026d3;
  --sc-ref-fg:#5eead4;  --sc-ref-bg:#12332f;  --sc-ref-line:#14b8a6;
}
.sc-root{display:flex;flex-direction:column;height:100%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:var(--sc-fs-base)}
.sc-head{display:flex;align-items:center;gap:var(--sc-sp-2);padding:10px var(--sc-sp-4);border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.sc-title{font-size:var(--sc-fs-md);font-weight:600}
.sc-muted{color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm)}
/* 读取中的等待态：只在"已选中但数据未到"时出现。
   不加这个的话，慢一点的项目会先闪一下"请从左侧选择"，
   用户会以为自己点错了，又去点一次。 */
.sc-wait{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;
  color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm)}
.sc-wait-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-brand-primary);
  animation:sc-wait-pulse 1.1s ease-in-out infinite}
.sc-wait-txt{letter-spacing:.02em}
@keyframes sc-wait-pulse{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){
  .sc-wait-dot{animation:none;opacity:.7}
}
.sc-body{display:flex;flex:1;min-height:0}
.sc-side{width:230px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:var(--sc-sp-2)}
.sc-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.sc-doc{display:block;width:100%;text-align:left;padding:var(--sc-sp-2) 10px;border-radius:6px;border:1px solid transparent;background:none;color:inherit;cursor:pointer;font:inherit;margin-bottom:var(--sc-sp-1)}
.sc-doc:hover{background:var(--dsw-alias-bg-layer-2)}
.sc-doc:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.sc-doc[data-active=true]{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l2)}
.sc-doc-name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* ---- 资料库：标题行、常驻加号、右键菜单、内联路径框 ---- */
.sc-zoom{display:inline-flex;align-items:center;gap:2px;margin-right:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-sm);padding:0 2px}
.sc-zoom-btn{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:var(--sc-fs-xs);line-height:1;padding:4px 6px;border-radius:var(--sc-r-sm);cursor:pointer}
.sc-zoom-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sc-zoom-btn:disabled{opacity:.35;cursor:default}
.sc-zoom-val{min-width:34px;text-align:center;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.sc-side-head{display:flex;align-items:center;gap:6px;padding:2px 2px 8px 6px}
.sc-side-title{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm)}
.sc-side-add{width:22px;height:22px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid transparent;border-radius:var(--sc-r-sm);background:transparent;color:var(--dsw-alias-label-secondary);font-size:15px;line-height:1;cursor:pointer}
.sc-side-add:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.sc-side-add:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.sc-menu{position:fixed;z-index:80;min-width:212px;max-width:280px;padding:6px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--sc-r-md);box-shadow:0 10px 30px rgba(0,0,0,.22)}
.sc-menu-item{display:flex;width:100%;align-items:center;gap:8px;padding:7px 10px;border:0;border-radius:var(--sc-r-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:var(--sc-fs-sm);text-align:left;cursor:pointer;white-space:nowrap}
.sc-menu-item:hover,.sc-menu-item:focus-visible{background:var(--dsw-alias-bg-layer-2);outline:none}
.sc-menu-sep{height:1px;margin:5px 4px;background:var(--dsw-alias-border-l1)}
.sc-menu-note{padding:5px 10px 3px;color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-path-row{display:flex;gap:6px;margin:0 0 6px;padding:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-sm);background:var(--dsw-alias-bg-layer-1)}
.sc-path-row input{flex:1;min-width:0;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:var(--sc-fs-sm);outline:none}
.sc-path-hint{margin:0 0 6px;padding:0 6px;color:var(--dsw-alias-danger,#e5484d);font-size:var(--sc-fs-xs);line-height:1.7}
.sc-tabs{display:flex;gap:2px;padding:6px var(--sc-sp-3) 0;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;overflow-x:auto}
.sc-tab{border:none;background:none;color:var(--dsw-alias-label-secondary);padding:7px var(--sc-sp-3);border-radius:6px 6px 0 0;cursor:pointer;font:inherit;border-bottom:2px solid transparent;white-space:nowrap}
.sc-tab:hover{color:var(--dsw-alias-label-primary)}
.sc-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.sc-tab[data-active=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
.sc-tab i{font-style:normal;opacity:.55;margin-left:4px;font-size:var(--sc-fs-xs)}
.sc-pane{flex:1;overflow:auto;padding:var(--sc-sp-4) var(--sc-sp-5)}
/* ---- 阶段操作条：五个页签同一位置，左说明右按钮 ---- */
.sc-stage-bar{display:flex;align-items:center;gap:var(--sc-sp-3);padding:8px var(--sc-sp-3);border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:none}
.sc-stage-txt{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm);line-height:1.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-stage-bar .sc-btn{flex:none}
.sc-stage-bar .sc-btn[data-warn=true]{border-color:var(--dsw-alias-danger,#e5484d);color:var(--dsw-alias-danger,#e5484d)}
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
/* 阅读区只保留"细左边线"表示这一段的档位，不再整段染色：
 * 整段底色会让人以为整段都是核心，而三色标的是段内的短语。 */
.sc-seg{position:relative;border-left:2px solid transparent;padding:10px var(--sc-sp-3) 10px 44px;margin-bottom:2px;scroll-margin-top:80px}
.sc-seg[data-tier=core]{border-left-color:var(--sc-core-line)}
.sc-seg[data-tier=hard]{border-left-color:var(--sc-hard-line)}
.sc-seg[data-tier=ref]{border-left-color:var(--sc-ref-line)}
.sc-seg:hover{background:var(--dsw-alias-bg-layer-1)}
/* 段号只做定位用：平时几乎透明，鼠标停在这段才显出来 */
.sc-seg-mark{position:absolute;left:4px;top:12px;width:34px;text-align:right;font-size:calc(10px * var(--sc-scale));color:var(--dsw-alias-label-secondary);opacity:.18;transition:opacity .15s;pointer-events:none;user-select:none}
.sc-seg:hover .sc-seg-mark,.sc-seg:focus-within .sc-seg-mark{opacity:.7}
/* 章节标题只在换节时出现一次，不再每段重复 */
.sc-chapter{margin:22px 0 6px;padding-left:2px;font-size:var(--sc-fs-md);font-weight:600;letter-spacing:.01em}
.sc-seg:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-seg p{margin:0 0 6px;line-height:var(--sc-lh-body);text-indent:2em}
.sc-seg p:last-child{margin-bottom:0}
.sc-seg li p,.sc-seg blockquote p,.sc-seg td p,.sc-seg th p{text-indent:0}
.sc-seg h1,.sc-seg h2,.sc-seg h3,.sc-seg h4,.sc-seg h5,.sc-seg h6{text-indent:0}
.sc-seg .sc-h{font-weight:600;margin:2px 0 5px}

/* 三色短语：加粗 + 文字色 + 下划线三件事一起做。
 * 原来只写了 border-left-color，但 <strong> 是行内元素且没设 border-style，
 * 这条规则完全无效 —— 实际只有 10% 的背景色，三色几乎看不出差别。 */
.sc-hl-core,.sc-hl-hard,.sc-hl-ref{font-weight:700;color:inherit;border-radius:2px;padding:var(--sc-hl-pad)}
.sc-hl-core{background:var(--sc-core-bg);box-shadow:inset 0 -2px 0 var(--sc-core-line);color:var(--sc-core-fg)}
.sc-hl-hard{background:var(--sc-hard-bg);box-shadow:inset 0 -2px 0 var(--sc-hard-line);color:var(--sc-hard-fg)}
.sc-hl-ref{background:var(--sc-ref-bg);box-shadow:inset 0 -2px 0 var(--sc-ref-line);color:var(--sc-ref-fg)}

/* 渐构角色标记：只显示 #d，放在左侧留白里。
 * 它曾经是段落首行里的胶囊，再后来是一整行旁注——两种都在打断正文。
 * 现在正文完全不包含它，位置、颜色、显隐都由版面决定。 */
/* 正文容器：宿主把每段渲染成 inline 文本 + <br>，没有 <p>，
 * 所以首行缩进必须落在这个容器上，而不是 p 上。 */
.sc-seg > div{text-indent:2em}
.sc-seg > div > .sc-seg-note,.sc-seg-note,.sc-pause{text-indent:0}
/* 角色徽标独占一行，但压到最轻：它是旁注，不是正文。
 * 之前是带底色的胶囊挤在首行里，读起来像"段落编号后面的所属文字"。 */
.sc-seg-role{position:absolute;left:2px;top:30px;width:36px;text-align:right;font-size:calc(10px * var(--sc-scale));font-weight:600;letter-spacing:.02em;opacity:.5;transition:opacity .15s;cursor:help;user-select:none}
/* 悬停整段就显示角色全称：只挂在小标记上时，鼠标几乎不可能正好停在 36px 里。
 * 面板向上落在这段的上留白中，不遮挡正文。 */
.sc-seg-role-full{display:none;position:absolute;left:44px;bottom:calc(100% + 4px);width:max-content;max-width:320px;padding:3px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-sm);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:var(--sc-fs-xs);font-weight:400;line-height:1.6;white-space:normal;box-shadow:0 2px 8px rgba(0,0,0,.12);z-index:6;pointer-events:none}
.sc-seg:hover .sc-seg-role-full,.sc-seg:focus-within .sc-seg-role-full{display:block}
.sc-seg[data-tier=core] .sc-seg-role{color:var(--sc-core-fg)}
.sc-seg[data-tier=hard] .sc-seg-role{color:var(--sc-hard-fg)}
.sc-seg[data-tier=ref] .sc-seg-role{color:var(--sc-ref-fg)}
.sc-seg:hover .sc-seg-role{opacity:.95}
/* 窄屏没有余量放留白标记：直接收起，正文优先 */
@media (max-width:760px){.sc-seg{padding-left:12px}.sc-seg-mark,.sc-seg-role{display:none}}
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

/* ============================ 入口
   一个框装三种投喂方式。虚线框是"这里可以放东西"的通用语言，
   悬停变色 + 轻微放大给出"接住了"的即时反馈（每步都要有即时回报）。 */
.sc-entry{max-width:520px;margin:0 auto;padding:8px 4px}
.sc-entry-box{border:2px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:34px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s,transform .15s;background:var(--dsw-alias-bg-layer-1)}
.sc-entry-box:hover{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.sc-entry-box:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-entry-box.is-over{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);transform:scale(1.01)}
.sc-entry-title{font-size:var(--sc-fs-md);color:var(--dsw-alias-label-primary);font-weight:500;margin-bottom:6px}
.sc-entry-sub{font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);line-height:1.6}
.sc-entry-path{margin-top:10px}
.sc-entry-input{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:var(--sc-fs-sm);font-family:inherit}
.sc-entry-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.sc-entry-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.75}
.sc-entry-err{margin-top:10px;padding:8px 10px;border-radius:6px;font-size:var(--sc-fs-sm);line-height:1.6;color:var(--dsw-alias-label-primary);background:rgba(229,72,77,.10);border-left:3px solid var(--dsw-alias-state-error-primary)}
.sc-entry-err-hint{margin-top:4px;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary)}
.sc-entry-aside{margin-top:14px;text-align:center;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);line-height:1.7}
.sc-entry-asktip{margin-top:8px;padding:7px 10px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary);text-align:left;line-height:1.7}
.sc-linkbtn{background:none;border:none;padding:0 2px;color:var(--dsw-alias-brand-primary);cursor:pointer;font:inherit;text-decoration:underline;text-underline-offset:2px}
.sc-linkbtn:hover{opacity:.8}
.sc-linkbtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:3px}
@media (prefers-reduced-motion:reduce){.sc-entry-box{transition:none}.sc-entry-box.is-over{transform:none}}

/* ============================ 30 秒预览
   回答"要不要读"，不是"怎么读"。所以不放进度条、不放百分比，
   只放结构 + 成本 + 三句原话。整块必须一屏放得下。 */
.sc-peek{max-width:620px;margin:0 auto;padding:10px 6px;text-align:left}
.sc-peek-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.sc-peek-title{font-size:var(--sc-fs-md);font-weight:600;color:var(--dsw-alias-label-primary)}
.sc-peek-meta{font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.sc-peek-outline{display:flex;flex-wrap:wrap;gap:4px 6px;margin:10px 0}
.sc-peek-item{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:3px 8px;font:inherit;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-peek-item[data-lv="1"]{color:var(--dsw-alias-label-primary);font-weight:500}
.sc-peek-item:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.sc-peek-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.sc-peek-hooks{display:flex;flex-direction:column;gap:6px;margin:4px 0 12px}
.sc-peek-hook{display:flex;gap:8px;align-items:flex-start;font-size:var(--sc-fs-sm);line-height:1.7}
.sc-peek-hook-k{flex:0 0 auto;color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-xs);padding-top:2px;white-space:nowrap}
.sc-peek-hook-t{flex:1;text-align:left;background:none;border:none;padding:0;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border-bottom:1px dashed var(--dsw-alias-border-l2)}
.sc-peek-hook-t:hover{border-bottom-color:var(--dsw-alias-brand-primary)}
.sc-peek-hook-t:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:2px}
.sc-peek-actions{display:flex;align-items:center;gap:14px}
.sc-peek-go{background:var(--dsw-alias-brand-primary);color:#fff;border:none;border-radius:6px;padding:7px 18px;font:inherit;font-size:var(--sc-fs-sm);font-weight:500;cursor:pointer}
.sc-peek-go:hover{opacity:.9}
.sc-peek-go:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-issue{font-size:var(--sc-fs-sm);line-height:1.6;padding:5px var(--sc-sp-2);border-radius:5px;margin-bottom:var(--sc-sp-1);background:rgba(229,72,77,.10);border-left:2px solid var(--dsw-alias-state-error-primary)}
.sc-issue[data-level=warn]{background:rgba(245,158,11,.14);border-left-color:var(--dsw-alias-state-warn-primary)}
.sc-legend{display:flex;gap:var(--sc-sp-3);flex-wrap:wrap;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);margin-bottom:10px;align-items:center}
.sc-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.sc-prov{padding:0 6px;border-radius:3px;font-size:10px;line-height:1.7;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px dashed var(--dsw-alias-border-l2);cursor:help}
.sc-dock{display:flex;align-items:center;gap:var(--sc-sp-2);padding:6px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--sc-r-md);background:var(--dsw-alias-bg-layer-1);font-size:var(--sc-fs-sm);color:var(--dsw-alias-label-secondary)}
.sc-dock b{color:var(--dsw-alias-label-primary);font-weight:500}
.sc-dock-light{display:inline-flex;align-items:center;gap:5px;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-dock-light-tag{flex:0 0 auto;padding:0 5px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-size:10px;line-height:1.5}
/* 停靠条上的"标注是脚本回填的"：虚线边、低对比，不抢主推荐，但必须看见 */
.sc-dock-prov{flex:0 0 auto;padding:0 6px;border-radius:3px;font-size:10px;line-height:1.6;color:var(--dsw-alias-label-secondary);border:1px dashed var(--dsw-alias-border-l2);cursor:help;white-space:nowrap}
.sc-seg-meta{display:flex;align-items:center;gap:6px;margin-bottom:var(--sc-sp-1);font-size:var(--sc-fs-sm)}
.sc-details{margin-top:var(--sc-sp-2)}.sc-details>summary{cursor:pointer;font-size:var(--sc-fs-sm);color:var(--dsw-alias-label-secondary);user-select:none}
.sc-details>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-details[open]>summary{margin-bottom:var(--sc-sp-1)}
/* 知识点出处：图上的方块点不了，这里给出可点的落点。没有 segmentId 的节点不列。 */
.sc-cite-list{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow-y:auto}
.sc-cite-row{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;background:none;border:none;border-radius:4px;padding:4px 6px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer}
.sc-cite-row:hover{background:var(--dsw-alias-bg-layer-2)}
.sc-cite-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.sc-cite-label{flex:1;line-height:1.5}
.sc-cite-seg{flex:none;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
/* 读中页的要求条：折叠时只占一行，展开才给细节。
   它不是横幅、不是提醒，是"这一块该读到什么程度"的一句话。 */
.sc-askbar{margin:0 0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);font-size:var(--sc-fs-sm)}
.sc-askbar>summary{display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;user-select:none;line-height:1.6}
.sc-askbar>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px;border-radius:6px}
.sc-askbar-title{color:var(--dsw-alias-label-primary);font-weight:500}
.sc-askbar-lv{flex:none;padding:0 6px;border-radius:3px;font-size:10px;line-height:1.6;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.sc-askbar-lv[data-lv="熟练掌握"]{color:#0f766e;border-color:#14b8a6;background:rgba(20,184,166,.10)}
.sc-askbar-lv[data-lv="掌握"]{color:#b45309;border-color:#f59e0b;background:rgba(245,158,11,.12)}
.sc-askbar-lv[data-lv="理解"]{color:#a21caf;border-color:#c026d3;background:rgba(192,38,211,.10)}
.sc-askbar-body{padding:2px 10px 9px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:6px}
.sc-askbar-row{display:flex;gap:8px;font-size:var(--sc-fs-xs);line-height:1.7;color:var(--dsw-alias-label-secondary)}
.sc-askbar-row>b{flex:0 0 76px;color:var(--dsw-alias-label-primary);font-weight:500}
.sc-askbar-ul{margin:0;padding-left:16px;display:flex;flex-direction:column;gap:2px}
/* 语音失败的提示：说明原因 + 一句兜底，不用"错误"这种吓人的词 */
.sc-voice-err{margin-top:8px;padding:7px 10px;border-radius:6px;font-size:var(--sc-fs-xs);line-height:1.7;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border-left:3px solid var(--dsw-alias-state-warn-primary)}
.sc-pop{max-width:min(460px,calc(100% - 32px));right:16px;bottom:16px;position:absolute;z-index:20;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--sc-r-md);padding:10px var(--sc-sp-3);box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:var(--sc-fs-sm);min-width:200px}
/* 复习到期横幅：只在真的到期时出现 */
.sc-review{display:flex;flex-direction:column;gap:6px;padding:var(--sc-sp-3);margin-bottom:var(--sc-sp-3);border:1px solid var(--sc-core-line);border-radius:var(--sc-r-md);background:var(--sc-core-bg)}
.sc-review-title{font-size:var(--sc-fs-sm);font-weight:700;color:var(--sc-core-fg)}
        /* 暂停回顾：盖住原文后给一块写回想的地方，视觉上要明显"这里停了" */
        .sc-pause{border:1px dashed var(--sc-core-line);border-radius:var(--sc-r-md);
          background:var(--sc-core-bg);padding:10px 12px;margin:4px 0}
        .sc-pause-q{font-size:var(--sc-fs-sm);font-weight:700;color:var(--sc-core-fg);margin-bottom:6px}
        .sc-pause-in{width:100%;box-sizing:border-box;font:inherit;font-size:var(--sc-fs-sm);
          line-height:var(--sc-lh-body);padding:6px 8px;border-radius:var(--sc-r-sm);
          border:1px solid var(--sc-core-line);background:var(--dsw-alias-bg-base);
          color:var(--dsw-alias-label-primary);resize:vertical}
        .sc-pause-in:focus{outline:2px solid var(--sc-core-line);outline-offset:1px}
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
.sc-kp-h{font-weight:600;margin-bottom:3px;line-height:1.6;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.sc-kp-b{margin:0}
.sc-kp-b>p{margin:0 0 4px}
.sc-kp-b>p:last-child{margin-bottom:0}
.sc-kp-note{color:var(--dsw-alias-label-secondary);font-size:var(--sc-fs-sm);margin-top:var(--sc-sp-1);line-height:1.7}
/* 知识点 → 原文的回指链接。
   没有回指时显示灰色"原文位置待定位"，不给假链接：
   点了跳不到东西比没有链接更让人恼火。 */
.sc-kp-jump{margin-left:auto;font-size:var(--sc-fs-xs);font-weight:400;text-decoration:none;
  color:var(--dsw-alias-brand-primary);white-space:nowrap;padding:1px 6px;border-radius:var(--sc-r-sm)}
.sc-kp-jump:hover{background:var(--dsw-alias-bg-layer-2);text-decoration:underline}
.sc-kp-jump:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.sc-kp-nojump{margin-left:auto;font-size:var(--sc-fs-xs);font-weight:400;
  color:var(--dsw-alias-label-secondary);opacity:.7;white-space:nowrap}
/* 从读前跳到读中时，目标段落闪一下。
   不闪的话用户滚到了也不知道该看哪一行 —— 182 段的页面里滚过去就找不到了。 */
.sc-seg-flash{animation:sc-flash 1.6s ease-out}
@keyframes sc-flash{
  0%{background:color-mix(in oklab, var(--dsw-alias-brand-primary) 18%, transparent)}
  70%{background:color-mix(in oklab, var(--dsw-alias-brand-primary) 8%, transparent)}
  100%{background:transparent}
}
@media (prefers-reduced-motion:reduce){.sc-seg-flash{animation:none;
  outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}}
/* 折叠区：读前六段式默认只给骨架，重点难点与知识点正文折起来。
   打开页面要读的字从 5845 降到 2796（-52%），想核对细节的人再点开。
   summary 做成一眼可点的样子，不能像普通小标题那样看不出能点。 */
.sc-fold{margin-top:var(--sc-sp-1);border-top:1px solid var(--dsw-alias-border-l1)}
.sc-fold>summary{cursor:pointer;list-style:none;padding:6px 0;font-size:var(--sc-fs-sm);
  color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:6px;user-select:none}
.sc-fold>summary::-webkit-details-marker{display:none}
.sc-fold>summary::before{content:'▸';display:inline-block;font-size:10px;
  transition:transform .15s ease;color:var(--dsw-alias-label-secondary)}
.sc-fold[open]>summary::before{transform:rotate(90deg)}
.sc-fold>summary:hover{color:var(--dsw-alias-label-primary)}
.sc-fold>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-fold[open]>summary{margin-bottom:var(--sc-sp-1)}
.sc-kp-names{margin:0 0 var(--sc-sp-1)}
/* 「拿到了什么」：主指标一句话 + 要点列表。
   刻意不用进度条：进度条会让人想把它填满，而去标没用的碎片。 */
.sc-harvest{margin-top:var(--sc-sp-2);font-size:var(--sc-fs-md);line-height:1.7;
  color:var(--dsw-alias-label-primary);font-weight:600}
.sc-harvest-list{margin:var(--sc-sp-1) 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.sc-harvest-list>li{display:flex;gap:8px;align-items:baseline;font-size:var(--sc-fs-sm);
  color:var(--dsw-alias-label-secondary);line-height:1.6}
.sc-harvest-where{flex:none;font-variant-numeric:tabular-nums;font-size:var(--sc-fs-xs);
  color:var(--dsw-alias-label-secondary);opacity:.75;min-width:38px}
/* 复述记录：每次讲完要能看出"这次算不算数、为什么不算"。
   三道闸门（闭卷/够时间/没抄）如果只拦不解释，用户只会觉得被刁难。 */
.sc-drill{padding:var(--sc-sp-2) 0;border-bottom:1px solid var(--dsw-alias-border-l1)}
.sc-drill:last-child{border-bottom:none}
.sc-drill-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.sc-drill-badge{flex:none;font-size:var(--sc-fs-xs);padding:1px 7px;border-radius:999px;
  font-weight:600;white-space:nowrap}
.sc-drill-badge[data-valid=true]{color:var(--dsw-alias-state-success-primary);
  background:color-mix(in oklab, var(--dsw-alias-state-success-primary) 12%, transparent)}
.sc-drill-badge[data-valid=false]{color:var(--dsw-alias-state-warn-primary);
  background:color-mix(in oklab, var(--dsw-alias-state-warn-primary) 14%, transparent)}
.sc-drill-prompt{flex:1;min-width:0;font-size:var(--sc-fs-sm);color:var(--dsw-alias-label-primary)}
.sc-drill-meta{flex:none;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);
  font-variant-numeric:tabular-nums}
.sc-drill-answer{margin-top:var(--sc-sp-1);line-height:1.75;font-size:var(--sc-fs-sm)}
.sc-drill-row{margin-top:var(--sc-sp-1);font-size:var(--sc-fs-sm);line-height:1.7}
.sc-drill-warn{margin:var(--sc-sp-1) 0 0;padding-left:18px;font-size:var(--sc-fs-xs);
  color:var(--dsw-alias-state-warn-primary);line-height:1.7}
.sc-drill.is-invalid{opacity:.92}
/* 单元目录：这份资料分几块。
   默认收起，因为"想直接读"的人不该被目录挡路；
   展开后一行一块，带段数与要点数，点一下定位到那块。 */
.sc-units{margin-bottom:var(--sc-sp-3);border:1px solid var(--dsw-alias-border-l1);
  border-radius:var(--sc-r-md);padding:var(--sc-sp-2) var(--sc-sp-3);
  background:var(--dsw-alias-bg-layer-1)}
.sc-units>summary{cursor:pointer;list-style:none;font-size:var(--sc-fs-sm);font-weight:600;
  color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px;user-select:none}
.sc-units>summary::-webkit-details-marker{display:none}
.sc-units>summary::before{content:'▸';display:inline-block;font-size:10px;
  transition:transform .15s ease;color:var(--dsw-alias-label-secondary)}
.sc-units[open]>summary::before{transform:rotate(90deg)}
.sc-units>summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.sc-units-list{margin:var(--sc-sp-2) 0 0;padding:0;list-style:none;
  display:flex;flex-direction:column;gap:1px}
.sc-unit{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  padding:5px 8px;border-radius:var(--sc-r-sm);cursor:pointer;line-height:1.5;
  border-left:2px solid transparent}
.sc-unit:hover{background:var(--dsw-alias-bg-layer-2)}
.sc-unit.is-active{background:var(--dsw-alias-bg-layer-2);border-left-color:var(--dsw-alias-brand-primary)}
.sc-unit-title{font-size:var(--sc-fs-sm);color:var(--dsw-alias-label-primary)}
.sc-unit-meta{flex:none;font-size:var(--sc-fs-xs);color:var(--dsw-alias-label-secondary);
  font-variant-numeric:tabular-nums;opacity:.8}
@media (prefers-reduced-motion:reduce){.sc-units>summary::before{transition:none}}
@media (prefers-reduced-motion:reduce){.sc-fold>summary::before{transition:none}}
/* 档位标签：了解/理解/掌握/熟练掌握 四档用同一强调色的 4 级不透明度。
   间距从 5px 加到 10px：5px 时标题和档位糊成一句
   「第一部分 五类工具的分类理解」，看起来像标题的一部分。 */
.sc-lv{display:inline-block;font-size:var(--sc-fs-xs);line-height:18px;padding:0 8px;border-radius:var(--sc-r-sm);
  color:var(--dsw-alias-label-primary);margin-left:10px;vertical-align:1px;white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l2);font-weight:500;letter-spacing:.02em}
/* 四档的区分要一眼看得出：原来 .14/.26/.40/.58 在浅色底上差别太小，
   扫一行看不出哪部分要求更高，等于白标。改成四档递进 + 最高档描边。 */
.sc-lv[data-lv=了解]{background:rgba(100,116,139,.10);color:var(--dsw-alias-label-secondary)}
.sc-lv[data-lv=理解]{background:rgba(100,116,139,.22)}
.sc-lv[data-lv=掌握]{background:rgba(100,116,139,.38)}
.sc-lv[data-lv=熟练掌握]{background:rgba(100,116,139,.62);color:var(--dsw-alias-label-primary);
  font-weight:700;border-color:var(--dsw-alias-label-secondary)}
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

    /**
     * 当前资料库（工作区）。
     *
     * 只有一个来源：Workbench 解析出的 wsPath（含手动指定）。DockBar、RecallPane
     * 这些拿不到 wsPath 的组件以前干脆不传，读的是"默认工作区"——用户切过目录后，
     * 它们在另一处取数。现在由这一层记住，调用点不必各自拼 ws。
     */
    let currentWorkspace = null
    const workspaceListeners = new Set()

    function setCurrentWorkspace(ws) {
      const next = ws || null
      if (next === currentWorkspace) return
      currentWorkspace = next
      workspaceListeners.forEach((fn) => fn(next))
    }

    function useCurrentWorkspace() {
      const [ws, setWs] = useState(currentWorkspace)
      useEffect(() => {
        const listener = (v) => setWs(v)
        workspaceListeners.add(listener)
        setWs(currentWorkspace)
        return () => workspaceListeners.delete(listener)
      }, [])
      return ws
    }

    /**
     * 正文字号缩放。面板里所有字号令牌都乘这个系数，Workbench 与停靠条共用一份，
     * 写进 localStorage 以便下次打开还是这个大小。
     */
    const SCALE_KEY = 'study-copilot.scale'
    const SCALE_MIN = 0.85
    const SCALE_MAX = 1.6
    const clampScale = (v) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(v * 100) / 100))
    let currentScale = (() => {
      try {
        const raw = Number(window.localStorage.getItem(SCALE_KEY))
        return Number.isFinite(raw) && raw > 0 ? clampScale(raw) : 1
      } catch {
        return 1
      }
    })()
    const scaleListeners = new Set()

    function setScaleValue(v) {
      const next = clampScale(v)
      if (next === currentScale) return
      currentScale = next
      try {
        window.localStorage.setItem(SCALE_KEY, String(next))
      } catch {
        /* 隐私模式下不可写，忽略 */
      }
      scaleListeners.forEach((fn) => fn(next))
    }

    function useScale() {
      const [value, setValue] = useState(currentScale)
      useEffect(() => {
        const listener = (v) => setValue(v)
        scaleListeners.add(listener)
        setValue(currentScale)
        return () => scaleListeners.delete(listener)
      }, [])
      return value
    }

    /**
     * 项目列表版本号。Workbench 刷新列表后通知 DockBar 重取，
     * 否则导入新资料后停靠条仍显示旧的第一项。
     */
    const projectsListeners = new Set()

    function bumpProjects() {
      projectsListeners.forEach((fn) => fn())
    }

    function useProjectsTick() {
      const [tick, setTick] = useState(0)
      useEffect(() => {
        const listener = () => setTick((n) => n + 1)
        projectsListeners.add(listener)
        return () => projectsListeners.delete(listener)
      }, [])
      return tick
    }

    /**
     * 阶段表：/stages 只取一次，Workbench 与 DockBar 共用。
     * 以前两处各取一次，断网时还会各自失败一次。
     */
    let stagesCache = null
    const stageListeners = new Set()

    function ensureStages() {
      if (stagesCache) return Promise.resolve(stagesCache)
      return api('/stages')
        .then((d) => {
          stagesCache = Array.isArray(d?.stages) ? d.stages : []
          stageListeners.forEach((fn) => fn(stagesCache))
          return stagesCache
        })
        .catch(() => {
          stagesCache = []
          stageListeners.forEach((fn) => fn(stagesCache))
          return stagesCache
        })
    }

    function useStages() {
      const [value, setValue] = useState(stagesCache)
      useEffect(() => {
        const listener = (v) => setValue(v)
        stageListeners.add(listener)
        if (!stagesCache) ensureStages()
        else setValue(stagesCache)
        return () => stageListeners.delete(listener)
      }, [])
      return value
    }

    function apiUrl(path) {
      const needWs = currentWorkspace && !/[?&]ws=/.test(path)
      const glue = path.includes('?') ? '&' : '?'
      return `${API}${path}${needWs ? `${glue}ws=${encodeURIComponent(currentWorkspace)}` : ''}`
    }

    async function api(path, init) {
      const res = await fetch(apiUrl(path), {
        headers: { 'content-type': 'application/json' },
        ...init,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `请求失败 ${res.status}`)
      return body
    }

    /** 上传一份资料：URL 与错误文案只在这里出现一次。 */
    async function apiUpload(file) {
      const res = await fetch(apiUrl(`/ingest-upload?name=${encodeURIComponent(file.name)}`), {
        method: 'POST',
        body: file,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `导入失败（${res.status}）`)
      return body
    }

    /** 让宿主发起一个阶段：错误语义与 URL 也只在这里出现一次。 */
    async function apiRunStage(docId, stageKey) {
      const res = await fetch(apiUrl('/run-stage'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ docId, stage: stageKey }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `没能发起（${res.status}）`)
      return body
    }

    /**
     * 面板崩了要留下现场，而不是一片空白。
     *
     * 用户看到的只有"什么也不显示"，既没有堆栈也没有现场。
     * 这里把渲染异常与未捕获错误回传宿主，落到
     * <DSH_HOME>/study-copilot-client-errors.log。只发错误信息，不发学习数据。
     */
    const reportError = (payload) => {
      try {
        fetch(`${API}/client-errors`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        /* 上报失败就失败，不能反过来影响界面 */
      }
    }

    let mountReported = false

    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => {
        reportError({
          kind: 'error',
          message: String(e.message ?? ''),
          stack: e.error?.stack ?? null,
          src: e.filename ?? null,
          line: e.lineno ?? null,
        })
      })
      window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason
        reportError({
          kind: 'rejection',
          message: String(reason?.message ?? reason ?? ''),
          stack: reason?.stack ?? null,
        })
      })
    }

    /**
     * 渲染错误边界。
     * 没有它，一个组件抛错整块面板就消失，用户得不到任何可操作信息。
     */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error, info) {
        reportError({
          kind: 'render',
          message: String(error?.message ?? error),
          stack: error?.stack ?? null,
          componentStack: info?.componentStack ?? null,
        })
      }

      render() {
        const error = this.state.error
        if (!error) return this.props.children
        return h(
          'div',
          { className: 'sc-shell', style: { padding: 16 } },
          h('h4', null, '工作台渲染出错'),
          h(
            'div',
            { className: 'sc-issue', 'data-level': 'error', style: { marginTop: 8 } },
            String(error?.message ?? error),
          ),
          h(
            'div',
            { className: 'sc-muted', style: { marginTop: 8, lineHeight: 1.8 } },
            '错误已记录到 ~/.dsh/study-copilot-client-errors.log。',
            h('br'),
            '刷新面板可重试；连续失败请重启应用，并把这条日志发给我。',
          ),
        )
      }
    }

    /**
     * 阶段一律以宿主 /stages 为准（rules.js STAGES 是唯一真值）。
     *
     * 这里曾经存过一份本地阶段表，结果漏了 recalled、还把 annotations 当数组判完成，
     * 导致「读中加工」的阶段条恒说"还没有产物"。不再存第二份。
     */
    function stageIndexOf(progress, stages) {
      if (!progress?.ingested) return -1
      return (stages ?? []).filter((s) => progress[s.progressKey]).length
    }

    const pct = (v) => `${Math.max(0, Math.min(100, Math.round((v ?? 0) * 100)))}%`
    /** 占比显示：没有统计时给「—」，别把 0 和"没算"混在一起 */
    const fmtPct = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—')

    /* --------------------------------------------------------- 小组件 */

    /** 角色的完整称呼：编号 + 关键词 + 标题，缺哪个就跳过哪个 */
    const roleText = (a) => [`#${a?.label}`, a?.keyword, a?.title].filter(Boolean).join(' · ')

    /** 没有关键词与标题时不弹面板，只留 #d 本身 */
    const hasRoleDetail = (a) => Boolean(String(a?.keyword ?? '').trim() || String(a?.title ?? '').trim())

    function StagePills({ progress, stages }) {
      if (!stages?.length) return null
      const idx = stageIndexOf(progress, stages)
      const pills = [{ key: 'ingested', short: '导入' }, ...stages]
      return h(
        'div',
        { className: 'sc-stage' },
        pills.map((s, i) =>
          h('span', { key: s.key, className: 'sc-pill', 'data-on': i <= idx }, s.short ?? s.name),
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

    /* ------------------------------------------------------------ 入口 */

    /**
     * 用一个框接收资料，三种投喂方式：
     *   拖进来 / 点选文件 / 粘路径
     *
     * 为什么是"一个框"而不是三个按钮：
     * 用户脑子里想的只是"我要读这个东西"，不该先判断自己属于哪一类用户。
     * 三种方式最后都收敛成同一个动作 —— 拿到文件内容，交给 /ingest-upload
     * 或 /ingest。界面不区分它们，失败时才分别说清是哪种问题。
     *
     * 为什么还要一条"我不知道读什么"的支线：
     * 「以终为始兴趣破序」讲的是用想解决的事反推该读什么。有人此刻手里
     * 没有文件，只有一个问题。把他赶回对话框等于说"这不归我管"。
     * 但这条支线只占一行，不抢主流程的位置 —— 有文件的人 99% 的情况
     * 只该看到那个框。
     */
    function Entry(props) {
      const { onImported, onAsk, busyHint } = props
      const [dragOver, setDragOver] = useState(false)
      const [pathInput, setPathInput] = useState('')
      // 只有一个布尔量。原来还多一个 stage='done'，但它从来没被读过 ——
      // 两个状态变量表达同一件事，迟早会有一个忘了改。
      const [busy, setBusy] = useState(false)
      const [err, setErr] = useState(null)
      // 点「说说你想解决什么」之后，光标到底有没有落到对话框上。
      // 落上了什么也不用说；没落上就明说一句该去哪儿，别让按钮看起来坏了。
      const [askTip, setAskTip] = useState(null)
      const fileRef = useRef(null)

      const send = useCallback(
        async (file) => {
          setErr(null)
          setBusy(true)
          try {
            // URL、工作区、错误文案都在 apiUpload 里，这里只关心结果
            onImported?.(await apiUpload(file))
          } catch (e) {
            setErr(e.message)
          } finally {
            setBusy(false)
          }
        },
        [onImported],
      )

      const sendPath = useCallback(async () => {
        const p = pathInput.trim()
        if (!p) return
        setErr(null)
        setBusy(true)
        try {
          const body = await api('/ingest', { method: 'POST', body: JSON.stringify({ path: p }) })
          setPathInput('')
          onImported?.(body)
        } catch (e) {
          setErr(e.message)
        } finally {
          setBusy(false)
        }
      }, [pathInput, onImported])

      const onDrop = useCallback(
        (ev) => {
          ev.preventDefault()
          setDragOver(false)
          const f = ev.dataTransfer?.files?.[0]
          if (f) send(f)
        },
        [send],
      )

      return h(
        'div',
        { className: 'sc-entry' },
        h(
          'div',
          {
            className: 'sc-entry-box' + (dragOver ? ' is-over' : ''),
            onDragOver: (ev) => {
              ev.preventDefault()
              setDragOver(true)
            },
            onDragLeave: () => setDragOver(false),
            onDrop,
            onClick: () => !busy && fileRef.current?.click(),
            role: 'button',
            tabIndex: 0,
            'aria-label': '导入资料：拖入文件或点击选择',
            onKeyDown: (ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                if (!busy) fileRef.current?.click()
              }
            },
          },
          h('input', {
            ref: fileRef,
            type: 'file',
            style: { display: 'none' },
            onChange: (ev) => {
              const f = ev.target.files?.[0]
              if (f) send(f)
              ev.target.value = ''
            },
          }),
          h('div', { className: 'sc-entry-title' }, busy ? busyHint || '正在读这份资料…' : '把资料拖到这里'),
          h(
            'div',
            { className: 'sc-entry-sub' },
            busy ? '文件大时会久一点，不要关这个页面' : '或点击选择文件 · pdf / docx / pptx / epub / md / txt',
          ),
        ),

        // 路径导入：拖拽之外必须留一条，因为从资源管理器复制路径比拖拽更常用
        h(
          'div',
          { className: 'sc-entry-path' },
          h('input', {
            className: 'sc-entry-input',
            placeholder: '…或者把文件路径粘在这里，回车导入',
            value: pathInput,
            disabled: busy,
            onChange: (ev) => setPathInput(ev.target.value),
            onKeyDown: (ev) => {
              if (ev.key === 'Enter') sendPath()
            },
          }),
        ),

        // 失败要说清是哪一种，不能只回「失败」
        err
          ? h(
              'div',
              { className: 'sc-entry-err', role: 'alert' },
              err,
              h(
                'div',
                { className: 'sc-entry-err-hint' },
                '常见原因：路径写成了文件夹、文件被别的程序占着、或是扫描件需要先 OCR。',
              ),
            )
          : null,

        // 支线：手里没有文件，只有想搞懂的事
        h(
          'div',
          { className: 'sc-entry-aside' },
          '手里还没有文件？',
          h(
            'button',
            {
              className: 'sc-linkbtn',
              onClick: () => {
                // onAsk 返回 true 表示光标真的落到对话框上了，什么都不用说；
                // 返回 false 就明说一句该去哪儿
                const ok = onAsk?.()
                setAskTip(
                  ok
                    ? null
                    : '在下面的对话输入框里说一句“我想搞懂 X”，我会先帮你定目标再找资料。',
                )
              },
            },
            '说说你想解决什么',
          ),
          '，先定目标再找资料。',
          // 聚焦失败时不能装作没事：告诉用户该去哪儿说
          askTip
            ? h('div', { className: 'sc-entry-asktip', role: 'status' }, askTip)
            : null,
        ),
      )
    }

    /* ------------------------------------------------------------ 预览 */

    /**
     * 30 秒预览：这份资料值不值得投入。
     *
     * 入口之后的第一个问题不是"该怎么读"，而是"要不要读"。
     * 原则里「反完成主义阅读」说得很清楚：不合胃口应当立即止损。
     * 但止损得有依据 —— 先让人读 14000 字的读前建构再决定，
     * 等于付完全款才知道要不要买。
     *
     * 所以这里只回答三个问题，加起来不到一屏：
     *   这是什么东西（结构）／ 我要付出多少（字数与时间）／ 里面有什么（三句原话）
     * 然后给两个出口：开始读、或换一份。
     */
    function Peek(props) {
      const { peek, onStart, onDismiss, onPlan } = props
      if (!peek) return null
      const { hooks } = peek
      // 只有一块的小资料，开头和结尾是同一句，重复显示只会让人觉得系统没想清楚
      const showEnd = hooks?.end && hooks.start && hooks.end.segId !== hooks.start.segId
      const outline = peek.outline ?? []

      const hookRow = (icon, label, item) =>
        item
          ? h(
              'div',
              { className: 'sc-peek-hook' },
              h('span', { className: 'sc-peek-hook-k' }, `${icon} ${label}`),
              h(
                'button',
                {
                  className: 'sc-peek-hook-t',
                  onClick: () => onStart?.(item.segId),
                  title: '跳到这段原文',
                },
                item.text,
              ),
            )
          : null

      return h(
        'div',
        { className: 'sc-peek' },
        h(
          'div',
          { className: 'sc-peek-head' },
          h('div', { className: 'sc-peek-title' }, peek.title),
          h(
            'div',
            { className: 'sc-peek-meta' },
            `${peek.chars.toLocaleString()} 字`,
            ' · ',
            `约 ${peek.minutes} 分钟`,
            peek.unitCount > 1 ? ` · ${peek.unitCount} 块` : '',
          ),
        ),

        // 目录：最多 8 条，再长就不是"预览"了
        outline.length > 1
          ? h(
              'div',
              { className: 'sc-peek-outline' },
              outline.map((o, i) =>
                h(
                  'button',
                  {
                    key: i,
                    className: 'sc-peek-item',
                    'data-lv': o.level,
                    onClick: () => onStart?.(o.segId),
                  },
                  o.title,
                ),
              ),
            )
          : null,

        // 三句原话：让人当场判断"这是我想看的东西吗"
        h(
          'div',
          { className: 'sc-peek-hooks' },
          hookRow('开', '开头', hooks?.start),
          showEnd ? hookRow('收', '结尾', hooks.end) : null,
          hooks?.biggest && hooks.biggest.segId !== hooks.start?.segId
            ? hookRow('重', `最长一块「${hooks.biggest.title}」`, hooks.biggest)
            : null,
        ),

        h(
          'div',
          { className: 'sc-peek-actions' },
          h(
            'button',
            { className: 'sc-peek-go', onClick: () => onStart?.() },
            peek.hasPreflight ? '继续读' : '开始读',
          ),
          // 想先看学习计划的走这里。它是次要动作 —— 主按钮永远是"开始读"，
          // 因为绝大多数时候人只想看内容，不想先读一份计划。
          onPlan
            ? h('button', { className: 'sc-linkbtn', onClick: () => onPlan() }, '先看学习计划')
            : null,
          h('button', { className: 'sc-linkbtn', onClick: () => onDismiss?.() }, '换一份'),
        ),
      )
    }

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
      { key: '⑤', label: '思考题与作业', hint: '读完挑一题，讲给 Agent 听' },
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

      // 知识点右侧的「看原文 ¶N」跳转由外层的 sc-pane 事件委托统一接管
      // （见 Workbench 的 onBodyClick），这里不再单独处理。

      if (!plan) {
        return h(
          Empty,
          null,
          h('div', null, '还没有读前建构。'),
          h('div', { className: 'sc-muted', style: { marginTop: 8 } }, '在对话里说「帮我做读前建构」，Agent 会加载 study-preflight 技能生成六段式。'),
        )
      }

      /**
       * 宿主没给 HTML 时的降级。
       *
       * 这里曾经有第二套六段渲染器，靠 audit-ui 比对两边标题层级来防漂移——
       * 两份实现守一个契约，改一边就不同步。现在只把原始数据摊开：
       * 丑，但不会说谎，也不会长成第二个真值。
       */
      if (!project.preflightHtml) {
        return h(
          'div',
          null,
          h(IssueList, { issues: plan.check?.issues }),
          h('div', { className: 'sc-muted', style: { marginTop: 8 } }, '宿主没有返回渲染结果，下面是原始数据：'),
          h('pre', { className: 'sc-pre' }, JSON.stringify(plan, null, 2)),
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
    function ReadingPane({ project, onAsk, onLocate, jumpTo, onJumped }) {
      const [sel, setSel] = useState(null)
      const [selText, setSelText] = useState('')
      const [onlyAnnotated, setOnlyAnnotated] = useState(false)
      const [asking, setAsking] = useState(false)
      const [answer, setAnswer] = useState(null)
      const [listening, setListening] = useState(false)
      // 语音识别失败的原因。语音依赖浏览器与厂商服务，失败是常态，
      // 必须说出来，否则用户只看到按钮亮了一下。
      const [voiceErr, setVoiceErr] = useState(null)
      const [unitList, setUnitList] = useState(null)
      const [activeUnit, setActiveUnit] = useState(null)

      // 暂停回顾：读到核心/攻坚段落时先盖住，强制回想一遍再翻看。
      // 依据 原则/C1.02.a_高效学习策略/暂停回顾策略.md：
      // "阅读时的核心动作不是读，而是停" —— 切断视觉提示做提取练习，
      // 才能把瞬时记忆固化。只划高亮而不停下回想，就是它说的"虚假勤奋"。
      const [paused, setPaused] = useState({}) // segId → true 表示当前盖着
      const [recalls, setRecalls] = useState({}) // segId → 用户回想时敲的字
      const [pauseOn, setPauseOn] = useState(true)

      const items = project.annotations?.items ?? []
      const stats = project.annotations?.stats
      const issues = project.annotations?.issues
      // 标注来源（宿主判定）：'judged' 才是逐段判读出来的
      const prov = project.provenance ?? null
      const byId = useMemo(() => new Map(items.map((it) => [it.segmentId, it])), [items])
      const segments = project.segments ?? []

      /*
       * 当前在看哪一块的"要求"。
       *
       * 原来读中页在读前建构面前是完全断开的：读前页写着这一部分要"掌握"、
       * 要求能复述五类工具、难点是别把它当成 2×N 矩阵，然后点进正文，
       * 这些字一个都不见了。用户只能靠记忆，或者切回读前页翻。
       *
       * 做法：preflight 的每个 part 都带 segmentIds，所以段落 → part 是精确映射，
       * 不用再猜。滚动时算出当前可见的最上那一段，反查它属于哪个 part。
       */
      const parts = project.preflight?.parts ?? []
      // part.segmentIds 只放了关键段落（chapter1 里只覆盖 16%），
      // 真正的完整范围要顺着 unitIds 展开成单元的段号。
      // 两路都收：segmentIds 精确，unitIds 补全，重合无害。
      const partBySeg = useMemo(() => {
        const m = new Map()
        const unitSegs = new Map(
          (unitList?.units ?? []).map((u) => [u.id, u.segmentIds ?? []]),
        )
        for (const p of parts) {
          for (const id of p.segmentIds ?? []) m.set(id, p)
          for (const uid of p.unitIds ?? []) {
            for (const sid of unitSegs.get(uid) ?? []) m.set(sid, p)
          }
        }
        return m
      }, [parts, unitList])

      const [currentSeg, setCurrentSeg] = useState(null)
      useEffect(() => {
        if (!partBySeg.size) return undefined
        // 用一个"哪一段离视口中心最近"的观察者，而不是 IntersectionObserver 队列：
        // 后者在快速滚动时给出一堆交叉记录，还要自己维护集合，容易选错。
        let raf = 0
        const onScroll = () => {
          if (raf) return
          raf = window.requestAnimationFrame(() => {
            raf = 0
            const nodes = document.querySelectorAll('[data-id]')
            const mid = window.innerHeight / 2
            let best = null
            let bestD = Infinity
            for (const el of nodes) {
              const r = el.getBoundingClientRect()
              if (r.bottom < 0 || r.top > window.innerHeight) continue
              const d = Math.abs((r.top + r.bottom) / 2 - mid)
              if (d < bestD) {
                bestD = d
                best = el.getAttribute('data-id')
              }
            }
            if (best) setCurrentSeg(best)
          })
        }
        // 面板是内部滚动容器，绑在 window 上要加捕获
        window.addEventListener('scroll', onScroll, true)
        onScroll()
        return () => {
          window.removeEventListener('scroll', onScroll, true)
          if (raf) window.cancelAnimationFrame(raf)
        }
      }, [partBySeg])

      // 跳转过来时也要立刻切换（滚动事件可能还没触发）
      const currentPart = partBySeg.get(jumpTo ?? currentSeg ?? '') ?? null

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

      // 单元清单：这份资料分几块。
      // 之前 182 段是平铺的，用户不知道自己在哪、还有多少块没看。
      useEffect(() => {
        let alive = true
        api(`/units/${encodeURIComponent(project.id)}`)
          .then((d) => alive && setUnitList(d?.units ?? null))
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [project.id])

      /**
       * 从读前页点知识点的「看原文 ¶N」跳过来。
       *
       * 要做的三件事：
       *   1. 等这一帧渲染完再滚，否则元素还没挂上
       *   2. 滚到那一段并给个短暂高亮，否则用户滚到了也不知道看哪
       *   3. 把这一段所在单元标为 active，让目录里也能对上
       */
      useEffect(() => {
        if (!jumpTo) return
        const id = jumpTo
        const t = setTimeout(() => {
          // 宿主渲染段落时用的是 data-id（见 rules.js renderAnnotatedHtml），
          // 这里顺手兼容 data-seg-id，免得两边对不上就跳不过去
          const el =
            document.querySelector(`[data-id="${id}"]`) ??
            document.querySelector(`[data-seg-id="${id}"]`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.classList.add('sc-seg-flash')
            setTimeout(() => el.classList.remove('sc-seg-flash'), 1600)
          }
          if (unitList) {
            const hit = unitList.units.find((u) => u.sourceRange?.from === id) ??
              unitList.units.find((u) => {
                const a = parseInt(String(u.sourceRange?.from ?? '').replace(/\D/g, ''), 10)
                const b = parseInt(String(u.sourceRange?.to ?? '').replace(/\D/g, ''), 10)
                const n = parseInt(String(id).replace(/\D/g, ''), 10)
                return Number.isFinite(a) && Number.isFinite(b) && n >= a && n <= b
              })
            if (hit) setActiveUnit(hit.id)
          }
          onJumped?.()
        }, 60)
        return () => clearTimeout(t)
      }, [jumpTo]) // eslint-disable-line react-hooks/exhaustive-deps

      // 进面板时，把核心档（必须能复述的骨架）先盖上。
      // 只盖 core 不盖 hard：攻坚档多是提问句，盖住反而看不出在问什么；
      // 参考档全是例子和出处，盖住纯属打扰。
      useEffect(() => {
        if (!pauseOn) return
        const next = {}
        for (const s of segments) {
          const a = byId.get(s.id)
          if (a?.tier === 'core') next[s.id] = true
        }
        setPaused((prev) => {
          // 已经展开过的别再盖回去，否则用户每切一次页签都要重写一遍
          const merged = { ...next }
          for (const [id, v] of Object.entries(prev)) if (v === false) delete merged[id]
          return merged
        })
      }, [segments.length, pauseOn]) // eslint-disable-line react-hooks/exhaustive-deps

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
              docId: project.id,
              term: word,
              segmentId,
              question: `「${word}」在这里是什么意思？`,
              source: 'ui',
            }),
          })
          const prompt = `在《${project.title ?? project.id}》${segmentId ?? ''} 这段里，「${word}」是什么意思？请结合上下文解释，不要只给字典释义。`
          setAnswer({ word, segmentId, prompt, pending: true, context: r?.context ?? '' })
          // 只通知父级同步列表；写入已经在上面完成，父级不再重复 POST
          onAsk?.()
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
            const r = await api(`/terms-pending/${encodeURIComponent(project.id)}`)
            const items = r?.items ?? []
            if (!alive) return
            // 这条已经不在待答列表里了 → 说明被答过，去拿全量找到它
            if (!items.some((it) => it.term === answer.word)) {
              const p = await api(`/project/${encodeURIComponent(project.id)}`)
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
      }, [answer?.pending, answer?.word, project.id])

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
        if (!Ctor) {
          setVoiceErr('这个浏览器没有语音识别能力（只有 Chrome / Edge 提供）。手打一个词也一样能问。')
          return
        }
        const rec = new Ctor()
        recRef.current = rec
        rec.lang = 'zh-CN'
        rec.interimResults = false
        rec.maxAlternatives = 1
        rec.onresult = (e) => {
          const said = String(e.results?.[0]?.[0]?.transcript ?? '').trim()
          setListening(false)
          recRef.current = null
          setVoiceErr(null)
          if (said) {
            setSelText(said)
            if (sel) doAsk(said, sel.seg.id)
          }
        }
        /**
         * 失败必须说出来。
         *
         * 原来这里是个空函数：麦克风按钮点下去亮一下、又灭了，
         * 用户完全不知道是自己没说话、没给权限，还是浏览器不支持。
         * 语音识别依赖厂商云服务，失败是常态而不是异常，
         * 所以每一种失败都要给出对应的下一步动作，而不是统一沉默。
         */
        rec.onerror = (ev) => {
          recRef.current = null
          setListening(false)
          const code = ev?.error ?? ''
          const why =
            code === 'not-allowed' || code === 'service-not-allowed'
              ? '麦克风权限被拒绝了。请在地址栏左侧的站点设置里允许麦克风，然后重试。'
              : code === 'no-speech'
                ? '没有听到声音。再点一次麦克风，说完稍等一下。'
                : code === 'audio-capture'
                  ? '找不到可用的麦克风。检查一下设备是否插好、是否被别的程序占用。'
                  : code === 'network'
                    ? '语音识别要连厂商的服务器，这次没连上。手打一个词照样能问。'
                    : code === 'aborted'
                      ? null // 用户自己按停的，不用报错
                      : `语音识别失败${code ? `（${code}）` : ''}。手打一个词也一样能问。`
          setVoiceErr(why)
        }
        rec.onend = () => {
          recRef.current = null
          setListening(false)
        }
        setVoiceErr(null)
        setListening(true)
        try {
          rec.start()
        } catch (e) {
          recRef.current = null
          setListening(false)
          // start() 抛错通常是上一次还没结束就再点了，或权限被策略拦住
          setVoiceErr(`没能启动录音：${String(e?.message ?? e)}。手打一个词也一样能问。`)
        }
      }

      return h(
        'div',
        { style: { position: 'relative' } },

        // ---- 单元目录：这份资料分几块 ----
        // 放在正文之前，因为用户最先要回答的问题是"这章讲几件事"。
        // 默认收起：不想看结构的人直接读正文，想看的人一次展开 25 行。
        unitList
          ? h(
              'details',
              { className: 'sc-units' },
              h(
                'summary',
                null,
                `这份资料分 ${unitList.totalUnits} 块 · ${unitList.totalSegments} 段`,
              ),
              h(
                'ol',
                { className: 'sc-units-list' },
                unitList.units.map((u) =>
                  h(
                    'li',
                    {
                      key: u.id,
                      className: 'sc-unit' + (activeUnit === u.id ? ' is-active' : ''),
                      onClick: () => {
                        setActiveUnit(u.id)
                        onLocate?.(u.id)
                      },
                    },
                    h('span', { className: 'sc-unit-title' }, u.title),
                    h(
                      'span',
                      { className: 'sc-unit-meta' },
                      `${u.segmentCount} 段`,
                      u.keyPointCount ? ` · ${u.keyPointCount} 个要点` : '',
                      u.done ? ' ✓' : '',
                    ),
                  ),
                ),
              ),
            )
          : null,
        // ---- 当前这一块的要求：读的时候就看得到 ----
        // 收起时不占地方，只露一行「这一块要掌握什么」；展开给出要求、难点、重点。
        currentPart
          ? h(
              'details',
              { className: 'sc-askbar', open: false },
              h(
                'summary',
                null,
                h('span', { className: 'sc-askbar-lv', 'data-lv': currentPart.assessment?.level ?? '' },
                  currentPart.assessment?.level ?? '未定'),
                h('span', { className: 'sc-askbar-title' }, currentPart.title),
                h('span', { className: 'sc-muted' }, '这一块要达到什么'),
              ),
              h(
                'div',
                { className: 'sc-askbar-body' },
                currentPart.assessment?.requirement
                  ? h(
                      'div',
                      { className: 'sc-askbar-row' },
                      h('b', null, '读完要能做到'),
                      h('span', null, currentPart.assessment.requirement),
                    )
                  : null,
                currentPart.assessment?.purpose
                  ? h(
                      'div',
                      { className: 'sc-askbar-row' },
                      h('b', null, '为什么重要'),
                      h('span', null, currentPart.assessment.purpose),
                    )
                  : null,
                (currentPart.difficulties ?? []).length
                  ? h(
                      'div',
                      { className: 'sc-askbar-row' },
                      h('b', null, '难点'),
                      h(
                        'ul',
                        { className: 'sc-askbar-ul' },
                        currentPart.difficulties.map((d, i) => h('li', { key: i }, d)),
                      ),
                    )
                  : null,
                (currentPart.keyPoints ?? []).length
                  ? h(
                      'div',
                      { className: 'sc-askbar-row' },
                      h('b', null, '重点'),
                      h(
                        'ul',
                        { className: 'sc-askbar-ul' },
                        currentPart.keyPoints.map((k, i) => h('li', { key: i }, k)),
                      ),
                    )
                  : null,
              ),
            )
          : null,
        // ---- 顶部图例：三色语义 + 预算进度 ----
        // 颜色必须跟 CSS 里的 --sc-*-line 一致，否则用户看到的图例和正文对不上
        h(
          'div',
          { className: 'sc-legend' },
          // 图例先说"实际占了多少"，再说"上限是多少"。
          // 只写 ≤10% 会被读成"现在是 10%"，用户没法判断三色用得对不对。
          h(
            'span',
            { title: '左边是实际高亮占比，右边是上限（按正文字数算）' },
            h('i', { style: { background: 'var(--sc-core-line)' } }),
            `核心 ${fmtPct(stats?.tierRatio?.core)} ≤10%`,
          ),
          h(
            'span',
            { title: '左边是实际高亮占比，右边是上限（按正文字数算）' },
            h('i', { style: { background: 'var(--sc-hard-line)' } }),
            `攻坚 ${fmtPct(stats?.tierRatio?.hard)} ≤8%`,
          ),
          h(
            'span',
            { title: '参考档不计入注意力预算' },
            h('i', { style: { background: 'var(--sc-ref-line)' } }),
            `参考 ${fmtPct(stats?.tierRatio?.ref)} 不限`,
          ),
          stats
            ? h(
                'span',
                { title: stats && `${stats.highlightedChars}/${stats.totalChars} 字被高亮` },
                unitList
                  ? `这份资料分 ${unitList.totalUnits} 块，${unitList.units.filter((u) => u.done).length} 块已看过`
                  : `已标 ${stats.total}/${segments.length} 段`,
              )
            : h('span', { className: 'sc-muted' }, '还没有标注'),
          // 标注是脚本回填的就说出来。不说的话，用户会以为这些标签是读过之后判的，
          // 而实际上它们可能连角色都标错了。
          prov && !prov.reliable
            ? h(
                'span',
                { className: 'sc-prov', title: prov.note || prov.advice || prov.label },
                prov.label,
              )
            : null,
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
          h(
            'label',
            {
              style: { marginLeft: 12, cursor: 'pointer', userSelect: 'none' },
              title: '核心段落先盖住，逼自己回想一遍再对照原文',
            },
            h('input', {
              type: 'checkbox',
              checked: pauseOn,
              onChange: (e) => {
                setPauseOn(e.target.checked)
                if (!e.target.checked) setPaused({})
              },
              style: { verticalAlign: '-2px', marginRight: 4 },
            }),
            '暂停回顾',
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
          shown.map((seg, i) => {
            const a = byId.get(seg.id)
            const inner = htmlBySeg.get(seg.id)
            // 章节标题只在换节时出现一次：原来每段都带一行"章节名"，等于把目录
            // 抄进了正文，读起来一直被打断。
            const showChapter = Boolean(seg.chapter) && seg.chapter !== shown[i - 1]?.chapter
            return h(
              React.Fragment,
              { key: seg.id },
              showChapter ? h('h4', { className: 'sc-chapter' }, seg.chapter) : null,
              h(
                'section',
                {
                  className: 'sc-seg',
                  title: a ? roleText(a) : undefined,
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
              // 段号与角色都退到左侧留白：定位与分类要用，但不是正文
              h('span', { className: 'sc-seg-mark', 'aria-hidden': 'true' }, seg.id),
              a
                ? h(
                    'span',
                    {
                      className: 'sc-seg-role',
                      title: roleText(a),
                    },
                    `#${a.label}`,
                  )
                : null,
              // 面板相对整段定位：挂在 36px 宽的标记里会被压成一列竖排文字
              a && hasRoleDetail(a) ? h('span', { className: 'sc-seg-role-full' }, roleText(a)) : null,
              // 有宿主渲染的高亮版就用它；否则退回纯文本 Markdown
              //
              // 暂停回顾：核心/攻坚档的段落在"看过的第一眼"之后会被盖上，
              // 要用户先打一句自己的理解才允许翻看原文。这样高亮不会变成
              // 一眼扫过的装饰，而是真的触发一次提取。
              paused[seg.id] && pauseOn
                ? h(
                    'div',
                    { className: 'sc-pause' },
                    h('div', { className: 'sc-pause-q' }, '这段在说什么？先不看书，用一句话写下来。'),
                    h('textarea', {
                      className: 'sc-pause-in',
                      rows: 2,
                      value: recalls[seg.id] ?? '',
                      placeholder: '想不起来就写"想不起来"，也算一次诚实的提取',
                      onChange: (e) => setRecalls((v) => ({ ...v, [seg.id]: e.target.value })),
                    }),
                    h(
                      'div',
                      { style: { display: 'flex', gap: 8, marginTop: 6 } },
                      h(
                        'button',
                        {
                          className: 'sc-btn sc-btn-primary',
                          onClick: () => setPaused((v) => ({ ...v, [seg.id]: false })),
                        },
                        '写完了，对照原文',
                      ),
                      h(
                        'button',
                        {
                          className: 'sc-btn',
                          title: '如果这段你已经很熟，可以直接展开',
                          onClick: () => setPaused((v) => ({ ...v, [seg.id]: false })),
                        },
                        '跳过',
                      ),
                    ),
                  )
                : inner !== undefined
                  ? h('div', { dangerouslySetInnerHTML: { __html: inner } })
                  : h('div', { dangerouslySetInnerHTML: { __html: seg.html || '' } }),
              ),
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
              // 语音失败的原因：说清是权限、没听到，还是浏览器不行
              voiceErr
                ? h(
                    'div',
                    { className: 'sc-voice-err', role: 'alert' },
                    voiceErr,
                    h(
                      'button',
                      { className: 'sc-linkbtn', style: { marginLeft: 6 }, onClick: () => setVoiceErr(null) },
                      '知道了',
                    ),
                  )
                : null,
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
     * 知识点 → 原文。图里的方块由 archify 自己渲染，界面插不进手，
     * 所以"回到原文"这件事改在这里做：一个可折叠的清单，
     * 每个知识点后面跟着它的出处，点一下就跳到读中页的那一段。
     *
     * 只列挂上了 segmentId 的：点错段比没有链接更糟。
     * 没挂上的数量如实说出来，不做"全部可点"的假象。
     */
    function NodeCitePane({ project, onGoto }) {
      const nodes = project.relations?.nodes ?? []
      if (!nodes.length) return null
      const linked = nodes.filter((n) => n.segmentId)
      const missing = nodes.length - linked.length
      return h(
        'details',
        { className: 'sc-details' },
        h(
          'summary',
          null,
          `知识点出处（${linked.length}/${nodes.length} 个能回到原文）`,
        ),
        missing
          ? h(
              'div',
              { className: 'sc-muted', style: { fontSize: 12, margin: '4px 0 8px' } },
              `另有 ${missing} 个知识点没有确切的原文落点（标签是改写过的说法，原文里找不到对应那一段）。` +
                `不硬指一段，免得点过去看到的是别的内容。`,
            )
          : null,
        h(
          'div',
          { className: 'sc-cite-list' },
          linked.map((n) =>
            h(
              'button',
              {
                key: n.id,
                className: 'sc-cite-row',
                onClick: () => onGoto?.(n.segmentId),
                title: `跳到 ${n.segmentId}`,
              },
              h('span', { className: 'sc-cite-label' }, n.label),
              h('span', { className: 'sc-cite-seg' }, n.segmentId),
            ),
          ),
        ),
      )
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
    function GraphPane({ project, onGoto }) {
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

        // ---- 每个知识点回到原文 ----
        h(NodeCitePane, { project, onGoto }),
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
          h('h4', null, '读后巩固（QA）'),
          h('div', { className: 'sc-muted' }, '还没有 QA。读完全文后让 Agent 生成一份速查问答，每条不超过 100 字。'),
        )
      }
      return h(
        'div',
        { className: 'sc-card' },
        h('h4', null, `读后巩固（QA，${pairs.length} 条）`),
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
     * 读后巩固面板。
     *
     * 为什么要单独一个页签：QA 原来是塞在"费曼考核"页底部的，
     * 而它其实是考核**之前**的那一步（先能回忆细节，再能完整复述）。
     * 混在一起用户根本不知道有这一步，进度也一直推不动。
     */
    function RecallPane({ project }) {
      const pairs = project.qa ?? []
      const [cov, setCov] = useState(null)
      const [harvest, setHarvest] = useState(null)
      useEffect(() => {
        let alive = true
        api(`/coverage/${encodeURIComponent(project.id)}`)
          .then((d) => alive && setCov(d))
          .catch(() => {})
        api(`/harvested/${encodeURIComponent(project.id)}`)
          .then((d) => alive && setHarvest(d))
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
            // 两个页签的边界必须写出来，否则用户不知道"自测"和"考核"差在哪
            h('div', { style: { marginTop: 6 } }, '这里只判"记没记住"（快问快答、对错分明）；要把整章讲给人听、被追问、拿评分，去「读后考核」。'),
          ),
          // 主指标是"拿到了什么"，不是"完成了多少"。
          // 依据：原则/反完成主义阅读 —— 一本书有一句话改变认知就回本，
          // 高 ROI 来自击中点而非覆盖面。百分比只在次要位置提一句。
          h(
            'div',
            { className: 'sc-harvest' },
            // 三种情况必须分清：
            //   harvest === null → 请求还没回来/失败，不能说"你还没读"
            //   summary 有内容   → 照实说拿到了什么
            //   summary 为空     → 确实还没标，这时才提示先去读
            // 原来把 null 和"空"混成一个兜底句，接口一挂就谎称用户没读。
            harvest === null
              ? '正在清点你已经拿到的东西…'
              : harvest.summary || '还没拿到东西。先读一段，标一句你觉得重要的。',
          ),
          harvest?.highlights?.length
            ? h(
                'ul',
                { className: 'sc-harvest-list' },
                harvest.highlights.slice(0, 5).map((x, i) =>
                  h(
                    'li',
                    { key: i },
                    h('span', { className: 'sc-harvest-where' }, x.where),
                    x.label,
                  ),
                ),
              )
            : null,
          h(
            'div',
            { className: 'sc-muted', style: { marginTop: 8 } },
            `想核对的话：${doneCount}/${total} 段有标注（${pct}%）` +
              (left > 0 ? `，还有 ${left} 段没标。` : '。') +
              ' 不标也没关系——标的是一句话，不是任务清单。',
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

    /**
     * 术语追问记录：追问发生在读中，所以挂在精读页下面。
     * 之前放在考核页——那里既不是它发生的地方，也让考核页变成了杂物抽屉。
     */
    function TermsCard({ project }) {
      const terms = project.terms ?? []
      if (!terms.length) return null
      return h(
        'div',
        { className: 'sc-card', style: { marginTop: 'var(--sc-sp-4)' } },
        h('h4', null, `术语追问记录（${terms.length}）`),
        terms.map((t, i) =>
          h(
            'div',
            { key: i, style: { marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
            h('div', null, h('b', null, t.term), t.segmentId ? h('span', { className: 'sc-muted' }, `　${t.segmentId}`) : null),
            h('div', { className: 'sc-muted' }, t.question),
            t.answer ? h('div', { style: { marginTop: 4, lineHeight: 1.7 } }, t.answer) : null,
          ),
        ),
      )
    }

    /**
     * 读后考核：只回答一件事——你真的用自己的话讲过了吗。
     *
     * 题目不复制到这一页。思考题只有一份，在「读前建构 ⑤」：那里是计划，
     * 这里是执行。同一份内容在两处渲染，改一处就会漂，用户也分不清该信哪个。
     */
    function QuizPane({ project, onOpenPlan }) {
      const drills = project.drills ?? []
      const counted = drills.filter((d) => d.valid).length
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
            '合上书，挑一道思考题，用自己的话讲一遍。Agent 会追问、按要点判卷；只有有效复述才推进进度。',
            '题目只在「读前建构 ⑤」有一份，这里不重复。',
          ),
          onOpenPlan
            ? h('button', { className: 'sc-btn', style: { marginTop: 8 }, onClick: onOpenPlan }, '去读前建构挑一道题')
            : null,
          h(
            'div',
            { className: 'sc-muted', style: { marginTop: 8 } },
            drills.length ? `有效复述 ${counted} / ${drills.length} 次` : '还没有复述记录。',
          ),
        ),
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, `我的复述记录（${drills.length}）`),
          drills.length === 0
            ? h(
                'div',
                { className: 'sc-muted' },
                '还没有复述记录。点上方「开始费曼考核」，或在对话里说「考考我」，用自己的话讲一遍。',
              )
            : drills.map((d, i) =>
                h(
                  'div',
                  { key: i, className: 'sc-drill' + (d.valid ? '' : ' is-invalid') },
                  // 计入与否必须明说。之前只看得到"判卷：…"，
                  // 用户不知道这次算不算数，闸门就成了黑箱。
                  h(
                    'div',
                    { className: 'sc-drill-head' },
                    h(
                      'span',
                      { className: 'sc-drill-badge', 'data-valid': String(Boolean(d.valid)) },
                      d.valid ? '已计入' : '未计入',
                    ),
                    d.prompt ? h('span', { className: 'sc-drill-prompt' }, `题：${d.prompt}`) : h('span', { className: 'sc-drill-prompt' }, '（自由复述）'),
                    d.durationSec != null
                      ? h('span', { className: 'sc-drill-meta' }, d.minutes ? `${d.minutes} 分钟` : `${d.durationSec} 秒`)
                      : null,
                  ),
                  h('div', { className: 'sc-drill-answer' }, d.answer),
                  d.verdict ? h('div', { className: 'sc-drill-row' }, h('b', null, '判卷：'), d.verdict) : null,
                  (d.rubricHit ?? []).length
                    ? h('div', { className: 'sc-muted' }, `达标要点：${d.rubricHit.join('、')}`)
                    : null,
                  d.minimalAction ? h('div', { className: 'sc-muted' }, `下一步最小行动：${d.minimalAction}`) : null,
                  // 为什么没计入 —— 这句话是用户唯一能改进的依据
                  (d.warnings ?? []).length
                    ? h(
                        'ul',
                        { className: 'sc-drill-warn' },
                        d.warnings.map((w, j) => h('li', { key: j }, w.message)),
                      )
                    : null,
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

    /* -------------------------------------------------- 阶段按钮：发消息 */

    /**
     * 让宿主替我们发起一个阶段：把「继续/开始 某阶段」投进用户正在用的会话，
     * 并立刻起一轮 turn。用宿主自己的接口而不是客户端 RPC ——
     * 客户端取 remote.session 需要注入嵌套服务，实测取不到；
     * 宿主侧 agent.followup() 才是给插件用的正规入口。
     */
    /**
     * 等某个阶段的产物出现。返回最新的 project，等不到返回 null。
     *
     * 这段循环原来内联在点击回调里：超时、间隔、判据、异常处理全挤在按钮后面，
     * 想改"等多久"得先读完整段 UI 代码。抽出来之后，按钮只管文案与状态。
     */
    async function waitForStage(docId, stage, { timeoutMs = 240000, intervalMs = 2000 } = {}) {
      const startedAt = Date.now()
      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((r) => setTimeout(r, intervalMs))
        try {
          const next = await api(`/project/${encodeURIComponent(docId)}`)
          if (next?.progress?.[stage.progressKey]) return next
        } catch {
          /* 单次查询失败不该终止等待 */
        }
      }
      return null
    }

    /** 阶段操作条：五个页签同一位置。重做用就地二次确认，不弹窗。 */
    function StageBar({ name, action, redo, done, busy, onRun }) {
      const [confirming, setConfirming] = useState(false)
      useEffect(() => {
        if (!confirming) return undefined
        const timer = setTimeout(() => setConfirming(false), 3000)
        return () => clearTimeout(timer)
      }, [confirming])
      // 文案来自宿主 /stages：改词只改 rules.js 一处
      const label = busy ? '执行中…' : confirming ? '确认重做？' : done ? (redo ?? `重做${name}`) : (action ?? `生成${name}`)
      return h(
        'div',
        { className: 'sc-stage-bar' },
        h(
          'span',
          { className: 'sc-stage-txt', title: done ? `${name}已有产物，点右侧可重做` : `${name}还没有产物` },
          done ? `${name}：已有产物，可重做` : `${name}：还没有产物`,
        ),
        h(
          'button',
          {
            className: 'sc-btn sc-btn-sm',
            'data-warn': confirming ? 'true' : 'false',
            disabled: busy,
            onClick: () => {
              if (done && !confirming) {
                setConfirming(true)
                return
              }
              setConfirming(false)
              onRun()
            },
          },
          label,
        ),
      )
    }

    /**
     * 资料库的右键菜单。
     *
     * 自绘而不是调宿主原生菜单：内置插件都是自绘，样式与暗色主题天然一致，
     * 也不依赖没有公开承诺的接口。既然自绘，键盘就必须补齐 ——
     * 只能鼠标点的菜单，等于把功能藏起来。
     */
    function SideMenu({ x, y, items, note, onClose }) {
      const ref = useRef(null)
      const [pos, setPos] = useState({ left: x, top: y })

      // 贴着鼠标点打开；靠近右/下边缘时翻转，别跑到屏幕外
      useEffect(() => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))
        const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))
        setPos({ left, top })
        const first = el.querySelector('.sc-menu-item')
        if (first && typeof first.focus === 'function') first.focus()
      }, [x, y])

      useEffect(() => {
        const onDown = (e) => {
          if (!ref.current?.contains(e.target)) onClose()
        }
        const onKey = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }
        }
        // 滚动、失焦、改窗口大小都会让菜单和它的锚点错位，直接关掉比飘着强
        const onScroll = () => onClose()
        document.addEventListener('mousedown', onDown, true)
        document.addEventListener('keydown', onKey, true)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('blur', onScroll)
        window.addEventListener('resize', onScroll)
        return () => {
          document.removeEventListener('mousedown', onDown, true)
          document.removeEventListener('keydown', onKey, true)
          window.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('blur', onScroll)
          window.removeEventListener('resize', onScroll)
        }
      }, [onClose])

      const onKeyDown = (e) => {
        const nodes = [...(ref.current?.querySelectorAll('.sc-menu-item') ?? [])]
        const at = nodes.indexOf(document.activeElement)
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          nodes[(at + 1) % nodes.length]?.focus()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          nodes[(at - 1 + nodes.length) % nodes.length]?.focus()
        } else if (e.key === 'Home') {
          e.preventDefault()
          nodes[0]?.focus()
        } else if (e.key === 'End') {
          e.preventDefault()
          nodes[nodes.length - 1]?.focus()
        } else if (e.key === 'Tab') {
          // 菜单是临时层，Tab 不该把它留在屏幕上
          onClose()
        }
      }

      return h(
        'div',
        {
          ref,
          className: 'sc-menu',
          role: 'menu',
          'aria-label': '资料库操作',
          style: { left: pos.left, top: pos.top },
          onKeyDown,
          onContextMenu: (e) => e.preventDefault(),
        },
        items.map((it) =>
          h(
            'button',
            {
              key: it.key,
              className: 'sc-menu-item',
              role: 'menuitem',
              onClick: () => {
                onClose()
                it.onSelect?.()
              },
            },
            it.label,
          ),
        ),
        note
          ? [h('div', { key: 'sep', className: 'sc-menu-sep' }), h('div', { key: 'note', className: 'sc-menu-note', title: note }, note)]
          : null,
      )
    }

    function Workbench(props) {
      const { useWorkspaces } = props
      const snapshot = useWorkspaces ? useWorkspaces((s) => s) : null
      const scale = useScale()
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
      // 点了知识点的「看原文」后要跳到读中页的那一段。
      // 用状态传递而不是 window 事件：读中页可能还没挂载，需要一个能落地的值。
      const [jumpTo, setJumpTo] = useState(null)
      const gotoSegment = useCallback((segId) => {
        setJumpTo(segId)
        setTab('read')
      }, [])

      /**
       * 知识点右侧的「看原文 ¶N」是宿主渲染的 <a class="sc-kp-jump" data-seg>。
       * 用事件委托挂在整个内容区上，不必为每个知识点写一个 React 组件。
       *
       * 注意：这个处理必须定义在 Workbench 里 —— sc-pane 的 onClick 在这一层，
       * 定义在子组件 PreflightPane 里够不着（曾经因此让面板整块空白）。
       */
      const onBodyClick = useCallback(
        (e) => {
          const a = e.target?.closest?.('a.sc-kp-jump')
          if (!a) return
          e.preventDefault()
          const seg = a.getAttribute('data-seg')
          if (seg) gotoSegment(seg)
        },
        [gotoSegment],
      )
      const [error, setError] = useState(null)
      const [busy, setBusy] = useState(false)
      // 30 秒预览：导入完成后先给这个，而不是直接把人扔进读前建构。
      // 存成一个 {docId, peek} 而不是只存 peek —— 否则刷新或切换资料后
      // 分不清这份预览属于哪一份资料。
      const [preview, setPreview] = useState(null)
      const [showDiag, setShowDiag] = useState(false)
      const [diag, setDiag] = useState(null)
      const [candidates, setCandidates] = useState([])

      // 诊断：先分辨"面板没挂起来"和"挂起来后渲染崩了"——两者都是一片空白，
      // 但一个要查 slots 注册，一个要查组件。只报一次，不刷日志。
      useEffect(() => {
        if (mountReported) return
        mountReported = true
        // 顺带探一次：面板到底能不能拿到会话 id。只报键名与布尔，不报 URL、不报值。
        reportError({
          kind: 'props',
          keys: Object.keys(props ?? {}).join(','),
        })
        reportError({ kind: 'mount', message: 'Workbench mounted' })
      }, [])

      // 先把这个工作区告诉 api 层：后面的请求（含 DockBar / ReadingPane）都读它。
      // 放在 refresh 之前，保证首次拉列表时已经生效。
      useEffect(() => setCurrentWorkspace(wsPath), [wsPath])

      // 第一次列目录时自动选中第一份，省得用户面对空白。
      // 但"刚导入了一份"这种情况不能这么办：refresh 时 docId 还是 null，
      // 自动选中会挑到列表第一项（很可能是另一份旧资料），
      // 于是预览显示的是新文件、右侧选中的却是旧文件。
      // 所以给它一个可选的 preferId，明确指定要选哪一份。
      const refresh = useCallback(
        async (preferId) => {
          try {
            const data = await api('/projects')
            // 后端在发现“别的目录里有项目”时会给出 suggested，直接采用并记住
            if (!manualWs && data.suggested && data.suggested !== wsPath) {
              setManualWs(data.suggested)
              return
            }
            setProjects(data.items ?? [])
            bumpProjects()
            setDiag({
              workspace: data.workspace,
              requested: data.requested,
              resolvedTo: data.resolvedTo,
              hint: data.hint,
              candidates: data.candidates,
            })
            if (data.candidates) setCandidates(data.candidates.filter((c) => c.count > 0))
            setError(null)
            if (preferId) setDocId(preferId)
            else if (!docIdRef.current && data.items?.length) setDocId(data.items[0].id)
          } catch (e) {
            setError(e.message)
          }
        },
        // 不依赖 docId：否则每选一份资料都会把整个列表再拉一遍
        [wsPath, manualWs, setManualWs],
      )

      /**
       * 导入成功后的统一收尾：刷新列表 → 选中新项目 → 取 30 秒预览。
       * 空态 Entry 与资料库菜单共用这一段，避免两处行为分叉。
       */
      const handleImported = useCallback(
        async (out) => {
          // 明确指定选中新导入的这份：不传的话 refresh 会去选列表第一项，
          // 那份很可能是旧的另一份资料，于是预览和右侧选中的对不上
          if (!out?.docId) return refresh()
          refresh(out.docId)
          try {
            const p = await api(`/peek/${encodeURIComponent(out.docId)}`)
            setPreview({ docId: out.docId, peek: p.peek })
          } catch {
            // 预览拿不到不该拦住用户：正文已经能看了
            setPreview(null)
          }
        },
        [refresh, wsPath],
      )

      /* ---- 资料库右键菜单 ---- */
      const [menu, setMenu] = useState(null)
      const [pathOpen, setPathOpen] = useState(false)
      const [pathText, setPathText] = useState('')
      const [pathError, setPathError] = useState(null)
      const menuFileRef = useRef(null)
      const [stageBusy, setStageBusy] = useState(null)
      // 阶段跑完后要把详情重新拉一次；docId 没变，靠这个记号触发 effect
      // refresh 需要读最新的 docId，但不该把它写进依赖（写进去就会每选一份资料重拉全表）
      const docIdRef = useRef(null)
      useEffect(() => {
        docIdRef.current = docId
      }, [docId])

      const closeMenu = useCallback(() => setMenu(null), [])

      const importFile = useCallback(
        async (file) => {
          if (!file) return
          setBusy(true)
          setError(null)
          try {
            await handleImported(await apiUpload(file))
          } catch (e) {
            setError(e.message)
          } finally {
            setBusy(false)
          }
        },
        [wsPath, handleImported],
      )

      // 只认绝对路径：后端的 resolve() 是相对**进程工作目录**的，而那是 DSH 的
      // profile 目录，不是用户的工作区。放行相对路径等于把资料导到看不见的地方。
      const isAbsolutePath = (p) => /^(?:[a-zA-Z]:[\\/]|\\\\)/.test(p)

      const submitPath = useCallback(async () => {
        const p = pathText.trim()
        if (!p) return
        if (!isAbsolutePath(p)) {
          setPathError('请填绝对路径，例如 D:\\资料\\chapter1.md')
          return
        }
        setBusy(true)
        setError(null)
        setPathError(null)
        try {
          const out = await api('/ingest', {
            method: 'POST',
            body: JSON.stringify({ path: p }),
          })
          setPathOpen(false)
          setPathText('')
          await handleImported(out)
        } catch (e) {
          setError(e.message)
        } finally {
          setBusy(false)
        }
      }, [pathText, wsPath, handleImported])

      /**
       * 一键让 Agent 跑某个阶段。
       *
       * 发出去之后轮询 /project：产物出现即算完成；等不到就明说"没等到"，
       * 而不是假装成功、也不是假装失败。归档会话会把消息静默吞掉，
       * 这条超时提示就是为它准备的。
       */
      const runStage = useCallback(
        async (stage) => {
          if (!docId || !stage) return
          setStageBusy(stage.key)
          setError(null)
          try {
            await apiRunStage(docId, stage.key)
            const next = await waitForStage(docId, stage)
            if (next) {
              // waitForStage 返回的就是最新 /project，无需再触发一次拉取
              setProject(next)
            } else {
              setError(`已把「${stage.name}」发给 Agent，但 4 分钟内没等到产物。它可能还在跑，去对话里看一眼。`)
            }
          } catch (e) {
            setError(e.message)
          } finally {
            setStageBusy(null)
          }
        },
        [docId, wsPath],
      )

      useEffect(() => {
        // 必须显式不传参：不写成 onClick={refresh} 之类的地方，
        // 否则事件对象会被当成 preferId 塞进 setDocId
        refresh()
      }, [refresh])

      useEffect(() => {
        if (!docId) {
          setProject(null)
          return
        }
        let alive = true
        api(`/project/${encodeURIComponent(docId)}`)
          .then((data) => alive && setProject(data))
          .catch((e) => alive && setError(e.message))
        return () => {
          alive = false
        }
      }, [docId, wsPath])

      /**
       * 追问的写入由 ReadingPane 完成（它要用返回的 context），这里只把最新的 terms 拉回来。
       * 以前两处各 POST 一次：同一次点击产生两条待答记录，而"不在待答列表里才算答完"
       * 的判据因为第二条一直挂着，答案永远不会显示。
       */
      const ask = useCallback(
        async () => {
          if (!docId) return
          setBusy(true)
          try {
            const data = await api(`/project/${encodeURIComponent(docId)}`)
            setProject(data)
            // 注意：这里不再 setTab('quiz')。用户正在读，追问后应该留在原地，
            // 答案由 ReadingPane 就地显示；跳到别的页签会打断阅读。
          } catch (e) {
            setError(e.message)
          } finally {
            setBusy(false)
          }
        },
        [docId],
      )

      /* Tab 顺序 = 学习流程顺序。
       * 原来第一个 Tab 是"精读加工"、默认也停在它，而学习第一步是读前建构，
       * 用户一进来看到的是一堆正文，却看不到"我要学什么、怎么考"。 */
      /**
       * 页签：名字与顺序都从宿主 /stages 取（rules.js STAGES 是唯一真值）。
       *
       * 之前这里写死「读完自测」「费曼考核」，而服务端提示语说「读后自测」
       * 「读后考核」、技能文档说「读后巩固」「读后考核」—— 三套名字。
       * 用户说"我要做费曼考核"，Agent 却在找 study-recall，就串线了。
       *
       * 拿不到就退回本地默认值，不让界面因为一个接口失败而空掉。
       */
      // 阶段表全应用只取一次，DockBar 读的是同一份缓存
      const stageList = useStages()

      // 页签的名字、顺序、tab 键全部来自宿主 /stages。
      // 曾经在这里存过一份兜底数组，结果它成了第二份阶段表。
      const tabs = useMemo(() => (stageList ?? []).map((s) => ({ key: s.tab, label: s.name })), [stageList])

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

      // 当前页签对应的阶段与"做完没有"，供操作条使用
      const currentStage = stageList?.find((s) => s.tab === tab) ?? null

      return h(
        'div',
        { className: 'sc-root', style: { '--sc-scale': scale } },
        // 菜单里「导入资料…」用的隐藏输入框。单选：一次一份资料。
        h('input', {
          ref: menuFileRef,
          type: 'file',
          accept: '.pdf,.docx,.pptx,.xlsx,.epub,.md,.txt,.rtf,.doc,.html',
          style: { display: 'none' },
          onChange: (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) importFile(file)
          },
        }),
        menu
          ? h(SideMenu, {
              x: menu.x,
              y: menu.y,
              note: wsPath ? `导入到 ${wsPath}` : '导入到默认工作区',
              items: [
                { key: 'file', label: '导入资料…', onSelect: () => menuFileRef.current?.click() },
                {
                  key: 'path',
                  label: '粘贴路径…',
                  onSelect: () => {
                    setPathOpen(true)
                    setPathError(null)
                  },
                },
              ],
              onClose: closeMenu,
            })
          : null,
        h(
          'div',
          { className: 'sc-head' },
          h('span', { className: 'sc-title' }, '学习工作台'),
          project ? h(StagePills, { progress: project.progress, stages: stageList }) : null,
          h('span', { style: { flex: 1 } }),
          // 正文字号：不同屏幕与视力下需要不同的默认大小，改一次就记住
          h(
            'span',
            { className: 'sc-zoom', role: 'group', 'aria-label': '正文字号' },
            h(
              'button',
              {
                className: 'sc-zoom-btn',
                title: '缩小正文',
                'aria-label': '缩小正文',
                disabled: scale <= 0.85,
                onClick: () => setScaleValue(scale - 0.1),
              },
              'A−',
            ),
            h('span', { className: 'sc-zoom-val', title: '当前缩放' }, `${Math.round(scale * 100)}%`),
            h(
              'button',
              {
                className: 'sc-zoom-btn',
                title: '放大正文',
                'aria-label': '放大正文',
                disabled: scale >= 1.6,
                onClick: () => setScaleValue(scale + 0.1),
              },
              'A+',
            ),
          ),
          // 包一层：直接把 refresh 交给 onClick 会把 MouseEvent 当成 preferId
          h('button', { className: 'sc-btn', onClick: () => refresh(), disabled: busy }, '刷新'),
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
            {
              className: 'sc-side',
              onContextMenu: (e) => {
                // 只接管资料库的空白处与标题行。条目上的右键留给以后单独设计，
                // 免得一条菜单里混进「删除」这种不可逆动作。
                if (e.target?.closest?.('.sc-doc, .sc-btn, input, a')) return
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY })
              },
              onKeyDown: (e) => {
                // Shift+F10 与菜单键：键盘用户也要能打开这个菜单
                if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  setMenu({ x: r.left + 12, y: r.top + 44 })
                }
              },
            },
            h(
              'div',
              { className: 'sc-side-head' },
              h('span', { className: 'sc-side-title' }, `资料库（${projects.length}）`),
              h(
                'button',
                {
                  className: 'sc-side-add',
                  title: '导入资料（也可以在下方空白处右键）',
                  'aria-haspopup': 'menu',
                  'aria-expanded': menu ? 'true' : 'false',
                  disabled: busy,
                  onClick: (e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setMenu({ x: r.right - 8, y: r.bottom + 4 })
                  },
                },
                '＋',
              ),
            ),
            pathOpen
              ? h(
                  'div',
                  null,
                  h(
                    'div',
                    { className: 'sc-path-row' },
                    h('input', {
                      autoFocus: true,
                      placeholder: 'D:\\资料\\chapter1.md',
                      'aria-label': '资料绝对路径',
                      value: pathText,
                      onChange: (e) => {
                        setPathText(e.target.value)
                        if (pathError) setPathError(null)
                      },
                      onKeyDown: (e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          submitPath()
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          setPathOpen(false)
                          setPathText('')
                          setPathError(null)
                        }
                      },
                    }),
                    h('button', { className: 'sc-btn sc-btn-sm', disabled: busy, onClick: submitPath }, '导入'),
                  ),
                  pathError ? h('div', { className: 'sc-path-hint' }, pathError) : null,
                )
              : null,
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
                    h(
                      'div',
                      { className: 'sc-muted' },
                      `${p.format} · ${p.chars} 字 · ${p.progress?.annotatedCount ?? 0}/${p.segmentCount} 段`,
                      // 数字旁边就说清这些标注是谁标的。只写 "182/182 段"
                      // 会让人以为自己是读过的
                      p.progress?.backfilled ? ' · 回填' : '',
                    ),
                  ),
                ),
          ),
          h(
            'div',
            { className: 'sc-main' },
            // 预览优先于"正在读取"：刚导入完，用户还没决定要不要读这份，
            // 这时候把他扔进读前建构是越权替人做决定。
            preview && preview.docId === docId
              ? h(Peek, {
                  peek: preview.peek,
                  // 点目录上的某一块 → 直接跳到那块的原文
                  // 点「开始读」→ 直接看正文
                  //
                  // 原来「开始读」是跳去读前建构。那等于：用户只是想看看内容，
                  // 却被塞了一份 14000 字的学习计划 —— 这正是"太复杂就不想看了"的来源。
                  // 读前建构要在人真的准备投入时才出现，而不是当门槛。
                  onStart: (segId) => {
                    setPreview(null)
                    setTabTouched(true)
                    if (segId) gotoSegment(segId)
                    else setTab('read')
                  },
                  onDismiss: () => {
                    setPreview(null)
                    setDocId(null)
                  },
                  onPlan: () => {
                    // 想先看计划的，自己在页签上点「读前」即可；这里只给一个明确出口
                    setPreview(null)
                    setTabTouched(true)
                    setTab('plan')
                  },
                })
              : project
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
                  // 五个页签共用同一条位置：左说明、右按钮
                  project && currentStage
                    ? h(StageBar, {
                        name: currentStage.name,
                        action: currentStage.action,
                        redo: currentStage.redo,
                        done: Boolean(project?.progress?.[currentStage.progressKey]),
                        busy: stageBusy === currentStage.key,
                        onRun: () => runStage(currentStage),
                      })
                    : null,
                  h(
                    'div',
                    { className: 'sc-pane', onClick: onBodyClick },
                    tab === 'read'
                      ? [
                          h(ReadingPane, {
                            // 按资料 id 挂载：paused/recalls/answer 都以 ¶N 为键，
                            // 换一份资料若段数相同，旧状态会原样串到新资料上
                            key: project.id,
                            project,
                            onAsk: ask,
                            jumpTo,
                            onJumped: () => setJumpTo(null),
                          }),
                          // 追问发生在读中，记录就放在读中
                          h(TermsCard, { key: 'terms', project }),
                        ]
                      : tab === 'plan'
                        ? h(PreflightPane, { project, onJump: setTab })
                        : tab === 'graph'
                          ? h(GraphPane, { project, onGoto: gotoSegment })
                          : tab === 'recall'
                            ? h(RecallPane, { project })
                            : h(QuizPane, { project, onOpenPlan: () => setTab('plan') }),
                  ),
                )
              : // 分清"还没选"和"选了但正在读"。
                // 原来两种情况都显示「从左侧选一份资料」—— 用户明明已经点了，
                // 却被要求再选一次；71KB 的项目要读一会儿，这段时间最容易让人以为点错了。
                docId
                ? h(
                    'div',
                    { className: 'sc-wait', role: 'status', 'aria-live': 'polite' },
                    h('div', { className: 'sc-wait-dot' }),
                    h('div', { className: 'sc-wait-txt' }, '正在读取资料…'),
                  )
                : h(Entry, {
                    busyHint: '正在读这份资料…',
                    // 与资料库菜单共用同一段收尾：刷新 → 选中新项目 → 30 秒预览
                    onImported: handleImported,
                    onAsk: () => {
                      // 没有文件的人：把光标送到对话框，让他说想解决什么。
                      //
                      // 不赌具体选择器：DSH 的对话框结构可能变，而这里写死一个
                      // textarea 选择器，找不到时按钮就是"点了没反应"——
                      // 比不提供这个按钮更糟。
                      // 所以：找得到就聚焦；找不到就把话说清楚该怎么办。
                      const box =
                        document.querySelector('.dsh-composer textarea') ??
                        document.querySelector('[data-slot="conversation.composer"] textarea') ??
                        document.querySelector('textarea[placeholder]') ??
                        document.querySelector('textarea')
                      if (box && typeof box.focus === 'function') {
                        box.focus()
                        if (typeof box.setSelectionRange === 'function') {
                          try {
                            box.setSelectionRange(box.value.length, box.value.length)
                          } catch {
                            /* 有些输入框不支持选区，忽略 */
                          }
                        }
                        return true
                      }
                      // 找不到对话框：返回 false，让入口自己说明该怎么办，
                      // 而不是装作聚焦成功
                      return false
                    },
                  }),
          ),
        ),
      )
    }

    /* ------------------------------------------------------ 输入框停靠条 */

    function DockBar() {
      // 工作区只有一个来源（Workbench 解析出的那个），这里只订阅变化。
      // 以前自己取 workspaces[0]，手动指定过目录后，停靠条和面板会指向两处。
      const wsPath = useCurrentWorkspace()
      const scale = useScale()
      const [current, setCurrent] = useState(null)
      const stages = useStages()
      const projectsTick = useProjectsTick()

      useEffect(() => {
        let alive = true
        api('/projects')
          .then((d) => alive && setCurrent(d.items?.[0] ?? null))
          .catch(() => {})
        return () => {
          alive = false
        }
        // projectsTick：列表变了（导入/刷新）就重取，否则停靠条会停在旧项目上
      }, [wsPath, projectsTick])

      if (!current) return null
      const idx = stageIndexOf(current.progress, stages)
      return h(
        'div',
        { className: 'sc-dock', style: { '--sc-scale': scale } },
        h('b', null, current.title),
        h(StagePills, { progress: current.progress, stages }),
        // 标注是脚本回填的，就在最显眼的位置说一句。
        // 这句话不能只放在读中页的内部标签里 —— 用户在停靠条上看到"读中完成"，
        // 却看不到"这批标注是机器凑的"，就会以为自己真的读过了。
        current.progress?.backfilled
          ? h(
              'span',
              {
                className: 'sc-dock-prov',
                title: '这批标注的 quote 是脚本从原文机械回填的，角色标签可能不对。能当骨架用，但别当成已经读懂。',
              },
              '标注是脚本回填的',
            )
          : null,
        h('span', { style: { flex: 1 } }),
        h('span', null, current.next?.message ?? ''),
        // 轻的那一步：让"不必读完也能先试"随时可见。
        // 不抢主推荐的位置，只在旁边给一句更轻的选择 ——
        // 想读下去的人不受打扰，读不动的人知道自己还有别的路。
        current.light
          ? h(
              'span',
              { className: 'sc-dock-light', title: current.light.message },
              h('span', { className: 'sc-dock-light-tag' }, '也可以'),
              current.light.message.replace(/^[^：]*：/, ''),
            )
          : null,
        idx >= 0
          ? h(
              'span',
              { style: { width: 60 } },
              h('div', { className: 'sc-bar' }, h('i', { style: { width: pct(stages?.length ? (idx + 1) / (stages.length + 1) : 0) } })),
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
        // 阶段按钮走宿主接口 /run-stage，不在客户端直接碰 remote
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: () => '学习工作台' }, BookIcon),
        )

        ctx.slots.inject('main', () =>
          // 包一层错误边界：组件抛错时给出原因，而不是让整块面板消失
          ctx.slots.register({ name: 'main', key: PANEL_ID }, (props) =>
            h(PanelBoundary, null, h(Workbench, props)),
          ),
        )

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({ name: 'conversation.composer.dock', id: 'study-copilot-dock', order: 8 }, DockBar),
        )
      },
      // 导出的组件同时是渲染冒烟的 seam（tests/audit-client-render.mjs）
      components: {
        Workbench,
        DockBar,
        BookIcon,
        StagePills,
        StageBar,
        Entry,
        PreflightPane,
        ReadingPane,
        GraphPane,
        RecallPane,
        QuizPane,
        TermsCard,
      },
    }
  },
})
