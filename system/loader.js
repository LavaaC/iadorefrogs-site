// Loader: sets wallpaper, builds icons from /apps/*, enforces tier access, opens windows on click
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const tiers = ["guest","unverified","verified","closefriend","gf"];
  const canAccess = (userTier, appTier) => tiers.indexOf(userTier) >= tiers.indexOf(appTier);

  async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(url+" "+r.status); return r.json(); }
  async function getText(url){ const r = await fetch(url); if(!r.ok) throw new Error(url+" "+r.status); return r.text(); }

  // Wallpaper + icons container
  async function loadSite(){
    // site config
    let site = { wallpaper: null, appsOrder: [] };
    try { site = await getJSON("/config/site.json"); } catch(e){ /* use defaults */ }
    if (site.wallpaper) document.body.style.backgroundImage = `url('${site.wallpaper}')`;

    // icons grid
    const icons = document.createElement("div");
    icons.id = "icons";
    $("#desktop").appendChild(icons);

    // apps list
    const list = await getJSON("/apps/apps.json"); // ["info","map",...]
    const ordered = site.appsOrder?.length ? site.appsOrder.filter(x=>list.includes(x)) : list;

    // Wait for auth to set user tier (AUTH.me() already fired in auth.js)
    const userTier = window.__USER_TIER__ || "guest";

    for (const id of ordered){
      const meta = await getJSON(`/apps/${id}/app.json`);
      const access = meta.access || "guest";
      const iconChar = meta.icon || "🗂️";
      const title = meta.title || id;

      // build icon (always show; gray it if locked)
      const ic = document.createElement("div");
      ic.className = "icon";
      ic.dataset.appId = id;
      ic.innerHTML = `<div class="tile">${iconChar}</div><div class="label">${title}</div>`;
      if (!canAccess(userTier, access)) {
        ic.style.opacity = "0.5";
        ic.title = `Locked: requires ${access}`;
      }
      icons.appendChild(ic);

      ic.addEventListener("click", async ()=>{
        if (!canAccess(window.__USER_TIER__ || "guest", access)) {
          alert(`Access denied. This app requires: ${access}`);
          return;
        }
        // create window if not exists
        let w = document.getElementById(`win-${id}`);
        if (!w) {
          w = document.createElement("div");
          w.className = "window";
          w.id = `win-${id}`;
          w.dataset.title = title;
          w.style.left = (meta.pos?.x ?? 180) + "px";
          w.style.top  = (meta.pos?.y ?? 80) + "px";
          w.style.width= (meta.size?.w ?? 560) + "px";
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
          w.querySelector("[data-close]").onclick = ()=> WM.closeWindow(w);
          w.querySelector("[data-min]").onclick   = ()=> WM.minimizeWindow(w);

          try {
            const html = await getText(`/apps/${id}/layout.html`);
            document.getElementById(`content-${id}`).innerHTML = html;
          } catch(e) {
            document.getElementById(`content-${id}`).innerHTML = `<div class="ph"><div><div class="ph-box"></div><div class="ph-cap">Missing layout.html</div></div></div>`;
          }
        }
        WM.openWindow(w);
      });
    }

    // clock
    function tick(){ const d=new Date(); const hh=String(d.getHours()).padStart(2,"0"); const mm=String(d.getMinutes()).padStart(2,"0"); $("#clock").textContent = `${hh}:${mm}`; }
    tick(); setInterval(tick, 10000);

    // react to auth tier changes
    document.addEventListener("auth:me", (ev)=>{
      const tier = ev.detail?.tier || "guest";
      // Optional: re-render icons lock state (simplest, reload page)
      // location.reload();
    });
  }

  loadSite().catch(err => console.error(err));
})();
