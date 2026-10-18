"""PDF with a real text layer -> IR. Fonts, sizes, bold/italic, colour, tables
and pictures come straight from the file; nothing is guessed."""
from __future__ import annotations

import io
import re
from collections import Counter
from statistics import median
from typing import List, Optional

from . import layout_common as lc
from .model import Image, Page, Para, Run, Table, is_cjk

_PUA = {"": "•", "": "▪", "": "➢", "": "✓", "": "❖",
        "": "●", "": "□", "": "•"}
_PUA_RE = re.compile("[-]")


def _clean(t: str) -> str:
    t = t.replace("­", "").replace("\x00", "")
    return _PUA_RE.sub(lambda m: _PUA.get(m.group(0), ""), t)


def _font(name: str) -> Optional[str]:
    if not name:
        return None
    name = name.split("+", 1)[-1]                  # ABCDEF+Subset prefix
    name = re.split(r"[-,]", name, maxsplit=1)[0]
    return re.sub(r"(MT|PS)$", "", name) or None


def _style(span: dict):
    f = span.get("font", "") or ""
    fl = f.lower()
    flags = span.get("flags", 0)
    bold = bool(flags & 16) or any(k in fl for k in ("bold", "black", "heavy", "semibold"))
    italic = bool(flags & 2) or "italic" in fl or "oblique" in fl
    col = span.get("color", 0) or 0
    color = None if col == 0 else "%06X" % col
    return (lc.snap_half(span.get("size", 10.5)), bold, italic, color, _font(f))


class _Builder:
    """Accumulates the runs of one paragraph, joining visual lines properly."""

    def __init__(self):
        self.runs: List[Run] = []

    def text(self) -> str:
        return "".join(r.text for r in self.runs)

    def add(self, t: str, st):
        if not t:
            return
        size, bold, italic, color, font = st
        if self.runs:
            r = self.runs[-1]
            if (r.size, r.bold, r.italic, r.color, r.font) == st:
                r.text += t
                return
        self.runs.append(Run(t, size, bold, italic, color, font))

    def new_line(self, nxt: str):
        cur = self.text()
        if not cur or not nxt:
            return
        last, first = cur[-1], nxt[0]
        if last == "-" and len(cur) > 1 and cur[-2].isalpha() and first.islower() and first.isascii():
            self.runs[-1].text = self.runs[-1].text[:-1]       # soft hyphen at line end
        elif is_cjk(last) or is_cjk(first) or last == " ":
            pass
        else:
            self.runs[-1].text += " "


def _split_paragraphs(block: dict) -> List[List[dict]]:
    """PyMuPDF blocks are often several paragraphs; split where the gap grows."""
    lines = [l for l in block["lines"] if any(s["text"].strip() for s in l["spans"])]
    if not lines:
        return []
    out = [[lines[0]]]
    for prev, cur in zip(lines, lines[1:]):
        size = max(s["size"] for s in cur["spans"])
        gap = cur["bbox"][1] - prev["bbox"][3]
        if gap > 0.45 * size:
            out.append([cur])
        else:
            out[-1].append(cur)
    return out


def build_page(page, keep_images: bool = True) -> Page:
    W, H = page.rect.width, page.rect.height
    d = page.get_text("dict")
    blocks = d.get("blocks", [])

    # ---- tables
    tables = []
    try:
        tf = page.find_tables()
        for t in tf.tables:
            rows = [[_clean((c or "").replace("\n", " ")).strip() for c in r] for r in t.extract()]
            if t.row_count >= 2 and t.col_count >= 2 and sum(1 for r in rows for c in r if c) >= 3:
                widths = None
                try:
                    cells = t.rows[0].cells
                    widths = [(c[2] - c[0]) if c else 0 for c in cells]
                    if not all(w > 4 for w in widths):
                        widths = None
                except Exception:
                    pass
                tables.append((t.bbox, rows, widths))
    except Exception:
        pass

    def in_table(bbox):
        cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
        for k, (tb, _, _) in enumerate(tables):
            if tb[0] - 1 <= cx <= tb[2] + 1 and tb[1] - 1 <= cy <= tb[3] + 1:
                return k
        return -1

    # ---- body size = most common size by character count
    cnt = Counter()
    for b in blocks:
        if b["type"] == 0:
            for l in b["lines"]:
                for s in l["spans"]:
                    cnt[lc.snap_half(s["size"])] += len(s["text"].strip())
    body = cnt.most_common(1)[0][0] if cnt else 10.5

    text_blocks = [b for b in blocks if b["type"] == 0 and in_table(b["bbox"]) < 0
                   and any(s["text"].strip() for l in b["lines"] for s in l["spans"])]
    rect = lambda b: b["bbox"]
    x0s = [b["bbox"][0] for b in text_blocks]
    margins = lc.pick_margins(x0s, [b["bbox"][1] for b in text_blocks],
                              [b["bbox"][2] for b in text_blocks],
                              [b["bbox"][3] for b in text_blocks], W, H)
    left_m, right_m = margins[0], W - margins[2]

    # ---- order: keep the file's own order unless the page is plainly one column
    ordered = list(blocks)
    if lc.find_gutter([(b["bbox"][0], b["bbox"][2]) for b in text_blocks]) is None:
        ordered = sorted(blocks, key=lambda b: (round(b["bbox"][1], 1), b["bbox"][0]))

    out = Page(W, H, [], "native", margins)
    emitted_tables = set()
    prev_bottom = None

    def gap_before(y0, size):
        if prev_bottom is None:
            return 0.0
        return lc.clamp(y0 - prev_bottom - 0.2 * size, 0.0, 60.0)

    for b in ordered:
        bbox = b["bbox"]
        k = in_table(bbox)
        if k >= 0:
            if k not in emitted_tables:
                emitted_tables.add(k)
                tb, rows, widths = tables[k]
                out.blocks.append(Table(rows, widths, gap_before(tb[1], body)))
                prev_bottom = tb[3]
            continue

        if b["type"] == 1:
            if not keep_images:
                continue
            w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
            if w < 6 or h < 6 or (w * h) / (W * H) > 0.85:
                continue
            data = _image_bytes(b)
            if not data:
                continue
            cx = (bbox[0] + bbox[2]) / 2
            align = "center" if abs(cx - W / 2) < W * 0.04 and bbox[0] > left_m + 12 else "left"
            ind = max(0.0, bbox[0] - left_m) if align == "left" else 0.0
            img = Image(data, w, h, align, gap_before(bbox[1], body), ind)
            out.blocks.append(img)
            prev_bottom = bbox[3]
            continue

        for lines in _split_paragraphs(b):
            para = _para(lines, body, left_m, right_m, W)
            if para is None:
                continue
            first = lines[0]["bbox"]
            para.space_before = gap_before(first[1], max(s["size"] for s in lines[0]["spans"]))
            out.blocks.append(para)
            prev_bottom = lines[-1]["bbox"][3]
    return out


