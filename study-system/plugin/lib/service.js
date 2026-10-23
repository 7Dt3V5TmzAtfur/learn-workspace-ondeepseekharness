/**
 * 学习服务：所有"导入 / 读 / 存 / 校验"的确定性逻辑都在这里。
 * Agent 工具与界面 HTTP API 都调它 —— 同一件事只有一份实现。
 */
import { basename, extname, resolve, isAbsolute } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extractDocument, segmentText } from './extract.js'
import { StudyStore, slugify, STUDY_DIR_NAME } from './store.js'
import { renderMarkdown, layoutGraph } from './markdown.js'
import {
  validateAnnotation,
  validatePreflight,
  validateRelations,
  renderAnnotatedHtml,
  ATTENTION_TIERS,
  ROLE_LABELS,
  RELATION_TYPES,
} from './rules.js'

const STAGE_ORDER = ['ingested', 'planned', 'annotated', 'mapped', 'drilled']

function nextStepOf(progress) {
  if (!progress.ingested) return { stage: 'empty', action: 'study_ingest', message: '先导入一份资料' }
  if (!progress.planned) {
    return { stage: 'ingested', action: 'study-preflight', message: '读前建构：生成六段式学习全景（摘要/帮助与目标/重难点/考核/思考题/参考资料）' }
  }
  if (!progress.annotated) {
    return { stage: 'planned', action: 'study-annotate', message: '读中加工：逐段打渐构标签 + 三色注意力' }
  }
  if (!progress.mapped) {
    return { stage: 'annotated', action: 'study-map', message: '梳理知识点逻辑关系，生成衔接图' }
  }
  if (!progress.drilled) {
    return { stage: 'mapped', action: 'study-feynman', message: '读后考核：合上讲义做费曼复述与练习' }
  }
  return { stage: 'done', action: null, message: '全流程完成：可以做迁移应用或教给别人' }
}

export class StudyService {
  constructor(workspace) {
    this.workspace = resolve(workspace)
    this.store = new StudyStore(this.workspace)
  }

  get ws() {
    return this.workspace
  }

  /** 词表：让模型知道有哪些标签/关系/档位可用，避免瞎编。 */
  vocabulary() {
    return {
      roleLabels: Object.entries(ROLE_LABELS).map(([key, v]) => ({ key, zh: v.zh, en: v.en, means: v.means })),
      attentionTiers: Object.entries(ATTENTION_TIERS).map(([key, v]) => ({
        key,
        zh: v.zh,
        color: v.color,
        labels: v.labels,
        budget: v.budget,
        why: v.why,
      })),
      relationTypes: Object.entries(RELATION_TYPES).map(([key, zh]) => ({ key, zh })),
      stages: STAGE_ORDER,
    }
  }

  /**
   * 导入：提取 → 分段 → 落盘。
   * @param {string} filePath 文件路径（相对工作区或绝对）
   */
  async ingest(filePath, options = {}) {
    const abs = isAbsolute(filePath) ? filePath : resolve(this.workspace, filePath)
    if (!existsSync(abs)) throw new Error(`文件不存在：${abs}`)
    const info = await stat(abs)
    if (!info.isFile()) throw new Error(`不是文件：${abs}`)
    if (info.size === 0) throw new Error(`文件为空：${abs}`)

    const buf = await readFile(abs)
    const { text, format, warning } = await extractDocument(abs, buf)
    if (!text || text.length < 10) {
      throw new Error(`提取不到正文内容（${format}）。若为扫描件请先 OCR。`)
    }

    const title = options.title?.trim() || basename(abs, extname(abs))
    const docId = options.docId?.trim() || slugify(title)
    const segments = segmentText(text)
    const totalChars = segments.reduce((a, s) => a + s.chars, 0)

    await this.store.saveMeta(docId, {
      title,
      sourcePath: abs,
      sourceName: basename(abs),
      format,
      bytes: info.size,
      chars: totalChars,
      segmentCount: segments.length,
      warning: warning ?? null,
      createdAt: (await this.store.meta(docId).catch(() => null))?.createdAt ?? new Date().toISOString(),
    })
    await this.store.writeArtifact(docId, 'source.md', text)
    await this.store.writeArtifact(docId, 'segments.json', {
      totalChars,
      items: segments.map(({ text: _t, ...rest }) => rest),
    })
    // 段落原文单独存一份，渲染与 reading 面板都用它，避免重新解析 source.md
    await this.store.writeArtifact(docId, 'segment-texts.json', {
      items: segments.map((s) => ({ id: s.id, text: s.text })),
    })
    await this.store.importOriginal(docId, abs).catch(() => null)

    return {
      docId,
      title,
      format,
      chars: totalChars,
      segmentCount: segments.length,
      warning: warning ?? null,
      next: nextStepOf(await this.store.progressOf(docId)),
    }
  }

