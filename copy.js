/* copy.js — every word the product says to a reader, in one place.
   window.BWCopy

   WHY THIS EXISTS
   Product copy was scattered across chat-app.js, account.js, sidebar.js and the
   HTML, which is how the interface ended up promising things that were no
   longer true — quoting a per-reading price nothing charged, and telling
   readers their units were "reserved" long after reservations were removed. A
   sentence written next to the code that happens to display it gets forgotten
   when the behaviour beside it changes. Gathered here, the whole voice can be
   read in one sitting and audited against what the system actually does.

   HOW IT IS ORGANISED
   By surface, then by moment — ledger, composer, casting, followUp, account,
   errors. Anything that needs a number is a function taking that number, so a
   figure is never frozen into a string; the caller passes the current value and
   the wording adapts.

   THE OTHER HALF
   Model-facing text — reading instructions, routing, QC, the follow-up
   classifier — is NOT here. It lives in prompt-engine.js, which is its own
   single source (SEGMENTS / ROUTES / INTENT_ROUTER). The split is deliberate
   and worth keeping: this file is what a person reads, that one is what the
   model reads. They are edited by different people for different reasons.

   VOICE
   Say what happened and what it means for the reader. No apologies, no blame,
   no jargon from the machinery — a reader has a balance and asks questions;
   they do not have "reservations", "settlements" or "metering". State cost in
   the same breath as the thing that costs. */
