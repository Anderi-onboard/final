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
     .signInRemote(...)  -> real, persisted sign-in (server session; no demo fallback)
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

  // ─── server sync (D1-backed accounts) ───────────────────────────────
  // When a real session exists, the server (functions/api/account) is the
  // source of truth: balances and history survive across devices. Local writes
  // are optimistic and reconciled to the server's authoritative value. With no
  // backend (501) or as a guest, everything stays local — nothing breaks.

  var serverOn = false;
  function onServer() { return serverOn; }

  function api(path, method, bodyObj) {
    return fetch("/api/account" + path, {
      method: method || "GET",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: bodyObj ? JSON.stringify(bodyObj) : undefined
    }).then(function (r) {
      if (r.status === 501) { serverOn = false; return null; }
      return r.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  // Pull the authoritative account + history on load. cb() always runs.
  function hydrate(cb) {
    api("/me").then(function (d) {
      if (d && d.signedIn && d.user) {
        serverOn = true;
        var s = load();
        s.units = d.user.units;
        s.account = {
          name: d.user.name, email: d.user.email, plan: d.user.plan,
          avatar: initials(d.user.name), signedIn: true, provider: d.user.provider || "email"
        };
        if (Array.isArray(d.castings)) {
          s.convs = d.castings.map(function (c) {
            var p = c.payload || {};
            return { id: c.id, title: c.title, msgs: p.msgs || [], method: c.method, _synced: true };
          });
        }
        if (METHODS[s.method] === undefined) s.method = "stria";
        save(s);
      } else {
        serverOn = false;
        // The server explicitly says "not signed in" (d = {signedIn:false}) but
        // the local mirror still carries a signed-in account: that's a stale
        // ghost (expired cookie, or the old demo sign-in). Clearing it here is
        // what keeps the UI honest — otherwise the app shows "Premium" while
        // every server call 401s and readings silently die. A null d (network
        // failure / 501 backend-off) is NOT proof of sign-out, so leave the
        // local state alone in that case.
        if (d && d.signedIn === false) {
          var st = load();
          if (st.account && st.account.signedIn) {
            st.account = clone(DEFAULT_ACCOUNT);
            if (METHODS[st.method] && METHODS[st.method].gated) st.method = "stria";
            save(st);
            emit();
          }
        }
      }
      if (cb) cb(serverOn);
    });
  }

  // ─── ledger operations (optimistic local + server reconcile) ─────────

  // Local-optimistic only — for casting spend, functions/api/claude.js now
  // performs the AUTHORITATIVE server-side deduction inline with the
  // generation call itself (atomic: deduct, call Anthropic, refund on
  // failure), and its response carries unitsRemaining, which reconcileUnits()
  // below pulls back into the local store. This function used to also fire
  // POST /api/account/spend here, which would have double-deducted every
  // cast once the server-side gate existed — removed on purpose.
  function deductUnits(n, reason) {
    var s = load();
    s.units = Math.max(0, s.units - n);
    save(s);
    return s.units;
  }

  function addUnits(n, reason) {
    var s = load();
    s.units += n;
    save(s);
    if (serverOn) {
      api("/grant", "POST", { amount: n, reason: reason || "topup" }).then(reconcileUnits);
    }
    return s.units;
  }

  // Local-only refund for a failed cast. The server already refunded its own
  // atomic deduction (functions/api/claude.js refunds on upstream failure), so
  // this must NOT fire /grant — it only rolls back the optimistic local mirror.
  function refundLocal(n) {
    var s = load();
    s.units += n;
    save(s);
    emit();
    return s.units;
  }

  function reconcileUnits(d) {
    if (d && d.ok && typeof d.units === "number") {
      var s = load();
      if (s.units !== d.units) { s.units = d.units; save(s); emit(); }
    }
  }

  // switch plan + apply that plan's grant (server authoritative when signed in)
  function setPlan(plan) {
    var s = load();
    if (!PLANS[plan]) return s.units;
    s.account.plan = plan;
    if (plan !== "free") s.units += PLANS[plan].grant;
    save(s);
    if (serverOn) api("/plan", "POST", { plan: plan }).then(reconcileUnits);
    return s.units;
  }

  function syncCasting(conv) {
    if (!serverOn || !conv) return;
    api("/castings", "POST", {
      id: conv.id, title: conv.title, method: conv.method || load().method,
      payload: { msgs: conv.msgs || [] }
    });
  }
  function deleteCastingRemote(id) {
    if (serverOn && id) api("/castings/" + encodeURIComponent(id), "DELETE");
  }

  // tiny event bus so the UI can re-render after an async reconcile
  function emit() { try { window.dispatchEvent(new Event("bw:account-synced")); } catch (e) {} }

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

  function signOut() {
    var s = load();
    var wasServer = serverOn;
    s.account = clone(DEFAULT_ACCOUNT);
    if (METHODS[s.method] && METHODS[s.method].gated) s.method = "stria";
    // if we were syncing a real account, clear its local mirror (history + balance
    // live on the server; the device returns to a fresh guest)
    if (wasServer) {
      s.convs = [];
      s.activeId = null;
      s.units = PLANS.free.grant;
    }
    save(s);
    // best-effort clear of the server session
    fetch("/api/auth/signout", { method: "POST", credentials: "same-origin" }).catch(function () {});
    serverOn = false;
    return s.account;
  }

  // Real, persisted sign-in via the accounts backend. There is deliberately NO
  // local-demo fallback anymore: the old behaviour silently minted a fake
  // "signed-in" account when the backend call failed, which then displayed a
  // paid plan the server had never heard of — every Sortis call 401'd and the
  // reading degraded to a placeholder while units drained. Better to fail
  // loudly and let the login page show the error.
  function signInRemote(email, name, provider, cb) {
    fetch("/api/auth/dev", {
      method: "POST", headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: email, name: name, provider: provider || "email" })
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        return { status: r.status, d: d };
      });
    }).then(function (res) {
      var d = res.d;
      if (d && d.ok && d.user) {
        serverOn = true;
        var s = load();
        s.units = d.user.units;
        s.account = {
          name: d.user.name, email: d.user.email, plan: d.user.plan,
          avatar: initials(d.user.name), signedIn: true, provider: provider || "email"
        };
        save(s);
        if (cb) cb(true, s.account);
      } else {
        var why = (d && d.error) ? d.error
          : res.status === 501 ? "accounts backend not configured"
          : "sign-in failed (" + res.status + ")";
        if (cb) cb(false, null, why);
      }
    }).catch(function (e) {
      if (cb) cb(false, null, "network error — " + ((e && e.message) || e));
    });
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
    refundLocal: refundLocal,
    reconcileUnits: reconcileUnits,
    setPlan: setPlan,
    signInRemote: signInRemote,
    signOut: signOut,
    hydrate: hydrate,
    onServer: onServer,
    syncCasting: syncCasting,
    deleteCastingRemote: deleteCastingRemote,
    initials: initials,
    planName: planName,
    planGrant: planGrant,
    planDescription: planDescription,
    methodCost: methodCost,
    paintSidebar: paintSidebar,
    esc: esc
  };
})();
