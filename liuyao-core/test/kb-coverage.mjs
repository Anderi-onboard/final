/**
 * CHAPTER COVERAGE CONTRACT — 增删卜易 章目
 *
 * "一个都不能落下": every chapter heading of the book below must have exactly
 * one row in functions/_lib/kb/coverage.js, and each row's `where` must name
 * fields the packet really has. The list below was copied from the book's own
 * headings (lines ending in 章 in the uploaded text), not written from memory.
 *
 * A chapter marked `model` is not dropped: it is judgment that goes into the
 * knowledge base. The counts printed at the end say how many such rows still
 * wait for that knowledge base.
 *
 * Run: node tests/kb-coverage.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB = resolve(ROOT, 'src');

// The book's chapter headings, in the order they appear in 增删卜易.
const BOOK_CHAPTERS = [
  "八卦章",
  "占卦法章",
  "八宫章",
  "浑天甲子章",
  "六亲歌章",
  "世应章",
  "动变章",
  "用神章",
  "用神、元神、忌神、仇神章",
  "元神、忌神、衰旺章",
  "五行相生章",
  "五行相克章",
  "克处逢生章",
  "动静生克章",
  "动变生克冲合章",
  "四时旺相章",
  "月将章",
  "日辰章",
  "六神章",
  "六合章",
  "三合章",
  "六冲章",
  "三刑章",
  "六害章",
  "暗动章",
  "动散章",
  "卦变生克墓绝章",
  "反伏章",
  "旬空章",
  "生旺墓绝章",
  "各门类题头总注章",
  "各门类应期总注章",
  "归魂游魂章",
  "月破章",
  "飞伏神章",
  "进神退神章",
  "随鬼入墓章",
  "独发章",
  "两现章",
  "星煞章",
  "天时章",
  "身命章",
  "终身财福章",
  "终身功吊有无章",
  "终身功名有无章",
  "寿元章",
  "趋避章",
  "父母寿元章",
  "兄弟章",
  "夫妇章",
  "子嗣章",
  "学业章",
  "治经章",
  "延师章",
  "求吊章",
  "求名章",
  "童试章",
  "岁考科考章",
  "占廪章",
  "发案挂榜章",
  "乡试会试章",
  "升选候补章",
  "升迁何方章",
  "在任吉凶章",
  "投麾效用，入武从军章",
  "署印谋差章",
  "防参劾、虑大计、及已有事尚未结案者章",
  "养亲、告病、辞官章",
  "修陵修河，一切营造公务防患章",
  "僧官、道纪、医官、杂职、阴阳等官章",
  "功吊到何品级章",
  "功名到何品级章",
  "子占父功吊章",
  "子占父功名章",
  "求财章",
  "谒贵求财章",
  "为贵人奔走效力求财章",
  "开行开店及各项铺面章",
  "投行损益章",
  "囤货卖货章",
  "卖货宜守宜动章",
  "往何方买卖章",
  "买何货为吉章",
  "借贷章",
  "放债索债章",
  "买卖六畜章",
  "博戏章",
  "请会摇会章",
  "行险求财章",
  "婚姻章",
  "此婚子嗣有无章",
  "此婚有宜于父母否章",
  "纳宠章",
  "配仆章",
  "取离妇跳娼妇章",
  "胎孕章",
  "产妇安危章",
  "产期章",
  "婴儿否泰章",
  "出行章",
  "舟行章",
  "同舟共行章",
  "行人章",
  "防非避讼章",
  "斗殴争竞章",
  "兴词举讼章",
  "已定重罪章",
  "疾病章",
  "痘疹章",
  "病源章",
  "鬼神章",
  "延医章",
  "医占往治章",
  "家宅章",
  "盖造、买宅、赁宅章",
  "创造宫室章",
  "修方动土章",
  "迁居过火章",
  "归宅入火章",
  "入宅六亲吉凶章",
  "马房猪圈章",
  "旧宅章",
  "同居章",
  "盖造官衙章",
  "衙宇章",
  "盖造寺院章",
  "莹葬章",
  "寻地章",
  "占地形势章",
  "得地于何时章",
  "得地于何方章",
  "占地师章",
  "点穴章",
  "谋地偷葬章",
  "祖莹旧冢章",
  "因何事所伤章",
  "修补秘法章",
  "再占修补吉凶章",
  "新亡附葬祖墓章"
];

const { COVERAGE } = await import(pathToFileURL(resolve(KB, 'coverage.js')).href);
const { buildPacket } = await import(pathToFileURL(resolve(KB, 'packet.js')).href);
const { propertyPaths } = await import(pathToFileURL(resolve(KB, 'render.js')).href);

// 1. Every book chapter has exactly one row, and no row is invented.
const rows = new Map();
for (const [heading, row] of COVERAGE) {
  assert.ok(!rows.has(heading), `duplicate coverage row: ${heading}`);
  rows.set(heading, row);
}
const missing = BOOK_CHAPTERS.filter((h) => !rows.has(h));
assert.deepEqual(missing, [], 'book chapters with no coverage row:\n  ' + missing.join('\n  '));
const extra = [...rows.keys()].filter((h) => !BOOK_CHAPTERS.includes(h));
assert.deepEqual(extra, [], 'coverage rows that are not book chapters:\n  ' + extra.join('\n  '));
assert.equal(BOOK_CHAPTERS.length, new Set(BOOK_CHAPTERS).size, 'the book list itself must not repeat');

// 2. Each status is one the contract knows about, and the notes say why.
const STATUS = new Set(['packet', 'packet+model', 'model', 'casting', 'excluded']);
for (const [h, r] of rows) {
  assert.ok(STATUS.has(r.status), `${h}: unknown status ${r.status}`);
  if (r.status === 'excluded') assert.ok(r.note, `${h}: an excluded chapter must quote the book's reason`);
}

// 3. Every `where` path must exist in some real packet. A path that names a
//    field the packet lacks is a row that claims coverage it does not have.
const samples = [];
const DATE = new Date(2026, 9, 8, 10, 0);
const vmSandbox = { window: {}, console, Date };
vmSandbox.window.window = vmSandbox.window;
vm.createContext(vmSandbox);
vm.runInContext(readFileSync(resolve(ROOT, 'vendor/liuyao-engine.js'), 'utf8'), vmSandbox, { filename: 'vendor/liuyao-engine.js' });
for (let bits = 0; bits < 64; bits++) {
  for (const mv of [[], [bits % 6], [(bits + 1) % 6, (bits + 3) % 6]]) {
    for (const yk of [undefined, 'wealth', 'self']) {
      const lines = [0, 1, 2, 3, 4, 5].map((i) => ({ yang: !!((bits >> i) & 1), changing: false }));
      const b = vmSandbox.window.BWLiuYao.computeBoard({ lines, changeIdx: mv, date: DATE });
      samples.push(buildPacket(b, yk ? { yongKey: yk } : {}));
    }
  }
}
const available = new Set();
for (const p of samples) for (const path of propertyPaths(p)) available.add(path);
const dangling = [];
for (const [h, r] of rows) {
  for (const w of r.where) if (!available.has(w)) dangling.push(`${h}: ${w}`);
}
assert.deepEqual(dangling, [], 'coverage rows name packet fields that do not exist:\n  ' + dangling.join('\n  '));

// 4. The count of rows still waiting for the knowledge base, printed so it is
//    never a silent number.
const count = (s) => [...rows.values()].filter((r) => r.status === s).length;
console.log(
  `kb-coverage: ok — ${BOOK_CHAPTERS.length} chapters · packet ${count('packet')} · ` +
  `packet+model ${count('packet+model')} · model (awaiting knowledge base) ${count('model')} · ` +
  `casting ${count('casting')} · excluded by the book ${count('excluded')}`
);
