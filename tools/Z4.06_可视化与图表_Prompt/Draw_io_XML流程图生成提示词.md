---
aliases: [draw.io提示词, 流程图生成模板, XML绘图SOP, Diagrams_net_Prompt]
description: "用于驱动 AI 生成标准 draw.io XML 结构的提示词模板。包含根结构约束、显式父级声明及几何信息规范，旨在解决 'Could not add object' 等导入错误。适用于科研论文流程图及系统架构图的快速构建。"
type: method
status: mature
---
用出版的书籍去思考一页清的笔记很重要（因为出版的书籍能够很科学的把框架变成结构化）;英文原版教材优势（国外教材英文原文在理解上往往更优）;那么看书从书中得到逻辑，而不是从 AI 的回答中得到逻辑（AI 不清楚书中是经典的书）。每次画完一页，要标注它参考引用了哪些书。

[[架构图美化原则]]

```
xxxx的  使用 理论框架，写一篇详细的文章，底层逻辑，第一性原理，二八原则。

```
### A. draw.io 草稿生成
#### 第一次框架草稿
```
draw .io xml 分两次输出。告诉我衔接点.
```
```
 # Role
你是一个顶尖的系统架构师和知识图谱专家，同时具备强大的前端 UI 布局计算能力。你擅长将复杂的行业知识、系统架构或业务流程，拆解为「高度结构化、自下而上递进」的底层逻辑全景图，并精确输出完全去除了换行和空格的单行 Draw.io XML 格式。

# Task
我将提供一个【 xxxxxxx 】。请你深度思考该主题的底层逻辑，**自行决定需要划分为几个层级（通常为3-6层），以及每层需要多少个节点**。随后，严格基于我提供的 `Draw.io XML 模板` 中的组件规范，进行动态延展和坐标计算，生成该主题的全景图。

# Layout & Architecture Rules (核心排版规则)
你必须像一个排版引擎一样计算 `x`, `y`, `width`, `height` 坐标：
1. **动态层级与包裹**：根据你的拆解生成每一层。每层用一个实线大框（`fillColor`使用浅色系）包裹。
1.5 **左上角归属标签**（必须有）：在画布的左上角（如 x="-10", y="35" 附近），生成一个虚线框。
     - **内容要求**：基于当前生成的主题，自动提炼并输出 2~3 个精准的文件夹标签，格式为 `#标签A #标签B`。
     - **XML要求**：绝对不能删除该节点，必须保留 `dashed=1;fillColor=none;` 等样式属性。

2. **层内下钻结构**：
   - **顶部（可选）**：在每层大框内部的顶端，用一行文字写明该层的**「第一性原理或核心目标」**。
   - **底部（可选）**：在每层大框内部的底端，用一行文字写明该层的**「底层运作逻辑或输入机制」**。
   - **虚线分组父节点（可选）**：每层中，如果存在从属关系，必须使用 `dashed=1` 的虚线框将多个子节点包裹起来，并在虚线框顶部加上小标题。
   - **同层连线（可选）**：同层的节点若有流程关系，生成 `edge` 进行左右连线； 线条的路径点采用正交（edgeStyle=orthogonalEdgeStyle 代表正交路由，让线条自动走垂直或水平的直角路径，rounded=1 让路径上的线段的连接点处以圆角方式（Rounded）连接）
  -  **不同层级**之间不要箭头链接。

3.  **全局生命周期组件** （必须有）：
   3.1 - **左右大箭头**（必须有）：分别在画布最左侧和图表中间靠右侧，生成贯穿全局的大箭头，附上递进逻辑文字。
   - **位置与跨度**：计算 `sourcePoint` 和 `targetPoint` 的 Y 轴坐标，完美贯穿所有层级。
   - **排版要求**：严格使用 `textDirection=vertical-lr;` 实现竖排，不使用 `<br>`。
   3.2  - **最右侧贯穿框体（统一范式柱）**：在画布最右侧，保留一个纵向贯穿所有层级的大框体，用于描述贯穿全生命周期的“xxxx”，内部可拆分若干个子节点。
   - **Tools List**: 不同层级分别对应常用工具软件推荐。
   
   🚨🚨🚨 **【致命错误防范：XML 连线语法守则】** 🚨🚨🚨
   所有作为“连线”或“箭头”的节点（包括上述的左右大箭头、层内/层间连线），**绝对不允许遗漏 `edge="1"` 属性**！！！
   ✅ 必须写为：`<mxCell id="..." edge="1" parent="1" style="..." value="...">`
   ❌ 绝不能写成：`<mxCell id="..." parent="1" style="..." value="...">` （缺少 edge="1" 会导致 Draw.io 彻底渲染失败且无任何报错！）
   同时，必须严格保留 `<mxPoint as="offset" />` 标签。

4. **字数与格式控制**：节点名称尽量简短（4-8字），描述文本换行，确保不溢出框体。


# Final Validation (输出前强制自检)
绝对不允许破坏 XML 的基本闭合与 `mxCell` 结构。最终输出的 XML 必须是**「单行极致压缩代码」**（不含任何回车换行和无用缩进），直接放入 ```xml ``` 代码块中返回。

在你生成最终的单行 XML 代码之前，请在底层逻辑中静默执行以下检查：
1. 检索你生成的代码中，id 包含 "arrow" 或 "edge" 的 `<mxCell>`，是否每一个都包含 `edge="1"` 属性？
2. 左右贯穿大箭头的 `targetPoint` 和 `sourcePoint` 的 Y 轴坐标是否足以覆盖所有的层级高度（例如 y=100 到 y=1000）？
确认无误后，再输出极致压缩后的单行 XML。

# 模板组件参考 (Template Components)
请参考并复制以下模板中的“元素写法与样式”（它展示了一层的完整高级结构、右侧贯穿框和左右箭头），请根据你的需求**复制、增删层级、调整 Y 轴坐标并改变文本**：
(此处我会提供一段 XML 模板)

# 我的输入
【新主题】：（用户在这里填入主题） 【根据我上传的内容确定】
```

#### 层级架构
(用通俗的话，而非专业属于表达)

```

