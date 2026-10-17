"""Command line: python cli.py scan.pdf photo.jpg -f docx md -o out/"""
import argparse
import glob
import os
import sys
import threading

from p2w import writers
from p2w.engine import DONE, FAILED, Options, JobQueue
from p2w.loader import ALL_EXTS, kind_of


def expand(args):
    out = []
    for a in args:
        if os.path.isdir(a):
            for root, _, files in os.walk(a):
                out += [os.path.join(root, f) for f in sorted(files) if kind_of(f)]
        elif any(c in a for c in "*?["):
            out += sorted(p for p in glob.glob(a) if kind_of(p))
        else:
            out.append(a)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="PDF/图片 -> Word (Windows 自带 OCR)")
    ap.add_argument("inputs", nargs="*", help="文件、文件夹或通配符")
    ap.add_argument("-f", "--format", nargs="+", default=["docx"], choices=sorted(writers.WRITERS))
    ap.add_argument("-o", "--out", default="", help="输出文件夹 (默认与源文件同目录)")
    ap.add_argument("--lang", default="auto", help="OCR 语言标记,如 zh-Hans-CN / en-US (默认 auto: 中文优先)")
    ap.add_argument("--backend", default="auto", choices=["auto", "windows", "tesseract"])
    ap.add_argument("--mode", default="auto", choices=["auto", "ocr", "native"],
                    help="auto: 有文字层就直接取,没有才 OCR; ocr: 一律 OCR; native: 只取文字层")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--pages", default="", help="页码范围,如 1-3,7,9-")
    ap.add_argument("--no-images", action="store_true", help="不保留文字层 PDF 里的图片")
    ap.add_argument("--no-page-breaks", action="store_true")
    ap.add_argument("--exists", default="rename", choices=["rename", "overwrite", "skip"])
    ap.add_argument("-j", "--workers", type=int, default=1)
    ap.add_argument("--list-langs", action="store_true")
    a = ap.parse_args(argv)

    if a.list_langs:
        from p2w.ocr import make_backend
        be = make_backend(a.backend, a.lang)
        print("当前引擎:", be.name, be.language)
        for tag, name in be.languages():
            print(f"  {tag}\t{name}")
        return 0
    files = expand(a.inputs)
    if not files:
        ap.error("没有输入文件。支持: " + " ".join(ALL_EXTS))

    opts = Options(formats=tuple(a.format), out_dir=os.path.abspath(a.out) if a.out else "",
                   ocr_lang=a.lang, backend=a.backend, mode=a.mode, dpi=a.dpi,
                   keep_images=not a.no_images, page_breaks=not a.no_page_breaks,
                   collision=a.exists, workers=a.workers, page_range=a.pages)
    idle = threading.Event()
    last = {}

    def emit(kind, obj):
        if kind == "idle":
            idle.set()
        elif kind == "log":
            print(obj, file=sys.stderr)
        elif kind == "job" and obj.status in (DONE, FAILED, "skipped", "cancelled") and last.get(obj.id) != obj.status:
            last[obj.id] = obj.status
            print(f"[{obj.status}] {os.path.basename(obj.path)}  {obj.message}")
            for o in obj.outputs:
                print("    ->", o)

    q = JobQueue(lambda: opts, emit)
    q.add(files)
    q.start()
    try:
        while not idle.wait(0.3):
            pass
    except KeyboardInterrupt:
        q.stop()
        return 130
    return 1 if any(j.status == FAILED for j in q.jobs) else 0


if __name__ == "__main__":
    sys.exit(main())
