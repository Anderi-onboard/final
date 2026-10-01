# 来源

这个目录是第三方 skill「book-to-skill」,不是本仓库写的。

- 仓库:https://github.com/virgiliojr94/book-to-skill (MIT,见 `LICENSE.md`)
- 版本:提交 `80ae087784ddbc21dbbfde355fe5509631e0e322`(2026-09-22)
- 装进来的日期:2026-09-28

## 装了哪些

只放 skill 运行要用的文件,内容和上游逐字相同:

- `SKILL.md`:skill 本体(Claude Code 读的就是它)
- `scripts/extract.py`、`book_to_skill/`:抽取文字的程序
- `tools/scan_generated_skill.py`、`tools/validate_skill.py`:SKILL.md 第 9.5 步要跑的检查
- `README.md`、`LICENSE.md`:SKILL.md 引用的版权说明和许可证

没装:上游的 `docs/`、`tests/`、`evals/`、`.github/`、它自己的 `CLAUDE.md`/`AGENTS.md`(给它的贡献者看的,
放进来会被当成本仓库的工作说明)。

## 装之前查过什么

- 上游有一份安全公告(`SECURITY-NOTICE.md`,没搬过来):有人用同名仓库 `Leutenegger/book-to-skill`
  发过一个改过的版本,会偷钱包数据。**只从 `virgiliojr94/book-to-skill` 取。**
- 这份代码里会起子进程的只有:`pip install` 一张固定清单里的包(pypdf、pdfminer.six、ebooklib、
  beautifulsoup4、python-docx、striprtf、trafilatura、docling、pdf-inspector;默认先问,非交互时不装)、
  `pdftotext`/`pdfinfo`、Calibre 的 `ebook-convert`、`git rev-parse`。没有别的联网代码。

## 要更新

重新 clone 上游,把上面列的文件整份覆盖,改掉这里的提交号和日期,再逐个读一遍 diff。
