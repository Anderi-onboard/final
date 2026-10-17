"""OCR backends. All of them return the same thing: a list of OLine, in the pixel
coordinates of the image they were given.

windows    The engine behind the Snipping Tool "Text actions" button
           (Windows.Media.Ocr). Offline, no install of its own, but each
           language needs its Windows OCR language pack.
tesseract  Optional fallback (pip install pytesseract + the Tesseract binary).
           Also what makes the layout code testable on non-Windows machines.
"""
from __future__ import annotations

import io
import sys
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .model import is_cjk


@dataclass
class OWord:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float


@dataclass
class OLine:
    words: List[OWord] = field(default_factory=list)

    @property
    def x0(self): return min(w.x0 for w in self.words)
    @property
    def y0(self): return min(w.y0 for w in self.words)
    @property
    def x1(self): return max(w.x1 for w in self.words)
    @property
    def y1(self): return max(w.y1 for w in self.words)
    @property
    def h(self): return self.y1 - self.y0

    @property
    def text(self) -> str:
        """Words -> one string. Latin words get a space; CJK neighbours do not;
        at a Latin/CJK boundary the pixel gap decides, so "Report 季度" keeps the
        space the page had and "第3章" does not grow one."""
        out = ""
        prev = None
        h = self.h or 1.0
        for w in self.words:
            t = w.text
            if not t:
                continue
            if out:
                a, b = out[-1], t[0]
                if is_cjk(a) and is_cjk(b):
                    pass
                elif is_cjk(a) or is_cjk(b):
                    if prev is not None and w.x0 - prev.x1 > 0.22 * h:
                        out += " "
                else:
                    out += " "
            out += t
            prev = w
        return out


class OcrUnavailable(RuntimeError):
    pass


class Backend:
    name = "?"
    language = ""

    def languages(self) -> List[Tuple[str, str]]:
        return []

    def recognize(self, img) -> List[OLine]:  # PIL.Image -> lines
        raise NotImplementedError


def _fit(img, max_dim: int):
    """Scale into what the engine accepts and up if the text would be tiny.
    Returns (image, factor) where factor maps engine px -> input px."""
    w, h = img.size
    scale = 1.0
    if max(w, h) < 1600:
        scale = min(2.0, 1600.0 / max(w, h))
    if max(w, h) * scale > max_dim:
        scale = max_dim / float(max(w, h))
    if abs(scale - 1.0) < 0.01:
        return img, 1.0
    from PIL import Image
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS), 1.0 / scale


# --------------------------------------------------------------------- Windows

_WIN = None


def _winrt():
    """Import the WinRT projection once. Prefers the maintained `winrt-*`
    packages, falls back to the older `winsdk`."""
    global _WIN
    if _WIN is not None:
        return _WIN
    if sys.platform != "win32":
        raise OcrUnavailable("Windows OCR 只能在 Windows 上使用")
    try:
        from winrt.windows.media.ocr import OcrEngine
        from winrt.windows.globalization import Language
        from winrt.windows.graphics.imaging import BitmapDecoder
        from winrt.windows.storage.streams import InMemoryRandomAccessStream, DataWriter
    except ImportError:
        try:
            from winsdk.windows.media.ocr import OcrEngine
            from winsdk.windows.globalization import Language
            from winsdk.windows.graphics.imaging import BitmapDecoder
            from winsdk.windows.storage.streams import InMemoryRandomAccessStream, DataWriter
        except ImportError as e:
            raise OcrUnavailable(
                "缺少 WinRT 绑定。请运行: pip install -r requirements.txt") from e
    _WIN = dict(OcrEngine=OcrEngine, Language=Language, BitmapDecoder=BitmapDecoder,
                Stream=InMemoryRandomAccessStream, Writer=DataWriter)
    return _WIN


def windows_languages() -> List[Tuple[str, str]]:
    w = _winrt()
    return [(l.language_tag, l.display_name) for l in w["OcrEngine"].available_recognizer_languages]


