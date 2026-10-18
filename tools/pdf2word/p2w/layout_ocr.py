"""OCR lines -> IR. The engine gives us text and a box per line; everything
else (paragraphs, headings, columns, indents, alignment, font size, tables) is
recovered from the geometry of those boxes."""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from statistics import median
from typing import List, Optional

from . import layout_common as lc
from .model import Page, Para, Run, Table, is_cjk, join_lines
from .ocr import OLine

# Ink height of an OCR line box vs. the font size that produced it. The box is
# tight around the glyphs, so a line without ascenders/descenders is shorter
# than one with them; width per character is steadier, and the two are blended.
INK_TO_FONT = 0.85


def _em_units(text: str) -> float:
    n = 0.0
    for ch in text:
        if is_cjk(ch):
            n += 1.0
        elif ch == " ":
            n += 0.28
        elif ch.isalnum() and ch.isascii():
            n += 0.52
        elif ch.isascii():
            n += 0.35
        else:
            n += 0.55
    return n


def font_px(line: OLine) -> float:
    """Estimated font size of a line, in image pixels."""
    t = line.text
    fh = line.h * INK_TO_FONT
    if len(t) < 4:
        return fh
    fw = (line.x1 - line.x0) / max(1.0, _em_units(t))
    return fh if len(t) < 10 else 0.7 * fw + 0.3 * fh

_LIST_START = re.compile(
    r"^\s*(?:[•·●○■□▪▫◆◇▶►‣\-–—*]\s|\d{1,3}[.、)）]\s*\S|[（(]\d{1,3}[)）]|[一二三四五六七八九十]{1,3}[、.．]\s*\S|[a-zA-Z][.)]\s+\S)")


@dataclass
class _Item:
    kind: str                        # line | table
    x0: float
    y0: float
    x1: float
    y1: float
    line: Optional[OLine] = None
    fs: float = 0.0
    table: Optional[Table] = None
    side: str = "C"


def _rect(i: _Item):
    return (i.x0, i.y0, i.x1, i.y1)


# ---------------------------------------------------------------------- tables

def _rows(lines: List[OLine], hb: float) -> List[List[OLine]]:
    rows: List[List[OLine]] = []
    for ln in sorted(lines, key=lambda l: (l.y0 + l.y1) / 2):
        cy = (ln.y0 + ln.y1) / 2
        for r in rows:
            ry0 = min(l.y0 for l in r)
            ry1 = max(l.y1 for l in r)
            ov = min(ry1, ln.y1) - max(ry0, ln.y0)
            if ov > 0.5 * min(ry1 - ry0, ln.h) and abs(cy - (ry0 + ry1) / 2) < 0.6 * hb:
                r.append(ln)
                break
        else:
            rows.append([ln])
    for r in rows:
        r.sort(key=lambda l: l.x0)
    rows.sort(key=lambda r: min(l.y0 for l in r))
    return rows


def _cells(row: List[OLine], hb: float) -> List[OLine]:
    """Neighbouring lines closer than a couple of em are one cell's text."""
    out: List[OLine] = []
    for l in row:
        if out and l.x0 - out[-1].x1 < 1.5 * hb:
            out[-1] = OLine(out[-1].words + l.words)
        else:
            out.append(l)
    return out


_SENTENCE = re.compile("[，。、；：！？,.;:!?]")


def _prose_like(t: str) -> bool:
    t = t.strip()
    return len(t) >= 20 or (len(t) >= 12 and bool(_SENTENCE.search(t)))


def _find_tables(lines: List[OLine], hb: float, page_w: float, k: float):
    rows = _rows(lines, hb)
    cells = [_cells(r, hb) for r in rows]
    tables = []
    used = set()
    i = 0
    while i < len(rows):
        if len(cells[i]) < 2:
            i += 1
            continue
        j = i
        while j + 1 < len(rows) and len(cells[j + 1]) >= 2 and rows[j + 1][0].y0 - rows[j][-1].y1 < 2.2 * hb:
            j += 1
        run = list(range(i, j + 1))
        i = j + 1
        if len(run) < 3:
            continue
        xs = sorted(c.x0 for r in run for c in cells[r])
        clusters: List[List[float]] = [[xs[0]]]
        for x in xs[1:]:
            if x - clusters[-1][-1] < 1.5 * hb:
                clusters[-1].append(x)
            else:
                clusters.append([x])
        centers = [sum(c) / len(c) for c in clusters]
        ncol = len(centers)
        if ncol > 10:
            continue
        # most rows must put their cells on the shared column starts
        aligned = sum(1 for r in run for c in cells[r]
                      if min(abs(c.x0 - cc) for cc in centers) < 1.5 * hb)
        total = sum(len(cells[r]) for r in run)
        if aligned < 0.8 * total:
            continue
        widths = [c.x1 - c.x0 for r in run for c in cells[r]]
        chars = [len(c.text) for r in run for c in cells[r]]
        if ncol == 2 and (median(widths) > 0.33 * page_w or median(chars) > 40):
            continue                               # two columns of prose
        if median(chars) > 70:
            continue
        # Sentences in the cells = two columns of running text, not a table. Check this for
        # any column count: a book page whose columns happen to be narrow looks exactly
        # like a 2-4 column table to the geometry alone.
        texts = [c.text for r in run for c in cells[r]]
        if sum(1 for t in texts if _prose_like(t)) >= 0.5 * len(texts):
            continue
        grid = []
        for r in run:
            row = [""] * ncol
            for c in cells[r]:
                col = min(range(ncol), key=lambda q: abs(centers[q] - c.x0))
                row[col] = (row[col] + " " + c.text).strip() if row[col] else c.text
            grid.append(row)
        right = max(c.x1 for r in run for c in cells[r])
        bounds = centers + [right]
        colw = [(bounds[q + 1] - bounds[q]) * k for q in range(ncol)]
        t = Table(grid, colw)
        x0 = min(c.x0 for r in run for c in cells[r])
        y0 = min(c.y0 for r in run for c in cells[r])
        y1 = max(c.y1 for r in run for c in cells[r])
        tables.append(_Item("table", x0, y0, right, y1, table=t))
        for r in run:
            for l in rows[r]:
                used.add(id(l))
    return tables, [l for l in lines if id(l) not in used]