可以模仿下面架构层次，不过希望有更多的细节：
<mxGraphModel dx="2259" dy="730" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="title" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3E8FF;strokeColor=#555555;strokeWidth=1.5;fontColor=#330066;align=center;" value="&lt;b style=&quot;font-size:26px&quot;&gt;[全局主题全景图大标题]&lt;/b&gt;&lt;br&gt;&lt;span style=&quot;font-size:14px&quot;&gt;核心要义：[高度凝练的全局总结， 一句话记忆点]&lt;/span&gt;" vertex="1">
      <mxGeometry height="60" width="1360" x="-30" y="20" as="geometry" />
    </mxCell>
    <mxCell id="layer1_bg" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F5FF;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="220" width="960" x="140" y="100" as="geometry" />
    </mxCell>
    <mxCell id="layer1_lbl" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F5FF;strokeColor=#555555;strokeWidth=1.5;fontColor=#001144;align=center;" value="&lt;b style=&quot;font-size:16px&quot;&gt;[顶层层级]&lt;br&gt;&lt;br&gt;[层级短名]&lt;/b&gt;" vertex="1">
      <mxGeometry height="220" width="100" x="20" y="100" as="geometry" />
    </mxCell>
    <mxCell id="layer1_first_principle" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#001144;fontStyle=1;" value="[该层的第一性原理 / 核心目标描述]" vertex="1">
      <mxGeometry height="25" width="900" x="170" y="105" as="geometry" />
    </mxCell>
    <mxCell id="layer1_bottom_logic" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#001144;fontStyle=1;fillColor=#E6EEFF;" value="[该层的底层逻辑 / 核心支撑机制描述]" vertex="1">
      <mxGeometry height="30" width="920" x="160" y="280" as="geometry" />
    </mxCell>
    <mxCell id="group1_dashed" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="130" width="380" x="160" y="140" as="geometry" />
    </mxCell>
    <mxCell id="group1_title" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#001144;fontStyle=1;" value="[虚线分组父节点标题]" vertex="1">
      <mxGeometry height="25" width="380" x="160" y="140" as="geometry" />
    </mxCell>
    <mxCell id="N8z3ok8JzxqRTBM2S_2C-1" edge="1" parent="1" source="node_1_1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;shadow=1;" target="node_1_2">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="node_1_1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[节点1-1名称]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;[细节描述1]&lt;br&gt;[细节描述2]" vertex="1">
      <mxGeometry height="80" width="160" x="175" y="175" as="geometry" />
    </mxCell>
    <mxCell id="_9r75y9yZQ-G-ClhZeDC-1" edge="1" parent="1" source="node_1_2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;flowAnimation=1;shadow=1;" target="node_1_3">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="node_1_2" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[节点1-2名称]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;[细节描述1]&lt;br&gt;[细节描述2]" vertex="1">
      <mxGeometry height="80" width="160" x="365" y="175" as="geometry" />
    </mxCell>
    <mxCell id="node_1_3" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[独立节点1-3]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;不包含在虚线框内&lt;br&gt;[细节描述]" vertex="1">
      <mxGeometry height="80" width="220" x="580" y="175" as="geometry" />
    </mxCell>
    <mxCell id="layer2_bg" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF8E8;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="220" width="960" x="140" y="340" as="geometry" />
    </mxCell>
    <mxCell id="layer2_lbl" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF8E8;strokeColor=#555555;strokeWidth=1.5;fontColor=#553300;align=center;" value="&lt;b style=&quot;font-size:16px&quot;&gt;[下层层级]&lt;br&gt;&lt;br&gt;[层级短名]&lt;/b&gt;" vertex="1">
      <mxGeometry height="220" width="100" x="20" y="340" as="geometry" />
    </mxCell>
    <mxCell id="layer2_first_principle" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#553300;fontStyle=1;" value="[下层第一性原理描述]" vertex="1">
      <mxGeometry height="25" width="900" x="170" y="345" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-7" edge="1" parent="1" source="node_2_1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;curved=0;flowAnimation=1;" target="RR-NbRa6kDIM6jWWL-w6-3">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="node_2_1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[节点2-1]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;[细节描述]" vertex="1">
      <mxGeometry height="80" width="160" x="170" y="401" as="geometry" />
    </mxCell>
    <mxCell id="layer2_bottom_logic" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#553300;fontStyle=1;fillColor=#FFF3D4;" value="[下层底层逻辑描述]" vertex="1">
      <mxGeometry height="30" width="920" x="160" y="520" as="geometry" />
    </mxCell>
    <mxCell id="right_pillar_bg" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F8F8F8;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="460" width="170" x="1160" y="100" as="geometry" />
    </mxCell>
    <mxCell id="right_pillar_title" parent="1" style="text;html=1;align=center;verticalAlign=top;whiteSpace=wrap;fontColor=#222;fontStyle=1;" value="&lt;br&gt;&lt;b style=&quot;font-size:16px&quot;&gt;[贯穿全局基座]&lt;/b&gt;&lt;br&gt;&lt;br&gt;[统一描述/核心要素]&lt;br&gt;&lt;b style=&quot;font-size:18px;color:#900&quot;&gt;[核心公式/定律]&lt;/b&gt;" vertex="1">
      <mxGeometry height="120" width="170" x="1160" y="110" as="geometry" />
    </mxCell>
    <mxCell id="iz_WNdcJ5GDpFnpAKKNX-430" edge="1" parent="1" source="right_pillar_node1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;shadow=1;" target="right_pillar_node2">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="right_pillar_node1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b&gt;[统一范式A]&lt;/b&gt;&lt;br&gt;&lt;br&gt;[特性1]&lt;br&gt;[特性2]" vertex="1">
      <mxGeometry height="90" width="130" x="1180" y="240" as="geometry" />
    </mxCell>
    <mxCell id="right_pillar_node2" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b&gt;[统一范式B]&lt;/b&gt;&lt;br&gt;&lt;br&gt;[特性1]&lt;br&gt;[特性2]" vertex="1">
      <mxGeometry height="90" width="130" x="1180" y="355" as="geometry" />
    </mxCell>
    <mxCell id="edge_intra" parent="1" source="node_1_1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#555555;strokeWidth=2;endArrow=block;" target="node_1_2">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="edge_inter" parent="1" source="node_2_1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#555555;strokeWidth=2;endArrow=block;dashed=1;" target="node_1_1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="edge_pillar" parent="1" source="right_pillar_node2" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#555555;strokeWidth=3;endArrow=classic;" target="right_pillar_node1">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="N8z3ok8JzxqRTBM2S_2C-2" parent="1" style="rounded=1;whiteSpace=wrap;html=1;dashed=1;fillColor=none;" value="归属文件夹标签推荐" vertex="1">
      <mxGeometry height="30" width="120" x="-10" y="35" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[独立节点1-4]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;不包含在虚线框内&lt;br&gt;[细节描述]" vertex="1">
      <mxGeometry height="80" width="220" x="827" y="175" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-8" edge="1" parent="1" source="RR-NbRa6kDIM6jWWL-w6-2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;flowAnimation=1;" target="RR-NbRa6kDIM6jWWL-w6-4">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-2" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[节点2-2]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;[细节描述]" vertex="1">
      <mxGeometry height="70" width="160" x="410" y="370" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-9" edge="1" parent="1" source="RR-NbRa6kDIM6jWWL-w6-3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;flowAnimation=1;" target="RR-NbRa6kDIM6jWWL-w6-4">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-3" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[节点2-3]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;[细节描述]" vertex="1">
      <mxGeometry height="70" width="160" x="411" y="447" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-12" edge="1" parent="1" source="RR-NbRa6kDIM6jWWL-w6-4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;flowAnimation=1;" target="RR-NbRa6kDIM6jWWL-w6-10">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-4" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[节点2-4]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;[细节描述]" vertex="1">
      <mxGeometry height="80" width="160" x="667" y="401" as="geometry" />
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-5" edge="1" parent="1" source="node_2_1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;curved=0;flowAnimation=1;">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="410" y="406" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="RR-NbRa6kDIM6jWWL-w6-10" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;" value="&lt;b style=&quot;font-size:14px&quot;&gt;[节点2-5]&lt;/b&gt;&lt;hr style=&quot;border-color:#555555;margin:5px 0&quot;&gt;[细节描述]" vertex="1">
      <mxGeometry height="80" width="160" x="910" y="401" as="geometry" />
    </mxCell>
    <mxCell id="jb5pQ3p36dxXcum_fDYP-1" edge="1" parent="1" style="edgeStyle=none;html=1;strokeWidth=12;strokeColor=#0277BD;fontColor=#0277BD;endArrow=block;endFill=1;endSize=10;labelBackgroundColor=default;verticalAlign=middle;align=center;textDirection=vertical-lr;spacing=20;fontFamily=微软雅黑;labelBorderColor=none;textShadow=0;flowAnimation=0;" value="&lt;div style=&quot;&quot;&gt;&lt;b style=&quot;font-size: 18px; color: light-dark(rgb(2, 119, 189), rgb(69, 169, 229));&quot;&gt;&lt;font&gt;底层到顶层的渐进逻辑&lt;/font&gt;&lt;/b&gt;&lt;/div&gt;">
      <mxGeometry relative="1" x="-0.0222" as="geometry">
        <mxPoint as="offset" />
        <mxPoint x="-10" y="560" as="sourcePoint" />
        <mxPoint x="-10" y="110" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="jb5pQ3p36dxXcum_fDYP-2" edge="1" parent="1" style="edgeStyle=none;html=1;strokeWidth=12;strokeColor=#AD1457;fontColor=#AD1457;endArrow=block;endFill=1;endSize=10;labelBackgroundColor=#FFFFFF;verticalAlign=middle;align=center;textDirection=vertical-lr;spacingTop=0;spacing=18;fontFamily=微软雅黑;" value="&lt;span style=&quot;font-size: 18px;&quot;&gt;&lt;b&gt;&lt;font&gt;顶层到底层的渐进逻辑&lt;/font&gt;&lt;/b&gt;&lt;/span&gt;">
      <mxGeometry relative="1" x="-0.0217" as="geometry">
        <mxPoint as="offset" />
        <mxPoint x="1130" y="105" as="sourcePoint" />
        <mxPoint x="1130" y="565" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="xrUmVZ5ud4DbVPSohW_k-1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;shadow=1;align=left;spacingLeft=10;" value="&lt;div style=&quot;&quot;&gt;&lt;b style=&quot;background-color: transparent; color: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));&quot;&gt;Tools List&lt;/b&gt;&lt;/div&gt;&lt;br&gt;[类别1]: xxx, xxx&lt;br&gt;[类别2]: xxx, xxx" vertex="1">
      <mxGeometry height="90" width="130" x="1181" y="463" as="geometry" />
    </mxCell>
    <mxCell id="Mi5mew30iibq3p76Tazf-1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;dashed=1;fillColor=none;align=left;" value="&lt;div style=&quot;line-height: 140%;&quot;&gt;参考：1.《xxxx书籍》&amp;nbsp;&lt;br&gt;&lt;div&gt;&lt;span style=&quot;background-color: transparent; color: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));&quot;&gt;参考：&lt;/span&gt;&lt;span style=&quot;background-color: transparent; color: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));&quot;&gt;2.&amp;nbsp; 源链接 ....&lt;/span&gt;&lt;/div&gt;&lt;/div&gt;" vertex="1">
      <mxGeometry height="30" width="250" x="1040" y="35" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>


