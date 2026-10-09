/* 起卦 — three coins, six throws, by 增删卜易 占卦法章.
   ────────────────────────────────────────────────────────────────────────
   Each throw is three coins. The number of coins showing the back (背) decides
   the line, and the first throw is the 初爻 (bottom):
     3 backs  重  老阳 — yang, changing       (书: 画作 Ｏ，为变爻)
     2 backs  拆  少阴 — yin, still
     1 back   单  少阳 — yang, still
     0 backs  交  老阴 — yin, changing        (书: 画作 Ｘ，为变爻)
   Randomness comes from the caller. In the product it is the server's
   crypto.getRandomValues, so the client cannot choose the lines.
*/
import { loadEngine } from './engine.js';

export const THROW_NAMES = { 3: '重', 2: '拆', 1: '单', 0: '交' };

/* backs: six numbers 0–3, first throw first. */
export function linesFromBacks(backs) {
  if (!Array.isArray(backs) || backs.length !== 6) throw new Error('casting needs six throws');
  return backs.map((n, i) => {
    if (![0, 1, 2, 3].includes(n)) throw new Error(`throw ${i + 1}: back count must be 0–3, got ${n}`);
    return {
      pos: i + 1,
      backs: n,
      name: THROW_NAMES[n],
      yang: n === 1 || n === 3,
      changing: n === 0 || n === 3
    };
  });
}

/* Eighteen coin bits → six throws. Each bit is one coin; a coin shows its back
   when the bit is 1. Bits are taken in order: throw 1 is bits 0–2. */
export function backsFromBits(bits) {
  if (bits.length !== 18) throw new Error('casting needs eighteen coin bits');
  const backs = [];
  for (let t = 0; t < 6; t++) {
    backs.push(bits[3 * t] + bits[3 * t + 1] + bits[3 * t + 2]);
  }
  return backs;
}

/* Random bits from a source of bytes (crypto.getRandomValues in the product).
   The low bit of each byte is uniform, so it is one coin each. */
export function bitsFromBytes(bytes) {
  if (bytes.length < 18) throw new Error('need at least eighteen random bytes');
  return Array.from({ length: 18 }, (_, i) => bytes[i] & 1);
}

export function castWithBytes(bytes, date) {
  const backs = backsFromBits(bitsFromBytes(bytes));
  return castWithBacks(backs, date);
}

/* The casting, with the board the engine computes for it. */
export function castWithBacks(backs, date) {
  const lines = linesFromBacks(backs);
  const engine = loadEngine();
  const board = engine.computeBoard({
    lines: lines.map((l) => ({ yang: l.yang, changing: false })),
    changeIdx: lines.filter((l) => l.changing).map((l) => l.pos - 1),
    date
  });
  return {
    backs: Array.from(backs),
    lines,
    moving: lines.filter((l) => l.changing).map((l) => l.pos),
    date: date.toISOString(),
    board
  };
}

export function castRandom(date, getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)) {
  const bytes = getRandomValues(new Uint8Array(18));
  return castWithBytes(bytes, date);
}
