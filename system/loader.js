// Loader: wallpaper, icons, per-user prefs, Admin overrides, Devmode tier, Quick Launch
(() => {
  const $ = (s, r=document) => r.querySelector(s);

  // NOTE: devmode is the highest tier
  const tiers = ["guest","unverified","verified","closefriend","devmode"];
  const canAccess = (u, a) => tiers.indexOf(u) >= tiers.indexOf(a);

  const getJSON = (u) => fetch(u,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(u+" "+r.status); return r.json(); });
  const getText = (u) => fetch(u,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(u+" "+r.status); return r.text(); });

  function resolveIcon(id, icon, title, base){
    const isImg = icon && /\.(png|jpe?g|gif|svg|webp)$/i.test(icon);
    if (!isImg) return { html:(icon||"🗂️"), path:"" };
    const path = /^(https?:)?\//.test(icon) ? icon : `${base}/${id}/${icon}`;
    return { html:`<img src="${path}" alt="${title}" class="desk-icon-img">`, path };
  }

  const opening = new Set(); // per-app open lock

  async function loadSite(){
    // Site config
    let site = { wallpaper:null, appsAssetsBase:"assets/apps", devTier:null, devMode:true, defaultOrder:[], apiBase:"" };
    try { site = Object.assign(site, await getJSON("config/site.json")); } catch {}

    // Strong wallpaper (never white if image missing)
    if (site.wallpaper) document.body.style.background = `#008080 url('${site.wallpaper}') center / cover no-repeat fixed`;

    const desktopIcons = document.createElement("div");
    desktopIcons.id = "icons";
    $("#desktop").appendChild(desktopIcons);
    const quick = $("#quick");

    // Apps list (normalize ids; remove dup IDs)
    const rawList = await getJSON("apps/apps.json");
    const firstByNorm = new Map();
    for (const raw of rawList) {
      const norm = String(raw).trim().toLowerCase();
      if (!firstByNorm.has(norm)) firstByNorm.set(norm, String(raw).trim());
    }
    const list = Array.from(firstByNorm.values());

    // Load metas
    const metas = {};
    for (const id of list) {
      try { metas[id] = await getJSON(`apps/${id}/app.json`); }
      catch { metas[id] = { title:id }; }
    }

    // Tier (Pages dev preview uses devMode to unlock admin; Pi will set actual tier)
    let userTier = window.__USER_TIER__ || site.devTier || "guest";
    document.addEventListener("auth:me", (ev)=>{ userTier = ev.detail?.tier || "guest"; });

    // Admin overrides (GLOBAL) — from API on Pi, localStorage on GH
    const usingGitHub = location.hostname.endsWith("github.io");
    const useApi = !!site.apiBase && !usingGitHub;
    let admin = { order:[], hidden:[], pinned:[], perApp:{} };
    try {
      if (useApi) {
        admin = await getJSON(`${site.apiBase}/admin/settings`);
      } else {
        admin = JSON.parse(localStorage.getItem("frogs_admin") || "{}");
      }
    } catch {}
    admin.order  = Array.isArray(admin.order)  ? admin.order  : [];
    admin.hidden = Array.isArray(admin.hidden) ? admin.hidden : [];
    admin.pinned = Array.isArray(admin.pinned) ? admin.pinned : [];
    admin.perApp = admin.perApp || {}; // { appId: {access:"verified", hideIfNoAccess:true} }

    // Helper to map order arrays (normalize ids, keep if present)
    const mapOrder = (arr)=>{
      const out = [], seen = new Set();
      for (const raw of arr||[]) {
        const norm = String(raw).trim().toLowerCase();
        const real = firstByNorm.get(norm);
        if (real && !seen.has(real)) { out.push(real); seen.add(real); }
      }
      return out;
    };

    const baseOrder = (site.defaultOrder?.length ? mapOrder(site.defaultOrder) : list.slice());
    const adminOrder = mapOrder(admin.order);

    // Per-user prefs (for GH preview or personal tweaks)
    const meName = (window.__ME__ && window.__ME__.username) || "guest";
    const keyUser = `frogs_prefs_${meName}`;
    const prefs = JSON.parse(localStorage.getItem(keyUser) || "{}");
    const userOrder = Array.isArray(prefs.order) ? mapOrder(prefs.order) : null;
    const userHidden = new Set(Array.isArray(prefs.hidden) ? prefs.hidden : []);
    const userPinned = new Set(Array.isArray(prefs.pinned) ? prefs.pinned : []);

    // Final order priority: Admin → Site default → list
    const seen = new Set();
    const ordered = adminOrder.concat(baseOrder).concat(list).filter(id => { if (seen.has(id)) return false; seen.add(id); return true; });

    // Dedupe by title too (avoid 2x "Info" visually)
    const desktopAdded = new Set();
    const seenTitles = new Set();

    // Render
    for (const id of ordered){
      const meta = metas[id] || {};
      const per = admin.perApp[id] || {};
      const title  = meta.title || id;
      const iconRes = resolveIcon(id, meta.icon, title, site.appsAssetsBase);

      // Access rule: admin override > app.json > default 'guest'
      const required = per.access || meta.access || "guest";
      // Hide flag: admin override; default false unless app.json has hideIfNoAccess
      const hideIfNoAccess = per.hideIfNoAccess ?? !!meta.hideIfNoAccess;

      // Determine effective visibility: Admin hidden OR per-user hidden
      const globallyHidden = admin.hidden.includes(id);
      const personallyHidden = userHidden.has(id);
      const shouldSkipForHidden = globallyHidden || personallyHidden;

      // Quick Launch pinned (admin or user)
      const isPinned = admin.pinned.includes(id) || userPinned.has(id);

      // Desktop icon visibility
      const normTitle = String(title).trim().toLowerCase();
      const allowed = canAccess(userTier, required);
      const skipForAccess = (!allowed && hideIfNoAccess);

      if (!shouldSkipForHidden && !skipForAccess && !desktopAdded.has(id) && !seenTitles.has(normTitle)) {
        desktopAdded.add(id); seenTitles.add(normTitle);

        const ic = document.createElement("div");
        ic.className = "icon";
        ic.dataset.appId = id;
        ic.innerHTML = `<div class="icon-img">${iconRes.html || "🗂️"}</div><div class="label">${title}</div>`;
        if (!allowed) { ic.style.opacity = "0.6"; ic.title = `Locked: requires ${required}`; }
        $("#icons").appendChild(ic);
        ic.addEventListener("click", async ()=>{
          if (ic.dataset.busy === "1") return;
          ic.dataset.busy = "1";
          try { await openApp(id, meta, iconRes, required, title); }
          finally { ic.dataset.busy = "0"; }
        });
      }

      // Quick Launch
      if (isPinned && $("#quick")) {
        const qi = document.createElement("button");
        qi.className = "ql"; qi.title = title;
        qi.innerHTML = iconRes.path ? `<img src="${iconRes.path}" alt="" class="ql-img">` : "🗂️";
        qi.addEventListener("click", ()=> openApp(id, meta, iconRes, required, title));
        $("#quick").appendChild(qi);
      }
    }

    async function openApp(id, meta, iconRes, required, title){
      const wid = `win-${id}`;
      const existing = document.getElementById(wid);
      if (existing){ WM.openWindow(existing); return; }

      // Access check (devmode satisfies everything)
      if (!canAccess(userTier, required)) { alert(`Access denied. Requires: ${required}`); return; }

      if (opening.has(id)) return;
      opening.add(id);
      try {
        if (document.getElementById(wid)) { WM.openWindow(`#${wid}`); return; }

        const w = document.createElement("div");
        w.className = "window"; w.id = wid; w.dataset.title = title;
        if (iconRes.path) w.dataset.icon = iconRes.path;
        const px = meta.pos?.x ?? 180, py = meta.pos?.y ?? 80, ww = meta.size?.w ?? 560;
        w.style.left = px+"px"; w.style.top = py+"px"; w.style.width = ww+"px";
        w.innerHTML = `
          <div class="titlebar">
            <div class="title">${title}</div>
            <div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div>
          </div>
          ${meta.toolbar ? `<div class="toolbar">${meta.toolbar}</div>` : ""}
          <div class="content" id="content-${id}">Loading…</div>`;
        document.body.appendChild(w);
        if (window.WM){ WM.makeDraggable(w); WM.attachWindowControls(w); }
        WM.openWindow(w);

        try {
          const html = await getText(`apps/${id}/layout.html`).catch(()=> getText(`apps/${id}/layout.htm`));
          document.getElementById(`content-${id}`).innerHTML = html;
          // Allow app-specific bootstraps (e.g., chat)
          if (window.AppBoot && typeof window.AppBoot[id] === "function") window.AppBoot[id]({ site, id, meta, required });
        } catch {
          document.getElementById(`content-${id}`).innerHTML = `<div class="ph"><div><div class="ph-box"></div><div class="ph-cap">Missing layout.html/htm</div></div></div>`;
        }
      } finally {
        opening.delete(id);
      }
    }

    // Clock
    const tick = ()=> {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");
      const el = $("#clock"); if (el) el.textContent = `${hh}:${mm}`;
    };
    tick(); setInterval(tick, 10000);

    // Expose site config for other modules (admin/chat)
    window.__SITE__ = site;
  }

  loadSite().catch(console.error);
})();