# ------------------------------------------------------------------------ main

def build_page(lines: List[OLine], img_w: float, img_h: float, k: float) -> Page:
    """`k` is points per pixel of the OCR'd image."""
    lines = [l for l in lines if l.words and l.text.strip() and l.h > 0]
    page = Page(img_w * k, img_h * k, [], "ocr")
    if not lines:
        page.note = "此页没有识别到文字"
        return page

    heights = [l.h for l in lines if len(l.text) >= 8] or [l.h for l in lines]
    hb = median(heights)
    # Engines sometimes cut one visual line into pieces; sew them back together.
    lines = [c for r in _rows(lines, hb) for c in _cells(r, hb)]
    page.margins = lc.pick_margins([l.x0 * k for l in lines], [l.y0 * k for l in lines],
                                   [l.x1 * k for l in lines], [l.y1 * k for l in lines],
                                   page.width, page.height)
    left_m_px = page.margins[0] / k
    right_m_px = img_w - page.margins[2] / k

    tables, rest = _find_tables(lines, hb, img_w, k)
    items = [_Item("line", l.x0, l.y0, l.x1, l.y1, line=l, fs=font_px(l)) for l in rest] + tables

    # sides of the gutter, for left edge / right edge statistics
    gx = lc.find_gutter([(i.x0, i.x1) for i in items])
    for i in items:
        if gx is not None:
            i.side = "L" if i.x1 <= gx else "R" if i.x0 >= gx else "C"
    edges = {}
    for side in "LRC":
        ls = [i for i in items if i.side == side and i.kind == "line"]
        if not ls:
            continue
        buckets = Counter(round(i.x0 / (0.6 * hb)) for i in ls)
        top = buckets.most_common(1)[0][0]
        left = sum(i.x0 for i in ls if round(i.x0 / (0.6 * hb)) == top) / buckets[top]
        xr = sorted(i.x1 for i in ls)
        edges[side] = (left, xr[int(0.9 * (len(xr) - 1))])

    ordered = lc.reading_order(items, _rect)
    dys = [q.y0 - p.y0 for p, q in zip(ordered, ordered[1:])
           if p.kind == q.kind == "line" and p.side == q.side and 0.6 * hb < q.y0 - p.y0 < 3 * hb]
    pitch = median(dys) if len(dys) >= 3 else 1.5 * hb       # normal line-to-line distance

    # ---- group lines into paragraphs
    groups: List[List[_Item]] = []
    cur: List[_Item] = []
    flush = lambda: (groups.append(cur[:]), cur.clear()) if cur else None
    for it in ordered:
        if it.kind == "table":
            flush()
            groups.append([it])
            continue
        if cur and _breaks(cur, it, hb, edges, pitch):
            flush()
        cur.append(it)
    flush()

    # ---- paragraphs
    paras: List[tuple] = []          # (group, Para, size_px_ink, chars)
    for g in groups:
        if g[0].kind == "table":
            paras.append((g, g[0].table, 0, 0))
            continue
        text = ""
        for it in g:
            text = join_lines(text, it.line.text.strip())
        ink = median([it.fs for it in g])
        paras.append((g, Para([Run(text)]), ink, len(text)))

    sizes = [(ink * k, n) for _, p, ink, n in paras if isinstance(p, Para)]
    body = _weighted_median(sizes) if sizes else 10.5
    body = lc.clamp(lc.snap_half(body), 7.0, 18.0)

    prev = None                      # (last line y0, bottom, was_table)
    for g, p, ink, n in paras:
        top = min(i.y0 for i in g)
        if isinstance(p, Table):
            p.space_before = _gap(prev, top, k, body, pitch)
            page.blocks.append(p)
            prev = (g[0].y0, max(i.y1 for i in g), True)
            continue
        raw = ink * k
        size = body if abs(raw - body) < 0.15 * body else lc.clamp(lc.snap_half(raw), 6.0, 48.0)
        side = g[0].side
        l0, r0 = edges.get(side, edges.get("C", (left_m_px, right_m_px)))
        x0 = min(i.x0 for i in g)
        x1 = max(i.x1 for i in g)
        txt = p.text.strip()
        p.runs[0].text = txt
        p.runs[0].size = size

        ratio = size / body
        if ratio >= 1.3 and len(txt) <= 80 and len(g) <= 3 and txt[-1] not in "。.，,；;":
            p.heading = lc.heading_level(ratio)
            p.runs[0].bold = True

        width_mid = (l0 + r0) / 2 if side != "C" else img_w / 2
        if len(g) <= 2 and abs((x0 + x1) / 2 - width_mid) < 0.03 * img_w and x0 > l0 + 0.06 * img_w:
            p.align = "center"
        elif len(g) == 1 and x1 >= right_m_px - 0.02 * img_w and x0 > 0.5 * img_w and not p.heading:
            p.align = "right"
        else:
            rest_left = min(i.x0 for i in g[1:]) if len(g) > 1 else g[0].x0
            p.left_indent = max(0.0, (rest_left - left_m_px) * k)
            if p.left_indent < 1.2 * size:
                p.left_indent = 0.0
            if len(g) > 1 and x1 < right_m_px - 2 * size / k:
                p.right_indent = (right_m_px - x1) * k
            fi = (g[0].x0 - rest_left) * k
            if len(g) > 1 and abs(fi) >= 0.8 * size:
                p.first_indent = fi
        if len(g) > 1:
            ys = [i.y0 for i in g]
            pitch = median(b - a for a, b in zip(ys, ys[1:])) * k
            if size * 0.9 < pitch < size * 3.5:
                p.line_pitch = pitch
        p.space_before = _gap(prev, top, k, size, pitch)
        page.blocks.append(p)
        prev = (g[-1].y0, max(i.y1 for i in g), False)
    if body < 9.0:                                   # a crop of a photo: 5pt type on a 3in page
        _rescale(page, min(3.0, 10.5 / body))
    return page