```

```
重新梳理一下我口语的表达，用一个段落来整理内容：
```

### B. 内容逻辑增强
#### 深度研究逻辑扩展
```
理解下述excalidraw原代码中文字逻辑关系，深度研究主题：python 编程语言  体系架构 
=========

```

#### 补充扩展优化

```
理解我上传【主题是 计算机科学技术架构 】的 draw.io xml  内容层次卡片之间逻辑，现有卡片之间的分离和分层关系是否正确？，是否需要增加额外的核心概念，先不用给我新的draw.io xml，此轮只是思考逻辑和补充内容。
```

```
好我赞同你的回答修改方案，记住你刚才的回答。 此轮思考一下卡片之间的逻辑关系，同一层级里面从左到右，应是递进的。有没有概念卡片之间是包含关系，或者逻辑关系不清晰，需要增加额外的概念卡片过渡，或者是并列的关系。先不用给我新的draw.io xml，此轮只是思考概念之间逻辑和补充内容。
```

```
好我赞同你的回答修改方案，记住你刚才的回答。 此轮输出根据你刚才两轮优化方案修改后的draw.io xml ，分三次输出，告诉我衔接点.
```

```
好的，我上传了完整版本的draw.io xml 内容，基于这个文件内容，在不改变已经存在的文字内容条件下，为每个概念卡片下方增加2行文字为此概念的第一性原理内容。可以参考我上传draw.io xml模板调整风格，分5次输出（内容清晰，不要被精简），告诉我衔接点.
```

### C.通用draw.io提示词

```
查询网络相关内容，  

```
```
“请帮我生成一个 [xxxx 科研技术架构全景图  主题] 的 draw.io XML 流程图。请严格遵守以下格式要求以避免导入错误：
1. **根结构**：必须包含 `<mxGraphModel>` 标签，且内部 `root` 必须有 `id="0"` 和 `id="1" parent="0"` 的基础单元。
2. **显式父级**：所有后续 `mxCell` 必须显式包含 `parent="1"` 属性。
3. **完整几何信息**：每个节点必须包含 `<mxGeometry x="..." y="..." width="..." height="..." as="geometry" />`。
4. **独立样式**：style 属性应包含具体的 `fillColor`, `strokeColor`, `whiteSpace=wrap`, `html=1` 等参数，不要使用简化的标签。
5. **连接线**：Edge 元素必须指明 `source` 和 `target` 的 ID，并包含 `relative="1" as="geometry"`。”

美化：
1. 箭头链接曲线美化：**色彩同步 (Color Coding)**
2. 确保每个节点的 `fontColor` 都是其 `fillColor` 的高饱和深色版本，并统一了边框颜色以保持视觉平衡
3. 线条的路径点采用正交（edgeStyle=orthogonalEdgeStyle 代表正交路由，让线条自动走垂直或水平的直角路径，rounded=1 让路径上的线段的连接点处以圆角方式（Rounded）连接）

注意避免常见问题：
3. Could not add object for mxCel
4. draw.io 的“编辑图形”功能需要的是标准的、展开的 XML 属性。

