"""Which files in a folder need OCR."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

from p2w import scan                                    # noqa: E402
from p2w.engine import Options                          # noqa: E402

try:
    import make_fixtures
    FONT = make_fixtures.cjk_font()
except BaseException:
    make_fixtures, FONT = None, None


@unittest.skipUnless(FONT, "needs a CJK font to build fixtures")
class Scan(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import pymupdf
        from PIL import Image
        cls.src = tempfile.mkdtemp()
        make_fixtures.make(cls.src)
        cls.root = tempfile.mkdtemp()
        r = cls.root
        os.makedirs(os.path.join(r, "books", "deep"))
        os.makedirs(os.path.join(r, "node_modules"))
        os.makedirs(os.path.join(r, ".git"))
        cp = lambda a, b: shutil.copy(os.path.join(cls.src, a), os.path.join(r, b))
        cp("native.pdf", "text.pdf")                          # real text layer: no
        cp("scan.pdf", "books/scan.pdf")                      # pictures only: yes
        cp("book.pdf", "books/deep/photos.pdf")               # photos of a book: yes
        cp("photo.jpg", "photo.jpg")                          # a page photo: yes
        cp("multi.tiff", "multi.tiff")                        # yes
        cp("scan.pdf", "node_modules/skip.pdf")               # never looked at
        cp("scan.pdf", ".git/skip.pdf")
        cp("scan.pdf", "~$lock.pdf")
        Image.new("RGB", (64, 64), "white").save(os.path.join(r, "icon.png"))              # too small
        Image.new("RGB", (800, 120), "white").save(os.path.join(r, "banner.png"))          # too thin
        open(os.path.join(r, "readme.txt"), "w").write("not a type we read")
        open(os.path.join(r, "broken.pdf"), "wb").write(b"%PDF-1.4 nope")
        d = pymupdf.open()                                    # blank page: nothing to read
        d.new_page()
        d.save(os.path.join(r, "blank.pdf"))
        d = pymupdf.open()                                    # 40 text pages + one scanned page in the middle
        for i in range(41):
            pg = d.new_page()
            if i == 20:
                pg.insert_image(pg.rect, filename=os.path.join(cls.src, "page1.png"))
            else:
                pg.insert_text((72, 100), f"page {i} " + "ordinary text " * 12)
        d.save(os.path.join(r, "mixed.pdf"))
        d = pymupdf.open()
        d.new_page().insert_text((72, 100), "secret " * 20)
        d.save(os.path.join(r, "locked.pdf"), encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="x", owner_pw="y")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.src, ignore_errors=True)
        shutil.rmtree(cls.root, ignore_errors=True)

    def verdicts(self, opts=None):
        return {os.path.relpath(v.path, self.root).replace(os.sep, "/"): v for v in scan.scan_folder(self.root, opts)}

    def test_what_is_picked(self):
        v = self.verdicts()
        picked = sorted(k for k, x in v.items() if x.needs_ocr)
        self.assertEqual(picked, ["books/deep/photos.pdf", "books/scan.pdf", "mixed.pdf", "multi.tiff", "photo.jpg"])

    def test_what_is_left_alone_and_why(self):
        v = self.verdicts()
        self.assertEqual(v["text.pdf"].kind, "text")
        self.assertEqual(v["blank.pdf"].kind, "text")            # nothing to read is not "needs OCR"
        self.assertEqual(v["icon.png"].kind, "tiny")
        self.assertEqual(v["banner.png"].kind, "tiny")
        self.assertEqual(v["broken.pdf"].kind, "error")
        self.assertEqual(v["locked.pdf"].kind, "error")
        self.assertIn("密码", v["locked.pdf"].reason)

    def test_junk_folders_hidden_files_and_other_types_are_never_looked_at(self):
        names = set(self.verdicts())
        self.assertFalse(any(n.startswith(("node_modules/", ".git/", "~$")) for n in names))
        self.assertNotIn("readme.txt", names)

    def test_a_scan_hidden_in_the_middle_of_a_long_text_pdf_is_found(self):
        v = self.verdicts()["mixed.pdf"]
        self.assertTrue(v.needs_ocr, v.reason)
        self.assertIn("没有文字层", v.reason)

    def test_already_converted_files_are_skipped_unless_overwriting(self):
        out = tempfile.mkdtemp()
        try:
            open(os.path.join(out, "photo.docx"), "wb").write(b"x")
            o = Options(out_dir=out, formats=("docx",), collision="rename")
            self.assertEqual(self.verdicts(o)["photo.jpg"].kind, "exists")
            self.assertTrue(self.verdicts(o)["multi.tiff"].needs_ocr)
            o2 = Options(out_dir=out, formats=("docx",), collision="overwrite")
            self.assertTrue(self.verdicts(o2)["photo.jpg"].needs_ocr)
            o3 = Options(out_dir=out, formats=("docx", "md"), collision="skip")      # only one of the two formats exists
            self.assertTrue(self.verdicts(o3)["photo.jpg"].needs_ocr)
        finally:
            shutil.rmtree(out, ignore_errors=True)

    def test_summary_and_cancel(self):
        vs = scan.scan_folder(self.root)
        text = scan.summarize(vs)
        self.assertIn("需要 OCR 的 5 个", text)
        self.assertIn("跳过", text)
        self.assertEqual(scan.scan_folder(self.root, None, lambda: True), [])

    def test_cli_only_ocr_converts_just_those(self):
        out = tempfile.mkdtemp()
        try:
            r = subprocess.run([sys.executable, os.path.join(os.path.dirname(HERE), "cli.py"), self.root, "--only-ocr",
                                "-f", "txt", "-o", out, "--backend", "tesseract" if False else "auto", "--pages", "1"],
                               capture_output=True, text=True, timeout=600)
            if "没有可用的 OCR" in (r.stdout + r.stderr):
                self.skipTest("no OCR engine here")
            done = sorted(os.listdir(out))
            self.assertEqual(done, ["mixed.txt", "multi.txt", "photo.txt", "photos.txt", "scan.txt"], r.stderr[-400:])
            self.assertIn("需要 OCR 的 5 个", r.stderr)
        finally:
            shutil.rmtree(out, ignore_errors=True)

    def test_queue_add_carries_the_reason(self):
        from p2w.engine import JobQueue
        q = JobQueue(lambda: Options(), lambda *a: None)
        p = os.path.join(self.root, "photo.jpg")
        j = q.add([p], {p: "图片 1653×2339"})[0]
        self.assertEqual(j.message, "图片 1653×2339")


if __name__ == "__main__":
    unittest.main()
