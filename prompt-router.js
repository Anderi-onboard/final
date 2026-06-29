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

  // ─── Claude call wrapper (supports model override) ────────────
  function makeComplete(modelOverride) {
    return function (input) {
      var payload;
      if (typeof input === "string") {
        payload = { messages: [{ role: "user", content: input }] };
      } else {
        payload = { system: input.system, messages: input.messages };
        if (input.max_tokens) payload.max_tokens = input.max_tokens;
      }
      if (modelOverride) payload.model = modelOverride;

      return fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error("claude proxy " + r.status);
        return r.json();
      }).then(function (d) {
        if (d && typeof d.text === "string") return d.text;
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
    var lang = opts.lang || "en";

    var PE = window.BWPromptEngine;
    if (!PE) {
      console.warn("[prompt-router] BWPromptEngine not loaded, falling back to default");
      return null; // caller falls back to original flow
    }

    var routerComplete = makeComplete(CONFIG.routerModel);
    var mainComplete = makeComplete(CONFIG.mainModel);
    var qcComplete = makeComplete(CONFIG.qcModel || "claude-haiku-4-5");

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

      // Step 3: Main reading
      var boardData = "";
      if (board && window.BWLiuYaoAI && window.BWLiuYaoAI.buildMessages) {
        var built = window.BWLiuYaoAI.buildMessages(board, board._roles || {}, question, opts.category || "general", opts.gender, lang);
        boardData = built.messages[0].content;
      }

      var userContent = boardData || ("QUESTION: " + question);

      return mainComplete({
        system: result.system,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 4096
      }).then(function (reading) {
        // Step 4: QC pass (if enabled)
        var shouldQC = CONFIG.enableQC !== null ? CONFIG.enableQC : (product === "sortis");
        if (!shouldQC) {
          return {
            source: "router",
            route: result.route,
            reading: reading,
            verdict: "complete",
            qcResult: null
          };
        }

        return PE.qcCheck(reading, question, qcComplete).then(function (qc) {
          if (qc.pass) {
            return {
              source: "router",
              route: result.route,
              reading: reading,
              verdict: "complete",
              qcResult: qc
            };
          }

          // QC failed — retry once with the feedback
          if (CONFIG.maxRetries < 1) {
            return { source: "router", route: result.route, reading: reading, verdict: "qc_failed", qcResult: qc };
          }

          var retryContent = userContent + "\n\n[QUALITY FEEDBACK FROM PREVIOUS ATTEMPT - FIX THESE ISSUES]\n" + qc.detail + "\n\n[Generate the complete reading again, fixing the above issues.]";

          return mainComplete({
            system: result.system,
            messages: [{ role: "user", content: retryContent }],
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
