---
description: "AI文档压缩提取的prompt模板，用于从目录中提取核心内容生成通用文档。支持PDF、Word、HTML格式，提取最核心通用的AI使用技巧，生成独立markdown文件并用双链组织内容。"
aliases: [文档压缩prompt, AI提取技巧, 批量文档处理]
type: 方法工具
status: draft
created: 2026-03-28
updated: 2026-03-28
---

```
请系统性地梳理我之前建立的科研文件和文件夹结构，按照从顶层到底层的层级关系进行清晰合理的整理。具体要求如下：
1. 首先对现有所有文件和文件夹进行全面盘点，记录其名称、类型及大致内容
2. 按照逻辑关系和重要程度，为整理工作制定详细的步骤计划，使用序号明确先后顺序（如：1.xxx，2.xxx）
3. 分析文件之间的关联关系，识别嵌套层级结构
4. 提出清晰的文件夹系统构建方案，明确各层级的命名规则和内容分类标准
5. 制定文件迁移和重组的具体实施步骤，确保逻辑清晰、操作有序
6. 提供最终的文件夹结构树状图，展示完整的层级关系和序号标识

请确保整个梳理过程步骤明确、逻辑清晰，便于我按照序号顺序逐步构建新的文件夹系统并迁移对应文件。
```

- **内容**：AI文档压缩提取模板：提取文档中最核心、最通用的AI使用技巧，生成独立文档。支持格式：PDF、Word、HTML。输出要求：每个子章节单独一个markdown文件，使用双链[[]]链接组织内容。适用场景：从大量文档中提炼通用方法论，创建独立的指令手册。
- **说明**：信息提炼的方法工具，帮助从海量资料中提取核心价值，构建可复用的知识库。
- **关联**：支撑 [[信息提炼方法论]]；延伸 [[Z4.02_信息提炼_Prompt]]；对比 [[传统文档阅读法]]。
- **位置**：向上追溯 [[Z4.02_信息提炼_Prompt]]；向下拆解 [[PDF解析技巧]]、[[双链组织策略]]。

%%
```
Extract the most core and universal techniques for better using AI assistance from the provided document. These techniques should be general and not necessarily specific to DeepSeek. Summarize these universal AI usage techniques into a standalone document. If the input contains compressed files, use appropriate decompression tools to extract their contents. Process documents primarily in PDF, Word, and HTML formats, ensuring comprehensive understanding of their content. Create a new folder specifically dedicated to storing this instruction manual on universal best practices for AI utilization.

你只给了目录 `d:\归档\DeepSeek使用技巧大全\通用AI使用技巧指南\通用AI使用技巧指南.md` ，看起来不太懂。补充具体的内容，每个子章节单独一个markdown文件，用双链[[]]链接， 内容参考之前 `d:\归档\DeepSeek使用技巧大全\通用AI使用技巧指南` 文档中的内容

```
TRAE IDE
参考：![[目录中的所有文件AI极度压缩输出通用文档.html]]