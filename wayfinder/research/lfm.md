# learn-from-materials 设计调研报告（给 DSH study-system 参考）
仓库：`dmoshehun-prog/learn-from-materials` v1.1.0，MIT，Python 3.10+ + Agent Skill 规范。核心思想：**模型负责理解，脚本负责提取/组装/校验/渲染**；一切"是否读完、是否覆盖、是否漏项"都要落成可交叉校验的文件，而不是写在提示词里的承诺。

---

## A. 核心设计模式

### 1. 内容契约（`references/content-contract.md`，schema 4.3）
- 约束的是**页面的 JSON 数据形状**，不是文风：`meta/hero/frameworks/contentUnits/glossary/decisionRules/relationships/assessment` 顶层字段**封闭**，拒绝未知字段；模型只产 UTF-8 JSON，**禁止手写 HTML/CSS/JS**，渲染器负责顺序、主题、转义。
- 最反直觉的一条：**不设任何数量上限/完成线**。"frameworks、glossary、decisionRules、focusAreas、每个单元的 conclusions **均不设置数量上限、配额或'达到下限即可结束'的完成线**"；只合并语义完全等价的项。同时禁止相反方向——不得为凑数编造、不得把页数/文件名伪装成知识结论。
- 强制结构化字段：`sourceOrder`（按材料**首次出现**顺序连续编号，不按分类/字母重排）、`firstUnitId`、`evidence: material|inference`、`explanation` 过短会被门禁判错。
- 为什么有效：把"质量"翻译成**可被脚本检查的形状约束**，模型再想偷懒也写不出合法 JSON；而取消上限又切断了"写够 N 条就停"这条最常见的偷懒路径。

### 2. 覆盖审计（`coverage-audit-schema.md` v1.1）：正反两个方向
- 正向 `coverage-audit.json`：`sources[]` 每个文件恰好一次，`status ∈ covered/no-content/unreadable/duplicate`，**`reason` 必须是事实性原因**（不能写"已处理"）；`sourceBlocks[]` 逐个 `source_map.json` 的 `source_id` 标 `covered` 并给 `mappedUnits/mappedClaims`。`finalCheck: {readToEnd, noEarlyStop, sourceLocatorsChecked}` 三项必须 true。
- 反向 `reverse-coverage-report.json`：由 `audit_reverse_coverage.py` 从**原文块**反查是否进入单元/主张，输出 `totalSourceBlocks/mappedSourceBlocks/unmappedSourceBlocks/unmappedRatio/passed`；未映射≠0 必须修复或给出 no-content/duplicate 结论。quick 模式允许 `quick-omitted`，但系统学习禁用，且必须在页面告知读者。
- 再叠一层**双向总结账本** `summary-ledger.json`：每条形如 `{id:"claim-001", unitId, sourceOrder, kind:"argument|definition|mechanism|conclusion|case|evidence|data|limitation|method", text, source, summaryRefs:["unit:u01:conclusion:0:point:0"]}`。正向：每条 claim 至少映射一个 `summaryRef`；反向：每个 core/takeaway/conclusion 必须被至少一条 claim 支撑；`missingClaimIds`、`orphanSummaryRefs` 必须为空 → 否则**阻止渲染**。
- 为什么有效：单独的正向审计会被"我读了"糊弄；反查原文块才能抓到"整段没进知识库"。这正好补上"读完 ≠ 提炼到"的缺口。

