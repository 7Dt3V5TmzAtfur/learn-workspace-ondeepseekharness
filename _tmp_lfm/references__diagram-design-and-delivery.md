# Designed diagrams and complete delivery · 1.03

> **关系图数据门禁**：`scripts/verify_relations.py` 检查框架页实际可见的框架间关系边。无有据关系或独立框架由 `action-rule-ledger.json` 逐项说明；v2 账本还逐类复核两张图的关系。`finalize.py` 会阻断未经说明的空图或孤立框架。详见 `references/relation-gate.md`。

## Module ownership

- Core frameworks: cards on first open; Framework relationships toggles a collapsible framework-only mind map. Extract supported framework-to-framework relationships explicitly into relationships, not merely links from frameworks to action rules. Review actual dependencies, contrasts, membership and causal arguments. Frameworks with no recorded framework links remain visible; the missing link is not proof of independence in the source. Missing evidence is never permission to manufacture connections.
- Action rules: original action-rule cards, application button and one whole-material methodology flowchart. The whole structure stays together, with conditions, parallel relationships and feedback. A copied application prompt includes the canonical whole structure and saved method cards. The flowchart labels causal or hierarchical links as such; its display order is not an instruction to execute steps.

## Visual standard

For framework mind maps, prefer genuine cubic curves for **both tree branches
and cross-links**. Cross-links are not a reason to choose orthogonal routing.
Try one direct curve and up to 28 endpoint/arch candidates per visible relation
per layout; try at most two deterministic spacing reflows. Keep the layout with
the fewest unsafe relations. Reserve a bounded top arch corridor for same-row
cross-links. Check labels against cards, other labels and accepted curves, and
each visible curve piece against cards, labels and its own gap. Unresolved links
use obstacle-free orthogonal corridors with a local disclosure and a
`data-route-reason`. Inspect `data-curved-relations`, `data-orthogonal-fallbacks`,
`data-layout-passes` and `data-curve-candidates-per-pass` at acceptance. A nonzero
fallback count needs inspection, not deletion of an edge. Never invent hierarchy
or delete nodes/edges for appearance. Reuse unchanged measured geometry; reject
non-overlapping curve bounds before collision sampling. The methodology keeps
its established straight/orthogonal layout.

The goal is a readable, material-specific information graphic inside the reusable visual system in `references/visual-system.md`. Use a compact title, layered surfaces and enough room for the graph. Node numbers may be shown, but a number never stands alone: every numbered node always shows its title and type beside it, and relationship text names both endpoints ("覆铜板是 PCB 的核心组件 → 特种电子树脂的产品升级"), never "06 → 07". Names and relationship phrases must make sense without consulting another card. Color alone must not encode relationships.

Framework card and graph numbers must identify the same framework: both use its stable `sourceOrder`, while graph placement may change to clarify dependencies. Render double digits without a leading extra zero. Methodology graph numbering is local to that graph; action-rule card numbers refer to rules, so never imply that equal numerals across these two different sets mean the same item.

Keep node titles concise and precise. Core frameworks starts with cards. Its graph follows supported dependencies and groups disconnected branches separately. Before rendering, review framework relationships against the source: thickness classification and material generations, for example, can be independent dimensions rather than a part-of relationship. Add a common parent or shared outcome only when grounded, explicitly labeling synthesis. Never connect consecutive display positions merely to fill a gap. Describe any unsupported connection as unknown.

The framework relationship view is a mind map over the **same canonical frameworks and framework-to-framework edges** as the card view. Use existing framework nodes as layout roots without inventing a new node type. Arrange connected components compactly on the graph canvas. Keep frameworks with no recorded framework-to-framework edges in a source-ordered, initially collapsed list outside the canvas; search and keyboard selection open their source-grounded details there. If all frameworks are unlinked, show a short empty-relationship explanation without a large canvas. Do not reserve a tall island for each degree-zero node or create synthetic connecting lines. Display “暂未建立连线” / “No links recorded yet” as a graph-record status; source-reviewed absence reasons still belong in the systematic ledger. Folding hides descendants temporarily. Expand all must display every connected framework and every original edge, including cycles and cross-links; it does not unfold the unlinked list or add its cards to the canvas. All canonical frameworks remain available in the cards, search and optional outside list; relationship direction, type, explanation, evidence class and source survive the layout change. Never turn a cross-link into a new parent-child claim. Source order numbers stay identical to the cards. Node and edge labels are keyboard-focusable and expose the same source-grounded explanation on hover. Keep the complete relationship/source disclosure below the map, but do not add a large fixed detail panel. Search must list every match and allow any result to be selected. Node selection traces direct neighbors; selecting a link highlights its exact endpoints, without expanding to every link from the source. Provide collapse, expand all, fit width, zoom and fullscreen that fills the viewport. Measure actual card heights and display-font label widths after font loading; leave real wire gaps beneath labels and route foreign wires around labels, cards and fold controls with the shared routing helper. Enlarge the corridor rather than shrink all text. Only conflicts remaining after cubic candidates and bounded reflows may use diagnosed orthogonal lanes. Narrow screens keep readable card scale and horizontal scrolling. Dark regions use light text, while light regions use dark text. The map inherits the selected page theme's palette and typography.

