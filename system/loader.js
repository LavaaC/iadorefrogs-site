// Loader: wallpaper, desktop icons (image-only), per-user order/show/pin, devMode access, Quick Launch
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const tiers = ["guest","unverified","verified","closefriend","gf"];
  const canAccess = (userTier, appTier) => tiers.indexOf(userTier) >= tiers.indexOf(appTier);

  const getJSON = (u) => fetch(u,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(u+" "+r.status); return r.json(); });
  const getText = (u) => fetch(u,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(u+" "+r.status); return r.text(); });

  function resolveIcon(id, icon, title, base){
    const isImg = icon && /\.(png|jpe?g|gif|svg|webp)$/i.test(icon);
    if (!isImg) return { html: (icon || "🗂️"), path: "" };
    const path = /^(https?:)?\//.test(icon) ? icon : `${base}/${id}/${icon}`;
    return { html: `<img src="${path}" alt="${title}" class="desk-icon-img">`, path };
  }

  // Strong open locks per app (prevents double windows)
  const opening = new Set();

  async function loadSite(){
    // 1) Config
    let site = { wallpaper:null, appsOrder:[], appsAssetsBase:"assets/apps", devTier:null, devMode:true, defaultOrder:[] };
    try { site = Object.assign(site, await getJSON("config/site.json")); } catch(e){}

    if (site.wallpaper) document.body.style.backgroundImage = `url('${site.wallpaper}')`;

    // 2) Containers
    const desktopIcons = document.createElement("div");
    desktopIcons.id = "icons";
    $("#desktop").appendChild(desktopIcons);
    const quick = $("#quick");

    // 3) Apps + meta
    const listRaw = await getJSON("apps/apps.json");
    const list = Array.from(new Set(listRaw)); // de-dup defensively
    const metas = {};
    for (const id of list) {
      try { metas[id] = await getJSON(`apps/${id}/app.json`); }
      catch { metas[id] = { title:id }; }
    }

    // 4) Tier (devMode unlocks everything on GH Pages)
    let userTier = window.__USER_TIER__ || site.devTier || "guest";
    document.addEventListener("auth:me", (ev)=>{ userTier = ev.detail?.tier || "guest"; });

    // 5) Base order from config or list
    const baseOrder = (site.defaultOrder && site.defaultOrder.length)
      ? site.defaultOrder.filter(x=>list.includes(x))
      : list.slice();

    // 6) User prefs (order/show/pin)
    const meName = (window.__ME__ && window.__ME__.username) || "guest";
    const key = `frogs_prefs_${meName}`;
    const prefs = JSON.parse(localStorage.getItem(key) || "{}");
    const userOrder = Array.isArray(prefs.order) ? prefs.order.filter(x=>list.includes(x)) : null;
    const hidden = new Set(prefs.hidden || []); // HIDE removes from Desktop (grid compacts naturally)
    const pinned = new Set(prefs.pinned || []);

    // 7) Final order (user first, then fill with any missing from base)
    const seen = new Set();
    const ordered = (userOrder || baseOrder).concat(baseOrder).filter(id => {
      if (seen.has(id)) return false; seen.add(id); return true;
    });

    // 8) Build Desktop + Quick Launch
    for (const id of ordered){
      const meta = metas[id] || {};
      const access = site.devMode ? "guest" : (meta.access || "guest"); // dev: unlock all
      const title  = meta.title || id;
      const iconRes = resolveIcon(id, meta.icon, title, site.appsAssetsBase);

      // Desktop icon (skip hidden so the grid compacts)
      if (!hidden.has(id)) {
        const ic = document.createElement("div");
        ic.className = "icon";
        ic.dataset.appId = id;
        ic.innerHTML = `<div class="icon-img">${iconRes.html || "🗂️"}</div><div class="label">${title}</div>`;
        if (!canAccess(userTier, access)) {
          ic.style.opacity = "0.6"; ic.title = `Locked: requires ${access}`;
        }
        desktopIcons.appendChild(ic);

        ic.addEventListener("click", async ()=>{
          // guard: ignore while opening
          if (ic.dataset.busy === "1") return;
          ic.dataset.busy = "1";
          try { await openApp(id, meta, iconRes, access, title); }
          finally { ic.dataset.busy = "0"; }
        });
      }

      // Quick-launch (kept independent from hidden; uncheck "Pin" in Customize to remove)
      if (quick && pinned.has(id)) {
        const qi = document.createElement("button");
        qi.className = "ql";
        qi.title = title;
        qi.innerHTML = iconRes.path ? `<img src="${iconRes.path}" alt="" class="ql-img">` : "🗂️";
        qi.addEventListener("click", ()=> openApp(id, meta, iconRes, access, title));
        quick.appendChild(qi);
      }
    }

    async function openApp(id, meta, iconRes, access, title){
      // Access check (devMode → unlocked)
      const tierNow = window.__USER_TIER__ || site.devTier || "guest";
      const effAccess = site.devMode ? "guest" : (access || "guest");
      if (!canAccess(tierNow, effAccess)) { alert(`Access denied. Requires: ${effAccess}`); return; }

      const wid = `win-${id}`;
      const existing = document.getElementById(wid);
      if (existing){ WM.openWindow(existing); return; }

      // strong per-app lock (covers desktop+quick simultaneous clicks)
      if (opening.has(id)) return;
      opening.add(id);
      try {
        // double-check again just before creating
        if (document.getElementById(wid)) { WM.openWindow(`#${wid}`); return; }

        const w = document.createElement("div");
        w.className = "window";
        w.id = wid;
        w.dataset.title = title;
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

        // Open immediately as active (lighter)
        WM.openWindow(w);

        // Load layout (html → htm fallback)
        try {
          const html = await getText(`apps/${id}/layout.html`).catch(()=> getText(`apps/${id}/layout.htm`));
          $(`#content-${id}`).innerHTML = html;
        } catch {
          $(`#content-${id}`).innerHTML = `<div class="ph"><div><div class="ph-box"></div><div class="ph-cap">Missing layout.html/htm</div></div></div>`;
        }
      } finally {
        opening.delete(id);
      }
    }

    // Clock
    function tick(){
      const d = new Date();
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");
      const el = $("#clock"); if (el) el.textContent = `${hh}:${mm}`;
    }
    tick(); setInterval(tick, 10000);
  }

  loadSite().catch(console.error);
})();
