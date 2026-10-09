/**
 * CASTING CONTRACT — 起卦 by 增删卜易 占卦法章
 *
 * The coin rule is the book's: back count → line. The exhaustive checks run over
 * all 2^18 coin patterns, so nothing rests on a sample. The book's own example
 * (单 拆 重 交 重 拆 → 水火既济, with 三、四、五爻动) is checked end to end.
 * Run: node test/casting.mjs
 */
import assert from 'node:assert/strict';
import { castWithBacks, castWithBytes, castRandom, linesFromBacks, backsFromBits, bitsFromBytes } from '../src/casting.js';
import { buildPacket } from '../src/packet.js';

const DATE = new Date(2026, 9, 8, 10, 0);

// 1. The mapping, exactly as the book states it.
{
  const [a, b, c, d] = linesFromBacks([1, 2, 3, 0, 0, 0]);
  assert.deepEqual([a.name, a.yang, a.changing], ['单', true, false], '一背 单 = 少阳, still');
  assert.deepEqual([b.name, b.yang, b.changing], ['拆', false, false], '两背 拆 = 少阴, still');
  assert.deepEqual([c.name, c.yang, c.changing], ['重', true, true], '三背 重 = 老阳, moving');
  assert.deepEqual([d.name, d.yang, d.changing], ['交', false, true], '三字 交 = 老阴, moving');
}

// 2. Every coin pattern is counted once: 18 coins, each a 1-bit, 2^18 patterns.
//    For one throw, back counts 0,1,2,3 occur in the ratio 1:3:3:1.
{
  const tally = [0, 0, 0, 0];
  for (let v = 0; v < 1 << 18; v++) {
    const bits = Array.from({ length: 18 }, (_, i) => (v >> i) & 1);
    tally[backsFromBits(bits)[0]]++;
  }
  assert.deepEqual(tally, [1 << 15, 3 << 15, 3 << 15, 1 << 15], 'first throw: 1:3:3:1 over all patterns');
}

// 3. The bytes → coins step takes the low bit of each byte.
{
  const bytes = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(bitsFromBytes(bytes), Array.from(bytes, (b) => b & 1));
  assert.throws(() => bitsFromBytes(new Uint8Array(17)), /eighteen/);
}

// 4. The book's own example, end to end: 单 拆 重 交 重 拆 → 水火既济, moving 3,4,5.
{
  const c = castWithBacks([1, 2, 3, 0, 3, 2], DATE);
  assert.deepEqual(c.moving, [3, 4, 5]);
  const p = buildPacket(c.board, {});
  assert.equal(p.ben.name, '水火既济', 'the book names this casting 水火既济');
  assert.equal(p.bian.name, '震为雷', '3,4,5 moving: 变卦 by the engine and the packet agree');
}

// 5. Same bytes, same lines. Injected source, so the product path is testable.
{
  const bytes = Uint8Array.from({ length: 18 }, (_, i) => (i * 37) & 255);
  assert.deepEqual(castWithBytes(bytes, DATE).backs, castWithBytes(bytes, DATE).backs);
  const stub = (buf) => { buf.set(bytes.subarray(0, buf.length)); return buf; };
  assert.deepEqual(castRandom(DATE, stub).backs, castWithBytes(bytes, DATE).backs);
}

// 6. Bad input is refused, not repaired.
assert.throws(() => linesFromBacks([0, 1, 2, 3, 4, 0]), /0–3/);
assert.throws(() => linesFromBacks([0, 1, 2]), /six throws/);

console.log('casting: ok — 1:3:3:1 over 2^18 patterns; 占卦法 mapping; 单拆重交重拆 → 水火既济 (三四五动)');
