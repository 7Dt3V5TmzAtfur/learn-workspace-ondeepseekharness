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
.sc-root{display:flex;flex-direction:column;height:100%;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px}
.sc-head{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.sc-title{font-size:14px;font-weight:600}
.sc-muted{color:var(--dsw-alias-label-secondary);font-size:12px}
.sc-body{display:flex;flex:1;min-height:0}
.sc-side{width:230px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:8px}
.sc-main{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.sc-doc{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:6px;border:1px solid transparent;background:none;color:inherit;cursor:pointer;font:inherit;margin-bottom:4px}
.sc-doc:hover{background:var(--dsw-alias-bg-layer-2)}
.sc-doc[data-active=true]{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-border-l2)}
.sc-doc-name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-tabs{display:flex;gap:2px;padding:6px 12px 0;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.sc-tab{border:none;background:none;color:var(--dsw-alias-label-secondary);padding:7px 12px;border-radius:6px 6px 0 0;cursor:pointer;font:inherit;border-bottom:2px solid transparent}
.sc-tab[data-active=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary)}
.sc-pane{flex:1;overflow:auto;padding:16px 20px}
.sc-stage{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sc-pill{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.sc-pill[data-on=true]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.sc-bar{height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;margin-top:6px}
.sc-bar>i{display:block;height:100%;background:var(--dsw-alias-brand-primary);transition:width .3s}
.sc-seg{border-left:3px solid transparent;padding:6px 10px;border-radius:0 6px 6px 0;margin-bottom:6px}
.sc-seg p{margin:0 0 4px;line-height:1.75}
.sc-seg .sc-h{font-weight:600;margin:2px 0 4px}
.sc-hl-core{border-left-color:#4f8ff7;background:rgba(79,143,247,.10)}
.sc-hl-hard{border-left-color:#e5484d;background:rgba(229,72,77,.10)}
.sc-hl-ref{border-left-color:#30a46c;background:rgba(48,164,108,.10)}
.sc-tag{display:inline-block;font-size:10px;letter-spacing:.02em;padding:1px 6px;border-radius:4px;margin-bottom:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.sc-tag-d{background:rgba(79,143,247,.18)}
.sc-tag-e{background:rgba(48,164,108,.18)}
.sc-tag-q{background:rgba(229,72,77,.18)}
.sc-tag-s{background:rgba(171,122,239,.18)}
.sc-tag-t{background:rgba(255,184,108,.22)}
.sc-tag-v{background:rgba(0,160,160,.18)}
.sc-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:5px 12px;border-radius:6px;cursor:pointer;font:inherit}
.sc-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.sc-btn[disabled]{opacity:.5;cursor:not-allowed}
.sc-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}
.sc-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:12px 14px;margin-bottom:10px;background:var(--dsw-alias-bg-layer-1)}
.sc-card h4{margin:0 0 6px;font-size:12px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);font-weight:600}
.sc-kv{display:grid;grid-template-columns:88px 1fr;gap:4px 10px;line-height:1.6}
.sc-kv>span:first-child{color:var(--dsw-alias-label-secondary)}
.sc-empty{color:var(--dsw-alias-label-secondary);text-align:center;padding:40px 10px;line-height:1.8}
.sc-issue{font-size:12px;line-height:1.6;padding:5px 8px;border-radius:5px;margin-bottom:4px;background:rgba(229,72,77,.10);border-left:2px solid var(--dsw-alias-state-error-primary)}
.sc-issue[data-level=warn]{background:rgba(255,184,108,.14);border-left-color:var(--dsw-alias-state-warn-primary)}
.sc-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:10px}
.sc-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.sc-dock{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);font-size:12px;color:var(--dsw-alias-label-secondary)}
.sc-dock b{color:var(--dsw-alias-label-primary);font-weight:500}
.sc-seg-meta{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px}
.sc-details{margin-top:8px}
.sc-details>summary{cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary);user-select:none}
.sc-details[open]>summary{margin-bottom:4px}
.sc-pop{max-width:min(420px,calc(100% - 32px));right:16px;bottom:16px;position:absolute;z-index:20;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:12px;min-width:180px}
.sc-pre{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.65;background:var(--dsw-alias-bg-layer-2);padding:10px;border-radius:6px;overflow:auto;max-height:340px;margin:0}
/* ---- Markdown 渲染结果 ---- */
.sc-md{line-height:1.85;overflow-wrap:anywhere}
.sc-md p{margin:0 0 9px}
.sc-md h1,.sc-md h2,.sc-md h3,.sc-md h4,.sc-md h5,.sc-md h6{margin:16px 0 8px;line-height:1.4;font-weight:600}
.sc-md h1{font-size:19px}
.sc-md h2{font-size:17px}
.sc-md h3{font-size:15px}
.sc-md h4,.sc-md h5,.sc-md h6{font-size:13.5px}
.sc-md ul,.sc-md ol{margin:0 0 9px;padding-left:22px}
.sc-md li{margin-bottom:3px}
.sc-md li>ul,.sc-md li>ol{margin:3px 0 0}
.sc-md code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:4px;border:1px solid var(--dsw-alias-border-l1)}
.sc-md .sc-code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:10px 12px;overflow:auto;margin:0 0 10px}
.sc-md .sc-code code{background:none;border:none;padding:0;font-size:11.5px;line-height:1.7;display:block;white-space:pre}
.sc-md blockquote{margin:0 0 10px;padding:6px 12px;border-left:3px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:0 6px 6px 0;color:var(--dsw-alias-label-secondary)}
.sc-md .sc-quote p{margin:0 0 4px}
.sc-md .sc-quote p:last-child{margin:0}
.sc-md .sc-table-wrap{overflow-x:auto;margin:0 0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px}
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
.sc-md .sc-footnote{font-size:11.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);padding:5px 8px;border-top:1px dashed var(--dsw-alias-border-l1);overflow-wrap:anywhere}
.sc-md .sc-fn-id{display:inline-block;margin-right:6px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);font-family:ui-monospace,monospace;font-size:10.5px}
.sc-md mark{background:rgba(255,243,163,.5);color:inherit;padding:0 2px;border-radius:2px}
.sc-md del{opacity:.7}
/* ---- 读前建构 ----
 * 注意：卡片标签内部只允许行内元素。块级 <p> 一旦被塞进 <h3>/<span>/<li>，
 * 浏览器会强行闭合外层，导致标题断裂、行高错乱，整页看着没排版。
 */
