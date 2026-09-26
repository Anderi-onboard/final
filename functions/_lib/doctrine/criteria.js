/* 判据求值 · 服务端 only(断法即产品,不进 assets/)
   ────────────────────────────────────────────────────────────────────────
   《增删卜易》那 36 条判据,拿盘的四张 CSV 表去判。

   ⭐⭐⭐ **它不下结论。** 输出是「这几条成立,各自读的是哪一格」,
   **不是**「忌神能克」。这不是偷懒,是量出来的:200 副盘上,
   「能克」和「不能克」**同时成立的有 60 副**(30%)。最常撞的那一对:

       能克.1   「忌神旺相,或遇日月动爻生扶,或临日月者,一也。」
       不能克.1 「忌神休囚不动,动而休囚被日月动爻克者,一也。」

   一副盘上忌神休囚又不动,同时日辰生它 —— 两条都成立。书上这两条是有先后的
   (得了日生就不算休囚不动),**而那个先后在 46 条里没有任何一个字段记着**。
   所以 `judge()` 仍然两边照报,不输出总的真假。

   ⭐ 但补全包给了**裁法**:同一关系命中能与不能时,取条件更具体者并记冲突
   (pack README「三」第 2 条)。那一步是单独的 `resolve()`,只加标记不删条目 ——
   `judge()` 报事实,`resolve()` 按包里的规矩裁,两件事分开,各自能被单独质疑。
   2026-09-23 之前这里写的是「裁决交给模型」,那是没读到包里这一行。

   ⭐⭐ **只许看 CSV,不许碰 relations。** 四张表够不够用,只有在求值器
   除了它什么都看不见的时候才证明得了。伸手去拿 `rel.state[i]` 能少写几行,
   代价是从此没人知道那张表缺什么。

   ⚠️ **三分之一的原子没有主语。** 104 次原子引用里 35 次是裸的:
   「忌神静临空破」写成 `TABOO_STATIC AND (XUN_EMPTY OR MONTH_BREAK)`,
   后两个没有 `TABOO_` 前缀,主语只活在 `机器值.主体` 字段里。
   **只读表达式不读主体的求值器,会在 46/200 副盘上给出相反的结论,而且不报错**
   —— 实测:裸原子当成「盘上随便哪一爻」时,冲突从 60 副涨到 106 副。

   ⚠️⚠️ **判据是逐爻的,不是整盘的 —— 这里错过一次,值得记下来。**
   第一版对主体的几行取「任一」:「任一动爻旺相」AND「任一变爻旺相」。
   于是一副盘上第 5 爻旺而化旺、第 6 爻休而化休,**进神.1(动旺相而化旺相)和
   进神.2(动休囚而化休囚)同时成立** —— 两个条件落在了不同的爻上,
   而《增删卜易》说的是**一爻**动而化进。
   现在:**主体的爻一次绑一个,整条表达式跑一遍**,输出里带 `爻`,
   说的是「第 5 爻是进神.1」而不是「这盘有进神.1」。
   ⭐ 这同时把量词那个没写的字段消掉了:逐爻判,就没有「任一还是全部」可选。
      引用别的角色时仍是「任一」(「有没有一个忌神在动」),那本来就是任一。

   ⚠️⚠️ **上面那个例子本身是错的,而逐爻那一关没拦住它。** 第 5 爻申化申、第 6 爻
   戌化戌,原地没动,根本不是进神 —— 进神.1、.2 的表达式漏了「化进神」这个条件
   (依赖事实里明明写着),只比动变旺衰。400 副盘实测:292 次成立,
   那一爻真是化进神的 12 次。2026-09-23 在包里补上了(见 pack README)。
   **逐爻判保证了「说的是哪一爻」,保证不了「那一爻真是那回事」** —— 后者要看表达式本身。
*/

/* ── CSV → 行对象 ──────────────────────────────────────────────────── */
function parse(csv) {
  var rows = String(csv || '').trim().split('\n').map(function (r) { return r.split(','); });
  if (!rows.length || !rows[0].length) return [];
  var h = rows[0];
  return rows.slice(1).map(function (r) {
    var o = {};
    h.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  });
}

