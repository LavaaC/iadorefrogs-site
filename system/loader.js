// Loader: wallpaper, icons, per-user prefs, Admin overrides, Devmode tier, Quick Launch
(() => {
  const $ = (s, r=document) => r.querySelector(s);
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

  const opening = new Set();

  async function loadSite(){
    let site = { wallpaper:null, appsAssetsBase:"assets/apps", devTier:null, devMode:true, defaultOrder:[], apiBase:"" };
    try { site = Object.assign(site, await getJSON("config/site.json")); } catch {}
    if (site.wallpaper) document.body.style.background = `#008080 url('${site.wallpaper}') center / cover no-repeat fixed`;

    // tell others (start menu needs this)
    window.__SITE__ = site;
    document.dispatchEvent(new CustomEvent("site:ready", { detail: site }));

    // desktop icons container
    const desktopIcons = document.createElement("div");
    desktopIcons.id = "icons";
    $("#desktop").appendChild(desktopIcons);

    const usingGitHub = location.hostname.endsWith("github.io");
    const useApi = !!site.apiBase && !usingGitHub;

    // apps list (normalize & dedupe by id)
    const rawList = await getJSON("apps/apps.json");
    const firstByNorm = new Map();
    for (const raw of rawList) {
      const norm = String(raw).trim().toLowerCase();
      if (!firstByNorm.has(norm)) firstByNorm.set(norm, String(raw).trim());
    }
    const list = Array.from(firstByNorm.values());

    // load metas
    const metas = {};
    for (const id of list) {
      try { metas[id] = await getJSON(`apps/${id}/app.json`); }
      catch { metas[id] = { title:id }; }
    }

    // current tier (GH can use devMode)
    let userTier = window.__USER_TIER__ || site.devTier || "guest";
    document.addEventListener("auth:me", (ev)=>{ userTier = ev.detail?.tier || "guest"; const s=$("#auth-status"); if(s) s.textContent = ev.detail?.username ? `${ev.detail.username} (${ev.detail.tier})` : "Guest"; });
    const s=$("#auth-status"); if (s) s.textContent = "Guest";

    // Admin overrides (global)
    let admin = { order:[], hidden:[], pinned:[], perApp:{} };
    try {
      admin = useApi ? await getJSON(`${site.apiBase}/admin/settings`) : JSON.parse(localStorage.getItem("frogs_admin") || "{}");
    } catch {}
    admin.order  = Array.isArray(admin.order)  ? admin.order  : [];
    admin.hidden = Array.isArray(admin.hidden) ? admin.hidden : [];
    admin.pinned = Array.isArray(admin.pinned) ? admin.pinned : [];
    admin.perApp = admin.perApp || {};

    // per-user prefs
    const meName = (window.__ME__ && window.__ME__.username) || "guest";
    const keyUser = `frogs_prefs_${meName}`;
    const prefs = JSON.parse(localStorage.getItem(keyUser) || "{}");
    const userHidden = new Set(Array.isArray(prefs.hidden) ? prefs.hidden : []);
    const userPinned = new Set(Array.isArray(prefs.pinned) ? prefs.pinned : []);

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
    const seenOrder = new Set();
    const ordered = adminOrder.concat(baseOrder).concat(list).filter(id => { if (seenOrder.has(id)) return false; seenOrder.add(id); return true; });

    // avoid duplicate titles on desktop
    const desktopAdded = new Set();
    const seenTitles = new Set();

    for (const id of ordered){
      const meta = metas[id] || {};
      const per = admin.perApp[id] || {};
      const title  = meta.title || id;
      const iconRes = resolveIcon(id, meta.icon, title, site.appsAssetsBase);
      const required = per.access || meta.access || "guest";
      const hideIfNoAccess = per.hideIfNoAccess ?? !!meta.hideIfNoAccess;

      const globallyHidden = admin.hidden.includes(id);
      const personallyHidden = userHidden.has(id);
      const shouldSkipForHidden = globallyHidden || personallyHidden;
      const allowed = canAccess(userTier, required);
      const skipForAccess = (!allowed && hideIfNoAccess);

      const normTitle = String(title).trim().toLowerCase();

      // desktop icon
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
          try { await openApp(id, meta, iconRes, required, title, site); }
          finally { ic.dataset.busy = "0"; }
        });
      }

      // quick launch
      if ((admin.pinned.includes(id) || userPinned.has(id)) && $("#quick")) {
        const qi = document.createElement("button");
        qi.className = "ql"; qi.title = title;
        qi.innerHTML = iconRes.path ? `<img src="${iconRes.path}" alt="" class="ql-img">` : "🗂️";
        qi.addEventListener("click", ()=> openApp(id, meta, iconRes, required, title, site));
        $("#quick").appendChild(qi);
      }
    }

    async function openApp(id, meta, iconRes, required, title, site){
      const wid = `win-${id}`;
      const existing = document.getElementById(wid);
      if (existing){ WM.openWindow(existing); return; }

      if (!canAccess(userTier, required)) { alert(`Access denied. Requires: ${required}`); return; }

      if (opening.has(id)) return;
      opening.add(id);
      try {
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
        WM.makeDraggable(w); WM.attachWindowControls(w); WM.openWindow(w);

        try {
          const html = await getText(`apps/${id}/layout.html`).catch(()=> getText(`apps/${id}/layout.htm`));
          document.getElementById(`content-${id}`).innerHTML = html;
          // app-specific bootstraps
          if (window.AppBoot && typeof window.AppBoot[id] === "function") window.AppBoot[id]({ site, id, meta, required });
        } catch {
          document.getElementById(`content-${id}`).innerHTML = `<div class="ph"><div><div class="ph-box"></div><div class="ph-cap">Missing layout.html/htm</div></div></div>`;
        }
      } finally {
        opening.delete(id);
      }
    }

    // clock
    const tick = ()=> {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");
      const el = $("#clock"); if (el) el.textContent = `${hh}:${mm}`;
    };
    tick(); setInterval(tick, 10000);
  }

  loadSite().catch(console.error);
})();