class WindowsOcr(Backend):
    name = "windows"

    def __init__(self, lang: str = "auto"):
        w = _winrt()
        self._w = w
        engine = None
        avail = [t for t, _ in windows_languages()]
        if lang and lang != "auto":
            engine = w["OcrEngine"].try_create_from_language(w["Language"](lang))
            if engine is None:
                raise OcrUnavailable(
                    f"Windows 没有安装 {lang} 的 OCR 语言包。"
                    "设置 > 时间和语言 > 语言和区域 > 添加语言(勾选「OCR」)")
        else:
            # Mixed Chinese/English: the Chinese engine reads Latin text fine,
            # the English engine reads no Chinese at all, so Chinese goes first.
            pick = next((t for t in avail if t.lower().startswith("zh-hans")), None) \
                or next((t for t in avail if t.lower().startswith("zh")), None)
            if pick:
                engine = w["OcrEngine"].try_create_from_language(w["Language"](pick))
            if engine is None:
                engine = w["OcrEngine"].try_create_from_user_profile_languages()
        if engine is None:
            raise OcrUnavailable(
                "找不到可用的 Windows OCR 语言包。设置 > 时间和语言 > 语言和区域,"
                "给任一语言安装「OCR」功能。")
        self._engine = engine
        self.language = engine.recognizer_language.language_tag
        self._max = int(w["OcrEngine"].max_image_dimension)

    def languages(self):
        return windows_languages()

    def recognize(self, img) -> List[OLine]:
        import asyncio
        img = img.convert("RGB")
        small, back = _fit(img, self._max)
        buf = io.BytesIO()
        small.save(buf, "PNG", compress_level=1)
        res = asyncio.run(self._run(buf.getvalue()))
        lines = []
        for ln in res.lines:
            words = []
            for wd in ln.words:
                r = wd.bounding_rect
                words.append(OWord(wd.text, r.x * back, r.y * back,
                                   (r.x + r.width) * back, (r.y + r.height) * back))
            if words:
                lines.append(OLine(words))
        return lines

    async def _run(self, png: bytes):
        w = self._w
        stream = w["Stream"]()
        writer = w["Writer"](stream)
        writer.write_bytes(png)
        await writer.store_async()
        await writer.flush_async()
        writer.detach_stream()
        stream.seek(0)
        decoder = await w["BitmapDecoder"].create_async(stream)
        bitmap = await decoder.get_software_bitmap_async()
        return await self._engine.recognize_async(bitmap)


# ------------------------------------------------------------------- Tesseract

class TesseractOcr(Backend):
    name = "tesseract"

    def __init__(self, lang: str = "auto"):
        import os
        # Tesseract's OpenMP threads spin-wait; two copies at once on one machine
        # crawl. One thread per process and let the queue provide the parallelism.
        os.environ.setdefault("OMP_THREAD_LIMIT", "1")
        try:
            import pytesseract
            self._t = pytesseract
            have = set(pytesseract.get_languages(config=""))
        except Exception as e:
            raise OcrUnavailable("Tesseract 不可用 (pip install pytesseract 并安装 Tesseract)") from e
        if lang in (None, "", "auto") or lang not in have and "+" not in lang:
            want = [l for l in ("chi_sim", "chi_tra", "eng") if l in have]
            lang = "+".join(want) or "eng"
        self.language = lang

    def languages(self):
        return [(l, l) for l in self._t.get_languages(config="")]

    def recognize(self, img) -> List[OLine]:
        d = self._t.image_to_data(img.convert("RGB"), lang=self.language,
                                  output_type=self._t.Output.DICT)
        groups = {}
        for i, txt in enumerate(d["text"]):
            txt = (txt or "").strip()
            if not txt or float(d["conf"][i]) < 0:
                continue
            key = (d["block_num"][i], d["par_num"][i], d["line_num"][i])
            x, y, w, h = d["left"][i], d["top"][i], d["width"][i], d["height"][i]
            groups.setdefault(key, []).append(OWord(txt, x, y, x + w, y + h))
        return [OLine(ws) for _, ws in sorted(groups.items())]


# ------------------------------------------------------------------------ pick

def make_backend(kind: str = "auto", lang: str = "auto") -> Backend:
    kind = (kind or "auto").lower()
    errors = []
    order = {"auto": ["windows", "tesseract"], "windows": ["windows"],
             "tesseract": ["tesseract"]}.get(kind, ["windows", "tesseract"])
    for k in order:
        try:
            return WindowsOcr(lang) if k == "windows" else TesseractOcr(lang)
        except OcrUnavailable as e:
            errors.append(f"{k}: {e}")
    raise OcrUnavailable("没有可用的 OCR 引擎\n" + "\n".join(errors))
