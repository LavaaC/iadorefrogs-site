// Admin windows: Apps & Tiers (global), Users. Uses API on Pi, localStorage on GH.
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const tiers = ["guest","unverified","verified","closefriend","devmode"];

  async function fetchJSON(u, opt){ const r = await fetch(u, opt); if(!r.ok) throw new Error(u+" "+r.status); return r.json(); }

  const usingGitHub = location.hostname.endsWith("github.io");
  const site = window.__SITE__ || {};
  const useApi = !!site.apiBase && !usingGitHub;

  // --- Admin: Apps & Tiers ---
  async function openAdminApps(){
    let w = $("#win-admin-apps");
    if (!w) {
      w = document.createElement("div");
      w.className = "window"; w.id = "win-admin-apps"; w.dataset.title = "Admin: Apps & Tiers";
      w.style.left="100px"; w.style.top="70px"; w.style.width="720px";
      w.innerHTML = `
        <div class="titlebar"><div class="title">Admin: Apps & Tiers</div><div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div></div>
        <div class="content">
          <p>Set global order, show/hide, pin, required tier, and "Hide on no access".</p>
          <div id="aa-list"></div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button id="aa-save">Save (global)</button>
            <button id="aa-reload">Reload</button>
          </div>
        </div>`;
      document.body.appendChild(w);
      WM.makeDraggable(w); WM.attachWindowControls(w);
    }

    const apps = await fetch("apps/apps.json",{cache:"no-cache"}).then(r=>r.json());
    const metas = {};
    for (const id of apps) {
      try { metas[id] = await fetch(`apps/${id}/app.json`,{cache:"no-cache"}).then(r=>r.json()); }
      catch { metas[id] = { title:id }; }
    }
    let admin = { order:[], hidden:[], pinned:[], perApp:{} };
    try {
      admin = useApi ? await fetchJSON(`${site.apiBase}/admin/settings`) : JSON.parse(localStorage.getItem("frogs_admin")||"{}");
    } catch {}
    admin.order  = Array.isArray(admin.order)  ? admin.order  : [];
    admin.hidden = Array.isArray(admin.hidden) ? admin.hidden : [];
    admin.pinned = Array.isArray(admin.pinned) ? admin.pinned : [];
    admin.perApp = admin.perApp || {};

    const order = (admin.order.length ? admin.order.filter(x=>apps.includes(x)) : apps.slice());

    const host = $("#aa-list");
    host.innerHTML = order.map(id=>{
      const m = metas[id] || {title:id};
      const per = admin.perApp[id] || {};
      const acc = per.access || m.access || "guest";
      const hideNo = !!(per.hideIfNoAccess ?? m.hideIfNoAccess);
      const isHidden = admin.hidden.includes(id);
      const isPinned = admin.pinned.includes(id);
      return `
        <div class="aa-row" data-id="${id}" style="display:grid;grid-template-columns:64px 1fr auto auto auto auto;gap:6px;align-items:center;margin-bottom:6px">
          <div><button class="aa-up">▲</button> <button class="aa-down">▼</button></div>
          <div><b>${m.title||id}</b><div style="font-size:12px;color:#555">${id}</div></div>
          <label style="justify-self:end"><input type="checkbox" class="aa-show" ${isHidden?"":"checked"}> Show</label>
          <label><input type="checkbox" class="aa-pin" ${isPinned?"checked":""}> Pin</label>
          <label>Tier
            <select class="aa-tier">
              ${tiers.map(t=>`<option value="${t}" ${t===acc?"selected":""}>${t}</option>`).join("")}
            </select>
          </label>
          <label><input type="checkbox" class="aa-hide-no" ${hideNo?"checked":""}> Hide on no access</label>
        </div>`;
    }).join("");

    host.onclick = (e)=>{
      const row = e.target.closest(".aa-row"); if (!row) return;
      if (e.target.classList.contains("aa-up")) {
        const prev = row.previousElementSibling; if (prev) host.insertBefore(row, prev);
      } else if (e.target.classList.contains("aa-down")) {
        const next = row.nextElementSibling; if (next) host.insertBefore(next, row);
      }
    };

    $("#aa-save").onclick = async ()=>{
      const rows = Array.from(host.querySelectorAll(".aa-row"));
      const newOrder = rows.map(r=>r.dataset.id);
      const newHidden = rows.filter(r=>!r.querySelector(".aa-show").checked).map(r=>r.dataset.id);
      const newPinned = rows.filter(r=> r.querySelector(".aa-pin").checked).map(r=>r.dataset.id);
      const perApp = {};
      rows.forEach(r=>{
        const id = r.dataset.id;
        perApp[id] = {
          access: r.querySelector(".aa-tier").value,
          hideIfNoAccess: r.querySelector(".aa-hide-no").checked
        };
      });
      const payload = { order:newOrder, hidden:newHidden, pinned:newPinned, perApp };
      try {
        if (useApi) {
          const r = await fetch(`${site.apiBase}/admin/settings`, {
            method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
          });
          if(!r.ok) throw new Error("save failed");
        } else {
          localStorage.setItem("frogs_admin", JSON.stringify(payload));
        }
        alert("Saved. Reloading…"); location.reload();
      } catch(err){ alert("Save failed: "+err.message); }
    };

    $("#aa-reload").onclick = ()=> location.reload();

    WM.openWindow(w);
  }

  // --- Admin: Users (list + change tier; GH uses localStorage, Pi uses API)
  async function openAdminUsers(){
    let w = $("#win-admin-users");
    if (!w) {
      w = document.createElement("div");
      w.className = "window"; w.id = "win-admin-users"; w.dataset.title = "Admin: Users";
      w.style.left="140px"; w.style.top="90px"; w.style.width="520px";
      w.innerHTML = `
        <div class="titlebar"><div class="title">Admin: Users</div><div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div></div>
        <div class="content">
          <div id="au-list"></div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button id="au-save">Save</button>
          </div>
        </div>`;
      document.body.appendChild(w);
      WM.makeDraggable(w); WM.attachWindowControls(w);
    }

    let users = [];
    try {
      if (useApi) users = await fetchJSON(`${site.apiBase}/admin/users`);
      else users = JSON.parse(localStorage.getItem("frogs_users")||"[]");
    } catch {}

    const host = $("#au-list");
    host.innerHTML = users.map(u=>{
      const t = (u.tier || "unverified");
      return `
        <div class="au-row" data-username="${u.username}" style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;margin-bottom:6px">
          <div><b>${u.username}</b> <span style="color:#666">${u.name||""}</span></div>
          <select class="au-tier">${tiers.map(tt=>`<option value="${tt}" ${tt===t?"selected":""}>${tt}</option>`).join("")}</select>
        </div>`;
    }).join("");

    $("#au-save").onclick = async ()=>{
      const rows = Array.from(host.querySelectorAll(".au-row"));
      const updates = rows.map(r=>({ username: r.dataset.username, tier: r.querySelector(".au-tier").value }));
      try {
        if (useApi) {
          const r = await fetch(`${site.apiBase}/admin/users`, {
            method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ updates })
          });
          if(!r.ok) throw new Error("save failed");
        } else {
          const all = JSON.parse(localStorage.getItem("frogs_users")||"[]");
          updates.forEach(up=>{
            const u = all.find(x=>x.username.toLowerCase()===up.username.toLowerCase());
            if (u) u.tier = up.tier;
          });
          localStorage.setItem("frogs_users", JSON.stringify(all));
        }

        // NEW: refresh current session if changed
        const me = window.__ME__;
        if (me && me.username) {
          const meLower = me.username.toLowerCase();
          const hit = updates.find(u => u.username.toLowerCase() === meLower);
          if (hit) {
            window.__ME__ = Object.assign({}, me, { tier: hit.tier });
            window.__USER_TIER__ = hit.tier;
            document.dispatchEvent(new CustomEvent("auth:me", { detail: window.__ME__ }));
          }
        }

        alert("Saved. Reloading…");
        location.reload();
      } catch(err){ alert("Save failed: "+err.message); }
    };

    WM.openWindow(w);
  }

  document.addEventListener("ui:openAdminApps", openAdminApps);
  document.addEventListener("ui:openAdminUsers", openAdminUsers);

  // pass-through for other windows you already have
  document.addEventListener("ui:openCustomizeUser", ()=> document.dispatchEvent(new Event("ui:openCustomize")));
  document.addEventListener("ui:openBug", ()=> document.dispatchEvent(new Event("openBug")));
})();
