# 快速了解执行路线

目标：核心导读，非全量知识整理。保留六大模块、主题、笔记、错题和详解按钮；生成新概览时使用共同的规范方法数据与 `finalize.py` 交付。

## 处理

1. 按 SKILL.md 确定输出语言与学习深度，由当前执行者顺序处理，直接使用 `extract.py` 的正常提取、安全检查和来源映射。在同一项目复用原提取目录与指纹缓存；原文未变不重复 OCR。缓存只复用文字提取，不代表模型已完成阅读。扫描件及关键图表仍可能耗时，未核验内容不得写成事实。
2. 扫描完整文件/章节结构，按章节或连续主题组记录 `structure`，覆盖全部来源块。每组阅读足够正文以确认主线、适用条件和重要反例；不能仅凭目录写结论。无法读取的组明确标注 `unreadable`，不编造章节导读。长材料分组读，不逐条穷举主张。
3. 生成一次核心内容 `page.json`。每个可读主要章节在内容导学中保留讲什么、核心结论与意义，核心条件与限制写入结论分点。术语仅保留理解页面必需的项；行动规则无依据则留空；自检只列核心考点，不预写题目、不预建 `question-bank.json`。现有有效题库可复用，不写 detection=none 冒充已检查。
4. 按共同的 `method-library.md` 与 `whole-material-methodology.md`，保存有依据的核心 `methods.json` 和 `methodology.json`。只整合本次核验的核心主线与关键条件；方法论的 coverage 对应页面内容单元，不是原材料全量知识覆盖证明。没有可复用方法时使用 methods 的 `status: none`；不能支持整体结构时使用 methodology 的 `status: not-applicable` 并说明原因。用下列命令绑定到派生 JSON，不重新撰写同一内容，也不手改最终 HTML：

```bash
python3 scripts/methods.py bind --library <主题>.learnkb/methods.json --page page.json --knowledge-base <主题>.learnkb --output page-with-methods.json
python3 scripts/methodology.py bind --model <主题>.learnkb/methodology.json --page page-with-methods.json --knowledge-base <主题>.learnkb --output page-ready.json
```

5. 对最终绑定的 `page-ready.json` 完成 `quick-audit.json`。覆盖所有展示出处，包括方法卡、整体结构及其连线、约束和细粒度出处。核对每个出处所支撑的全部内容（包含结论条件、数据、单位和限制），记录少量原文证据及来源 ID。证据摘录只用于后台核查，不大段转载到页面。脚本检查结构和摘录存在性，不能替代模型的语义核查。
6. 完成核查后生成轻量索引，再通过共同交付入口发布：

```bash
python3 scripts/prepare_quick.py page-ready.json --knowledge-base <主题>.learnkb
python3 scripts/finalize.py page-ready.json --knowledge-base <主题>.learnkb --output-dir delivery --name <材料>-quick
```

提取目录即知识库，保留原文、manifest、map、metadata、安全和性能报告。`prepare_quick.py` 从同一份已核对的内容派生 INDEX 和简要覆盖说明；`finalize.py` 再核验绑定数据与出处，派生 `patterns.md`、`methodology.md` 并打包 HTML、Markdown、知识库与交付清单。返回 HTML、ZIP 和 `methodology.md` 链接。新概览不使用 `--legacy` 或 `--legacy-rule-ledger`。

快速模式不要求 `coverage-audit.json`、`summary-ledger.json`、`action-rule-ledger.json`、`content-review.json` 或预建全量题库。不要为迎合系统检查创建空账本、伪造全量阅读标志。现有文件可保留，但它们不能自动成为本次完整阅读或复核的证明。记录实际总耗时与提取耗时，不能把提取性能报告当全流程测速结果。

初始交付清单仍是 `static-only`、`visualReview: not-run`。静态、来源和内存交互检查不等于真实浏览器视觉验收；浏览器复验仅在当前环境允许时运行。

## quick-audit.json

```json
{
  "schemaVersion": "learn-from-materials/quick-audit-v1",
  "learningDepth": "quick",
  "structure": [
    {"title":"第1章：主题", "sourceIds":["原source_map中的ID"], "status":"scanned", "note":"核心正文已核对，次要案例未展开"}
  ],
  "evidence": [
    {"source":"与绑定后page-ready.json中的source完全一致", "sourceIds":["原source_map中的ID"], "quote":"对应来源块原文中的短摘录", "checked":true}
  ],
  "limitations": ["核心导读，非全量知识整理；次要论证和案例未逐项展开"]
}
```

structure 按源顺序分组，所有 source_id 恰好出现一次，状态为 scanned/unreadable。扫描记录不声称精读每块。evidence 覆盖最终绑定页面中每个不同的出处字符串；ID 必须来自已扫描范围，短摘录需存在于所指来源原文。checked 只有人工/模型核对全部支撑关系后才能写 true。共享 source 的多个结论必须全部核对，不只检查摘录。limitations 使用输出语言写具体缺口。改动页面或规范方法内容后，重新绑定并核查受影响 evidence；原文引文与准确定位保留原样。

## 按需深入与升级

- 详解：按材料名、单元 ID 与出处定位回原文；当前页面只是摘要，不用摘要冒充完整原文。找不到材料则索要，不凭常识补齐。
- 测验：读取 question-bank-routing.md 与回答协议。已有题库未覆盖所选范围时，先查该范围原文中的练习、答案，再遵循原题优先；不为一次章节测验先索引整本书。后续可复用已核对题目，未检查范围不能标为无题库。
- 升级：沿用 pageId 和可复用单元/方法 ID，验证文件指纹后复用原文、页码映射与已核实核心内容；补全详细单元、题库和系统审计。首次从快速升级需要补齐依赖表及当前系统模式账本，不能声称已完成语义增量验证。系统模式须通过原有完整门禁。
- 输出文件保留来源材料标识；不把用户画像、笔记、错题写入共享内容数据。