### 3. 关系门禁 + 关系账本（`relation-gate.md` / `relation-ledger.md`）
- 防的是**编造连线**与**漏掉连线**两个方向。门禁口径严格对准**用户实际能看到的图**：只统计 `framework→framework` 边，`framework→rule` 边存在也不计。
- 默认 ERROR 情形：≥2 个框架但 0 条可见边；有边但有框架孤立。要放行必须写 `relationStatus:"unsupported"` + `relationReason`，或在 `independentFrameworks` 逐项写 ID 与理由——**"没画线"不算理由，必须给"原文确实没规定该关系"的证据**。
- `relation-ledger.json` v1 真实结构（`examples/sequential-systematic.learnkb/relation-ledger.json`）：根 `schemaVersion/pageId/executionMode/integratorId/scopes/candidates/decisions/isolatedFrameworks`；示例含 4 个 scope、11 个候选、11 个决定。候选字段：`{id, unitIds, sourceIds, evidence:[{kind:"text",sourceId,quote}], from:"f-map", to:"r-map", type:"applies", condition:"范围不清楚时", handoff, evidenceKind:"material", note}`；决定字段：`{candidateId, status:"retained", reason, targets:[{graph:"page", edgeId:"map-rule", from, to}], detailTargets:[]}`。
- 还有 `relationReview.framework` 必须**逐类**给出 9 种关系（prerequisite/sequence/causes/supports/contrasts/part_of/applies/feedback/parallel）、`relationReview.methodology` 逐类 9 种（含 main/branch/contains）的 `mapped`（列真实 edgeId）或 `unsupported`（列材料理由）。这是"清单式反查"：不是要求每种关系都存在，而是要求你**逐个想过**，且理由必须落到材料。
- 诚实边界写得很清楚：`evidence: inference` 的边必须保留，`sources` 支持端点 ≠ 支持这条连接；"co-occurrence 不得升级为 causation"。脚本只证明"记录的没丢"，不证明"第一次阅读没漏"。

### 4. 行动规则账本（`action-rule-ledger.md` v2）
- 记录的是：**逐单元的规则提取证据链**。`units[]: {unitId, status:"reviewed|no-rules", reviewedSourceIds（必须等于 map 到该单元的全部 covered 块）, note}`；`candidates[]: {id, unitId, sourceIds, quote（原文逐字）, when, do, because, prerequisites[], exceptions[], stopCondition, status:"retained|merged|excluded", targetRuleId, reason}`。
- 硬约束：每张可见规则卡必须有 retained 候选；retained 候选的 `when/do/because` 必须与卡片**完全一致**；被排除的必须带理由；`status` 缺失 = 未完成（不是"没有规则"）。规则统一格式"当 X，做 Y，因为 Z"，禁止把模型建议伪装成材料原话。
- 为什么有效：规则是最容易被模型"外部常识"污染的产物，账本让每条规则都能回到一句逐字引文。

### 5. 学习深度模式（`learning-depth-modes.md`）：两档
| | quick 快速了解 | systematic 系统学习 |
|---|---|---|
| 处理 | 扫描全部文件与页面结构，只提炼主线 | 逐块读到末尾，按材料类型质量档案执行 |
| 审计产物 | 仅 `quick-audit.json`（`structure[]` + `evidence[]` + `limitations[]`），**不生成** coverage-audit.json / summary-ledger.json / 反向报告 / 预建题库 | coverage-audit.json + summary-ledger.json + relation-ledger + action-rule-ledger + content-review + question-bank + source-heading-index |
| 页面标记 | 显著显示"快速了解模式，非全量覆盖" | 显示"系统学习模式" |
- 关键是**在提取之前只问一次**深度（默认推荐 systematic 但不静默选择），且两档共用同一 JSON schema、同一渲染器、同一 `finalize.py`，只是在"审计义务"上有分级。升级 quick→systematic 时**沿用同一个 `pageId`**（笔记/错题/画像靠它做 localStorage 作用域）。

