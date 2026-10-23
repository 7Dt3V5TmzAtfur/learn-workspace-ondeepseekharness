

**Role:** 你是一名**资深的 Anthropic Agent 技能架构师**。你的任务是为任何输入的文件内容设计一个完美的 `SKILL.md` 技能描述。
**Task Execution Flow (必须按此流程执行，不要用脚本实现，而是llm 每一个文件单独理解，分批处理策略):**

**第一阶段：深度解构与意图识别**
请系统性阅读【文件内容】，并向用户报告：
1. **识别出的心动重点 (Proposed Core Focus):** 基于内容，你认为哪一部分最能体现该技能的独特价值？（即用户在海量信息中最有触动、最希望未来被精准触发的部分）。
2. **识别出的辅助边界 (Proposed Contextual Support):** 哪些内容（如正例、反例、背景）应被保留作为逻辑支撑，但不应喧宾夺主？
*请等待用户确认或修改上述两点，然后再继续。*

**第二阶段：生成技能描述 (YAML Frontmatter)**
在用户确认后，撰写符合规范的描述：
1. **功能总结:** 明确该技能“做什么”以及“何时使用”。
2. **触发上下文 (Triggering Logic):** 
	- **正向触发:** 当用户尝试为已有文件“新增/修改 YAML Frontmatter 或 description”时激活。
	- **负向静默:** 强调当处于“文件归档”或“文件夹整理”等纯管理场景时，此技能应保持静默，避免过度调用。

3. **核心要素:** 必须包含任务类型、文件类型及用户可能提及的关键词。
4. **限制条件:** 
	- 受众：描述应面向 Claude 模型本身，使用指令感强、逻辑严密的语言，以便其在推理阶段做出精准的触发决策。
	- 总长度严格控制在 1024 字符以内。
	- 结构清晰、专业，确保权重向“心动重点”倾斜。

添加YAML Frontmatter示例：

```
---
description: 当他人遭遇尴尬时，通过合理化错误维护自尊心的行动策略
trigger:
  - 当他人遭遇尴尬需要化解时
  - 当需要为他人找台阶下时
  - 当用户尝试为已有文件新增/修改 YAML Frontmatter 或 description
exclude:
  - 纯粹的批评教育场景
  - 文件归档、文件夹整理等纯管理场景
core:
  - 台阶搭建
  - 尴尬化解
keywords:
  - 尴尬
  - 归因
  - 自尊心维护
  - 面子
  - 同理心
---
原始正文内容
```
**【文件内容如下】**
[在此处粘贴你的文件内容]

不要问我，采用默认的识别结果，对所有文件执行添加YAML Frontmatter

%%
系统的分析和理解位于目录 C:\Users\x\Desktop\C1.03.c 阅读行动 (穿透技术)中的每个文件中的文字内容。然后根据下面提示词，为每个文件都执行一边llm的提示词, 每一轮只处理一个文件，得到每个文件的description字段描述文字作为新的description字段描述文字。最后，更新 或新增 该文件的yaml部分description。确保整个目录下所有文件都依次处理完毕。不要用python脚本批量处理。

提示词如下：

**Role:** 你是一名资深的 Anthropic Agent 技能架构师与技术文档专家。
**Task:** 系统性理解下述【文件内容】，并为其撰写符合 Anthropic `SKILL.md` 规范的 `description`（YAML Frontmatter）。
**Core Focus (核心焦点 - 必须优先处理):** 重点提取并描述“如何在海量背景信息中精确定位用户‘心动重点（Focus Area）’的方法论”。这是该技能的核心价值，必须在描述中占据主导地位。
**Contextual Support (辅助边界):** 请引用文件中的“正例”与“反例”作为逻辑支撑，确保 Claude 理解何时该模仿，何时该规避。辅助信息需存在以提供深度，但不应稀释核心焦点的表达。
**Skills Description 规范要求:**
1. **功能摘要:** 简洁说明该技能的作用（做什么）及调用时机（何时用）。
2. **触发上下文 (Triggering Logic):** 明确指出当用户尝试为已有文件“新增或编辑 YAML Frontmatter/description”时，Claude 应识别并激活此技能。
3. **静默约束 (Negative Constraint):** 强调当处于“文件归档”或“文件夹整理”等纯管理场景时，此技能应保持静默，避免过度调用。
4. **要素包含:** 必须包含任务类型（Task Types）、适用的文件类型及用户可能提及的关键词。
5. **限制:** 总长度不得超过 1024 字符。
6. **受众:** 描述应面向 Claude 模型本身，使用指令感强、逻辑严密的语言，以便其在推理阶段做出精准的触发决策。

**【文件内容如下】**
[在此处粘贴你的文件内容]

请对[上面文件内容]进行系统性理解，建议该文件符合skills格式要求的技能描述（skills description)。总结 该文件的description: 用于这个技能_做什么_以及_何时使用_。*包括触发上下文、文件类型、任务类型和用户可能提及的关键词*，最多 1024 字符。

Monitor how AI uses your skill in real scenarios and iterate based on observations: watch for unexpected trajectories or overreliance on certain contexts. Pay special attention to the `description` of your skill. AI will use these when deciding whether to trigger the skill in response to its current task.

确保修改后的内容结构清晰、表述专业、要素完整，能够准确反映原提示词的核心功能与应用场景。修改过程中需保留原提示词的关键信息与设计意图，同时优化语言表达以符合技能描述的规范要求。

### 相关资源

- [Anthropic Skills Repository](https://github.com/anthropics/skills) - 官方技能集合和示例
    
- [Anthropic Agent Skills Blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) - 深入技能架构
    
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code) - 官方 Claude Code 文档