  async list() {
    const items = await this.store.list()
    return items.map((it) => ({ ...it, next: nextStepOf(it.progress) }))
  }

  /**
   * 界面用的完整项目视图。
   * 除了原始数据，还附带"已渲染好"的部分：
   *  - segments[].text  段落正文（界面不再靠 source 按序切块硬对齐）
   *  - segments[].html  段落正文的 HTML（Markdown 已解析）
   *  - preflightHtml / quizHtml / refsHtml  人读视图
   *  - mermaid          图谱源（GraphPane 渲染前提）
   *  - graphLayout      已算好坐标的节点与边（客户端只负责画 SVG）
   */
  async project(docId, options = {}) {
    const project = await this.store.fullProject(docId)
    const texts = new Map(
      ((await this.store.artifact(docId, 'segment-texts.json'))?.items ?? []).map((t) => [t.id, t.text]),
    )
    const imageBase = `/study-copilot/api/asset/${encodeURIComponent(docId)}/`

    const segments = project.segments.map((s) => {
      const text = texts.get(s.id) ?? s.lead ?? ''
      return {
        ...s,
        text,
        html: renderMarkdown(text, { imageBase }),
      }
    })

    const mermaid = project.relations ? this.toMermaid(project.relations) : null
    let graphLayout = null
    if (mermaid) {
      try {
        graphLayout = layoutGraph(mermaid, { width: options.width ?? 920 })
      } catch {
        graphLayout = null
      }
    }

    return {
      ...project,
      segments,
      preflightHtml: project.preflight ? this.renderPreflightHtml(project.preflight) : null,
      quizHtml: project.quiz ? renderMarkdown(project.quiz) : null,
      refsHtml: project.refs ? renderMarkdown(project.refs) : null,
      annotatedHtml: null,
      mermaid,
      graphLayout,
      next: nextStepOf(project.progress),
      vocabulary: this.vocabulary(),
    }
  }

