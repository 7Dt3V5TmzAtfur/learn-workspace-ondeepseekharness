# 更新日志 / Changelog

## 1.1.0 · 2026-10-19

相对于公开版本 1.0，本次更新完善顺序学习流程、来源结构复核、关系图阅读和交付一致性。

### 新增与改进

- 来源优先的逐单元记录与确定性组装，同源生成学习页面、章节说明和出处／覆盖映射。
- 框架和关系候选账本，保存保留、合并和排除去向；逐单元原文回读及全局正确性、遗漏／应用检查绑定实际输入。
- 框架主分支与交叉边优先曲线，未连线框架保留在卡片、搜索和图外折叠清单；改进两图方向提示、出处浮片、窄屏与全屏操作。
- 交付目录及 ZIP 顶层提供独立方法论 Markdown，内容与知识库导出一致；交付元数据读取实际 skill 版本。
- 统一为当前执行者的顺序流程，同步中英文文档、直接提取命令、示例和发行元数据。
- 固定提取基准子进程日志的 UTF-8 编码，避免 Windows 控制台编码与父进程不同时出现诊断流解码异常。

### English

• Adds source-first unit records and deterministic assembly, generating learning pages, chapter explanations, and source/coverage mappings from the same records.
• Adds framework and relationship candidate ledgers that track retained, merged, and excluded items; binds unit-level source rereads and global correctness and omission/application checks to the actual inputs.
• Prioritizes curved main branches and cross-links in framework diagrams, keeps unlinked frameworks accessible through cards, search, and a collapsible list outside the diagram, and improves direction cues, source tooltips, narrow-screen layouts, and fullscreen controls in both diagrams.
• Provides standalone methodology Markdown in the delivery directory and at the ZIP root, consistent with the knowledge-base export; delivery metadata uses the actual skill version.
• Standardizes a sequential workflow performed by the current executor and updates bilingual documentation, direct extraction commands, examples, and release metadata.
• Standardizes extraction benchmark subprocess logs on UTF-8 to prevent diagnostic-output decoding errors caused by encoding differences between the Windows console and the parent process.

## 1.0 release · 2026-10-01

相对于上一公开版本 `v0.2.0`，本次发布整理了内容复核、交付流程、图形交互和示例资料。中英文输出、方法库、全文方法论及关系图已在 `v0.2.0` 提供，本次继续保留并改进。

### 内容复核与兼容性

- 新系统学习交付增加 `content-review.json`：从原材料开始第二遍复核，逐单元检查总结、行动规则和封闭数量清单，并把记录绑定到当前输入版本。更新材料或总结后，过期记录不能通过交付。
- 继续要求 v2 行动规则/关系台账及系统学习 PDF 的原文标题索引；规范方法文件、页面快照及可读导出保持一致。旧页面可继续阅读；旧知识库重新交付须重新复核，或按文档使用明确的兼容选项。
- 英文页面支持已复核的 `sourceLabels` 展示译名，同时保留原文引文和规范定位；检查章节、印刷页码及 PDF 物理页码的对应关系。

### 阅读与图形交互

- 更新液态玻璃样式、三套主题、中英文导航、出处排版及条件文案；框架关系图支持折叠分组，无已记录连线的框架保留为响应式卡片网格。
- 搜索列出全部匹配框架；节点和连线选择展示对应关系，展开全部保留循环和交叉边。长标签按字体与节点尺寸换行，连线预留标签空隙并绕开障碍。
- 改进框架图与方法论图的浮片滚动隔离、键盘说明及全屏布局；两张图分别验证。保留 16 张用户提供的中英文展示截图，并明确其演示用途。

### 流程与 Windows 修复

- 快速了解统一为规范方法绑定、最终展示出处复核、轻量索引及 `finalize.py` 交付；不增加系统学习专属的全量台账要求。
- 初始交付明确标记为 `static-only`，视觉检查状态为 `not-run`；浏览器核验和记录单独执行。内容检查证明结构、引用及记录一致性，不能代替语义判断或保证零遗漏。
- Windows 命令行保留调用者编码，无法显示的符号转义输出，避免检查通过后因输出日志而失败；Poppler 正文明确按 UTF-8 读取，诊断流编码不再干扰正文提取。
- 暂存交付对短暂 Windows 文件锁进行有限重试；交付排除可重建缓存，保留原文、来源映射及安全/性能报告。
- Git 换行规则保留示例及证据文件的原始字节，避免 Windows 检出转换后使复核哈希失效。

