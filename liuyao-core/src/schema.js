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

import { checkSpec } from './validate.js';

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
  facts: {
    chain: nullable([N]),
    relations: [{ token: S, kind: S, a: N, b: N, text: S }],
    states: [{ token: S, pos: N, name: S, provisional: B }],
    noYong: B
  },
  candidates: [{
    key: S, basis: S, target: nullable(S), targetKind: S, lines: [N],
    partial: B, source: S, status: S
  }],
  lines: [{
    pos: N, yang: B, moving: B, stem: S, stemIdx: N, branch: S, branchBi: N,
    element: S, elementGi: N, relative: S, spirit: S,
    wangShuai: { cn: S, rank: N },
    monthRank: nullable(S),
    toMonth: S, toDay: S,
    monthBreak: B, monthCombine: B, dayClash: B, dayCombine: B,
    trueVoid: B, void: B,
    voidVerdict: nullable(S),
    voidRules: [{ text: S, cls: S, verdict: S, decisive: B, source: S }],
    changeVerdict: nullable({ relation: S, verdict: nullable(S), regardlessOfYong: B, source: nullable(S), open: nullable(S) }),
    dayStage: nullable(S), changeStage: nullable(S),
    changeToDay: nullable(S), changeToMonth: nullable(S), dayHarmed: B, monthHarmed: B,
    tombs: { day: B, moving: B, change: B },
    fuYin: B, fanYin: B,
    hidden: [{
      relative: S, branch: S, el: N, flyBranch: S, flyRelative: S,
      flyGeneratesHidden: B, flyControlsHidden: B, hiddenControlsFly: B,
      toDay: S, toMonth: S,
      emergence: { verdict: S, rules: [{ text: S, cls: S, verdict: S, decisive: B, source: S }] }
    }],
    heKinds: [S],
    chongKinds: [S],
    world: B, ying: B, yongRole: nullable(S),
    shensha: [S], xingWith: [N], heWith: [N], chongWith: [N], sanheGroups: [S], dayEffects: [S],
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
    ji: { lines: [N], judgement: [{ pos: N, controlsYong: B, moving: B, verdict: S, note: nullable(S), rules: [{ text: S, cls: S, verdict: S, decisive: B, source: S }] }] },
    chou: { lines: [N] }
  }),
  tokens: [S]
};

/* Returns a list of problems. An empty list means the packet has the shape. */
export function validatePacket(packet) {
  return checkSpec(packet, PACKET_SPEC, 'packet');
}
