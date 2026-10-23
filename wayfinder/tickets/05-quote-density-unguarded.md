# TICKET: 同段多条标注能把整段悄悄染色，而系统判为通过

- **状态**: open
- **类型**: `task`（AFK — 纯实现缺失）
- **阻塞**: 无
- **所属**: [MAP](../../map/MAP.md)

## Question

`validateAnnotation` 里有一个**写了但没接上**的数据结构：

```js
const quoteRanges = new Map() // segmentId -> [[start,end], ...] 用于检测片段重叠
```

它被初始化（第 87 行）、被写入（第 156-157 行）：

```js
if (!quoteRanges.has(item.segmentId)) quoteRanges.set(item.segmentId, [])
quoteRanges.get(item.segmentId).push([idx, idx + quote.length])
```

**然后整个函数体里再没有任何一次读取**（验证：`quoteRanges.values|forEach|entries` 匹配结果为空）。

注释说"用于检测片段重叠"，检测代码不存在。

## 后果链

1. `quote-too-long` 只判单条 quote 是否 ≥ 段落 90%（第 146 行）
2. 但它不管**同一段落被标了几条**
3. 于是一段 200 字，可以标 5 条 30 字的 quote，全部通过单条检查
4. 5×30 = 150 字 = 段落的 75%，**整段实际上被染色了**
5. 而三色预算的分母是**全文**（`totalChars`），只要全文没过 20%，这个段落无论怎么染都不会报警

结果：用户在界面上看到的仍然可能是"整段都是颜色"——正是他两次强调不要的效果，但系统的校验全程绿灯。

## 三个维度的思考

**维度一：注意力机制（用户视角）**
用户不要整段染色，不是讨厌颜色，是讨厌"颜色失去指示作用"。一段里 75% 都有底色，剩下的 25% 才是被"排除"的部分——这等于用一种更费解的方式做了整段染色。
所以判断标准不是"单条多长"，而是**这一段里被高亮的字占比多少**。

**维度二：数据结构**
要判"段内密度"，必须在 `validateAnnotation` 结束时按 `segmentId` 归并 `quoteRanges`：

```js
for (const [segId, ranges] of quoteRanges) {
  const segChars = 该段字数
  const merged = 合并重叠区间(ranges)      // 多条可能重叠，必须并集不是求和
  const covered = merged.reduce((s,[a,b]) => s + (b-a), 0)
  if (covered / segChars > 0.5) → error
}
```

注意 **必须做区间并集**：如果两条 quote 重叠，直接相加会把实际覆盖算多。

**维度三：规则约束**
阈值定多少？
- 0.9：形同虚设（现在的单条检查就够）
- 0.5：一段里最多一半字被标——合理，但可能误伤"整段都是要点"的定义段
- 0.35：接近原则原文「20% 高亮法则」的精神（不超 10-20%），但对单段落太严

倾向：**段内密度上限 0.5 给 error，0.4 给 warn**。理由：全文 20% 是宏观约束，段内 50% 是微观约束；两者独立，都要有。

同时补两个缺失项：
- **重叠检测**：两条 quote 区间重叠 → warn（说明标重了）
- **同段多标注**：同一 `segmentId` 出现 ≥3 条 → warn（这段被你切成好几块，可能该合并成一条）

## 要顺手一起修的

`quote-too-long` 阈值 0.9 → 0.35 并升级为 error（依据：原则原文 F9 加粗法要求"选中当前词/词组"，斜体高亮法要求"句→词两级"，都不是整句）。

但升级为 error 前要验证历史数据：chapter4 现有 37 条 quote 里有多少会因此失败？

## Resolution

（待填 — 需先统计历史数据受影响面）