  /**
   * 读前六段式的人读版。
   *
   * 关键约束：卡片标签（重点/难点/考核/知识点）内部只能用**行内** HTML。
   * 早期版本把 renderMarkdown 的块级输出（带 <p>）直接塞进 <h3>、<span>、<li>，
   * 而 HTML 不允许 <p> 嵌套在那些位置——浏览器会强行闭合外层元素，
   * 结果是标题被拆开、行高错乱、整页看起来像没排版。所以这里一律用 inline 模式。
   */
  renderPreflightHtml(plan) {
    const md = (t) => renderMarkdown(String(t ?? ''))
    const t = (t) => renderMarkdown(String(t ?? ''), { inline: true }) // 行内：不产生 <p>
    const li = (arr) => (arr ?? []).map((x) => `<li>${t(x)}</li>`).join('')

    const parts = (plan.parts ?? [])
      .map((p, i) => {
        const kps = (p.knowledgePoints ?? [])
          .map(
            (kp, j) => `<div class="sc-kp">
      <div class="sc-kp-h">知识点 ${j + 1}　${t(kp.name)}</div>
      <div class="sc-kp-b">${md(kp.content)}</div>
      ${kp.note ? `<div class="sc-kp-note">备注：${t(kp.note)}</div>` : ''}
    </div>`,
          )
          .join('\n    ')

        const assess = p.assessment ?? {}
        // 标题里别重复序号：数据本身常写成“第一部分　xxx”，再套一层就变成
        // “第 1 部分　第一部分　xxx”。已有“第N部分/章/讲”就原样用。
        const rawTitle = String(p.title ?? '').trim()
        const hasOrdinal = /^第\s*[0-9一二三四五六七八九十百]+\s*[部分章节讲]/.test(rawTitle)
        const heading = hasOrdinal ? t(rawTitle) : `第 ${i + 1} 部分　${t(rawTitle)}`
        return `<section class="sc-part">
    <h3>${heading}</h3>
    ${p.requirements ? `<p class="sc-req">${t(p.requirements)}</p>` : ''}
    <div class="sc-kv2"><span class="sc-kv2-k">重点</span><ul class="sc-kv2-v">${li(p.keyPoints)}</ul></div>
    <div class="sc-kv2"><span class="sc-kv2-k">难点</span><ul class="sc-kv2-v">${li(p.difficulties)}</ul></div>
    <div class="sc-kv2">
      <span class="sc-kv2-k">考核</span>
      <div class="sc-kv2-v">
        <span class="sc-lv">${t(assess.level ?? '—')}</span>
        ${assess.requirement ? `<span class="sc-assessment">${t(assess.requirement)}</span>` : ''}
        ${assess.purpose ? `<div class="sc-muted">目的：${t(assess.purpose)}</div>` : ''}
      </div>
    </div>
    ${kps}
  </section>`
      })
      .join('\n  ')

    const subs = (plan.goals?.subgoals ?? [])
      .map((sg) => {
        const text = typeof sg === 'string' ? sg : sg.text
        const level = typeof sg === 'string' ? '' : sg.level
        return `<li>${t(text)}${level ? ` <span class="sc-lv">${t(level)}</span>` : ''}</li>`
      })
      .join('\n      ')

    const exs = (plan.exercises ?? [])
      .map((ex, i) => {
        const rubric = (ex.rubric ?? []).map((r) => `<li>${t(r)}</li>`).join('')
        return `<li class="sc-ex">
        <div class="sc-ex-q">${md(ex.question)}</div>
        ${ex.kind ? `<div class="sc-muted">类型：${t(ex.kind)}</div>` : ''}
        ${rubric ? `<div class="sc-muted">达标要点：</div><ul class="sc-rubric">${rubric}</ul>` : ''}
        ${ex.minimalAction ? `<div class="sc-muted">最小行动：${t(ex.minimalAction)}</div>` : ''}
      </li>`
      })
      .join('\n      ')

    const refs = (plan.references ?? [])
      .map((r) => {
        const title = t(r.title ?? r.name ?? '')
        const kind = r.kind ? ` <span class="sc-lv">${t(r.kind)}</span>` : ''
        const note = r.note ? `<div class="sc-muted">${t(r.note)}</div>` : ''
        return `<li>${title}${kind}${note}</li>`
      })
      .join('\n      ')

    const kv = (k, v) => `<div class="sc-kv2"><span class="sc-kv2-k">${k}</span><div class="sc-kv2-v">${v}</div></div>`

    return `<div class="sc-pf">
  <section class="sc-pf-sec">
    <h3>① 资料摘要</h3>
    <div class="sc-pf-body">${md(plan.summary)}</div>
  </section>
  <section class="sc-pf-sec">
    <h3>② 对我的帮助与目标</h3>
    ${kv('对我的帮助', md(plan.goals?.help))}
    ${kv('总目标', md(plan.goals?.main))}
    ${kv('子目标', `<ul class="sc-kv2-list">${subs}</ul>`)}
  </section>
  ${parts}
  <section class="sc-pf-sec">
    <h3>⑤ 思考题与作业（费曼）</h3>
    <ol class="sc-ex-list">${exs}</ol>
  </section>
  <section class="sc-pf-sec">
    <h3>⑥ 参考资料</h3>
    <ol class="sc-ref-list">${refs}</ol>
  </section>
</div>`
  }

  /**
   * 取一段原文（供模型精读 / 供界面渲染）。
   * offset+limit 让模型可以分批处理长文档，避免一次塞爆上下文。
   */
  async read(docId, options = {}) {
    const segments = await this.store.segments(docId)
    const texts = new Map(
      ((await this.store.artifact(docId, 'segment-texts.json'))?.items ?? []).map((t) => [t.id, t.text]),
    )
    const offset = Math.max(0, Number(options.offset ?? 0))
    const limit = Math.min(Number(options.limit ?? 20), 100)
    const slice = segments.slice(offset, offset + limit)
    return {
      docId,
      offset,
      total: segments.length,
      hasMore: offset + limit < segments.length,
      segments: slice.map((s) => ({ ...s, text: texts.get(s.id) ?? s.lead ?? '' })),
    }
  }

  async savePreflight(docId, plan) {
    const segments = await this.store.segments(docId)
    const check = validatePreflight(plan)
    await this.store.writeArtifact(docId, 'preflight.json', { ...plan, validatedAt: new Date().toISOString(), check })
    if (plan?.references?.length) {
      await this.store.writeArtifact(docId, 'refs.md', this.renderRefs(plan.references))
    }
    if (plan?.exercises?.length) {
      await this.store.writeArtifact(docId, 'quiz.md', this.renderExercises(plan.exercises, plan.summary))
    }
    await this.store.saveMeta(docId, { stage: check.ok ? 'planned' : 'ingested' })
    return { docId, check, next: nextStepOf(await this.store.progressOf(docId)), segmentCount: segments.length }
  }

