# 用 MiniMax H3(Hailuo 3.0)生成能进 PXA 的片子

> H3 实测口径(2026-07-31 发布):**分辨率只有 2K**(短边 1440)、**时长 4–15 秒**、
> **24fps**、比例 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 / adaptive、提示词上限 7000 字符。
> 图生视频接受 **0–2 张图,角色是 `first_frame` / `last_frame`**,比例跟输入走;
> **i2v 和 r2v 互斥**,一次请求里不能既给首尾帧又给参考图。
>
> ⚠️ 这些是查证来的、不是记忆里的。改版很快,下单前按官方文档再核一次时长/分辨率组合。

---

## 0 · 先决定走哪条路,这决定了后面每一个参数

**两条路的区别不是画风,是"画面里到底有没有一张格子"。**

| | A · 像素源 | B · 非像素源 |
|---|---|---|
| 首帧 | 你自己的像素画,**最近邻**放大到 2K | 任何图(照片、插画、渲染) |
| 画面里有格子吗 | **有**,而且是真的 | **没有** |
| 编码时 | 自动检测网格 | **必须 `--cells WxH`** |
| 你在做什么 | 把一张画**动起来** | 把一段影像**重新采样成格子** |

⭐⭐ **B 路里 `--cells` 不是兜底,是唯一正确的模式。** 检测器会报
`WARNING weak lattice` —— **那句警告是对的,不要去"修"它**:一段没有格子的影像上,
任何检测出来的格子都是在噪声里找图案。你要的是**你选的那个格子**,因为格子是你的设计决定,
不是素材的属性。

---

## 1 · A 路:让一张像素画动起来

### 首帧怎么准备

1. 原画 **W×H 格**(建议 48–96 格宽;再细,2K 下每格不到 15px,压缩会把它吃掉)。
2. **最近邻**放大到短边 1440,倍数**取整**。例:64 格宽、16:9 → 2560×1440,
   每格 40px(= 2560/64),整数。
3. ⚠️ **不要放大成分数倍再交给模型**。你自己造出来的漂移,模型会原样学过去,
   而检测器之后要从压缩噪声里把它挖回来。**能在源头保证整数的地方,不要留给后面去解。**

### 提示词的骨架

```
A single static wide shot of <SUBJECT>. The camera does not move at all —
no pan, no zoom, no dolly, no handheld drift, no parallax.

Everything keeps the exact flat colours and hard edges of the input image.
No new shading, no gradients, no glow, no bloom, no depth of field, no
motion blur, no film grain, no lens flare, no vignette, no colour grading.
The palette stays exactly as given; introduce no new colours.

What moves: <MOTION — 一句话,一个主体>.
Everything else is completely still.
```

三条,每条都是为了后面那一步:

- ⭐ **镜头必须钉死。** 镜头一动,画面里所有格子一起位移,而位移几乎一定是**分数像素**的 ——
  于是整张图的格子边界每一帧都在换位置,网格检测面对的是一个移动的靶子。
  **静止镜头不是审美选择,是这条管线成立的前提。**
- ⭐ **点名要禁掉的每一种"电影感"。** 景深、运动模糊、颗粒、辉光、调色 ——
  它们全都在做同一件事:**把硬边变软、把平色变成渐变**,而那两样正好是像素画仅有的两样东西。
  只写 "pixel art style" 不够,模型会理解成"像素画风的电影镜头"。
- ⭐ **只让一样东西动。** 不是为了省事:动的东西越多,帧间变化的格子越多,
  delta 编码就越接近全量关键帧。**一个会动的主体 + 一片静止的场,既是好构图也是小文件。**

### 会动的东西怎么描述(挑一个,不要堆)

| 想要的 | 写法 |
|---|---|
| 水/浪 | `slow horizontal drift of the water surface, left to right, looping` |
| 草/苇/竹 | `the grass sways gently from its base, a slow steady rhythm` |
| 云 | `one cloud slides slowly across the sky, everything else still` |
| 雨/雪 | `fine rain falls straight down at a constant speed` |
| 火/灯 | `the flame flickers in place, the light on the wall does not spread` |
| 人物待机 | `the character breathes — shoulders rise and fall once every two seconds` |

### ⭐⭐ 拿首尾帧换一个真正的循环

**这是 H3 在这条管线上最值钱的一个能力,而且不用额外成本:**
`first_frame` 和 `last_frame` **传同一张图**。

模型于是被两头钉住,中间那段自己回到起点 —— 你拿到的是**一个闭合的循环**,
而不是一段"结尾和开头对不上、只能硬切"的片子。网页上的动画基本都是循环的,
**没有这一手,你要么接受一次可见的跳帧,要么手工裁一段**。

⚠️ 循环时长挑 **4 / 6 / 8 秒**这类整秒。24fps 下:

| 目标 fps | 每 N 帧取 1 | 6 秒得到 | 8 秒得到 |
|---|---|---|---|
| 12 | 2 | 72 帧 | 96 帧 |
| 8 | 3 | 48 帧 | 64 帧 |
| 6 | 4 | 36 帧 | 48 帧 |

