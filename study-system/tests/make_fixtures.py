"""生成多格式测试样本：docx / pptx / xlsx / html / md / txt(GBK) / rtf。
运行：python make_fixtures.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fixtures")
os.makedirs(OUT, exist_ok=True)

TITLE = "认知负荷理论导论"
PARAS = [
    "认知负荷理论由 John Sweller 在 1988 年提出，用来解释为什么有些教学材料让人学得吃力。",
    "该理论把工作记忆的负荷分为三类。内在负荷来自材料本身的元素交互复杂度，与学习者的既有图式有关。",
    "外在负荷来自不当的教学设计，例如把图与解释文字分置两页，迫使学习者在两者间来回搜索。",
    "相关负荷指用于构建和自动化图式的有效努力，它是唯一值得主动增加的负荷。",
    "举个例子：如果一份讲义要求读者同时记住七个新符号的含义再理解公式，那么超出的部分就是纯粹的外在负荷。",
    "因此教学设计的原则是：降低外在负荷，管理内在负荷，释放相关负荷。",
    "这一原则可以通过对比实验检验：同一内容分别用整合式与分离式排版，测量迁移测试成绩差异。",
    "把该理论迁移到文档写作上，结论是：解释应当紧贴它所指的对象，而不是另起一节统一说明。",
]


def make_docx(path):
    import docx
    d = docx.Document()
    d.add_heading(TITLE, level=1)
    for p in PARAS:
        d.add_paragraph(p)
    d.add_heading("小结", level=2)
    d.add_paragraph("三种负荷的区分是后续所有设计原则的基础。")
    d.save(path)


def make_pptx(path):
    from pptx import Presentation
    from pptx.util import Inches
    prs = Presentation()
    layout = prs.slide_layouts[1]
    s1 = prs.slides.add_slide(layout)
    s1.shapes.title.text = TITLE
    s1.placeholders[1].text = PARAS[0]
    s2 = prs.slides.add_slide(layout)
    s2.shapes.title.text = "三种负荷"
    s2.placeholders[1].text = "\n".join(PARAS[1:4])
    s3 = prs.slides.add_slide(layout)
    s3.shapes.title.text = "设计原则"
    s3.placeholders[1].text = PARAS[5] + "\n" + PARAS[7]
    prs.save(path)


def make_xlsx(path):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "负荷类型"
    ws.append(["负荷类型", "来源", "设计对策"])
    ws.append(["内在负荷", "材料元素交互", "分段呈现"])
    ws.append(["外在负荷", "不当教学设计", "整合图文"])
    ws.append(["相关负荷", "图式构建", "适度保留"])
    wb.save(path)


def make_html(path):
    rows = "".join(f"<p>{p}</p>\n" for p in PARAS)
    html = f"""<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8"><title>{TITLE}</title>
<style>body{{font-family:serif}}</style></head>
<body><h1>{TITLE}</h1>
{rows}
<script>console.log("should be stripped")</script>
</body></html>"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)


def make_md(path):
    lines = [f"# {TITLE}", ""]
    for p in PARAS:
        lines += [p, ""]
    lines += ["## 小结", "", "三种负荷的区分是后续所有设计原则的基础。", ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def make_txt_gbk(path):
    body = TITLE + "\r\n\r\n" + "\r\n\r\n".join(PARAS)
    with open(path, "wb") as f:
        f.write(body.encode("gb18030"))


def make_rtf(path):
    body = "\\par ".join(PARAS)
    rtf = "{\\rtf1\\ansi\\ansicpg936{\\fonttbl{\\f0 SimSun;}}\\f0\\fs24 " + body + "}"
    with open(path, "w", encoding="ascii", errors="ignore") as f:
        f.write(rtf)


def main():
    targets = [
        ("sample.docx", make_docx),
        ("sample.pptx", make_pptx),
        ("sample.xlsx", make_xlsx),
        ("sample.html", make_html),
        ("sample.md", make_md),
        ("sample_gbk.txt", make_txt_gbk),
        ("sample.rtf", make_rtf),
    ]
    for name, fn in targets:
        p = os.path.join(OUT, name)
        try:
            fn(p)
            print(f"OK   {name}  {os.path.getsize(p)} bytes")
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL {name}: {exc}", file=sys.stderr)
            raise


if __name__ == "__main__":
    main()
