"""Tk front-end. Drop files in, press Start. Everything it does goes through
engine.JobQueue, same as the command line."""
from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from . import __version__, writers
from .engine import (CANCELLED, DONE, FAILED, QUEUED, RUNNING, SKIPPED, JobQueue, Options, parse_range)
from .loader import ALL_EXTS, kind_of

try:                                    # optional: drag & drop from Explorer
    from tkinterdnd2 import DND_FILES, TkinterDnD
except Exception:                       # pragma: no cover
    DND_FILES = TkinterDnD = None

STATUS_TEXT = {QUEUED: "等待", RUNNING: "处理中", DONE: "完成", FAILED: "失败",
               CANCELLED: "已取消", SKIPPED: "已跳过"}
MODES = {"自动 (有文字层直接取,没有才 OCR)": "auto", "全部 OCR": "ocr", "只取文字层 (不 OCR)": "native"}
BACKENDS = {"自动 (RapidOCR > Windows OCR)": "auto", "RapidOCR": "rapidocr", "Windows OCR": "windows",
            "Tesseract": "tesseract"}
SPLITS = {"不拆分": "none", "左页在前 (左半=前一页)": "lr", "右页在前 (右半=前一页)": "rl",
          "自动 (横向的页面/照片按左页在前拆)": "auto"}
LLM_SCOPES = {"只整理 OCR 识别出来的页": "ocr", "所有页 (含文字层 PDF)": "all"}
# Common examples only; the provider's own docs are the authority on address and model names.
LLM_PRESETS = [("本机 Ollama (免费, 推荐 7B 以上)", "http://localhost:11434/v1", "qwen2.5:7b"),
               ("本机 LM Studio", "http://localhost:1234/v1", "qwen2.5-7b-instruct"),
               ("DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat"),
               ("通义千问 (DashScope)", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-turbo"),
               ("智谱 GLM-4-Flash", "https://open.bigmodel.cn/api/paas/v4", "glm-4-flash"),
               ("OpenAI", "https://api.openai.com/v1", "gpt-4o-mini")]
COLLISIONS = {"自动改名": "rename", "覆盖": "overwrite", "跳过": "skip"}
AUTO_LANG = "自动 (中文优先,中英混排)"


def settings_path() -> str:
    base = os.environ.get("APPDATA") or os.path.join(os.path.expanduser("~"), ".config")
    d = os.path.join(base, "pdf2word")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "settings.json")


def open_path(path: str):
    try:
        if sys.platform == "win32":
            os.startfile(path)                                    # noqa: S606
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
    except Exception as e:
        messagebox.showerror("打不开", str(e))


def reveal(path: str):
    if sys.platform == "win32" and os.path.exists(path):
        subprocess.Popen(["explorer", "/select,", os.path.normpath(path)])
    else:
        open_path(os.path.dirname(path))


