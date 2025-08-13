// Start menu: toggle, auth items, Customize (me), Admin entries, Bug report
(() => {
  const $ = (s, r = document) => r.querySelector(s);

  let menu = document.getElementById("start-menu");
  if (!menu) { menu = document.createElement("div"); menu.id = "start-menu"; menu.className = "hidden"; document.body.appendChild(menu); }

  let open = false;
  const btn = $("#btn-start");
  const state = { loggedIn: false, me: null, userTier: "guest" };

  function canAdmin() {
    const site = window.__SITE__ || {};
    const gh = location.hostname.endsWith("github.io");
    const tier = (state.me?.tier || "guest").toLowerCase();
    return tier === "devmode" || (gh && site.devMode === true);
  }

  document.addEventListener("auth:me", (ev) => {
    state.me = ev.detail || null;
    state.loggedIn = !!state.me?.username;
    state.userTier = state.me?.tier || "guest";
    const s = $("#auth-status"); if (s) s.textContent = state.loggedIn ? `${state.me.username} (${state.userTier})` : "Guest";
    render();
  });

  // re-render when loader sets __SITE__
  document.addEventListener("site:ready", () => render());

  function item(id, label) { return `<button data-id="${id}" class="start-item">${label}</button>`; }

  function render() {
    const items = [];
    items.push(item("create", "Create account"));
    if (state.loggedIn) items.push(item("logout", "Log out")); else items.push(item("login", "Log in"));
    items.push("<hr>");
    items.push(item("customize", "Customize (Me)…"));
    if (canAdmin()) {
      items.push(item("admin-apps", "Admin: Apps & Tiers…"));
      items.push(item("admin-users", "Admin: Users…"));
    }
    items.push(item("bug", "Bug report…"));
    menu.innerHTML = `<div class="start-wrap">${items.join("")}</div>`;
    wire();
  }

  function wire() {
    menu.querySelectorAll(".start-item").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.id;
        closeMenu();
        if (id === "create") openCreate();
        else if (id === "login") openLogin();
        else if (id === "logout") document.dispatchEvent(new CustomEvent("auth:logout"));
        else if (id === "customize") openCustomize();
        else if (id === "admin-apps") document.dispatchEvent(new CustomEvent("ui:openAdminApps"));
        else if (id === "admin-users") document.dispatchEvent(new CustomEvent("ui:openAdminUsers"));
        else if (id === "bug") openBugReport();
      };
    });
  }

  function openMenu() {
    const r = btn.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.bottom = (window.innerHeight - r.top + 6) + "px";
    menu.classList.remove("hidden");
    open = true;
  }
  function closeMenu() { menu.classList.add("hidden"); open = false; }
  function toggleMenu() { open ? closeMenu() : openMenu(); }

  btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); });
  document.addEventListener("click", (e) => { if (!open) return; if (e.target.closest("#start-menu") || e.target.closest("#btn-start")) return; closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // Customize window (per-user; localStorage on GH)
  async function openCustomize() {
    let w = document.getElementById("win-customize");
    if (!w) {
      w = document.createElement("div");
      w.className = "window"; w.id = "win-customize"; w.dataset.title = "Customize";
      w.style.left="120px"; w.style.top="80px"; w.style.width="540px";
      w.innerHTML = `
        <div class="titlebar"><div class="title">Customize</div><div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div></div>
        <div class="content">
          <p>Reorder apps, show/hide on desktop, and pin to Quick Launch.</p>
          <div id="cz-list" class="cz-list"></div>
          <div class="cz-actions" style="margin-top:8px;display:flex;gap:8px">
            <button id="cz-save">Save</button>
            <button id="cz-reset">Reset to Default</button>
          </div>
        </div>`;
      document.body.appendChild(w);
      WM.makeDraggable(w); WM.attachWindowControls(w);
    }

    const list = await fetch("apps/apps.json",{cache:"no-cache"}).then(r=>r.json());
    const metas = await Promise.all(list.map(id=>fetch(`apps/${id}/app.json`,{cache:"no-cache"}).then(r=>r.json()).then(m=>({id,meta:m})).catch(()=>({id,meta:{title:id}}))));
    const cfg = await fetch("config/site.json",{cache:"no-cache"}).then(r=>r.json()).catch(()=>({}));
    const defOrder = (cfg.defaultOrder?.length ? cfg.defaultOrder : list).filter(x=>list.includes(x));

    const meName = window.__ME__?.username || "guest";
    const key = `frogs_prefs_${meName}`;
    const prefs = JSON.parse(localStorage.getItem(key) || "{}");
    const order = (prefs.order?.length ? prefs.order.filter(x=>list.includes(x)) : defOrder.slice());
    const hidden = new Set(prefs.hidden || []);
    const pinned = new Set(prefs.pinned || []);

    const host = document.getElementById("cz-list");
    host.innerHTML = order.map(id=>{
      const m = metas.find(x=>x.id===id)?.meta || {title:id};
      return `
        <div class="cz-row" data-id="${id}" style="display:grid;grid-template-columns:60px 1fr auto auto;align-items:center;gap:6px;margin-bottom:6px">
          <div><button class="cz-up">▲</button><button class="cz-down">▼</button></div>
          <div>${m.title||id}</div>
          <label style="justify-self:end"><input type="checkbox" class="cz-show" ${hidden.has(id)?"":"checked"}> Show</label>
          <label><input type="checkbox" class="cz-pin" ${pinned.has(id)?"checked":""}> Pin</label>
        </div>`;
    }).join("");

    host.onclick = (e)=>{
      const row = e.target.closest(".cz-row"); if (!row) return;
      if (e.target.classList.contains("cz-up")) {
        const prev = row.previousElementSibling; if (prev) host.insertBefore(row, prev);
      } else if (e.target.classList.contains("cz-down")) {
        const next = row.nextElementSibling; if (next) host.insertBefore(next, row);
      }
    };

    document.getElementById("cz-save").onclick = ()=>{
      const rows = Array.from(host.querySelectorAll(".cz-row"));
      const newOrder = rows.map(r=>r.dataset.id);
      const newHidden = rows.filter(r=>!r.querySelector(".cz-show").checked).map(r=>r.dataset.id);
      const newPinned = rows.filter(r=> r.querySelector(".cz-pin").checked).map(r=>r.dataset.id);
      localStorage.setItem(key, JSON.stringify({ order:newOrder, hidden:newHidden, pinned:newPinned }));
      alert("Saved. Reloading…"); location.reload();
    };
    document.getElementById("cz-reset").onclick = ()=>{ localStorage.removeItem(key); alert("Reset. Reloading…"); location.reload(); };
    WM.openWindow(w);
  }

  // Bug report
  function openBugReport(){
    let w = document.getElementById("win-bug");
    if (!w) {
      w = document.createElement("div");
      w.className = "window"; w.id = "win-bug"; w.dataset.title = "Bug report";
      w.style.left="160px"; w.style.top="120px"; w.style.width="520px";
      w.innerHTML = `
        <div class="titlebar"><div class="title">Bug report</div><div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div></div>
        <div class="content">
          <p>Placeholder — tell me what broke:</p>
          <textarea id="bug-text" style="width:100%;height:160px"></textarea>
          <div style="margin-top:8px;display:flex;gap:8px"><button id="bug-copy">Copy</button></div>
        </div>`;
      document.body.appendChild(w);
      WM.makeDraggable(w); WM.attachWindowControls(w);
      w.querySelector("#bug-copy").onclick = ()=>{ const t = w.querySelector("#bug-text").value; navigator.clipboard?.writeText(t); alert("Copied."); };
    }
    WM.openWindow(w);
  }

  function openCreate(){ document.dispatchEvent(new CustomEvent("auth:openCreate")); }
  function openLogin(){  document.dispatchEvent(new CustomEvent("auth:openLogin"));  }

  render();
})();