.sc-pf{font-size:13px;line-height:1.75}
.sc-pf h3{font-size:13px;font-weight:600;margin:0 0 10px;padding-bottom:6px;
  border-bottom:1px solid var(--dsw-alias-border-l1);line-height:1.5}
.sc-pf section,.sc-pf .sc-part{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;
  padding:12px 14px;margin:0 0 10px;background:var(--dsw-alias-bg-layer-1)}
.sc-pf-part+.sc-part{margin-top:0}
.sc-pf ul,.sc-pf ol{margin:0;padding-left:20px}
.sc-pf li{margin-bottom:5px;line-height:1.75}
.sc-pf li::marker{color:var(--dsw-alias-label-secondary)}
/* 段落之间才留给空隙；行内元素之间不要额外留白 */
.sc-pf p{margin:0 0 8px}
.sc-pf p:last-child{margin-bottom:0}
.sc-pf-body>p:last-child{margin-bottom:0}
.sc-req{color:var(--dsw-alias-label-secondary);margin:0 0 10px;padding:7px 10px;
  border-radius:6px;background:var(--dsw-alias-bg-layer-2)}

/* 键值卡片：左侧窄标签、右侧内容。标签必须 first-line 对齐，不能撑高整行 */
.sc-kv2{display:grid;grid-template-columns:56px 1fr;gap:2px 12px;margin-bottom:8px;
  align-items:start;line-height:1.75}
.sc-kv2:last-child{margin-bottom:0}
.sc-kv2-k{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.75;
  white-space:nowrap;padding-top:1px}
.sc-kv2-v{min-width:0}
.sc-kv2-v>ul,.sc-kv2-list{margin:0;padding-left:18px}
.sc-kv2-v>p:last-child{margin-bottom:0}
.sc-kv2-list>li>p{margin:0}

/* 知识点块 */
.sc-kp{border-left:2px solid var(--dsw-alias-brand-primary);padding:2px 0 2px 10px;margin:10px 0}
.sc-kp:last-child{margin-bottom:0}
.sc-kp-h{font-weight:600;margin-bottom:3px;line-height:1.6}
.sc-kp-b>p{margin:0 0 4px}
.sc-kp-b>p:last-child{margin-bottom:0}
.sc-kp-note{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:4px;line-height:1.7}

/* 档位标签：压住行高，避免把所在行顶高 */
.sc-lv{display:inline-block;font-size:11px;line-height:16px;padding:0 6px;border-radius:4px;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);
  margin-left:5px;vertical-align:1px;white-space:nowrap}
.sc-assessment{margin-left:8px}