def _para(lines, body, left_m, right_m, W) -> Optional[Para]:
    bld = _Builder()
    sizes = []
    for n, ln in enumerate(lines):
        spans = [s for s in ln["spans"] if s["text"] != ""]
        if n:
            nxt = next((_clean(s["text"]).lstrip() for s in spans if _clean(s["text"]).strip()), "")
            bld.new_line(nxt)
        for s in spans:
            t = _clean(s["text"])
            if n == 0 and not bld.runs:
                t = t.lstrip()
            bld.add(t, _style(s))
            if t.strip():
                sizes.append((lc.snap_half(s["size"]), len(t.strip())))
    if bld.runs:
        bld.runs[-1].text = bld.runs[-1].text.rstrip()
    txt = bld.text().strip()
    if not txt:
        return None

    total = sum(n for _, n in sizes) or 1
    size = sum(s * n for s, n in sizes) / total
    x0 = min(l["bbox"][0] for l in lines)
    x1 = max(l["bbox"][2] for l in lines)
    para = Para(bld.runs)

    # alignment
    cx = (x0 + x1) / 2
    if len(lines) <= 2 and abs(cx - W / 2) < W * 0.03 and x0 > left_m + 0.08 * W:
        para.align = "center"
    elif len(lines) == 1 and x1 >= right_m - 6 and x0 > W * 0.45:
        para.align = "right"
    else:
        para.left_indent = max(0.0, x0 - left_m)
        if len(lines) > 1 and x1 < right_m - 2 * size:
            para.right_indent = right_m - x1
        if len(lines) > 1:
            fi = lines[0]["bbox"][0] - min(l["bbox"][0] for l in lines[1:])
            if abs(fi) > 0.8 * size:
                para.first_indent = fi
                para.left_indent = max(0.0, min(l["bbox"][0] for l in lines[1:]) - left_m)

    # line pitch
    if len(lines) > 1:
        ys = [l["spans"][0]["origin"][1] for l in lines]
        pitch = median(b - a for a, b in zip(ys, ys[1:]))
        if size * 0.9 < pitch < size * 3.5:
            para.line_pitch = pitch

    # headings
    ratio = size / body if body else 1.0
    allbold = all(r.bold for r in bld.runs if r.text.strip())
    if ratio >= 1.18 and len(txt) <= 100 and len(lines) <= 3:
        para.heading = lc.heading_level(ratio)
    elif allbold and len(lines) == 1 and len(txt) <= 60 and txt[-1] not in lc.TERMINAL:
        para.heading = 3
    return para


def _image_bytes(b: dict) -> Optional[bytes]:
    data = b.get("image")
    if not data:
        return None
    ext = (b.get("ext") or "").lower()
    try:
        from PIL import Image as PI
        im = PI.open(io.BytesIO(data))
        if ext in ("png", "jpg", "jpeg", "gif", "bmp", "tiff") and im.mode in ("RGB", "L", "RGBA", "P", "1"):
            return data
        if im.mode in ("CMYK", "LAB", "YCbCr", "I;16", "I", "F"):
            im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "PNG")
        return buf.getvalue()
    except Exception:
        return None
