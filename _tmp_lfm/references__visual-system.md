# Learning page visual system · 1.0 release

Use this reference when rendering or changing the learning page. It applies to books, papers, reports, slides, documents, web pages and mixed material. Do not carry a source's title, figures or wording into the reusable template.

## Layout and modules

Keep the established six learning modules and their data contracts. Core frameworks opens as cards and offers one collapsible framework relationship mind map. Action rules opens as cards and offers one whole-material methodology flowchart. The cards and maps share canonical IDs, explanations, evidence classes and sources. Do not create a second relationship map beside a first one, or replace the original cards.

Use a compact opening title, horizontal module navigation, varied but readable card sizes, and canvases that occupy most of the available viewport. Remove redundant graph introductions and large empty areas above a map. Keep the title and graph controls compact; full reasoning and citations remain in the hover/focus explanation and complete-structure disclosure. Both maps fill the viewport in fullscreen.

## Framework maps with many unlinked cards

Use the current canonical framework-to-framework graph. Place connected components as compact groups on the canvas. List degree-zero frameworks in an initially collapsed, source-ordered disclosure outside the canvas, with keyboard-accessible details and complete search. With no recorded edges, show a concise explanation and the disclosure, without a large empty canvas. One card, many unlinked cards, a few connected groups, cycles and dense cross-links all use the same reusable renderer. Do not create a row or canvas card for each unlinked node. Presentation filtering preserves all canonical frameworks and all source-reviewed relation decisions; it never establishes source independence or removes knowledge.

Use a small “另有 X 个框架未纳入关系图” / “X other frameworks outside this map” disclosure for the degree-zero list; details may retain “暂未建立连线” / “No links recorded yet”. It describes the current graph's records, not a conclusion that the source's concepts are independent. A component root is an existing framework chosen for layout; keep the normal framework type and stable number. No synthetic root, edge, grouping claim or source coordinate is written into canonical content. Systematic relation-review and reasoned absence gates still apply.

Measure inserted card geometry after fonts load; keep drawing heights consistent with measurement, including borders. Wrap Chinese and English labels with the actual display font and derive horizontal and vertical clearance from their dimensions. Each relation has a real gap around its chip, one target arrow and a separate label layer. Both branches and cross-links first try bounded cubic candidates and spacing reflows; only unresolved conflicts use orthogonal corridors, with a local explanation and count for acceptance. Detect foreign-wire, card and fold-control conflicts; do not hide another wire with an opaque label. Keep every cross-link and cycle on Expand all. Routing never changes evidence, direction or edge IDs. Methodology layout retains its established straight/orthogonal styling.

Search lists every matching title/summary with its original number and lets the reader select any result. Selection highlights a node's direct neighbors or an edge's two endpoints; unrelated card text stays readable. Clear and Escape remove the selection. Preserve the focal point during zoom, keep a readable minimum Fit width scale with horizontal scrolling on narrow screens, and recalculate after font load, resize, panel return or fullscreen. Hover placement should minimize overlap with visible cards and labels while keeping its transit corridor; if a small screen has no empty space, retain readable scrollable details rather than claiming zero overlap.

## Three reader-facing themes

The stored identifiers `warm-paper`, `minimal` and `dark` remain stable for existing page data; their reader-facing names and palettes are now **Sea Salt / 海盐云纱**, **Ink Wash / 黑白水墨**, and **Bamboo Moon / 竹月清**. `dark` is a legacy identifier for Bamboo Moon, not a request to paint the whole page dark. A dark card or other dark region still requires light text and clear controls. Keep the existing body and display fonts.

- Sea Salt: clear sea blue, cloud white and soft pale yellow with dark text. Blue is distinct without a dim page background.
- Ink Wash: predominantly white paper with gray and black ink; reserve deep ink for selection, navigation and small accents. Preserve visible dry-brush linework, flying-white texture and restrained paper grain. Do not turn the entire page into a black surface or cover text with a paper texture.
- Bamboo Moon: bright bamboo green, warm white and light tea gold. Do not darken the whole page.

All three themes must recolor the canvas, nodes, arrows, relationship labels, popovers, buttons and focus indicators together. Deepen identity colors on navigation, selected controls and graph lines while keeping paper surfaces light; increasing saturation must not remove Sea Salt's pale yellow or Bamboo Moon's tea gold. Source evidence and inference use text labels as well as color. Theme changes should repaint immediately, without a background transition that can freeze graph colors halfway.

The renderer loads compatibility theme files, component styles, `visual-finish.css`, then `liquid-finish.css`. The final theme-scoped tokens own the liquid palette; shared surfaces consume those tokens. Read `templates/themes/README.md` when changing this order. Do not append unscoped blue, black or white overlays that flatten all three palettes.

## Surface and motion

