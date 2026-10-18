"""The conversion pipeline and the job queue around it. No GUI code in here,
so the CLI and the tests drive exactly what the window drives."""
from __future__ import annotations

import itertools
import os
import threading
import time
from dataclasses import asdict, dataclass, field, fields
from statistics import median
from typing import Callable, Dict, List, Optional

from . import layout_native, layout_ocr, writers
from .loader import LoadError, Source, kind_of
from .model import Doc, Page, Para, Run
from .ocr import OcrUnavailable, find_spine_px, make_backend


class Cancelled(Exception):
    pass


class JobError(Exception):
    pass


@dataclass
class Options:
    formats: tuple = ("docx",)
    out_dir: str = ""                # "" = next to the source file
    ocr_lang: str = "auto"
    backend: str = "auto"            # auto | windows | tesseract
    mode: str = "auto"               # auto | ocr | native
    dpi: int = 300
    keep_images: bool = True
    page_breaks: bool = True
    collision: str = "rename"        # rename | overwrite | skip
    workers: int = 1
    page_range: str = ""             # "1-3,7,9-"
    split: str = "none"              # none | lr | rl | auto -- a sheet carries two pages side by side

    def to_dict(self):
        d = asdict(self)
        d["formats"] = list(self.formats)
        return d

    @classmethod
    def from_dict(cls, d):
        names = {f.name for f in fields(cls)}
        o = cls(**{k: v for k, v in (d or {}).items() if k in names})
        o.formats = tuple(f for f in o.formats if f in writers.WRITERS) or ("docx",)
        return o


def parse_range(spec: str, count: int) -> List[int]:
    spec = (spec or "").replace(" ", "").replace("，", ",").replace("－", "-")
    if not spec:
        return list(range(count))
    out: List[int] = []
    for part in spec.split(","):
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            lo = int(a) if a else 1
            hi = int(b) if b else count
        else:
            lo = hi = int(part)
        if lo < 1 or hi < lo:
            raise ValueError(f"页码范围不对: {part}")
        out += [i for i in range(lo - 1, min(hi, count)) if i not in out]
    if not out:
        raise ValueError("页码范围内没有页")
    return out


# --------------------------------------------------------------------- pipeline

def _unify_margins(doc: Doc):
    """Per-page margins measured from the content differ by a few points; one
    Word section per page would be silly. Use the median per page size and move
    the indents so the text stays where it was."""
    groups: List[List[Page]] = []
    for p in doc.pages:                       # same size = within 4% (two halves of a sheet differ by a few pt)
        for g in groups:
            r = g[0]
            if abs(p.width - r.width) <= 0.04 * r.width and abs(p.height - r.height) <= 0.04 * r.height:
                g.append(p)
                break
        else:
            groups.append([p])
    for pages in groups:
        med = tuple(median(p.margins[i] for p in pages) for i in range(4))
        for p in pages:
            shift = p.margins[0] - med[0]
            if abs(shift) > 0.5:
                for b in p.blocks:
                    if isinstance(b, Para):
                        b.left_indent = max(0.0, b.left_indent + shift)
                    elif hasattr(b, "indent"):
                        b.indent = max(0.0, b.indent + shift)
            p.margins = med
            ref = pages[0]
            p.width, p.height = ref.width, ref.height


def _split_order(ps, opts: Options):
    """None for a normal page, else which halves to produce and in what order."""
    mode = opts.split
    if mode == "auto":
        mode = "lr" if ps.width_pt >= 1.3 * ps.height_pt else "none"
    return {"lr": ("L", "R"), "rl": ("R", "L")}.get(mode)


def _convert_sheet(ps, opts: Options, backend_for):
    """One source page -> one or two Pages. Returns (pages, "native" | "ocr")."""
    halves = _split_order(ps, opts)
    has_layer = hasattr(ps, "page")
    if opts.mode == "native" or (opts.mode == "auto" and has_layer and ps.native_ok()):
        if not has_layer:
            raise JobError("图片没有文字层,请把「识别方式」改成自动或强制 OCR")
        if halves:
            import pymupdf
            r = ps.page.rect
            x = layout_native.find_spine(ps.page)
            clips = {"L": pymupdf.Rect(r.x0, r.y0, x, r.y1), "R": pymupdf.Rect(x, r.y0, r.x1, r.y1)}
            pages = [layout_native.build_page(ps.page, opts.keep_images, clips[h]) for h in halves]
        else:
            pages = [layout_native.build_page(ps.page, opts.keep_images)]
        for pg in pages:
            if not pg.blocks and opts.mode == "native":
                pg.note = "此页没有文字层 (未做 OCR)"
        return pages, "native"

    be = backend_for()
    img = ps.render(opts.dpi)
    if halves:
        x = find_spine_px(img)
        crops = {"L": img.crop((0, 0, x, img.height)), "R": img.crop((x, 0, img.width, img.height))}
        parts = [crops[h] for h in halves]
    else:
        parts = [img]
    pages = [layout_ocr.build_page(be.recognize(c), c.width, c.height, ps.px_to_pt) for c in parts]
    return pages, "ocr"


