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

      return mainComplete({
        system: result.system,
        messages: messages,
        max_tokens: 4096
      }).then(function (reading) {
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

          // QC or fact-check failed — retry once with the feedback
          if (CONFIG.maxRetries < 1) {
            return { source: "router", route: result.route, reading: reading, verdict: "qc_failed", qcResult: qc, factCheck: factCheck };
          }

          var retryContent = userContent + "\n\n[QUALITY FEEDBACK FROM PREVIOUS ATTEMPT - FIX THESE ISSUES]\n" + detail + "\n\n[Generate the complete reading again, fixing the above issues.]";
          var retryMessages = history.concat([{ role: "user", content: retryContent }]);

          return mainComplete({
            system: result.system,
            messages: retryMessages,
            max_tokens: 4096
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
    CONFIG: CONFIG
  };
})();