/* 「算不出来」。不是 false —— 把它当成 false,「忌神衰而又绝」永远不成立,
   而拿到的是一个看起来完全正常的相反结论。 */
var MISS = { miss: true };

var STRONG = { '旺': 1, '相': 1 };
var WEAK = { '休': 1, '囚': 1, '死': 1 };

/* 角色前缀 → CSV 的 `角色` 列。`MOVING_LINE`/`TRANSFORMED_LINE` 不是角色,
   是按状态选行,所以在下面单独处理。
   ⚠️ `WORLD` 不是角色,读的是 `世应` 列。三墓那五条原文说的是「只验世爻入墓有三」,
      包里原来写成用神,2026-09-23 按原文改回世爻(见 pack README「落地后改过的」)。 */
var ROLE = { ORIGIN: '原神', TABOO: '忌神', TARGET: '用神', ENEMY: '仇神', WORLD: '世' };
/* `机器值.主体` → 上表里的行选择器。 */
var SUBJECT_ROWS = { '元神': '原神', '忌神': '忌神', '用神': '用神', '世爻': '世' };

/* 后缀 → 一格。`col` 是 CSV 的列名(和 `liuyao-csv.js` 同名,不另起),
   `ok` 判那一格的值。 */
var CELL = {
  STRONG:          { col: '旺衰', ok: function (v) { return !!STRONG[v]; } },
  WEAK:            { col: '旺衰', ok: function (v) { return !!WEAK[v]; } },
  MOVING:          { col: '发动', ok: function (v) { return v === '是'; } },
  STATIC:          { col: '发动', ok: function (v) { return v === '否'; } },
  XUN_EMPTY:       { col: '旬空', ok: function (v) { return v === '是'; } },
  MONTH_BREAK:     { col: '月破', ok: function (v) { return v === '是'; } },
  IN_DAY_TOMB:     { col: '日墓', ok: function (v) { return v === '是'; } },
  IN_MOVING_TOMB:  { col: '动墓', ok: function (v) { return v !== '否' && v !== ''; } },
  IN_ANY_TOMB:     { col: '入墓', ok: function (v) { return v === '是'; } },
  TRANSFORMS_TOMB: { col: '动化入墓', ok: function (v) { return v === '是'; } },
  TRANSFORM_EMPTY: { col: '动化空', ok: function (v) { return v === '是'; } }
};
/* 变爻那几种,读的是同一列(`化出关系`),只是找不同的词。 */
var TRANS_KIND = {
  ADVANCE_SPIRIT: '化进神', RETREAT_SPIRIT: '化退神',
  RETURN_GENERATION: '回头生', RETURN_CONTROL: '回头克',
  TRANSFORM_ABSOLUTE: '化绝', TRANSFORM_BREAK: '化破'
};

/* 今天算不出来的原子,连同原因。**留着而不是删掉** —— 一个没有条目的原子
   和一个算不出来的原子,在求值器里长得一模一样,而它们该被区别对待:
   前者是漏了,后者是仓库里没有那份数据。 */
var BLOCKED = {
  AT_ABSOLUTE:              { 名: '临绝', 因: '需长生十二宫，本仓库无此表' },
  ORIGIN_AT_DAY_GROWTH:     { 名: '元神临日辰长生', 因: '需长生十二宫，本仓库无此表' },
  ORIGIN_AT_DAY_PROSPERITY: { 名: '元神临日辰帝旺', 因: '需长生十二宫，本仓库无此表' },
  TABOO_AT_DAY_GROWTH:      { 名: '忌神临日辰长生', 因: '需长生十二宫，本仓库无此表' },
  TABOO_AT_DAY_PROSPERITY:  { 名: '忌神临日辰帝旺', 因: '需长生十二宫，本仓库无此表' },
  TARGET_WEAK_OR_ABSOLUTE:  { 名: '用神衰或绝', 因: '含临绝，需长生十二宫' },
  TARGET_OVERSTRONG:        { 名: '太旺', 因: '旺衰仅休囚旺死相五档，无此级' },
  TRANSFORM_SCATTER:        { 名: '化散', 因: '原文与化绝化克化破并列，未给判法' },
  NEAR_TERM:                { 名: '近事', 因: '属问题，不属卦盘，须由 M1 提供' },
  WORLD_FOLLOWS_GHOST_INTO_DAY_TOMB:
    { 名: '世爻随鬼入日墓', 因: '原文未给「随鬼」的判法' },
  WORLD_FOLLOWS_GHOST_INTO_MOVING_TOMB:
    { 名: '世爻随鬼入动墓', 因: '原文未给「随鬼」的判法' }
};