/* 思考题 / 参考资料列表 */
.sc-ex-list,.sc-ref-list{margin:0;padding-left:20px}
.sc-ex{margin-bottom:12px;line-height:1.75}
.sc-ex:last-child{margin-bottom:0}
.sc-ex-q{font-weight:500}
.sc-ex-q>p{margin:0}
.sc-rubric{margin:2px 0 0;padding-left:20px;color:var(--dsw-alias-label-secondary);font-size:12px}
.sc-rubric>li{margin-bottom:2px;line-height:1.7}
.sc-muted{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:3px;line-height:1.7}
/* ---- 图谱 SVG ---- */
.sc-graph-wrap{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:auto;max-height:70vh}
.sc-graph{display:block;min-width:100%}
.sc-gnode{cursor:pointer}
.sc-gnode rect{fill:var(--dsw-alias-bg-base);stroke:var(--dsw-alias-border-l2);stroke-width:1.2;rx:8}
.sc-gnode[data-k=concept] rect{fill:rgba(79,143,247,.10);stroke:rgba(79,143,247,.55)}
.sc-gnode[data-k=premise] rect{fill:rgba(171,122,239,.10);stroke:rgba(171,122,239,.55)}
.sc-gnode[data-k=principle] rect,.sc-gnode[data-k=method] rect{fill:rgba(48,164,108,.10);stroke:rgba(48,164,108,.55)}
.sc-gnode[data-k=problem] rect,.sc-gnode[data-k=anti-pattern] rect,.sc-gnode[data-k=risk] rect{fill:rgba(229,72,77,.10);stroke:rgba(229,72,77,.55)}
.sc-gnode[data-k=example] rect{fill:rgba(255,184,108,.14);stroke:rgba(255,184,108,.6)}
.sc-gnode[data-sel=true] rect{stroke-width:2.4;stroke:var(--dsw-alias-brand-primary)}
.sc-gnode[data-dim=true]{opacity:.28}
.sc-gnode text{font-size:11.5px;fill:var(--dsw-alias-label-primary);pointer-events:none}
.sc-gedge path{fill:none;stroke:var(--dsw-alias-border-l2);stroke-width:1.2}
.sc-gedge[data-dashed=true] path{stroke-dasharray:4 3}
.sc-gedge[data-hl=true] path{stroke:var(--dsw-alias-brand-primary);stroke-width:2}
.sc-gedge[data-dim=true]{opacity:.15}
.sc-gedge text{font-size:9.5px;fill:var(--dsw-alias-label-secondary)}
.sc-glegend{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:8px}
.sc-glegend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.sc-gtip{position:absolute;z-index:30;max-width:300px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:12px;line-height:1.7;pointer-events:none}
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

    function PreflightPane({ project }) {
      const plan = project.preflight
      if (!plan) {
        return h(
          Empty,
          null,
          h('div', null, '还没有读前建构。'),
          h('div', { className: 'sc-muted', style: { marginTop: 8 } }, '在对话里说「帮我做读前建构」，Agent 会加载 study-preflight 技能生成六段式。'),
        )
      }
      // 六段式的人读版由宿主渲染成 HTML（含表格、列表、粗体），界面只负责插入
      if (project.preflightHtml) {
        return h(
          'div',
          null,
          h(IssueList, { issues: plan.check?.issues }),
          h('div', { className: 'sc-md' }, h('div', { dangerouslySetInnerHTML: { __html: project.preflightHtml } })),
        )
      }
      // 宿主没给 HTML 时的降级：纯文本逐字段列出
      const md = (t) => h('div', { style: { whiteSpace: 'pre-wrap', lineHeight: 1.8 } }, String(t ?? '—'))
      return h(
        'div',
        null,
        h(IssueList, { issues: plan.check?.issues }),
        h('div', { className: 'sc-card' }, h('h4', null, '① 资料摘要'), md(plan.summary)),
        h(
          'div',
          { className: 'sc-card' },
          h('h4', null, '② 对我的帮助与目标'),
          h('div', { className: 'sc-kv' },
            h('span', null, '对我的帮助'), md(plan.goals?.help),
            h('span', null, '总目标'), md(plan.goals?.main),
            h('span', null, '子目标'), md((plan.goals?.subgoals ?? []).map((s) => (typeof s === 'string' ? s : s.text)).join('\n')),
          ),
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
              question: word,
              source: 'ui',
            }),
          })
          const prompt = `在《${project.title ?? project.id}》${segmentId ?? ''} 这段里，「${word}」是什么意思？请结合上下文解释，不要只给字典释义。`
          let copied = false
          try {
            await navigator.clipboard.writeText(prompt)
            copied = true
          } catch {
            copied = false
          }
          setAnswer({
            word,
            prompt,
            copied,
            text:
              (copied ? '问题已复制，粘贴到下方输入框并回车，Agent 就会结合上下文解释。' : '请复制下面这句话，粘贴到输入框并回车：') +
              (r?.context ? `\n\n该段原文：${String(r.context).slice(0, 140)}…` : ''),
          })
          if (onAsk) onAsk(word, segmentId)
        } catch (e) {
          setAnswer({ word, text: `追问失败：${e.message}`, error: true })
        } finally {
          setAsking(false)
        }
      }

      const startVoice = () => {
        const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!Ctor) return
        const rec = new Ctor()
        rec.lang = 'zh-CN'
        rec.interimResults = false
        rec.maxAlternatives = 1
        rec.onresult = (e) => {
          const said = String(e.results?.[0]?.[0]?.transcript ?? '').trim()
          setListening(false)
          if (said) {
            setSelText(said)
            if (sel) doAsk(said, sel.seg.id)
          }
        }
        rec.onerror = () => setListening(false)
        rec.onend = () => setListening(false)
        setListening(true)
        try {
          rec.start()
        } catch {
          setListening(false)
        }
      }

      return h(
        'div',
        { style: { position: 'relative' } },

        // ---- 顶部图例：三色语义 + 预算进度 ----
        h(
          'div',
          { className: 'sc-legend' },
          h('span', null, h('i', { style: { background: '#4f8ff7' } }), '核心 ≤10%'),
          h('span', null, h('i', { style: { background: '#e5484d' } }), '攻坚 ≤8%'),
          h('span', null, h('i', { style: { background: '#30a46c' } }), '参考 不限'),
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
        h(
          'div',
          { className: 'sc-md', onMouseUp: () => setSelText(readSelection()) },
          shown.map((seg) => {
            const a = byId.get(seg.id)
            const inner = htmlBySeg.get(seg.id)
            return h(
              'section',
              {
                key: seg.id,
                className: 'sc-seg',
                'data-seg': seg.id,
                style: { cursor: 'pointer' },
                onClick: () => {
                  setSelText(readSelection())
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
                      { className: `sc-btn ${listening ? 'sc-btn-primary' : ''}`, disabled: listening || asking, onClick: startVoice },
                      listening ? '🎙 聆听中…' : '🎙 语音提问',
                    )
                  : null,
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
                    h('div', { style: { marginTop: 4, lineHeight: 1.7, whiteSpace: 'pre-wrap' } }, answer.text),
                    // 没能自动复制时，把问题原样给出，让用户手动选中复制
                    answer.prompt && !answer.copied
                      ? h(
                          'div',
                          {
                            style: {
                              marginTop: 6,
                              padding: 8,
                              background: 'var(--dsw-alias-bg-layer-1)',
                              borderRadius: 6,
                              userSelect: 'all',
                              fontSize: 12,
                            },
                          },
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

    const KIND_LABEL = {
      concept: '概念',
      premise: '前提',
      principle: '原则',
      method: '方法',
      problem: '问题',
      'anti-pattern': '反模式',
      risk: '风险',
      example: '例子',
      taxonomy: '分类',
      protocol: '协议',
      'tool-type': '工具类型',
    }
    const KIND_COLOR = {
      concept: '#4f8ff7',
      premise: '#ab7aef',
      principle: '#30a46c',
      method: '#30a46c',
      problem: '#e5484d',
      'anti-pattern': '#e5484d',
      risk: '#e5484d',
      example: '#ffb86c',
      taxonomy: '#00a0a0',
      protocol: '#00a0a0',
      'tool-type': '#00a0a0',
    }

    const REL_LABEL = {
      prerequisite: '前置',
      'part-of': '整体-部分',
      contrast: '对比',
      cause: '因果',
      'example-of': '例证',
      application: '应用',
      sequence: '次序',
      analogy: '类比',
    }

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

    function QuizPane({ project }) {
      const [terms, setTerms] = useState(project.terms ?? [])
      useEffect(() => setTerms(project.terms ?? []), [project.terms])
      return h(
        'div',
        null,
        h(QaCard, { pairs: project.qa }),
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

      const tabs = [
        { key: 'read', label: '精读加工' },
        { key: 'plan', label: '读前建构' },
        { key: 'graph', label: '知识图谱' },
        { key: 'quiz', label: '费曼考核' },
      ]

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
                  h(
                    'div',
                    { className: 'sc-tabs' },
                    tabs.map((t) =>
                      h(
                        'button',
                        { key: t.key, className: 'sc-tab', 'data-active': tab === t.key, onClick: () => setTab(t.key) },
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
                        ? h(PreflightPane, { project })
                        : tab === 'graph'
                          ? h(GraphPane, { project })
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
