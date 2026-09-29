---
name: guji-duanfa
description: 古籍断法库。六爻、梅花易数、大六壬、奇门遁甲、紫微斗数五门古籍里的判断规则,按问题(求财、婚姻、疾病、事业、考试、出行、失物、官非、应期)分主题整理;每条规则都有逐字核对过的原文、现代汉语译文和英文,三栏逐句对齐,并标出几家说法不同的地方。Use when judging a divination question by the classical rules, looking up what the classics say about a kind of question, or quoting the original text with a translation.
---

# 古籍断法库

现在收了 519 条。每条是一个判断点:一句整理过的规则,加上它在古书里的原文、译文、英文(逐句对齐),几家说法不一样的地方单独标出来。

## 怎么查

1. 定术数和问题,打开 `chapters/<术数>/<问题域>/索引.md`:每条规则一行,按主题分组,写着该看哪个主题文件。
2. 打开同一文件夹里的 `<主题>.md`:每条规则下面是原文 | 译文 | English 三栏表,注明哪本书第几行。
3. 同一个问题几门一起看:`chapters/联合/<问题域>.md`。
4. 术语和英文叫法:`glossary.md`。书、版本、说话的人:`chapters/出处.md`。全库一览和所有「打架」条目:`cheatsheet.md`。

## 引用的规矩

- **原文是逐字核对过的**:每段原文去掉空白后必须在它标的那本书、那一章的行号范围里原样出现,不然生成这个 skill 的程序直接报错。行号是 `functions/_lib/doctrine/books/` 下整理本的行号,不是原刻本页码。
- **「规则(整理)」不是原文**,是本库的归纳。下断语、写解读时引原文;整理只用来快速找。
- **「打架」**:几家说法不同(比如《黄金策》旧注和王洪绪、野鹤老人意见相反),都列出来了。不要只取一家当定论。
- **「他本同文、异文」**:同一句在别的书里的样子,程序比出来的,只比本文不比注。
- 书里今人加的按语(《增删卜易》的「[乾按]」「[提要]」,《断易天机》的「[注释]」「[译文]」「虎易注」)不收。

## 目录

| 术数 | 问题域 | 条数 | 有哪些主题 |
| --- | --- | --- | --- |
| 六爻 | 婚姻 | 189 | 总则、成否、动变、媒妁、对方、聘嫁、夫妻、外遇、入赘再嫁、应期、风险、子嗣、家人 |
| 六爻 | 求财 | 330 | 总则、有无、难易、动变、应期、取象、买卖、开店、借贷、公门九流、博戏、畜养渔猎、风险、心术 |

五门联合:`chapters/联合/婚姻.md`、`chapters/联合/求财.md`。

## English

Classical divination rules from five arts, organised by the kind of question and then by topic. Every rule carries the source text (verified character by character against the library files), a modern Chinese translation and an English translation, aligned phrase by phrase, and flags where the classics disagree. Start from `chapters/<art>/<domain>/索引.md` (index), then open the topic file it points to; `cheatsheet.md` maps the whole library. "Rule (our summary)" is our wording; quote the source text, not the summary.
