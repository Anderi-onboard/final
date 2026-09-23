/* 本地调试台 · 盘面那一半 —— 在 node 里跑浏览器侧的引擎。
   ────────────────────────────────────────────────────────────────────────
   这些文件(liuyao-engine / relations / verdict / features / ai)是浏览器 IIFE,
   往 `window` 上挂东西。node 里没有 window,所以用 vm 建一个沙箱把它们装进去 ——
   **装的是仓库里那几个真文件,不是抄一份**。抄一份会在下一次改引擎时悄悄失效,
   而调试台报出来的数字看起来照样正常。

   ⚠️ **投掷要能钉住。** 调提示词时盘一变,你就分不清"这次答得不一样"是因为
      提示词改了还是因为卦不同了。`--seed` 给同一副盘,`--seed random` 才真摇。
*/
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { judge, resolve } from "../../functions/_lib/doctrine/criteria.js";
import { timing } from "../../functions/_lib/doctrine/timing.js";
import { loadCriteria, loadTiming } from "../../functions/_lib/doctrine/criteria-rules.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/* 仓库自己那套确定性随机(mountain-range.js 的 `mulberry32`)。
   一个种子一副盘,和色组排序、笔触抖动同一条规矩。 */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cached = null;
export function engine() {
  if (cached) return cached;
  const win = { console, Math, Date, JSON };
  win.window = win;
  vm.createContext(win);
  win.globalThis = win;
  for (const f of ["liuyao-engine.js", "liuyao-verdict.js", "liuyao-relations.js",
                   "liuyao-features.js", "liuyao-csv.js", "liuyao-ai.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), win, { filename: f });
  }
  cached = win;
  return win;
}

/* 扫盘用的日期:第 s 副盘落在基准日之后第 s 天(正午 UTC,避开跨日)。
   ⚠️⚠️ **不给日期,两百副盘全是同一天** —— 日辰、旬空、月建全一样,
      于是「冲空则实」这类只在某些日子才可能的格,在有的日子里一副盘都亮不了,
      契约就跟着日历红一天绿一天(2026-09-23 board-csv 就是这么红的)。
      一天一副,两百副盘走过三轮多六十甲子,覆盖不再看今天是哪天。 */
export function spreadDate(seed) {
  return new Date(Date.UTC(2026, 0, 1, 12) + (Number(seed) || 0) * 86400000);
}

/* 三枚硬币摇六次。6 老阴 · 7 少阳 · 8 少阴 · 9 老阳 —— 6 和 9 是动爻。 */
export function toss(seed) {
  const rnd = seed === "random" ? Math.random : mulberry32(Number(seed) || 1);
  const raw = [0, 0, 0, 0, 0, 0].map(() =>
    [0, 0, 0].reduce((a) => a + (rnd() < 0.5 ? 2 : 3), 0));
  return {
    raw,
    lines: raw.map((v) => ({ yang: v === 7 || v === 9 })),
    changeIdx: raw.map((v, i) => (v === 6 || v === 9 ? i : -1)).filter((i) => i >= 0)
  };
}

/* 一次投掷 → 四节点要的全部材料。
   ⚠️ 这里**不调模型**。用神那一步需要 M1 的 `db`,所以它是入参:
      调试台先跑 M1 拿到 db,再回来调这个函数。顺序就是管线的顺序。 */
export function material({ seed = 1, db = "", gender = "", spec = null, date = null } = {}) {
  const win = engine();
  const s = spec || toss(seed);
  const board = win.BWLiuYao.computeBoard({
    lines: s.lines, changeIdx: s.changeIdx, method: "sortis",
    /* 不给就是今天 —— 真起卦就是这样。扫很多副盘的契约要给,见 `spreadDate`。 */
    ...(date ? { date } : {}),
    /* 卦名由 casting-figure.js 的 BWFigure 供给,引擎自己不起名
       (`input.name || null`)。调试台不画图,所以按上下卦自己查一下。 */
    name: null, transformedName: null
  });
  const AI = win.BWLiuYaoAI;
  const subject = AI.subjectKey("", { db, gender });
  const roles = AI.deriveRoles(board, subject.key);
  const F = win.BWFeatures.of(board, roles, subject);
  const rel = win.BWRelations.compute(board);
  const csv = win.BWCsv.tables(board, rel, roles, subject);
  const criteria = judge(loadCriteria(), csv);
  /* 能与不能同一爻上打架时,按补全包的规矩取条件更具体的一条。
     只加标记不删条目 —— `criteria` 里输掉的那条带着 `被裁` 留着。 */
  const fights = resolve(criteria);
  return {
    spec: s,
    board,
    subject,
    roles,
    /* ⚠️ 这里原来也叫 `relations`,和下面那个**同名**,被后者整个覆盖 ——
       对象字面量里重复的键,后写的赢,而且一声不响。
       读 `material()` 的人看见 `relations: rel` 会以为拿得到关系引擎的对象,
       实际拿到的是一段格式化文本,取 `.state[0]` 直接抛。改名 `rel`。 */
    rel,
    /* 四张 CSV 表。判据引擎吃的是这个,不是 features ——
       features 是有损投影(6 爻 × 20 格 → 一串扁平的 id),
       而判据要的是「第 3 爻的月破 = 是」,那个爻号在 id 里没有。 */
    csv,
    /* 判据求值。⚠️ **它只拿到 `csv`,拿不到 `board`/`rel`** —— 四张表够不够用,
       只有在求值器除了它什么都看不见的时候才证明得了。 */
    criteria,
    fights,
    /* 应期。⚠️ 它拿的是**盘**,不是四张表 —— 判据算的是「某一格等于什么」,
       应期算的是地支之间的关系(本支的冲是哪个支),那不是一个格。
       硬塞进文本表再解析回来,只多一层能出错的解析。 */
    timing: timing(loadTiming(), board, roles, win.BWLiuYao.BRANCH),
    features: F.features || [],
    featureWhy: F.why || {},
    ladder: win.BWVerdict.format(win.BWVerdict.judge(board, roles, subject)),
    relations: formatRelations(AI.relationLines(board, roles, subject)),
    boardText: AI.boardText(board, roles, subject)
  };
}

/* 和 prompt-router.js 的 `formatRelations` 同一条规则。
   ⚠️ 这是**第二份**,而两份要同步 —— 本仓库为「两张名单」付过三次学费。
      它存在的唯一理由是 prompt-router 是浏览器 IIFE、没有导出这个函数;
      要是哪天它导出了,这里就该删掉改成 import。 */
function formatRelations(rel) {
  if (!rel || typeof rel !== "object") return "";
  if (rel.error) return String(rel.error);
  const out = [];
  for (const k of Object.keys(rel)) {
    const v = rel[k];
    if (v == null || (Array.isArray(v) && !v.length) || v === "") continue;
    if (Array.isArray(v)) {
      out.push(k + ":");
      v.forEach((x) => out.push("  " + (typeof x === "string" ? x : JSON.stringify(x))));
    } else {
      out.push(k + ":" + (typeof v === "string" ? v : JSON.stringify(v)));
    }
  }
  return out.join("\n");
}

/* 仓库自己量过的比率(functions/_lib/db.js):CJK 1.064 / 拉丁 0.287 tok/字符。
   本地模型的分词器不一样,所以这个数只用来**比大小**,不当账单。 */
export function tok(s) {
  const str = String(s || "");
  const cjk = (str.match(/[一-鿿　-〿＀-￯]/g) || []).length;
  return Math.round(cjk * 1.064 + (str.length - cjk) * 0.287);
}
