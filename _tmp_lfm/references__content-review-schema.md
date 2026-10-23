# 来源优先的分阶段内容复核契约

1.04 新系统学习使用下节的 `content-review-v3`，其基础是 1.03 的分单元／全局复核：章节稳定后先读原文、再核对章节成果，整合完成后另行复核全局。当前执行者分别完成编写与第二遍回读，使用 executionMode: sequential，如实记录同一身份；不将分阶段回读称为独立执行者审核。后文保留的 v1/v2 契约用于明确兼容，不能替代新任务的结构审核。

脚本只计算依赖、验证证据和组装**已经由回读者写好的记录**。不得通过复制哈希、批量补 `supported`、根据旧摘要倒推复核结论来使门禁通过。身份字段记录实际任务身份，新任务不分派其他审阅者；身份字段只记录实际执行者。历史 parallel 记录按其原身份契约兼容验证。

## 1.04 新交付：v2 单元复核与 v3 全局内容复核

新系统学习使用 `unit-record-v2`，并要求 `unit-content-review-v2`。保留下文 v1 单元复核的所有字段与证据检查，增加 `structureReview`：

```json
{"frameworkReviews":[{"candidateId":"fc-1","status":"supported","note":"实际核对的用途、合并条件和去向"}],"relationReviews":[{"candidateId":"rc-1","status":"supported","note":"实际核对关系及处置"}],"omissionSearch":{"sourceIds":["s01"],"note":"先读原文发现结构，再对照候选；说明实际发现","evidence":[{"kind":"text","sourceId":"s01","quote":"原文连续短引"}],"findings":[]}}
```

候选复核分别恰好覆盖单元内全部框架／关系候选，包含排除项；状态为 `supported/revised`。查漏 `sourceIds` 覆盖本单元所有 covered 来源；有发现时逐项记录 `{id,note,candidateIds,status}`，`status` 只有实际解决后才为 `resolved`。没有发现允许空数组，但搜索说明及原文证据不能自动生成。v2 记录与 v2 单元复核必须匹配；单元快照包含完整新增字段。

`content-review-v3` 保留下文 v2 的全部根字段与真实 `globalReview`，新增 `structureReviews` 数组，必须恰好包含 `correctness` 和 `omissions` 两种 `structure-review-v1`。完整字段见 [relation-ledger.md](relation-ledger.md)。当前执行者顺序执行全局和两项结构复核，分别保存真实判断，不冒充独立审阅者。

结构复核绑定全部候选、实际边、搜索范围和方法论情境。新增 `relation-ledger.json` 纳入最终指纹；来源、证据、候选、处置、条件、方向或方法论改变使对应审核失效。不得删除新版文件／版本字段回退旧门禁。旧 v1/v2 复核继续按原契约验证，重新交付使用显式兼容模式，不能自动授予新版审核。

`unit_review.py assemble` 增加可重复参数 `--structure-review work/reviews/correctness.json --structure-review work/reviews/omissions.json`；只组装实际编写的记录。快照命令仍只计算依赖。

## 1.03 章节复核：可在全书组装前完成

每章保存在独立的工作文件中，形状如下。`unitReview`、`claimReviews`、`ruleReviews` 和 `enumeratedLists` 内部字段沿用本文后半部分的 v1 证据格式。

```json
{
  "schemaVersion": "learn-from-materials/unit-content-review-v1",
  "unitId": "u01",
  "executionMode": "sequential",
  "authorId": "当前实际执行者 ID",
  "reviewerId": "同一实际执行者 ID",
  "reviewedInputs": {
    "record": "完整章节记录的 sha256",
    "sources": {"s01": "真实来源切片及定位元数据的 sha256"},
    "methods": "与本章节点或来源关联的方法卡集合 sha256"
  },
  "sourceFirst": {
    "status": "completed",
    "sourceIds": ["s01"],
    "note": "先阅读来源范围及清单、条件和例外，再核对完整章节说明、实体和主张；记录实际发现。"
  },
  "unitReview": {
    "unitId": "u01", "status": "completed", "sourceIds": ["s01"],
    "findings": "回读发现、修改结果或具体的无需修改说明；也核对章节案例、术语、框架、学习重点及关联方法卡。",
    "evidence": [{"kind": "text", "sourceId": "s01", "quote": "对应来源中的连续短引"}]
  },
  "claimReviews": [],
  "ruleReviews": [],
  "enumeratedLists": {
    "status": "searched", "sourceIds": ["s01"],
    "note": "实际检查过的编号、步骤、分类、数量与跨页延续情况。",
    "lists": []
  }
}
```