The current default is liquid glass: rounded navigation and cards, translucent color, soft highlights, a refractive lens and gentle organic decoration. Keep this preset adjustable when the user requests another style. Keep text contrast and graph line contrast clear. Inspect the composited surface, including opaque texture images: a paper image must not cover a dark card and leave white text on white paper. Backdrop blur on an opaque fill is not a translucent surface. Keep card numbering and full source display independent of decorative pseudo-elements. Provide an opaque fallback when blur or reduced transparency is requested. Use the bundled transparent ink-brush and paper-grain assets only as decorative material; embed them locally in the single-file HTML. Do not insert an unrelated illustration or make a source-specific image a required output.

Animate navigation selection, module entrance, card hover and disclosure opening gently. The page offers one motion switch, saved per `pageId`, and respects `prefers-reduced-motion`. Turning motion off cancels Web Animations and CSS transitions, settles disclosures to their latest requested state, and leaves both diagrams completely drawn. Both maps retain stronger static target arrows, give hover/focus one pass, and gently repeat selected directed links. A per-map direction-demo switch opts into batches of at most three visible relations. Unselected resting maps remain still. Symmetric contrast/parallel relations use shared static emphasis. The methodology entrance fades opacity while retaining its existing solid lines and evidence colors; framework material/inference links retain solid/dashed patterns. See `diagram-design-and-delivery.md` for the detailed direction/visibility/lifecycle contract.

## Floating explanations and scrolling

Node and edge explanations open on pointer hover and keyboard focus. Keep long explanations selectable and scrollable, inside the viewport and above enclosing panels. When a tooltip is portaled outside its graph, move it inside the native fullscreen element while that graph is fullscreen. A slow or diagonal pointer move from a node to the tooltip must stay inside a protected transit corridor. Preserve the explanation while it contains keyboard focus; hide it on Escape, module change or anchor disappearance. Node and relation-chip keyboard focus must reveal the same wording and sources as pointer hover.

Wheel distance passes only from a scrollable list inside the tooltip to the tooltip. Consume remaining wheel input at either boundary, including repeated wheel gestures; it must never scroll the diagram canvas or document. Scrolling the surrounding view resumes after the pointer leaves the tooltip. Support upward and downward movement, horizontal/Shift scrolling, line/page wheel units and trackpad deltas. Preserve browser zoom gestures. Fullscreen never scrolls the page behind it.

Floating detail field headings end in `：` for Chinese and `:` for English. Stack each heading above its value so narrow panels do not force headings into a tiny side column. Relationship metadata follows its endpoint names in full-width Chinese parentheses or ordinary English parentheses. Graph chips retain the concise relationship name without those metadata parentheses. The same `describe()` function supplies hover/focus and click details.

## Verification

Run `node --test scripts/tests/test-graph-motion.cjs` for shared cue semantics,
batch bounds, reverse direction, pause/resume, rebuild and cleanup. Run both
`test-framework-layout.cjs` and `test-graph-labels.cjs` against real renderers.
Record curve/fallback counts and inspect fallback explanations. In the browser,
check hover/focus once, selected repetition, opt-in demo, offscreen/hidden pause,
global motion off, system reduced motion, solid methodology evidence lines and
solid/dashed framework evidence patterns.

Run `node --test scripts/tests/test-framework-layout.cjs` against the actual framework renderer, including one/all-unlinked graphs, sparse groups, search results, cycles/cross-links, enlarged text metrics, narrow widths, themes and fullscreen. These in-memory checks are not browser visual acceptance. Use representative long Chinese and English titles and relationship labels, several outgoing relations, cross-links, separate branches, a long tooltip, all three themes and a narrow screen. Check inline label slots with intact connections on both sides, no foreign wire or arrowhead under the label, preserved edge selection after refresh, and language-appropriate colons and parentheses. Check centered line labels without repeated relation rows on methodology cards, label keyboard focus, and both tooltip boundaries after repeated wheel input. Check both graph views after tab switches, zoom, collapse/expand, fullscreen, source hover and motion off. Check native fullscreen and the viewport fallback, including Escape exit and scroll restoration. Confirm every original graph edge is present after Expand all. Check Sea Salt's yellow accent, Ink Wash's white/black texture and Bamboo Moon's green/gold contrast in a real browser when permitted; static checks alone cannot prove layout, contrast or hover placement.

## Bilingual reader layout

`templates/reader-layout.css` is loaded after the visual and liquid layers. Its content-sized tab widths, fixed-size number badges, normal-flow citation paragraphs and wrapping rules apply to both languages. It prevents legacy card/guide source pseudo-elements from producing a second overlay. Do not remove this final layer while keeping the older width/no-wrap rules. `source-presentation.js` owns citation display and idempotent condition prefixes; raw source attributes remain available for notes and evidence.

Browser acceptance must include long English text, at least desktop and narrow widths, 200% zoom/text, source disclosures, unit switching, graph details and fullscreen. CSS/static/DOM-double checks cannot confirm actual paint or clipping.