/* ── 求值器 ────────────────────────────────────────────────────────── */
/* `self` 是当前绑着的那一爻(主体的一行)。主体自己的格只看它;
   引用别的角色时仍然看那个角色的全部行 —— 「有没有一个忌神在动」本来就是任一。 */
function makeAtom(tables, cite, self, subject) {
  var L = parse(tables.lines), E = parse(tables.edges), C = parse(tables.clock);
  var SUBJ_CN = SUBJECT_ROWS[subject] || null;
  var all = function (cn) {
    if (cn === '世') return L.filter(function (r) { return r['世应'] === '世'; });
    return L.filter(function (r) { return r['角色'] === cn; });
  };
  var rowsOf = function (cn) {
    /* 主体自己的那一族:只有绑着的那一爻。这一行就是「逐爻判」的全部。 */
    if (self && cn === SUBJ_CN) return [self];
    return all(cn);
  };
  var moving = function () {
    if (self && subject === '动爻') return [self];
    return L.filter(function (r) { return r['发动'] === '是'; });
  };
  var transRows = function () {
    if (self && subject === '动爻') return self['化出'] ? [self] : [];
    return L.filter(function (r) { return r['化出']; });
  };

  /* 读一格并记下来。`引用` 是这套东西唯一值钱的产出 —— 不是「成立」,
     是「凭第 3 爻的月破那一格成立」。 */
  function cell(atom, row, col) {
    var v = row[col];
    cite({ 表: 'lines', 行: Number(row['爻']), 列: col, 值: v, 原子: atom });
    return v;
  }
  function anyRow(atom, rows, col, ok) {
    if (!rows.length) return false;
    var hit = false;
    rows.forEach(function (r) { if (ok(cell(atom, r, col))) hit = true; });
    return hit;
  }
  function anyKind(atom, rows, kind) {
    if (!rows.length) return false;
    var hit = false;
    rows.forEach(function (r) {
      var v = cell(atom, r, '化出关系');
      if (String(v || '').indexOf(kind) >= 0) hit = true;
    });
    return hit;
  }
  /* 钟表:一爻对日辰/月建的一条关系。行是 clock 表的,不是 lines 的。 */
  function anyClock(atom, rows, obj, kind) {
    var hit = false;
    rows.forEach(function (r) {
      C.forEach(function (c) {
        if (c['爻'] !== r['爻']) return;
        if (String(c['对象'] || '').indexOf(obj) !== 0) return;
        if (c['关系'] !== kind) return;
        cite({ 表: 'clock', 行: Number(c['爻']), 列: '关系', 值: c['对象'] + c['关系'], 原子: atom });
        hit = true;
      });
    });
    return hit;
  }
  /* 边:谁生谁、谁克谁,而且要「成立」(动爻能生克静爻,静爻不能)。 */
  function anyEdgeTo(atom, rows, kind) {
    var hit = false;
    rows.forEach(function (r) {
      E.forEach(function (e) {
        if (e['到'] !== r['爻'] || e['关系'] !== kind || e['成立'] !== '是') return;
        cite({ 表: 'edges', 行: Number(e['从']), 列: '关系',
               值: '第' + e['从'] + '爻' + kind + '第' + e['到'] + '爻', 原子: atom });
        hit = true;
      });
    });
    return hit;
  }

  return function atom(name, subject) {
    if (BLOCKED[name]) return MISS;

    /* ① 带角色前缀的 */
    for (var p in ROLE) {
      if (name.indexOf(p + '_') !== 0) continue;
      var rows = rowsOf(ROLE[p]), s = name.slice(p.length + 1);
      if (!rows.length) return false;
      if (CELL[s]) return anyRow(name, rows, CELL[s].col, CELL[s].ok);
      if (TRANS_KIND[s]) return anyKind(name, rows, TRANS_KIND[s]);
      if (s === 'CONTROLLED') return anyEdgeTo(name, rows, '克');
      if (s === 'AT_DAY') return anyClock(name, rows, '日辰', '临');
      if (s === 'AT_MONTH') return anyClock(name, rows, '月建', '临');
      if (s === 'COMBINED') {
        var hit = false;
        rows.forEach(function (r) {
          E.forEach(function (e) {
            if (e['关系'] !== '合' || e['冲开'] !== '否') return;
            if (e['从'] !== r['爻'] && e['到'] !== r['爻']) return;
            cite({ 表: 'edges', 行: Number(r['爻']), 列: '合',
                   值: '第' + e['从'] + '爻合第' + e['到'] + '爻', 原子: name });
            hit = true;
          });
        });
        return hit;
      }
      if (s === 'MOVING_AND_TRANSFORMS_TOMB') {
        return anyRow(name, rows.filter(function (r) {
          return cell(name, r, '发动') === '是';
        }), '动化入墓', function (v) { return v === '是'; });
      }
      return MISS;
    }

    /* ② 名字里自带主语、但前缀不在上表的(日辰生元神 这种) */
    var GEN = {
      DAY_GENERATES_ORIGIN:   ['原神', 'clock', '日辰', '受生'],
      MONTH_GENERATES_ORIGIN: ['原神', 'clock', '月建', '受生'],
      DAY_GENERATES_TABOO:    ['忌神', 'clock', '日辰', '受生'],
      MONTH_GENERATES_TABOO:  ['忌神', 'clock', '月建', '受生'],
      MOVING_LINE_GENERATES_ORIGIN: ['原神', 'edge', '生'],
      MOVING_LINE_GENERATES_TABOO:  ['忌神', 'edge', '生']
    };
    if (GEN[name]) {
      var g = GEN[name], rs = rowsOf(g[0]);
      if (!rs.length) return false;
      return g[1] === 'clock' ? anyClock(name, rs, g[2], g[3]) : anyEdgeTo(name, rs, g[2]);
    }
    if (name === 'ENEMY_MOVING') {
      return anyRow(name, rowsOf('仇神'), '发动', function (v) { return v === '是'; });
    }

    /* ③ 按状态选行的(动爻 / 变爻),主语就是那一批爻自己 */
    switch (name) {
      case 'MOVING_LINE_STRONG':
        return anyRow(name, moving(), '旺衰', CELL.STRONG.ok);
      case 'MOVING_LINE_WEAK':
        return anyRow(name, moving(), '旺衰', CELL.WEAK.ok);
      case 'MOVING_LINE_SUPPORTED':
        return anyEdgeTo(name, moving(), '生');
      case 'TRANSFORMED_LINE_STRONG':
        return anyRow(name, transRows(), '化出旺衰', CELL.STRONG.ok);
      case 'TRANSFORMED_LINE_WEAK':
        return anyRow(name, transRows(), '化出旺衰', CELL.WEAK.ok);
      case 'BOTH_LINES_STRONG': {
        var both = false;
        transRows().forEach(function (r) {
          var a = cell(name, r, '旺衰'), b = cell(name, r, '化出旺衰');
          if (STRONG[a] && STRONG[b]) both = true;
        });
        return both;
      }
      case 'MOVING_OR_TRANSFORMED_XUN_EMPTY': {
        var e1 = false;
        moving().forEach(function (r) {
          if (cell(name, r, '旬空') === '是' || cell(name, r, '动化空') === '是') e1 = true;
        });
        return e1;
      }
      case 'MOVING_OR_TRANSFORMED_BREAK': {
        var e2 = false;
        moving().forEach(function (r) {
          if (cell(name, r, '月破') === '是') e2 = true;
          if (String(cell(name, r, '化出关系') || '').indexOf('化破') >= 0) e2 = true;
        });
        return e2;
      }
      /* 破墓是**这一爻自己的**墓被冲破。原来读的是整张表(任一爻破墓就算),
         于是三墓.破墓 在主体一爻都没入墓时照样成立。绑了主体就只看主体那一爻。 */
      case 'TOMB_OPENED_BY_CLASH':
      case 'TOMB_CLASHED_OR_BROKEN_BY_DAY_MONTH_OR_MOVING_LINE':
        return anyRow(name, self ? [self] : L, '破墓', function (v) { return v !== '否' && v !== ''; });
      default: break;
    }

    /* ④ 裸原子 —— 主语来自 `机器值.主体`。这一段是本文件最要紧的十行。 */
    if (SUBJ_CN) {
      var sr = rowsOf(SUBJ_CN);
      if (!sr.length) return false;
      if (CELL[name]) return anyRow(name, sr, CELL[name].col, CELL[name].ok);
      if (TRANS_KIND[name]) return anyKind(name, sr, TRANS_KIND[name]);
    }
    /* 主体是「动爻」时,裸的变爻词条指的是这一爻自己化出来的东西 */
    if (subject === '动爻' && TRANS_KIND[name]) {
      return anyKind(name, transRows(), TRANS_KIND[name]);
    }
    return MISS;
  };
}