def convert_file(path: str, opts: Options, backend_for: Callable[[], object],
                 progress: Callable[[int, int, str], None] = lambda *a: None,
                 checkpoint: Callable[[], None] = lambda: None) -> dict:
    """Convert one file. Returns {outputs, pages, ocr_pages, warnings}."""
    try:
        src = Source(path)
    except LoadError as e:
        raise JobError(str(e))
    warnings: List[str] = []
    ocr_pages = 0
    try:
        try:
            idx = parse_range(opts.page_range, src.page_count)
        except ValueError as e:
            raise JobError(str(e))
        doc = Doc(src.title())
        total = len(idx)
        sheets = total
        progress(0, total, "")
        for n, i in enumerate(idx):
            checkpoint()
            label = f"第 {i + 1} 页"
            try:
                ps = src.page(i)
                pages, how = _convert_sheet(ps, opts, backend_for)
                if how == "ocr":
                    ocr_pages += len(pages)
                label += {"ocr": " · OCR", "native": " · 文字层"}.get(how, "") + \
                    (f" · 拆成 {len(pages)} 页" if len(pages) > 1 else "")
                doc.pages.extend(pages)
            except (OcrUnavailable, JobError, Cancelled):
                raise
            except Exception as e:                      # one bad page must not sink the file
                warnings.append(f"{label}: {e}")
                doc.pages.append(Page(595, 842, [], "native", note=f"第 {i + 1} 页转换失败: {e}"))
            progress(n + 1, total, label)
        if not any(p.blocks for p in doc.pages):
            warnings.append("没有识别到任何内容")
    finally:
        src.close()

    if opts.split == "auto" and len(doc.pages) == sheets:
        warnings.append("「自动」只拆横向页面,这个文件的页面都是竖版,所以一页都没拆;要强制拆请选「左页在前」或「右页在前」")
    elif opts.split in ("lr", "rl"):
        warnings.append(f"拆分: {sheets} 张纸 → {len(doc.pages)} 页")
    _unify_margins(doc)
    outputs = _write_outputs(path, doc, opts, warnings)
    return dict(outputs=outputs, pages=len(doc.pages), ocr_pages=ocr_pages, warnings=warnings)


def _targets(path: str, opts: Options):
    base = opts.out_dir or os.path.dirname(os.path.abspath(path))
    os.makedirs(base, exist_ok=True)
    stem = os.path.splitext(os.path.basename(path))[0]
    for n in itertools.count(0):
        name = stem if n == 0 else f"{stem} ({n})"
        paths = {f: os.path.join(base, f"{name}.{f}") for f in opts.formats}
        if opts.collision == "overwrite" or not any(os.path.exists(p) for p in paths.values()):
            return paths
        if opts.collision == "skip":
            return None


def _write_outputs(path, doc, opts, warnings) -> List[str]:
    targets = _targets(path, opts)
    if targets is None:
        warnings.append("目标文件已存在,已跳过")
        return []
    done = []
    for fmt, target in targets.items():
        tmp = target + ".part"
        try:
            writers.WRITERS[fmt](doc, tmp, opts.page_breaks)
            try:
                os.replace(tmp, target)
            except PermissionError:                   # open in Word
                alt = _free_name(target)
                os.replace(tmp, alt)
                warnings.append(f"{os.path.basename(target)} 正被占用,已另存为 {os.path.basename(alt)}")
                target = alt
            done.append(target)
        finally:
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except OSError:
                    pass
    return done


def _free_name(target: str) -> str:
    stem, ext = os.path.splitext(target)
    for n in itertools.count(1):
        alt = f"{stem} ({n}){ext}"
        if not os.path.exists(alt):
            return alt


# ------------------------------------------------------------------------ queue

QUEUED, RUNNING, DONE, FAILED, CANCELLED, SKIPPED = (
    "queued", "running", "done", "failed", "cancelled", "skipped")


@dataclass
class Job:
    id: int
    path: str
    status: str = QUEUED
    done: int = 0
    total: int = 0
    message: str = ""
    outputs: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    started: float = 0.0
    finished: float = 0.0


