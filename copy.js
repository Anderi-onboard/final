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
      answerCut: "The answer was cut short — you were only charged for what arrived. Send “continue” to carry on."
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
