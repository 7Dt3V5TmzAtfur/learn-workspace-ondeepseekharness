# 验证与性能记录

生成学习页、升级模板或修改交互时读取本文件。完整内容门禁每次执行；模板升级运行全面回归，每次材料交付仍检查当前材料实际布局和行为。检查结果只在代码、输入和相关配置均匹配时复用。

先验证代表章节格式，并提前试渲染密集图。自动几何、截图可读性和来源语义分别记录。框架图展开全部后的“关系数”按唯一规范 edge ID 统计，不把为标签留白而拆开的两段 SVG path 计作两条关系。全屏测量同时核对工具按钮没有被裁切；窄屏方法论默认缩放保持标题至少 12px 的显示尺寸，查看全图模式允许主动缩小。

1.04 新系统学习先完成 `relation-ledger.md` 的来源候选、颗粒度、双向图映射和 correctness／omissions 结构复核。运行 `verify_relations.py --require-candidates` 与 `content_review.py`，再用默认最终器交付。单元或来源变更、合并／排除决定变更、关系条件／方向变更均需按实际依赖回读，不得只重算快照。旧 1.03 交付使用显式兼容参数并标记旧契约，不能替代新版验收。

技能升级的回归同时包括新候选和发布门禁的正反例、概念型／无关系反例，以及当前执行者按现行顺序流程处理小材料的行为验收。实际行为记录与合成测试 fixture 分开；测试 fixture 内的审核断言只测试管线，不能当作任意材料的自动复核生成器。已通过且输入／代码／配置未变的检查无需反复重跑。

静态验证必须通过：

```bash
python3 scripts/verify_relations.py page.json --knowledge-base <主题>.learnkb
python3 scripts/verify_static.py <输出>.html
node scripts/verify-mindmap-data.cjs
```

`verify_relations.py` 是**断言式**关系图门禁，必须单独跑，不能指望渲染器顺带发现。它按页面真实可见的“框架→框架”子图检查空图和孤立框架；“框架→规则”不会被误算成可见连线。新系统学习页由 `action-rule-ledger.json` 记录合理独立的框架或确实无据的关系，并由 `finalize.py` 检查。`--allow-empty` 仅供未带账本的旧页面人工复核，不能替代新页面的有据说明。规则数量与弱解释仍会提示复核；参见 `references/relation-gate.md`。

若 Playwright 和 Chromium 已可用，再执行增强验证：

```bash
node scripts/verify-page.js <输出>.html
```

响应式布局和全屏几何可在获准浏览器环境运行：

```bash
node scripts/verify-layout.cjs <输出>.html <新报告>.json
python3 scripts/record_layout_review.py <交付>.delivery.json <新报告>.json
```

布局脚本只生成与当前 HTML SHA-256 绑定的自动几何证据，检查三主题、六模块、390/819/820/821/980/981/1024/1039/1040/1041/1440/2105 宽度、调整大小返回及两张关系图全屏前后状态。它不绕过浏览器权限，不替代人工查看截图；浏览器不可用时保留 `static-only` 结果，不声称视觉验收通过。

关系图连线动效的专项回归（静态 + 真机）：

```bash
node scripts/verify-diagram-motion.cjs <输出>.html              # 结构、主题纪律、动效契约
node --test scripts/tests/test-scroll-chain.cjs                # 浮片上下边界、内部列表、横向及缩放手势
node scripts/test-graph-hover-wheel.cjs                       # 两图接入同一滚轮路由
node scripts/verify-diagram-motion-live.cjs <输出>.html         # 首次绘入、切板块返回、三套主题
node scripts/verify-diagram-motion-live.cjs <输出>.html --rm    # reduced-motion 静止终态
node scripts/verify-methodology-page.cjs <输出>.html            # 卡片、思维导图全边与全屏、方法论模块
```

`verify-diagram-motion-live.cjs` 需要本机 Edge 或 Chrome（容器/CI 用 `BROWSER_PATH` 指定），只依赖 `ws`；加 `--shots <目录>` 可留现场截图。`verify-methodology-page.cjs` 需要已有的 Playwright。改动 `templates/graph-studio.*`、`templates/relationship-mindmap.*`、`templates/extensions.*`、`templates/methodology.*`、`templates/visual-*`、`templates/liquid-finish.css` 或 `templates/scroll-chain.js` 后，在允许使用的浏览器能力中复验，重点检查展开全部后的节点/连线数量、切板块返回、三套新主题、全屏、动效开关与浮片边界滚轮隔离。

