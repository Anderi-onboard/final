"""Optional clean-up pass: hand each OCR'd page to a language model that fixes what the
OCR got wrong and nothing else.

Speaks the OpenAI-style /chat/completions protocol, which Ollama, LM Studio, llama.cpp's
server, vLLM and most hosted services (DeepSeek, Qwen, Zhipu, OpenAI, ...) all accept.
Standard library only.

A language model that is asked to "tidy" text will happily rewrite it, so the model is
never trusted: every answer is checked against what went in (same paragraphs, same text up
to a few characters) and anything that does not check out is thrown away and the OCR text
is kept as it was."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from difflib import SequenceMatcher
from typing import Callable, List, Optional

from .model import Page, Para

SYSTEM = """你是 OCR 校对员。用户给你一页书的 OCR 结果:一个 JSON 数组,每项是 {"id": 编号, "text": 一个段落}。

只做下面四件事,别的一概不做:
1. 改明显的识别错误: 形近字认错(如 已/己/巳、未/末、日/曰、0/O/〇、1/l/I)、多出的乱码字符。
2. 补上明显缺掉的字: 只有根据上下文能确定是哪个字才补;拿不准就保持原样,绝不猜。
3. 把被错误断开的段落并起来: 一句话在页尾/页中被切成两项时,合成一项。
4. 标出每项是什么: body 正文、h1/h2/h3 标题(层级)、pagenum 页码(如 -2-、第3页、纯数字)。

严格禁止: 改写、润色、概括、扩写、翻译、删除内容、调整语序、改标点风格。
简体就保持简体,繁体就保持繁体,中英文保持原样。没有错的地方一个字都不要动。