### 示例与发布整理

- 移除真实论文全文、对应生成知识库及关联 JSON/HTML/Markdown 示例；替换为 MIT 许可的自编三页 Method Lab PDF 与当前系统学习知识库，保留出处、图形及交付测试覆盖。
- 同步两份 README、示例索引、许可说明、版本元数据与回归测试。发布版本为 `1.0`，修订为 `release`，压缩包文件名为 `learn-from-materials-1.0-release.zip`。
- 公开更新日志按 `v0.2.0` 到 `1.0 release` 的累积差异整理，保留此前公开日志，不再将内部审阅与回滚记录作为公开版本条目。

### English summary

Compared with the previous public release, `v0.2.0`:

- Added a source-first second-pass content review for new systematic deliveries, with input fingerprints and per-unit, claim, rule and enumerated-list records. Retained the v2 rule/relationship ledger and reviewed PDF heading requirements.
- Added reviewed English source-label presentation without changing original quotations or canonical locators; refined themes, navigation, source layout and condition prefixes.
- Improved framework grouping, unlinked-card grids, all-match search, long-label routing, hovercard scrolling and fullscreen behavior while retaining supported edges and stable identities.
- Unified quick preparation with canonical binding and the shared finalizer. Initial deliveries explicitly report static validation; browser visual review remains separate.
- Fixed CLI logging under Windows code pages and Poppler text/diagnostic decoding; retained bounded file-lock retries and excluded rebuildable caches from delivery bundles.
- Replaced the real-paper full text and derived examples with an original MIT-licensed PDF and current systematic-study fixture. Updated both READMEs, notices, examples, metadata and regression coverage.

---

## v0.2.0 · 2026-09-20

相对于上一公开版本 `v0.1.0-beta`，本次更新包括：

### 新增能力

- 学习页、讲解、Markdown 和可复制的提问口令可跟随当前请求使用中文或英文；仓库提供独立的英文和中文 README。
- 新增可积累的方法论库：从材料中保存带版本和出处的方法卡，并可在用户指定的材料之间检索、比较。
- 新增整份材料的方法论视图，展示框架、行动规则、前提、分支、对比和反馈；可复制口令，让 AI 结合自己的问题应用整套方法论。学习页本身不会联网调用 AI。
- 核心框架和方法论增加关系图，与原有卡片视图配合使用；连线解释保留出处，支持缩放、查看全图、键盘操作、窄屏阅读和较长文字。

### 出处核验与交付

- 系统学习增加逐单元行动规则账本，并复核两张关系图中实际展示的关系，以便追查规则与连线的来源。
- 系统学习 PDF 增加原文标题索引核验，检查学习页展示的章节路径和页码范围。
- 交付前先在暂存目录验证完整文件包，再发布结果；新增方法论、关系图、出处核验和页面交互的示例与回归检查。

### 兼容性与边界

- 已生成的旧学习页仍可阅读。重新交付使用 v1 账本的旧系统学习知识库时，需使用文档说明的兼容选项，或按新版要求重新复核。
- `v0.2.0` 仍是预稳定版本。结构和出处检查不能代替人工对原文及其解读的复核。

---

Compared with the previous public version, `v0.1.0-beta`:

### Added

- English and Chinese learning pages, explanations, Markdown output, and copyable prompts that follow the language of the current request, plus separate English and Chinese READMEs.
- A reusable method library with versioned, source-linked method cards that users can search and compare across selected materials.
- A whole-material methodology view for frameworks, action rules, prerequisites, branches, comparisons, and feedback. Readers can copy a prompt to apply the methodology to their own problem; the page does not call an AI service.
- Framework and methodology relationship maps alongside the existing cards, with source-linked explanations, zoom and overview controls, keyboard support, and layouts for narrow screens and long labels.

### Verification and delivery

- Per-unit action-rule ledgers and reviews of the relationships actually shown in both maps for systematic-study deliveries.
- A reviewed index of original headings and page ranges for systematic PDF deliveries.
- Staged validation of the complete delivery bundle before publication, with new examples and regression checks for methods, maps, sources, and page interactions.

### Compatibility

- Existing learning pages remain readable. Re-delivering an older systematic knowledge base with a v1 ledger requires the documented legacy option or a new review under the current rules.
- This remains a pre-stable release. Structural and source checks do not replace human review of the material and its interpretation.
