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
.sc-pop{position:absolute;z-index:20;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:12px;min-width:180px}
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

    function ReadingPane({ project, onAsk }) {
      const [selected, setSelected] = useState(null)
      const [selText, setSelText] = useState('')
      const [onlyAnnotated, setOnlyAnnotated] = useState(false)
      const items = project.annotations?.items ?? []
      const stats = project.annotations?.stats
      const issues = project.annotations?.issues
      const byId = useMemo(() => new Map(items.map((it) => [it.segmentId, it])), [items])

      // 段落正文与 HTML 已由宿主渲染好，界面不再自己切块/解析
      const segments = project.segments ?? []
      const shown = onlyAnnotated ? segments.filter((s) => byId.has(s.id)) : segments

      const tierClass = (tier) => (tier === 'hard' ? 'sc-hl-hard' : tier === 'ref' ? 'sc-hl-ref' : 'sc-hl-core')

      // 选中文字：getSelection() 返回 Selection 对象，必须 toString() 才是文字
      const readSelection = () => {
        const sel = window.getSelection?.()
        return String(sel ? sel.toString() : '').trim()
      }

      return h(
        'div',
        { style: { position: 'relative' } },
        h(
          'div',
          { className: 'sc-legend' },
          h('span', null, h('i', { style: { background: '#4f8ff7' } }), '核心（≤10%）'),
          h('span', null, h('i', { style: { background: '#e5484d' } }), '攻坚（≤8%）'),
          h('span', null, h('i', { style: { background: '#30a46c' } }), '参考'),
          stats ? h('span', null, `已标 ${stats.total}/${segments.length} 段 · 高亮 ${pct(stats.ratio)}`) : null,
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
        h('div', { className: 'sc-md' },
          shown.map((seg) => {
            const a = byId.get(seg.id)
            return h(
              'section',
              {
                key: seg.id,
                className: `sc-seg ${a ? tierClass(a.tier) : ''}`,
                'data-seg': seg.id,
                onClick: () => {
                  setSelText(readSelection())
                  setSelected({ seg })
                },
              },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 } },
                a
                  ? h('span', { className: `sc-tag sc-tag-${a.label}` }, `#${a.label}${a.title ? ` ${a.title}` : ''}`)
                  : h('span', { className: 'sc-tag' }, seg.id),
                seg.chapter ? h('span', { className: 'sc-muted' }, seg.chapter) : null,
                h('span', { className: 'sc-muted', style: { marginLeft: 'auto' } }, `${seg.chars} 字`),
              ),
              a?.note ? h('div', { className: 'sc-muted', style: { marginBottom: 4 } }, `💡 ${a.note}`) : null,
              h('div', { dangerouslySetInnerHTML: { __html: seg.html || '' } }),
            )
          }),
        ),
        selected
          ? h(
              'div',
              { className: 'sc-pop', style: { right: 16, bottom: 16 } },
              h('div', { className: 'sc-muted' }, `${selected.seg.id} · ${selected.seg.chars} 字`),
              selText
                ? h(
                    'div',
                    { style: { marginTop: 4 } },
                    '选中：',
                    h('b', null, selText.length > 40 ? `${selText.slice(0, 40)}…` : selText),
                  )
                : h('div', { className: 'sc-muted', style: { marginTop: 4 } }, '先在正文里选中一段文字'),
              h(
                'div',
                { style: { marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' } },
                h(
                  'button',
                  {
                    className: 'sc-btn sc-btn-primary',
                    disabled: !selText,
                    onClick: () => {
                      const word = selText || prompt('要问哪个词？') || ''
                      if (word.trim()) onAsk(word.trim(), selected.seg.id)
                    },
                  },
                  '问选中的词',
                ),
                h(
                  'button',
                  {
                    className: 'sc-btn',
                    onClick: () => {
                      const word = prompt('要问哪个词？') || ''
                      if (word.trim()) onAsk(word.trim(), selected.seg.id)
                    },
                  },
                  '手动输入',
                ),
                h(
                  'button',
                  { className: 'sc-btn', onClick: () => { setSelected(null); setSelText('') } },
                  '关闭',
                ),
              ),
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

    function GraphPane({ project }) {
      const graph = project.relations
      const layout = project.graphLayout
      const [hover, setHover] = useState(null)
      const [selNode, setSelNode] = useState(null)
      const [showSource, setShowSource] = useState(false)

      if (!graph) {
        return h(
          Empty,
          null,
          h('div', null, '还没有知识图谱。'),
          h('div', { className: 'sc-muted', style: { marginTop: 8 } }, '说「梳理知识点关系」，Agent 会生成节点与关系。'),
        )
      }

      const kindOf = new Map((graph.nodes ?? []).map((n) => [n.id, n.kind]))
      const labelOf = new Map((graph.nodes ?? []).map((n) => [n.id, n.label]))

      // 选中某节点时：高亮它的直接关联边，其余淡出
      const relatedEdges = selNode
        ? new Set((graph.edges ?? []).map((e, i) => (e.from === selNode || e.to === selNode ? i : null)).filter((x) => x !== null))
        : null
      const relatedNodes = selNode
        ? new Set(
            [
              selNode,
              ...(graph.edges ?? []).flatMap((e) =>
                e.from === selNode ? [e.to] : e.to === selNode ? [e.from] : [],
              ),
            ],
          )
        : null

      const svg = layout
        ? h(
            'svg',
            {
              className: 'sc-graph',
              viewBox: `0 0 ${layout.width} ${layout.height}`,
              width: layout.width,
              height: layout.height,
              style: { width: `${layout.width}px`, height: `${layout.height}px` },
            },
            // 箭头定义
            h(
              'defs',
              null,
              h(
                'marker',
                {
                  id: 'sc-arrow',
                  viewBox: '0 0 10 10',
                  refX: '9',
                  refY: '5',
                  markerWidth: '7',
                  markerHeight: '7',
                  orient: 'auto-start-reverse',
                },
                h('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'currentColor', opacity: '0.55' }),
              ),
            ),
            // 边：宿主已给出折线拐点（points），客户端只负责连线和装箭头
            layout.edges.map((e, i) => {
              const hl = relatedEdges ? relatedEdges.has(i) : false
              const dim = relatedEdges ? !relatedEdges.has(i) : false
              const pts = e.points ?? [
                [e.x1, e.y1],
                [e.x2, e.y2],
              ]
              const path = pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
              // 标签放在最长一段的中点
              let best = 0
              let bestLen = -1
              for (let k = 1; k < pts.length; k += 1) {
                const len = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
                if (len > bestLen) {
                  bestLen = len
                  best = k
                }
              }
              const midX = (pts[best][0] + pts[best - 1][0]) / 2
              const midY = (pts[best][1] + pts[best - 1][1]) / 2
              const arrowOk = !e.dashed
              return h(
                'g',
                {
                  key: `e${i}`,
                  className: 'sc-gedge',
                  'data-dashed': e.dashed,
                  'data-hl': hl,
                  'data-dim': dim,
                  style: { color: hl ? '#4f8ff7' : 'currentColor' },
                },
                h('path', {
                  d: path,
                  'marker-end': arrowOk ? 'url(#sc-arrow)' : undefined,
                  'stroke-linejoin': 'round',
                }),
                (hl || (graph.edges.length <= 24 && !dim)) && e.label
                  ? h('text', { x: midX, y: midY - 4, textAnchor: 'middle' }, String(e.label).slice(0, 18))
                  : null,
              )
            }),
            // 节点
            layout.nodes.map((n) => {
              const kind = kindOf.get(n.id) ?? 'concept'
              const dim = relatedNodes ? !relatedNodes.has(n.id) : false
              const lines = wrapToWidth(n.label, n.w - 20, 11.5, 3)
              const lineH = 13
              const startY = n.y + n.h / 2 - ((lines.length - 1) * lineH) / 2 + 4
              return h(
                'g',
                {
                  key: n.id,
                  className: 'sc-gnode',
                  'data-k': kind,
                  'data-sel': selNode === n.id,
                  'data-dim': dim,
                  onClick: (ev) => {
                    ev.stopPropagation()
                    setSelNode(selNode === n.id ? null : n.id)
                  },
                  onMouseEnter: () => setHover({ node: n, kind }),
                  onMouseLeave: () => setHover(null),
                },
                h('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 8 }),
                ...lines.map((ln, li) =>
                  h(
                    'text',
                    { key: li, x: n.x + n.w / 2, y: startY + li * lineH, textAnchor: 'middle' },
                    ln,
                  ),
                ),
              )
            }),
          )
        : null

      return h(
        'div',
        { style: { position: 'relative' }, onClick: () => setSelNode(null) },
        h(IssueList, { issues: graph.check?.issues }),
        h(
          'div',
          { className: 'sc-glegend' },
          Object.entries(KIND_COLOR).map(([k, color]) =>
            h('span', { key: k }, h('i', { style: { background: color } }), KIND_LABEL[k] ?? k),
          ),
          h('span', { style: { marginLeft: 'auto' } }, `${(graph.nodes ?? []).length} 节点 · ${(graph.edges ?? []).length} 关系`),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' } },
          selNode
            ? h(
                'span',
                { className: 'sc-muted' },
                `聚焦：${labelOf.get(selNode) ?? selNode}　`,
                h('button', { className: 'sc-btn', style: { padding: '1px 8px' }, onClick: () => setSelNode(null) }, '取消聚焦'),
              )
            : h('span', { className: 'sc-muted' }, '点节点可聚焦它的直接关系；虚线代表对比/类比等非层级关系'),
          h(
            'button',
            { className: 'sc-btn', style: { marginLeft: 'auto' }, onClick: () => setShowSource((v) => !v) },
            showSource ? '隐藏 Mermaid' : '查看 Mermaid 源',
          ),
        ),
        layout
          ? h('div', { className: 'sc-graph-wrap' }, svg)
          : h('div', { className: 'sc-muted' }, '图谱布局未生成（relations 可能缺少可用的节点）。'),
        hover
          ? h(
              'div',
              { className: 'sc-gtip', style: { right: 16, top: 40 } },
              h('div', null, h('b', null, hover.node.label)),
              h('div', { className: 'sc-muted' }, `类型：${KIND_LABEL[hover.kind] ?? hover.kind}`),
              h(
                'div',
                { className: 'sc-muted', style: { marginTop: 4 } },
                ...(graph.edges ?? [])
                  .filter((e) => e.from === hover.node.id || e.to === hover.node.id)
                  .slice(0, 6)
                  .map((e, i) =>
                    h(
                      'div',
                      { key: i },
                      e.from === hover.node.id
                        ? `→ ${labelOf.get(e.to) ?? e.to}（${REL_LABEL[e.relation] ?? e.relation}）`
                        : `← ${labelOf.get(e.from) ?? e.from}（${REL_LABEL[e.relation] ?? e.relation}）`,
                    ),
                  ),
              ),
            )
          : null,
        showSource
          ? h(
              'div',
              { className: 'sc-card', style: { marginTop: 10 } },
              h('h4', null, 'Mermaid 源（可交给 archify 出独立架构图）'),
              h('pre', { className: 'sc-pre' }, project.mermaid ?? ''),
            )
          : null,
      )
    }

    /* -------------------------------------------------------- 考核面板 */

    function QuizPane({ project }) {
      const [terms, setTerms] = useState(project.terms ?? [])
      useEffect(() => setTerms(project.terms ?? []), [project.terms])
      return h(
        'div',
        null,
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
            setTab('quiz')
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
                      ? h(ReadingPane, { project, onAsk: ask })
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
