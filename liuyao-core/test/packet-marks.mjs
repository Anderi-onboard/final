/**
 * PER-LINE MARKS CONTRACT — what each 爻位 is, in every rule that names it
 * Example: 水火既济, 三四五动, 用神 = 妻财 (absent here, so no 用神 line).
 * Run: node test/packet-marks.mjs
 */
import assert from 'node:assert/strict';
import { castWithBacks } from '../src/casting.js';
import { buildPacket } from '../src/packet.js';

const DATE = new Date(2026, 9, 8, 10, 0);
const p = buildPacket(castWithBacks([1, 2, 3, 0, 3, 2], DATE).board, {});
const L = (pos) => p.lines[pos - 1];

// 世应 (世应章): 水火既济 is 三世, so 世 is line 3 and 应 is line 6.
assert.equal(L(3).world, true);
assert.equal(L(6).ying, true);
assert.equal(L(1).world, false);

// 刑 (三刑章): 子卯 and 丑戌 pairs. Each partner once, never doubled.
assert.deepEqual(L(1).xingWith, [6], '卯 is punished by 子 (line 6)');
assert.deepEqual(L(2).xingWith, [5], '丑 with 戌 (line 5)');

// 合 (六合章): 卯戌 (1 with 5), 丑子 (2 with 6).
assert.deepEqual(L(1).heWith, [5]);
assert.deepEqual(L(2).heWith, [6]);
assert.deepEqual(L(1).chongWith, [], 'no line clashes with another here');

// 三合 (三合章): 申子辰 水局 includes lines 4 (申), 6 (子), and the 变 of 3 (辰) and 5 (申).
assert.deepEqual(L(6).sanheGroups, ['水局']);
assert.deepEqual(L(4).sanheGroups, ['水局']);

// 神煞 (星煞章): day 乙卯 → 太乙贵人 子·申 (lines 6, 4); 禄神 卯 (line 1).
assert.deepEqual(L(4).shensha, ['太乙贵人']);
assert.deepEqual(L(6).shensha, ['太乙贵人']);
assert.deepEqual(L(1).shensha, ['禄神']);

// 用神 role is empty when no 用神 was asked for.
assert.equal(L(1).yongRole, null);

// With a 用神 of 官鬼 (水 palace: 官鬼 is 土, on lines 2 and 5). 忌神 controls 土
// (木, line 1); 元神 generates 土 (火: none on this board); 仇神 controls 元神
// (水, lines 3 and 6).
const q = buildPacket(castWithBacks([1, 2, 3, 0, 3, 2], DATE).board, { yongKey: 'officer' });
const role = (pos) => q.lines[pos - 1].yongRole;
assert.equal(q.yong.liangXian, true, 'two 官鬼 lines: 用神两现');
assert.equal(role(2), '用神');
assert.equal(role(5), '用神');
assert.equal(role(1), '忌神');
assert.equal(role(3), '仇神');
assert.equal(role(6), '仇神');
assert.equal(role(4), null, '申 is neither 用神 nor any helper of it');

console.log('packet-marks: ok — 世应, 刑, 合, 冲, 三合, 神煞, 用神角色 per line');
