# PDF / 图片 → Word

把 PDF 和图片转成可编辑的 Word 文档,识别用的是 **Windows 自带的 OCR**
(就是「截图工具」预览里那个「文本操作」按钮背后的引擎 `Windows.Media.Ocr`),
再把它给出的文字和位置还原成带格式的 .docx。离线运行,不用联网,不用 API key。

识别引擎有三个,「自动」按这个顺序挑第一个能用的:
**RapidOCR**(PaddleOCR 模型,模型随安装包自带,中英文识别明显最好)→ **Windows OCR** → Tesseract。
窗口里「引擎」可以手动指定,右下角会写当前用的是哪个。

## 用法

1. 双击 `start.bat`。第一次会自己建环境、装依赖(需要 Python 3.9+),之后秒开。
2. 把文件、文件夹拖进窗口(或点「添加文件」),点 **开始**。
3. 结果默认存在原文件旁边,双击列表里的行直接打开。

命令行(批处理、计划任务):

```
convert.bat 扫描件.pdf 照片.jpg 某个文件夹 -f docx md -o D:\out
convert.bat --list-langs                 # 看 Windows 装了哪些 OCR 语言
convert.bat a.pdf --mode ocr --pages 1-5 # 强制 OCR,只转前 5 页
```

## 支持的输入

| 类型 | 格式 |
|---|---|
| 文档 | PDF · XPS / OXPS · EPUB · MOBI · FB2 · CBZ · SVG |
| 图片 | PNG · JPG · BMP · GIF · TIFF(多页) · WebP · ICO · PPM/PGM/PBM · PCX · TGA;装了 `pillow-heif` 还有 HEIC/HEIF |

输出:**Word (.docx)**、纯文本 (.txt)、Markdown (.md)、网页 (.html),可多选。
批量:任意多个文件和文件夹(含子文件夹)进队列,可排序、暂停/继续、停止、重试失败项,
最多 4 个文件同时处理。关掉再开,设置都记得。

## 格式是怎么还原的

两条路,每一页自己选:

**有文字层的 PDF**(从 Word / 网页导出的)→ 不 OCR,直接取:字体、字号、粗体、斜体、颜色、
缩进、行距、居中/靠右、标题层级、**表格**(转成真正的 Word 表格)、**图片**、双栏顺序。
这比 OCR 准得多,也快得多。想强制 OCR,把「方式」改成「全部 OCR」。

**扫描件 / 图片 / 没有文字层的 PDF** → 渲染成图片 → Windows OCR → 从每行的位置推:

| 还原的东西 | 怎么推的 |
|---|---|
| 段落 | 行间距比正常行距大、首行缩进、上一行没写满且以句号结尾、列表符号 |
| 标题 / 字号 | 行高 + 每字宽度估字号;明显大于正文的短行 → 标题 1/2/3 |
| 居中 / 靠右 / 缩进 | 行的位置对页边距和栏边 |
| 双栏 | 找版心中间的空白栏沟,先左栏后右栏;跨栏的标题把页面分成几段依次读 |
| 表格 | 连续 3 行以上、每行 ≥2 格、各格左边对齐 → Word 表格(两栏正文不会被当成表格) |
| 中英混排 | 汉字之间不加空格;中英交界按真实间距决定要不要空格 |
| 页面大小、页边距 | 取自原页(图片按 A4 宽或 96 dpi 估) |

## 一页塞两页(书籍扫描、讲义缩印)

有的 PDF 一张纸上并排放着两页:左半是前一页,右半是后一页。窗口里「一页塞两页」选:

| 选项 | 做什么 |
|---|---|
| 不拆分 | 默认,一张纸就是一页 |
| 左页在前 | 左半 → 第 1 页,右半 → 第 2 页(普通书) |
| 右页在前 | 右半在前(从右往左翻的书,日漫、古籍) |
| 自动 | 只拆横向的页面(宽 ≥ 1.3 × 高),竖版页面保持不动 |

命令行:`convert.bat 书.pdf --split lr`。

折缝位置自动找,不是死切正中:文字层 PDF 找左右两块文字之间的空白;扫描件找中间 ±10% 里最白的那条竖带,
再从那里切开、各自 OCR,所以不会有一行字横跨折缝被识别成一行。拆出来的每一半是独立的一页(页面宽度也是半张),
版式、表格、标题都按各自这一页单独还原。页码范围(`--pages`)数的是原来的整张纸。

## 要知道的局限

- Windows OCR **不给粗体 / 斜体 / 字体 / 颜色**,所以扫描件里只有标题会加粗,字体统一用宋体 + Times New Roman。
- 生成的是**流式 Word 文档**,不是逐像素复刻:行距、缩进、字号对得上,但换行位置可能和原页差几个字。
- 扫描件里的**图片 / 插图不会保留**(OCR 路径只出文字和表格);文字层 PDF 的图片会保留。
- 没有画线的表格、嵌套表格、合并单元格,识别不出来,会变成普通段落。
- 一个引擎一次只用一种语言。「自动」优先用 **简体中文**引擎,它读英文没问题,反过来英文引擎读不了汉字;
  繁体、日文等请在「语言」里手动选。
- 手写体、很糊的照片、倾斜的页面,Windows OCR 本身就不行,这里没有预处理。

## 引擎对比

| | RapidOCR | Windows OCR |
|---|---|---|
| 中文 / 中英混排 | 很好 | 一般 |
| 安装 | `pip install` 约 90MB,含模型 | 要在系统里装语言包 |
| 输出粒度 | 每行一个框 | 每个词一个框 |
| 速度 | A4 一页约 3–5 秒(CPU) | 更快 |

装 RapidOCR 请用 3.x(`rapidocr`),老的 `rapidocr-onnxruntime` 会把英文单词之间的空格吃掉。

## OCR 语言包 (只有用 Windows OCR 才需要)

Windows OCR 要对应语言的「OCR」功能才能识别那种文字。

设置 → 时间和语言 → 语言和区域 → 添加语言 → 勾选「光学字符识别」。或者以管理员身份开 PowerShell:

```
Get-WindowsCapability -Online -Name "Language.OCR*"
Add-WindowsCapability -Online -Name "Language.OCR~~~zh-CN~0.0.1.0"
Add-WindowsCapability -Online -Name "Language.OCR~~~en-US~0.0.1.0"
```

窗口右下角会写当前用的引擎和语言。没有 Windows OCR 时(比如在 Mac / Linux 上)会退到 Tesseract
(`pip install pytesseract` 并装 Tesseract 程序);文字层 PDF 不需要任何 OCR。

## 目录

```
start.bat / convert.bat   启动窗口 / 命令行
app.py  cli.py            入口
p2w/loader.py             打开 PDF、图片,渲染页面,判断有没有真文字层
p2w/ocr.py                OCR 引擎:RapidOCR、Windows.Media.Ocr、Tesseract
p2w/layout_native.py      文字层 -> 版式
p2w/layout_ocr.py         OCR 行 -> 版式(段落、标题、栏、表格)
p2w/layout_common.py      两条路共用:栏沟检测、阅读顺序
p2w/writers.py            版式 -> docx / txt / md / html
p2w/engine.py             转换流程 + 任务队列
p2w/gui.py                窗口
tests/                    python -m unittest discover -s tests -v
```

测试不需要 Windows:版式用合成的 OCR 行测,Windows 引擎用 WinRT 的替身测调用顺序和坐标换算,
装了 Tesseract 就再多跑一遍真实的 扫描件 → docx。**真正的 Windows OCR 只能在 Windows 上验证**,
第一次用请先拿一份文件试 `--list-langs` 和一页转换。
