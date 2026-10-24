# 测试案例：chapter1（AI Agent 入门，217 段）

这是第二个真实案例，用来验证「任意格式资料 → 六阶段学习」这条链路。

第一个案例是 `chapter4-d6eaed`（182 段，讲工具设计），路径已稳稳走完。
chapter1 的价值在于**规模更大、结构更散**：217 段、3.5 万字、25 个单元，
而且它是一章的「概念地图」，几乎全是定义与论证，例子只占三成 ——
这正好检验标注角色的分类是不是真的按内容判的，而不是按模板套的。

## 怎么跑

脚本在 `study-system/tests/` 下，按依赖顺序执行。
`D:/learn/.study/chapter1-940885` 必须已被导入（`segments.json`、`segment-texts.json` 存在）。

```powershell
$node='C:\Users\x\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'

# 1. 单元骨架（读原文、按标题切块、6 项自检）
& $node study-system\tests\build-units.mjs D:/learn/.study/chapter1-940885

# 2. 读前六段式 + 知识点回指原文
& $node study-system\tests\case-preflight.mjs
& $node study-system\tests\case-verify-preflight.mjs   # 校验：应 0 错误 0 警告

# 3. 逐段标注（三部分角色判定 + 生成 + 预算校验）
& $node study-system\tests\case-roles-1.mjs   # ¶1-¶91 的角色表（数据）
& $node study-system\tests\case-roles-2.mjs   # ¶92-¶150
& $node study-system\tests\case-roles-3.mjs   # ¶151-¶217
& $node study-system\tests\case-annotate.mjs  # 合成 annotations.json
& $node study-system\tests\case-check-highlight.mjs  # 检查是短语高亮，不是整段变色
& $node study-system\tests\case-render.mjs    # 渲染 HTML 自查

# 4. 知识点关系图（自动调 archify 出 3 张可交互 HTML）
& $node study-system\tests\case-relations.mjs  # 生成 relations.json（含 relationReview）
& $node study-system\tests\case-figures.mjs    # 经 service 生成 figures.json + graph-N.html

# 5. 读后自测 + 费曼思考题 + 参考资料
& $node study-system\tests\case-qa.mjs         # 16 道，题/答各 ≤100 字
# quiz.md / refs.md 是手写的，直接改文件
```

## 这个案例验住了什么

| 检查 | 结果 |
|---|---|
| 段落覆盖 | 217 / 217（一段不缺，缺一段脚本就报错退出） |
| 知识点回指原文 | 14 / 14，每条跳转目标都真实存在 |
| 三色预算 | core 2.47% ≤10%，hard 1.96% ≤8%，合计 9.69% ≤20% |
| quote 真实性 | 217 条全部逐字存在于原文（含代码块、表格、引用块、脚注） |
| 短语而非整段 | 整段变色 0 段，平均 quote 占段落 23.1% |
| 角色分布 | d:90 e:37 s:33 t:23 c:22 v:8 q:4 —— 定义为主，符合"概念地图"的性质 |
| archify 四道门 | 3 张图全部 validate/deliver/check/browser-check 通过 |
| 关系图证据 | 40 条边全部带原文 quote + 段号 |
| 全量回归 | 367 项 / 8 套件，0 失败 |

## 踩过的坑（别重犯）

1. **quote 不能"先规范化再比较"**。最初把括号标点一起抹掉再比，
   结果真实子串会失配、非原文的串反而可能通过。
   正确做法：只容忍空白差异，其余逐字比对。
2. **代码块 / 表格 / 引用块 / 脚注里没有"句子"**。
   想给它们自动摘一句，必然编出原文里不存在的 quote。
   这类段落要取原文真实短片段，绝不能造。
3. **碎片 quote（≤6 字）要拦**。写过「熔断器」「n8n」这种，
   覆盖率好看，用户点进去只看到两三个字，什么也拿不到。
4. **角色不能批量套模板**。第一版把没手工判的段落统统标成 `e`（例子），
   占了 169/217 —— 这不是分类，是凑数。改成 217 段全部手工判定。
5. **关系图的中间节点会害死布局**。一度加了 `organs`（大脑+眼睛+手脚）
   作为公式与三组件之间的中转，archify 直接报
   `composition/excessive-route-detour`：一条边绕了 3310px。
   原文 ¶9 自己说了那只是"换一种更直观的说法"，本就不该是独立节点。
6. **关系类型名要用契约里的**：`application` / `example-of` / `sequence`，
   不是 `apply` / `example` / `order`。这种自造近义词肉眼看不出来。
7. **`saveRelations` 只写 `{...graph}`**。传参时漏了 `relationReview`，
   落盘就少了它，校验器会说"缺少 relationReview"。