def _rescale(page: Page, f: float):
    """Scale a page and everything on it by f, so the type ends up a normal size."""
    page.width *= f
    page.height *= f
    page.margins = tuple(m * f for m in page.margins)
    for b in page.blocks:
        if isinstance(b, Para):
            b.left_indent *= f
            b.first_indent *= f
            b.right_indent *= f
            b.space_before *= f
            b.space_after *= f
            if b.line_pitch:
                b.line_pitch *= f
            for r in b.runs:
                if r.size:
                    r.size = lc.clamp(lc.snap_half(r.size * f), 6.0, 48.0)
        elif isinstance(b, Table):
            b.space_before *= f
            if b.col_widths:
                b.col_widths = [w * f for w in b.col_widths]


def _gap(prev, top, k, size, pitch) -> float:
    """Space above a block: what is left of the distance to the previous block
    once one normal line pitch is taken off (Word adds the pitch itself)."""
    if prev is None:
        return 0.0
    last_y0, bottom, was_table = prev
    if was_table:
        return lc.clamp((top - bottom) * k, 0.0, 48.0)
    extra = (top - last_y0) - pitch
    return lc.clamp(extra * k, 0.0, 48.0) if extra > 0.25 * pitch else 0.0


def _weighted_median(pairs) -> float:
    pairs = sorted(pairs)
    tot = sum(n for _, n in pairs) or 1
    acc = 0
    for v, n in pairs:
        acc += n
        if acc >= tot / 2:
            return v
    return pairs[-1][0]


def _breaks(cur: List[_Item], it: _Item, hb: float, edges, pitch: float) -> bool:
    prev = cur[-1]
    a, b = prev.line, it.line
    if b.y0 < a.y0 - 0.5 * hb:                       # jumped back up: new column
        return True
    if it.side != prev.side:
        return True
    if b.y0 - a.y0 > 1.4 * pitch:                     # extra space between lines = paragraph gap
        return True
    left, right = edges.get(it.side, (min(prev.x0, it.x0), max(prev.x1, it.x1)))
    ratio = it.fs / prev.fs if prev.fs else 1
    short = min(a.x1 - a.x0, b.x1 - b.x0) < 0.7 * (right - left)
    if short and (ratio > 1.3 or ratio < 0.77):       # size change: heading <-> body
        return True
    if _LIST_START.match(b.text):
        return True
    ind_b = b.x0 - left
    ind_a = a.x0 - left
    if ind_b > 1.2 * hb and ind_a <= 1.2 * hb:         # first-line indent
        return True
    if a.x1 < right - 2.5 * hb and (a.text.strip()[-1:] in lc.TERMINAL or a.x1 < right - 5 * hb):
        return True                                    # previous line stopped early
    return False