class App:
    def __init__(self, root: tk.Tk, initial_files=()):
        self.root = root
        root.title(f"PDF / 图片 转 Word  {__version__}")
        root.geometry("1040x770")
        root.minsize(900, 730)
        self.events: "queue.Queue" = queue.Queue()
        # Worker threads must never touch Tk variables: they read this snapshot,
        # which the main thread refreshes (see _pump), so changes apply to the
        # next job that starts.
        self._snapshot = Options()
        self.q = JobQueue(lambda: self._snapshot, lambda k, o: self.events.put((k, o)))
        self.langs = {}
        self._build()
        self._load_settings()
        self.v["backend"].trace_add("write", lambda *a: self._backend_changed())
        self._snapshot = self.options()
        self._detect_langs()
        root.protocol("WM_DELETE_WINDOW", self._close)
        root.after(100, self._pump)
        if initial_files:
            self.add_paths(initial_files)

    # ------------------------------------------------------------------ layout
    def _build(self):
        r = self.root
        try:
            st = ttk.Style()
            st.theme_use("vista" if "vista" in st.theme_names() else "clam")
            st.configure("Treeview", rowheight=26)
            st.configure("Big.TButton", padding=(14, 6))
        except tk.TclError:
            pass

        bar = ttk.Frame(r, padding=(10, 8, 10, 4))
        bar.pack(fill="x")
        for text, cmd in (("添加文件…", self.pick_files), ("添加文件夹 (自动挑扫描件)…", self.pick_folder),
                          ("移除所选", self.remove_selected), ("清除已完成", self.clear_done),
                          ("上移", lambda: self.move(-1)), ("下移", lambda: self.move(1)),
                          ("重试失败项", self.retry_failed)):
            ttk.Button(bar, text=text, command=cmd).pack(side="left", padx=(0, 6))

        foot = ttk.Frame(r, padding=(10, 4, 10, 4))
        foot.pack(side="bottom", fill="x")
        self.btn_start = ttk.Button(foot, text="开始", style="Big.TButton", command=self.start)
        self.btn_start.pack(side="left")
        self.btn_pause = ttk.Button(foot, text="暂停", style="Big.TButton", command=self.pause, state="disabled")
        self.btn_pause.pack(side="left", padx=6)
        self.btn_stop = ttk.Button(foot, text="停止", style="Big.TButton", command=self.stop, state="disabled")
        self.btn_stop.pack(side="left")
        self.bar = ttk.Progressbar(foot, maximum=1000)
        self.bar.pack(side="left", fill="x", expand=True, padx=12)
        self.summary = ttk.Label(foot, text="", width=22, anchor="e")
        self.summary.pack(side="left")

        body = ttk.Panedwindow(r, orient="horizontal")
        body.pack(fill="both", expand=True, padx=10, pady=4)

        left = ttk.Frame(body)
        body.add(left, weight=3)
        logf = ttk.LabelFrame(left, text="日志", padding=4)
        logf.pack(side="bottom", fill="x", pady=(6, 0))
        self.log = tk.Text(logf, height=4, wrap="word", state="disabled", relief="flat",
                           font=("Consolas", 9) if sys.platform == "win32" else None)
        self.log.pack(fill="x")

        cols = ("name", "type", "status", "progress", "note")
        self.tree = ttk.Treeview(left, columns=cols, show="headings", selectmode="extended")
        for c, t, w, a in (("name", "文件", 260, "w"), ("type", "类型", 56, "center"),
                           ("status", "状态", 70, "center"), ("progress", "进度", 70, "center"),
                           ("note", "说明", 240, "w")):
            self.tree.heading(c, text=t)
            self.tree.column(c, width=w, anchor=a, stretch=(c in ("name", "note")))
        sb = ttk.Scrollbar(left, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=sb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        for tag, color in ((DONE, "#1b7f3b"), (FAILED, "#b3261e"), (CANCELLED, "#777777"),
                           (SKIPPED, "#777777"), (RUNNING, "#0b57d0")):
            self.tree.tag_configure(tag, foreground=color)
        self.tree.bind("<Double-1>", lambda e: self.open_result())
        self.tree.bind("<Delete>", lambda e: self.remove_selected())
        self.tree.bind("<Button-3>", self._menu)
        self.tree.bind("<Button-2>", self._menu)
        self.menu = tk.Menu(r, tearoff=0)
        self.menu.add_command(label="打开结果", command=self.open_result)
        self.menu.add_command(label="在文件夹中显示", command=self.open_folder)
        self.menu.add_separator()
        self.menu.add_command(label="重试", command=lambda: self.q.retry(self._selected_ids()))
        self.menu.add_command(label="移除", command=self.remove_selected)

        self.hint = ttk.Label(left, text="把 PDF / 图片 / 文件夹拖到这里,或点「添加文件」",
                              foreground="#777777")
        self.hint.place(relx=0.5, rely=0.45, anchor="center")

        right = ttk.Frame(body, padding=(10, 0, 0, 0))
        body.add(right, weight=1)
        self._options_panel(right)

        r.bind("<Control-o>", lambda e: self.pick_files())
        if TkinterDnD is not None:
            for w in (self.tree, self.hint):
                try:
                    w.drop_target_register(DND_FILES)
                    w.dnd_bind("<<Drop>>", self._drop)
                except Exception:
                    pass
        else:
            self._log("提示: pip install tkinterdnd2 后可直接把文件拖进窗口")

    def _options_panel(self, parent):
        v = self.v = {
            "docx": tk.BooleanVar(value=True), "txt": tk.BooleanVar(), "md": tk.BooleanVar(),
            "html": tk.BooleanVar(), "where": tk.StringVar(value="same"), "out_dir": tk.StringVar(),
            "mode": tk.StringVar(value=list(MODES)[0]), "backend": tk.StringVar(value=list(BACKENDS)[0]),
            "lang": tk.StringVar(value=AUTO_LANG), "dpi": tk.IntVar(value=300),
            "pages": tk.StringVar(), "images": tk.BooleanVar(value=True),
            "pbreak": tk.BooleanVar(value=True), "exists": tk.StringVar(value=list(COLLISIONS)[0]),
            "workers": tk.IntVar(value=1), "split": tk.StringVar(value=list(SPLITS)[0]),
            "autostart": tk.BooleanVar(value=True), "llm": tk.BooleanVar(value=False), "llm_url": tk.StringVar(value=LLM_PRESETS[0][1]),
            "llm_model": tk.StringVar(value=LLM_PRESETS[0][2]), "llm_key": tk.StringVar(),
            "llm_scope": tk.StringVar(value=list(LLM_SCOPES)[0]), "llm_log": tk.BooleanVar(value=True),
        }
        f = ttk.LabelFrame(parent, text="输出格式", padding=6)
        f.pack(fill="x")
        for i, fmt in enumerate(writers.WRITERS):
            ttk.Checkbutton(f, text=writers.FORMAT_LABELS[fmt], variable=v[fmt]).grid(
                row=i // 2, column=i % 2, sticky="w", padx=(0, 10))

        f = ttk.LabelFrame(parent, text="保存到", padding=6)
        f.pack(fill="x", pady=(4, 0))
        ttk.Radiobutton(f, text="与原文件相同的文件夹", variable=v["where"], value="same").pack(anchor="w")
        row = ttk.Frame(f)
        row.pack(fill="x")
        ttk.Radiobutton(row, text="指定:", variable=v["where"], value="dir").pack(side="left")
        ttk.Entry(row, textvariable=v["out_dir"]).pack(side="left", fill="x", expand=True, padx=4)
        ttk.Button(row, text="…", width=3, command=self.pick_out).pack(side="left")

        f = ttk.LabelFrame(parent, text="识别", padding=6)
        f.pack(fill="x", pady=(4, 0))
        f.columnconfigure(1, weight=1)
        def line(r, label, widget):
            ttk.Label(f, text=label).grid(row=r, column=0, sticky="w", pady=2)
            widget.grid(row=r, column=1, sticky="ew", pady=2, padx=(6, 0))
        line(0, "方式", ttk.Combobox(f, textvariable=v["mode"], values=list(MODES), state="readonly"))
        line(1, "引擎", ttk.Combobox(f, textvariable=v["backend"], values=list(BACKENDS), state="readonly"))
        self.lang_box = ttk.Combobox(f, textvariable=v["lang"], values=[AUTO_LANG], state="readonly")
        line(2, "语言", self.lang_box)
        line(3, "清晰度 DPI", ttk.Spinbox(f, from_=150, to=600, increment=50, textvariable=v["dpi"], width=6))
        line(4, "页码 (如 1-3,7)", ttk.Entry(f, textvariable=v["pages"]))
        line(5, "一页塞两页", ttk.Combobox(f, textvariable=v["split"], values=list(SPLITS), state="readonly"))

        f = ttk.LabelFrame(parent, text="其他", padding=6)
        f.pack(fill="x", pady=(4, 0))
        ttk.Checkbutton(f, text="保留文字层 PDF 里的图片", variable=v["images"]).pack(anchor="w")
        ttk.Checkbutton(f, text="每页之间分页", variable=v["pbreak"]).pack(anchor="w")
        ttk.Checkbutton(f, text="选文件夹后自动开始处理", variable=v["autostart"]).pack(anchor="w")
        row = ttk.Frame(f)
        row.pack(fill="x", pady=(4, 0))
        ttk.Label(row, text="同名文件").pack(side="left")
        ttk.Combobox(row, textvariable=v["exists"], values=list(COLLISIONS), state="readonly",
                     width=10).pack(side="left", padx=6)
        row = ttk.Frame(f)
        row.pack(fill="x", pady=(4, 0))
        ttk.Checkbutton(row, text="识别后用 AI 整理文字 (可选)", variable=v["llm"]).pack(side="left")
        ttk.Button(row, text="设置…", width=6, command=self.llm_dialog).pack(side="left", padx=6)
        row = ttk.Frame(f)
        row.pack(fill="x", pady=(4, 0))
        ttk.Label(row, text="同时处理").pack(side="left")
        ttk.Spinbox(row, from_=1, to=4, textvariable=v["workers"], width=4).pack(side="left", padx=6)
        ttk.Label(row, text="个文件", foreground="#777777").pack(side="left")

        ttk.Button(parent, text="打开输出文件夹", command=self.open_out_dir).pack(fill="x", pady=(8, 0))
        self.engine_label = ttk.Label(parent, text="", foreground="#777777", wraplength=260, justify="left")
        self.engine_label.pack(fill="x", pady=(6, 0))

    # ----------------------------------------------------------------- options
    def options(self) -> Options:
        v = self.v
        fmts = tuple(f for f in writers.WRITERS if v[f].get()) or ("docx",)
        lang = v["lang"].get()
        tag = "auto" if lang == AUTO_LANG else self.langs.get(lang, lang.split(" ")[0])
        try:
            dpi = max(100, min(600, int(v["dpi"].get())))
        except (tk.TclError, ValueError):
            dpi = 300
        try:
            workers = max(1, min(4, int(v["workers"].get())))
        except (tk.TclError, ValueError):
            workers = 1
        return Options(
            formats=fmts, out_dir=(v["out_dir"].get().strip() if v["where"].get() == "dir" else ""),
            ocr_lang=tag, backend=BACKENDS.get(v["backend"].get(), "auto"),
            mode=MODES.get(v["mode"].get(), "auto"), dpi=dpi, keep_images=v["images"].get(),
            page_breaks=v["pbreak"].get(), collision=COLLISIONS.get(v["exists"].get(), "rename"),
            workers=workers, page_range=v["pages"].get().strip(),
            split=SPLITS.get(v["split"].get(), "none"),
            llm=v["llm"].get(), llm_url=v["llm_url"].get().strip(), llm_model=v["llm_model"].get().strip(),
            llm_key=v["llm_key"].get().strip(), llm_scope=LLM_SCOPES.get(v["llm_scope"].get(), "ocr"),
            llm_log=v["llm_log"].get())

    def _load_settings(self):
        try:
            with open(settings_path(), encoding="utf-8") as f:
                d = json.load(f)
        except Exception:
            return
        v = self.v
        for fmt in writers.WRITERS:
            v[fmt].set(fmt in d.get("formats", ["docx"]))
        v["where"].set("dir" if d.get("out_dir") else "same")
        v["out_dir"].set(d.get("out_dir", ""))
        rev = lambda m, val: next((k for k, x in m.items() if x == val), None)
        for key, m, field in (("mode", MODES, "mode"), ("backend", BACKENDS, "backend"),
                              ("exists", COLLISIONS, "collision"), ("split", SPLITS, "split")):
            k = rev(m, d.get(field))
            if k:
                v[key].set(k)
        v["dpi"].set(d.get("dpi", 300))
        v["pages"].set(d.get("page_range", ""))
        v["images"].set(d.get("keep_images", True))
        v["pbreak"].set(d.get("page_breaks", True))
        v["workers"].set(d.get("workers", 1))
        v["autostart"].set(d.get("auto_start", True))
        v["llm"].set(bool(d.get("llm", False)))
        for k in ("llm_url", "llm_model", "llm_key"):
            if d.get(k):
                v[k].set(d[k])
        k = rev(LLM_SCOPES, d.get("llm_scope"))
        if k:
            v["llm_scope"].set(k)
        v["llm_log"].set(d.get("llm_log", True))
        self._saved_lang = d.get("ocr_lang", "auto")
        geo = d.get("geometry")
        if geo:
            try:
                self.root.geometry(geo)
            except tk.TclError:
                pass

    def _save_settings(self):
        try:
            d = self.options().to_dict()
            d["geometry"] = self.root.geometry()
            d["auto_start"] = self.v["autostart"].get()
            with open(settings_path(), "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, indent=1)
        except Exception:
            pass

    def llm_dialog(self):
        v = self.v
        win = tk.Toplevel(self.root)
        win.title("AI 整理设置")
        win.transient(self.root)
        win.resizable(False, False)
        f = ttk.Frame(win, padding=12)
        f.pack(fill="both", expand=True)
        f.columnconfigure(1, weight=1)
        ttk.Label(f, wraplength=420, justify="left", foreground="#555555", text=(
            "识别完成后,把每页的段落交给你选的模型,只做:改明显的识别错字、补上能确定的缺字、"
            "把被错误断开的段落并起来、标出标题和页码。模型的回答会逐段和原文核对,改得太多"
            "(算改写)的整段作废,保持 OCR 原文。")).grid(row=0, column=0, columnspan=2, sticky="w")
        names = [p[0] for p in LLM_PRESETS]
        preset = tk.StringVar(value="常用示例…")
        box = ttk.Combobox(f, textvariable=preset, values=names, state="readonly")

        def pick(_=None):
            for n, url, model in LLM_PRESETS:
                if n == preset.get():
                    v["llm_url"].set(url)
                    v["llm_model"].set(model)
        box.bind("<<ComboboxSelected>>", pick)
        rows = (("填入示例", box), ("接口地址", ttk.Entry(f, textvariable=v["llm_url"], width=46)),
                ("模型名", ttk.Entry(f, textvariable=v["llm_model"])),
                ("API Key", ttk.Entry(f, textvariable=v["llm_key"], show="•")),
                ("整理哪些页", ttk.Combobox(f, textvariable=v["llm_scope"], values=list(LLM_SCOPES), state="readonly")))
        for r, (label, w) in enumerate(rows, start=1):
            ttk.Label(f, text=label).grid(row=r, column=0, sticky="w", pady=3)
            w.grid(row=r, column=1, sticky="ew", pady=3, padx=(8, 0))
        ttk.Checkbutton(f, text="另存一份「整理记录」(每处改动的 前 → 后)", variable=v["llm_log"]).grid(
            row=6, column=0, columnspan=2, sticky="w", pady=(6, 0))
        ttk.Label(f, wraplength=420, justify="left", foreground="#777777", text=(
            "本机运行(Ollama / LM Studio)不联网、不花钱,文字不出这台电脑。用云端接口时,页面文字会发给对方。"
            "API Key 明文存在本机设置文件里。")).grid(row=7, column=0, columnspan=2, sticky="w", pady=(6, 0))
        status = ttk.Label(f, text="", wraplength=420, justify="left")
        status.grid(row=9, column=0, columnspan=2, sticky="w", pady=(6, 0))

        def test():
            status.config(text="连接中…", foreground="#555555")
            url, model, key = v["llm_url"].get(), v["llm_model"].get(), v["llm_key"].get()

            def work():
                from .llm import LlmClient, LlmError
                try:
                    reply = LlmClient(url, model, key, timeout=60).ping()
                    res = ("ok", f"连通了。模型回答: {reply or '(空)'}")
                except LlmError as e:
                    res = ("err", f"连不上: {e}")
                self.events.put(("llmtest", (status, res)))
            threading.Thread(target=work, daemon=True).start()
        bar = ttk.Frame(f)
        bar.grid(row=8, column=0, columnspan=2, sticky="e", pady=(10, 0))
        ttk.Button(bar, text="测试连接", command=test).pack(side="left")
        ttk.Button(bar, text="完成", command=lambda: (v["llm"].set(True), win.destroy())).pack(side="left", padx=(6, 0))
        win.grab_set()

    def _backend_changed(self):
        self._saved_lang = "auto"
        self.v["lang"].set(AUTO_LANG)
        self._detect_langs()

    def _detect_langs(self):
        backend = self.options().backend

        def work():
            from .ocr import make_backend, OcrUnavailable
            try:
                be = make_backend(backend, "auto")
                langs = be.languages()
                msg = f"OCR 引擎: {be.name} · 默认语言 {be.language}"
            except OcrUnavailable as e:
                langs, msg = [], "没有可用的 OCR 引擎(文字层 PDF 仍可转换)\n" + str(e)
            except Exception as e:
                langs, msg = [], f"检测 OCR 引擎出错: {e}"
            self.events.put(("langs", (langs, msg)))
        threading.Thread(target=work, daemon=True).start()

    # ------------------------------------------------------------------ queue
    def pick_files(self):
        types = [("支持的文件", " ".join("*" + e for e in ALL_EXTS)), ("PDF", "*.pdf"),
                 ("图片", "*.png *.jpg *.jpeg *.bmp *.tif *.tiff *.webp *.gif"), ("所有文件", "*.*")]
        paths = filedialog.askopenfilenames(title="选择要转换的文件", filetypes=types)
        if paths:
            self.add_paths(paths)

    def pick_folder(self):
        d = filedialog.askdirectory(title="选择文件夹: 里面(含子文件夹)需要 OCR 的文件会自动挑出来")
        if d:
            self.scan_dirs([d])

    def pick_out(self):
        d = filedialog.askdirectory(title="选择输出文件夹")
        if d:
            self.v["out_dir"].set(d)
            self.v["where"].set("dir")

    def _drop(self, event):
        self.add_paths(self.root.tk.splitlist(event.data))

    def add_paths(self, paths):
        """Files go straight into the queue. Folders are looked through and only what needs
        OCR is queued (see scan.py for the rule)."""
        files, dirs, skipped = [], [], 0
        for p in paths:
            if os.path.isdir(p):
                dirs.append(p)
            elif kind_of(p):
                files.append(p)
            else:
                skipped += 1
        added = self.q.add(files)
        for j in added:
            self._update_row(j)
        if skipped:
            self._log(f"忽略 {skipped} 个不支持的文件")
        if added:
            self._log(f"已添加 {len(added)} 个文件")
        if self.q.jobs:
            self.hint.place_forget()
        self._refresh_summary()
        if dirs:
            self.scan_dirs(dirs)

    def scan_dirs(self, dirs):
        if getattr(self, "_scanning", False):
            messagebox.showinfo("正在扫描", "上一个文件夹还在扫描,请稍等或点「停止」。")
            return
        from .scan import scan_folder
        self._scanning = True
        self._scan_cancel = threading.Event()
        opts = self.options()                       # read here: worker threads must not touch Tk
        cancel = self._scan_cancel
        self._log("开始扫描: " + "、".join(dirs))

        def work():
            allv = []
            try:
                for d in dirs:
                    allv += scan_folder(d, opts, cancel.is_set,
                                        lambda a, b, name: self.events.put(("scanprog", (a, b, name))))
            except Exception as e:
                self.events.put(("log", f"扫描出错: {e}"))
            self.events.put(("scandone", (allv, cancel.is_set())))
        threading.Thread(target=work, daemon=True).start()

    def _scan_done(self, verdicts, cancelled):
        from .scan import summarize
        self._scanning = False
        self._log(("已取消。" if cancelled else "") + summarize(verdicts))
        picked = [v for v in verdicts if v.needs_ocr]
        added = self.q.add([v.path for v in picked], {v.path: v.reason for v in picked})
        for j in added:
            self._update_row(j)
        if self.q.jobs:
            self.hint.place_forget()
        self._refresh_summary()
        if not picked:
            if not cancelled:
                messagebox.showinfo("没有需要 OCR 的文件", summarize(verdicts))
            return
        if self.v["autostart"].get() and not cancelled and added and not self.q.busy():
            self.start()

    def _selected_ids(self):
        return {int(i) for i in self.tree.selection()}

    def remove_selected(self):
        ids = self._selected_ids()
        self.q.remove(ids)
        for i in ids:
            if self.tree.exists(str(i)) and not any(j.id == i for j in self.q.jobs):
                self.tree.delete(str(i))
        self._refresh_summary()

    def clear_done(self):
        self.q.clear_finished()
        for iid in self.tree.get_children():
            if not any(j.id == int(iid) for j in self.q.jobs):
                self.tree.delete(iid)
        self._refresh_summary()

    def move(self, delta):
        ids = sorted(self._selected_ids(), key=lambda i: next(k for k, j in enumerate(self.q.jobs) if j.id == i),
                     reverse=delta > 0)
        for i in ids:
            self.q.move(i, delta)
        order = {j.id: k for k, j in enumerate(self.q.jobs)}
        for iid in sorted(self.tree.get_children(), key=lambda x: order.get(int(x), 1 << 30)):
            self.tree.move(iid, "", "end")

    def retry_failed(self):
        self.q.retry()
        for j in self.q.jobs:
            self._update_row(j)

    # ---------------------------------------------------------------- run control
    def start(self):
        o = self.options()
        try:
            parse_range(o.page_range, 10**6)
        except ValueError as e:
            messagebox.showerror("页码范围", str(e))
            return
        if o.out_dir and not os.path.isdir(o.out_dir):
            try:
                os.makedirs(o.out_dir, exist_ok=True)
            except OSError as e:
                messagebox.showerror("输出文件夹", str(e))
                return
        if not any(j.status == QUEUED for j in self.q.jobs):
            messagebox.showinfo("没有任务", "队列里没有等待处理的文件。")
            return
        self._save_settings()
        self._snapshot = o
        self.q.start()
        self._set_running(True)

    def pause(self):
        if self.q.paused:
            self.q.resume()
            self.btn_pause.config(text="暂停")
        else:
            self.q.pause()
            self.btn_pause.config(text="继续")

    def stop(self):
        if getattr(self, "_scanning", False):
            self._scan_cancel.set()
        self.q.stop()
        self.btn_pause.config(text="暂停")

    def _set_running(self, running):
        self.btn_start.config(state="disabled" if running else "normal")
        self.btn_pause.config(state="normal" if running else "disabled", text="暂停")
        self.btn_stop.config(state="normal" if running else "disabled")

    # ---------------------------------------------------------------- results
    def _first_output(self):
        for i in self._selected_ids():
            j = next((j for j in self.q.jobs if j.id == i), None)
            if j and j.outputs:
                return j.outputs[0]
        return None

    def open_result(self):
        p = self._first_output()
        if p:
            open_path(p)

    def open_folder(self):
        p = self._first_output()
        if p:
            reveal(p)
        else:
            self.open_out_dir()

    def open_out_dir(self):
        o = self.options()
        d = o.out_dir
        if not d:
            sel = next((j for j in self.q.jobs if j.id in self._selected_ids()), None) or \
                (self.q.jobs[0] if self.q.jobs else None)
            d = os.path.dirname(sel.path) if sel else ""
        if d and os.path.isdir(d):
            open_path(d)

    def _menu(self, event):
        iid = self.tree.identify_row(event.y)
        if iid and iid not in self.tree.selection():
            self.tree.selection_set(iid)
        self.menu.tk_popup(event.x_root, event.y_root)

    # ------------------------------------------------------------------ events
    def _pump(self):
        try:
            self._snapshot = self.options()
        except tk.TclError:
            pass
        dirty = {}
        try:
            for _ in range(400):
                kind, obj = self.events.get_nowait()
                if kind == "job":
                    dirty[obj.id] = obj
                elif kind == "log":
                    self._log(obj)
                elif kind == "idle":
                    self._set_running(False)
                    self._on_idle()
                elif kind == "langs":
                    self._set_langs(*obj)
                elif kind == "scanprog":
                    a, b, name = obj
                    self.summary.config(text=f"扫描 {a}/{b}")
                elif kind == "scandone":
                    self._scan_done(*obj)
                elif kind == "llmtest":
                    label, (state, msg) = obj
                    try:
                        label.config(text=msg, foreground="#1b7f3b" if state == "ok" else "#b3261e")
                    except tk.TclError:
                        pass                       # dialog already closed
        except queue.Empty:
            pass
        for j in dirty.values():
            self._update_row(j)
        if dirty:
            self._refresh_summary()
        self.root.after(100, self._pump)

    def _on_idle(self):
        done = sum(j.status == DONE for j in self.q.jobs)
        bad = sum(j.status == FAILED for j in self.q.jobs)
        self._log(f"全部处理完毕: 成功 {done},失败 {bad}")
        try:
            self.root.bell()
        except tk.TclError:
            pass

    def _set_langs(self, langs, msg):
        self.langs = {f"{tag}  {name}": tag for tag, name in langs}
        self.lang_box.config(values=[AUTO_LANG] + list(self.langs))
        want = getattr(self, "_saved_lang", "auto")
        self.v["lang"].set(next((k for k, t in self.langs.items() if t == want), AUTO_LANG))
        self.engine_label.config(text=msg)
        self._log(msg.replace("\n", " "))

    def _update_row(self, j):
        iid = str(j.id)
        prog = f"{j.done}/{j.total}" if j.total else ""
        vals = (os.path.basename(j.path), os.path.splitext(j.path)[1].lstrip(".").upper(),
                STATUS_TEXT.get(j.status, j.status), prog, j.message)
        if self.tree.exists(iid):
            self.tree.item(iid, values=vals, tags=(j.status,))
        else:
            self.tree.insert("", "end", iid=iid, values=vals, tags=(j.status,))
            self.hint.place_forget()

    def _refresh_summary(self):
        jobs = self.q.jobs
        if not jobs:
            self.bar["value"] = 0
            self.summary.config(text="")
            self.hint.place(relx=0.5, rely=0.45, anchor="center")
            return
        frac = 0.0
        for j in jobs:
            if j.status in (DONE, FAILED, CANCELLED, SKIPPED):
                frac += 1
            elif j.total:
                frac += j.done / j.total
        self.bar["value"] = 1000 * frac / len(jobs)
        n = lambda s: sum(j.status == s for j in jobs)
        self.summary.config(text=f"共 {len(jobs)} · 完成 {n(DONE)} · 等待 {n(QUEUED)}"
                                 + (f" · 失败 {n(FAILED)}" if n(FAILED) else ""))

    def _log(self, text):
        self.log.config(state="normal")
        self.log.insert("end", text + "\n")
        self.log.see("end")
        self.log.config(state="disabled")

    def _close(self):
        if self.q.busy() and not messagebox.askyesno("退出", "还有任务在进行,确定退出?"):
            return
        self._save_settings()
        self.q.shutdown()
        self.root.destroy()


def main(argv=None):
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except Exception:
            pass
    root = TkinterDnD.Tk() if TkinterDnD is not None else tk.Tk()
    try:
        App(root, [a for a in (argv or []) if os.path.exists(a)])
    except Exception as e:
        messagebox.showerror("启动失败", str(e))
        raise
    root.mainloop()