class JobQueue:
    """A list of jobs and N worker threads. `emit(kind, job_or_text)` is called
    from worker threads; the GUI hands it a thread-safe queue.put."""

    def __init__(self, get_options: Callable[[], Options], emit: Callable[[str, object], None]):
        self.get_options = get_options
        self.emit = emit
        self.jobs: List[Job] = []
        self._ids = itertools.count(1)
        self._cv = threading.Condition()
        self._threads: List[threading.Thread] = []
        self._running = False
        self._paused = threading.Event()        # set = paused
        self._stop = threading.Event()
        self._backends = threading.local()

    # --- list management
    def add(self, paths) -> List[Job]:
        added = []
        with self._cv:
            have = {j.path for j in self.jobs if j.status in (QUEUED, RUNNING)}
            for p in paths:
                p = os.path.abspath(p)
                if p in have or not kind_of(p):
                    continue
                j = Job(next(self._ids), p)
                self.jobs.append(j)
                have.add(p)
                added.append(j)
            self._cv.notify_all()
        return added

    def remove(self, job_ids):
        with self._cv:
            self.jobs = [j for j in self.jobs if not (j.id in job_ids and j.status != RUNNING)]

    def clear_finished(self):
        with self._cv:
            self.jobs = [j for j in self.jobs if j.status in (QUEUED, RUNNING)]

    def move(self, job_id, delta):
        with self._cv:
            i = next((k for k, j in enumerate(self.jobs) if j.id == job_id), None)
            if i is None or self.jobs[i].status != QUEUED:
                return
            k = max(0, min(len(self.jobs) - 1, i + delta))
            self.jobs.insert(k, self.jobs.pop(i))

    def retry(self, job_ids=None):
        with self._cv:
            for j in self.jobs:
                if j.status in (FAILED, CANCELLED, SKIPPED) and (job_ids is None or j.id in job_ids):
                    j.status, j.done, j.message, j.outputs, j.warnings = QUEUED, 0, "", [], []
            self._cv.notify_all()

    # --- control
    @property
    def paused(self):
        return self._paused.is_set()

    def start(self):
        with self._cv:
            self._stop.clear()
            self._paused.clear()
            self._running = True
            want = max(1, min(8, self.get_options().workers))
            self._threads = [t for t in self._threads if t.is_alive()]
            while len(self._threads) < want:
                t = threading.Thread(target=self._worker, daemon=True, name=f"p2w-{len(self._threads)}")
                self._threads.append(t)
                t.start()
            self._cv.notify_all()

    def pause(self):
        self._paused.set()

    def resume(self):
        self._paused.clear()
        with self._cv:
            self._cv.notify_all()

    def stop(self):
        """Cancel what is running (at the next page) and stop taking new jobs."""
        self._stop.set()
        self._paused.clear()
        with self._cv:
            self._running = False
            self._cv.notify_all()

    def shutdown(self):
        self.stop()

    def busy(self) -> bool:
        with self._cv:
            return any(j.status == RUNNING for j in self.jobs) or \
                (self._running and any(j.status == QUEUED for j in self.jobs))

    # --- worker
    def _next(self) -> Job:
        with self._cv:
            while True:
                if self._running and not self._stop.is_set():
                    for j in self.jobs:
                        if j.status == QUEUED:
                            j.status = RUNNING
                            j.started = time.time()
                            return j
                    # nothing left: park until something is added / started
                    if not any(j.status == RUNNING for j in self.jobs):
                        self._running = False
                        self.emit("idle", None)
                self._cv.wait(0.5)

    def _checkpoint(self):
        while self._paused.is_set() and not self._stop.is_set():
            time.sleep(0.1)
        if self._stop.is_set():
            raise Cancelled()

    def _backend_for(self, opts: Options):
        key = (opts.backend, opts.ocr_lang)
        cache = getattr(self._backends, "cache", None)
        if cache is None or cache[0] != key:
            cache = (key, make_backend(opts.backend, opts.ocr_lang))
            self._backends.cache = cache
            self.emit("log", f"OCR 引擎: {cache[1].name} ({cache[1].language})")
        return cache[1]

    def _worker(self):
        while True:
            job = self._next()
            opts = self.get_options()
            self.emit("job", job)
            try:
                def progress(done, total, msg):
                    job.done, job.total, job.message = done, total, msg
                    self.emit("job", job)
                res = convert_file(job.path, opts, lambda: self._backend_for(opts), progress, self._checkpoint)
                job.outputs = res["outputs"]
                job.warnings = res["warnings"]
                if not job.outputs and any("已跳过" in w for w in job.warnings):
                    job.status, job.message = SKIPPED, "目标已存在,已跳过"
                else:
                    job.status = DONE
                    kind = f"{res['pages']} 页" + (f",其中 {res['ocr_pages']} 页 OCR" if res["ocr_pages"] else "")
                    job.message = kind + (f" · {len(job.warnings)} 条提示" if job.warnings else "")
            except Cancelled:
                job.status, job.message = CANCELLED, "已取消"
            except (JobError, OcrUnavailable) as e:
                job.status, job.message = FAILED, str(e)
            except Exception as e:                    # never let a thread die
                job.status, job.message = FAILED, f"{type(e).__name__}: {e}"
            job.finished = time.time()
            for w in job.warnings:
                self.emit("log", f"{os.path.basename(job.path)}: {w}")
            self.emit("job", job)
