"""Builds the sample inputs the tests (and a manual try-out) use.
    python tests/make_fixtures.py OUTDIR
Needs PyMuPDF + Pillow and any CJK font (WenQuanYi on Linux, SimSun on Windows)."""
import glob
import io
import os
import sys

import pymupdf
from PIL import Image, ImageDraw

CJK_CANDIDATES = ["C:/Windows/Fonts/simsun.ttc", "C:/Windows/Fonts/msyh.ttc",
                  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
                  "/System/Library/Fonts/STHeiti Light.ttc"]


def cjk_font():
    for f in CJK_CANDIDATES + glob.glob("/usr/share/fonts/**/*.tt[cf]", recursive=True):
        if os.path.exists(f) and ("wqy" in f.lower() or "sim" in f.lower() or "msyh" in f.lower() or "heiti" in f.lower()):
            return f
    raise SystemExit("no CJK font found")


BODY_EN = ("The committee reviewed the proposal in detail and agreed that the schedule is realistic "
           "provided that the supplier delivers the first batch before the end of the quarter.")
BODY_ZH = ("委员会详细审阅了方案,一致认为只要供应商能在本季度末之前交付第一批货物,"
           "这份进度安排就是切实可行的。预算部分尚需财务部门再确认一次。")


def page_one(doc, font):
    page = doc.new_page()
    page.insert_font(fontname="zh", fontfile=font)
    page.insert_text((72, 100), "Quarterly Report 季度报告", fontsize=24, fontname="zh")
    page.insert_text((72, 140), "1. Overview 概述", fontsize=15, fontname="zh")
    page.insert_textbox(pymupdf.Rect(72, 150, 523, 230), BODY_EN, fontsize=11, fontname="helv")
    page.insert_textbox(pymupdf.Rect(72, 240, 523, 330), BODY_ZH + BODY_ZH, fontsize=11, fontname="zh")
    page.insert_text((72, 350), "2. Figures 数据", fontsize=15, fontname="zh")
    x0, y0, cw, rh = 72, 365, 120, 24
    rows = [["Item 项目", "Q1", "Q2", "Q3"], ["Revenue 收入", "120", "135", "150"], ["Cost 成本", "80", "82", "90"]]
    for r, row in enumerate(rows):
        for c, txt in enumerate(row):
            rect = pymupdf.Rect(x0 + c * cw, y0 + r * rh, x0 + (c + 1) * cw, y0 + (r + 1) * rh)
            page.draw_rect(rect, color=(0, 0, 0), width=0.8)
            page.insert_text((rect.x0 + 6, rect.y1 - 8), txt, fontsize=10, fontname="zh")
    im = Image.new("RGB", (240, 120), (230, 235, 245))
    d = ImageDraw.Draw(im)
    d.rectangle([20, 20, 220, 100], outline=(40, 70, 140), width=4)
    d.ellipse([90, 40, 150, 100], fill=(200, 80, 60))
    buf = io.BytesIO(); im.save(buf, "PNG")
    page.insert_image(pymupdf.Rect(72, 480, 312, 600), stream=buf.getvalue())
    page.insert_text((250, 780), "- 1 -", fontsize=10, fontname="helv")


def page_two_columns(doc, font):
    page = doc.new_page()
    page.insert_font(fontname="zh", fontfile=font)
    page.insert_text((150, 90), "Two Column Page 双栏页", fontsize=20, fontname="zh")
    left = " ".join([BODY_EN] * 3)
    right = " ".join([BODY_EN.replace("committee", "board")] * 3)
    page.insert_textbox(pymupdf.Rect(72, 120, 285, 700), left, fontsize=11, fontname="helv")
    page.insert_textbox(pymupdf.Rect(310, 120, 523, 700), right, fontsize=11, fontname="helv")


def make(outdir):
    os.makedirs(outdir, exist_ok=True)
    font = cjk_font()
    doc = pymupdf.open()
    page_one(doc, font)
    page_two_columns(doc, font)
    native = os.path.join(outdir, "native.pdf")
    doc.save(native)

    # the same pages as a scan: pictures only, no text layer
    scan = pymupdf.open()
    pngs = []
    for i, pg in enumerate(doc):
        pix = pg.get_pixmap(dpi=200)
        png = os.path.join(outdir, f"page{i + 1}.png")
        pix.save(png); pngs.append(png)
        sp = scan.new_page(width=pg.rect.width, height=pg.rect.height)
        sp.insert_image(sp.rect, filename=png)
    scan.save(os.path.join(outdir, "scan.pdf"))
    Image.open(pngs[0]).convert("RGB").save(os.path.join(outdir, "photo.jpg"), quality=90)
    frames = [Image.open(p).convert("RGB") for p in pngs]
    frames[0].save(os.path.join(outdir, "multi.tiff"), save_all=True, append_images=frames[1:], compression="tiff_lzw")
    return outdir


if __name__ == "__main__":
    print(make(sys.argv[1] if len(sys.argv) > 1 else "fixtures"))
