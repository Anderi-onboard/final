/* BourneWise — shared app sidebar.
   ONE canonical sidebar, mirroring index.html (the source of truth), injected on every
   app/account page so the chrome is identical everywhere. Pure-text pages omit it.
   Load AFTER account.js:  <script src="./account.js"></script><script src="./sidebar.js"></script>
   It injects its own CSS + markup, then wires the rail toggle, casting history,
   ledger balance and the account menu from the shared BWAccount store. */
(function () {
  "use strict";
  if (document.querySelector("aside.sidebar[data-bw-shared]")) return;

  /* ── 1. CSS (verbatim from index.html's sidebar block) ── */
  var css =
  ".sidebar{position:relative;z-index:5;width:264px;flex-shrink:0;display:flex;flex-direction:column;padding:14px 12px 12px;background:transparent;transition:width .28s cubic-bezier(.4,0,.2,1);overflow:hidden;white-space:nowrap}" +
  "body.rail .sidebar{width:60px;padding-left:9px;padding-right:9px}" +
  ".side-top{display:flex;align-items:center;gap:8px;padding:2px 8px 0;min-height:36px}" +
  ".mark{flex:none;width:26px;height:21px;color:var(--ink)}" +
  ".brand-home{display:flex;align-items:center;gap:8px;border-radius:7px;transition:opacity .15s}" +
  ".brand-home:hover{opacity:.72}" +
  ".brand-word{font-family:var(--font-brand,cursive);font-weight:700;font-size:17px;transform:translateY(-1px)}" +
  ".side-toggle{margin-left:auto;width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:7px;color:var(--faint);transition:background .15s,color .15s}" +
  ".side-toggle:hover{background:var(--paper-dim);color:var(--ink)}" +
  "body.rail .side-toggle{margin-left:0}" +
  "body.rail .side-top{flex-direction:column;align-items:center;gap:10px;padding-bottom:4px}" +
  "body.rail .brand-word{width:0;height:0;overflow:hidden;margin:0}" +
  ".fade{transition:opacity .18s,width .18s}" +
  "body.rail .fade{opacity:0;pointer-events:none}" +
  ".new-cast{margin-top:16px;display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;font-size:14px;color:var(--terracotta);font-weight:500;transition:background .15s;text-align:left}" +
  ".new-cast:hover{background:var(--paper-dim)}" +
  ".new-cast .ic{flex:none;width:24px;height:24px;border-radius:50%;background:var(--terracotta);color:var(--paper);display:grid;place-items:center}" +
  "body.rail .new-cast{justify-content:center;padding:7px 0;gap:0}" +
  "body.rail .new-cast .fade{width:0;overflow:hidden}" +
  ".castings{margin-top:22px;flex:1;min-height:0;display:flex;flex-direction:column;gap:1px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(42,32,22,.22) transparent;transition:opacity .18s}" +
  ".castings::-webkit-scrollbar{width:5px}" +
  ".castings::-webkit-scrollbar-track{background:transparent}" +
  ".castings::-webkit-scrollbar-thumb{background:rgba(42,32,22,.18);border-radius:999px}" +
  ".castings::-webkit-scrollbar-thumb:hover{background:rgba(42,32,22,.32)}" +
  ".castings::-webkit-scrollbar-button{display:none;height:0;width:0}" +
  ".castings .lbl{flex:none;padding:0 8px 7px;font-family:'Spinnaker';font-weight:900}" +
  ".casting{flex:none;display:block;width:100%;text-align:left;font-size:13px;color:var(--dim);padding:6px 8px;border-radius:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s,color .15s}" +
  ".casting:hover{background:var(--paper-dim);color:var(--ink)}" +
  ".hist-empty{margin:2px 8px;padding:13px 12px;border:1px dashed var(--line);border-radius:9px;font-size:12px;line-height:1.5;color:var(--faint);white-space:normal}" +
  "body.rail .castings{opacity:0;pointer-events:none}" +
  ".ledger{position:relative;margin-top:14px;flex:none;overflow:hidden;background:linear-gradient(150deg,rgba(244,233,210,.72),rgba(244,233,210,.5));backdrop-filter:blur(13px) saturate(1.3);-webkit-backdrop-filter:blur(13px) saturate(1.3);border:1px solid rgba(255,255,255,.45);border-radius:16px;padding:13px 14px 14px;box-shadow:0 6px 20px rgba(31,29,26,.12),inset 0 1px 0 rgba(255,255,255,.5);transition:transform .22s cubic-bezier(.4,0,.2,1),box-shadow .18s,border-color .18s}" +
  ".ledger:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.72);box-shadow:0 12px 28px rgba(31,29,26,.18),inset 0 1px 0 rgba(255,255,255,.62)}" +
  ".ledger-head{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
  ".ledger-head .lbl{font-family:'Spinnaker';font-size:10px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--faint)}" +
  ".ledger-plan{font-family:'Spinnaker';font-size:9px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;color:var(--terracotta);background:rgba(181,80,44,.1);border:1px solid rgba(181,80,44,.22);border-radius:999px;padding:3px 9px}" +
  ".ledger-bal{display:flex;align-items:baseline;gap:6px;margin-top:10px}" +
  ".ledger .count{font-family:'Spinnaker';font-weight:600;font-size:30px;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.02em}" +
  ".ledger-unit{font-family:'Spinnaker';font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}" +
  ".ledger-meter{margin-top:12px;height:6px;border-radius:999px;background:rgba(42,32,22,.12);overflow:hidden}" +
  ".ledger-meter span{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,var(--terracotta),#D2774C);transition:width .55s cubic-bezier(.4,0,.2,1)}" +
  ".ledger-cap{margin-top:7px;font-family:'Spinnaker';font-size:10px;letter-spacing:.03em;color:var(--ghost)}" +
  ".exchange{margin-top:13px;display:flex;align-items:center;justify-content:center;gap:7px;width:100%;border:none;background:var(--terracotta);color:var(--paper);border-radius:10px;padding:9px;font-family:'Spinnaker';font-weight:600;font-size:12px;letter-spacing:.04em;box-shadow:0 2px 10px rgba(181,80,44,.25);transition:transform .15s,background .15s,box-shadow .15s}" +
  ".exchange:hover{transform:translateY(-1px);background:#C9663F;box-shadow:0 6px 16px rgba(181,80,44,.32)}" +
  ".exchange .ex-arr{transition:transform .15s}" +
  ".exchange:hover .ex-arr{transform:translateX(2px)}" +
  "body.rail .ledger{display:none}" +
  ".side-foot{position:relative;margin-top:12px;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:11px;cursor:pointer;text-align:left;width:100%;background:rgba(244,233,210,.5);border:1px solid var(--line-soft);backdrop-filter:blur(10px) saturate(1.2);-webkit-backdrop-filter:blur(10px) saturate(1.2);box-shadow:0 1px 4px rgba(31,29,26,.07),inset 0 1px 0 rgba(255,255,255,.32);transition:background .15s,border-color .15s}" +
  ".side-foot:hover{background:rgba(244,233,210,.82);border-color:var(--line)}" +
  ".avatar{flex:none;width:30px;height:30px;border-radius:50%;background:var(--prussian);color:#EAF1F8;display:grid;place-items:center;font-size:11.5px;font-weight:600}" +
  ".side-foot .who{flex:1;min-width:0;line-height:1.3}" +
  ".side-foot b{display:block;font-size:13px;font-weight:700;font-family:'Spinnaker'}" +
  ".side-foot i{font-style:normal;font-size:11px;letter-spacing:.04em;color:var(--ghost);font-family:'Spinnaker'}" +
  ".side-foot .go{flex:none;color:var(--faint)}" +
  "body.rail .side-foot{justify-content:center;padding:8px 0}" +
  "body.rail .side-foot .who,body.rail .side-foot .go{display:none}" +
  ".acct-menu{position:absolute;left:6px;bottom:56px;width:230px;" +
  "background:linear-gradient(150deg,rgba(244,233,210,.96),rgba(235,221,194,.84));" +
  "border:1px solid rgba(255,255,255,.6);border-radius:13px;padding:6px;" +
  "box-shadow:0 20px 54px rgba(31,29,26,.26),inset 0 1px 0 rgba(255,255,255,.7);" +
  "backdrop-filter:blur(22px) saturate(1.55);-webkit-backdrop-filter:blur(22px) saturate(1.55);" +
  "display:flex;flex-direction:column;z-index:30;" +
  "opacity:0;transform:translateY(6px);visibility:hidden;pointer-events:none;" +
  "transition:opacity .16s ease,transform .18s cubic-bezier(.4,0,.2,1),visibility 0s linear .16s}" +
  ".acct-menu.open{opacity:1;transform:none;visibility:visible;pointer-events:auto;" +
  "transition:opacity .16s ease,transform .18s cubic-bezier(.4,0,.2,1)}" +
  "body.rail .sidebar{overflow:visible}" +
  "body.rail .acct-menu{left:68px;bottom:4px}" +
  ".acct-menu .who{padding:11px 12px 13px;border-bottom:1px solid rgba(42,32,22,.1);margin-bottom:4px}" +
  ".acct-menu .who b{font-size:15px;font-weight:400;font-family:'BioRhyme',serif;display:block;color:var(--ink);line-height:1.3}" +
  ".acct-menu .who span{font-size:10.5px;color:var(--ghost);font-family:'Spinnaker';letter-spacing:.01em;margin-top:3px;display:block}" +
  ".mi{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;font-size:13px;color:var(--dim);text-align:left;transition:background .15s,color .15s}" +
  ".mi:hover{background:rgba(42,32,22,.07);color:var(--ink)}" +
  ".mi.plan b{margin-left:auto;font-size:9px;font-weight:500;letter-spacing:.1em;color:var(--terracotta);border:1px solid rgba(181,80,44,.32);border-radius:5px;padding:2px 7px;font-family:'Spinnaker';text-transform:uppercase}";
  var style = document.createElement("style");
  style.id = "bw-sidebar-css";
  style.textContent = css;
  document.head.appendChild(style);

  /* ── 2. markup ── */
  var MARK = '<svg class="mark" viewBox="0 0 512 416" fill="none" stroke="currentColor" stroke-linecap="round" aria-label="BourneWise logomark"><g transform="translate(240,1380)"><path style="stroke-width:40px" d="M-40.96-1327.31c30.72-20.48,61.44,20.48,92.16,0,30.72-20.48,71.68,20.48,102.4,0"></path><path style="stroke-width:40px" d="M-122.88-1245.39c51.2,30.72,102.4-30.72,143.36,0,40.96,30.72,102.4-30.72,153.6,0"></path><path style="stroke-width:40px" d="M-215.04-1163.47c81.92-61.44,163.84,40.96,235.52,0,71.68-40.96,153.6,51.2,235.52,0"></path><path style="stroke-width:40px" d="M-143.36-1081.55c51.2,30.72,112.64-20.48,163.84,0,51.2,20.48,112.64-30.72,153.6,0"></path><path style="stroke-width:40px" d="M-102.4-1009.87c30.72-10.24,61.44,20.48,92.16,0s71.68,10.24,102.4,0"></path></g></svg>';
  var aside = document.createElement("aside");
  aside.className = "sidebar";
  aside.setAttribute("data-bw-shared", "");
  aside.setAttribute("data-screen-label", (document.title.split("—")[0] || "App").trim() + " sidebar");
  aside.innerHTML =
    '<div class="side-top">' +
      '<a class="brand-home" href="./index.html" aria-label="BourneWise home" title="Home">' + MARK +
        '<b class="brand-word fade">BourneWise</b>' +
      '</a>' +
      '<button class="side-toggle" id="sideToggle" aria-label="Collapse sidebar" title="Collapse sidebar"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="2.5" width="13" height="11" rx="2"></rect><path d="M6 2.5v11"></path></svg></button>' +
    '</div>' +
    '<a class="new-cast" href="./index.html">' +
      '<span class="ic"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2.5v11M2.5 8h11"></path></svg></span>' +
      '<span class="fade" style="font-family: BioRhyme; font-weight: 900">New inquiry</span>' +
    '</a>' +
    '<nav class="castings fade" id="castList" aria-label="Recent inquiries"><div class="lbl">Recent inquiries</div><div id="histList"></div></nav>' +
    '<div class="ledger">' +
      '<div class="ledger-head"><span class="lbl">Available units</span><span class="ledger-plan" id="ledgerPlan">Basic</span></div>' +
      '<div class="ledger-bal"><span class="count" id="unitsSide" style="font-family: Pacifico; font-weight: 700">&mdash;</span><span class="ledger-unit">units</span></div>' +
      '<div class="ledger-meter"><span id="unitsBar"></span></div>' +
      '<div class="ledger-cap" id="unitsCap">of monthly balance</div>' +
      '<a class="exchange" href="./pricing.html">Add units <span class="ex-arr">&rarr;</span></a>' +
    '</div>' +
    '<button class="side-foot" id="acctBtn" aria-haspopup="true" aria-expanded="false">' +
      '<span class="avatar">G</span>' +
      '<span class="who fade"><b>Guest</b><i>Not signed in</i></span>' +
      '<span class="go fade"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6.5L8 2.5l4 4M4 9.5l4 4 4-4"></path></svg></span>' +
    '</button>' +
    '<div class="acct-menu" id="acctMenu">' +
      '<div class="who"><b style="font-family: Spinnaker">Guest</b><span style="font-family: Spinnaker">Sign in to maintain your history and unit balance</span></div>' +
      '<a class="mi plan" href="./pricing.html" style="font-family: Spinnaker"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.5l2 4.2 4.5.6-3.3 3.1.8 4.5L8 11.7l-4 2.2.8-4.5L1.5 6.3l4.5-.6z"></path></svg>Plan &amp; units<b id="miPlanBadge">BASIC</b></a>' +
      '<a class="mi" href="./settings.html" style="font-family: Spinnaker"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="2.5"></circle><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"></path></svg>Settings</a>' +
      '<button class="mi" id="miSignout" style="font-family: Spinnaker"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2.5H3.5v11H6M10 5l3 3-3 3M13 8H6.5"></path></svg>Sign out</button>' +
    '</div>';
  document.body.insertBefore(aside, document.body.firstChild);

  /* ── 3. rail toggle ── */
  var RAIL = "bw-paper-rail";
  if (localStorage.getItem(RAIL) === "1") document.body.classList.add("rail");
  aside.querySelector("#sideToggle").addEventListener("click", function () {
    var r = document.body.classList.toggle("rail");
    try { localStorage.setItem(RAIL, r ? "1" : "0"); } catch (e) {}
  });

  /* ── 4. state ── */
  var A = window.BWAccount;
  var S = A ? A.state() : { convs: [], units: 0, account: { name: "Guest", plan: "free", signedIn: false }, activeId: null };

  /* casting history → open the conversation back in the app */
  var hist = aside.querySelector("#histList");
  if (S.convs && S.convs.length) {
    S.convs.slice(0, 10).forEach(function (c) {
      var a = document.createElement("a");
      a.className = "casting";
      a.href = "./index.html";
      a.textContent = c.title;
      a.title = c.title;
      a.addEventListener("click", function () {
        try {
          var st = A.state();
          st.activeId = c.id;
          A.save(st);
        } catch (e) {}
      });
      hist.appendChild(a);
    });
  } else {
    var d = document.createElement("div");
    d.className = "hist-empty";
    d.textContent = "No inquiries yet. Once you ask, your history lives here.";
    hist.appendChild(d);
  }

  /* ledger balance + account row + menu identity */
  function paintLedger() {
    if (!A) return;
    S = A.state();
    A.paintSidebar({ foot: ".side-foot", menuWho: "#acctMenu .who", units: "#unitsSide" });
    var badge = aside.querySelector("#miPlanBadge");
    if (badge) badge.textContent = A.planName(S.account.plan).toUpperCase();
    var grant = (A.PLANS[S.account.plan] && A.PLANS[S.account.plan].grant) || 3000;
    var pct = Math.max(4, Math.min(100, Math.round(S.units / grant * 100)));
    var bar = aside.querySelector("#unitsBar"); if (bar) bar.style.width = pct + "%";
    var planEl = aside.querySelector("#ledgerPlan"); if (planEl) planEl.textContent = A.planName(S.account.plan);
    var cap = aside.querySelector("#unitsCap"); if (cap) cap.textContent = A.planName(S.account.plan) + " \u00b7 " + grant.toLocaleString("en-US") + " / mo";
  }
  paintLedger();
  // pull server state on shared pages too, then repaint
  if (A && A.hydrate) A.hydrate(function () { paintLedger(); });

  /* ── 5. account menu ── */
  var acctBtn = aside.querySelector("#acctBtn"), acctMenu = aside.querySelector("#acctMenu");
  acctBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var o = acctMenu.classList.toggle("open");
    acctBtn.setAttribute("aria-expanded", o ? "true" : "false");
  });
  document.addEventListener("click", function (e) {
    if (!acctMenu.contains(e.target) && !acctBtn.contains(e.target)) acctMenu.classList.remove("open");
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") acctMenu.classList.remove("open"); });
  var signout = aside.querySelector("#miSignout");
  if (signout) signout.addEventListener("click", function () {
    if (A) A.signOut();
    location.reload();
  });
})();