/* 主体 → 这副盘上哪几爻是候选。判据逐个候选跑一遍。 */
function candidates(tables, subject) {
  var L = parse(tables.lines);
  if (subject === '动爻') return L.filter(function (r) { return r['发动'] === '是'; });
  if (subject === '世爻') return L.filter(function (r) { return r['世应'] === '世'; });
  var cn = SUBJECT_ROWS[subject];
  if (cn) return L.filter(function (r) { return r['角色'] === cn; });
  return [null];        // 没有主体的,整盘判一次
}

/* 表达式:AND / OR / XOR / 括号。没有 NOT —— 36 条里一个都没有。
   MISS 会向上传染:一个原子算不出来,整条判据就是「算不出来」,不是「不成立」。

   ⭐ 同时算出**条件数**:成立的那条路上,最具体的一组用了几个条件。
      AND 相加,OR 取成立的那几支里最大的,XOR 取成立的那一支。
      补全包的规矩是「同一关系命中能与不能时,取条件更具体者并记冲突」
      (pack README「三」第 2 条),`resolve()` 就拿这个数去比。 */
function run(expr, atom, subject) {
  var toks = String(expr).replace(/([()])/g, ' $1 ').split(/\s+/).filter(Boolean);
  var i = 0, missing = [];
  function primary() {
    if (toks[i] === '(') { i++; var v = walk(); i++; return v; }
    var name = toks[i++], v2 = atom(name, subject);
    if (v2 === MISS) {
      if (missing.indexOf(name) < 0) missing.push(name);
      return { v: MISS, n: 0 };
    }
    return { v: !!v2, n: v2 ? 1 : 0 };
  }
  function walk() {
    var acc = primary();
    while (i < toks.length && toks[i] !== ')') {
      var op = toks[i++], rhs = primary(), a = acc, b = rhs;
      if (a.v === MISS || b.v === MISS) acc = { v: MISS, n: 0 };
      else if (op === 'AND') acc = { v: a.v && b.v, n: a.v && b.v ? a.n + b.n : 0 };
      else if (op === 'OR') acc = { v: a.v || b.v, n: Math.max(a.v ? a.n : 0, b.v ? b.n : 0) };
      else if (op === 'XOR') acc = { v: a.v !== b.v, n: a.v !== b.v ? (a.v ? a.n : b.n) : 0 };
      else acc = { v: MISS, n: 0 };
    }
    return acc;
  }
  var out = walk();
  return { value: out.v === MISS ? null : out.v, conditions: out.v === true ? out.n : 0, missing: missing };
}