(function () {
  "use strict";

  var n = function (v) { return Number(v || 0).toLocaleString("en-US"); };

  var COPY = {
    /* ── the balance panel ─────────────────────────────────────────────── */
    ledger: {
      label: "Available units",
      unit: "units",
      capFree: "Welcome and top-up units",
      capPaid: "Plan units + top-ups",
      action: "Get units"
    },

    /* ── the composer, and what a reading will cost ─────────────────────── */
    composer: {
      placeholder: "Say it plainly…",
      // Cost is stated as what it is: charged after the fact, for what was used.
      methodNote: function (name, typical) {
        return name + " · you are charged for what the reading uses, about " +
          n(typical) + " units · follow-ups cost less, in proportion to their length";
      },
      methodCost: function (typical) { return "~" + n(typical); }
    },

    /* ── casting and re-casting ─────────────────────────────────────────── */
    casting: {
      recastCarried: function (subject, typical) {
        return "Recast a fresh hexagram for the same matter — “" + subject +
          "” (about " + n(typical) + " units). For a different matter, state the new question in full.";
      },
      recastSameThread: function (typical) {
        return "Cast a fresh hexagram for this, following the same thread (about " + n(typical) + " units).";
      },
      // Shown when the router judged a message to be a NEW matter. It explains
      // the charge and how to get back to the previous casting.
      routedToNew: function (typical) {
        return "This reads as a new question, so a fresh hexagram was cast, costing about " + n(typical) +
          " units. To keep asking about the previous casting, ask about it directly; " +
          "a follow-up costs only what its own answer uses.";
      }
    },

    /* ── follow-ups on an existing casting ──────────────────────────────── */
    followUp: {
      // A cut-off reading continues automatically, once. Say what was charged,
      // because a reader watching a balance move deserves to know why.
      continuing: "The reading was cut short — charged only for what arrived; continuing on this same casting…",
      cutAgain: "The reading was cut short again — you were only charged for what arrived. Send “continue” to pick it up.",
      answerCut: "The answer was cut short — you were only charged for what arrived. Send “continue” to carry on.",
      // Shown under the suggested follow-up prompts. It must state the charge
      // honestly: a follow-up re-sends the figure and the thread so far, and is
      // billed for that, in proportion — there is no cap to promise.
      promptsNote: function (typical) {
        return "Nothing is sent until you submit. The same hexagram rides along with every follow-up, " +
          "which is charged for what it uses — usually around " + n(typical) + " units.";
      },
      /* The frame around the follow-up buttons. Once those buttons are written
         from the reading they arrive in the reading's language, and Chinese
         prompts sitting inside an English panel look like a half-finished
         translation. This immediate frame follows the reading; the rest of the
         interface stays English. */
      panel: {
        en: {
          kicker: function (method) { return method + " · Same hexagram"; },
          headContinued: "Check the previous answer against another constraint.",
          headSortis: "Inspect the change before you decide.",
          headStria: "Inspect the current structure before you decide.",
          hint: "Select a prompt to place it in the composer. You can edit it before submitting.",
          aria: function (method) { return "Ask a follow-up using the same " + method + " hexagram"; },
          note: function (typical) {
            return "Nothing is sent until you submit. The same hexagram rides along with every " +
              "follow-up, which is charged for what it uses — usually around " + n(typical) + " units.";
          }
        },
        zh: {
          kicker: function (method) { return method + " · 同一卦"; },
          headContinued: "换个角度，再核一遍刚才那个答案。",
          headSortis: "决定之前，把这一动看清楚。",
          headStria: "决定之前，把眼下的结构看清楚。",
          hint: "点一条，它会填进输入框，发送前你可以改。",
          aria: function (method) { return "用同一个 " + method + " 卦追问"; },
          note: function (typical) {
            return "不点发送就什么都不会发出去。每次追问都带着同一个卦一起走，按实际用量计费 —— " +
              "通常在 " + n(typical) + " 点左右。";
          }
        }
      }
    },

    /* ── the note under every finished reading ──────────────────────────────
       Set below the reading in smaller type, never inside it. A caution folded
       into the prose either softens the verdict or gets skimmed past with the
       rest of the paragraph; standing apart, it is read as what it is. It
       follows the language the reading was written in, because a caution nobody
       parses is decoration.
       Keep both versions saying the same four things: don't decide anything
       large on this alone, check it against what you can actually observe, the
       platform is still being built, and what a casting is actually for. */
    readingFooter: {
      en: "Please don't make major decisions on this reading alone — the technology behind it is " +
        "still improving, and we will keep building toward a more capable and stable platform. " +
        "Hold what you read here against what you can actually observe, take your time, and " +
        "decide from your real circumstances. A casting offers possible directions, a more " +
        "flexible way to think about where you are, and a mirror to look at yourself in — " +
        "it does not offer certainty.",
      zh: "请不要仅凭这篇解读做重大决定 —— 背后的技术仍在改进，我们也会一直把这个平台做得更准、更稳。" +
        "把读到的东西拿去和你能真正看到的情况对照，慢慢审，按你的实际处境决定。" +
        "卦给的是可能的方向、一种更活的想问题的角度，以及一面照自己的镜子 —— 它给不了定论。"
    },

    /* ── account and session ────────────────────────────────────────────── */
    account: {
      signInToCast: "Sign in to cast — a new account starts with 500 units on us.",
      signedOut: "Signed out — your history and balance remain secure.",
      readingDeleted: "Reading deleted."
    },

    /* ── when something goes wrong ──────────────────────────────────────────
       Every one of these says whether the reader was charged, because that is
       the first thing they want to know and the thing they cannot check. */
    errors: {
      outOfUnits: "You're out of units — top up to keep reading.",
      staleBuild: "The site just updated — refresh the page, then cast. Nothing was charged.",
      sessionExpired: "Your session has expired — sign in again to cast. Nothing was charged.",
      serverShort: "Not enough units on the server — add units and try again. Nothing was charged.",
      timedOut: "The reading timed out — please try again. Nothing was charged.",
      castFailed: "The reading didn’t make it through — nothing was charged. Try again in a moment.",
      answerTimedOut: "The answer timed out — try again. Nothing was charged.",
      answerFailed: "The answer didn’t make it through — nothing was charged. Try again in a moment."
    }
  };

  window.BWCopy = COPY;
})();