以上空数组只是结构示意，不能代替实际复核行。`claimReviews` 与 `ruleReviews` 必须逐一对应本章所有主张和可见规则。清单有几项就记录几项，跨页延续必须完整。新记录的 `executionMode` 固定为 `sequential`；作者与回读者如实记录同一身份。历史 parallel 记录按原身份条件兼容校验，不支持新任务分派。章节记录的行动规则搜索状态也须在冻结前据实完成，之后修改会使章节快照失效。

局部依赖包含：

- 完整 `unit-record`，包括正文叶子、案例等四类说明、全部主张、行动规则与候选去向、框架、术语、学习重点和来源处置；只比较页面摘要不足以保护完整章节。
- 该章所有被分配来源的实际文字切片、内容哈希和定位元数据，包含有理由的非内容块。局部指纹不使用全书文件哈希，因此其他章节改变无需迫使本章重新回读。仅因前文插入导致字符偏移改变、而实际段落和来源定位保持相同，不算本章内容改变；最终全局依赖仍会失效。
- 与本章框架／规则 ID 或来源块关联的完整方法卡及其库命名空间。跨章方法卡还把它引用的其他来源块纳入回读依赖。`sourceFirst.sourceIds` 须覆盖这些依赖和所有分配来源；`unitReview.sourceIds`、清单搜索范围和主张／规则证据仍遵守本章 `covered` 来源的所有权。

未完成全书方法库时，可用 `--methods` 提供符合 `methods-v1` 的本章方法库片段；若方法库尚不存在，快照记录空关联。后续新增或改写关联卡片会使本章记录失效，必须检查变更并重新复核，不会因早期已完成就自动沿用。无关方法卡变化只影响全局记录。

```text
python scripts/unit_review.py snapshot --unit-record work/units/u01.json --knowledge-base topic.learnkb
python scripts/unit_review.py check --unit-record work/units/u01.json --knowledge-base topic.learnkb --review work/reviews/u01.json
```

`snapshot` 只输出 `record / sources / methods` 哈希，不创建复核结果。`check` 无需最终页面、全局账本或方法论已生成；它复用原有证据、来源所有权、每项主张／规则及封闭清单检查。

## 1.03 全局复核：最终整合后执行

规范 `content-review.json` 形状如下：

```json
{
  "schemaVersion": "learn-from-materials/content-review-v2",
  "pageId": "与最终 page.meta.pageId 相同",
  "learningDepth": "systematic",
  "executionMode": "sequential",
  "unitReviews": ["这里嵌入每章完整复核对象，不是路径字符串"],
  "globalReview": {
    "schemaVersion": "learn-from-materials/global-content-review-v1",
    "reviewerId": "实际整合回读者身份",
    "status": "completed",
    "reviewedInputs": {
      "inputs": {"page": "sha256", "source_map.json": "sha256"},
      "unitReviews": {"u01": "该章完整复核记录的 sha256"},
      "crossUnitRelations": "实际跨章边及方向、属性、归属的 sha256"
    },
    "checks": {
      "coverage": {"status": "completed", "note": "实际核对全书范围、非内容处置、覆盖和清单遗漏的结论"},
      "crossUnitRelations": {"status": "completed", "note": "核对实际跨章关系、方向及材料／推断归因"},
      "deduplication": {"status": "completed", "note": "核对重复概念及合并后含义和出处"},
      "methods": {"status": "completed", "note": "核对方法卡、适用条件、限制及其章节关联"},
      "methodology": {"status": "completed", "note": "核对整体方法论、单元覆盖及推断边界"}
    },
    "relationReviews": [{
      "relationId": "page:真实关系 ID",
      "status": "supported",
      "evidenceKind": "material",
      "note": "对这条实际跨章关系的独立判断；推断关系需解释推断边界",
      "evidence": [{"kind": "text", "sourceId": "s01", "quote": "涉及单元来源中的连续短引"}]
    }]
  }
}
```