**12 / 8 / 6 都是 24 的整除数**,所以每一帧都直接来自一帧源,**没有任何一帧是两帧插出来的**。
10fps 不行 —— 24/10 = 2.4,四成的帧会是重采样的糊帧,而糊帧正是网格检测最怕的输入。

### 拿到片子之后

```bash
ffmpeg -i clip.mp4 -vf fps=12 frames/%04d.png
node tools/pxa/cli.mjs encode frames -o art.pxa.json --colors 16 --fps 12
node tools/pxa/cli.mjs preview art.pxa.json -o check --scale 8   # 看图,不要只看数字
```

或者整段丢进 `tools/pxa-studio.html`,浏览器里做完,**不需要 ffmpeg**。

---

## 2 · B 路:把一段普通影像变成格子动画

这条路**不要试图让模型输出像素画**。试过的人都知道那是抽奖:它会给你一张"像素风插画",
但它的格子大小在画面各处不一致、边缘带抗锯齿,**那不是格子,是像素画的照片**。

正确的分工是:**让模型只负责影像,格子由你来定。**

```
A static wide shot of <SUBJECT>. The camera is locked off — no pan, no zoom,
no handheld movement. Flat, even lighting with no strong gradient across the
frame. Large simple shapes, few colours, high contrast between areas.
No depth of field, no motion blur, no film grain, no bloom.
<MOTION — 一句话>.
```

- ⭐ **"大块、少色、高对比"三条是为量化提的**,不是为好看。一段颜色连续过渡的影像,
  量化成 16 色之后会出现**色带**;而大块平色量化之后**还是大块平色**。
  这条要求在拍摄阶段提出来,比在编码阶段调参数有用得多。
- 编码时**必须**指定格子:

```bash
node tools/pxa/cli.mjs encode frames -o art.pxa.json --cells 64x36 --colors 12
```

- ⚠️ 格子数**自己挑,别让它大**。64×36 是 2304 个格子;128×72 是 9216 个,
  文件大四倍,而在一张 280px 的卡片上**你一个都分不出来**。
  先问**这段动画会以多大出现在页面上**,再倒推格子数:
  一张 280px 宽的卡片,64 格就是每格 4.4px —— 已经足够。

---

## 3 · 两条路都适用的几条

⚠️ **码率给够。** 像素画是"大面积平色 + 密集硬边",正好是 DCT 编码器最不擅长的组合:
低码率下每一条硬边都会带一圈振铃,而振铃就在你要采样的格子里。
能控制的话给到 8–12 Mbps;不能控制的话,**至少不要再经一次转码**
(社交平台的重压缩会把一段能用的素材变成不能用的)。

⚠️ **不要加任何"复古 CRT"效果。** 扫描线、荧幕弯曲、色差 —— 它们各自都是一套**周期性的、
和你的格子不对齐的图案**,而网格检测正是在找周期性图案。扫描线会被当成格线。
想要 CRT 的话,在**播放端**加,那时格子已经定了。

⚠️ **纯色背景比渐变背景好,但纯黑纯白最差。** 大片纯黑会让编码器把码率全分给别处;
而且纯黑纯白在调色板里占一格却携带最少的信息(本仓库为"极端色最安全是错的"已经量过一次)。
用一个**有色相的深色**当底。

⭐ **一次生成多条,选网格最干净的那条。** 判据不是好不好看,是
`cli.mjs encode` 报的那两个 `score`:**两个都 ≥2.0 基本稳,任一个 <1.5 就换一条**。
这比盯着画面猜快得多。

---

## 4 · 一个可以直接抄的完整例子

**目标**:一张 64×36 的山景,水面横向流动,做成 6 秒循环,进页面当卡片底图。

```
首帧:自己画的 64×36 像素画,最近邻放大到 2560×1440
first_frame = 那张图
last_frame  = 同一张图          ← 循环靠这个
duration    = 6
resolution  = 2K
aspect      = 16:9
```

```
A single static wide shot of a mountain range above still water. The camera is
completely locked off — no pan, no zoom, no dolly, no handheld drift.

Every shape keeps the exact flat colours and hard edges of the input image. No
new shading, no gradients, no glow, no bloom, no depth of field, no motion
blur, no film grain, no lens flare, no colour grading. The palette stays
exactly as given; introduce no new colours.

What moves: the reflections on the water drift slowly from left to right, a
steady unhurried rhythm. The mountains, the sky and the shoreline are
completely still.
```

```bash
ffmpeg -i clip.mp4 -vf fps=12 frames/%04d.png        # 72 帧
node tools/pxa/cli.mjs encode frames -o range.pxa.json --colors 10 --fps 12 --map ramp
node tools/pxa/cli.mjs preview range.pxa.json -o check --scale 6
```

`--map ramp` 把 10 个颜色接到 `--bw-palette-1..10` 上,**这段动画从此跟着 114 组一起轮换** ——
它不会成为页面上唯一一个不跟色卡走的东西。代价是颜色**必须**收到 10 个以内,
超了 CLI 会直接拒绝而不是悄悄合并两个颜色。
