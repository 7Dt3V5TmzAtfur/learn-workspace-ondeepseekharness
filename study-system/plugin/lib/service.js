/**
 * 学习服务：所有"导入 / 读 / 存 / 校验"的确定性逻辑都在这里。
 * Agent 工具与界面 HTTP API 都调它 —— 同一件事只有一份实现。
 */
import { basename, extname, resolve, isAbsolute } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extractDocument, segmentText } from './extract.js'
import { StudyStore, slugify, STUDY_DIR_NAME } from './store.js'
import { buildArchifyFigures } from './archify-figures.js'
import { renderMarkdown, layoutGraph, escapeHtml as escHtml } from './markdown.js'

/** 属性值转义：比正文转义多挡一层引号，避免属性被提前闭合。 */
const escAttr = (v) => escHtml(String(v ?? '')).replace(/"/g, '&quot;')
import {
  validateAnnotation,
  validatePreflight,
  validateRelations,
  renderAnnotatedHtml,
  ATTENTION_TIERS,
  ROLE_LABELS,
  RELATION_TYPES,
} from './rules.js'

const STAGE_ORDER = ['ingested', 'planned', 'annotated', 'mapped', 'recalled', 'drilled']

/**
 * 复习间隔（天）：1 → 3 → 7，之后维持 7 天。
 * 对应学习科学里的间隔重复：第一次忘得最快，之后拉长。
 */
const REVIEW_INTERVALS = [1, 3, 7]

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
  if (!progress.recalled) {
    return {
      stage: 'mapped',
      action: 'study-recall',
      message: '读后自测：生成 6-12 条问答（每条 ≤100 字），再定一个明天能做完的最小行动',
    }
  }
  if (!progress.drilled) {
    return { stage: 'recalled', action: 'study-feynman', message: '读后考核：合上讲义做费曼复述与练习' }
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
        // token 名对应界面的 CSS 变量 --sc-<token>-line，不再是旧的颜色名
        token: v.token,
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
   *  - figures          archify 生成的 HTML 图（图谱页直接用 iframe 嵌入）
   *
   * 曾经这里还算了一份 graphLayout（手搓 SVG 用的节点坐标，约 11.5 KB），
   * 但用户明确要求图谱必须用 archify 生成的 HTML，界面从来不读这个字段。
   * 每打开一次面板就白算一次，所以改成按需生成。
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

    // Mermaid 源：保存时用过、调试脚本也读，随 project 一起返回（很便宜）
    const mermaid = project.relations ? this.toMermaid(project.relations) : null

    // 节点坐标只有显式要才计算（约 11.5 KB 的布局运算）。
    // 界面用的是 archify 生成的 HTML，从不读 graphLayout。
    let graphLayout = null
    if (options.withLayout && mermaid) {
      try {
        graphLayout = layoutGraph(mermaid, { width: options.width ?? 920 })
      } catch {
        graphLayout = null
      }
    }

    // archify 生成的图（每张一个 iframe）。旧项目可能还没生成过，此时返回空数组。
    const figuresArtifact = await this.store.artifact(docId, 'figures.json').catch(() => null)
    const figures = (figuresArtifact?.figures ?? []).map((f) => ({
      index: f.index,
      title: `第 ${f.index} 张 · ${f.nodeCount} 个知识点`,
      url: `${imageBase}${encodeURIComponent(f.file)}`,
      nodeCount: f.nodeCount,
      edgeCount: f.edgeCount,
      ok: Boolean(f.ok),
    }))

    // 三色高亮后的正文。这是"读中加工"页签的主体内容：
    // 高亮加在原文的具体短语上（quote），不是整段变色。
    const annotatedHtml = project.annotations
      ? renderAnnotatedHtml(
          segments.map((s) => ({ id: s.id, text: s.text, chars: s.chars })),
          project.annotations,
        )
      : null

    return {
      ...project,
      segments,
      preflightHtml: project.preflight ? this.renderPreflightHtml(project.preflight) : null,
      quizHtml: project.quiz ? renderMarkdown(project.quiz) : null,
      refsHtml: project.refs ? renderMarkdown(project.refs) : null,
      annotatedHtml,
      mermaid,
      graphLayout,
      figures,
      qa: (await this.store.artifact(docId, 'qa.json').catch(() => null))?.items ?? [],
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
    const kv = (k, v) => `<div class="sc-kv2"><span class="sc-kv2-k">${k}</span><div class="sc-kv2-v">${v}</div></div>`

    // 标题里去重序号：数据常写成「第一部分 xxx」，再套一层会变成「第 1 部分 第一部分 xxx」
    const headingOf = (p, i) => {
      const raw = String(p.title ?? '').trim()
      const hasOrdinal = /^第\s*[0-9一二三四五六七八九十百]+\s*[部分章节讲]/.test(raw)
      return hasOrdinal ? t(raw) : `第 ${i + 1} 部分　${t(raw)}`
    }

    const parts = plan.parts ?? []

    /* ③ 每一部分的目标、要求、重点、难点
     * 用户的原话是"每一部分的目标、要求、重点、难点"——四个都要有。
     *
     * 但全展开有 5800 字，用户打开就累了（"太复杂就不想学"）。
     * 所以：标题 + 一句要求（骨架）默认可见，重点/难点折进 details。
     * 想核对细节的人点开，不想的先扫过 —— 二八法则里那 20% 的骨架先到手。 */
    const partGoals = parts
      .map(
        (p, i) => `<section class="sc-part">
    <h3>${headingOf(p, i)}</h3>
    ${p.requirements ? `<p class="sc-req">${t(p.requirements)}</p>` : ''}
    <details class="sc-fold">
      <summary>重点与难点</summary>
      ${kv('重点', `<ul class="sc-kv2-v sc-list">${li(p.keyPoints)}</ul>`)}
      ${kv('难点', `<ul class="sc-kv2-v sc-list">${li(p.difficulties)}</ul>`)}
    </details>
  </section>`,
      )
      .join('\n  ')

    /* ④ 每一部分的考核方式（了解/理解/掌握/熟练掌握）+ 知识点、内容、备注
     * 档位做成带 data-lv 的 chip，四档用同一色的 4 级不透明度，
     * 这样扫一眼就知道每部分要求到什么程度，不用逐字读。
     * 知识点同样折叠：先看到"这部分考到什么程度 + 有哪几个知识点"，
     * 展开才看到每个知识点的内容与备注。 */
    const partAssess = parts
      .map((p, i) => {
        const a = p.assessment ?? {}
        const kpList = p.knowledgePoints ?? []
        // 折叠着也要能看到"有哪几个知识点"，只给名字，不给正文
        const kpNames = kpList.map((kp) => `<li>${t(kp.name)}</li>`).join('')
        const kps = kpList
          .map(
            (kp, j) => `<div class="sc-kp">
      <div class="sc-kp-h">知识点 ${j + 1}　${t(kp.name)}</div>
      <div class="sc-kp-b">${md(kp.content)}</div>
      ${kp.note ? `<div class="sc-kp-note">备注：${t(kp.note)}</div>` : ''}
    </div>`,
          )
          .join('\n      ')
        return `<section class="sc-part">
    <h3>${headingOf(p, i)}<span class="sc-lv" data-lv="${escAttr(a.level ?? '')}">${t(a.level ?? '—')}</span></h3>
    ${a.requirement ? `<div class="sc-req">考核要求：${t(a.requirement)}</div>` : ''}
    ${
      kpList.length
        ? `<details class="sc-fold">
      <summary>${kpList.length} 个知识点</summary>
      <ul class="sc-list sc-kp-names">${kpNames}</ul>
      ${kps}
    </details>`
        : '<div class="sc-muted">（这一部分没有单列知识点）</div>'
    }
  </section>`
      })
      .join('\n  ')

    const subs = (plan.goals?.subgoals ?? [])
      .map((sg) => {
        const text = typeof sg === 'string' ? sg : sg.text
        const level = typeof sg === 'string' ? '' : sg.level
        return `<li>${t(text)}${level ? ` <span class="sc-lv" data-lv="${escAttr(level)}">${t(level)}</span>` : ''}</li>`
      })
      .join('\n        ')

    const exs = (plan.exercises ?? [])
      .map((ex) => {
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
        const kind = r.kind ?? '我的知识'
        const note = r.note ? `<div class="sc-ref-note">${t(r.note)}</div>` : ''
        const url = r.url
          ? ` <a href="${escAttr(r.url)}" target="_blank" rel="noopener noreferrer">${escHtml(r.url)}</a>`
          : ''
        return `<li class="sc-ref">
        <span class="sc-ref-kind" data-kind="${escAttr(kind)}">${t(kind)}</span>
        <div class="sc-ref-body">${t(r.title ?? r.name ?? '')}${url}${note}</div>
      </li>`
      })
      .join('\n      ')

    // ①②③④⑤⑥ 六段连续编号，每段一张卡。缺数据时也要有牌子，不能整段消失，
    // 否则用户又在界面上找不到第几段了。
    const sec = (num, title, body) => `<section class="sc-pf-sec">
    <h3 class="sc-pf-h">${num}　${title}</h3>
    <div class="sc-pf-body">${body || '<div class="sc-muted">（这一部分还没有内容）</div>'}</div>
  </section>`

    return `<div class="sc-pf">
  ${sec('①', '资料摘要', md(plan.summary))}
  ${sec(
    '②',
    '对我的帮助与目标',
    kv('对我的帮助', md(plan.goals?.help)) +
      kv('总目标', md(plan.goals?.main)) +
      kv('子目标', `<ul class="sc-list">${subs}</ul>`),
  )}
  ${sec('③', '每一部分的目标、要求、重点、难点', partGoals)}
  ${sec('④', '每一部分的考核方式与知识点', partAssess)}
  ${sec('⑤', '思考题与作业（费曼）', `<ol class="sc-ex-list">${exs}</ol>`)}
  ${sec('⑥', '参考资料', `<ol class="sc-ref-list">${refs}</ol>`)}
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
    // quote 校验需要段落正文，而 segments.json 只存了字数摘要，
    // 正文在 segment-texts.json 里，这里合并进来。
    const texts = new Map(
      ((await this.store.artifact(docId, 'segment-texts.json'))?.items ?? []).map((t) => [t.id, t.text]),
    )
    const withText = segments.map((s) => ({ ...s, text: texts.get(s.id) ?? '' }))
    const totalChars = segments.reduce((a, s) => a + s.chars, 0)
    const check = validateAnnotation(items, { segments: withText, totalChars })
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

  /**
   * 保存知识点关系图，并立刻生成 archify 图。
   *
   * 用户明确要求逻辑衔接图用 archify 技能做，所以这里不是自己画，
   * 而是把 relations 翻译成 archify 候选、调它的 CLI 出独立 HTML。
   * archify 失败不阻塞保存——关系数据本身是有效的，
   * 图上不去只是少了一个视图，不能因此让用户丢数据。
   */
  async saveRelations(docId, graph) {
    const check = validateRelations(graph)
    await this.store.writeArtifact(docId, 'relations.json', { ...graph, check, savedAt: new Date().toISOString() })

    let figures = null
    if (check.ok) {
      const meta = await this.store.meta(docId)
      try {
        figures = await buildArchifyFigures(graph, {
          workDir: this.store.dir(docId),
          outDir: this.store.dir(docId),
          docTitle: meta?.title ?? docId,
          maxNodes: 18,
        })
        if (figures.ok) {
          await this.store.writeArtifact(docId, 'figures.json', {
            generatedAt: new Date().toISOString(),
            ...figures,
          })
        }
      } catch (e) {
        figures = { ok: false, figures: [], reason: `archify 生成失败：${e?.message ?? e}` }
      }
      await this.store.saveMeta(docId, { stage: 'mapped' })
    }

    return {
      docId,
      check,
      mermaid: this.toMermaid(graph),
      figures,
      next: nextStepOf(await this.store.progressOf(docId)),
    }
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
  /**
   * 记录一次费曼复述/答题。
   *
   * 为什么要设门槛：原来只要 submitted 一段文字就算"考核完成"，
   * 于是"把原文复制一遍"也能点亮最后一段进度——那不是学会了，
   * 是搬运。这里加三道检查，全部对照学习科学的"提取练习"研究：
   *
   * 1. **合书**：允许开卷，但必须自己声明；开卷的复述不计入掌握度。
   * 2. **时长**：低于 60 秒的复述通常是"随手打两行"，
   *    真正把一段论证讲清楚至少需要写 5-10 句。
   * 3. **抄原文**：与原文的 n-gram 重合度过高 = 复述而不是回忆。
   *
   * 注意：这些是"提醒 + 降级"，不是硬拒绝。学习工具不该把人挡在门外，
   * 但必须让他知道自己这一步算不算数。
   */
  async recordDrill(docId, { prompt, answer, rubricHit, verdict, minimalAction, closedBook, durationSec } = {}) {
    const text = String(answer ?? '').trim()
    if (!text) throw new Error('缺少你的复述/作答内容：请先真的用自己的话说一遍')

    const warnings = []
    const answerChars = [...text].length

    // ---- 1. 合书 ----
    const isClosed = closedBook === true
    if (!isClosed) {
      warnings.push({
        level: 'warn',
        code: 'drill-open-book',
        message: '这次是开卷复述，不计入掌握度。下次试着合上书再讲一遍。',
      })
    }

    // ---- 2. 时长 ----
    let minutes = null
    if (typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec >= 0) {
      minutes = Math.round((durationSec / 60) * 10) / 10
      if (durationSec < 60) {
        warnings.push({
          level: 'warn',
          code: 'drill-too-fast',
          message: `只花了 ${durationSec} 秒。讲清楚一段论证通常要几分钟，这次更像随手记录而不是复述。`,
        })
      }
    }

    // ---- 3. 抄原文 ----
    // 用 8 字滑窗：中文里 8 个字连续相同，就基本可以断定是复制而非转述
    let copiedRatio = 0
    let longestRun = 0
    try {
      const texts = (await this.store.artifact(docId, 'segment-texts.json').catch(() => null))?.items ?? []
      const source = texts.map((t) => String(t.text ?? '')).join('\n').replace(/[\s*`#>|]/g, '')
      const mine = text.replace(/[\s*`#>|]/g, '')
      if (source.length >= 8 && mine.length >= 8) {
        const N = 8
        const grams = new Map()
        for (let i = 0; i + N <= source.length; i += 1) grams.set(source.slice(i, i + N), true)
        let hit = 0
        let total = 0
        let run = 0
        let best = 0
        for (let i = 0; i + N <= mine.length; i += 1) {
          total += 1
          if (grams.has(mine.slice(i, i + N))) {
            hit += 1
            run += 1
            if (run > best) best = run
          } else {
            run = 0
          }
        }
        copiedRatio = total ? hit / total : 0
        longestRun = best + (best > 0 ? N - 1 : 0)
      }
    } catch {
      /* 没有原文就不做这项检查 */
    }
    if (copiedRatio > 0.3 || longestRun >= 30) {
      warnings.push({
        level: 'warn',
        code: 'drill-copied',
        message:
          `有 ${(copiedRatio * 100).toFixed(0)}% 的片段与原文重合（最长连续 ${longestRun} 字）。` +
          '这更像抄录而不是用自己的话讲——试着合上书，用你记得的版本讲一遍。',
      })
    }

    const valid = isClosed && warnings.every((w) => w.code !== 'drill-too-fast' && w.code !== 'drill-copied')

    const record = {
      at: new Date().toISOString(),
      prompt: prompt ? String(prompt).slice(0, 500) : null,
      answer: text.slice(0, 4000),
      answerChars,
      rubricHit: Array.isArray(rubricHit) ? rubricHit.map(String) : [],
      verdict: verdict ? String(verdict) : null,
      minimalAction: minimalAction ? String(minimalAction) : null,
      closedBook: isClosed,
      durationSec: typeof durationSec === 'number' ? durationSec : null,
      minutes,
      copiedRatio: Math.round(copiedRatio * 1000) / 1000,
      longestRun,
      valid,
      warnings,
    }
    await this.store.appendJsonl(docId, 'drills.jsonl', record)

    // 只有"有效"的复述才推进到 drilled。无效的照样存下来（是宝贵的记录），
    // 但进度不动——否则门槛形同虚设。
    if (valid) await this.store.saveMeta(docId, { stage: 'drilled' })

    const progress = await this.store.progressOf(docId)

    // ---- 4. 复习调度 ----
    // 艾宾浩斯间隔：1 天 → 3 天 → 7 天。这里只登记第一个到期日，
    // 真正的"今天该复习哪几份"由 reviewDue() 统一算。
    if (valid) {
      const now = Date.now()
      await this.store.saveMeta(docId, {
        review: { lastDrilledAt: new Date(now).toISOString(), stage: 0, dueAt: new Date(now + 86400000).toISOString() },
      })
    }

    return { docId, record, progress, next: nextStepOf(progress) }
  }

  /**
   * 今天该复习哪些资料。
   *
   * 只登记"下次到期日"是不够的——用户打开工作台时需要一个直接的清单，
   * 而不是自己去比对日期。
   */
  async reviewDue() {
    const docs = await this.list()
    const now = Date.now()
    const items = []
    for (const d of docs) {
      const meta = await this.store.meta(d.id).catch(() => null)
      const review = meta?.review
      if (!review?.dueAt) continue
      const due = Date.parse(review.dueAt)
      if (Number.isNaN(due)) continue
      items.push({
        docId: d.id,
        title: d.title,
        stage: review.stage ?? 0,
        dueAt: review.dueAt,
        overdueDays: Math.floor((now - due) / 86400000),
        isDue: due <= now,
        nextIntervalDays: REVIEW_INTERVALS[(review.stage ?? 0) + 1] ?? null,
      })
    }
    items.sort((a, b) => a.overdueDays - b.overdueDays)
    return { due: items.filter((i) => i.isDue), upcoming: items.filter((i) => !i.isDue) }
  }

  /**
   * 完成一次复习，推进到下一个间隔。
   *
   * 1 天 → 3 天 → 7 天 → 之后固定 7 天（长期维持）。
   */
  async completeReview(docId) {
    const meta = await this.store.meta(docId)
    const stage = (meta?.review?.stage ?? 0) + 1
    const days = REVIEW_INTERVALS[stage] ?? 7
    const dueAt = new Date(Date.now() + days * 86400000).toISOString()
    await this.store.saveMeta(docId, { review: { ...(meta?.review ?? {}), stage, dueAt } })
    return { docId, stage, dueAt, intervalDays: days }
  }

  async drills(docId) {
    return this.store.jsonl(docId, 'drills.jsonl')
  }

  /**
   * 读完一份资料后留 QA 自测清单。
   *
   * 用户原话：「文件后添加 QA 提问和回答，辅助自己回忆刚才看了什么（每个 QA 不超过 100 字）」。
   * 对应学习科学里的「主动回忆」：读完立刻自测，比再读一遍有效。
   *
   * 硬约束：
   * - 问题和回答各自不超过 100 字（超了直接拒绝，不截断——截断会把意思弄丢）
   * - segmentIds 可选，给了就能回跳原文核对
   */
  async saveQa(docId, pairs) {
    const list = Array.isArray(pairs) ? pairs : []
    if (!list.length) throw new Error('QA 为空：至少给出一条问答')
    const issues = []
    const normalized = []

    const known = new Set((await this.store.segments(docId)).map((s) => s.id))
    for (const [i, p] of list.entries()) {
      const q = String(p?.q ?? '').trim()
      const a = String(p?.a ?? '').trim()
      const where = `第 ${i + 1} 条`
      if (!q) issues.push({ level: 'error', code: 'qa-no-question', message: `${where}缺少问题` })
      if (!a) issues.push({ level: 'error', code: 'qa-no-answer', message: `${where}缺少回答` })
      if ([...q].length > 100) {
        issues.push({
          level: 'error',
          code: 'qa-question-too-long',
          message: `${where}问题 ${[...q].length} 字，超过 100 字上限`,
        })
      }
      if ([...a].length > 100) {
        issues.push({
          level: 'error',
          code: 'qa-answer-too-long',
          message: `${where}回答 ${[...a].length} 字，超过 100 字上限`,
        })
      }
      const ids = (Array.isArray(p?.segmentIds) ? p.segmentIds : []).map(String)
      const unknown = ids.filter((id) => !known.has(id))
      if (unknown.length) {
        issues.push({
          level: 'warn',
          code: 'qa-unknown-segment',
          message: `${where}引用了不存在的段落：${unknown.join(',')}（回跳会失效，问答仍可用）`,
        })
      }
      normalized.push({
        q,
        a,
        segmentIds: ids.filter((id) => known.has(id)),
        chars: { q: [...q].length, a: [...a].length },
      })
    }

    if (issues.some((it) => it.level === 'error')) {
      return { docId, accepted: false, issues, count: 0 }
    }

    await this.store.writeArtifact(docId, 'qa.json', {
      items: normalized,
      savedAt: new Date().toISOString(),
    })
    return {
      docId,
      accepted: true,
      issues,
      count: normalized.length,
      // 与其它阶段保持一致：存完就把"下一步"一起告诉调用方，
      // 否则界面和 Agent 都不知道 QA 存进去以后该干什么。
      next: nextStepOf(await this.store.progressOf(docId)),
    }
  }

  async qa(docId) {
    const art = await this.store.artifact(docId, 'qa.json').catch(() => null)
    return art?.items ?? []
  }

  /**
   * 精简状态：只给"做决定需要知道的事"，不含正文。
   *
   * 为什么需要单开一个方法：`project()` 是为了给界面渲染的，它带 182 段原文、
   * 三份渲染好的 HTML、mermaid 源码，实测响应 222 KB。
   * 而 `study_status` 是模型每轮都会调的工具，它只需要知道
   * 「做到哪一步了、下一步干什么、有哪些校验问题」。
   * 让模型读 222 KB 换一句话的结论，是纯粹的上下文浪费。
   */
  /**
   * 覆盖审计：哪些段落还没加工。
   *
   * 之前的进度只有"已标注 37 段"，没有分母，用户看不出还有 145 段没碰。
   * 逆向核对（reverse coverage）是关键：不是问"我标了几段"，
   * 而是问"哪些段还空着"，逐段列出来。
   *
   * 参考项目的教训是审计体量会超过知识体量，所以这里只做一件事：
   * 列出没加工的段 id + 它们所在的小节标题，不做 10 种报表。
   */
  async coverage(docId) {
    const segs = await this.store.segments(docId)
    const texts = new Map(
      ((await this.store.artifact(docId, 'segment-texts.json').catch(() => null))?.items ?? []).map((t) => [
        t.id,
        String(t.text ?? ''),
      ]),
    )
    const annotations = (await this.store.artifact(docId, 'annotations.json').catch(() => null))?.items ?? []
    const done = new Set(annotations.map((a) => a.segmentId))

    // 段的 heading 字段并不存在（段落只有 chapter），所以按"最近一个 Markdown 标题"
    // 往前走查真实小节名。否则所有段都会落在"（无标题段落）"里，分组没意义。
    const headingOf = new Map()
    let current = '开篇'
    for (const s of segs) {
      const text = texts.get(s.id) ?? s.lead ?? ''
      const m = /^#{1,6}\s+(.{1,60})/.exec(String(text).trim())
      if (m) current = m[1].replace(/[*`]/g, '').trim()
      headingOf.set(s.id, current)
    }

    const skipped = segs
      .filter((s) => !done.has(s.id))
      .map((s) => ({
        id: s.id,
        chars: s.chars ?? [...(texts.get(s.id) ?? '')].length,
        heading: headingOf.get(s.id) ?? null,
      }))

    // 按小节聚合，让用户看到"第 3 节整节没标"而不是一串 ¶98,¶99...
    const byHeading = new Map()
    for (const s of skipped) {
      const key = s.heading ?? '（无标题段落）'
      const cur = byHeading.get(key) ?? { heading: key, count: 0, chars: 0, ids: [] }
      cur.count += 1
      cur.chars += s.chars
      cur.ids.push(s.id)
      byHeading.set(key, cur)
    }
    const groups = [...byHeading.values()].sort((a, b) => b.count - a.count)

    return {
      total: segs.length,
      done: segs.length - skipped.length,
      skippedCount: skipped.length,
      percent: segs.length ? Math.round(((segs.length - skipped.length) / segs.length) * 1000) / 10 : 0,
      skipped,
      groups: groups.map((g) => ({
        heading: g.heading,
        count: g.count,
        chars: g.chars,
        // 只给前 8 个 id，够定位就行
        sampleIds: g.ids.slice(0, 8),
      })),
    }
  }

  /**
   * 拿到了什么 —— 与 coverage 并行的另一个视角。
   *
   * 为什么需要它：`coverage` 数的是"加工了多少段"，那是完成主义 KPI。
   * 用户真在意的是"这份资料给我留下了什么能用的东西"。
   * 一段不标但整个单元讲通了，比标满 182 段碎片有价值得多。
   *
   * 依据：原则/反完成主义阅读 —— 「一本书若有一句话引发共鸣或改变认知，
   * 即已回本」「高 ROI 来自击中点而非覆盖面」。
   *
   * 这里只数"真东西"，不数过程：
   * - 能复述的点：核心档标注（用户读到会被要求停下来回想）
   * - 能自测的点：QA 问答
   * - 能落地的点：最小行动（drills 里的 minimalAction）
   * - 能讲清的概念：术语追问
   *
   * 刻意不做的事：不给"完成度百分比"，不设达标线。
   * 一旦有百分比，就会有人为了 100% 去标碎片。
   */
  async harvested(docId) {
    const ann = (await this.store.artifact(docId, 'annotations.json').catch(() => null))?.items ?? []
    const qa = (await this.store.artifact(docId, 'qa.json').catch(() => null))?.items ?? []
    const terms = await this.store.jsonl(docId, 'terms.jsonl').catch(() => [])
    const drills = await this.store.jsonl(docId, 'drills.jsonl').catch(() => [])

    // 只要"能复述"的核心档，参考档和攻坚档不算"拿到的点"
    const core = ann.filter((a) => a.tier === 'core')
    // 有效考核：合书、够时长、没抄原文
    const validDrills = drills.filter((d) => d.valid !== false)
    const actions = validDrills.map((d) => String(d.minimalAction ?? '').trim()).filter(Boolean)

    return {
      // 四个"拿到了"的桶
      keyPoints: core.length,
      selfTests: qa.length,
      actions: actions.length,
      terms: terms.length,
      // 让界面能直接展示"拿到了什么"，而不是"完成了多少"
      highlights: [
        ...core.slice(0, 6).map((a) => ({ kind: 'keypoint', label: a.title || a.quote, where: a.segmentId })),
      ],
      // 一条给用户看的话，不带百分比
      summary: this.harvestSentence({ core: core.length, qa: qa.length, actions: actions.length, terms: terms.length }),
    }
  }

  /** 把四个桶说成人话。没有百分比，因为"拿到 7 个点"本身就是进度。 */
  harvestSentence({ core, qa, actions, terms }) {
    const bits = []
    if (core) bits.push(`${core} 处能复述的要点`)
    if (qa) bits.push(`${qa} 道自测`)
    if (terms) bits.push(`${terms} 个查过的词`)
    if (actions) bits.push(`${actions} 个能落地的行动`)
    if (!bits.length) return '还没拿到东西。先读一段，标一句你觉得重要的。'
    return `已经拿到 ${bits.join('、')}。`
  }

  /**
   * 单元清单 —— 这份资料分几块、每块讲什么、现在读到哪。
   *
   * 为什么需要：之前 182 段是平铺的，用户看不到结构；
   * preflight 的 parts 是模型自己编的切法，跟原文小节没有 ID 关联。
   * 单元把「原文小节 → 段落 → 核心要点」串成一条线，
   * 界面左侧就能列出"这章有 25 块"，而且每块都能点回原文。
   *
   * 数据来自 units.json（由 tests/build-units.mjs 生成并校验不重不漏）。
   * 没生成过就返回 null —— 老项目不该因为缺这个文件而报错。
   */
  async units(docId) {
    const raw = await this.store.artifact(docId, 'units.json').catch(() => null)
    if (!raw?.units?.length) return null
    const done = new Set(
      ((await this.store.artifact(docId, 'annotations.json').catch(() => null))?.items ?? []).map(
        (a) => a.segmentId,
      ),
    )
    // 每个单元算一下"碰过没有"：有标注就算碰过。
    // 刻意不用百分比 —— 用户要的是"哪块还没看"，不是"完成度 68%"。
    const units = raw.units.map((u, i) => {
      const touched = u.segmentIds.filter((id) => done.has(id)).length
      return {
        index: i + 1,
        id: u.id,
        title: u.title,
        level: u.level,
        segmentCount: u.segmentCount,
        chars: u.chars,
        keyPointCount: u.keyPoints?.length ?? 0,
        sourceRange: u.sourceRange,
        subsections: u.subsections ?? [],
        touched,
        done: touched >= u.segmentIds.length,
      }
    })
    return { totalUnits: units.length, totalSegments: raw.totalSegments, units }
  }

  async status(docId) {
    const meta = await this.store.meta(docId)
    const progress = await this.store.progressOf(docId)
    const preflight = await this.store.artifact(docId, 'preflight.json').catch(() => null)
    const annotations = await this.store.artifact(docId, 'annotations.json').catch(() => null)
    const relations = await this.store.artifact(docId, 'relations.json').catch(() => null)
    const qa = await this.store.artifact(docId, 'qa.json').catch(() => null)
    const terms = await this.store.jsonl(docId, 'terms.jsonl').catch(() => [])
    const drills = await this.store.jsonl(docId, 'drills.jsonl').catch(() => [])

    // 每个阶段只带"有没有问题"，不带全量 issue 文本（可能几十条，逐条读没意义）
    const brief = (check) => {
      if (!check) return null
      const errs = (check.issues ?? []).filter((i) => i.level === 'error')
      const warns = (check.issues ?? []).filter((i) => i.level === 'warn')
      return {
        ok: check.ok ?? errs.length === 0,
        errors: errs.length,
        warns: warns.length,
        // 只给前 3 条错误，够定位就行
        top: errs.slice(0, 3).map((i) => i.code ?? i.message),
      }
    }

    return {
      docId,
      title: meta?.title ?? docId,
      sourcePath: meta?.sourcePath ?? null,
      stage: nextStepOf(progress).stage,
      next: nextStepOf(progress),
      progress,
      checks: {
        preflight: brief(preflight?.check),
        annotation: brief(annotations?.check),
        relations: brief(relations?.check),
      },
      counts: {
        segments: progress.segmentCount,
        annotations: progress.annotatedCount,
        // 覆盖率必须带分母：只说"已标注 37"没有意义，
        // 用户看不出还有 145 段没碰。
        coverage: progress.segmentCount
          ? `${progress.annotatedCount}/${progress.segmentCount}（${Math.round((progress.annotatedCount / progress.segmentCount) * 1000) / 10}%）`
          : '0/0',
        nodes: relations?.nodes?.length ?? 0,
        edges: relations?.edges?.length ?? 0,
        figures: (await this.store.artifact(docId, 'figures.json').catch(() => null))?.figures?.length ?? 0,
        qa: qa?.items?.length ?? 0,
        terms: terms.length,
        drills: drills.length,
      },
      // 高亮预算实测值：模型应该据此判断要不要缩短 quote
      highlight: annotations?.stats
        ? {
            ratio: annotations.stats.ratio,
            coreRatio: annotations.stats.tierRatio?.core ?? null,
            hardRatio: annotations.stats.tierRatio?.hard ?? null,
            refRatio: annotations.stats.tierRatio?.ref ?? null,
          }
        : null,
      hint: '需要看原文段落用 study_read；这个接口只回报进度与校验，不含正文。',
    }
  }

  /**
   * 术语追问：把"词 + 所在段落上下文"落库，回答由模型给出。
   * 界面点词、语音提问都走这里，保证每次都带上上下文。
   */
  /**
   * 术语追问：把"词 + 所在段落上下文"落库。
   *
   * 两个用途：
   * - 界面点词/语音提问时先落库（answer 为空），再等 Agent 通过 study_term 回填
   * - Agent 自己解释时直接带 answer 落库
   *
   * 上下文必须按 id 直查 —— 早期这里用 read(docId,{limit:1000})，
   * 但 read() 内部把 limit 截到 100，导致第 101 段之后的词全部取不到上下文，
   * 静默变成空串。chapter4 有 182 段，后 82 段的追问全是无上下文的。
   */
  async askTerm(docId, { term, segmentId, question, answer, source }) {
    const clean = String(term ?? '').trim()
    if (!clean) throw new Error('缺少要追问的词')
    let context = ''
    if (segmentId) {
      const texts = (await this.store.artifact(docId, 'segment-texts.json').catch(() => null))?.items ?? []
      const hit = texts.find((t) => t.id === segmentId)
      context = hit?.text ?? ''
    }
    const record = {
      id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      term: clean,
      segmentId: segmentId ?? null,
      question: String(question ?? `「${clean}」在这里是什么意思？`),
      context: context.slice(0, 1200),
      answer: answer ? String(answer) : null,
      source: source ?? 'ui',
      at: new Date().toISOString(),
    }
    await this.store.appendJsonl(docId, 'terms.jsonl', record)
    return record
  }

  /**
   * 回填某个待答术语的答案。
   *
   * 界面点词后 `answer` 为 null，需要 Agent 答完再写回来。
   * 按 term + segmentId 找最近一条还没答的记录，避免把历史已答覆盖掉。
   */
  async answerTerm(docId, { term, segmentId, answer }) {
    const clean = String(term ?? '').trim()
    const text = String(answer ?? '').trim()
    if (!clean) throw new Error('缺少 term')
    if (!text) throw new Error('缺少 answer')
    const all = (await this.store.artifact(docId, 'terms.jsonl').catch(() => null)) ?? []
    let idx = -1
    for (let i = all.length - 1; i >= 0; i -= 1) {
      const r = all[i]
      if (r.term !== clean) continue
      if (segmentId && r.segmentId !== segmentId) continue
      if (r.answer) continue
      idx = i
      break
    }
    if (idx < 0) return { updated: false, reason: '没有找到待答的追问记录' }
    all[idx] = { ...all[idx], answer: text, answeredAt: new Date().toISOString() }
    // 必须用 writeJsonl：terms.jsonl 是"每行一条"，用 writeArtifact 会被写成 JSON 数组
    await this.store.writeJsonl(docId, 'terms.jsonl', all)
    return { updated: true, record: all[idx] }
  }

  /**
   * 还没答的追问（界面轮询用）。
   *
   * 只认界面点出来的（source=ui）且还没答的：terms.jsonl 里有很多
   * Agent 早先写下的历史记录，它们answer 为空并不等于"等人回答"，
   * 全算进来的话界面会永远显示几十条待答。
   */
  async pendingTerms(docId) {
    const all = (await this.store.artifact(docId, 'terms.jsonl').catch(() => null)) ?? []
    return all.filter((r) => !r.answer && r.source === 'ui')
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
    const lines = ['# 参考资料', '', '> 来源标注：`原文`＝资料本身；`我的知识`＝模型已有认知（可能过时）；`联网检索`＝本次实际检索（附链接可回查）。', '']

    // 按来源分组，让用户一眼看出哪些可以直接信、哪些需要自己核实
    const ORDER = ['原文', '联网检索', '我的知识']
    const groups = new Map(ORDER.map((k) => [k, []]))
    for (const ref of references ?? []) {
      const src = ORDER.includes(ref.source) ? ref.source : '我的知识'
      groups.get(src).push(ref)
    }

    let n = 0
    for (const src of ORDER) {
      const list = groups.get(src)
      if (!list.length) continue
      lines.push(`## ${src}`, '')
      for (const ref of list) {
        n += 1
        const title = ref.title ?? ref.name ?? `资料 ${n}`
        const bits = [title]
        if (ref.author) bits.push(ref.author)
        if (ref.kind) bits.push(`（${ref.kind}）`)
        let line = `${n}. ${bits.join(' · ')}`
        if (ref.url) line += `\n   - ${ref.url}`
        if (ref.note) line += `\n   - 用途：${ref.note}`
        lines.push(line)
      }
      lines.push('')
    }
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
      let body = texts.get(seg.id) ?? seg.lead ?? ''
      // 导出 Markdown 时用加粗表达三色高亮，保证纯文本也能看出档位
      if (a?.quote) {
        const mark = a.tier === 'ref' ? '*' : '**'
        body = body.replace(String(a.quote), `${mark}${a.quote}${mark}`)
      }
      out.push(body)
      if (a?.note) out.push(`> 备注：${a.note}`)
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