实际 `unitReviews` 必须是对象数组，且恰好覆盖最终每个单元。主张、规则和清单 ID 要在全书唯一，不得合并时静默重命名。`inputs` 的完整内容用工具计算，包含最终页面、完整原文与来源映射、摘要／覆盖／行动规则账本、方法库、方法论、全部章节记录，以及存在时的章节依赖图。`relationReviews` 恰好覆盖最终页面 `relationships` 和整体方法论 `edges` 中实际跨单元的每条边：ID 前缀分别为 `page:` 与 `methodology:`。未提供虚构关系；没有跨章边时允许空数组，但仍写下检查说明。每条边核对方向、条件和归因，并提供涉及单元的真实来源证据；推断关系的 `evidenceKind` 保持 `inference`。

```text
python scripts/unit_review.py global-snapshot --page page.json --knowledge-base topic.learnkb --unit-review work/reviews/u01.json --unit-review work/reviews/u02.json
python scripts/unit_review.py assemble --page page.json --knowledge-base topic.learnkb --unit-review work/reviews/u01.json --unit-review work/reviews/u02.json --global-review work/reviews/global.json --output topic.learnkb/content-review.json
python scripts/content_review.py topic.learnkb/content-review.json --page page.json --knowledge-base topic.learnkb
```

可重复 `--unit-review` 提供所有章节；`--output` 写文件使用原子替换，未变化不重写。`global-snapshot` 也只计算依赖。`assemble` 只合并已有判断，验证不通过不输出成品。

最终校验还会将各章完整记录重新编译，并比较最终页面全部单元、框架、术语、规则和学习重点、摘要账本、规则候选与来源映射。方法卡投影按既有绑定器处理。直接修改成品页面或账本，再仅刷新全局哈希，仍然无法绕过局部一致性检查。所有局部证据和清单记录还会在全书真实来源范围下再次验证。

## 失效范围与限制

| 变化 | 需要重新复核的范围 |
|---|---|
| 某章正文、案例、实体、主张、规则候选或来源处置变化 | 该章与依赖该变更的单元，随后全局复核 |
| 某来源实际内容或定位改变 | 使用它的单元／跨章方法卡关联单元，随后全局复核 |
| 关联方法卡改变或新增 | 关联单元，随后全局复核 |
| 纯跨章关系、整体方法论或全局账本检查结论变化 | 全局复核；若改变了局部含义、出处或映射，也重做对应章节 |
| 无关单元变化 | 该单元及相关依赖，已证明依赖不变的其他单元无需重新回读 |
| 发布目录变化 | 不改变复核有效性 |

依赖不清楚时扩大回读范围。哈希只能证明同一输入，不证明语义判断正确或回读顺序真实；作者和回读者必须如实记录。局部与全局记录都不替代覆盖门禁、方法库／方法论校验或浏览器视觉验收。

## 1.02 兼容契约 v1

本契约用于 `systematic` overview 的第二遍回读。它补在覆盖审计、摘要账本和行动规则账本之后，不能由渲染器从成品摘要反推完成。最终器会拒绝缺少它、引用过期输入、漏掉页面主张或漏掉规则复核的新版系统学习交付。

## 工作顺序

1. 先固定 `page.json`、`source_map.json`、`full_text.txt`、`summary-ledger.json`、`coverage-audit.json`、`action-rule-ledger.json`、`methods.json` 和 `methodology.json`。
2. 按 `source_map.json` 的顺序重新阅读所有 `covered` 来源块。回读者先看来源，再看页面主张；不要复制现成摘要作为复核结论。
3. 对每个内容单元、摘要主张和可见行动规则写下判断及原文证据。证据可以是来源文本短引，或带 SHA-256 的页面/图像转录记录。
4. 搜索编号、步骤、分类、阶段、数量和“全部/仅有”等封闭清单。发现清单时记录原始顺序、总数和每项保留、合并或排除的去向；没有发现也记录搜索范围和原因。
5. 运行 `python scripts/content_review.py content-review.json --page page.json --knowledge-base topic.learnkb`，再运行 `finalize.py`。改动任一输入后必须重新回读并刷新记录，不能只刷新哈希。

## 精确结构

根对象只能包含以下字段：

