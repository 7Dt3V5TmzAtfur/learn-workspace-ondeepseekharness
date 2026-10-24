# 参考资料

1. 《chapter1.md》——本次学习材料原文，217 段 · （原文）
   - 用途：所有论断与公式的出处。重点段：¶6–¶18（公式与边界）、¶67–¶68（ReAct 与上下文等式）、¶93–¶98（Harness 定义）、¶176–¶182（三层护栏）。

2. Manus 官方博客：Manus Sandbox / Google Drive Connector / My Computer · （原文）
   - 用途：原文脚注 `[^ch1-agent-products]` 直接引用（¶21），是"观察空间与动作空间演进"这一论断的证据。原文给出三个链接：manus.im/blog/manus-sandbox、manus.im/blog/manus-google-drive-connector、manus.im/blog/manus-my-computer。本轮未打开核对。

3. OpenClaw 官方 README 与 tools 文档 · （原文）
   - 用途：同上脚注，用于说明"本地优先 + 二十余种消息渠道"如何扩展 Agent 边界（¶20）。原文有仓库链接，本轮未打开。

4. Rich Sutton, "The Bitter Lesson", 2019 · （原文）
   - 用途：¶49 用它提出"Harness 会不会被模型吃掉"这个反问。原文脚注 `[^ch1-1]` 给出链接 http://www.incompleteideas.net/IncIdeas/BitterLesson.html。本轮未打开。

5. Anthropic, "Building effective agents", 2024-12 · （原文）
   - 用途：¶119–¶122 的"简单 / 透明 / ACI"三原则出处。原文脚注 `[^ch1-anthropic-building-effective-agents]` 给出 https://www.anthropic.com/engineering/building-effective-agents。本轮未打开。

6. Anthropic, "Next-generation Constitutional Classifiers", 2026 · （原文）
   - 用途：¶178 上下文层护栏的工业实践。原文脚注 `[^ch1-3]` 给出链接，本轮未打开。

7. Josh C. Simmons, "We Are Entering the Graph Engineering Phase", 2026-07-04 · （原文）
   - 用途：¶114–¶115 "Graph 工程"这一提法的出处。原文脚注 `[^ch1-graph-engineering]` 记载，本轮未核对。

8. OpenAI, "Codex as a platform: build on the open agent harness", 2026-08 · （原文）
   - 用途：¶167 区分 Codex 产品与 Codex Harness 这一层运行时。原文脚注 `[^ch1-codex-harness]`，本轮未打开。

9. LangChain 在 Terminal Bench 2.0 的实践（52.8% → 66.5%） · （原文）
   - 用途：¶117 用来证明"改 Harness 而不改模型也能大幅提升"。原文给了数字但未在该段给出报告链接，本轮未核对原始报告——**引用这两个数字时请注明是转引**。

10. Yao et al., "ReAct: Synergizing Reasoning and Acting in Language Models" · （联网检索）
    - 用途：本章 ReAct 命名的来源。原文只用了缩写未给论文引用，建议自行检索原文，看清"想-做-看"最初的设计动机。本轮未联网，故不提供链接。

11. Sutton & Barto, "Reinforcement Learning: An Introduction"（第一章）· （联网检索）
    - 用途：本章多处借用 RL 的策略 / 观察 / 动作概念（¶14–¶15），并明确说"不是严格一一等同"。读该书第一章可建立准确对照，避免把类比当成定义。本轮未联网。

12. 你自己做过的 Agent 调试经历 · （我的知识）
    - 用途：读完第一部分后补上——回忆一次"你以为是模型太笨，其实是接口/信息问题"的经历。这一条比上面任何一条都更能把 ¶18 那句话变成你的。
