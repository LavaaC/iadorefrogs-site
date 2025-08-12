// Loader: sets wallpaper, builds icons from /apps/*, enforces tier access, opens windows on click
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const tiers = ["guest","unverified","verified","closefriend","gf"];
  const canAccess = (userTier, appTier) => tiers.indexOf(userTier) >= tiers.indexOf(appTier);

  async function getJSON(url){ const r = await fetch(url, { cache: "no-cache" }); if(!r.ok) throw new Error(url+" "+r.status); return r.json(); }
  async function getText(url){ const r = await fetch(url, { cache: "no-cache" }); if(!r.ok) throw new Error(url+" "+r.status); return r.text(); }

  // resolveIcon: if icon looks like an image filename and doesn't start with "/", assume per-app assets under /assets/apps/<id>/
  function resolveIcon(id, icon, title){
    const isImg = icon && /\.(png|jpe?g|gif|svg|webp)$/i.test(icon);
    if (!isImg) return { html: (icon || "🗂️") };
    const path = icon.startsWith("/") ? icon : `/assets/apps/${id}/${icon}`;
    const html = `<img src="${path}" alt="${title}" class="tile-img">`;
    return { html, path };
  }

  async function loadSite(){
    // site config
    let site = { wallpaper: null, appsOrder: [] };
    try { site = await getJSON("/config/site.json"); } catch(e){ /* defaults */ }
    if (site.wallpaper) document.body.style.backgroundImage = `url('${site.wallpaper}')`;

    // icons grid
    const icons = document.createElement("div");
    icons.id = "icons";
    $("#desktop").appendChild(icons);

    // apps list
    const list = await getJSON("/apps/apps.json"); // ["info","map",...]
    const ordered = site.appsOrder?.length ? site.appsOrder.filter(x=>list.includes(x)) : list;

    // user tier from AUTH (auth.js sets this + fires auth:me)
    let userTier = window.__USER_TIER__ || "guest";
    document.addEventListener("auth:me", (ev)=>{
      userTier = ev.detail?.tier || "guest";
      // Optionally: re-check locks without reload. For now, icons remain visible; access is re-checked on click.
    });

    for (const id of ordered){
      const meta = await getJSON(`/apps/${id}/app.json`);
      const access = meta.access || "guest";
      const title  = meta.title  || id;
      const iconRes = resolveIcon(id, meta.icon, title);

      // build icon tile
      const ic = document.createElement("div");
      ic.className = "icon";
      ic.dataset.appId = id;
      ic.innerHTML = `<div class="tile">${iconRes.html}</div><div class="label">${title}</div>`;

      // grey-out if locked
      if (!canAccess(userTier, access)) {
        ic.style.opacity = "0.5";
        ic.title = `Locked: requires ${access}`;
      }
      icons.appendChild(ic);

      // on click: enforce access + open/create window
      ic.addEventListener("click", async ()=>{
        const tierNow = window.__USER_TIER__ || "guest";
        if (!canAccess(tierNow, access)) {
          alert(`Access denied. This app requires: ${access}`);
          return;
        }
        let w = document.getElementById(`win-${id}`);
        if (!w) {
          w = document.createElement("div");
          w.className = "window";
          w.id = `win-${id}`;
          w.dataset.title = title;
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
          w.querySelector("[data-close]").onclick = ()=> WM.closeWindow(w);
          w.querySelector("[data-min]").onclick   = ()=> WM.minimizeWindow(w);

          try {
            const html = await getText(`/apps/${id}/layout.html`);
            document.getElementById(`content-${id}`).innerHTML = html;
          } catch(e) {
            document.getElementById(`content-${id}`).innerHTML =
              `<div class="ph">
                 <div><div class="ph-box"></div><div class="ph-cap">Missing layout.html</div></div>
               </div>`;
          }
        }
        WM.openWindow(w);
      });
    }

    // simple clock
    function tick(){ const d=new Date(); const hh=String(d.getHours()).padStart(2,"0"); const mm=String(d.getMinutes()).padStart(2,"0"); $("#clock").textContent = `${hh}:${mm}`; }
    tick(); setInterval(tick, 10000);
  }

  loadSite().catch(err => console.error(err));
})();