只输出一个 JSON 数组,不要任何解释、不要 markdown 代码块。每个输出项:
{"src": [用到的输入编号, 按原顺序], "text": 整理后的文字, "kind": "body"|"h1"|"h2"|"h3"|"pagenum"}
每个输入编号必须恰好出现在一个输出项里,顺序不变。没有要并的就一项对一项。"""

CHUNK_CHARS = 2400
_THINK = re.compile(r"<think>.*?</think>", re.S)
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.M)


class LlmError(RuntimeError):
    pass


class LlmClient:
    def __init__(self, base_url: str, model: str, api_key: str = "", timeout: float = 180.0):
        base = (base_url or "").strip().rstrip("/")
        if not base or not model:
            raise LlmError("没有填模型地址或模型名")
        self.url = base if base.endswith("/chat/completions") else base + "/chat/completions"
        self.model, self.key, self.timeout = model.strip(), (api_key or "").strip(), timeout

    def chat(self, system: str, user: str, retries: int = 2) -> str:
        body = json.dumps({"model": self.model, "temperature": 0, "stream": False,
                           "messages": [{"role": "system", "content": system},
                                        {"role": "user", "content": user}]}).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.key:
            headers["Authorization"] = "Bearer " + self.key
        last = None
        for _ in range(retries + 1):
            try:
                req = urllib.request.Request(self.url, data=body, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    data = json.loads(r.read().decode("utf-8"))
                text = data["choices"][0]["message"]["content"] or ""
                return _THINK.sub("", text).strip()
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:200]
                last = LlmError(f"HTTP {e.code}: {detail}")
                if e.code in (400, 401, 403, 404):
                    raise last                          # retrying will not change the answer
            except (urllib.error.URLError, TimeoutError, OSError, KeyError, IndexError, ValueError) as e:
                last = LlmError(f"{type(e).__name__}: {e}")
        raise last

    def ping(self) -> str:
        return self.chat("只回答一个字: 好", "测试", retries=0)[:40]


def parse_json_array(text: str):
    text = _FENCE.sub("", _THINK.sub("", text)).strip()
    try:
        v = json.loads(text)
    except ValueError:
        a, b = text.find("["), text.rfind("]")
        if a < 0 or b <= a:
            return None
        try:
            v = json.loads(text[a:b + 1])
        except ValueError:
            return None
    return v if isinstance(v, list) else None


def _flat(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


def close_enough(before: str, after: str) -> bool:
    """The model may fix characters. It may not rewrite."""
    if not after.strip():
        return False
    if before == after:
        return True
    if len(after) == len(before):                      # characters swapped for others: a typical OCR fix
        if sum(a != b for a, b in zip(before, after)) <= max(1, round(len(before) * 0.2)):
            return True
    if not (0.75 <= len(after) / max(1, len(before)) <= 1.3):
        return False
    r = SequenceMatcher(None, before, after, autojunk=False).ratio()
    return r >= 0.8 or (len(before) < 15 and r >= 0.6)


def _validate(items, out) -> Optional[list]:
    """items = [(id, text)], out = parsed model answer. Returns the checked answer or None."""
    if not out:
        return None
    ids = [i for i, _ in items]
    text = dict(items)
    seen: List[int] = []
    checked = []
    for o in out:
        if not isinstance(o, dict):
            return None
        src, t = o.get("src"), o.get("text")
        if not isinstance(src, list) or not src or not isinstance(t, str):
            return None
        try:
            src = [int(x) for x in src]
        except (TypeError, ValueError):
            return None
        seen += src
        kind = o.get("kind") if o.get("kind") in ("body", "h1", "h2", "h3", "pagenum") else "body"
        checked.append((src, _flat(t), kind))
    if seen != ids:                                    # each id once, in order
        return None
    for src, t, _ in checked:
        if not close_enough("".join(_flat(text[i]) for i in src), t):
            return None
    return checked


def cleanup_page(page: Page, client: LlmClient, log: list) -> int:
    """Clean one OCR'd page in place. Returns how many paragraphs changed."""
    paras = [(n, b) for n, b in enumerate(page.blocks) if isinstance(b, Para) and b.text.strip()]
    if not paras:
        return 0
    chunks, cur, size = [], [], 0
    for n, p in paras:
        t = len(p.text)
        if cur and size + t > CHUNK_CHARS:
            chunks.append(cur)
            cur, size = [], 0
        cur.append((n, p))
        size += t
    chunks.append(cur)

    changed = 0
    replace = {}                                       # block index -> new Para (or None = dropped)
    for chunk in chunks:
        items = [(k, _flat(p.text)) for k, (_, p) in enumerate(chunk)]
        payload = json.dumps([{"id": k, "text": t} for k, t in items], ensure_ascii=False)
        try:
            out = _validate(items, parse_json_array(client.chat(SYSTEM, payload)))
        except LlmError as e:
            raise
        if out is None:
            log.append("这一段模型的回答没通过检查(改得太多或格式不对),保持 OCR 原文")
            continue
        for src, t, kind in out:
            first = chunk[src[0]][1]
            before = "".join(_flat(chunk[i][1].text) for i in src)
            if t != before or len(src) > 1:
                changed += 1
                log.append(f"{before}\n  → {t}")
            first.runs[0].text = t
            del first.runs[1:]
            if kind in ("h1", "h2", "h3"):
                first.heading = int(kind[1])
                first.runs[0].bold = True
            elif kind == "pagenum":
                first.heading, first.align = 0, "center"
                first.runs[0].size = min(first.runs[0].size or 9, 9)
            for i in src[1:]:
                replace[chunk[i][0]] = None
    if replace:
        page.blocks = [b for n, b in enumerate(page.blocks) if n not in replace]
    return changed


def cleanup_doc(doc, client: LlmClient, scope: str = "ocr",
                checkpoint: Callable[[], None] = lambda: None,
                progress: Callable[[int, int], None] = lambda a, b: None) -> dict:
    """Run the pass over a document. A failing model never fails the conversion: the first
    error stops the pass, the pages already done stay done, the rest keep the OCR text."""
    todo = [p for p in doc.pages if p.blocks and (scope == "all" or p.source == "ocr")]
    log: List[str] = []
    changed = 0
    error = ""
    for n, page in enumerate(todo):
        checkpoint()
        progress(n, len(todo))
        try:
            changed += cleanup_page(page, client, log)
        except LlmError as e:
            error = str(e)
            break
    progress(len(todo), len(todo))
    return dict(changed=changed, pages=len(todo), log=log, error=error)