Action rules opens with the original cards and application button; its switch reveals the graph. Remove any duplicated heading block, long introductory note and outcome quotation above the graph. Preserve the note, limits, synthesis labels and sources in the collapsed complete-structure disclosure and canonical methodology files. In the **methodology graph**, selection highlights neighbors and arrows and shows a compact list with full source/target names and the relationship. Detailed reasoning and sources remain hidden until an explicit Details action. Reset and Escape clear selection. Never populate a large detail card on initial load.

For the **methodology graph**, measure actual card heights after fonts load. Allocate columns from the graph's real branches and connected components; a one-column chain must not reserve three empty columns. Keep supported prerequisite, comparison, parallel and feedback edges without inventing branches for the sake of layout. The desktop graph viewport uses most of the available screen height while keeping a compact heading and toolbar. Its default **Fit width** keeps cards readable; **Overview** fits both width and height and may make long graphs too small to read, so selection and fullscreen remain available. Preserve the reader's focal point when using +/- zoom. Narrow screens retain a scrollable canvas.

For the **methodology graph**, default to straight links and necessary orthogonal bends, with contrasting arrowheads offset from card borders and reserved routing corridors. Next-row links use the open gap between cards; skipping or feedback links may use exterior lanes. Insert each relationship label into a reserved slot on its own straight segment. Leave visible wire on both sides; mask out the same slot on the static wire and selected direction cue. Keep all labels above all wires/cues in separate SVG layers, with an opaque theme-bound backing that remains opaque when unrelated edges dim. A label must not hide a foreign wire, junction, bend, card or arrowhead. Check clearance in both axes, including the canvas left boundary. Measure the actual display font, wrap long Chinese/English labels and enlarge a row gap or route into a clear exterior corridor when necessary; do not fall back to placing the label beside the wire. Preserve orthogonal return direction changes when simplifying routes. Do not use decorative curves unless the user requests them. Node cards show only number, type, title and a short summary: outgoing relationship rows duplicate the line labels and should not be rendered there. Preserve every canonical edge; full endpoint names, relationship wording, reasoning and sources remain in hover, keyboard focus, click details and the complete-structure disclosure. Line labels are focusable and support Enter/Space selection. Do not solve clipping by shrinking all node text or forcing the whole graph into Overview scale. Measure actual card heights before placing rows and routing arrows. Methodology evidence class retains its established color plus text treatment: source evidence, inference and feedback use solid lines in distinct themed colors. In the **framework mind map**, a solid line with evidence label denotes a material link and a dashed line with explicit inference label denotes a supported interpretive link. Only Sea Salt, Ink Wash and Bamboo Moon appear in the UI; their legacy storage IDs are documented in `references/visual-system.md`.

Run `node --test scripts/tests/test-framework-layout.cjs scripts/tests/test-graph-labels.cjs scripts/tests/test-methodology-language.cjs` for deterministic geometry/state and bilingual detail checks; these DOM doubles do not verify browser paint, contrast or pointer placement. For visual QA, inspect at least one real long-title/branching material and one feedback-loop material at desktop and narrow widths. Include a true one-column chain, disconnected branches, and several outgoing edges. Check that line labels are centered and readable, cards have no duplicated outgoing list, label focus opens full endpoint details, and taller cards leave intact row spacing and arrow clearance at ordinary and enlarged browser text sizes. Check module ownership, initial cards, graph/card toggle, long titles, line/card intersections, node selection, Fit width, Overview, centered zoom, fullscreen exit, reduced motion and the application prompt. Both graphs must fill the viewport in native fullscreen and in the fallback overlay; Escape exits the current fullscreen state and restores page scrolling and focus. In Fit width, check that columns fit on desktop and that narrow screens can scroll at a readable scale; Overview may make long graphs too small to read. A static syntax check alone cannot establish visual quality. Report any unperformed browser checks accurately. Do not install browser dependencies without authorization.