```json
{
  "schemaVersion": "learn-from-materials/content-review-v1",
  "pageId": "与 page.json.meta.pageId 相同",
  "learningDepth": "systematic",
  "reviewedInputs": {"page": "sha256…", "full_text.txt": "sha256…"},
  "unitReviews": [{
    "unitId": "u01", "status": "completed", "sourceIds": ["s01"],
    "findings": "确认本单元的限定条件和一个未进入页面的例外。",
    "evidence": [{"kind": "text", "sourceId": "s01", "quote": "原文中的连续短引"}]
  }],
  "claimReviews": [{
    "claimId": "claim-001", "status": "supported",
    "note": "引文支持主张；范围只到本单元。",
    "evidence": [{"kind": "text", "sourceId": "s01", "quote": "原文中的连续短引"}]
  }],
  "ruleReviews": [{
    "ruleId": "rule-001", "status": "revised",
    "note": "补上前置条件和停止条件。",
    "evidence": [{"kind": "text", "sourceId": "s01", "quote": "原文中的连续短引"}]
  }],
  "enumeratedLists": {
    "status": "searched", "sourceIds": ["s01"],
    "note": "搜索了编号段、分类标题和明确数量。",
    "lists": [{
      "id": "list-001", "unitId": "u01", "expectedCount": 3,
      "countEvidence": [{"kind": "text", "sourceId": "s01", "quote": "三项"}],
      "countNote": "原文明确说三项。",
      "items": [{
        "id": "list-001-item-1", "order": 1,
        "evidence": [{"kind": "text", "sourceId": "s01", "quote": "第一项"}],
        "claimIds": ["claim-001"], "disposition": "retained", "reason": "页面保留原意"
      }]
    }]
  }
}
```

`reviewedInputs` 必须由 `content_review.py --fingerprints` 计算，且涵盖上述八个输入文件。发布时知识库输出目录改变不会使记录失效；正文、页面数据、账本、方法库或方法论改变都会使记录过期。哈希只证明“记录对应同一输入”，不证明复核者真的正确理解了输入。

1.02 新章节记录流程还将知识库中每个 `unit-records/*.json` 纳入同一指纹，保护完整章节说明与案例。最终器检查记录与页面单元一致，并从记录派生章节 Markdown。没有章节记录的旧知识库保持原有八项指纹契约；新数据不能借此兼容边界跳过记录或复核。

每个 `unitId`、`claimId` 和可见 `ruleId` 必须恰好出现一行。主张和规则只能是 `supported` 或 `revised`，不能把仍显示在页面上的内容标成排除。证据来源必须属于该单元，文本引文必须逐字出现在对应来源块中；视觉证据必须是知识库内的相对图片路径、文件哈希和人工转录说明。一个来源块可以支持多个连续主张，不要求一页只对应一条事实。

`coverage-audit.json` 的每个 `covered` 块必须列出已知 `mappedClaims`；内容复核会反向确认每个映射主张确实有证据。真正没有可提炼内容的块可以在覆盖审计中说明原因，但不能用空映射掩盖未读内容。校验器无法发现一个从未进入账本的全新遗漏，因此“全量”仍取决于逐来源回读和人的判断。

清单的 `expectedCount` 必须等于 `items` 长度，`order` 从 1 连续递增。`retained`/`merged` 项必须指向同一单元的可见主张；`excluded` 项不得指向可见主张，并必须解释排除原因。合并不是删除原文项目，而是记录它落入哪个已有主张。

## 语义和布局边界

该记录保存独立回读者的判断，但不是数学上的零遗漏证明，也不是模型能力证明。静态脚本能验证结构、来源范围、引文存在、文件新鲜度和清单去向，不能验证引文是否充分支持解释。不要生成“自动完成”的复核行来满足门禁。

内容复核不替代浏览器验收。`finalize.py` 的初始 manifest 固定为 `status: static-only`、`layoutCheck: not-run`、`visualReview: not-run`；无法运行浏览器时如实交付这一状态。若在获准的浏览器环境运行 `scripts/verify-layout.cjs`，它会检查三主题、390–2105 的断点矩阵、六个模块、调整大小返回和框架/行动图全屏前后几何，并生成独立报告。`scripts/record_layout_review.py` 只接受与 HTML SHA-256 相同且矩阵完整的报告，生成新的 `*.layout-reviewed.delivery.json/.zip`，不覆盖旧交付。自动几何通过仍不等于人工视觉可读性通过；截图须由人查看后才能另行下结论。

旧页面可用 `finalize.py --legacy-rule-ledger` 重新打包，但这只是兼容路径，不会把旧页面伪装成有独立内容复核的新版系统学习交付。
