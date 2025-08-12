// Start menu: reliable toggle, conditional auth items, Customize & Bug report
(() => {
  const $ = (s, r=document) => r.querySelector(s);

  // Create menu element once
  let menu = document.getElementById("start-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "start-menu";
    menu.className = "hidden";
    document.body.appendChild(menu);
  }

  let open = false;
  const btn = $("#btn-start");
  const state = { loggedIn: false, me: null };

  // Listen for auth state (auth.js should dispatch auth:me)
  document.addEventListener("auth:me", ev => {
    state.me = ev.detail || null;
    state.loggedIn = !!state.me?.username;
    render();
  });

  // Utility: build one menu button
  function item(id, label){
    return `<button data-id="${id}" class="start-item">${label}</button>`;
  }

  function render(){
    const items = [];
    items.push(item("create", "Create account"));
    if (state.loggedIn) items.push(item("logout", "Log out"));
    else items.push(item("login", "Log in"));
    items.push("<hr>");
    items.push(item("customize", "Customize…"));
    items.push(item("bug", "Bug report…"));
    menu.innerHTML = `<div class="start-wrap">${items.join("")}</div>`;
    wire();
  }

  function wire(){
    menu.querySelectorAll(".start-item").forEach(b=>{
      b.addEventListener("click", e=>{
        const id = b.dataset.id;
        closeMenu();
        if (id === "create") {
          document.dispatchEvent(new CustomEvent("auth:openCreate"));
        } else if (id === "login") {
          document.dispatchEvent(new CustomEvent("auth:openLogin"));
        } else if (id === "logout") {
          document.dispatchEvent(new CustomEvent("auth:logout"));
        } else if (id === "customize") {
          openCustomize();
        } else if (id === "bug") {
          openBugReport();
        }
      });
    });
  }

  function openMenu(){
    const r = btn.getBoundingClientRect();
    menu.style.left = (r.left) + "px";
    menu.style.bottom = (window.innerHeight - r.top + 6) + "px";
    menu.classList.remove("hidden");
    open = true;
  }
  function closeMenu(){
    menu.classList.add("hidden");
    open = false;
  }
  function toggleMenu(){
    if (open) closeMenu(); else openMenu();
  }

  // Close on outside click & Esc
  document.addEventListener("click", (e)=>{
    if (!open) return;
    if (e.target.closest("#start-menu") || e.target.closest("#btn-start")) return;
    closeMenu();
  });
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeMenu(); });
  btn.addEventListener("click", (e)=>{ e.preventDefault(); toggleMenu(); });

  // ----- Customize window -----
  async function openCustomize(){
    // Build or reuse window
    let w = document.getElementById("win-customize");
    if (!w) {
      w = document.createElement("div");
      w.className = "window";
      w.id = "win-customize";
      w.dataset.title = "Customize";
      w.style.left = "120px"; w.style.top = "80px"; w.style.width = "520px";
      w.innerHTML = `
        <div class="titlebar">
          <div class="title">Customize</div>
          <div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div>
        </div>
        <div class="content" id="content-customize">
          <p>Change app order, hide/show on desktop, and pin to Quick Launch (left of tabs).</p>
          <div id="customize-list" class="cz-list"></div>
          <div class="cz-actions">
            <button id="cz-save">Save</button>
            <button id="cz-reset">Reset to Default</button>
          </div>
        </div>`;
      document.body.appendChild(w);
      if (window.WM){ WM.makeDraggable(w); WM.attachWindowControls(w); }
    }

    // Load app list + per-user prefs
    const list = await fetch("apps/apps.json",{cache:"no-cache"}).then(r=>r.json());
    const metas = await Promise.all(list.map(id=>fetch(`apps/${id}/app.json`,{cache:"no-cache"}).then(r=>r.json()).then(m=>({id,meta:m})).catch(()=>({id,meta:{title:id}}))));
    const siteCfg = await fetch("config/site.json",{cache:"no-cache"}).then(r=>r.json()).catch(()=>({}));
    const defOrder = Array.from(new Set(siteCfg.defaultOrder && siteCfg.defaultOrder.length ? siteCfg.defaultOrder : list));
    const meName = state.me?.username || "guest";
    const key = `frogs_prefs_${meName}`;
    const prefs = JSON.parse(localStorage.getItem(key) || "{}");
    const order = (prefs.order && prefs.order.length) ? prefs.order.filter(x=>list.includes(x)) : defOrder.slice();
    const hidden = new Set(prefs.hidden || []);
    const pinned = new Set(prefs.pinned || []);

    // Render simple list with Up/Down + show + pin
    const host = document.getElementById("customize-list");
    host.innerHTML = order.map(id=>{
      const m = metas.find(x=>x.id===id)?.meta || {title:id};
      return `
        <div class="cz-row" data-id="${id}">
          <button class="cz-up">▲</button>
          <button class="cz-down">▼</button>
          <label><input type="checkbox" class="cz-show" ${hidden.has(id)? "":"checked"}> Show</label>
          <label><input type="checkbox" class="cz-pin" ${pinned.has(id)? "checked":""}> Pin</label>
          <span class="cz-title">${m.title || id}</span>
        </div>`;
    }).join("");

    // Wire up/down
    host.addEventListener("click",(e)=>{
      const row = e.target.closest(".cz-row"); if (!row) return;
      if (e.target.classList.contains("cz-up")) {
        const prev = row.previousElementSibling; if (prev) host.insertBefore(row, prev);
      } else if (e.target.classList.contains("cz-down")) {
        const next = row.nextElementSibling; if (next) host.insertBefore(next, row);
      }
    });

    // Save/Reset
    $("#cz-save").onclick = ()=>{
      const rows = Array.from(host.querySelectorAll(".cz-row"));
      const newOrder = rows.map(r=>r.dataset.id);
      const newHidden = rows.filter(r=>!r.querySelector(".cz-show").checked).map(r=>r.dataset.id);
      const newPinned = rows.filter(r=> r.querySelector(".cz-pin").checked).map(r=>r.dataset.id);
      const data = { order: newOrder, hidden: newHidden, pinned: newPinned };
      localStorage.setItem(key, JSON.stringify(data));
      alert("Saved. Reloading to apply.");
      location.reload();
    };
    $("#cz-reset").onclick = ()=>{
      localStorage.removeItem(key);
      alert("Reset. Reloading to apply.");
      location.reload();
    };

    WM.openWindow(w);
  }

  // ----- Bug report window -----
  function openBugReport(){
    let w = document.getElementById("win-bug");
    if (!w) {
      w = document.createElement("div");
      w.className = "window";
      w.id = "win-bug";
      w.dataset.title = "Bug report";
      w.style.left = "160px"; w.style.top = "120px"; w.style.width = "520px";
      w.innerHTML = `
        <div class="titlebar">
          <div class="title">Bug report</div>
          <div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div>
        </div>
        <div class="content">
          <p>Describe the issue:</p>
          <textarea id="bug-text" style="width:100%;height:160px"></textarea>
          <div style="margin-top:8px;display:flex;gap:8px">
            <button id="bug-copy">Copy</button>
            <a id="bug-mail" class="taskbtn" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px">Open email</a>
          </div>
        </div>`;
      document.body.appendChild(w);
      if (window.WM){ WM.makeDraggable(w); WM.attachWindowControls(w); }
      w.querySelector("#bug-copy").onclick = ()=>{
        const t = w.querySelector("#bug-text").value;
        navigator.clipboard?.writeText(t);
        alert("Copied.");
      };
      w.querySelector("#bug-text").addEventListener("input", e=>{
        const msg = encodeURIComponent(e.target.value || "");
        w.querySelector("#bug-mail").href = `mailto:me@example.com?subject=Bug%20report&body=${msg}`;
      });
    }
    WM.openWindow(w);
  }

  // initial draw
  render();
})();
