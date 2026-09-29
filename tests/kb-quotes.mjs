/* 古籍断法库:原文必须逐字出自它标的那本书的那一章;生成物必须和数据一致。
 *
 * 这个库给人看、也给模型用,最坏的失败不是报错,是一句「原文」其实是记忆里的
 * 版本、或者是另一本书的字句,而页面上看不出来。本仓库写过这条:我曾把一条
 * 规则当作原文提出来,翻遍材料发现它根本不存在。所以核对交给程序,不交给小心。
 *
 * 这里做四件事:
 *   1. 跑一遍真实数据,一处错误都不许有。
 *   2. 把六种错误逐一植进一份数据副本,每一种都必须被抓到 —— 一个从没红过的检查,
 *      绿色说明不了任何事。
 *   3. 生成物(文本 skill、Obsidian 库、jsonl)和数据一致,手改生成物或忘了重跑都会红。
 *   4. 生成物进得了 git:没有哪一个会被 .gitignore 挡住。第 3 条量的是磁盘,而磁盘上的文件
 *      不等于推得上去的文件 —— 输出目录曾叫 dist/,被一条 .gitignore 吞掉,本机全绿、CI 上红。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, OUT, loadConfig, loadData, verify, buildAll } from '../tools/kb/kb.mjs';

const cfg = loadConfig();
const { units } = loadData();

/* ---- 1. 真实数据 ---- */
const real = verify(structuredClone(units), cfg);
assert.deepEqual(real.errors, [], '原文核对没过:\n  ' + real.errors.join('\n  '));
/* 防空转:数据目录读空了(改了路径、正则失配),核对会以全绿的样子失效 */
assert.ok(real.stats.units >= 28, `只读到 ${real.stats.units} 条规则,数据目录可能读错了`);
assert.ok(real.stats.segments >= 300, `只核对了 ${real.stats.segments} 句`);

/* ---- 2. 植入错误,每一种都必须被抓到 ---- */
const pick = () => structuredClone(units.find((u) => u.id === 'LY.WEALTH.HJC.02'));
const plants = [
  ['原文改一个字', (u) => { u.quotes[0].zh[0] = u.quotes[0].zh[0].replace('称意', '如意'); }, /找不到/],
  ['原文少一个标点', (u) => { u.quotes[1].zh[0] = u.quotes[1].zh[0].replace('，', ''); }, /找不到/],
  ['引错了书', (u) => { u.quotes[2].book = '易隐'; }, /不在《易隐》里/],
  ['句子在书里、但不在这一章', (u) => { u.quotes[0].range = [1, 100]; }, /不在这一章的范围/],
  ['三栏对不齐', (u) => { u.quotes[1].en.pop(); }, /对不齐/],
  ['英文漏了术语', (u) => { u.quotes[1].en[0] = u.quotes[1].en[0].replace('Wealth', 'money'); }, /应出现「Wealth」/],
  ['英文栏里混进汉字', (u) => { u.quotes[2].en[1] += '财'; }, /里有汉字/],
  ['译文照抄原文', (u) => { u.quotes[1].yi[0] = u.quotes[1].zh[0]; }, /没有翻译/],
  ['两段连起来在书里不连续', (u) => { u.quotes[1].zh.reverse(); u.quotes[1].yi.reverse(); u.quotes[1].en.reverse(); }, /连起来不连续/],
  ['说话人不在表里', (u) => { u.quotes[1].by = '某某'; }, /不在 sources.json 的 speakers/]
];
for (const [name, mutate, want] of plants) {
  const u = pick();
  mutate(u);
  const { errors } = verify([u], cfg);
  assert.ok(errors.some((e) => want.test(e)), `植入「${name}」没有被抓到。报出来的是:\n  ${errors.join('\n  ') || '(什么都没报)'}`);
}

/* ---- 3. 生成物和数据一致 ---- */
const { errors, diffs } = buildAll({ write: false });
assert.deepEqual(errors, []);
const stale = Object.entries(diffs).flatMap(([k, d]) => [...d.added, ...d.changed, ...d.removed].map((r) => `${k}: ${r}`));
assert.deepEqual(stale, [], '生成物和数据不一致,跑 node tools/kb/build.mjs:\n  ' + stale.slice(0, 20).join('\n  '));

/* ---- 4. 生成物进得了 git ---- */
// 2026-09-29 出过:输出目录叫 dist,.gitignore 有一条 dist/,rules.jsonl 在本机在、推上去就没了。
// 上一节看的是磁盘,磁盘上有;CI 是干净检出,没有。所以这里不看磁盘,直接问 git 会不会挡住它们。
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const outFiles = [OUT.skill, OUT.vault, OUT.jsonl].flatMap(walk).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
assert.ok(outFiles.length >= 100, `只列到 ${outFiles.length} 个生成物,输出目录可能读错了`);
const ask = (paths) => spawnSync('git', ['check-ignore', '--no-index', '--stdin', '-z'], {
  cwd: ROOT, input: paths.join('\0') + '\0', encoding: 'utf8', maxBuffer: 1 << 26
});
const ignoredIn = (r) => r.stdout.split('\0').filter(Boolean);
const probe = ask(['.dev.vars']); // 密钥文件,.gitignore 第一条就是它:问不出它被挡,就说明这道检查没在工作
let asked = false;
if (probe.error || probe.status === 128) {
  assert.ok(!process.env.CI, 'CI 上问不了 git,「生成物进得了 git」这一条不能跳过:\n  ' + (probe.error?.message || probe.stderr));
  console.log('(这里问不了 git,跳过「生成物进得了 git」)');
} else {
  assert.deepEqual(ignoredIn(probe), ['.dev.vars'], 'git check-ignore 没认出 .dev.vars,这道检查是空转的');
  const blocked = ignoredIn(ask(outFiles));
  assert.deepEqual(blocked, [], `这些生成物会被 .gitignore 挡住,推上去就缺了(CI 上契约会红):\n  ${blocked.slice(0, 10).join('\n  ')}`);
  asked = true;
}

console.log(`古籍断法库 OK — ${real.stats.units} 条、${real.stats.quotes} 段引文、${real.stats.segments} 句逐字核对通过,${plants.length} 种植入错误全部抓到,生成物是最新的${asked ? `、${outFiles.length} 个都进得了 git` : ''}`);
