# 来源

这个目录是第三方 skill「obsidian-markdown」,不是本仓库写的。

- 仓库:https://github.com/kepano/obsidian-skills (MIT,作者 Steph Ango,许可证见 `LICENSE`,是从仓库根目录抄过来的)
- 版本:提交 `3ccff5338ea700537839b21900aa5358a0402c98`(2026-09-15)
- 装进来的日期:2026-09-28
- 同一个仓库还装了 `obsidian-bases`(在隔壁目录,来源同上)

## 装了哪些

上游 `skills/obsidian-markdown/` 整个目录,逐字相同:`SKILL.md` 和 `references/` 里的三个文件。
这个 skill 只有说明文字,没有脚本,不会执行任何程序。

没装:上游另外四个 skill。`obsidian-cli` 要本机装 Obsidian 客户端,`defuddle`/`knap` 要 npm 装命令行工具,
`json-canvas` 画白板,古籍库暂时用不上。

## 用在哪

古籍知识库的 Obsidian 版(`functions/_lib/doctrine/kb/`)按这个 skill 的写法生成:
frontmatter 属性、`[[wikilink]]`、`> [!quote]` 这类 callout、`^block-id`。

## 要更新

重新 clone 上游,把 `skills/obsidian-markdown/` 整份覆盖,改掉这里的提交号和日期,再逐个读一遍 diff。
