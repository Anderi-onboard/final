/* liuyao-csv.js — 把一副盘摊成四张 CSV 表。
   ────────────────────────────────────────────────────────────────────────
   为什么是四张而不是一张:**爻是点,互动是边,它们的行数不一样。**
   六爻是 6 行,而爻与爻之间的关系是 C(6,2) 量级、还带方向和「成不成立」。
   把边塞进 6 行的点表里,丢掉的正好是判据要读的那两样。

   | 表 | 一行是什么 | 行数 |
   |---|---|---|
   | `lines` | 一爻 | 恒 6 |
   | `edges` | 一条爻与爻之间的关系 | 十几条 |
   | `clock` | 一爻对日辰/月建/太岁/时辰的一条关系 | 几十条 |
   | `board` | 整副盘 | 恒 1 |

   ⭐ **取法是查地址,不是搜相似。** 「忌神入三墓」读的是 lines 表第 N 行的
      日墓/月墓/动墓/动化入墓四格;「贪生忘克」读的是 edges 表里同一个 from
      的两条边。判据的「依赖列」写的就是这里的列名,没有第二套名字。

   ⚠️⚠️ **三态,不是两态。** 每一格是 `是` / `否` / `?`。
      `?` 是「引擎算不出来」——比如「临绝」要长生十二宫,而这个仓库里没有那张表。
      **把 `?` 当成 `否`,「忌神衰而又绝」永远不会亮,而你拿到的是一个
      看起来完全正常的相反结论。** 这是这套东西里最容易悄悄错的一处,
      所以它在格式层面就分开,不靠下游记得。

   ⚠️ 列名只在这里定义一次。判据表引用的是这些名字 —— 两边各写一份
      就是本仓库付过四次学费的那张「第二名单」。
*/
(function () {
  /* 三态。null/undefined → `?`;其余按真假。
     字符串值(比如 动墓 = "第6爻戌")当成「是」并把它自己带出去 —— 它既是
     真假也是出处,拆成两列只会让判据要读两格。

     ⚠️⚠️ **`?` 只许表示「引擎算不出来」,绝不许表示「不适用」。**
        第一版把 `独发` 交给它:动爻数 ≠ 1 时 shape.独发 是 null,于是 CSV 里
        写成 `?` —— 判据读到的是「不知道是不是独发」,而事实是「这卦不是独发」。
        **两种意思撞在同一个符号上,三态就白分了。**
        修在**源头**:`liuyao-relations.js` 里不适用的格写 `false` 不写 `null`。
        在这一层加一张「哪些列不算三态」的名单也能修好,但那是第二名单。 */
  function tri(v) {
    if (v === null || v === undefined) return '?';
    if (v === true) return '是';
    if (v === false) return '否';
    if (Array.isArray(v)) return v.length ? v.join('/') : '否';
    return String(v);
  }
  /* ⚠️ 不适用的格由 `liuyao-relations.js` 在源头写成 `false`,不写 `null` ——
     所以这里不需要第二套「哪些列不是三态」的名单。那张名单本身就是
     本仓库付过四次学费的那种「第二名单」:relations 加一格,它就漏一格。 */

  function esc(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function rows2csv(header, rows) {
    return [header.join(',')].concat(rows.map(function (r) {
      return header.map(function (h) { return esc(r[h]); }).join(',');
    })).join('\n') + '\n';
  }

  /* ── 表一 · 爻 ────────────────────────────────────────────────────────
     列 = 身份(6) + state 的每一格。**state 有什么这里就有什么** ——
     手抄一份列名,下次 relations 加一格就会静默漏掉。 */
  var LINE_ID = ['爻', '干支', '五行', '六亲', '六神', '世应'];
  var LINE_STATE = ['发动', '旺衰', '旬空', '真空', '假空', '冲空则实',
                    '月破', '真破', '假破', '日破', '暗动',
                    '日墓', '月墓', '动墓', '动化入墓', '入墓', '破墓',
                    '动化空', '月制动爻', '月制变爻', '临绝'];
  var LINE_TRANS = ['化出', '化出关系'];

  function lineTable(board, rel) {
    var header = LINE_ID.concat(LINE_STATE, LINE_TRANS);
    var byLine = {};
    (rel.transforms || []).forEach(function (t) { byLine[t.line] = t; });
    var rows = board.lines.map(function (l, i) {
      var s = rel.state[i], t = byLine[i + 1], r = {};
      r['爻'] = i + 1;
      r['干支'] = l.stem.cn + l.branch.cn;
      r['五行'] = l.element.cn;
      r['六亲'] = l.relative.cn;
      r['六神'] = l.spirit ? l.spirit.cn : '';
      r['世应'] = s['世爻'] ? '世' : (s['应爻'] ? '应' : '');
      LINE_STATE.forEach(function (k) { r[k] = k === '旺衰' ? s[k] : tri(s[k]); });
      r['化出'] = t ? t.to : '';
      r['化出关系'] = t ? (t.kinds.join('/') || '') : '';
      return r;
    });
    return rows2csv(header, rows);
  }

  /* ── 表二 · 边(爻与爻之间)────────────────────────────────────────
     有向的(生/克)和无向的(合冲刑害比和)进同一张表,靠「向」那一列分。
     ⚠️ `成立` 就是《增删卜易》§4 那条:动爻能生克静爻,静爻不能生克动爻。
        它是**事实**不是筛子 —— 不成立的边也照样写进来,由判据决定认不认。 */
  var EDGE_COLS = ['从', '到', '向', '关系', '成立', '动者', '冲开', '从描述', '到描述'];

  function edgeTable(rel) {
    var rows = [];
    (rel.pairs || []).forEach(function (p) {
      p.kinds.forEach(function (k) {
        rows.push({ '从': p.from, '到': p.to, '向': '→', '关系': k,
                    '成立': tri(p.acts), '动者': p.acts ? p.from : '',
                    '冲开': '否', '从描述': p.fromDesc, '到描述': p.toDesc });
      });
    });
    (rel.mutual || []).forEach(function (m) {
      m.kinds.forEach(function (k) {
        rows.push({ '从': m.a, '到': m.b, '向': '↔', '关系': k,
                    '成立': tri(m.acts), '动者': m.mover || '',
                    '冲开': k === '合' ? tri(m['冲开']) : '否',
                    '从描述': m.aDesc, '到描述': m.bDesc });
      });
    });
    return rows2csv(EDGE_COLS, rows);
  }

  /* ── 表三 · 钟(爻对日/月/岁/时)────────────────────────────────── */
  var CLOCK_COLS = ['爻', '对象', '关系'];
  function clockTable(rel) {
    var rows = [];
    (rel.clock || []).forEach(function (c) {
      c.rels.forEach(function (x) {
        rows.push({ '爻': c.line, '对象': x.with, '关系': x.kind });
      });
    });
    return rows2csv(CLOCK_COLS, rows);
  }

  /* ── 表四 · 盘(恒一行)──────────────────────────────────────────── */
  var BOARD_SHAPE = ['动爻数', '独发', '独静', '尽静', '六爻乱动',
                     '六冲卦', '六合卦', '变卦六冲', '变卦六合',
                     '归魂', '游魂', '反吟', '伏吟'];

  function boardTable(board, rel, roles, subject) {
    var meta = board.meta;
    var header = ['卦', '变卦', '月建', '日辰', '太岁', '旬空',
                  '用神', '用神爻', '用神出处']
      .concat(BOARD_SHAPE)
      .concat(['世', '应', '世应关系', '世应冲开', '三合', '三会', '用神多现', '伏神']);
    var r = {};
    /* ⚠️ 卦名由 `casting-figure.js` 的 `BWFigure` 供给,**引擎自己不起名**
       (`input.name || null`)。所以不画图的调用方这两格是 `?` ——
       那是「这次没人给」,不是「没有卦名」,所以用 `?` 不用空。 */
    r['卦'] = (board.ben && board.ben.name && (board.ben.name.cn || board.ben.name)) || '?';
    r['变卦'] = (board.bian && board.bian.name && (board.bian.name.cn || board.bian.name)) || '?';
    r['月建'] = meta.monthBranch ? meta.monthBranch.cn : '?';
    r['日辰'] = meta.dayPillar ? (meta.dayPillar.stem.cn + meta.dayPillar.branch.cn) : '?';
    r['太岁'] = (meta.pillars && meta.pillars.year && meta.pillars.year.branch)
      ? meta.pillars.year.branch.cn : '?';
    r['旬空'] = (meta.xunkong || []).map(function (x) { return x.cn; }).join('');
    /* 用神写六亲的中文名,不写内部 key —— `wealth` 是程序侧的地址,
       而这张表是给读的人和模型看的。 */
    var yongLines = ((roles && roles.yongLines) || []);
    r['用神'] = yongLines.length && board.lines[yongLines[0]]
      ? board.lines[yongLines[0]].relative.cn
      : (subject && subject.key ? subject.key : '?');
    r['用神爻'] = yongLines.map(function (i) { return i + 1; }).join('/');
    /* ⚠️ 「这是默认还是判定」必须跟着走。一个读不出来的默认和一个判定长得一模一样。 */
    r['用神出处'] = subject ? (subject.matched ? (subject.source || '判定') : '默认') : '?';
    BOARD_SHAPE.forEach(function (k) {
      r[k] = tri(rel.shape ? rel.shape[k] : null);
    });
    r['世'] = rel.worldResp ? rel.worldResp.world : '';
    r['应'] = rel.worldResp ? rel.worldResp.resp : '';
    r['世应关系'] = rel.worldResp ? (rel.worldResp.rels || []).join('/') : '';
    r['世应冲开'] = rel.worldResp ? tri(rel.worldResp['冲开']) : '?';
    r['三合'] = (rel.sanhe || []).map(function (s) {
      return (s.element && (s.element.cn || s.element)) + (s.type === 'full' ? '局' : '半局') + '[' + (s.lines || []).join('') + ']';
    }).join(' ');
    r['三会'] = (rel.sanhui || []).map(function (s) {
      return s.element + (s.type === 'full' ? '局' : '半局') + '[' + (s.lines || []).join('') + ']';
    }).join(' ');
    r['用神多现'] = Object.keys(rel.multi || {}).map(function (k) {
      return k + '[' + rel.multi[k].join('') + ']';
    }).join(' ');
    r['伏神'] = (rel.hidden || []).map(function (h) {
      return (h.relative ? h.relative.cn : '') + (h.hiddenBranch ? h.hiddenBranch.cn : '')
        + '(第' + (h.position + 1) + '爻'
        + (h.flyGeneratesHidden ? '·飞生伏' : '') + (h.flyControlsHidden ? '·飞克伏' : '') + ')';
    }).join(' ');
    return rows2csv(header, [r]);
  }

  /* 一次出四张。`material()` 那一半算完之后调它,不再算任何东西 ——
     这里一个生克都不判,只是把已经算好的摊平。 */
  function tables(board, rel, roles, subject) {
    return {
      lines: lineTable(board, rel),
      edges: edgeTable(rel),
      clock: clockTable(rel),
      board: boardTable(board, rel, roles, subject)
    };
  }

  var api = {
    tables: tables,
    columns: {
      lines: LINE_ID.concat(LINE_STATE, LINE_TRANS),
      edges: EDGE_COLS,
      clock: CLOCK_COLS,
      shape: BOARD_SHAPE
    },
    tri: tri
  };
  if (typeof window !== 'undefined') window.BWCsv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
