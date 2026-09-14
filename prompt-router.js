/* prompt-router.js — Integration layer: declares INTENT to /api/claude and
   drives the reading pipeline. The prompt engine it used to wire in is server
   side now (functions/_lib/prompt-engine.js); see the note at makeRouted.
   Originally: wired the in-browser engine into the existing
   四节点管线的编排:M1 读问题 → M2 选库 → M3 取证 → M4 说话。
   ─────────────────────────────────────────────────────────────────────────────
   Drop-in: include this script AFTER prompt-checks.js and BEFORE chat-app.js.
   It monkey-patches the AI layer to use modular prompts + optional QC pass.

   Configuration (set via BWPromptRouter.configure()):
   - product: "sortis" | "stria" (default: auto-detect from method)
   - enableQC: true | false (default: true for sortis, false for stria)
   - qcModel: model to use for QC pass (default: "claude-haiku-4-5")
   - routerModel: model for question classification (default: "claude-haiku-4-5")
   - mainModel: model for main reading (default: env CLAUDE_MODEL)
   - maxRetries: how many times to retry on QC fail (default: 1)
*/
(function () {
  "use strict";

  var CONFIG = {
    enableQC: null,       // null = auto (true for sortis, false for stria)
    qcModel: null,        // null = use cheapest available (haiku)
    routerModel: null,    // null = use cheapest available (haiku)
    mainModel: null,      // null = use default from env
    maxRetries: 1
  };

  function configure(opts) {
    if (!opts) return;
    for (var k in opts) {
      if (CONFIG.hasOwnProperty(k)) CONFIG[k] = opts[k];
    }
  }

  // ─── Claude call wrapper ──────────────────────────────────────
  // meta declares INTENT to the proxy: { role, product, model? }. The backend
  // picks the model from that (Sonnet for stria, Opus for sortis, Haiku for
  // router/qc) so model choice lives server-side. An explicit allow-listed
  // model still wins, for back-compat.
  /* The fields the server needs to BUILD the prompt. It assembles from intent
     now, so anything not forwarded here is simply missing on the other side —
     and missing degrades silently (an intent call with no question still gets a
     well-formed prompt, just an empty one). `system` is deliberately absent:
     /api/claude rejects a client-supplied one outright. */
  /* ⚠️ `board` / `features` / `ladder` / `relations` / `m1` / `m2` / `m3` 是四节点
     管线要的。在此之前盘**只作为 JSON 文本混在 user 消息里**到服务端,于是服务端
     手里没有结构化的盘 —— 断法匹配没地方跑:不能在浏览器跑(断法就是产品),
     服务端又拿不到盘。加这几个字段是接线的第一步。
     发出去的 `features` 只是状态名(XUN_EMPTY 这种),不是断法,所以这条界线没挪。 */
  var INTENT_FIELDS = ["question", "mode", "reading", "methodLabel",
                       "lastQuestion", "lastReading", "max_tokens",
                       "board", "features", "ladder", "relations", "m1", "m2", "m3"];
  function carryIntent(payload, input) {
    if (!input || typeof input !== "object") return payload;
    for (var i = 0; i < INTENT_FIELDS.length; i++) {
      var k = INTENT_FIELDS[i];
      if (input[k] != null) payload[k] = input[k];
    }
    return payload;
  }

  function makeComplete(meta) {
    meta = meta || {};
    return function (input) {
      var payload;
      if (typeof input === "string") {
        payload = { messages: [{ role: "user", content: input }] };
      } else {
        payload = carryIntent({ messages: input.messages }, input);
      }
      if (meta.role) payload.role = meta.role;
      if (meta.product) payload.product = meta.product;
      if (meta.model) payload.model = meta.model;
      if (meta.mode) payload.mode = meta.mode; // "followup" → metered billing
      if (meta.temperature != null) payload.temperature = meta.temperature;

      return fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // required so the session cookie reaches the proxy — without this,
        // the server-side session lookup in functions/api/claude.js always
        // sees "signed out", and Sortis billing/gating silently fails open.
        credentials: "same-origin",
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) {
            var err = new Error((d && d.error) || ("claude proxy " + r.status));
            err.status = r.status; err.code = d && d.error;
            throw err;
          }
          return d;
        });
      }).then(function (d) {
        if (d && typeof d.text === "string") {
          if (typeof d.unitsRemaining === "number" && window.BWAccount && window.BWAccount.reconcileUnits) {
            window.BWAccount.reconcileUnits({ ok: true, units: d.unitsRemaining });
          }
          /* ⚠️⚠️ 危机硬停是 200 + `crisis:true`,不是错误码 —— 所以它长得和一段
             正常回答一模一样。**不认它就等于吞掉它**:四节点里 M1 先跑,
             它答回来的会是求助信息,而管线会拿这段文字当「lang=…db=…」去解析,
             解析出一个空结构,然后**若无其事地继续往下跑 M2/M3/M4**。
             抛出来,让 interpretWithRouter 顶上那一层直接把它当解读返回。 */
          if (d.crisis) {
            var stop = new Error("crisis");
            stop.crisis = true; stop.text = d.text;
            throw stop;
          }
          return d.text;
        }
        throw new Error("bad response");
      });
    };
  }

  // ─── Streaming call wrapper (main reading only) ────────────────
  // Same intent/billing contract as makeComplete, but asks the proxy for an
  // SSE passthrough of Anthropic's own stream and invokes onDelta(text) as
  // tokens arrive, instead of waiting for the whole completion. Falls back
  // cleanly if the browser lacks streaming fetch (ReadableStream) — caller
  // checks canStream() and uses makeComplete() instead when it's false.
  function canStream() {
    return typeof fetch === "function" && typeof ReadableStream !== "undefined" &&
      typeof TextDecoder !== "undefined";
  }

  // One typed envelope for every turn. Policy stays in the system prompt;
  // user intent, continuity, and board facts stay in explicitly labelled data
  // blocks. This is the seam deeper experience features can extend later
  // (saved context, evidence inspection, user-controlled depth) without
  // splicing more prose into the core prompt.
  /* ⚠️ `buildExperienceEnvelope()` 跟着老链路一起删了(2026-09-14,owner 定)。
     它把 TURN_CONTEXT + CASTING_EVIDENCE 包成一段 user 消息,交给服务端那套
     95k 字符的装配去读 —— **那就是老链路的入口**。四节点里没有这个包裹:
     每一站要什么就发什么(features / ladder / relations / board / 上一站的输出),
     而 user 那一轮由 `fill.js` 的 `userOverride` 写成一句话。
     包裹本身不是无害的:它让「这一站要什么」变成了「把所有东西都给它」。 */

  /* A post-generation check must never be able to destroy the reading it is
     checking. These run AFTER the text has streamed to the reader and AFTER
     pumpAndSettle has billed for it, and their verdicts are telemetry — the
     comment further down says so in as many words: a miss is "surfaced as
     telemetry, never acted on". A bare call broke that: prompt-checks.js
     referenced thirteen constants it never declared, so checkReadability()
     threw ReferenceError on every reading, the throw fell into routedReading's
     catch, and a finished, paid-for reading was replaced by a note about the
     reader's balance.

     Declaring the constants fixed that instance. This fixes the shape: any
     future fault in a checker degrades its own verdict and nothing else. */
  function safeCheck(label, fn) {
    if (typeof fn !== "function") return { ok: true, issues: [] };
    try {
      var out = fn();
      return (out && typeof out.ok === "boolean") ? out
        : { ok: true, issues: [label + " returned no verdict"] };
    } catch (e) {
      if (window.console && console.warn) console.warn("[BourneWise] " + label + " threw", e);
      return { ok: true, issues: [label + " threw: " + ((e && e.message) || e)] };
    }
  }

  function makeStreamComplete(meta) {
    meta = meta || {};
    return function (input, onDelta) {
      var payload = carryIntent({ messages: input.messages, stream: true }, input);
      if (meta.role) payload.role = meta.role;
      if (meta.product) payload.product = meta.product;
      if (meta.model) payload.model = meta.model;
      if (meta.mode) payload.mode = meta.mode; // "followup" → metered billing
      if (meta.temperature != null) payload.temperature = meta.temperature;

      return fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok || !r.body) {
          return r.json().catch(function () { return {}; }).then(function (d) {
            var err = new Error((d && d.error) || ("claude proxy " + r.status));
            err.status = r.status; err.code = d && d.error;
            throw err;
          });
        }
        /* Not every answer is a stream. The crisis route returns the helpline
           text as JSON 200 — no model call, no charge — and a JSON body is both
           `ok` and non-null, so it fell straight through to the SSE reader
           below. That reader finds no `data:` records, resolves with "", and
           "" becomes "empty reading from pipeline" upstream, which renders as
           the generic mid-stream failure. Measured against production: someone
           asking 我不想活了 was shown a note about their balance instead of the
           numbers. Read the content type before assuming a stream. */
        var ctype = String(r.headers.get("content-type") || "");
        if (ctype.indexOf("application/json") === 0) {
          return r.json().then(function (d) {
            var direct = d && (d.text || d.reading || "");
            if (!direct) {
              var e = new Error("empty non-stream response");
              e.status = r.status; e.code = d && d.route;
              throw e;
            }
            // Hand it to the caller the same way streamed text arrives, so the
            // reading renders through one path instead of two.
            if (onDelta) onDelta(direct, direct);
            return direct;
          });
        }

        var reader = r.body.getReader();
        var decoder = new TextDecoder();
        var buf = "";
        var fullText = "";

        function handleEvent(block) {
          // block is one raw SSE record: possibly "event: X\ndata: Y"
          var eventName = null, dataLine = null;
          block.split("\n").forEach(function (line) {
            if (line.indexOf("event:") === 0) eventName = line.slice(6).trim();
            else if (line.indexOf("data:") === 0) dataLine = line.slice(5).trim();
          });
          if (!dataLine) return;
          var data;
          try { data = JSON.parse(dataLine); } catch (e) { return; }

          if (eventName === "bw_meta") {
            if (typeof data.unitsRemaining === "number" && window.BWAccount && window.BWAccount.reconcileUnits) {
              window.BWAccount.reconcileUnits({ ok: true, units: data.unitsRemaining });
            }
            // actual units charged this call (metered settle) — the UI shows it
            if (typeof data.charged === "number") { try { window.__bwLastCharged = data.charged; } catch (e) {} }
            // the backend settled a reading that didn't finish cleanly (charged
            // only what was delivered) — let the UI tell the user
            if (data.incomplete) { try { window.__bwReadingIncomplete = true; } catch (e) {} }
            return;
          }
          // Anthropic's own stream events (no custom "event:" line — those
          // arrive as bare "data: {...}" records with a "type" field).
          if (data.type === "content_block_delta" && data.delta && data.delta.type === "text_delta") {
            fullText += data.delta.text;
            if (onDelta) onDelta(data.delta.text, fullText);
          }
        }

        /* A CUT STREAM IS NOT A FAILED READING. When the connection dies
           part-way, the text that already arrived is on the reader's screen and
           has already been PAID FOR — the server settles metered usage in
           pumpAndSettle whatever happens to the socket. Rejecting here threw
           that away and replaced it with "your units are back where they were",
           which was both a loss and a lie about their balance. Resolve with
           what we have, flag it incomplete, and let the reading stand. */
        function pump() {
          return reader.read().then(function (res) {
            if (res.done) {
              if (buf.trim()) handleEvent(buf);
              return fullText;
            }
            buf += decoder.decode(res.value, { stream: true });
            var records = buf.split("\n\n");
            buf = records.pop(); // last chunk may be incomplete — keep it buffered
            records.forEach(function (rec) { if (rec.trim()) handleEvent(rec); });
            return pump();
          }, function (readErr) {
            if (buf.trim()) { try { handleEvent(buf); } catch (e) {} }
            if (fullText) {
              try { window.__bwReadingIncomplete = true; } catch (e) {}
              return fullText;                 // keep the part that arrived
            }
            throw readErr;                     // nothing arrived — a real failure
          });
        }
        return pump();
      });
    };
  }

  // ─── Main pipeline ────────────────────────────────────────────
  /* ── 四节点管线 ─────────────────────────────────────────────────────────
     在这之前是**一次调用**:一个模型同时做分类、取用神、检索、推理、写作。
     现在拆成四站,理由写在 functions/_lib/nodes/prompts.js 的头注里 ——
     一句话是「专模专事」,而「写句子」本身就是一件事,只归 M4。

       M1  读问题     → lang / db / ask / hurt / flags
       ↓   db 定用神(见 BWLiuYaoAI.subjectKey),用神定 roles,roles 定 features
       M2  选库       → lib=…(两级 RAG 的第一级)
       M3  取证       → 程/法/实/推 四层材料(第二级只在 M2 开的库里排)
       M4  说话       → 解读本身,流式

     ⚠️ **一站失败不静默。** 失败的那一站返回空串,它的槽在服务端填成
        「(上一站没交材料)」——M4 因此说的是缺了东西,而不是假装有。
        本仓库最贵的失败一直是同一个形状:降级了,却看起来在正常工作。 */
  function runNode(role, product, input, notes) {
    return makeComplete({ role: role, product: product })(input).then(function (t) {
      return String(t || "").trim();
    }, function (e) {
      /* ⚠️ 危机不是「这一站失败了」,它是**答案本身**。吞进 notes 里
         会让管线接着跑完 M2/M3/M4,然后把一篇解读盖在求助信息上面。 */
      if (e && e.crisis) throw e;
      var why = (e && e.message) || String(e);
      notes.push(role + " 失败:" + why);
      if (window.console) console.warn("[prompt-router] node " + role + " failed:", why);
      return "";
    });
  }

  /* M1 的 `db=` 那一行。宽松解析:小模型偶尔多个空格、换个冒号,
     为此整站退回正则猜领域不值得。服务端 fill.js 的 parseM1 是同一条规则。 */
  function m1Db(text) {
    var m = String(text || "").match(/^\s*db\s*[=:]\s*(.+)$/mi);
    return m ? m[1].trim() : "";
  }

  /* `relationLines()` 返回的是「类别 → 若干行」的表(它本来是给 distill() 压进
     board JSON 的)。M3/M4 要的是能读的文本,所以在这里摊平 ——
     ⚠️ 摊的是**这个表的形状**,不是重算关系。关系只有一个算的地方。 */
  function formatRelations(rel) {
    if (!rel || typeof rel !== "object") return "";
    if (rel.error) return String(rel.error);
    var out = [];
    for (var k in rel) {
      if (!rel.hasOwnProperty(k)) continue;
      var v = rel[k];
      if (v == null || (Array.isArray(v) && !v.length) || v === "") continue;
      if (Array.isArray(v)) {
        out.push(k + ":");
        v.forEach(function (x) { out.push("  " + (typeof x === "string" ? x : JSON.stringify(x))); });
      } else {
        out.push(k + ":" + (typeof v === "string" ? v : JSON.stringify(v)));
      }
    }
    return out.join("\n");
  }

  function interpretWithRouter(opts) {
    opts = opts || {};
    var question = opts.question || "";
    var product = opts.product || (opts.method === "stria" ? "stria" : "sortis");
    var mode = opts.mode === "followup" ? "followup" : null; // metered follow-up on an existing casting
    var temperature = (typeof opts.temperature === "number") ? opts.temperature : null; // recasts run hot
    var board = opts.board;
    // BourneWise is English-only; the explicit field remains for the board
    // formatter so it never inherits a language from user input.
    var lang = opts.lang;

    /* The prompt engine now lives in functions/_lib/ — every segment in it is a
       trade secret, and while it was in the browser the assembled system prompt
       was also POSTed up for the API to run verbatim, so any account could send
       its own. The browser declares intent; the server gates, routes, assembles
       and returns the reading. What is left here is the post-generation
       validation, which is pure code and holds no instructions. */
    var PC = window.BWPromptChecks || {};

    var mainComplete = makeComplete({ product: product, model: CONFIG.mainModel, mode: mode, temperature: temperature });

    // Step 1+2 (gate + route) happen server-side now; this resolves immediately
    // and keeps the rest of the pipeline's shape unchanged.
    return Promise.resolve({ route: "server", turnMode: mode || "initial" }).then(function (result) {
      // Crisis or minor-blocked: return safety response directly
      if (result.route === "crisis") {
        return {
          source: "router",
          route: "crisis",
          reading: "I need to pause here. If you're in crisis or thinking about harming yourself or others, please reach out now:\n\n• US/Canada: 988\n• UK/Ireland: 116 123 (Samaritans)\n• Australia: Lifeline 13 11 14\n• EU: 112\n• Anywhere: findahelpline.com\n\nYou matter. A real person can help right now.",
          verdict: "crisis"
        };
      }
      if (result.route === "minor_blocked") {
        return {
          source: "router",
          route: "minor_blocked",
          reading: "I don't do romance or intimate readings for minors. If you have a different question — career direction, study, family, health outlook — I'm here for that.",
          verdict: "blocked"
        };
      }

      /* ── 第一站 M1 ──────────────────────────────────────────────────────
         M1 必须跑在摆角色之前,因为**用神由它的 `db=` 决定**。
         在这之前用神是一条正则从问题里猜领域猜出来的 —— 而猜领域正是 M1 存在的
         全部理由,留两套分类器只会分歧,且分歧的那一次没人看得见:
         `subjectKey` 的默认是世爻,**一个读不出来的默认和一个判定长得一样**。
         实测缺口:「我和她还有可能吗」—— 婚恋那两条要「我女朋友|我老婆|…」,
         「她」一个字都不在名单上,于是退回世爻,而整篇解读照样写得出来。

         ⚠️⚠️ **没有退路,这是故意的(owner 2026-09-14 定:「老的作废封存」)。**
         上一版写成「跑不起来就退回原来的单次调用」,而那句话的实际意思是
         **老链路还在跑,只是看不出来什么时候在跑** —— 本仓库最贵的那种失败
         (降级了却像在正常工作)正是这个形状,而这次是我自己写进去的。
         少任何一块就当场抛,理由写在错误里。 */
      var missing = [];
      if (!board) missing.push("盘");
      if (!window.BWFeatures) missing.push("liuyao-features.js");
      if (!window.BWVerdict) missing.push("liuyao-verdict.js");
      if (!window.BWRelations) missing.push("liuyao-relations.js");
      if (!(window.BWLiuYaoAI && window.BWLiuYaoAI.boardText)) missing.push("liuyao-ai.js");
      if (missing.length) {
        return Promise.reject(new Error("四节点管线缺件,无法起卦:" + missing.join("、")));
      }
      var notes = [];
      var m1Call = runNode("m1", product,
        { question: question, messages: [{ role: "user", content: question }] }, notes);

      return m1Call.then(function (m1Text) {
      var AI = window.BWLiuYaoAI;
      var node = { features: [], ladder: "", relations: "", board: "", m2: "", m3: "" };
      try {
        /* 用神:M1 答了领域就听 M1 的,它没答出来才读措辞 —— 见
           BWLiuYaoAI.subjectKey 里那段。`source` 报的就是这一次走了哪条。
           ⚠️ `opts.category` 那条旁路也删了:chat-app 曾经对每一卦都传
           "general",于是 CATEGORY_YONGSHEN["general"] 把每一篇解读都锚在世爻上。
           它现在既然由 M1 定,就**不许再有第二个入口能覆盖它**。 */
        var subject = AI.subjectKey(question, { db: m1Db(m1Text), gender: opts.gender });
        /* `board._roles ||` used to sit in front of this call. Nothing in the
           repo ever writes that property — but it is a read that would
           silently override the assignment above with roles derived from
           some other anchor, and defeating a fix by preferring a stale cache
           is the exact shape of the defect this line was written to repair.
           A cache with no writer is not an optimisation, it is a trapdoor. */
        var roles = AI.deriveRoles(board, subject.key || "self");

        /* 四样程序算出来的东西,喂给 M2/M3/M4。都是**这一盘的事实**,不是断法 ——
           断法在服务端,浏览器一个字都拿不到。这条界线和 prompt-engine.js
           08-14 搬进 _lib 是同一条。 */
        var F = window.BWFeatures.of(board, roles, subject);
        node.features = (F && F.features || [])
          .concat(window.BWFeatures.fromM1Flags(
            (String(m1Text).match(/^\s*flags\s*[=:].*$/mi) || [""])[0]));
        node.ladder = window.BWVerdict.format(window.BWVerdict.judge(board, roles, subject));
        node.relations = formatRelations(AI.relationLines(board, roles, subject));
        node.board = AI.boardText(board, roles, subject);
      } catch (e) {
        /* 盘面材料算不出来 = 这一卦没有证据可读。**不许往下走** ——
           往下走就是拿着空材料让 M4 编,而它一定编得出来。 */
        return Promise.reject(new Error("盘面材料未算出:" + ((e && e.message) || e)));
      }

      // prior exchanges (if any) go first so a follow-up ("what did line 2
      // mean?") has the earlier reading to refer back to — messages must
      // still end on this turn's "user" entry for the API's strict
      // user/assistant alternation. ⚠️ 这一轮的 user 内容由 fill.js 的
      // userOverride 写(「讲给他听。」),所以这里放问题本身就够了。
      var history = Array.isArray(opts.history) ? opts.history : [];
      var messages = history.concat([{ role: "user", content: question }]);

      // Stream the main reading when the caller wants live text (opts.onDelta)
      // and the browser can do it — this is what actually cuts perceived
      // latency: the user sees real tokens within ~1-2s instead of waiting
      // out the whole gate→route→generate→QC pipeline in silence. Router/QC
      // stay non-streaming; they're short and cheap either way.
      var streamed = typeof opts.onDelta === "function" && canStream();
      // 12000-token ceiling for the reading (was 8192): a full Sortis reading
      // across all layers is 4000-6000 CJK chars and was truncating mid-sentence.
      /* A reading is only ever requested as a stream. Generating one takes
         60-90 seconds and the non-streaming path waits for all of it before a
         byte moves, so the connection dies before the answer exists — and the
         server settles anyway, which is how a reader ends up paying for prose
         that never arrived. The proxy now refuses a non-streamed reading, so
         there is no point making the request: say so here instead. */
      if (!streamed) {
        return Promise.reject(new Error(
          "This browser can't receive a streamed reading, and a reading is too long to arrive any other way."
        ));
      }

      /* ── 第二、三站:M2 选库 → M3 取证 ──────────────────────────────────
         两级 RAG 的两级就是这两站。⚠️ **顺序是承重的**:M3 只能看到 M2 开的
         那几个库的卡(收窄在服务端 fill.js 那一行),所以 M2 的答案必须先到。
         并行发两个请求会让 M3 对着全部 29 张卡排序 —— 它不报错,只是把
         「两级」退回成「一级」。 */
      var nodePayload = function (extra) {
        var p = {
          question: question, features: node.features, board: node.board,
          ladder: node.ladder, relations: node.relations, m1: m1Text,
          messages: [{ role: "user", content: question }]
        };
        for (var k in extra) if (extra.hasOwnProperty(k)) p[k] = extra[k];
        return p;
      };
      var evidence = runNode("m2", product, nodePayload({}), notes)
        .then(function (m2Text) {
          node.m2 = m2Text;
          return runNode("m3", product, nodePayload({ m2: m2Text }), notes);
        }).then(function (m3Text) {
          node.m3 = m3Text;
          /* ⚠️ 失败的那一站在材料里留一句,不留空。M4 因此说的是缺了东西,
             而不是拿着一个看不出来的半截管线假装完整。 */
          if (notes.length) node.m3 = (node.m3 ? node.m3 + "\n\n" : "") + "⚠️ " + notes.join(";");
          return m3Text;
        });

      var mainCall = evidence.then(function () {
        /* ── 第四站 M4:解读本身 ──────────────────────────────────────────
           ⚠️ `role:"m4"` 不是可选的。没有它,服务端会落到 default 分支去装配
           老的那整套 —— 那条分支现在直接 400,但这里仍然写死,因为
           **「忘了带 role」和「故意走老路」在线上长得一模一样**。 */
        return makeStreamComplete({
          role: "m4", product: product, model: CONFIG.mainModel,
          mode: mode, temperature: temperature
          // No max_tokens: a reading's output budget is the server's to set, and a
          // magic number here was driving the model from the least trustworthy place.
        })(nodePayload({ m3: node.m3, messages: messages }), opts.onDelta);
      });

      return mainCall.then(function (reading) {
        // Step 3.5: deterministic board-facts cross-check (free, no API call)
        // — catches the AI citing a line number or moving-line count that
        // doesn't match the real board, before the LLM QC pass runs.
        var factCheck = safeCheck("checkBoardFacts", PC.checkBoardFacts && function () { return PC.checkBoardFacts(reading, board); });
        // ...and the same kind of check on the other axis: did the reading name
        // a yongshen, and did it decline on a ground that is actually real?
        // Three prompt rules already forbade declining a readable question and
        // all three missed it, so this one runs in code where it cannot be
        // reasoned around. Merged into factCheck so a catch rides the retry
        // that already exists rather than adding a second round-trip.
        var readCheck = safeCheck("checkReadability", PC.checkReadability && function () { return PC.checkReadability(reading); });

        // Step 4: QC pass (if enabled). Follow-ups skip QC: they're metered,
        // conversational, and stream to the user anyway (QC would only be
        // telemetry) — a QC retry would double the metered spend for nothing.
        var shouldQC = mode === "followup" ? false
          : (CONFIG.enableQC !== null ? CONFIG.enableQC : (product === "sortis"));
        if (!shouldQC && factCheck.ok && readCheck.ok) {
          return {
            source: "router",
            route: result.route,
            reading: reading,
            verdict: "complete",
            qcResult: null
          };
        }

        /* QC's checklist is a segment, so it stays on the server: the client
           asks for role "qc" and sends only the material to be checked. */
        var qcPromise = shouldQC
          ? makeComplete({ role: "qc", model: CONFIG.qcModel })({
              question: question,
              messages: [{ role: "user", content: "QUESTION: " + question + "\n\nREADING TO CHECK:\n" + reading }],
              max_tokens: 400
            }).then(function (verdict) {
              return { pass: !/^\s*REWRITE:/im.test(String(verdict || "")), raw: verdict };
            }).catch(function () { return { pass: true }; })
          : Promise.resolve({ pass: true });

        return qcPromise.then(function (qc) {
          var combinedPass = qc.pass && factCheck.ok && readCheck.ok;
          if (combinedPass) {
            return {
              source: "router",
              route: result.route,
              reading: reading,
              verdict: "complete",
              qcResult: qc
            };
          }

          var detail = (qc.detail ? qc.detail + "\n" : "") +
            (factCheck.ok ? "" : "FACTUAL MISMATCH vs the real board — " + factCheck.issues.join("; ") + "\n") +
            (readCheck.ok ? "" : "READABILITY — " + readCheck.issues.join("; "));

          /* Text that has streamed to the reader cannot be un-shown, and a
             silent rewrite would contradict what they just watched arrive. So
             a QC or fact-check miss is surfaced as telemetry, never acted on.

             There used to be a retry branch below this for the non-streamed
             case. Streaming is now the only way a reading is generated — the
             non-streaming path could not outlast generation and the proxy
             refuses it — so that branch was unreachable, and it still carried
             the old contract (it posted `system`, which the proxy now rejects
             outright). Removed rather than left to rot: dead code that would
             fail if it ever ran is worse than no code.

             If a checked-before-shown reading is ever wanted, the place to do
             it is the server, before the first byte goes out. */
          return {
            source: "router",
            route: result.route,
            reading: reading,
            verdict: "complete_unverified",
            qcResult: qc,
            factCheck: factCheck,
            readCheck: readCheck
          };
        });
      });
      }); // ← M1 的 then:四节点的第一站跑完才摆角色(用神由它的 db= 决定)
    }).catch(function (e) {
      /* 危机硬停从任意一站抛上来 —— 它是**答案**,按解读返回,不是错误。
         ⚠️ 服务端在这条路上已经把免费额度还回去了、也不收费,所以这里
         什么都不用再算,只要**不把它当失败**。 */
      if (e && e.crisis) {
        /* ⚠️ 也要送进 onDelta。读的人盯着的是那块正在流的区域;只 resolve 不喂
           这一路,求助信息要等整轮结束才画得出来 —— 而这一路上「等一下」
           是这个产品最不该做的事。危机现在停在 M1(非流式),所以这一喂
           不是多余的:没有它,那块区域一个字都不会出现。 */
        if (typeof opts.onDelta === "function") { try { opts.onDelta(e.text, e.text); } catch (x) {} }
        return { source: "router", route: "crisis", reading: e.text, verdict: "crisis" };
      }
      throw e;
    });
  }

  /* Token cost analysis used to walk SEGMENTS and ROUTES here. Both are trade
     secrets and now live server-side, so the sizes are no longer knowable in a
     browser — which is the point. Run `node scripts/dump-prompt.mjs` for the
     per-segment breakdown. */
  function analyzeCosts() { return null; }

  // ─── Public API ───────────────────────────────────────────────
  window.BWPromptRouter = {
    configure: configure,
    interpret: interpretWithRouter,
    analyzeCosts: analyzeCosts,
    canStream: canStream,
    CONFIG: CONFIG
  };
})();