For long hover explanations, position the floating detail once against its node. Keep the node-to-panel transit corridor active so a slow or diagonal pointer move does not close it. Only begin a short close delay after the pointer leaves the node, corridor and panel; re-entry cancels it. The panel remains scrollable, selectable and stationary. A scrollable relationship list consumes wheel distance first, then the floating panel; discard any remaining distance at the panel's top or bottom. Repeated wheel gestures inside it must not move the canvas or page. Preserve Ctrl/Meta zoom gestures, horizontal/Shift scrolling and line/page deltas. The page behind a fullscreen graph stays still. Check framework and methodology hover details separately, including narrow screens and fullscreen, before and after moving the pointer outside the panel.

Both shared renderers expose `refresh()`. Use `framework-routing.js` and `relationship-mindmap.js` for the framework map; preserve sourceOrder, canonical IDs and evidence through panel/theme/fullscreen changes. Do not patch individual book HTML.

## Direction cues and state

Both graphs use `graph-motion.js` and retain clear, solid-filled target arrows
when motion is disabled. Base wires keep their existing evidence styles: framework material links are
solid and inference links dashed; methodology evidence classes retain solid
lines in distinct themed colors. The methodology's optional first-view entrance changes
opacity only; it never borrows the wire's dash pattern. Idle, unselected maps
have no continuous animation.

- Hover or keyboard focus plays one direction pass on related visible links.
- Selecting a node/edge gently repeats its directed links while selected. A
  per-map **Show directions / 方向演示** toggle opts into whole-map batches. At
  most three visible relations play together, with a 2.8-second cycle; selected
  sets/demo groups rotate instead of moving all wires.
- `contrasts`, `parallel`, comparison and explicitly undirected relations use
  synchronized static emphasis, never an invented one-way traveling cue.
  Other arrows follow recorded `from → to`, including feedback and membership;
  membership direction expresses ownership, not invented execution order.
- Cues duplicate exact geometry. Split framework pieces play sequentially from
  source to target, even when the layout tree points the opposite way. Labels
  paint above cues; masks/gaps match the base.
- Global motion off and system reduced motion immediately cancel animations
  and timers, retaining complete static wires/arrows/labels. Hidden documents,
  hidden panels and offscreen viewports pause cues. Selection/demo choice
  survives a temporary pause. `destroy()` or removing the graph cleans up helper
  resources. Browsers without Web Animations retain the complete static map.

Rules that must not regress:

- **The cue rides a second path, never the wire.** `.diagram-flow` and `.lfm-mm-flow` duplicate their base exactly. The short dash starts before the source and moves along increasing path distance past the target. Repeat belongs to the lifecycle scheduler, not infinite CSS animations. Preserve original edge IDs and evidence.
- **Measure geometry AFTER insertion.** A detached SVG path can report a bogus `getTotalLength()` in Chromium. Append first, measure, then configure travel. Split pieces share duration in source-to-target order.
- **`layout()` rebuilds every path, so it must re-arm and re-settle the state itself.** A freshly rebuilt wire may otherwise stay hidden after a tab switch, zoom, font load or resize. `layout()` ends with `armDraw(); settleWires();`; once the entrance has happened, rebuilding restores the static, fully drawn state without replaying the entrance.
- **`settleWires()` flips the class inside a `requestAnimationFrame`.** This separates path replacement from the final wire state and prevents an invisible intermediate frame becoming the final map.
- **Skip the rebuild when the panel reports `clientWidth <= 0`.** A `display:none` panel returns 0 for every descendant measurement. Guard with `if(viewport.clientWidth<=0 && !initial) return;` and read real numbers a frame later. After a panel becomes visible, a **double `requestAnimationFrame`** is the reliable point to call `refresh()`.
- **`IntersectionObserver` alone is not enough to report visibility.** Also respond to document visibility, canvas/page scrolling, panel changes and renderer refresh. Check both graph and viewport before scheduling a batch.
- **Reduced motion needs a composed still, not just disabled animations.** The terminal state is "every wire drawn, every arrowhead solid, nothing moving". The selected cue is gated in JS and CSS.
- **Preserve edge selection through layout.** A clicked edge keeps its exact ID during font load, theme/container refresh, Fit width, Overview and fullscreen. Rebuilding must not change it into a selection of every edge connected to the source node.
- **Expose `refresh()` from `mount()`** and refresh after a module switch. The shared navigation emits `lfm-panel-change`; each graph clears its portaled explanation and refreshes after a double animation frame. Keep ResizeObserver handling for hidden-to-visible and container-size changes. Returning a hook without calling it is insufficient.

