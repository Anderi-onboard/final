"""Pick out, from a folder, the files that need OCR.

The rule (also in the README, because people will want to argue with it):

  image            needs OCR, unless it is too small to hold a line of text (an icon, a
                   thumbnail): shorter side < 200 px or longer side < 500 px.
  PDF / XPS /      needs OCR if at least one of the pages looked at has no usable text
  EPUB / CBZ ...   layer and is mostly picture (>= 30% of its area). Up to 60 pages are
                   looked at, spread evenly, first and last always among them; a PDF with
                   a scanned page hidden in the middle of 500 text pages can slip through.
                   Pages that are blank, or vector drawings, have nothing to read and do not
                   count. A scan that already carries a good text layer (searchable PDF)
                   does not need OCR and is left out: the text is already there.
  already done     a file whose result (every chosen format) already sits in the output
                   folder is left out, unless the policy for same-name files is "overwrite".
  not looked at    hidden files, Office lock files (~$...), and folders such as
                   node_modules, .git, .venv, the Recycle Bin.
"""
from __future__ import annotations

import os
from collections import Counter
from dataclasses import dataclass
from typing import Callable, Iterator, List, Optional

from .loader import DOC_EXTS, IMAGE_EXTS, LoadError, Source, kind_of

SKIP_DIRS = {"node_modules", "__pycache__", ".git", ".venv", "venv", "$recycle.bin", "system volume information"}
MAX_PAGES_LOOKED_AT = 60
MIN_SHORT_SIDE, MIN_LONG_SIDE = 200, 500


@dataclass
class Verdict:
    path: str
    needs_ocr: bool
    kind: str            # scan | image | text | tiny | exists | error
    reason: str
    pages: int = 0

    LABELS = {"scan": "扫描件 PDF/文档", "image": "图片", "text": "有文字层,不用 OCR", "tiny": "图片太小",
              "exists": "已有转换结果", "error": "打不开"}


def _sample(n: int) -> List[int]:
    if n <= MAX_PAGES_LOOKED_AT:
        return list(range(n))
    step = (n - 1) / (MAX_PAGES_LOOKED_AT - 1)
    return sorted({round(i * step) for i in range(MAX_PAGES_LOOKED_AT)})


def classify(path: str, opts=None) -> Verdict:
    kind = kind_of(path)
    if opts is not None and getattr(opts, "collision", "") != "overwrite" and _already_done(path, opts):
        return Verdict(path, False, "exists", "已有转换结果")
    if kind == "image":
        try:
            from PIL import Image
            with Image.open(path) as im:
                w, h = im.size
                frames = getattr(im, "n_frames", 1)
        except Exception as e:
            return Verdict(path, False, "error", f"打不开: {e}")
        if min(w, h) < MIN_SHORT_SIDE or max(w, h) < MIN_LONG_SIDE:
            return Verdict(path, False, "tiny", f"{w}×{h},太小")
        return Verdict(path, True, "image", f"图片 {w}×{h}" + (f",{frames} 页" if frames > 1 else ""), frames)
    if kind != "doc":
        return Verdict(path, False, "error", "不支持的类型")
    try:
        src = Source(path)
    except LoadError as e:
        return Verdict(path, False, "error", str(e))
    try:
        n = src.page_count
        idx = _sample(n)
        need = sum(1 for i in idx if src.page(i).needs_ocr())
    except Exception as e:
        return Verdict(path, False, "error", f"检查出错: {e}")
    finally:
        src.close()
    looked = f"抽查 {len(idx)}/{n} 页," if len(idx) < n else ""
    if need:
        return Verdict(path, True, "scan", f"{looked}{need}/{len(idx)} 页没有文字层", n)
    return Verdict(path, False, "text", f"{looked}都有文字层", n)


def _already_done(path: str, opts) -> bool:
    base = opts.out_dir or os.path.dirname(os.path.abspath(path))
    stem = os.path.splitext(os.path.basename(path))[0]
    fmts = opts.formats or ("docx",)
    return all(os.path.exists(os.path.join(base, f"{stem}.{f}")) for f in fmts)


def iter_files(root: str) -> Iterator[str]:
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d.lower() not in SKIP_DIRS and not d.startswith("."))
        for f in sorted(files):
            if f.startswith(("~$", ".")) or not kind_of(f):
                continue
            yield os.path.join(dirpath, f)


def scan_folder(root: str, opts=None, cancelled: Callable[[], bool] = lambda: False,
                progress: Callable[[int, int, str], None] = lambda *a: None) -> List[Verdict]:
    files = list(iter_files(root))
    out: List[Verdict] = []
    for n, p in enumerate(files):
        if cancelled():
            break
        progress(n, len(files), os.path.basename(p))
        out.append(classify(p, opts))
    progress(len(files), len(files), "")
    return out


def summarize(verdicts: List[Verdict]) -> str:
    c = Counter(v.kind for v in verdicts)
    picked = sum(1 for v in verdicts if v.needs_ocr)
    skipped = [f"{Verdict.LABELS[k]} {c[k]}" for k in ("text", "exists", "tiny", "error") if c[k]]
    return (f"扫描了 {len(verdicts)} 个文件,需要 OCR 的 {picked} 个"
            f"(扫描件 {c['scan']}、图片 {c['image']})"
            + (";跳过: " + "、".join(skipped) if skipped else ""))
