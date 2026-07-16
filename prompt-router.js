/* prompt-router.js — Integration layer: wires BWPromptEngine into the existing
   BWLiuYaoAI.interpret() and chat-app.js askOracle() flows.
   ─────────────────────────────────────────────────────────────────────────────
   Drop-in: include this script AFTER prompt-engine.js and BEFORE chat-app.js.
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
  function makeComplete(meta) {
    meta = meta || {};
    return function (input) {
      var payload;
      if (typeof input === "string") {
        payload = { messages: [{ role: "user", content: input }] };
      } else {
        payload = { system: input.system, messages: input.messages };
        if (input.max_tokens) payload.max_tokens = input.max_tokens;
      }
      if (meta.role) payload.role = meta.role;
      if (meta.product) payload.product = meta.product;
      if (meta.model) payload.model = meta.model;

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

  function makeStreamComplete(meta) {
    meta = meta || {};
    return function (input, onDelta) {
      var payload = { system: input.system, messages: input.messages, stream: true };
      if (input.max_tokens) payload.max_tokens = input.max_tokens;
      if (meta.role) payload.role = meta.role;
      if (meta.product) payload.product = meta.product;
      if (meta.model) payload.model = meta.model;

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
            // the backend refunded a reading that didn't finish cleanly — let the
            // UI tell the user + offer a free retry
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
          });
        }
        return pump();
      });
    };
  }

  // ─── Main pipeline ────────────────────────────────────────────
  function interpretWithRouter(opts) {
    opts = opts || {};
    var question = opts.question || "";
    var product = opts.product || (opts.method === "stria" ? "stria" : "sortis");
    var board = opts.board;
    // explicit opts.lang (if the caller ever sets one) wins; otherwise the
    // language detected from the question itself (PE.buildSystemPrompt's
    // result.lang below) drives the board-prompt language — no more
    // hardcoded "en" default regardless of what the user actually typed.
    var lang = opts.lang;

    var PE = window.BWPromptEngine;
    if (!PE) {
      console.warn("[prompt-router] BWPromptEngine not loaded, falling back to default");
      return null; // caller falls back to original flow
    }

    // router + qc run on the cheap utility model; the main reading routes by
    // product (stria → Sonnet, sortis → Opus) on the backend.
    var routerComplete = makeComplete({ role: "router", model: CONFIG.routerModel });
    var mainComplete = makeComplete({ product: product, model: CONFIG.mainModel });
    var qcComplete = makeComplete({ role: "qc", model: CONFIG.qcModel });

    // Step 1+2: Gate + Route (combined in buildSystemPrompt)
    return PE.buildSystemPrompt(question, product, routerComplete).then(function (result) {
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

      // Step 3: Main reading. Derive the 用神/role map the board prompt needs
      // (deriveRoles produces roles.perLine — without it distill() throws and
      // the whole Sortis pipeline silently falls back to legacy).
      var boardData = "";
      var effectiveLang = lang || result.lang || "en";
      var AI = window.BWLiuYaoAI;
      if (board && AI && AI.buildMessages) {
        try {
          var priorKey = (AI.CATEGORY_YONGSHEN && AI.CATEGORY_YONGSHEN[opts.category || "general"]) || "self";
          var roles = board._roles || (AI.deriveRoles ? AI.deriveRoles(board, priorKey) : {});
          var built = AI.buildMessages(board, roles, question, opts.category || "general", opts.gender, effectiveLang);
          boardData = built.messages[0].content;
          // buildMessages() appends a "Return ONLY valid minified JSON …" output
          // schema — that's for the standalone BWLiuYaoAI.interpret() path, whose
          // caller parses JSON. In THIS routed pipeline the output format is
          // governed entirely by result.system (the prose OUTPUT STRUCTURE), so
          // the JSON instruction must be stripped. Left in, the model returns raw
          // JSON (rendered as garbled braces/keys) with only a 2-4 sentence
          // "reading" field — the "乱码 + 字数不够" the user saw. Keep only the
          // QUESTION / CATEGORY / BOARD-facts portion that precedes the schema.
          var schemaAt = boardData.indexOf("Return ONLY valid minified JSON");
          if (schemaAt > 0) boardData = boardData.slice(0, schemaAt).trim();
        } catch (e) {
          if (window.console) console.warn("[prompt-router] board prompt build failed, using question only:", e && e.message);
        }
      }

      var userContent = boardData || ("QUESTION: " + question);
      // prior exchanges (if any) go first so a follow-up ("what did line 2
      // mean?") has the earlier reading to refer back to — messages must
      // still end on this turn's "user" entry for the API's strict
      // user/assistant alternation.
      var history = Array.isArray(opts.history) ? opts.history : [];
      var messages = history.concat([{ role: "user", content: userContent }]);

      // Stream the main reading when the caller wants live text (opts.onDelta)
      // and the browser can do it — this is what actually cuts perceived
      // latency: the user sees real tokens within ~1-2s instead of waiting
      // out the whole gate→route→generate→QC pipeline in silence. Router/QC
      // stay non-streaming; they're short and cheap either way.
      var streamed = typeof opts.onDelta === "function" && canStream();
      var mainCall = streamed
        ? makeStreamComplete({ product: product, model: CONFIG.mainModel })({
            system: result.system, messages: messages, max_tokens: 8192
          }, opts.onDelta)
        : mainComplete({ system: result.system, messages: messages, max_tokens: 8192 });

      return mainCall.then(function (reading) {
        // Step 3.5: deterministic board-facts cross-check (free, no API call)
        // — catches the AI citing a line number or moving-line count that
        // doesn't match the real board, before the LLM QC pass runs.
        var factCheck = PE.checkBoardFacts(reading, board);

        // Step 4: QC pass (if enabled)
        var shouldQC = CONFIG.enableQC !== null ? CONFIG.enableQC : (product === "sortis");
        if (!shouldQC && factCheck.ok) {
          return {
            source: "router",
            route: result.route,
            reading: reading,
            verdict: "complete",
            qcResult: null
          };
        }

        var qcPromise = shouldQC ? PE.qcCheck(reading, question, qcComplete) : Promise.resolve({ pass: true });

        return qcPromise.then(function (qc) {
          var combinedPass = qc.pass && factCheck.ok;
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
            (factCheck.ok ? "" : "FACTUAL MISMATCH vs the real board — " + factCheck.issues.join("; "));

          // Once text has streamed to the user it can't be un-shown — a
          // silent rewrite would contradict what they already read. Surface
          // the QC/fact-check miss as telemetry instead of retrying.
          if (streamed) {
            return { source: "router", route: result.route, reading: reading, verdict: "complete_streamed_unverified", qcResult: qc, factCheck: factCheck };
          }

          // QC or fact-check failed — retry once with the feedback
          if (CONFIG.maxRetries < 1) {
            return { source: "router", route: result.route, reading: reading, verdict: "qc_failed", qcResult: qc, factCheck: factCheck };
          }

          var retryContent = userContent + "\n\n[QUALITY FEEDBACK FROM PREVIOUS ATTEMPT - FIX THESE ISSUES]\n" + detail + "\n\n[Generate the complete reading again, fixing the above issues.]";
          var retryMessages = history.concat([{ role: "user", content: retryContent }]);

          return mainComplete({
            system: result.system,
            messages: retryMessages,
            max_tokens: 8192
          }).then(function (retryReading) {
            return {
              source: "router",
              route: result.route,
              reading: retryReading,
              verdict: "complete_after_retry",
              qcResult: qc
            };
          });
        });
      });
    });
  }

  // ─── Token cost analysis ──────────────────────────────────────
  function analyzeCosts() {
    var PE = window.BWPromptEngine;
    if (!PE) return null;

    var products = ["sortis", "stria"];
    var routes = Object.keys(PE.ROUTES);
    var analysis = {};

    products.forEach(function (p) {
      analysis[p] = {};
      routes.forEach(function (r) {
        analysis[p][r] = PE.estimateTokens(r, p);
      });
    });

    return analysis;
  }

  // ─── Public API ───────────────────────────────────────────────
  window.BWPromptRouter = {
    configure: configure,
    interpret: interpretWithRouter,
    analyzeCosts: analyzeCosts,
    canStream: canStream,
    CONFIG: CONFIG
  };
})();
