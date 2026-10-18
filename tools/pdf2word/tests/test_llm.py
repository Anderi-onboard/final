"""The AI tidy-up pass, against a stand-in server that speaks the same protocol as
Ollama / LM Studio / the hosted services. What matters is not that a good answer is
used but that a bad one never is."""
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

from p2w import llm                                         # noqa: E402
from p2w.engine import Options, convert_file               # noqa: E402
from p2w.model import Page, Para, Run                       # noqa: E402

try:
    import make_fixtures
    FONT = make_fixtures.cjk_font()
except BaseException:
    make_fixtures, FONT = None, None


class Server:
    """mode: good | rewrite | badjson | dropped | fenced | think | http500 | http401"""

    def __init__(self, mode="good"):
        self.mode, self.hits, self.key_seen = mode, 0, None
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                outer.hits += 1
                outer.key_seen = self.headers.get("Authorization")
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                items = json.loads(body["messages"][1]["content"]) if body["messages"][1]["content"].startswith("[") else []
                m = outer.mode
                if m in ("http500", "http401"):
                    self.send_response(500 if m == "http500" else 401)
                    self.end_headers()
                    self.wfile.write(b"nope")
                    return
                out = outer.answer(items)
                text = {"badjson": "抱歉,我无法完成这个请求。", "fenced": "```json\n" + out + "\n```",
                        "think": "<think>先想一想……</think>" + out}.get(m, out)
                if not items:
                    text = "好"
                data = json.dumps({"choices": [{"message": {"content": text}}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(data)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}/v1"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def answer(self, items):
        if self.mode == "rewrite":
            return json.dumps([{"src": [i["id"]], "text": "这是一段完全不同的、模型自己写的话,和原文没有关系。" * 2,
                                "kind": "body"} for i in items], ensure_ascii=False)
        if self.mode == "dropped":
            return json.dumps([{"src": [i["id"]], "text": i["text"], "kind": "body"} for i in items[:-1]], ensure_ascii=False)
        out, i = [], 0
        while i < len(items):
            t = items[i]["text"].replace("精酷", "精髓").replace("proposl", "proposal")
            if t.endswith("整理") and i + 1 < len(items):                     # a paragraph cut in two
                out.append({"src": [items[i]["id"], items[i + 1]["id"]], "text": t + items[i + 1]["text"], "kind": "body"})
                i += 2
                continue
            kind = "pagenum" if t.strip("-").strip().isdigit() else ("h2" if t.startswith("1.") else "body")
            out.append({"src": [items[i]["id"]], "text": t, "kind": kind})
            i += 1
        return json.dumps(out, ensure_ascii=False)

    def close(self):
        self.httpd.shutdown()


def page():
    mk = lambda t: Para([Run(t, 10.5)])
    return Page(595, 842, [mk("1. 概述"), mk("检测既省力又快。经过几十年研究,我将奇门遁甲的精酷及经验整理"),
                           mk("如下,研究是困难的,但本人不想将已经掌握的东西带进坟墓。"), mk("-2-")], "ocr")


class Tidy(unittest.TestCase):
    def run_page(self, mode):
        srv = Server(mode)
        self.addCleanup(srv.close)
        pg, log = page(), []
        n = llm.cleanup_page(pg, llm.LlmClient(srv.url, "m", "k"), log)
        return pg, n, log, srv

    def test_fixes_merges_and_labels(self):
        pg, n, log, srv = self.run_page("good")
        texts = [b.text for b in pg.blocks]
        self.assertEqual(len(texts), 3)                                          # the cut paragraph is one again
        self.assertIn("精髓及经验整理如下,研究是困难的", texts[1])
        self.assertEqual((pg.blocks[0].heading, pg.blocks[2].align), (2, "center"))   # heading, page number
        self.assertTrue(pg.blocks[0].runs[0].bold)
        self.assertEqual(n, 1)                                                   # one paragraph fixed and rejoined
        self.assertTrue(any("精酷" in l and "精髓" in l for l in log))
        self.assertEqual(srv.key_seen, "Bearer k")

    def test_formatting_of_the_first_part_survives_a_merge(self):
        pg, *_ = self.run_page("good")
        self.assertEqual(pg.blocks[1].runs[0].size, 10.5)
        self.assertEqual(len(pg.blocks[1].runs), 1)

    def test_a_rewrite_is_rejected_and_the_ocr_text_kept(self):
        pg, n, log, _ = self.run_page("rewrite")
        self.assertEqual(n, 0)
        self.assertEqual([b.text for b in pg.blocks], [b.text for b in page().blocks])
        self.assertTrue(any("保持 OCR 原文" in l for l in log))

    def test_junk_answers_are_rejected(self):
        for mode in ("badjson", "dropped"):
            pg, n, log, _ = self.run_page(mode)
            self.assertEqual(n, 0, mode)
            self.assertEqual([b.text for b in pg.blocks], [b.text for b in page().blocks], mode)

    def test_fences_and_think_tags_are_tolerated(self):
        for mode in ("fenced", "think"):
            pg, n, *_ = self.run_page(mode)
            self.assertEqual(n, 1, mode)

    def test_http_errors_raise_a_readable_error(self):
        for mode, word in (("http500", "500"), ("http401", "401")):
            srv = Server(mode)
            self.addCleanup(srv.close)
            with self.assertRaises(llm.LlmError) as cm:
                llm.cleanup_page(page(), llm.LlmClient(srv.url, "m"), [])
            self.assertIn(word, str(cm.exception))

    def test_a_dead_server_never_fails_the_document(self):
        from p2w.model import Doc
        doc = Doc("t", [page(), page()])
        res = llm.cleanup_doc(doc, llm.LlmClient("http://127.0.0.1:9/v1", "m", timeout=2), "ocr")
        self.assertTrue(res["error"])
        self.assertEqual([b.text for b in doc.pages[0].blocks], [b.text for b in page().blocks])

    def test_validation_rules(self):
        self.assertTrue(llm.close_enough("我将奇门遁甲的精酷及经验整理如下", "我将奇门遁甲的精髓及经验整理如下"))
        self.assertFalse(llm.close_enough("我将奇门遁甲的精髓及经验整理如下", "奇门遁甲是一门古老的学问"))
        self.assertFalse(llm.close_enough("正文正文正文正文正文", ""))
        self.assertTrue(llm.close_enough("已", "己"))                    # one character in a short line
        self.assertIsNone(llm._validate([(0, "甲"), (1, "乙")], [{"src": [1], "text": "乙"}, {"src": [0], "text": "甲"}]))  # reordered
        self.assertIsNone(llm._validate([(0, "甲")], [{"src": [0, 0], "text": "甲甲"}]))

    def test_parse(self):
        self.assertEqual(llm.parse_json_array('前面有话 [{"a":1}] 后面也有'), [{"a": 1}])
        self.assertIsNone(llm.parse_json_array("没有数组"))


@unittest.skipUnless(FONT, "needs a CJK font to build fixtures")
class InTheConversion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        make_fixtures.make(cls.tmp)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def convert(self, srv, **kw):
        out = tempfile.mkdtemp(dir=self.tmp)
        o = Options(out_dir=out, formats=("txt",), collision="overwrite", mode="native", llm=True, llm_url=srv.url, **kw)
        return convert_file(os.path.join(self.tmp, "native.pdf"), o, lambda: None), out

    def test_default_scope_leaves_text_layer_pages_alone(self):
        srv = Server("good")
        self.addCleanup(srv.close)
        res, _ = self.convert(srv)
        self.assertEqual(srv.hits, 0)                    # nothing was OCR'd, nothing to fix

    def test_scope_all_runs_and_writes_the_change_log(self):
        srv = Server("good")
        self.addCleanup(srv.close)
        res, out = self.convert(srv, llm_scope="all")
        self.assertGreater(srv.hits, 0)
        self.assertTrue(any(w.startswith("AI 整理:") for w in res["warnings"]))
        names = sorted(os.listdir(out))
        self.assertEqual(names, ["native.txt"] if not any("整理记录" in n for n in names) else ["native.txt", "native.整理记录.txt"])

    def test_a_dead_model_still_gives_a_document(self):
        srv = Server("http500")
        self.addCleanup(srv.close)
        res, out = self.convert(srv, llm_scope="all")
        self.assertEqual(os.listdir(out), ["native.txt"])
        self.assertTrue(any("AI 整理中途停了" in w for w in res["warnings"]))

    def test_off_by_default(self):
        out = tempfile.mkdtemp(dir=self.tmp)
        o = Options(out_dir=out, formats=("txt",), collision="overwrite", mode="native")
        res = convert_file(os.path.join(self.tmp, "native.pdf"), o, lambda: None)
        self.assertFalse(any("AI" in w for w in res["warnings"]))


if __name__ == "__main__":
    unittest.main()
