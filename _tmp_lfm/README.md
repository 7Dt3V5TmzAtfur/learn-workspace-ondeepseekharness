**English** · [中文](README_CN.md)
# learn-from-materials

![Icon](assets/icon.svg)

> Turn books, PDFs, slides, Word documents, web pages, and multi-file material sets into traceable knowledge bases, interactive learning pages, and Markdown derived from the same content data.

![Status](https://img.shields.io/badge/version-1.1.0-blue)
![Agent Skills](https://img.shields.io/badge/standard-Agent%20Skills-5b6ee1)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab)
![License](https://img.shields.io/badge/license-MIT-green)

`learn-from-materials` is a cross-agent learning skill built on the open Agent Skills specification. Systematic study emphasizes complete reading; a quick overview extracts the core argument. Both require verifiable sources, a strict separation between material facts and model-added content, offline-first operation, and least privilege.

It works in agent environments that can read files, run local commands, and recognize `SKILL.md` — such as WorkBuddy, Codex, Claude Code, and GitHub Copilot CLI. Pure chat environments without file-system access or Python execution can only use parts of the prompting workflow; they cannot perform material extraction, coverage validation, or HTML rendering.

<img width="2400" height="1600" alt="overview-en" src="https://github.com/user-attachments/assets/87ea840f-a4d2-43fb-a054-bf618e2269e0" />

## 1.1.0

A single sequential workflow extracts materials directly, without an execution-mode choice or choice file. Source-first unit records derive the page and readable units from the same data. Unit rereads and final correctness and omission/application passes retain actual evidence and dependency fingerprints.

This release adds relationship inventories, resumable checkpoints, acceptance snapshots and phase timing; improves framework curves, outside lists for unlinked cards, direction cues and source tooltips; and exports a standalone methodology Markdown at the delivery root. See [CHANGELOG.md](CHANGELOG.md) for cumulative changes and migration from the local 1.06 package.

## Key Features

### A Methodology That Spans the Whole Material

It starts by extracting the material's central question and its goal, then organizes the argument, frameworks and action rules into one complete structure. It supports the main flow, decision branches, causal and hierarchical relations, and evidence-backed feedback loops; it does not fix a step count and does not force every material into an eight-step process. The overview is not split into groups by node count, and selecting a node shows its inputs, actions, outputs, check conditions, related learning units and sources.

The whole structure is also saved separately as `methodology.json` / `methodology.md`, keeping what the source material itself does clearly distinct from the whole-material synthesis. "Apply This Methodology" carries the entire structure by default, letting the AI locate your entry point and advance you condition by condition; a single card can still be chosen instead.

Guided content shows source hints for core ideas, key points and conclusions on mouse hover and on keyboard focus, plus an expandable "Source" panel for touch screens. These stay available after switching units. When a verified fine-grained location exists, the matching page number is displayed; otherwise the unit-level or conclusion-level range is reported as-is.

See the [whole-material methodology protocol](references/whole-material-methodology.md), the [original three-page teaching PDF](examples/method-lab-synthetic.pdf), and the [systematic-study example](examples/overview-sequential-systematic.json). The example includes coverage, action-rule, content-review and original-heading records. Its short length is for demonstration and regression testing, not an extraction ceiling for real materials.

### An Accumulating Method Library

After parsing new material, reusable methods are saved to the knowledge base's `methods.json`, and a readable `patterns.md` is generated from it. Each card records purpose, prerequisites, limits, steps, effect checks, a short source quotation, a stable ID and a version; when a material contains no methodology, that is stated plainly rather than invented.

Page bindings and the method prompts are derived from that same data. Several method files you designate can be indexed cumulatively, candidate methods can be found by Chinese or English keywords, and comparison records can be exported. Original methods and earlier versions are retained; a synthesized method receives a new ID and an explicit parent-method reference, and never silently overwrites or blends into what the material actually meant.

See the [method library protocol and commands](references/method-library.md), the [example method file](examples/methods-demo.learnkb/methods.json), the [readable method cards](examples/methods-demo.learnkb/patterns.md) and the [demo page bound to a method library](examples/methods-library-demo.html). The earlier Chinese and English versions, the relationship maps and "Apply This Methodology" all remain available.

### Language and In-Page Interaction

- **Follows your language**: an explicit instruction comes first, then the current request and the conversation; Chinese and English are supported for body text, the interface, Markdown and copyable prompts. Original quotations and source names are preserved. Language is never guessed from nationality or browser locale, and existing HTML is never auto-translated.
- **Logical relationship maps**: core framework cards remain available and switch to a collapsible framework mind map with search, zoom and fullscreen. Hover or focus a node or link for its explanation and source; independent branches and cross-links retain the original relationships. Action rules still show the whole-material methodology graph.
- **Reader themes and motion**: new pages use Sea Salt, Ink Wash or Bamboo Moon with a compact horizontal layout, larger diagrams, readable floating explanations and an optional motion switch. Both diagrams retain their links when motion is off.
- **Apply This Methodology**: enter your question, goal and constraints, choose the whole structure, a specific method or automatic selection, and copy the resulting prompt into your material conversation. The prompt asks your agent to assess applicability before giving sourced analysis and suggested actions. The page does not run an AI itself.

- Supports PDF, EPUB, MOBI/AZW/AZW3, DOCX, PPTX/PPTM, HTML, Markdown, TXT, RTF, and multi-material collections
- Two learning depths: "Quick Overview" and "Systematic Study"
- Systematic study reads to the end and audits every method candidate's disposition; card counts do not establish completeness across books, papers, industry reports, slides and other materials
- Generates a traceable `.learnkb/` knowledge base, a self-contained interactive HTML page, and Markdown derived from the same content data
- Fine-grained source mapping for PDF pages, PPT slides, and EPUB chapters
- Produces core-framework, guided-content, glossary, action-rules, dynamic self-check, and local-notes pages
- Systematic study runs full coverage, summary mapping and reverse checks; quick overviews scan the complete structure and audit displayed citations. Both check source hashes
- Distinguishes material-backed facts, areas not covered by the material, model-added content, and externally verified items
- Offline by default with no automatic dependency installation; page notes, learner profiles, and wrong-answer records stay in the local browser only

### Framework Maps with Many Unlinked Cards

Connected frameworks appear in compact groups. Unlinked frameworks remain in source order in an initially collapsed list outside the canvas, with complete search and source-grounded details. An all-unlinked view has no large canvas; Expand all expands connected nodes and every original edge. All canonical frameworks remain available. Missing-relationship review still applies; an unlinked graph record does not prove independence in the source. No synthetic root or decorative edge is added.

### Learning Depths

| Item | Quick overview | Systematic study |
| --- | --- | --- |
| Content | Core arguments across the main sections, essential terms, conditions and limits | Read each source block and retain independent knowledge, arguments, evidence and methods as fully as possible |
| Source checks | Complete structure scan and displayed-citation review in `quick-audit.json` | Full coverage, summary ledger, rule/relationship ledger and phased source-first content review |
| Method files | Defensible core methods and an integrated structure | Methods and an integrated structure reviewed against the full material |
| Question bank | No exhaustive bank is prebuilt; inspect original questions in the selected scope when a quiz starts | Index questions through the systematic workflow |

Both depths share the six modules, Chinese/English support, three themes, contained hovercard scrolling, relationship maps and `finalize.py` delivery. `methods.json` is the method-card source of truth; `methodology.json` is the explicitly labeled integrated structure. Use the corresponding no-method/not-applicable status when the source does not support one. A quick overview does not establish exhaustive coverage. Upgrading preserves `pageId` and reusable content/method IDs, then completes the systematic records after review.

## Showcase

These 16 user-captured screenshots show the updated liquid-glass interface in paired English and Chinese views. This README uses the eight English images; [README_CN.md](README_CN.md) uses their Chinese counterparts. The [showcase image index](assets/showcase/README.md) maps both sets to the same eight views. Some maps are partial screenshots. These captures illustrate the design, not a browser acceptance report for this release; use the bundled HTML examples to try the current interactions.

The following examples show learning pages generated from three types of material, in order: a biography, a financial market outlook report, and a research paper. Each set of screenshots highlights selected sections of the same six-module learning-page format; it does not show every section of each page.

### 1. Biography — *Elon Musk*

The first-run guide introduces the modules and optional local learner profile. The generated page then moves from a material-level thesis to framework cards and their relationship map.

**First-run learning guide**

![First-run learning guide explaining themes, modules, sources, self-check and local notes](assets/showcase/01-onboarding.png)

**Systematic-study cover**

![Elon Musk biography learning-page cover with a central thesis](assets/showcase/02-musk-biography-overview.png)

**Core-framework cards**

![Elon Musk biography core-framework cards with stable numbers and brief explanations](assets/showcase/03-musk-framework-cards.png)

**Framework relationship map — partial view**

![Compact framework mind map showing connected groups, stable numbered nodes and inline relationship labels; partial view](assets/showcase/04-musk-framework-relationships.png)

### 2. Financial market outlook report — J.P. Morgan 2026 Mid-Year Outlook

This example shows that the same workflow can organize a financial outlook PDF into a systematic learning page. The guided-content view preserves PDF page ranges while separating a unit's core idea, key frameworks and action points.

**Systematic-study cover**

![Financial market outlook learning-page cover with a central thesis](assets/showcase/05-market-outlook-overview.png)

**Guided content with PDF page ranges**

![Market outlook guided-content unit with its PDF page range, core idea, key framework and action points](assets/showcase/06-market-outlook-guided-content.png)

### 3. Research paper — *Attention Is All You Need*

The paper example shows a research argument recast as a learning page and an explicitly bounded methodology map. The map screenshot is a partial view of the page, not the full graph.

**Systematic-study cover**

![Attention Is All You Need learning-page cover about Transformer sequence modeling](assets/showcase/07-attention-paper-overview.png)

**Methodology map — partial view**

![Attention Is All You Need methodology map with numbered Transformer reasoning steps](assets/showcase/08-attention-paper-methodology-map.png)

These screenshots demonstrate interface organization, not an independent verification of each claim, citation or generated conclusion. Source texts and screenshots remain subject to their respective rights holders; this repository does not include those original materials or their full generated results. Bundled Method Lab sources and knowledge bases are self-authored synthetic examples under MIT. For interaction examples, open the [synthetic systematic-study demo](examples/sequential-systematic-demo.html) or the [English feature demo](examples/features-en.html).

## Getting Started

### 1. Installation

**Install this 1.1.0 package:** extract `learn-from-materials-1.1.0.zip` and place the complete enclosed `learn-from-materials/` folder in your client's skill search directory. `SKILL.md`, `scripts/`, `references/` and `templates/` should sit directly inside that folder; avoid an extra nesting level. Back up an existing skill of the same name before updating. Reload or restart the client if it does not discover the new version.

Repository URL: `https://github.com/dmoshehun-prog/learn-from-materials`. The git examples below install the repository's default branch, which may differ from this ZIP; use the ZIP to install this release.

| Agent | User-level install directory | Example |
|---|---|---|
| WorkBuddy | `~/.workbuddy/skills/` | `git clone https://github.com/dmoshehun-prog/learn-from-materials.git ~/.workbuddy/skills/learn-from-materials` |
| Codex | `~/.agents/skills/` | `git clone https://github.com/dmoshehun-prog/learn-from-materials.git ~/.agents/skills/learn-from-materials` |
| Claude Code | `~/.claude/skills/` | `git clone https://github.com/dmoshehun-prog/learn-from-materials.git ~/.claude/skills/learn-from-materials` |
| GitHub Copilot CLI | `~/.copilot/skills/` or `~/.agents/skills/` | `git clone https://github.com/dmoshehun-prog/learn-from-materials.git ~/.copilot/skills/learn-from-materials` |
| Other agents | See your client's documentation | Place the full directory in its Agent Skills search path |

Codex user-level discovery uses `~/.agents/skills/`; see the [official skill locations](https://learn.chatgpt.com/docs/build-skills). Follow your installed client's documentation if its search paths differ.

If the target directory already exists, back it up yourself first — do not overwrite it directly. Cloud or hosted agents may not read local user directories; install through that product's skill import, sync, or project-level directory mechanism instead.

### 2. Use It in a Conversation

```text
Please use learn-from-materials to systematically study this PDF and generate a traceable knowledge base and a learning page.
```

```text
Give me a quick overview of this PPT, keep per-slide sources, and generate an offline learning HTML.
```

An explicit request for a quick overview or systematic study selects that depth directly. If no depth is specified, the skill asks once, then follows `SKILL.md`. Output follows the current request language unless you explicitly choose English or Chinese.

## Requirements & Compatibility

- Python 3.10 or later
- An agent that can read materials and the skill directory and run local Python commands
- Most formats can be handled with the Python standard library or system capabilities
- Node.js is used for optional JavaScript regression checks; Playwright and an existing browser are used for permitted browser verification
- Scanned PDFs and image-heavy slides require OCR or vision capabilities; when unavailable, affected ranges are flagged as unverified
- Long books, multi-material cross-analysis, specialized papers, and complex open-ended questions work best with long-context, high-reasoning models

Optional enhancements:

| Scenario | Optional component | Behavior without it |
|---|---|---|
| Text-based PDFs | `pdftotext`, PyPDF2, pdfminer.six, or macOS PDFKit | Falls back to the next available parsing path |
| Technical PDFs | Docling | Falls back to the text extraction chain and flags visual-review boundaries |
| Scanned PDFs | OCRmyPDF + `pdftotext` | Flagged as needing OCR/visual review |
| EPUB | ebooklib + Beautiful Soup | Falls back to the standard-library ZIP/HTML parser |
| DOCX | python-docx | Standard-library ZIP/XML parser preferred |
| RTF | striprtf | Falls back to basic text cleanup |
| MOBI/AZW/AZW3 | Calibre `ebook-convert` | No built-in fallback |

This project never installs these dependencies automatically. If you truly need them, install pinned versions in an isolated environment.

## Command-Line Tools

Run these commands from the skill root and replace angle-bracket placeholders with actual paths. On Windows, use an installed `python` or `py -3` in place of `python3`; commands are single-line for PowerShell compatibility. Scripts extract, bind, validate and deliver data; the agent still reads and authors the learning content.

### Check parsing capabilities

```bash
python3 scripts/extract.py --check
```

### Extract materials

```bash
python3 scripts/extract.py <material-path> --mode text --ocr auto --output-dir <topic>.learnkb
```

### Prepare Content and Canonical Method Data

After extraction, the agent reads the source and authors `page.json`, `<topic>.learnkb/methods.json` and `methodology.json`. Scripts do not automatically author them from the source text. Both depths use these canonical files and retain original quotations and exact locators.

Both depths bind the method files before completing their review records. Quick overviews then finish `quick-audit.json` against the final displayed content. See the [quick workflow](references/quick-workflow.md):

```bash
python3 scripts/methods.py bind --library <topic>.learnkb/methods.json --page page.json --knowledge-base <topic>.learnkb --output page-with-methods.json
python3 scripts/methodology.py bind --model <topic>.learnkb/methodology.json --page page-with-methods.json --knowledge-base <topic>.learnkb --output page-ready.json
```

For a quick overview, review all displayed citations in `page-ready.json` and save the audit before running:

```bash
python3 scripts/prepare_quick.py page-ready.json --knowledge-base <topic>.learnkb
python3 scripts/finalize.py page-ready.json --knowledge-base <topic>.learnkb --output-dir ./delivery --name learning-quick
```

A new systematic overview first authors unit-record-v2 with the [unit assembly workflow](references/systematic-workflow.md), derives the page with pipeline.py assemble, and records relation-ledger-v1 and the phased content review. After canonical binding it also needs the complete knowledge base, [`summary-ledger.json`](references/summary-coverage-schema.md), [`action-rule-ledger.json`](references/action-rule-ledger.md) and [`content-review.json`](references/content-review-schema.md). PDFs additionally need a [reviewed source-heading index](references/source-heading-index.md). Review records must match the final bound `page-ready.json`. Then run:

```bash
python3 scripts/finalize.py page-ready.json --knowledge-base <topic>.learnkb --output-dir ./delivery --name learning-systematic
```

### Delivery and Verification Boundaries

`finalize.py` binds canonical methods, validates the selected depth's source/coverage requirements, derives readable method files and packages the result. Outputs include `learning-quick.html` or `learning-systematic.html`, matching `.md`, bound `.page.json`, `.learnkb/`, `.delivery.json` and ZIP. `patterns.md` and `methodology.md` live inside the knowledge base; a standalone `<name>.methodology.md` is also delivered and placed at the ZIP root. Choose an output directory outside the source knowledge base; existing deliveries are preserved, so use a new name when regenerating.

Bundles retain the original extraction text, source maps and safety/performance reports. Rebuildable extraction caches remain in the source working directory. On Windows, choose short working and output paths when a path-length error occurs.

`render_page.py --check-only` preflights already-bound data; the renderer also supports topic/unit pages. Standalone rendering is not a complete overview delivery. `--legacy` and `--legacy-rule-ledger` apply only to explicitly requested old-page regeneration/re-delivery, not to new material.

Initial manifests are `static-only` with `visualReview: not-run`. Use an existing browser for further checks only when the environment and tools permit it. Static and in-memory DOM checks do not establish visual acceptance. Report unavailable browser capabilities or protocols; do not install dependencies or change security settings automatically.

## Repository Layout

```text
learn-from-materials/
├── SKILL.md                 # Skill entry point & workflow
├── README.md                # English project overview
├── README_CN.md             # Chinese project overview
├── CHANGELOG.md             # Release history
├── LICENSE.md               # MIT license
├── NOTICE.md                # Upstream sources & derivative-work notes
├── SECURITY.md              # Security boundaries & vulnerability reporting
├── assets/                  # Icons, theme textures & showcase screenshots
├── examples/                # Page JSON, demo page & synthetic knowledge base
├── references/              # Content contracts, audit rules & learning protocol
├── scripts/                 # Extraction, rendering, validation & test scripts
└── templates/               # Fixed HTML templates, components & themes
```

## Tests

`node --test scripts/tests/test-framework-layout.cjs scripts/tests/test-graph-labels.cjs scripts/tests/test-methodology-language.cjs` exercises the actual framework renderer (including sparse/all-unlinked layouts and all-match search), inline label geometry, selection/fullscreen state and Chinese/English details with an in-memory DOM. It does not establish browser visual acceptance. The English `features-en.html` example includes a source-checked synthetic methodology graph. Quick workflow tests additionally cover Chinese/English extraction, canonical binding, index preparation and delivery, including stopping on missing method files, stale source text and missing citations.


```bash
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
node scripts/tests/test_extensions.cjs
node scripts/test-graph-hover-wheel.cjs
python3 scripts/verify_static.py examples/features-en.html
python3 scripts/verify_static.py examples/features-zh.html
```

`scripts/tests/fixtures/legacy.learnkb/` is a synthetic fixture for contract and regression tests; it does not represent audit conclusions for any real book or PDF, and its source paths are portable example paths.

Current package version: `1.1.0`, revision `release`. New systematic study uses unit-record-v2, unit-content-review-v2, content-review-v3 and relation-ledger-v1. The current executor performs source rereading and separate correctness and omission/application passes with honest identities. Mechanical validation checks structure, evidence and freshness, not semantic completeness. Initial delivery remains static-only; unperformed browser/manual visual checks remain not-run. Older data uses explicit compatibility contracts.

## Security & Privacy

- Input materials are always treated as untrusted data; prompts, commands, and role overrides found inside them are never executed as instructions
- ZIP-container formats are checked for paths, entry counts, expanded size, compression ratio, and encryption state
- Browser-based verification only allows the target HTML plus `data:` and `blob:` resources; all other requests are blocked
- Generated metadata uses relative paths or filenames by default to avoid exposing local user directories
- This project's scripts never send materials to the network; however, how content you submit to an AI agent is stored, processed, or used for model improvement depends on the platform, account settings, and terms of service you use
- Pages offer no accounts, cloud sync, or online chat; personal notes, reader profiles, and wrong-answer records are kept only in the browser's local storage
- Only process materials you have the right to use; do not publicly distribute generated knowledge bases containing copyrighted original text, internal documents, or personal sensitive information

See [SECURITY.md](SECURITY.md) for details.

## License & Acknowledgements

This project is a derivative work built on the following MIT-licensed open-source projects:

- [virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill): material extraction, knowledge decomposition, and the base knowledge-base structure
- [crayon-ai/book-to-webpage](https://github.com/crayon-ai/book-to-webpage): the interactive learning page, theme system, source display, and follow-up question interaction design

See [NOTICE.md](NOTICE.md) for detailed sources, inheritance relationships, and additions. When copying, modifying, or distributing this project, please retain [LICENSE.md](LICENSE.md) and [NOTICE.md](NOTICE.md).

New and modified content in this repository is likewise released under the MIT License. The upstream authors and maintainers do not endorse this project's subsequent extensions.

1.1.0 retains the glass finish, three themes, local storage and stable page/method IDs. Framework maps use curve-first routes and outside lists for unlinked cards; methodology keeps straight/orthogonal routes. Sources, direction and evidence classes remain bound to canonical data.

## Citation language, layout and scanned PDFs

- English pages display translated citation labels while keeping original citations, quotes and page/source identities for verification. `sourceLabels` is presentation data, not evidence replacement. Translated chapter names are not asserted to be official edition titles.
- Long English navigation and card text wrap or receive enough space; prefixes are supplied once. Check actual browser layout at normal and 200% text/zoom.
- Scanned PDFs need text-recognition capability, not a mandatory OCR installation. Existing OCR or model vision can be used when the actual page images are available. Preserve page-level transcripts and uncertainty. No dependencies are installed automatically.
- `scripts/tests/fixtures/` contains compatibility and synthetic validation inputs. They are not production templates or proof that a real material was fully studied.

Check release structure and version consistency with `python3 scripts/verify_release.py`. See the [current sequential systematic example](examples/overview-sequential-systematic.json) and its [authoring project](examples/sequential-authoring/project.json).