## Theming and contrast

Every graph element is themed. `templates/graph-studio.css` declares a `--dg-*` palette; `templates/visual-finish.css` maps the three reader-facing themes to that palette, followed by the final liquid surface layer in `templates/liquid-finish.css`. Canvas, dot grid, card surface, title, summary, number, type tag, evidence/inference/feedback wires, arrowheads, controls, hover preview and detail panel change together. Theme-specific tokens and textures must survive the final shared glass layer.

Rules that must not regress:

- SVG gap masks use white/black as luminance instructions, not visible theme colors; keep their bounds large enough for the complete rerouted canvas.
- Never hard-code a graph colour in `graph-studio.js` or `graph-studio.css`. Arrowheads take their colour from the `dg-arrow-normal` / `dg-arrow-feedback` / `dg-arrow-inference` classes; a hard-coded `fill` on a marker path keeps a stale colour after a theme switch.
- Every arrowhead is a SOLID FILLED triangle (`M 0 0 L 10 5 L 0 10 Z` with `stroke:none`). Markers use `markerUnits="userSpaceOnUse"` and a 14–16-unit box (framework: 15). Keep the tip clear of the target card and label; inspect at the actual display scale. A stroked wedge can lose its interior at small sizes.
- Never use `!important` to pin a wire or button colour; it defeats the theme variables.
- Unrelated nodes stay readable. They dim through a weaker surface (`--dg-dim-*`) with `opacity: 1`; never reintroduce `.is-muted { opacity: .28 }` or any low-opacity fade. Focus is expressed by the selected node's border, ring and shadow plus highlighted wires.
- On a dark node or card surface, title and controls must be explicitly light. On a light surface, they must be dark. Test the chosen theme's actual contrast rather than inferring it from the legacy `dark` identifier.
- Node cards stay concise: number, short title, short summary and type tag only. Relationship labels belong on the connecting lines. Inputs, checks and full citations belong in the detail panel and hover preview, not on the node.

## Two views, one wording source

Action rules keeps the 方法论卡片 ↔ 方法论关系图 switch. The cards view shows all material-backed `decisionRules`; reusable cards may also be saved in `methods.json`. For new systematic pages, `action-rule-ledger.json` records every card's candidate evidence and node/independent placement. Do NOT render a second, numbered per-node card list that mirrors `model.nodes`: the graph's hover preview and locked detail panel already carry each node's full input/action/output/check/sources and expand its associated action rules. Every node's wording lives in exactly one place — `model.nodes`, rendered through the shared `describe()` function for both the hover preview and the locked detail panel.

## Canonical files and final delivery

Create source-grounded methods.json and methodology.json first. Their schema, source hashes, quotations and synthesis labels follow the existing method references. A missing canonical JSON is a content gap, not something the exporter can infer. An unsupported whole structure still gets a valid not-applicable record and explanation.

Run:

```bash
python scripts/finalize.py page.json --knowledge-base topic.learnkb --output-dir delivery --name topic-learning
```

The command validates both canonical files, binds them into a copied page, copies the knowledge base, exports patterns.md and methodology.md, checks coverage and static HTML, and writes a .delivery.json manifest with hashes and a ZIP. Source files stay untouched. A differing old derived Markdown is retained under history/. Use a new output name or directory for each release. A failed run has no complete manifest or final archive; correct the content and use a fresh destination. No fallback to a low-level rendering function or --legacy to bypass a failed new-overview gate.

The ZIP contains HTML, Markdown, page JSON, the complete knowledge base and the delivery manifest. The original PDF is not automatically added; say so or include the user-designated source separately when requested. The returned methodology.md and methodology.json paths are explicit so the user can save them in a knowledge library. Final response links must include HTML, ZIP and methodology.md rather than only saying files were generated.

The command checks artifact completeness, not whether every host model followed all instructions. On Windows, artifact publication retries a reported temporary file lock at most five times over one second, then stops and rolls back its own partial publication; it never overwrites an existing destination. Across WorkBuddy and other agents, put this final command in the main task checklist and inspect its returned paths before declaring completion.
