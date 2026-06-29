/* BourneWise — single source of truth for state, plans, methods, and entitlements.
   Every page reads/writes through window.BWAccount. No other file touches localStorage
   for billing data or duplicates these definitions.

   window.BWAccount:
     .PLANS              -> canonical plan table
     .METHODS            -> canonical method table (cost, gating, descriptions)
     .METHOD_ORDER       -> display ordering ["stria","sortis"]
     .state()            -> full store (loads + normalises defaults)
     .save(s)            -> persist
     .account()          -> {name,email,plan,avatar,signedIn}
     .signIn(provider)   -> set a demo account
     .signOut()          -> reset to guest
     .entitled(methodId) -> can the current plan use this method?
     .deductUnits(n)     -> subtract n, persist, return new balance
     .addUnits(n)        -> add n, persist, return new balance
     .planName(id)       -> human label for a plan id
     .methodCost(id)     -> unit cost for a method id
     .initials(name)     -> "EV" from "Elias Vance"
     .paintSidebar(opts) -> fill sidebar chrome from state
     .esc(s)             -> HTML-escape a string                          */
(function () {
  "use strict";
  var STORE = "bw-paper-chat";

  // ─── canonical tables (single source — never duplicate elsewhere) ───

  var PLANS = {
    free:    { id: "free",    name: "Free",    price: 0,  priceYear: 0,   grant: 300,   methods: ["stria"], trial: true },
    pro:     { id: "pro",     name: "Pro",     price: 19, priceYear: 190, grant: 22500, methods: ["stria", "sortis"] },
    premium: { id: "premium", name: "Premium", price: 29, priceYear: 290, grant: 45000, methods: ["stria", "sortis"] }
  };

  var METHODS = {
    stria: {
      id: "stria", name: "Stria 64", cost: 300, tag: "Baseline analysis",
      depth: "Primary hexagram framework",
      blurb: "Baseline analysis. A primary structural map of the situation you are currently navigating.",
      gated: false
    },
    sortis: {
      id: "sortis", name: "Sortis 6", cost: 1500, tag: "Causal synthesis",
      depth: "Transformed hexagram framework",
      blurb: "Causal synthesis. Evaluates dynamic lines to project outcomes for complex, high-stakes decisions.",
      gated: true
    }
  };
  var METHOD_ORDER = ["stria", "sortis"];

  var DEFAULT_ACCOUNT = { name: "Guest", email: "", plan: "free", avatar: "G", signedIn: false };

  // ─── state ──────────────────────────────────────────────────────────

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
    if (!s || typeof s !== "object") s = {};
    if (typeof s.units !== "number") s.units = PLANS.free.grant;
    if (!METHODS[s.method]) s.method = "stria";
    if (!Array.isArray(s.convs)) s.convs = [];
    if (!("activeId" in s)) s.activeId = null;
    if (!s.account || typeof s.account !== "object") {
      s.account = clone(DEFAULT_ACCOUNT);
    }
    if (!PLANS[s.account.plan]) s.account.plan = "free";
    return s;
  }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }

  // ─── entitlements ───────────────────────────────────────────────────

  function entitled(methodId) {
    if (!METHODS[methodId] || !METHODS[methodId].gated) return true;
    var plan = load().account.plan;
    return plan === "pro" || plan === "premium";
  }

  // ─── ledger operations ──────────────────────────────────────────────

  function deductUnits(n) {
    var s = load();
    s.units = Math.max(0, s.units - n);
    save(s);
    return s.units;
  }

  function addUnits(n) {
    var s = load();
    s.units += n;
    save(s);
    return s.units;
  }

  // ─── identity ───────────────────────────────────────────────────────

  function initials(name) {
    var p = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "G";
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function planName(id) { return (PLANS[id] || PLANS.free).name; }
  function methodCost(id) { return (METHODS[id] || METHODS.stria).cost; }
  function planGrant(id) { return (PLANS[id] || PLANS.free).grant; }

  function signIn(provider) {
    var s = load();
    var demos = {
      google: { name: "Elias Vance", email: "elias.vance@gmail.com" },
      apple:  { name: "Elias Vance", email: "elias@icloud.com" },
      dev:    { name: "Dev Tester", email: "dev@bournewise.local" },
      email:  { name: "Elias Vance", email: "elias@iname.com" }
    };
    var d = demos[provider] || demos.dev;
    s.account = {
      name: d.name, email: d.email,
      plan: s.account && s.account.plan ? s.account.plan : "pro",
      avatar: initials(d.name), signedIn: true, provider: provider
    };
    if (s.account.plan === "free") s.account.plan = "pro";
    save(s);
    return s.account;
  }

  function signOut() {
    var s = load();
    s.account = clone(DEFAULT_ACCOUNT);
    if (METHODS[s.method] && METHODS[s.method].gated) s.method = "stria";
    save(s);
    return s.account;
  }

  // ─── plan descriptions (for settings page) ─────────────────────────

  function planDescription(id) {
    if (id === "free") return "Free · " + PLANS.free.grant + " Units trial · Stria 64 only";
    if (id === "pro") return "$" + PLANS.pro.price + "/mo · " + PLANS.pro.grant.toLocaleString("en-US") + " Units monthly · Sortis 6 unlocked";
    return "$" + PLANS.premium.price + "/mo · " + PLANS.premium.grant.toLocaleString("en-US") + " Units monthly · all methods";
  }

  // ─── sidebar paint ──────────────────────────────────────────────────

  function paintSidebar(opts) {
    opts = opts || {};
    var s = load(), a = s.account;
    var foot = resolve(opts.foot || ".side-foot");
    if (foot) {
      var av = foot.querySelector(".avatar");
      var b = foot.querySelector("b");
      var i = foot.querySelector("i");
      if (av) av.textContent = a.signedIn ? (a.avatar || initials(a.name)) : "G";
      if (b) b.textContent = a.name;
      if (i) i.textContent = a.signedIn ? (planName(a.plan) + " plan") : "Not signed in";
    }
    if (opts.menuWho) {
      var mw = resolve(opts.menuWho);
      if (mw) {
        var mb = mw.querySelector("b"), ms = mw.querySelector("span");
        if (mb) mb.textContent = a.name;
        if (ms) ms.textContent = a.signedIn ? a.email : "Sign in to keep your ledger";
      }
    }
    if (opts.units) {
      var sel = Array.isArray(opts.units) ? opts.units : [opts.units];
      sel.forEach(function (q) {
        document.querySelectorAll(q).forEach(function (n) {
          var suffix = n.getAttribute("data-units-suffix");
          n.textContent = s.units.toLocaleString("en-US") + (suffix || "");
        });
      });
    }
    return a;
  }

  // ─── utilities ──────────────────────────────────────────────────────

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function resolve(x) { return typeof x === "string" ? document.querySelector(x) : x; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ─── public API ─────────────────────────────────────────────────────

  window.BWAccount = {
    PLANS: PLANS,
    METHODS: METHODS,
    METHOD_ORDER: METHOD_ORDER,
    DEFAULT_ACCOUNT: DEFAULT_ACCOUNT,
    state: load,
    save: save,
    account: function () { return load().account; },
    entitled: entitled,
    deductUnits: deductUnits,
    addUnits: addUnits,
    signIn: signIn,
    signOut: signOut,
    initials: initials,
    planName: planName,
    planGrant: planGrant,
    planDescription: planDescription,
    methodCost: methodCost,
    paintSidebar: paintSidebar,
    esc: esc
  };
})();