参考：
1. 官方文档：[draw.io Documentation](https://www.drawio.com/doc/)
2. 额外关注文档中加粗的关键词汇

```

```

<mxGraphModel dx="3353" dy="1313" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="10" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3E8FF;strokeColor=#555555;strokeWidth=1.5;fontColor=#330066;" value="&lt;b style=&quot;font-size: 26px;&quot;&gt;自然语言处理 (NLP) 理论框架全景图&lt;/b&gt;" vertex="1">
      <mxGeometry height="60" width="1370" x="-20" y="20" as="geometry" />
    </mxCell>
    <mxCell id="100" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF0F0;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="120" width="960" x="140" y="100" as="geometry" />
    </mxCell>
    <mxCell id="101" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF0F0;strokeColor=#555555;strokeWidth=1.5;fontColor=#800000;" value="&lt;b style=&quot;font-size: 16px;&quot;&gt;第六层&lt;br&gt;&lt;br&gt;现代对齐&lt;br&gt;与评估理论&lt;/b&gt;" vertex="1">
      <mxGeometry height="120" width="100" x="20" y="100" as="geometry" />
    </mxCell>
    <mxCell id="102" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#800000;fillColor=none;strokeColor=none;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;人类对齐理论 (Human Alignment)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="440" x="160" y="105" as="geometry" />
    </mxCell>
    <mxCell id="103" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#800000;" value="&lt;b&gt;指令微调&lt;/b&gt;&lt;br&gt;(Instruction Tuning)" vertex="1">
      <mxGeometry height="60" width="130" x="160" y="135" as="geometry" />
    </mxCell>
    <mxCell id="104" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#800000;" value="&lt;b&gt;人类反馈强化学习&lt;/b&gt;&lt;br&gt;(RLHF / PPO)" vertex="1">
      <mxGeometry height="60" width="130" x="310" y="135" as="geometry" />
    </mxCell>
    <mxCell id="105" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#800000;" value="&lt;b&gt;直接偏好优化&lt;/b&gt;&lt;br&gt;(DPO)" vertex="1">
      <mxGeometry height="60" width="130" x="460" y="135" as="geometry" />
    </mxCell>
    <mxCell id="106" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#800000;fillColor=none;strokeColor=none;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;现代评估理论 (Evaluation Theory)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="450" x="630" y="105" as="geometry" />
    </mxCell>
    <mxCell id="107" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#800000;" value="&lt;b&gt;传统重叠度评估&lt;/b&gt;&lt;br&gt;(BLEU / ROUGE)" vertex="1">
      <mxGeometry height="60" width="140" x="630" y="135" as="geometry" />
    </mxCell>
    <mxCell id="108" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#800000;" value="&lt;b&gt;语义相似度评估&lt;/b&gt;&lt;br&gt;(BERTScore)" vertex="1">
      <mxGeometry height="60" width="130" x="790" y="135" as="geometry" />
    </mxCell>
    <mxCell id="109" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#800000;" value="&lt;b&gt;多维批判性评估&lt;/b&gt;&lt;br&gt;(LLM-as-a-Judge)" vertex="1">
      <mxGeometry height="60" width="140" x="940" y="135" as="geometry" />
    </mxCell>
    <mxCell id="200" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F5FF;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="150" width="960" x="140" y="240" as="geometry" />
    </mxCell>
    <mxCell id="201" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0F5FF;strokeColor=#555555;strokeWidth=1.5;fontColor=#001144;" value="&lt;b style=&quot;font-size: 16px;&quot;&gt;第五层&lt;br&gt;&lt;br&gt;核心功能&lt;br&gt;框架&lt;/b&gt;" vertex="1">
      <mxGeometry height="150" width="100" x="20" y="240" as="geometry" />
    </mxCell>
    <mxCell id="202" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="85" width="400" x="160" y="250" as="geometry" />
    </mxCell>
    <mxCell id="203" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#001144;fillColor=none;strokeColor=none;" value="&lt;b&gt;自然语言理解 NLU (信息的降维与聚合)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="400" x="160" y="250" as="geometry" />
    </mxCell>
    <mxCell id="204" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#001144;" value="词法层&lt;br&gt;命名实体识别" vertex="1">
      <mxGeometry height="50" width="110" x="170" y="275" as="geometry" />
    </mxCell>
    <mxCell id="205" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#001144;" value="句法层&lt;br&gt;语义角色标注" vertex="1">
      <mxGeometry height="50" width="110" x="305" y="275" as="geometry" />
    </mxCell>
    <mxCell id="206" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#001144;" value="语义层&lt;br&gt;情感/意图识别" vertex="1">
      <mxGeometry height="50" width="110" x="440" y="275" as="geometry" />
    </mxCell>
    <mxCell id="207" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="85" width="460" x="620" y="250" as="geometry" />
    </mxCell>
    <mxCell id="208" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#001144;fillColor=none;strokeColor=none;" value="&lt;b&gt;自然语言生成 NLG (信息的解码与延展)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="460" x="620" y="250" as="geometry" />
    </mxCell>
    <mxCell id="209" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#001144;" value="宏观规划&lt;br&gt;(提取/决定说什么)" vertex="1">
      <mxGeometry height="50" width="130" x="630" y="275" as="geometry" />
    </mxCell>
    <mxCell id="210" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#001144;" value="微观规划&lt;br&gt;(选择词汇/句法)" vertex="1">
      <mxGeometry height="50" width="130" x="785" y="275" as="geometry" />
    </mxCell>
    <mxCell id="211" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#001144;" value="表层实现&lt;br&gt;(输出文本序列)" vertex="1">
      <mxGeometry height="50" width="130" x="940" y="275" as="geometry" />
    </mxCell>
    <mxCell id="212" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6EEFF;strokeColor=#555555;strokeWidth=1.5;fontColor=#001144;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;理论的大统一：Seq2Seq 自回归生成框架 (NLU 与 NLG 统一转化为 Prompt + Text Generation)&lt;/b&gt;" vertex="1">
      <mxGeometry height="35" width="920" x="160" y="345" as="geometry" />
    </mxCell>
    <mxCell id="300" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF8E8;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="150" width="960" x="140" y="410" as="geometry" />
    </mxCell>
    <mxCell id="301" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF8E8;strokeColor=#555555;strokeWidth=1.5;fontColor=#553300;" value="&lt;b style=&quot;font-size: 16px;&quot;&gt;第四层&lt;br&gt;&lt;br&gt;计算范式&lt;br&gt;演进理论&lt;/b&gt;" vertex="1">
      <mxGeometry height="150" width="100" x="20" y="410" as="geometry" />
    </mxCell>
    <mxCell id="302" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="130" width="200" x="160" y="420" as="geometry" />
    </mxCell>
    <mxCell id="303" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#553300;fillColor=none;strokeColor=none;" value="&lt;b&gt;1. 符号主义 (规则范式)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="200" x="160" y="420" as="geometry" />
    </mxCell>
    <mxCell id="304" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="专家系统" vertex="1">
      <mxGeometry height="40" width="80" x="170" y="445" as="geometry" />
    </mxCell>
    <mxCell id="305" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="上下文无关文法" vertex="1">
      <mxGeometry height="40" width="90" x="260" y="445" as="geometry" />
    </mxCell>
    <mxCell id="306" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;align=left;spacingLeft=10;" value="&lt;b&gt;核心&lt;/b&gt;：人类构建封闭逻辑系统&lt;br&gt;&lt;b&gt;局限&lt;/b&gt;：常识瓶颈，无法穷尽变体" vertex="1">
      <mxGeometry height="45" width="180" x="170" y="495" as="geometry" />
    </mxCell>
    <mxCell id="307" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="130" width="210" x="390" y="420" as="geometry" />
    </mxCell>
    <mxCell id="308" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#553300;fillColor=none;strokeColor=none;" value="&lt;b&gt;2. 经验主义 (统计机器学习)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="210" x="390" y="420" as="geometry" />
    </mxCell>
    <mxCell id="309" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="HMM / CRF" vertex="1">
      <mxGeometry height="40" width="85" x="400" y="445" as="geometry" />
    </mxCell>
    <mxCell id="310" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="TF-IDF / SVM" vertex="1">
      <mxGeometry height="40" width="95" x="495" y="445" as="geometry" />
    </mxCell>
    <mxCell id="311" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;align=left;spacingLeft=10;" value="&lt;b&gt;核心&lt;/b&gt;：数据驱动的模式识别&lt;br&gt;&lt;b&gt;局限&lt;/b&gt;：高度依赖人工特征工程" vertex="1">
      <mxGeometry height="45" width="190" x="400" y="495" as="geometry" />
    </mxCell>
    <mxCell id="312" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="130" width="200" x="630" y="420" as="geometry" />
    </mxCell>
    <mxCell id="313" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#553300;fillColor=none;strokeColor=none;" value="&lt;b&gt;3. 连接主义 (深度学习)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="200" x="630" y="420" as="geometry" />
    </mxCell>
    <mxCell id="314" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="RNN / LSTM" vertex="1">
      <mxGeometry height="40" width="85" x="640" y="445" as="geometry" />
    </mxCell>
    <mxCell id="315" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="Attention机制" vertex="1">
      <mxGeometry height="40" width="85" x="735" y="445" as="geometry" />
    </mxCell>
    <mxCell id="316" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;align=left;spacingLeft=10;" value="&lt;b&gt;核心&lt;/b&gt;：自动学习分布式表征&lt;br&gt;&lt;b&gt;突破&lt;/b&gt;：打破序列记忆瓶颈" vertex="1">
      <mxGeometry height="45" width="180" x="640" y="495" as="geometry" />
    </mxCell>
    <mxCell id="317" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="130" width="220" x="860" y="420" as="geometry" />
    </mxCell>
    <mxCell id="318" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#553300;fillColor=none;strokeColor=none;" value="&lt;b&gt;4. 生成式预训练 (LLM 时代)&lt;/b&gt;" vertex="1">
      <mxGeometry height="25" width="220" x="860" y="420" as="geometry" />
    </mxCell>
    <mxCell id="319" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="Transformer" vertex="1">
      <mxGeometry height="40" width="85" x="870" y="445" as="geometry" />
    </mxCell>
    <mxCell id="320" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;" value="自监督预测" vertex="1">
      <mxGeometry height="40" width="105" x="965" y="445" as="geometry" />
    </mxCell>
    <mxCell id="321" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#553300;align=left;spacingLeft=10;" value="&lt;b&gt;核心&lt;/b&gt;：尺度定律 (Scaling Laws)&lt;br&gt;&lt;b&gt;突破&lt;/b&gt;：涌现复杂推理与上下文能力" vertex="1">
      <mxGeometry height="45" width="200" x="870" y="495" as="geometry" />
    </mxCell>
    <mxCell id="350" edge="1" parent="1" source="302" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#555555;strokeWidth=2;endArrow=block;" target="307">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="351" edge="1" parent="1" source="307" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#555555;strokeWidth=2;endArrow=block;" target="312">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="352" edge="1" parent="1" source="312" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#555555;strokeWidth=2;endArrow=block;" target="317">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="400" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F5F0FF;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="120" width="960" x="140" y="580" as="geometry" />
    </mxCell>
    <mxCell id="401" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F5F0FF;strokeColor=#555555;strokeWidth=1.5;fontColor=#220055;" value="&lt;b style=&quot;font-size: 16px;&quot;&gt;第三层&lt;br&gt;&lt;br&gt;语义表征&lt;br&gt;理论&lt;/b&gt;" vertex="1">
      <mxGeometry height="120" width="100" x="20" y="580" as="geometry" />
    </mxCell>
    <mxCell id="402" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#220055;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;1. 离散符号表征 (One-Hot)&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;假设词汇是孤立原子符号&lt;br&gt;缺陷：维度灾难、无法跨越“语义鸿沟”" vertex="1">
      <mxGeometry height="80" width="270" x="160" y="600" as="geometry" />
    </mxCell>
    <mxCell id="403" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#220055;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;2. 静态词向量与分布语义学&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;Word2Vec / GloVe (低维连续稠密向量)&lt;br&gt;突破：向量距离直接等价于语义相似度" vertex="1">
      <mxGeometry height="80" width="280" x="480" y="600" as="geometry" />
    </mxCell>
    <mxCell id="404" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#220055;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;3. 动态语境表征理论&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;ELMo / BERT / GPT (Contextualized)&lt;br&gt;突破：即时计算前向传播，解决一词多义" vertex="1">
      <mxGeometry height="80" width="270" x="810" y="600" as="geometry" />
    </mxCell>
    <mxCell id="410" edge="1" parent="1" source="402" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#555555;strokeWidth=2;endArrow=block;" target="403">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="411" edge="1" parent="1" source="403" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#555555;strokeWidth=2;endArrow=block;" target="404">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="500" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0FFF0;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="130" width="960" x="140" y="720" as="geometry" />
    </mxCell>
    <mxCell id="501" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F0FFF0;strokeColor=#555555;strokeWidth=1.5;fontColor=#003300;" value="&lt;b style=&quot;font-size: 16px;&quot;&gt;第二层&lt;br&gt;&lt;br&gt;数学与信息论&lt;br&gt;基础&lt;/b&gt;" vertex="1">
      <mxGeometry height="130" width="100" x="20" y="720" as="geometry" />
    </mxCell>
    <mxCell id="502" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="110" width="290" x="160" y="730" as="geometry" />
    </mxCell>
    <mxCell id="503" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#003300;fillColor=none;strokeColor=none;" value="&lt;b&gt;信息论 (Information Theory)&lt;/b&gt;" vertex="1">
      <mxGeometry height="20" width="290" x="160" y="735" as="geometry" />
    </mxCell>
    <mxCell id="504" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#003300;" value="&lt;b&gt;香农熵&lt;/b&gt;&lt;br&gt;衡量语言系统的不确定性" vertex="1">
      <mxGeometry height="60" width="130" x="170" y="765" as="geometry" />
    </mxCell>
    <mxCell id="505" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#003300;" value="&lt;b&gt;交叉熵 / KL散度&lt;/b&gt;&lt;br&gt;逼近真实概率的最核心损失" vertex="1">
      <mxGeometry height="60" width="130" x="310" y="765" as="geometry" />
    </mxCell>
    <mxCell id="506" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="110" width="290" x="480" y="730" as="geometry" />
    </mxCell>
    <mxCell id="507" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#003300;fillColor=none;strokeColor=none;" value="&lt;b&gt;概率论与统计学 (Prob &amp; Stats)&lt;/b&gt;" vertex="1">
      <mxGeometry height="20" width="290" x="480" y="735" as="geometry" />
    </mxCell>
    <mxCell id="508" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#003300;" value="&lt;b&gt;马尔可夫假设&lt;/b&gt;&lt;br&gt;有限历史依赖 (N-gram基础)" vertex="1">
      <mxGeometry height="60" width="130" x="490" y="765" as="geometry" />
    </mxCell>
    <mxCell id="509" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#003300;" value="&lt;b&gt;贝叶斯定理&lt;/b&gt;&lt;br&gt;生成式模型与先验推断" vertex="1">
      <mxGeometry height="60" width="130" x="630" y="765" as="geometry" />
    </mxCell>
    <mxCell id="510" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#555555;strokeWidth=1;dashed=1;" vertex="1">
      <mxGeometry height="110" width="280" x="800" y="730" as="geometry" />
    </mxCell>
    <mxCell id="511" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#003300;fillColor=none;strokeColor=none;" value="&lt;b&gt;线性代数与向量空间 (LinAlg &amp; VSM)&lt;/b&gt;" vertex="1">
      <mxGeometry height="20" width="280" x="800" y="735" as="geometry" />
    </mxCell>
    <mxCell id="512" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#003300;" value="&lt;b&gt;高维空间映射&lt;/b&gt;&lt;br&gt;将离散符号化为连续坐标" vertex="1">
      <mxGeometry height="60" width="125" x="810" y="765" as="geometry" />
    </mxCell>
    <mxCell id="513" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#003300;" value="&lt;b&gt;矩阵乘积与点积相似度&lt;/b&gt;&lt;br&gt;Attention的核心计算逻辑" vertex="1">
      <mxGeometry height="60" width="125" x="945" y="765" as="geometry" />
    </mxCell>
    <mxCell id="600" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E8F8FF;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="140" width="960" x="140" y="870" as="geometry" />
    </mxCell>
    <mxCell id="601" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E8F8FF;strokeColor=#555555;strokeWidth=1.5;fontColor=#002233;" value="&lt;b style=&quot;font-size: 16px;&quot;&gt;第一层&lt;br&gt;&lt;br&gt;语言学&lt;br&gt;基础理论&lt;/b&gt;" vertex="1">
      <mxGeometry height="140" width="100" x="20" y="870" as="geometry" />
    </mxCell>
    <mxCell id="602" parent="1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;fontColor=#002233;fillColor=none;strokeColor=none;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;自然语言处理处理对象的自下而上的认知结构层次&lt;/b&gt;" vertex="1">
      <mxGeometry height="20" width="960" x="140" y="875" as="geometry" />
    </mxCell>
    <mxCell id="603" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#002233;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;1. 词法学 (Morphology)&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;研究词汇内部结构与语素&lt;br&gt;应用：分词、词性标注、BPE" vertex="1">
      <mxGeometry height="90" width="170" x="160" y="905" as="geometry" />
    </mxCell>
    <mxCell id="604" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#002233;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;2. 句法学 (Syntax)&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;研究词组与句子组合规则&lt;br&gt;应用：短语结构、依存语法" vertex="1">
      <mxGeometry height="90" width="170" x="345" y="905" as="geometry" />
    </mxCell>
    <mxCell id="605" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#002233;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;3. 语义学 (Semantics)&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;研究语言的字面与组合意义&lt;br&gt;应用：分布语义、WordNet" vertex="1">
      <mxGeometry height="90" width="170" x="530" y="905" as="geometry" />
    </mxCell>
    <mxCell id="606" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#002233;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;4. 语用学 (Pragmatics)&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;特定语境下超越字面的言外之意&lt;br&gt;应用：意图识别、指代消解" vertex="1">
      <mxGeometry height="90" width="180" x="715" y="905" as="geometry" />
    </mxCell>
    <mxCell id="607" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#002233;align=center;" value="&lt;b style=&quot;font-size: 14px;&quot;&gt;5. 篇章学 (Discourse)&lt;/b&gt;&lt;hr style=&quot;border-color: #555555; margin: 5px 0;&quot;&gt;跨越单句的逻辑连贯与段落衔接&lt;br&gt;应用：长文本理解与摘要" vertex="1">
      <mxGeometry height="90" width="170" x="910" y="905" as="geometry" />
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-607" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F8F8F8;strokeColor=#555555;strokeWidth=1.5;" vertex="1">
      <mxGeometry height="910" width="170" x="1180" y="100" as="geometry" />
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-618" connectable="0" parent="1" style="group" value="" vertex="1">
      <mxGeometry height="720" width="130" x="1193" y="110" as="geometry" />
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-619" parent="wHmF6YSFfibfElsFKKlx-618" style="text;html=1;align=center;verticalAlign=top;whiteSpace=wrap;fontColor=#222222;fillColor=none;strokeColor=none;" value="&lt;br&gt;&lt;b style=&quot;font-size: 16px;&quot;&gt;统一范式&lt;/b&gt;&lt;br&gt;&lt;br&gt;映射函数&lt;br&gt;&lt;b style=&quot;font-size: 18px; color: #990000;&quot;&gt;F: X → Y&lt;/b&gt;" vertex="1">
      <mxGeometry height="120" width="130" as="geometry" />
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-620" parent="wHmF6YSFfibfElsFKKlx-618" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#222222;" value="&lt;b&gt;随机最优化&lt;/b&gt;&lt;br&gt;&lt;br&gt;数据驱动&lt;br&gt;高维概率分布&lt;br&gt;自动寻找参数" vertex="1">
      <mxGeometry height="100" width="100" x="20" y="120" as="geometry" />
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-621" parent="wHmF6YSFfibfElsFKKlx-618" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#222222;" value="&lt;b&gt;结构与降维&lt;/b&gt;&lt;br&gt;&lt;br&gt;统计分布&lt;br&gt;特征值抽取&lt;br&gt;局部变分能量" vertex="1">
      <mxGeometry height="100" width="100" x="20" y="350" as="geometry" />
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-622" parent="wHmF6YSFfibfElsFKKlx-618" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#555555;strokeWidth=1;fontColor=#222222;" value="&lt;b&gt;确定性推演&lt;/b&gt;&lt;br&gt;&lt;br&gt;物理定律&lt;br&gt;数学先验设计&lt;br&gt;显式滤波公式" vertex="1">
      <mxGeometry height="100" width="100" x="20" y="620" as="geometry" />
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-623" edge="1" parent="wHmF6YSFfibfElsFKKlx-618" source="wHmF6YSFfibfElsFKKlx-622" style="edgeStyle=orthogonalEdgeStyle;curved=1;rounded=1;html=1;strokeWidth=3;strokeColor=#555555;endArrow=classic;" target="wHmF6YSFfibfElsFKKlx-621">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="-1005" y="-120" as="sourcePoint" />
        <mxPoint x="-1005" y="-120" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-624" edge="1" parent="wHmF6YSFfibfElsFKKlx-618" source="wHmF6YSFfibfElsFKKlx-621" style="edgeStyle=orthogonalEdgeStyle;curved=1;rounded=1;html=1;strokeWidth=3;strokeColor=#555555;endArrow=classic;" target="wHmF6YSFfibfElsFKKlx-620">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="-1005" y="-120" as="sourcePoint" />
        <mxPoint x="-1005" y="-120" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-625" edge="1" parent="1" style="edgeStyle=none;html=1;strokeWidth=12;strokeColor=#AD1457;fontColor=#AD1457;endArrow=block;endFill=1;endSize=10;labelBackgroundColor=#FFFFFF;verticalAlign=middle;align=center;" value="&lt;b style=&quot;font-size:18px;&quot;&gt;业&lt;br&gt;务&lt;br&gt;需&lt;br&gt;求&lt;br&gt;反&lt;br&gt;向&lt;br&gt;驱&lt;br&gt;动&lt;br&gt;底&lt;br&gt;层&lt;br&gt;迭&lt;br&gt;代&lt;/b&gt;">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="1140" y="110" as="sourcePoint" />
        <mxPoint x="1140" y="1007.5" as="targetPoint" />
      </mxGeometry>
    </mxCell>
    <mxCell id="wHmF6YSFfibfElsFKKlx-626" edge="1" parent="1" style="edgeStyle=none;html=1;strokeWidth=12;strokeColor=#0277BD;fontColor=#0277BD;endArrow=block;endFill=1;endSize=10;labelBackgroundColor=#FFFFFF;verticalAlign=middle;align=center;" value="&lt;b style=&quot;font-size:18px;&quot;&gt;数&lt;br&gt;据&lt;br&gt;从&lt;br&gt;输&lt;br&gt;入&lt;br&gt;到&lt;br&gt;输&lt;br&gt;出&lt;br&gt;的&lt;br&gt;生&lt;br&gt;命&lt;br&gt;周&lt;br&gt;期&lt;/b&gt;">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="-1" y="1010" as="sourcePoint" />
        <mxPoint x="-1" y="90" as="targetPoint" />
      </mxGeometry>
    </mxCell>
  </root>
</mxGraphModel>

```

```
元素之间逻辑，以及各个组件的美化风格，可以参考如下
===
<mxGraphModel dx="1501" dy="913" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1080" pageHeight="1920" math="0" shadow="1">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="title" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=bottom;whiteSpace=wrap;rounded=0;fontSize=48;fontColor=#1D1D1F;fontFamily=-apple-system, BlinkMacSystemFont, &#39;Helvetica Neue&#39;, &#39;PingFang SC&#39;, sans-serif;fontStyle=1;" value=" OS Frameworks" vertex="1">
      <mxGeometry height="60" width="500" x="80" y="80" as="geometry" />
    </mxCell>
    <mxCell id="subtitle" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;whiteSpace=wrap;rounded=0;fontSize=18;fontColor=#86868B;fontFamily=-apple-system, BlinkMacSystemFont, &#39;Helvetica Neue&#39;, &#39;PingFang SC&#39;, sans-serif;" value="Apple Design System · 纯白一页清组件库与视觉模型大全" vertex="1">
      <mxGeometry height="40" width="600" x="80" y="150" as="geometry" />
    </mxCell>
    <mxCell id="m1_title" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=20;fontColor=#1D1D1F;fontStyle=1;fontFamily=-apple-system;" value="🧅 层级 / 包含 (Hierarchy)" vertex="1">
      <mxGeometry height="30" width="300" x="80" y="240" as="geometry" />
    </mxCell>
    <mxCell id="m1_desc" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=14;fontColor=#86868B;fontFamily=-apple-system;" value="适用：核心与外围、战略与执行（如个人OS框架）" vertex="1">
      <mxGeometry height="30" width="360" x="80" y="270" as="geometry" />
    </mxCell>
    <mxCell id="m1_layer3" parent="1" style="rounded=1;arcSize=10;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#E5E5EA;strokeWidth=1;shadow=1;fontColor=#1D1D1F;fontFamily=-apple-system;fontSize=16;fontStyle=1;align=center;verticalAlign=top;spacingTop=15;" value="🛠️ 应用层 (Application)" vertex="1">
      <mxGeometry height="300" width="360" x="80" y="320" as="geometry" />
    </mxCell>
    <mxCell id="m1_layer2" parent="m1_layer3" style="rounded=1;arcSize=12;whiteSpace=wrap;html=1;fillColor=#F5F5F7;strokeColor=none;fontColor=#1D1D1F;fontFamily=-apple-system;fontSize=15;fontStyle=1;align=center;verticalAlign=top;spacingTop=15;" value="⚙️ 能力层 (Kernel)" vertex="1">
      <mxGeometry height="220" width="320" x="20" y="60" as="geometry" />
    </mxCell>
    <mxCell id="m1_layer1" parent="m1_layer3" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#E8E8ED;strokeColor=none;fontColor=#1D1D1F;fontFamily=-apple-system;fontSize=14;fontStyle=1;align=center;verticalAlign=middle;" value="🧠 认知层 (Framework)" vertex="1">
      <mxGeometry height="150" width="280" x="40" y="110" as="geometry" />
    </mxCell>
    <mxCell id="m1_node1" parent="m1_layer3" style="rounded=1;arcSize=20;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=none;fontColor=#1D1D1F;fontSize=13;fontFamily=-apple-system;shadow=0;" value="底层思维" vertex="1">
      <mxGeometry height="40" width="90" x="68" y="210" as="geometry" />
    </mxCell>
    <mxCell id="m1_node2" parent="m1_layer3" style="rounded=1;arcSize=20;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=none;fontColor=#1D1D1F;fontSize=13;fontFamily=-apple-system;shadow=0;" value="价值观" vertex="1">
      <mxGeometry height="40" width="90" x="198" y="210" as="geometry" />
    </mxCell>
    <mxCell id="m2_title" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=20;fontColor=#1D1D1F;fontStyle=1;fontFamily=-apple-system;" value="🌊 递进 / 流程 (Progression)" vertex="1">
      <mxGeometry height="30" width="300" x="520" y="240" as="geometry" />
    </mxCell>
    <mxCell id="m2_desc" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=14;fontColor=#86868B;fontFamily=-apple-system;" value="适用：步骤、演变、闭环（如学习路径）" vertex="1">
      <mxGeometry height="30" width="360" x="520" y="270" as="geometry" />
    </mxCell>
    <mxCell id="m2_step1" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#F5F5F7;strokeColor=none;fontColor=#1D1D1F;fontSize=16;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;" value="1. 信息输入" vertex="1">
      <mxGeometry height="60" width="280" x="520" y="340" as="geometry" />
    </mxCell>
    <mxCell id="m2_step2" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#F5F5F7;strokeColor=none;fontColor=#1D1D1F;fontSize=16;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;" value="2. 逻辑处理" vertex="1">
      <mxGeometry height="60" width="280" x="550" y="440" as="geometry" />
    </mxCell>
    <mxCell id="m2_step3" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#007AFF;strokeColor=none;fontColor=#FFFFFF;fontSize=16;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;shadow=0;" value="3. 视觉呈现" vertex="1">
      <mxGeometry height="60" width="280" x="580" y="540" as="geometry" />
    </mxCell>
    <mxCell id="m2_edge1" edge="1" parent="1" source="m2_step1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#C7C7CC;strokeWidth=2;endArrow=blockThin;endFill=1;entryX=0.1;entryY=0;entryDx=0;entryDy=0;exitX=0.1;exitY=1;exitDx=0;exitDy=0;" target="m2_step2">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="m2_edge2" edge="1" parent="1" source="m2_step2" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#C7C7CC;strokeWidth=2;endArrow=blockThin;endFill=1;entryX=0.1;entryY=0;entryDx=0;entryDy=0;exitX=0.1;exitY=1;exitDx=0;exitDy=0;" target="m2_step3">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="m3_title" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=20;fontColor=#1D1D1F;fontStyle=1;fontFamily=-apple-system;" value="🎯 对比 / 矩阵 (Matrix)" vertex="1">
      <mxGeometry height="30" width="300" x="960" y="240" as="geometry" />
    </mxCell>
    <mxCell id="m3_desc" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=14;fontColor=#86868B;fontFamily=-apple-system;" value="适用：权衡、分类、定位（如时间管理）" vertex="1">
      <mxGeometry height="30" width="360" x="960" y="270" as="geometry" />
    </mxCell>
    <mxCell id="m3_q1" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#FFECEE;strokeColor=none;fontColor=#D70015;fontSize=15;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;" value="🚀 重要且紧急&#xa;(Do First)" vertex="1">
      <mxGeometry height="140" width="160" x="960" y="320" as="geometry" />
    </mxCell>
    <mxCell id="m3_q2" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#EBF4FF;strokeColor=none;fontColor=#007AFF;fontSize=15;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;" value="📆 重要不紧急&#xa;(Schedule)" vertex="1">
      <mxGeometry height="140" width="160" x="1140" y="320" as="geometry" />
    </mxCell>
    <mxCell id="m3_q3" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#F5F5F7;strokeColor=none;fontColor=#86868B;fontSize=15;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;" value="🤝 紧急不重要&#xa;(Delegate)" vertex="1">
      <mxGeometry height="140" width="160" x="960" y="480" as="geometry" />
    </mxCell>
    <mxCell id="m3_q4" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#F5F5F7;strokeColor=none;fontColor=#86868B;fontSize=15;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;" value="🗑️ 不重要不紧急&#xa;(Eliminate)" vertex="1">
      <mxGeometry height="140" width="160" x="1140" y="480" as="geometry" />
    </mxCell>
    <mxCell id="m4_title" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=20;fontColor=#1D1D1F;fontStyle=1;fontFamily=-apple-system;" value="🌳 发散 / 聚合 (Mindmap)" vertex="1">
      <mxGeometry height="30" width="300" x="80" y="680" as="geometry" />
    </mxCell>
    <mxCell id="m4_desc" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=14;fontColor=#86868B;fontFamily=-apple-system;" value="适用：因素拆解、头脑风暴" vertex="1">
      <mxGeometry height="30" width="360" x="80" y="710" as="geometry" />
    </mxCell>
    <mxCell id="m4_root" parent="1" style="rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#1D1D1F;strokeColor=none;fontColor=#FFFFFF;fontSize=16;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;" value="⭐️ 核心概念" vertex="1">
      <mxGeometry height="50" width="140" x="80" y="820" as="geometry" />
    </mxCell>
    <mxCell id="m4_node1" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#E5E5EA;strokeWidth=1;fontColor=#1D1D1F;fontSize=14;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;shadow=1;" value="要素 A" vertex="1">
      <mxGeometry height="45" width="120" x="300" y="750" as="geometry" />
    </mxCell>
    <mxCell id="m4_node2" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#E5E5EA;strokeWidth=1;fontColor=#1D1D1F;fontSize=14;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;shadow=1;" value="要素 B" vertex="1">
      <mxGeometry height="45" width="120" x="300" y="822.5" as="geometry" />
    </mxCell>
    <mxCell id="m4_node3" parent="1" style="rounded=1;arcSize=15;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#E5E5EA;strokeWidth=1;fontColor=#1D1D1F;fontSize=14;fontStyle=1;fontFamily=-apple-system;align=center;verticalAlign=middle;shadow=1;" value="要素 C" vertex="1">
      <mxGeometry height="45" width="120" x="300" y="895" as="geometry" />
    </mxCell>
    <mxCell id="m4_edge1" edge="1" parent="1" source="m4_root" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#E5E5EA;strokeWidth=2;endArrow=none;" target="m4_node1">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="267" y="845" />
          <mxPoint x="267" y="773" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="m4_edge2" edge="1" parent="1" source="m4_root" style="edgeStyle=orthogonalEdgeStyle;rounded=1;curved=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#E5E5EA;strokeWidth=2;endArrow=none;" target="m4_node2">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="m4_edge3" edge="1" parent="1" source="m4_root" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#E5E5EA;strokeWidth=2;endArrow=none;" target="m4_node3">
      <mxGeometry relative="1" as="geometry">
        <Array as="points">
          <mxPoint x="266" y="845" />
          <mxPoint x="266" y="917" />
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="comp_title" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=20;fontColor=#1D1D1F;fontStyle=1;fontFamily=-apple-system;" value="🧩 零碎 Apple 视觉组件库 (复制备用)" vertex="1">
      <mxGeometry height="30" width="400" x="520" y="680" as="geometry" />
    </mxCell>
    <mxCell id="badge_blue" parent="1" style="rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#EBF4FF;strokeColor=none;fontColor=#007AFF;fontSize=13;fontStyle=1;fontFamily=-apple-system;" value="系统核心" vertex="1">
      <mxGeometry height="30" width="80" x="520" y="740" as="geometry" />
    </mxCell>
    <mxCell id="badge_green" parent="1" style="rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#E8F8F5;strokeColor=none;fontColor=#34C759;fontSize=13;fontStyle=1;fontFamily=-apple-system;" value="已完成" vertex="1">
      <mxGeometry height="30" width="80" x="610" y="740" as="geometry" />
    </mxCell>
    <mxCell id="badge_gray" parent="1" style="rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#F2F2F7;strokeColor=none;fontColor=#8E8E93;fontSize=13;fontStyle=1;fontFamily=-apple-system;" value="v2.0 迭代" vertex="1">
      <mxGeometry height="30" width="80" x="700" y="740" as="geometry" />
    </mxCell>
    <mxCell id="text_note" parent="1" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=13;fontColor=#86868B;fontFamily=-apple-system;" value="📝 细节注释：iOS 极简风不强调连线，排版靠留白和对齐产生逻辑关联。" vertex="1">
      <mxGeometry height="30" width="450" x="520" y="800" as="geometry" />
    </mxCell>
    <mxCell id="MMO793naEjlGUJ7ov40e-3" parent="1" style="rounded=1;arcSize=20;whiteSpace=wrap;html=1;&#xa;fillColor=#FFFFFF08;strokeColor=#FFFFFF15;&#xa;shadow=1;shadowColor=#00FFE556;shadowOffsetX=0;shadowOffsetY=8;shadowBlur=25;" value="" vertex="1">
      <mxGeometry height="60" width="120" x="514" y="895" as="geometry" />
    </mxCell>
    <mxCell id="MMO793naEjlGUJ7ov40e-4" parent="1" style="rounded=1;arcSize=50;whiteSpace=wrap;html=1;&#xa;fillColor=#FFFFFF0D;strokeColor=#FFFFFF10;&#xa;shadow=1;shadowColor=#007AFF33;shadowOffsetX=0;shadowOffsetY=4;shadowBlur=12;&#xa;fontColor=#FFFFFF;fontSize=14;fontStyle=1;" value="" vertex="1">
      <mxGeometry height="60" width="120" x="657" y="895" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>

```