/* 卦况包 shape — the format every consumer may rely on.
   ────────────────────────────────────────────────────────────────────────
   A small structural checker, no dependencies. A spec is:
     'string' | 'number' | 'boolean'      a scalar
     { nullable: spec }                    the scalar or null
     [spec]                                an array whose items match spec
     { key: spec, ... }                    an object with exactly these keys
   Extra keys are errors, and so are missing ones. A packet that drifts from
   this shape fails here before any model sees it.
*/

const S = 'string', N = 'number', B = 'boolean';
const nullable = (spec) => ({ nullable: spec });


export const PACKET_SPEC = {
  schema: N,
  time: {
    date: S, day: S, dayStem: N, dayBranch: S, month: S, monthBranch: S, xunkong: [S]
  },
  ben: {
    bits: S, name: S, upper: S, lower: S, palace: S, palaceElement: S, series: S,
    world: N, ying: N
  },
  bian: nullable({
    bits: S, name: S, palace: S, bianVsBen: S
  }),
  moving: [N],
  solo: nullable(S),
  hexFlags: {
    clash: B, combine: B, bianClash: B, bianCombine: B,
    transitions: [S],
    trigramFanYin: nullable({ lower: B, upper: B }),
    fuYin: B
  },
  relations: {
    chong: [{ a: N, b: N, moving: [B] }],
    he: [{ a: N, b: N, type: S }],
    xing: [{ from: nullable(N), to: nullable(N), self: nullable([N]) }],
    sanhe: [{ cn: S, parts: [[{ pos: nullable(N), from: S, moving: B }]] }],
    dayEffects: [{ pos: N, effects: [S] }],
    elements: [{ from: N, to: N, rel: S, moving: [B] }]
  },
  shensha: {
    taiyi: { branches: [S], lines: [N] },
    lu: { branch: S, lines: [N] },
    yima: { branch: S, lines: [N] },
    tianxi: { branch: S, lines: [N] }
  },
  lines: [{
    pos: N, yang: B, moving: B, stem: S, stemIdx: N, branch: S, branchBi: N,
    element: S, elementGi: N, relative: S, spirit: S,
    wangShuai: { cn: S, rank: N },
    monthRank: nullable(S),
    toMonth: S, toDay: S,
    monthBreak: B, monthCombine: B, dayClash: B, dayCombine: B,
    trueVoid: B, void: B,
    voidVerdict: nullable(S), voidNotVoidBy: [S], voidBy: [S],
    dayStage: nullable(S), changeStage: nullable(S),
    tombs: { day: B, moving: B, change: B },
    fuYin: B, fanYin: B,
    hidden: [{
      relative: S, branch: S, el: N, flyBranch: S, flyRelative: S,
      flyGeneratesHidden: B, flyControlsHidden: B, hiddenControlsFly: B
    }],
    heKinds: [S],
    chongKinds: [S],
    transform: nullable({
      stem: S, branch: S, branchBi: N, element: S, relative: S, jinTui: nullable(S),
      backToTomb: B, backToVoid: B, backToSheng: B, backToKe: B, clashBen: B, combineBen: B
    })
  }],
  yong: nullable({
    key: S,
    lines: [N],
    absent: B,
    liangXian: B,
    fallback: nullable({
      day: S, month: S,
      palaceFirst: { palace: S, lines: [{ pos: N, branch: S, relative: S }], yongPos: [N] }
    }),
    yuan: { lines: [N], factors: [{ pos: N, factors: [S] }] },
    ji: { lines: [N] },
    chou: { lines: [N] }
  }),
  tokens: [S]
};

function check(value, spec, path, errors) {
  if (spec === S || spec === N || spec === B) {
    const want = spec === S ? 'string' : spec === N ? 'number' : 'boolean';
    if (typeof value !== want) errors.push(`${path}: expected ${want}, got ${value === null ? 'null' : typeof value}`);
    return;
  }
  if (spec && spec.nullable !== undefined) {
    if (value === null) return;
    return check(value, spec.nullable, path, errors);
  }
  if (Array.isArray(spec)) {
    if (!Array.isArray(value)) { errors.push(`${path}: expected array`); return; }
    value.forEach((item, i) => check(item, spec[0], `${path}[${i}]`, errors));
    return;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path}: expected object`);
    return;
  }
  const keys = Object.keys(spec);
  for (const k of Object.keys(value)) {
    if (!keys.includes(k)) errors.push(`${path}.${k}: unexpected key`);
  }
  for (const k of keys) {
    if (!(k in value)) { errors.push(`${path}.${k}: missing`); continue; }
    check(value[k], spec[k], `${path}.${k}`, errors);
  }
}

/* Returns a list of problems. An empty list means the packet has the shape. */
export function validatePacket(packet) {
  const errors = [];
  check(packet, PACKET_SPEC, 'packet', errors);
  return errors;
}
