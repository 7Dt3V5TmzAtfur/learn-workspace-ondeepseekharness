"""把图谱布局画成 PNG，用于人工检查图是否真的可读。仅测试用。

用法：node tests/dump-graph.mjs && python tests/preview_graph.py
或用下面这段先导出一份布局 JSON。
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAYOUT = os.path.join(HERE, "_graph.json")

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow 不可用")
    sys.exit(1)

if not os.path.exists(LAYOUT):
    print("缺少 _graph.json，先运行 make-fixtures 或导出布局。")
    sys.exit(1)

with open(LAYOUT, encoding="utf-8") as f:
    g = json.load(f)

W, H = g["width"], g["height"]
SCALE = 1.0
img = Image.new("RGB", (int(W * SCALE), int(H * SCALE)), "#ffffff")
d = ImageDraw.Draw(img)


def load_font(size):
    candidates = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()


font = load_font(12)
font_lg = load_font(13)

KIND_FILL = {
    "concept": ("#e8f0fe", "#4f8ff7"),
    "premise": ("#f3ebfd", "#ab7aef"),
    "principle": ("#e6f6ee", "#30a46c"),
    "method": ("#e6f6ee", "#30a46c"),
    "problem": ("#fdeaea", "#e5484d"),
    "anti-pattern": ("#fdeaea", "#e5484d"),
    "risk": ("#fdeaea", "#e5484d"),
    "example": ("#fff3e0", "#ffb86c"),
    "taxonomy": ("#e0f5f5", "#00a0a0"),
    "protocol": ("#e0f5f5", "#00a0a0"),
    "tool-type": ("#e0f5f5", "#00a0a0"),
}

# 读 relations.json 拿 kind
rel_path = r"D:\learn\.study\chapter4-d6eaed\relations.json"
kinds = {}
if os.path.exists(rel_path):
    with open(rel_path, encoding="utf-8") as f:
        rel = json.load(f)
    for n in rel.get("nodes", []):
        kinds[n["id"]] = n.get("kind", "concept")

# 画边（按宿主给出的折线拐点）
for e in g["edges"]:
    pts = e.get("points") or []
    if not pts:
        continue
    color = "#bbbbbb" if not e.get("dashed") else "#d9b3b3"
    for k in range(1, len(pts)):
        d.line([tuple(pts[k - 1]), tuple(pts[k])], fill=color, width=1)
    # 箭头落在最后一段末端
    (px, py), (qx, qy) = pts[-2], pts[-1]
    if not e.get("dashed"):
        if abs(qy - py) > abs(qx - px):
            direction = 1 if qy > py else -1
            d.polygon([(qx, qy), (qx - 4, qy - 7 * direction), (qx + 4, qy - 7 * direction)], fill="#999999")
        else:
            direction = 1 if qx > px else -1
            d.polygon([(qx, qy), (qx - 7 * direction, qy - 4), (qx - 7 * direction, qy + 4)], fill="#999999")

# 画节点
for n in g["nodes"]:
    kind = kinds.get(n["id"], "concept")
    fill, stroke = KIND_FILL.get(kind, ("#f0f0f0", "#999999"))
    x, y, w, h = n["x"], n["y"], n["w"], n["h"]
    d.rounded_rectangle([x, y, x + w, y + h], radius=8, fill=fill, outline=stroke, width=2)
    label = n["label"]
    # 简易折行
    lines = []
    cur = ""
    for ch in label:
        if len(cur) >= 11:
            lines.append(cur)
            cur = ch
            if len(lines) >= 3:
                break
        else:
            cur += ch
    if cur and len(lines) < 3:
        lines.append(cur)
    ty = y + h / 2 - (len(lines) - 1) * 7
    for i, ln in enumerate(lines):
        bbox = d.textbbox((0, 0), ln, font=font)
        tw = bbox[2] - bbox[0]
        d.text((x + w / 2 - tw / 2, ty + i * 14 - 6), ln, fill="#111111", font=font)

out = os.path.join(HERE, "_graph.png")
img.save(out)
print(f"已生成 {out}  ({W}x{H}, {len(g['nodes'])} 节点, {len(g['edges'])} 边)")