/* ── 对外 ──────────────────────────────────────────────────────────── */
/* `rules` 由调用方给(node 侧从 pack 的 jsonl 读,服务端注入同一份)。
   ⚠️ 不在这里 `fs.readFileSync` —— Pages Functions 里没有 fs,
      而一个在本地跑得通、上线才炸的模块,比没有这个模块更糟。 */
export function judge(rules, tables) {
  return rules.map(function (r) {
    var m = r.机器值 || {};
    var cands = candidates(tables, m.主体);
    var 爻 = [], 引用 = [], missing = [], fired = false, anyMiss = false, 条件数 = {};
    cands.forEach(function (self) {
      var cells = [];
      var atom = makeAtom(tables, function (c) { cells.push(c); }, self, m.主体);
      var res = run(m.规则表达式, atom, m.主体);
      if (res.value === null) {
        anyMiss = true;
        res.missing.forEach(function (a) { if (missing.indexOf(a) < 0) missing.push(a); });
        return;
      }
      if (!res.value) return;
      fired = true;
      条件数[self ? Number(self['爻']) : 0] = res.conditions;
      if (self) 爻.push(Number(self['爻']));
      /* 只留成立的那一爻读过的格。不成立的爻读过什么,不是证据。 */
      cells.forEach(function (c) { 引用.push(c); });
    });
    /* ⚠️ 算不出来只在**一爻都没成立**时才是结论。有一爻成立,那一爻就是成立的 ——
       另一爻缺个原子不改变这件事。 */
    var 成立 = fired ? true : (anyMiss ? null : false);
    return {
      id: r.id,
      主体: m.主体 || '',
      判: m.判 || '',
      原文: r.原文,
      表达式: m.规则表达式,
      成立: 成立,                             // true / false / null(算不出来)
      爻: 爻,
      缺: 成立 === null ? missing.map(function (a) {
        var b = BLOCKED[a] || { 名: a, 因: '求值器无此原子条目' };
        return { 原子: a, 名: b.名, 为什么: b.因 };
      }) : [],
      引用: 引用,
      条件数: 条件数                          // 爻 → 成立那条路上用了几个条件
    };
  });
}

