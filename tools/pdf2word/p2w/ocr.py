"""OCR backends. All of them return the same thing: a list of OLine, in the pixel
coordinates of the image they were given.

apple      Apple's Vision framework, the engine behind Preview / Live Text (macOS only).
rapidocr   PaddleOCR models on ONNX Runtime; best for Chinese + English, offline.
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


def find_spine_px(img) -> int:
    """x (pixels) of the fold in a picture of two facing pages.

    Looks for where the left page's text ends and the right page's begins and cuts in
    the middle of that gap. "Text" is counted as many short dark runs going down a
    column (lines of print); the fold's own shadow or a page edge is one long run, so it
    does not count. Falls back to the plainest blank strip near the middle when numpy is
    not installed, and to the exact middle when there is no gap."""
    from PIL import Image, ImageFilter
    w, h = img.size
    g = img.convert("L")
    k = max(1, min(w, h) // 500)
    small = g.resize((max(8, w // (2 * k)), max(8, h // (2 * k)))) if k > 1 or max(w, h) > 1200 else g
    sw, sh = small.size
    bins = 400
    try:
        import numpy as np
    except ImportError:
        prof = list(g.resize((bins, 1), Image.BOX).getdata())
        sm = [sum(prof[max(0, i - 2):i + 3]) / len(prof[max(0, i - 2):i + 3]) for i in range(bins)]
        lo, hi = int(bins * 0.40), int(bins * 0.60)
        best = max(range(lo, hi + 1), key=lambda i: sm[i] - 0.25 * abs(i - bins / 2))
        return int(round((best + 0.5) / bins * w))

    bg = small.filter(ImageFilter.GaussianBlur(max(4, sw // 40)))
    ink = (np.asarray(bg, dtype=np.int16) - np.asarray(small, dtype=np.int16)) > 30     # darker than its surroundings
    trans = (ink[1:] != ink[:-1]).sum(axis=0).astype(float)                              # dark/light switches per column
    bins = min(bins, len(trans))
    edges = np.linspace(0, len(trans), bins + 1).astype(int)            # equal-width bins (array_split is not)
    cs = np.concatenate([[0.0], np.cumsum(trans)])
    prof = (cs[edges[1:]] - cs[edges[:-1]]) / np.maximum(1, edges[1:] - edges[:-1])
    sm = np.convolve(prof, np.ones(7) / 7, mode="same")
    ref = float(np.percentile(sm, 90))
    if ref <= 0:
        return w // 2
    dense = sm >= 0.25 * ref
    lo, hi = int(bins * 0.25), int(bins * 0.75)
    runs, i = [], lo
    while i < hi:                           # blank stretches (no print) between lo and hi
        if not dense[i]:
            j = i
            while j < hi and not dense[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    runs = [r for r in runs if r[1] - r[0] >= bins * 0.02]
    if not runs:
        return w // 2                       # print runs through the middle: no gap to cut in
    mid = bins / 2
    a_, b_ = max(runs, key=lambda r: (r[1] - r[0]) - 0.3 * abs((r[0] + r[1]) / 2 - mid))   # widest, near the middle
    return int(round((a_ + b_) / 2 / bins * w))


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


# ---------------------------------------------------------------------- Apple

class AppleVision(Backend):
    """VNRecognizeTextRequest through PyObjC (pip install pyobjc-framework-Vision), on a Mac.
    One observation per text line, with a box in normalised coordinates whose origin is the
    bottom-left corner; converted here to pixels from the top-left like every other engine."""
    name = "apple"
    DEFAULT_LANGS = ["zh-Hans", "zh-Hant", "en-US"]

    def __init__(self, lang: str = "auto"):
        if sys.platform != "darwin":
            raise OcrUnavailable("苹果 Vision 只能在 Mac 上用")
        try:
            import Foundation
            import Vision
        except ImportError as e:
            raise OcrUnavailable("缺少 PyObjC: pip install pyobjc-framework-Vision") from e
        self._V, self._F = Vision, Foundation
        self.langs = self.DEFAULT_LANGS if lang in (None, "", "auto") else [x for x in lang.replace("+", ",").split(",") if x]
        self.language = ",".join(self.langs)

    def languages(self):
        try:
            req = self._V.VNRecognizeTextRequest.alloc().init()
            req.setRecognitionLevel_(self._V.VNRequestTextRecognitionLevelAccurate)
            got = req.supportedRecognitionLanguagesAndReturnError_(None)
            got = got[0] if isinstance(got, tuple) else got
            return [(l, l) for l in (got or [])] or [(l, l) for l in self.DEFAULT_LANGS]
        except Exception:
            return [(l, l) for l in self.DEFAULT_LANGS]

    def recognize(self, img) -> List[OLine]:
        V, F = self._V, self._F
        w, h = img.size
        buf = io.BytesIO()
        img.convert("RGB").save(buf, "PNG", compress_level=1)
        data = F.NSData.dataWithBytes_length_(buf.getvalue(), len(buf.getvalue()))
        handler = V.VNImageRequestHandler.alloc().initWithData_options_(data, None)
        req = V.VNRecognizeTextRequest.alloc().init()
        req.setRecognitionLevel_(V.VNRequestTextRecognitionLevelAccurate)
        req.setUsesLanguageCorrection_(True)
        try:                                              # newer revisions read CJK much better
            req.setRevision_(V.VNRecognizeTextRequestRevision3)
        except Exception:
            pass
        try:
            req.setRecognitionLanguages_(self.langs)
        except Exception:
            pass
        res = handler.performRequests_error_([req], None)
        ok, err = res if isinstance(res, tuple) else (res, None)
        if not ok:
            raise OcrUnavailable(f"Vision 识别失败: {err}")
        lines = []
        for obs in (req.results() or []):
            cands = obs.topCandidates_(1)
            if not cands:
                continue
            txt = str(cands[0].string()).strip()
            if not txt or float(cands[0].confidence()) < 0.3:
                continue
            bb = obs.boundingBox()
            x0, x1 = bb.origin.x * w, (bb.origin.x + bb.size.width) * w
            y0, y1 = (1 - bb.origin.y - bb.size.height) * h, (1 - bb.origin.y) * h
            lines.append(OLine([OWord(txt, x0, y0, x1, y1)]))
        return lines


# -------------------------------------------------------------------- RapidOCR

class RapidOcr(Backend):
    """PaddleOCR models run through ONNX Runtime (pip install rapidocr onnxruntime).
    The models ship inside the wheel, so it is offline after install, and its
    Chinese/English recognition is clearly better than the Windows engine's.
    One box per text line, no per-word boxes."""
    name = "rapidocr"

    def __init__(self, lang: str = "auto"):
        self._new = True
        try:
            from rapidocr import RapidOCR                       # 3.x
            kw = dict(params={"Global.log_level": "error"})
        except ImportError:
            try:
                from rapidocr_onnxruntime import RapidOCR        # 1.x
                self._new, kw = False, {}
            except ImportError as e:
                raise OcrUnavailable("RapidOCR 没装: pip install rapidocr onnxruntime") from e
        try:
            self._engine = RapidOCR(**kw)
        except Exception:
            self._engine = RapidOCR()
        self.language = "ch+en"

    def languages(self):
        return [("ch+en", "中文 + 英文 (内置模型)")]

    def recognize(self, img) -> List[OLine]:
        import numpy as np
        arr = np.array(img.convert("RGB"))[:, :, ::-1]            # RGB -> BGR (OpenCV order)
        if self._new:
            out = self._engine(arr)
            items = [] if out.boxes is None else list(zip(out.boxes, out.txts, out.scores))
        else:
            res, _ = self._engine(arr)
            items = res or []
        lines = []
        for box, txt, score in items:
            txt = (txt or "").strip()
            if not txt or float(score) < 0.5:          # specks in pictures read as 1-char "text"
                continue
            xs = [float(p[0]) for p in box]
            ys = [float(p[1]) for p in box]
            lines.append(OLine([OWord(txt, min(xs), min(ys), max(xs), max(ys))]))
        return lines


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
    auto = ["apple", "rapidocr", "windows", "tesseract"] if sys.platform == "darwin" else ["rapidocr", "windows", "tesseract"]
    order = {"auto": auto, "apple": ["apple"], "rapidocr": ["rapidocr"],
             "windows": ["windows"], "tesseract": ["tesseract"]}.get(kind, auto)
    makers = {"apple": AppleVision, "rapidocr": RapidOcr, "windows": WindowsOcr, "tesseract": TesseractOcr}
    for k in order:
        try:
            return makers[k](lang)
        except OcrUnavailable as e:
            errors.append(f"{k}: {e}")
    raise OcrUnavailable("没有可用的 OCR 引擎\n" + "\n".join(errors))
