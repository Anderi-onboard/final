"""Open anything we accept and hand out pages.

Documents (PDF, XPS, EPUB, ...) go through PyMuPDF, which gives us both a
rasteriser for OCR and, when the file has a real text layer, the text with its
fonts and positions. Images go through Pillow; a multi-frame TIFF/GIF is a
multi-page document.
"""
from __future__ import annotations

import os
from typing import List

DOC_EXTS = {".pdf", ".xps", ".oxps", ".epub", ".mobi", ".fb2", ".cbz", ".svg"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".jfif", ".jpe", ".bmp", ".dib", ".gif", ".tif",
              ".tiff", ".webp", ".ico", ".ppm", ".pgm", ".pbm", ".pcx", ".tga"}
ALL_EXTS = sorted(DOC_EXTS | IMAGE_EXTS)

MAX_RENDER_SIDE = 9000      # Windows.Media.Ocr refuses > 10240


class LoadError(RuntimeError):
    pass


def kind_of(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext in DOC_EXTS:
        return "doc"
    if ext in IMAGE_EXTS:
        return "image"
    return ""


def _pillow_heif():
    try:                        # optional: HEIC/HEIF photos from phones
        import pillow_heif
        pillow_heif.register_heif_opener()
        return True
    except Exception:
        return False


if _pillow_heif():
    IMAGE_EXTS |= {".heic", ".heif"}
    ALL_EXTS = sorted(DOC_EXTS | IMAGE_EXTS)


class PageSource:
    def needs_ocr(self) -> bool:
        return True

    width_pt = 595.0
    height_pt = 842.0
    px_to_pt = 1.0              # for the image that render() returns

    def native_ok(self) -> bool:
        return False

    def render(self, dpi: int, clip=None):
        raise NotImplementedError


class _DocPage(PageSource):
    def __init__(self, page):
        self.page = page
        self.width_pt = page.rect.width
        self.height_pt = page.rect.height
        self.px_to_pt = 1.0

    def native_ok(self) -> bool:
        """True if the text layer is real text, not a scan with a few stray
        characters or a font with no Unicode map."""
        text = self.page.get_text("text") or ""
        s = text.strip()
        n = len(s)
        if n < 20:
            return False
        bad = s.count("�") + s.count("(cid:") * 6 + sum(1 for c in s if 0xE000 <= ord(c) <= 0xF8FF)
        if bad / n > 0.25:
            return False
        if n < 150:                         # a page number on top of a full-page scan
            area = self.width_pt * self.height_pt
            try:
                cover = sum(max(0.0, (i["bbox"][2] - i["bbox"][0]) * (i["bbox"][3] - i["bbox"][1]))
                            for i in self.page.get_image_info())
            except Exception:
                cover = 0.0
            if area and cover / area > 0.6:
                return False
        return True

    def image_cover(self) -> float:
        """Share of the page area taken up by pictures (0..1)."""
        area = self.width_pt * self.height_pt
        if not area:
            return 0.0
        try:
            tot = 0.0
            for i in self.page.get_image_info():
                b = i["bbox"]
                tot += max(0.0, min(b[2], self.width_pt) - max(b[0], 0)) * max(0.0, min(b[3], self.height_pt) - max(b[1], 0))
            return min(1.0, tot / area)
        except Exception:
            return 0.0

    def needs_ocr(self) -> bool:
        """No usable text layer AND the page is mostly picture: a scan or a photo.
        A blank page or a vector drawing has nothing for OCR to read."""
        return not self.native_ok() and self.image_cover() >= 0.30

    def image_regions(self):
        """Where the big pictures are on the page, top to bottom then left to
        right: a page of book photos is a few of these, not one scan."""
        import pymupdf
        page = self.page
        area = self.width_pt * self.height_pt
        try:
            infos = page.get_image_info()
        except Exception:
            return []
        rects = []
        for i in infos:
            r = pymupdf.Rect(i["bbox"]) & page.rect
            if not r.is_empty and r.width * r.height >= 0.10 * area:
                rects.append(r)
        rects = [r for r in rects if not any(o is not r and o.contains(r) and o != r for o in rects)]
        uniq = []
        for r in rects:
            if not any(abs(r.x0 - u.x0) < 2 and abs(r.y0 - u.y0) < 2 and abs(r.x1 - u.x1) < 2 and abs(r.y1 - u.y1) < 2
                       for u in uniq):
                uniq.append(r)
        return sorted(uniq, key=lambda r: (round(r.y0 / 20), r.x0))

    def render(self, dpi: int, clip=None):
        from PIL import Image
        w, h = (clip.width, clip.height) if clip is not None else (self.width_pt, self.height_pt)
        side = max(w, h) / 72.0
        dpi = max(72, min(int(dpi), int(MAX_RENDER_SIDE / side)))
        pix = self.page.get_pixmap(dpi=dpi, alpha=False, clip=clip)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        self.px_to_pt = 72.0 / dpi
        return img


class _ImagePage(PageSource):
    def __init__(self, frame, dpi):
        from PIL import ImageOps
        try:
            frame = ImageOps.exif_transpose(frame)
        except Exception:
            pass
        self.img = frame.convert("RGB")
        w, h = self.img.size
        # No DPI in the file: a big image is a photographed/scanned page and is
        # mapped onto A4 width, a small one (screenshot) is taken at 96 dpi.
        if dpi and dpi >= 50:
            k = 72.0 / dpi
        elif w >= 1000:
            k = 595.28 / w
        else:
            k = 0.75
        self.px_to_pt = k
        self.width_pt, self.height_pt = w * k, h * k

    def render(self, dpi: int, clip=None):
        return self.img


class Source:
    def __init__(self, path: str):
        self.path = path
        self.kind = kind_of(path)
        self._doc = None
        self._frames = None
        if not os.path.isfile(path):
            raise LoadError("文件不存在")
        if self.kind == "doc":
            try:
                import pymupdf
            except ImportError:
                import fitz as pymupdf
            try:
                self._doc = pymupdf.open(path)
            except Exception as e:
                raise LoadError(f"无法打开: {e}") from e
            if self._doc.needs_pass:
                self._doc.close()
                raise LoadError("文件有密码,无法打开")
            self.page_count = self._doc.page_count
        elif self.kind == "image":
            from PIL import Image
            try:
                im = Image.open(path)
                self._n = getattr(im, "n_frames", 1)
                self._im = im
                self._dpi = (im.info.get("dpi") or (0,))[0]
                try:
                    self._dpi = float(self._dpi)
                except Exception:
                    self._dpi = 0
            except Exception as e:
                raise LoadError(f"无法打开图片: {e}") from e
            self.page_count = self._n
        else:
            raise LoadError("不支持的文件类型")

    def page(self, i: int) -> PageSource:
        if self._doc is not None:
            return _DocPage(self._doc[i])
        self._im.seek(i)
        return _ImagePage(self._im.copy(), self._dpi)

    def title(self) -> str:
        return os.path.splitext(os.path.basename(self.path))[0]

    def close(self):
        try:
            if self._doc is not None:
                self._doc.close()
            if getattr(self, "_im", None) is not None:
                self._im.close()
        except Exception:
            pass
