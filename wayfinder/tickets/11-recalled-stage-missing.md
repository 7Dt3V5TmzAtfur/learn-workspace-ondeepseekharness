# TICKET: `recalled` 阶段在状态机里不存在——study-recall 技能白写了

- **状态**: resolved
- **类型**: `task`（AFK — 已修复）
- **阻塞**: 无
- **所属**: [MAP](../../map/MAP.md)

## Question

我上一轮新增了 `study-recall` 技能和 `saveQa` 方法，但**状态机完全没跟上**：

```js
const STAGE_ORDER = ['ingested', 'planned', 'annotated', 'mapped', 'drilled']
```

没有 `recalled`。`nextStepOf` 从 `mapped` 直接跳到 `study-feynman`：

```js
if (!progress.mapped) {
  return { stage: 'annotated', action: 'study-map', message: '梳理知识点逻辑关系，生成衔接图' }
}
if (!progress.drilled) {
  return { stage: 'mapped', action: 'study-feynman', message: '读后考核：…' }   // ← QA 环节被跳过
}
```

后果：
1. `study-recall` 技能**永远不会被 `next.action` 提示**
2. 用户按 `next` 走完图谱，直接进考核，**从来不会被告知"该做 QA 自测了"**
3. 就算用户自己让 Agent 做了 QA，`saveQa` 只返回 `{docId, accepted, issues, count}`——**没有 `next`**，进度条不动
4. 界面上的"阶段进度"永远看不到 QA 那一步

## 为什么这是"设计不好"的典型

我不是没写功能，是写了功能但**没接入主干**。用户看到的结果就是"这个功能好像不存在"。

原则原文 `阅读流程_SOP.md` 和 `主动提取优于被动复读.md` 都强调：读后必须主动提取。QA 自测就是这一步。把这一步架空，等于整个流程缺了一环。

## 三个维度的思考

**维度一：状态机该有几个阶段**
实际学习任务是 6 步：
导入 → 读前 → 读中 → 图谱 → **自测** → 考核

其中"图谱"和"自测"都只依赖"读中"，理论上可以互换顺序。但按认知规律：
- 图谱帮建立结构（理解关系）
- 自测帮回忆细节（巩固记忆）
- 先理解结构再回忆细节更顺

所以顺序定为：`annotated → mapped → recalled → drilled`。

**维度二：怎么判定 recalled 完成**
和别的阶段一样，看产物文件：`qa.json` 里有 `items` 且非空。

**维度三：向后兼容**
现有 chapter4 项目 `qa.json` 是空的（0 条）。加上这个阶段后，它的 `next` 会从 `study-feynman` 变成 `study-recall`——**这是正确的**，因为它确实还没做 QA。

## Resolution

已修复（`lib/service.js`）：

1. `STAGE_ORDER` 加入 `recalled`：
   ```js
   const STAGE_ORDER = ['ingested', 'planned', 'annotated', 'mapped', 'recalled', 'drilled']
   ```

2. `nextStepOf` 在 `mapped` 之后插入 QA 环节：
   ```js
   if (!progress.recalled) {
     return {
       stage: 'mapped',
       action: 'study-recall',
       message: '读后自测：生成 6-12 条问答（每条≤100字），然后定一个明天的最小行动',
     }
   }
   if (!progress.drilled) {
     return { stage: 'recalled', action: 'study-feynman', message: '读后考核：合上讲义做费曼复述与练习' }
   }
   ```

3. `saveQa` 返回值加上 `next`，与 `saveAnnotation` 等保持一致：
   ```js
   return { docId, accepted, issues, count, next: nextStepOf(await this.store.progressOf(docId)) }
   ```

4. `progressOf` 增加 `recalled` 字段（读 `qa.json` 是否非空）。

验证：chapter4 现在的 `next.action` 应为 `study-recall`（它 qa 为空），而非之前的 `study-feynman`。
