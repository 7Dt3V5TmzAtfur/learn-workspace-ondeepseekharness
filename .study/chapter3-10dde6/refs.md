# 参考资料

> 来源标注：`原文`＝资料本身；`我的知识`＝模型已有认知（可能过时）；`联网检索`＝本次实际检索（附链接可回查）。

## 我的知识

1. Contextual Retrieval · （原文）
   - https://www.anthropic.com/engineering/contextual-retrieval
   - 用途：用来补：上下文感知检索的原始方案细节、前缀摘要的提示词写法与成本拆分、49% 与 67% 两个降幅的完整口径。原文脚注 [^ch3-1] 给出
2. Mem0 OSS v2 到 v3 迁移指南 · （原文）
   - https://docs.mem0.ai/migration/oss-v2-to-v3
   - 用途：用来补：Mem0 从 v2 写入时消歧到 v3 仅追加加混合检索的完整迁移说明，以及原文提到的 OSS 移除外部图存储与 relations 返回值这一改动
3. OpenViking · （原文）
   - https://github.com/volcengine/OpenViking
   - 用途：用来补：文件系统范式与 L0/L1/L2 三层上下文按需加载的真实实现细节，可与本章“选 Markdown 而非专用数据库”的论证互相印证
4. BAAI/bge-reranker-v2-m3 · （原文）
   - https://huggingface.co/BAAI/bge-reranker-v2-m3
   - 用途：用来补：跨编码器重排序的具体模型规格与多语言支持范围；原文在讨论双编码器/跨编码器对比时给出此链接
5. User as Code: Executable Memory for Personalized Agents · （原文）
   - 用途：用来补：可执行代码式用户记忆的完整设计与评测。注意：这是原文作者自己的论文（脚注 [^uac]），非第三方独立研究
6. User as Engram: Internalizing Per-User Memory as Local Parametric Edits · （原文）
   - 用途：用来补：多模态记忆写入模型参数的思路。同样为原文作者本人的论文（脚注 [^engram]），且该文 arXiv 编号 2606.19172 早于本章多处引用的 2026 年 4 月发布节点，引用时建议自行核对编号与日期