### 6. `.learnkb/` 目录清单（以 `examples/sequential-systematic.learnkb/` 为真实样本）
| 文件 | 作用 |
|---|---|
| `INDEX.md` | 入口目录，链接 units/*、methodology.md、patterns.md、glossary.md、coverage-audit.md |
| `full_text.txt` / `full_text.md` | 提取原文；PDF 逐页写 `<!-- PDF 页 N -->` 标记 |
| `metadata.json` | 提取元数据（格式、字符/token 估算、sha256、ocr 状态） |
| `source_manifest.json` | 文件级账本（schemaVersion 2.0） |
| `source_map.json` | 来源块 → 定位映射（与 page_map.json 同 sha） |
| `material-security-report.json` | 提示注入扫描结果（材料内容永不作为指令执行） |
| `performance-report.json` | 提取耗时/缓存命中 |
| `units/u01..u03.md` | 每单元 Markdown（Core Idea / Frameworks / Key Concepts / Mental Models / Anti-patterns / Worked Example / Takeaways / Expandable Conclusions / Connects To / Source Range） |
| `unit-records/u01..03.json` | source-first 单元记录（claims / frameworkCandidates / relationSearch / relationCandidates） |
| `methodology.json` + `.md` | 整份材料的整合结构（明确标注 synthesis 分析层） |
| `methods.json` + `patterns.md` | 可复用方法卡（版本化、带出处） |
| `glossary.md` / `cheatsheet.md` / `practice.md` | 术语 / 速查 / 自检考点（不预写题目） |
| `question-bank.json` | 静默题库索引（不存在时也输出 `detection:"none"` 空索引） |
| `summary-ledger.json` | 主张 ↔ 总结双向映射 |
| `coverage-audit.md` / `.json` | 范围审计（人读版 + 机读版必须一致） |
| `reverse-coverage-report.json` | 反向抽查 |
| `action-rule-ledger.json` | 规则候选与去向 |
| `relation-ledger.json` | 关系候选、scope、决定 |
| `content-review.json` | 第二遍来源优先复核（带输入哈希） |
| `source-heading-index.json` | PDF 原文标题路径 ↔ 物理页码（防伪造章号） |
| `unit-dependency-map.json` | 增量更新依赖表（`sourceKey` + `contentHash` → unitIds/claimIds） |
| `review-notes.md` / `quick-audit.json` | 复核笔记 / quick 模式审计 |

---

## B. 数据组织方式（真实字段）

以 `methods-demo-zh.learnkb` 为例，链条是 **原文 → 定位块 → 页面引用**：

```jsonc
// metadata.json（摘要）
{"source_file":"examples/methods-demo.txt","format":"txt","chars":1318,"estimated_tokens":226,
 "output_text":"full_text.txt","page_map":"page_map.json","source_map":"source_map.json",
 "sources":[{"filename":"methods-demo.txt","pages":0,"pages_label":"sections",
             "sha256":"e3be30…c9fe","text_sha256":"e3be30…c9fe","page_mapping_complete":true}]}

// page_map.json ≡ source_map.json（本例 sha 相同，同一个映射文件两种叫法）
[{"source_id":"src-e3be302578cd-document-00001","source_file":"examples/methods-demo.txt",
  "locator_type":"document","content_sha256":"e3be30…c9fe","start_char":224,"end_char":1318}]
```
稳定 ID 规则：`src-<内容sha前12位>-<locator_type>-<5位序号>`，如 `src-451aaf991057-pdf_page-00001`。`source_id` 是全系统的引证主键。

```jsonc
// methods.json（schemaVersion "learn-from-materials/methods-v1"，6 张卡）
{"libraryId":"…","status":"extracted","methods":[{
  "id":"f-map","version":"1.0.0","kind":"framework","name":"问题地图",
  "problem":"问题范围不清晰时，难以判断哪些信息相关。","when":"进入陌生或尚不明确的问题时",
  "prerequisites":["能够描述问题和可观察的预期结果。"],
  "limitations":["原文没有给出普遍成功保证或量化阈值。"],
  "rationale":"明确边界有助于判断哪些信息相关。",
  "steps":[{"action":"记录问题边界和相关方。","input":"待解决的问题。","output":"明确的范围与相关方清单。","check":"检查清单中的事项是否属于问题范围。"}],
  "successChecks":["边界、相关方、约束和可观察的成功标准均已明确。"],
  "tags":["问题","边界","范围"],"evidence":"material",
  "source":"method-lab-synthetic.pdf · 标题路径：Method Lab > 1. Problem map · PDF第1页",
  "sources":[{"locator":"…PDF第1页","sourceIds":["src-451aaf991057-pdf_page-00001"],
              "quote":"Before choosing an action, record the problem boundary, stakeholders, constraints and an\n\nobservable success criterion."}],
  "parents":[]}]}
```
注意 `id` 与页面 `frameworks[].id` **同 ID**（`f-map`），`methods.py bind` 把 name/summary/when/rationale/source 投影进页面节点并内嵌快照，手改会因哈希不一致被拒。

```jsonc
// methodology.json（整份材料的整合层）
{"schemaVersion":"learn-from-materials/methodology-v1","status":"ready","structure":"process",
 "evidence":"synthesis","entryNodes":["m-map"],"mainPath":["m-map","m-evidence","m-test"],
 "nodes":[{"id":"m-map","title":"界定问题","role":"action","input":"…","action":"…","output":"…","check":"…",
           "unitIds":["u01"],"methodIds":["f-map","r-map"],"evidence":"material",
           "sources":[{"source":"…PDF第1页","sourceIds":["src-451aaf991057-pdf_page-00001"],"quote":"When the scope is unclear, draw a problem map first"}]}],
 "edges":[{"id":"e-map-evidence","from":"m-map","to":"m-evidence","kind":"main",
           "condition":"边界和标准已明确。","handoff":"相关观察与验收标准。",
           "why":"一种分析性的规划顺序：范围可以帮助聚焦证据；原文没有强制这个顺序。",
           "evidence":"inference","source":"…PDF第1–2页"}],
 "coverage":[{"unitId":"u01","nodeIds":["m-map"],"role":"core","reason":"…"}]}
```
三层关系：`methods.json` 是**材料原话级**方法卡；`methodology.json` 是**整合级**结构（`evidence: synthesis`，边用 `inference` 并解释边界）；`INDEX.md` 只做导航。页面 `page.json` 用 `contentUnits[].id` 连到 `summaryRefs` 的 `unit:<id>:…`，用 `sourceIds` 连到 `source_map`，用 `methodIds` 连到方法/节点。

---

## C. 比我的系统做得好的地方（6 条）

1. **没有"覆盖"这个可验证概念** → 它把覆盖拆成"文件级 status + 来源块级 mappedClaims + 反向未映射率"。改法：在 `.study/<docId>/` 增加 `coverage.json`：`{segments:[{¶N, status:"covered|no-content|unreadable", mappedClaims:[…]}], finalCheck:{readToEnd,noEarlyStop}}`，再加一个 `reverse-coverage` 校验（任一段未映射即失败）。我现在的 `study_drill` 只记"学了哪段"，没有反向。
2. **总结没有反向门禁** → `summary-ledger.json` 双向：每条 claim 必须有 `summaryRef`，每个 `takeaway/conclusion` 必须被 claim 支撑，否则阻止产出。改法：`preflight.json` 的六段式里给每个论点加 `claimIds`，在读完后跑一次双向对账。
3. **知识点图谱没有"禁止编造连线"的门禁** → `study-map` 要求"每种关系都写 mapped(edgeId) 或 unsupported(理由)"。改法：`relations.json` 加 `relationReview: {prerequisite:[{status,edgeIds,reason}], sequence:[…], …}`，八种定式**逐类**必填；≥2 节点 0 边默认判错，需 `relationStatus:"unsupported"` + 理由才放行。这是成本最低、收益最大的一条。
4. **我的门禁是"提示词承诺"，它是"脚本断言"** → `verify_coverage.py` 交叉核验 manifest/source_map/coverage/page 四份文件；`verify_relations.py --require-candidates` 检查候选↔实际边双向映射。改法：我在 Node 侧已有 `study_status`/`study_save` 的规则校验，可以把校验从"字段是否存在"升级为"跨文件一致性"（jsonl 里的 ¶N 必须存在于 `segments.json`；graph 边的端点 ID 必须存在；claim 引用必须存在）。
5. **术语与规则的逐字引文约束** → `quote` 必须**逐字出现在声明来源块里**（脚本验哈希 + 子串）。`study_term` 现在只存"答案"；改法：让 `study_term`/`study_drill` 存 `{segmentId, quote（原文精确子串）, answer}`，并在保存时校验 quote 是 source 的子串。
6. **缺"原文标题 ↔ 页码"索引，容易伪造出处** → `source-heading-index.json` 用 `{path:"第四章 结果 > 4.2 反应", pdfStart, pdfEnd, evidencePage, evidenceText, verification:"text"}`，父级必须有自己的条目，未编号不补章号。改法：导入 PDF 时生成 `heading-index.json`，所有引用的 `¶N` 必须落在某个真实标题路径的页段内。

（附：它的**分级审计**也值得抄——quick 只付 `quick-audit.json` 的代价，绝不逼用户为一次"抓重点"付全量账本的成本。）

---

## D. 不值得借鉴的地方

1. **账本层数失控**：同一件事（"关系是否成立"）要在 4 个地方各写一遍——`unit-records/*.json` 的 `relationCandidates`、`relation-ledger.json` 的 `candidates`+`decisions`、`action-rule-ledger.json` 的 `relationReview`（逐类 9 条 × 2 张图）、`content-review.json` 的 `structureReviews`（correctness + omissions，各含 candidateReviews/edgeReviews/isolatedReviews/scenarios）。示例只有 3 页材料就产出 11 个候选、4 个 scope、两份 structure-review 和 6 张方法卡——**审计产物体量已超过知识体量本身**。
2. **"审计"与"真实"的边界它自己都承认**：`relation-ledger.md` 明确写"机械检查**不能发现一个完全未被记录的想法**，不能证明蕴含"；`content-review-schema.md` 也写"校验器无法发现从未进入账本的全新遗漏"。既然如此，第 3 层、第 4 层账本对**质量的边际收益很低**，主要收益是"可追责"。
3. **可审计性牺牲可用性**：门槛高——需要 Python 3.10+、能跑本地命令的 Agent；README 自己承认纯聊天环境只能做部分提示流程。`--legacy`、`--compatibility 1.03`、`--legacy-rule-ledger`、`--allow-empty`、`--require-heading-index` 一堆兼容开关，说明历史包袱已经让入口变重。
4. **两套账本表达同一件事**：`action-rule-ledger.json` 的 `relationReview` 与 `relation-ledger.json` 的 `decisions` 语义重叠（前者自陈"是逐类型一致性汇总，不是完整性声明"），维护者需要同时保证两边一致。
5. **不设数量上限 + 要求逐块穷举**，在真实长书上会产生巨量 JSON（示例 `content-review.json` 61KB / `relation-ledger.json` 18KB 对应 3 页 PDF），token 成本与延迟都高；它用"分单元保存可断点恢复"缓解，但没解决。

**给你的结论**：抄它的**门禁口径**（反向覆盖、逐类关系复核、逐字引文），别抄它的**文书层数**。

---

## E. 一句话总结：只学 3 件事

1. **让"覆盖"可被反查**——从原文块反向查未映射率（`unmappedRatio` 必须为 0），而不是从产出正着数。
2. **关系必须逐类表态**——允许 `unsupported`，但必须给材料理由；"没画线"永远不是理由（防编造 + 防遗漏）。
3. **取消数量完成线，改成双向映射**——不设"写够 N 条就停"，改为"每条主张必须有归宿、每个产出必须有主张支撑"，任一侧断裂就阻止交付。