关系图文字或布局改动后，还要在真实浏览器检查长中文关系名称、多条出边、交叉线、独立分支、窄屏和浏览器文字放大。框架思维导图展开全部后，画布节点集合应等于有有效框架间连线的端点集合，连线集合等于全部原始框架间关系；规范框架集合仍由画布与图外未连线清单完整覆盖，清单默认收起，搜索可访问全部框架，全无边时没有大型空画布；悬浮解释、折叠再展开、深色区域白字、三套主题及占满视口的全屏都要核对。方法论关系标签应在线段中央，支持点击与键盘详情，节点卡片不重复出边列表；长图的 Overview 缩小视图不要求每个字仍清晰。规则格式化改动后运行 `python3 -m unittest discover -s scripts/tests -p test_features.py`，检查中英文 HTML/Markdown 不重复“当/When”，且原始条件未变。关系标签或详情改动后，运行 `node --test scripts/tests/test-graph-labels.cjs scripts/tests/test-methodology-language.cjs`，检查中英文长标签、槽位避让、选择与重建状态、标点和原始出处。这里使用内存 DOM 与确定性字体度量，不能代替真实浏览器的视觉检查。无法运行浏览器时分别报告已运行的静态/行为检查，不宣称视觉验收通过。

浏览器验证未运行时如实说明；不得声称已通过。最终交付 HTML、同步 Markdown 和需要用户查看的知识库文件。


## 新版回归与计时

技能版本升级运行 Python 全套测试与 Node 实际渲染器、方向动效、来源提示和浮片滚动测试；新材料不重复执行与其无关且已有有效版本证据的模板测试。两图方向提示必须沿真实 from→to 路径，比较／并列不强加单向运动；动效关闭、系统减少动态、切换主题／模块、折叠／展开及原生／回退全屏均须保留完整线和箭头。

优先使用已有浏览器。Playwright 检查脚本可通过 LFM_BROWSER_CHANNEL 指定已安装的浏览器 channel，例如 msedge；找不到默认浏览器时不得自动安装。真正未运行的检查保持 not-run。

顺序任务与计时字段见 systematic-workflow.md。自然总耗时从预检开始至最终文件包验收结束；处理区间并集不等于纯计算时间，累计任务投入可能超过自然耗时。未记录空白保持未知，实际用量不可得时标明不可用。小样本、图形工程或热缓存结果只证明对应测试，不能外推整书速度。

## 验收固定版本与分层执行

开发期间只运行当前改动涉及的模块检查；进入正式验收前固定代码、规范材料／页面／KB、测试配置。每次模板升级仍执行完整 Python／网页回归和真实浏览器检查；普通材料交付执行完整内容门禁与当前材料检查，匹配的未变模板基线可复用。不要为了提速删除语义复核，也不要因文档修改机械地声称已重验全部材料。

```text
python scripts/pipeline.py freeze-acceptance --input WORK/page.json --input TOPIC.learnkb --input WORK/browser-config.json --output WORK/acceptance-snapshot.json
python scripts/pipeline.py check-acceptance WORK/acceptance-snapshot.json
# 执行本轮实际需要的内容、回归与浏览器验收
python scripts/pipeline.py check-acceptance WORK/acceptance-snapshot.json --output WORK/acceptance-check.json
```

输入与配置必须已经存在；快照与报告放在所有被观察目录之外。快照自动包含当前 skill 的全部发布文件，忽略运行缓存；记录文件增删及内容变化，失败返回非零，不自动修改规范内容、复核记录或测试状态。快照仅证明列明输入未变化，不证明复核真实发生。新增一次冻结使用新路径，保留旧尝试，不覆盖旧证据。最终器若会生成或改写 KB，先完成其确定性准备，再固定验收输入；验收后若发生变化，检查差异并按依赖重新验收，不能只刷新哈希。

`pipeline.py status/finish` 的 `stageMetrics` 汇总各阶段已完成／失败／未完成尝试、同任务重试次数、累计括号时间与阶段内区间并集。阶段并集彼此可能重叠，不能相加冒充自然总耗时；未知间隔和等待继续分别报告。它没有测量 CPU 时间或推断真实额度。

## 顺序入口与发行检查

验证直接提取、help／能力检查、旧 execution-choice 参数迁移提示、quick／systematic 完整交付、来源变化使复核失效，以及历史记录验证兼容。新组装不生成 parallel 执行记录。关系图中的 parallel 是材料并列关系，不能删除。

发行时运行 scripts/verify_release.py，校对版本、必要资源和已移除模块依赖；包内验证不替代真实内容回读或浏览器检查。计时报告 pipeline-report-v1 和新阶段记录 pipeline-stage-v3 保留失败、等待与尝试历史，不再输出智能体数量／峰值并发。