/* ── 能与不能同时成立时,程序先裁 ─────────────────────────────────────
   补全包的规矩(pack README「三」第 2 条、SOP 文件第三步末尾):
   **同一关系命中「能」与「不能」时,取条件更具体者,并记冲突。**

   「同一关系」按**同一主体、同一爻**算 —— 判据是逐爻判的,第 2 爻的能生和
   第 4 爻的不能生不是一回事。「更具体」按条件数比(见 `run()`)。
   一样多就不裁,原样交给解谜的人,并写明是打平。

   ⚠️ 这是「更具体」的**一种读法**,不是书上的原话。书只说取更具体的,
      没说怎么数。换读法只改这一个函数。

   输出只加标记、不删条目:输掉的那条仍在,带着 `被裁` —— 「记冲突」的意思
   就是冲突本身也是材料。 */
export function resolve(verdicts) {
  var on = verdicts.filter(function (v) { return v.成立 === true; });
  /* 调两次不许记两遍。 */
  on.forEach(function (v) { delete v.被裁; });
  var fights = [];
  var seen = {};
  on.forEach(function (v) {
    if (!/^能/.test(v.判)) return;
    var pos = v.判, neg = '不' + v.判;
    v.爻.forEach(function (n) {
      var key = v.主体 + '|' + pos + '|' + n;
      if (seen[key]) return;
      seen[key] = true;
      var yes = on.filter(function (x) { return x.主体 === v.主体 && x.判 === pos && x.爻.indexOf(n) >= 0; });
      var no = on.filter(function (x) { return x.主体 === v.主体 && x.判 === neg && x.爻.indexOf(n) >= 0; });
      if (!no.length) return;
      var best = function (list) {
        return Math.max.apply(null, list.map(function (x) { return x.条件数[n] || 0; }));
      };
      var a = best(yes), b = best(no);
      var win = a > b ? yes : (b > a ? no : null);
      var lose = a > b ? no : (b > a ? yes : null);
      var sides = {}; sides[pos] = a; sides[neg] = b;
      fights.push({
        主体: v.主体, 爻: n, 判: [pos, neg],
        条件: sides,                     // 两边各自最具体的那条用了几个条件
        胜: win ? (win === yes ? pos : neg) : null,
        胜者: win ? win.map(function (x) { return x.id; }) : [],
        败者: lose ? lose.map(function (x) { return x.id; }) : [],
        条件数: yes.concat(no).reduce(function (o, x) { o[x.id] = x.条件数[n] || 0; return o; }, {})
      });
      if (lose) lose.forEach(function (x) {
        (x.被裁 = x.被裁 || []).push({ 爻: n, 输给: win.map(function (w) { return w.id; }) });
      });
    });
  });
  return fights;
}

