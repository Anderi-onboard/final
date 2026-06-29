/* BourneWise — shared account + ledger state (the "backend" the app pages read).
   One source of truth in localStorage under "bw-paper-chat", so the chat, the
   sidebar account row, settings, pricing and the casting detail all agree.

   window.BWAccount:
     .state()            -> the full store (loads/normalises defaults)
     .save(s)            -> persist
     .account()          -> {name,email,plan,avatar,signedIn}
     .signIn(provider)   -> set a demo account for Google/Apple/dev
     .signOut()
     .paintSidebar(opts) -> fill .side-foot (+ ledger count) on app-chrome pages
     .initials(name)
   PLANS is the canonical plan table (kept in sync with pricing.html). */
(function () {
  "use strict";
  var STORE = "bw-paper-chat";

  var PLANS = {
    free:    { id: "free",    name: "Free",    price: 0,  priceYear: 0,   grant: 300,   methods: ["stria"], trial: true },
    pro:     { id: "pro",     name: "Pro",     price: 19, priceYear: 190, grant: 22500, methods: ["stria", "sortis"] },
    premium: { id: "premium", name: "Premium", price: 29, priceYear: 290, grant: 45000, methods: ["stria", "sortis"] }
  };

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
    if (!s || typeof s !== "object") s = {};
    if (typeof s.units !== "number") s.units = 300;
    if (!s.method) s.method = "stria";
    if (!Array.isArray(s.convs)) s.convs = [];
    if (!("activeId" in s)) s.activeId = null;
    if (!s.account || typeof s.account !== "object") {
      s.account = { name: "Guest", email: "", plan: "free", avatar: "G", signedIn: false };
    }
    if (!s.account.plan) s.account.plan = "free";
    return s;
  }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }

  function initials(name) {
    var p = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "G";
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function planName(id) { return (PLANS[id] || PLANS.free).name; }

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
    s.account = { name: "Guest", email: "", plan: "free", avatar: "G", signedIn: false };
    save(s);
    return s.account;
  }

  /* Fill the standard sidebar account row + (optional) ledger count.
     opts.foot   = selector/element of the .side-foot row (default ".side-foot")
     opts.menuWho= selector of the .acct-menu .who block (optional)
     opts.units  = selector(s) to write the unit count into (optional) */
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
  function resolve(x) { return typeof x === "string" ? document.querySelector(x) : x; }

  window.BWAccount = {
    PLANS: PLANS,
    state: load, save: save,
    account: function () { return load().account; },
    signIn: signIn, signOut: signOut,
    initials: initials, planName: planName, paintSidebar: paintSidebar
  };
})();