  async saveAnnotation(docId, items) {
    const segments = await this.store.segments(docId)
    const totalChars = segments.reduce((a, s) => a + s.chars, 0)
    const check = validateAnnotation(items, { segments, totalChars })
    // 补齐档位：未显式指定时按标签归属落库，渲染与统计都依赖它
    const labelTier = {}
    for (const [tier, def] of Object.entries(ATTENTION_TIERS)) for (const label of def.labels) labelTier[label] = tier
    const normalized = (Array.isArray(items) ? items : []).map((it) => {
      const label = String(it?.label ?? '').replace(/^#/, '').toLowerCase()
      return { ...it, label, tier: it?.tier ?? labelTier[label] ?? 'core' }
    })
    const payload = {
      items: normalized,
      stats: check.stats,
      issues: check.issues,
      savedAt: new Date().toISOString(),
    }
    if (!check.ok) {
      // 校验未通过：只留草稿，不写正式产物，阶段不推进
      await this.store.writeArtifact(docId, 'annotations.rejected.json', payload)
      return { docId, check, next: nextStepOf(await this.store.progressOf(docId)), accepted: false }
    }
    await this.store.writeArtifact(docId, 'annotations.json', payload)
    const md = await this.renderAnnotatedMarkdown(docId, segments, items)
    await this.store.writeArtifact(docId, 'annotated.md', md)
    await this.store.saveMeta(docId, { stage: 'annotated' })
    return { docId, check, next: nextStepOf(await this.store.progressOf(docId)), accepted: true }
  }

  async saveRelations(docId, graph) {
    const check = validateRelations(graph)
    await this.store.writeArtifact(docId, 'relations.json', { ...graph, check, savedAt: new Date().toISOString() })
    if (check.ok) await this.store.saveMeta(docId, { stage: 'mapped' })
    return { docId, check, mermaid: this.toMermaid(graph), next: nextStepOf(await this.store.progressOf(docId)) }
  }

  async saveQuiz(docId, markdown) {
    await this.store.writeArtifact(docId, 'quiz.md', markdown)
    // 注意：这里不把 stage 标成 drilled。生成思考题不等于完成考核，
    // 只有学习者真的复述/答题后（recordDrill）才算。
    return { docId, next: nextStepOf(await this.store.progressOf(docId)) }
  }

  /**
   * 记录一次考核结果：学习者复述了什么、哪些要点达标、下次的最小行动。
   * 这是 drilled 阶段的唯一触发点。
   */
  async recordDrill(docId, { prompt, answer, rubricHit, verdict, minimalAction } = {}) {
    const text = String(answer ?? '').trim()
    if (!text) throw new Error('缺少你的复述/作答内容：请先真的用自己的话说一遍')
    const record = {
      at: new Date().toISOString(),
      prompt: prompt ? String(prompt).slice(0, 500) : null,
      answer: text.slice(0, 4000),
      rubricHit: Array.isArray(rubricHit) ? rubricHit.map(String) : [],
      verdict: verdict ? String(verdict) : null,
      minimalAction: minimalAction ? String(minimalAction) : null,
    }
    await this.store.appendJsonl(docId, 'drills.jsonl', record)
    await this.store.saveMeta(docId, { stage: 'drilled' })
    const progress = await this.store.progressOf(docId)
    return { docId, record, progress, next: nextStepOf(progress) }
  }

  async drills(docId) {
    return this.store.jsonl(docId, 'drills.jsonl')
  }

  /**
   * 术语追问：把"词 + 所在段落上下文"落库，回答由模型给出。
   * 界面点词、语音提问都走这里，保证每次都带上上下文。
   */
  async askTerm(docId, { term, segmentId, question, answer, source }) {
    const clean = String(term ?? '').trim()
    if (!clean) throw new Error('缺少要追问的词')
    let context = ''
    if (segmentId) {
      const hit = (await this.read(docId, { offset: 0, limit: 1000 })).segments.find((s) => s.id === segmentId)
      context = hit?.text ?? ''
    }
    const record = {
      term: clean,
      segmentId: segmentId ?? null,
      question: String(question ?? `「${clean}」在这里是什么意思？`),
      context: context.slice(0, 800),
      answer: answer ?? null,
      source: source ?? 'ui',
      at: new Date().toISOString(),
    }
    await this.store.appendJsonl(docId, 'terms.jsonl', record)
    return record
  }

  async searchTerms(docId, term) {
    const all = (await this.store.artifact(docId, 'terms.jsonl')) ?? []
    const q = String(term ?? '').trim().toLowerCase()
    if (!q) return all
    return all.filter((r) => String(r.term ?? '').toLowerCase().includes(q))
  }

  async render(docId) {
    const segments = await this.store.segments(docId)
    const texts = new Map(
      ((await this.store.artifact(docId, 'segment-texts.json'))?.items ?? []).map((t) => [t.id, t.text]),
    )
    const withText = segments.map((s) => ({ ...s, text: texts.get(s.id) ?? s.lead ?? '' }))
    const annotations = await this.store.artifact(docId, 'annotations.json')
    return renderAnnotatedHtml(withText, annotations)
  }

  /* ------------------------------------------------------------ 渲染 */

  renderRefs(references) {
    const lines = ['# 参考资料', '']
    references.forEach((ref, i) => {
      const title = ref.title ?? ref.name ?? `资料 ${i + 1}`
      const bits = [title]
      if (ref.author) bits.push(ref.author)
      if (ref.kind) bits.push(`（${ref.kind}）`)
      let line = `${i + 1}. ${bits.join(' · ')}`
      if (ref.url) line += `\n   - ${ref.url}`
      if (ref.note) line += `\n   - 用途：${ref.note}`
      lines.push(line)
    })
    return lines.join('\n') + '\n'
  }

  renderExercises(exercises, summary) {
    const lines = ['# 思考题与作业（费曼学习法）', '']
    if (summary) lines.push(`> 闭卷前提：先合上原文，用 60 秒讲清「${String(summary).slice(0, 40)}…」`, '')
    exercises.forEach((ex, i) => {
      lines.push(`## ${i + 1}. ${ex.question}`)
      lines.push('')
      if (ex.kind) lines.push(`- 类型：${ex.kind}`)
      if (ex.hint) lines.push(`- 提示：${ex.hint}`)
      if (ex.rubric?.length) lines.push(`- 达标要点：${ex.rubric.join('；')}`)
      if (ex.minimalAction) lines.push(`- 最小行动：${ex.minimalAction}`)
      lines.push('')
    })
    return lines.join('\n')
  }

  async renderAnnotatedMarkdown(docId, segments, items) {
    const byId = new Map(items.map((it) => [it.segmentId, it]))
    const texts = new Map(
      ((await this.store.artifact(docId, 'segment-texts.json'))?.items ?? []).map((t) => [t.id, t.text]),
    )
    const out = []
    for (const seg of segments) {
      const a = byId.get(seg.id)
      if (a) {
        const kw = a.label === 'c' && a.keyword ? `${a.keyword} ` : ''
        out.push(`#${a.label} ${kw}${a.title ?? ''}|${ROLE_LABELS[a.label]?.en ?? a.label}`)
      }
      out.push(texts.get(seg.id) ?? seg.lead ?? '')
    }
    return out.join('\n\n') + '\n'
  }

  /** 知识点关系 → Mermaid，交给 archify 技能出图。 */
  toMermaid(graph) {
    const direction = graph.direction === 'LR' ? 'LR' : 'TD'
    const lines = [`graph ${direction}`]
    const shape = (node) => {
      const label = String(node.label ?? node.id).replace(/"/g, "'")
      if (node.kind === 'definition') return `[("${label}")]`
      if (node.kind === 'example') return `["${label}"]`
      return `["${label}"]`
    }
    for (const node of graph.nodes ?? []) lines.push(`  ${node.id}${shape(node)}`)
    const arrow = { prerequisite: '-->', 'part-of': '-->', contrast: '-.-', cause: '-->', 'example-of': '-.->', application: '-->', sequence: '-->', analogy: '-.-' }
    for (const edge of graph.edges ?? []) {
      const a = arrow[edge.relation] ?? '-->'
      const label = edge.label ? `|${edge.label}|` : `|${edge.relation}|`
      lines.push(`  ${edge.from} ${a}${label} ${edge.to}`)
    }
    return lines.join('\n')
  }
}

export { nextStepOf, STAGE_ORDER, STUDY_DIR_NAME }
