// Loader: sets wallpaper, builds icons, enforces tier access, opens windows (GH Pages + Pi)
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const tiers = ["guest","unverified","verified","closefriend","gf"];
  const canAccess = (userTier, appTier) => tiers.indexOf(userTier) >= tiers.indexOf(appTier);

  async function getJSON(url){ const r = await fetch(url, { cache: "no-cache" }); if(!r.ok) throw new Error(url+" "+r.status); return r.json(); }
  async function getText(url){ const r = await fetch(url, { cache: "no-cache" }); if(!r.ok) throw new Error(url+" "+r.status); return r.text(); }

  function resolveIcon(id, icon, title, base){
    const isImg = icon && /\.(png|jpe?g|gif|svg|webp)$/i.test(icon);
    if (!isImg) return { html: (icon || "🗂️") };
    const path = (/^(https?:)?\//.test(icon)) ? icon : `${base}/${id}/${icon}`;
    return { html: `<img src="${path}" alt="${title}" class="tile-img">`, path };
  }

  async function loadSite(){
    // Config (relative paths so GitHub Pages works)
    let site = { wallpaper: null, appsOrder: [], appsAssetsBase: "assets/apps", devTier: null };
    try { site = Object.assign(site, await getJSON("config/site.json")); } catch(e){ /* defaults */ }
    if (site.wallpaper) document.body.style.backgroundImage = `url('${site.wallpaper}')`;

    // Icons grid
    const icons = document.createElement("div");
    icons.id = "icons";
    $("#desktop").appendChild(icons);

    // App list
    const list = await getJSON("apps/apps.json");
    const ordered = site.appsOrder?.length ? site.appsOrder.filter(x=>list.includes(x)) : list;

    // Tier from AUTH (auth.js fires auth:me). On Pages, auth.js sets devTier as current tier.
    let userTier = window.__USER_TIER__ || site.devTier || "guest";
    document.addEventListener("auth:me", (ev)=> { userTier = ev.detail?.tier || "guest"; });

    for (const id of ordered){
      const meta = await getJSON(`apps/${id}/app.json`);
      const access = meta.access || "guest";
      const title  = meta.title  || id;
      const iconRes = resolveIcon(id, meta.icon, title, site.appsAssetsBase);

      const ic = document.createElement("div");
      ic.className = "icon";
      ic.dataset.appId = id;
      ic.innerHTML = `<div class="tile">${iconRes.html}</div><div class="label">${title}</div>`;

      if (!canAccess(userTier, access)) {
        ic.style.opacity = "0.5";
        ic.title = `Locked: requires ${access}`;
      }
      icons.appendChild(ic);

      ic.addEventListener("click", async ()=>{
        const tierNow = window.__USER_TIER__ || site.devTier || "guest";
        if (!canAccess(tierNow, access)) { alert(`Access denied. Requires: ${access}`); return; }

        let w = document.getElementById(`win-${id}`);
        if (!w) {
          w = document.createElement("div");
          w.className = "window"; w.id = `win-${id}`; w.dataset.title = title;
          w.style.left  = (meta.pos?.x ?? 180) + "px";
          w.style.top   = (meta.pos?.y ?? 80)  + "px";
          w.style.width = (meta.size?.w ?? 560) + "px";
          w.innerHTML = `
            <div class="titlebar">
              <div class="title">${title}</div>
              <div class="controls">
                <div class="btn" data-min>_</div>
                <div class="btn" data-close>×</div>
              </div>
            </div>
            ${meta.toolbar ? `<div class="toolbar">${meta.toolbar}</div>` : ""}
            <div class="content" id="content-${id}">Loading…</div>`;
          document.body.appendChild(w);
          WM.makeDraggable(w);
          WM.attachWindowControls(w);

                   // layout.html, fallback to layout.htm
          let html = "";
          try {
            html = await getText(`apps/${id}/layout.html`);
          } catch (e1) {
            try {
              html = await getText(`apps/${id}/layout.htm`);
            } catch (e2) {
              html = `<div class="ph">
                        <div><div class="ph-box"></div><div class="ph-cap">Missing layout.html/htm</div></div>
                      </div>`;
            }
          }
          document.getElementById(`content-${id}`).innerHTML = html;
        }
        WM.openWindow(w);
      });
    }

    // Clock
    function tick(){
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      document.getElementById("clock").textContent = `${hh}:${mm}`;
    }
    tick(); setInterval(tick, 10000);
  }

  loadSite().catch(err => console.error(err));
})();
