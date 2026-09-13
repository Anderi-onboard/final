# PXA — 颜色格子动画

一段像素动画,存成**调色板索引**而不是像素。三个部分:

| | 文件 | 在哪儿跑 |
|---|---|---|
| 格式 | `assets/pxa-codec.mjs` | 两边都跑(Node 编码 / 浏览器解码,**一份实现**) |
| 播放器 | `assets/pxa.js` | 浏览器,`window.BWPixel` |
| 编码链 | `tools/pxa/{png,ingest,cli}.mjs` | Node,零依赖 |
| 工作台 | `tools/pxa-studio.html` | 浏览器,**连 ffmpeg 都不需要** |
| 提示词 | `tools/pxa/prompts.md` | 怎么用 MiniMax H3 生出能进这条链的片子 |

## 为什么是索引而不是像素

两件位图给不了的事:

1. ⭐⭐ **它会跟着色组换色。** 调色板里写 `@3` 的那一格,在画的时候解析成
   `var(--bw-palette-3)`,于是这段动画和页面上别的东西一样跟着 114 组轮换。
   本仓库每一次位图上线都栽在同一处 —— `paper-grain.svg`、`ph-drift.svg` 里写死的
   `fill="#000"`、那道白闪 —— **它们是页面上唯一不跟色卡走的东西**。
   索引位图**不可能**犯这个错,因为它根本不携带颜色。
2. **它对尺寸是开放的。** 格是单位不是像素,所以同一个资产在 48px 和 1400px 上都清晰。

## 用

```bash
# 视频 → 帧(H3 是 24fps,所以 12/8/6 都是整除,没有一帧是插出来的)
ffmpeg -i clip.mp4 -vf fps=12 frames/%04d.png

node tools/pxa/cli.mjs encode frames -o art.pxa.json --colors 16 --fps 12
node tools/pxa/cli.mjs inspect art.pxa.json
node tools/pxa/cli.mjs preview art.pxa.json -o check --scale 8
```

⭐ **`preview` 不是可选的。** `inspect` 的数字对一个**整体错了一格**的网格一样健康 ——
它会完美地往返自己的错误。看图。

```html
<div style="width:280px;aspect-ratio:16/9"
     data-pxa="/assets/art/range.pxa.json" data-pxa-fit="integer"></div>
<script type="module">
  import BWPixel from '/assets/pxa.js';
  BWPixel.auto();
</script>
```

`--map ramp` 把调色板接到 `@1..@10` 上。**必须 ≤10 色**,超了 CLI 拒绝而不是悄悄合并两个颜色。

## 格式

```json
{ "pxa": 1, "w": 64, "h": 36, "fps": 12,
  "palette": ["-", "#1a1c2c", "@3", "@gem"],
  "frames": ["K...", "D...", "D..."] }
```

- `K` 关键帧 = `[游程][索引]`,必须**正好**铺满 `w*h`;`D` 增量 = `[跳过][游程][索引]`。
  编码器每帧取较短的那个,第 0 帧永远是 `K`。
- 数字是 base64 变长整数,5 bit 一字符,`0x20` 位表示后续。0–31 一个字符。
- 调色板:`-` 透明,`#rrggbb` 字面值,`@1..@10` / `@sky` / `@water` / `@gem` /
  `@cloudbody` / `@ink-sky` / `@ink-ridge` 跟色组走。
- `decode()` **会为截断的流抛错**,不会画半张格子 —— 这个仓库为
  「样式已应用、页面上没画出来」付过太多次。

## 量出来的界限(不是猜的)

- **单格特征需要余量。** 一个 1 格宽、紧贴高对比邻居的特征,在 12 色以下会丢掉自己的
  调色板条目(实测 13 格的太阳核 × 12 帧 = 156 格全错)。3 格以上的特征 8 色就够。
- **噪声上限。** 合成损伤实测:两个尺寸 × 七档损伤 **14/14** 检出正确,最重那档是 17× 漂移。
- **"有没有格子"的判据是量出来的。** 无格子素材(平滑渐变 + 柔斑)**两轴恒为 1.00**;
  真素材 14 个配置里最差 1.44、最好 11.18。阈值 1.25 落在这条缝里,低于它 CLI 报
  `WARNING weak lattice`。
- ⚠️ **编码器的块边界本身也是一套格子。** 8×8 块纹在**最干净**的素材上最危险 ——
  没有噪声去埋它时,检测器会锁上 8px 那套(实测 40 格读成 113 格)。
  现在靠"只看最强的 3% 边 + 覆盖率平方"压掉:块边多而弱,真色阶少而强。
- **没有格子的素材,`--cells` 是正确模式不是兜底。** 见 `prompts.md` §0。
- **信箱边/裁切过的片子**:粗搜假设网格铺满画面。有黑边先裁掉,或直接 `--cells`。
- **真实视频往返没在这台机器上验过** —— 环境里的 ffmpeg 是 Playwright 的裁剪版,
  读不了 PNG。证据是合成损伤(振铃 + 8×8 块带 + 逐帧色漂 + 噪声)两轮,含 17× 噪声那轮。

## 性能

播放是**每帧一次 `drawImage`**:所有帧烤在一张离屏胶片上,一帧就是取其中一条带。
调色板变了才重烤(`bw:palettechange`)。离屏时 `IntersectionObserver` 直接停掉,
`prefers-reduced-motion` 下停在 poster 帧。

⚠️ **但它仍然是逐帧重画 canvas。** 红线禁的是逐帧 `background-color`/`filter`/`backdrop-filter`,
canvas 不在名单上 —— 可是压在 `backdrop-filter` 底下的 canvas 是同一笔开销。
**色块路由(整条没有任何 `backdrop-filter`)比玻璃路由便宜得多**,要放先放那儿。

## 验

```bash
node tests/pxa-format.mjs          # 格式 + 管线,19 条断言,npm test 会自动跑
CHROME=... node tools/pxa/verify-player.mjs a.pxa.json b.pxa.json   # 播放器,要浏览器
```

⭐ **契约里每一条都验证过"植入违规会变红"**,而且重植前先确认基线是绿的 ——
有一轮基线自己红着,九个违规全报 RED,那是九个废数据。
