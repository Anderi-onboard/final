/* 生成古籍断法库。
 *
 *   node tools/kb/build.mjs           核对原文,生成文本 skill、Obsidian 库、jsonl
 *   node tools/kb/build.mjs --check   只核对、只比较,不写文件;生成物和数据不一致就退出码 1
 *
 * 数据在 functions/_lib/doctrine/kb/data/,生成物见 tools/kb/kb.mjs 开头。
 */
import { buildAll, OUT } from './kb.mjs';
import path from 'node:path';

const check = process.argv.includes('--check');
const { errors, stats, diffs } = buildAll({ write: !check });

if (errors.length) {
  console.error(`原文核对没过,${errors.length} 处:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

console.log(`核对通过:${stats.units} 条规则、${stats.quotes} 段引文、${stats.segments} 句,原文共 ${stats.chars} 字`);
let stale = 0;
for (const [k, d] of Object.entries(diffs)) {
  const n = d.added.length + d.changed.length + d.removed.length;
  stale += n;
  const where = path.relative(process.cwd(), OUT[k]) || OUT[k];
  if (n) console.log(`${check ? '和数据不一致' : '已更新'} ${where}:新增 ${d.added.length}、改动 ${d.changed.length}、删除 ${d.removed.length}`);
  if (check && n) for (const r of [...d.added, ...d.changed, ...d.removed].slice(0, 10)) console.log('    ' + r);
}
if (check && stale) {
  console.error('生成物过期了:跑一次 node tools/kb/build.mjs');
  process.exit(1);
}
if (!stale) console.log('生成物已是最新');