/* 一条判据读过的格,按爻归拢成几行字:「第3爻 发动否，旬空否，月破是」「日辰子受生」。
   `only` 给了就只留跟这几爻有关的 —— 一条判据在第 2、4 爻都成立时,
   只讲第 2 爻的那一处不该带上第 4 爻的格。
   ⚠️ 一爻一行,不是一格一行 —— 同一爻的三格分三行写,读的人要自己把它们拼回去,
   而拼回去是这段文字本来就该做完的事。`format()` 和线索用的是同一个函数,
   不许各写一份(本仓库为「两张名单」付过的学费见 CLAUDE.md §7.5)。 */
export function basis(v, only) {
  var keep = function (c) {
    if (!only) return true;
    if (c.表 === 'edges') return only.some(function (n) { return String(c.值).indexOf('第' + n + '爻') >= 0; });
    return only.indexOf(c.行) >= 0;
  };
  var byLine = {}, order = [];
  v.引用.forEach(function (c) {
    if (!keep(c)) return;
    var k = c.表 === 'lines' ? '第' + c.行 + '爻' : '';
    if (!byLine[k]) { byLine[k] = []; order.push(k); }
    var s = c.表 === 'lines' ? c.列 + c.值 : c.值;
    if (byLine[k].indexOf(s) < 0) byLine[k].push(s);
  });
  return order.map(function (k) { return (k ? k + ' ' : '') + byLine[k].join('，'); });
}

/* 给模型看的文本。**只列成立的,和算不出来的** ——
   「不成立」有 20 多条,全列进去是拿噪声换全面。
   ⚠️ 算不出来的必须列,而且要说为什么:一条沉默的判据和一条不成立的判据,
      在模型眼里长得一模一样,而它们该被区别对待。 */
export function format(verdicts, fights) {
  var on = verdicts.filter(function (v) { return v.成立 === true; });
  var na = verdicts.filter(function (v) { return v.成立 === null; });
  var out = [];
  out.push('成立 ' + on.length + ' 条。它们并列，此处不分轻重：');
  out.push(fights && fights.length
    ? '其中同一爻上能与不能同时成立 ' + fights.length + ' 处，按补全包的规矩取条件更具体的一条，见文末。'
    : '同一主体上，能与不能可以同时成立。');
  on.forEach(function (v) {
    out.push('');
    out.push(v.主体 + v.判 + (v.爻.length ? '，第' + v.爻.join('、') + '爻' : ''));
    out.push('  ' + v.原文);
    basis(v).forEach(function (s) { out.push('  依据 ' + s); });
    out.push('  ' + v.id);
  });
  if (na.length) {
    out.push('');
    out.push('判不了 ' + na.length + ' 条。缺的是数据，不是结论；判不了不等于不成立。');
    na.forEach(function (v) {
      /* 同一条里两个原子常共用一个原因(长生和帝旺都要长生十二宫)。
         按原因归拢,不然同一句话印两遍。 */
      var byWhy = {}, order = [];
      v.缺.forEach(function (x) {
        if (!byWhy[x.为什么]) { byWhy[x.为什么] = []; order.push(x.为什么); }
        if (byWhy[x.为什么].indexOf(x.名) < 0) byWhy[x.为什么].push(x.名);
      });
      out.push('  ' + v.id + '  缺' + order.map(function (w) {
        return byWhy[w].join('、') + '：' + w;
      }).join('；'));
    });
  }
  if (fights && fights.length) {
    out.push('');
    out.push('能与不能同时成立 ' + fights.length + ' 处：');
    fights.forEach(function (f) {
      out.push('  ' + f.主体 + ' 第' + f.爻 + '爻：' + f.判[0] + ' ' + f.条件[f.判[0]] + ' 个条件，'
        + f.判[1] + ' ' + f.条件[f.判[1]] + ' 个条件，'
        + (f.胜 ? '取' + f.胜 : '打平，不裁'));
    });
  }
  return out.join('\n');
}

export const _internal = { parse, BLOCKED, ROLE, CELL, TRANS_KIND };
