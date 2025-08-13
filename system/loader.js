// system/loader.js
(function () {
  // ---------- Helpers (global for other modules) ----------
  async function _fetchJSON(url, opts = {}) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store', ...opts });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  async function _sendJSON(url, method, data) {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: data != null ? JSON.stringify(data) : undefined
    });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  window.getJSON = (u, o) => _fetchJSON(u, o);
  window.postJSON = (u, d) => _sendJSON(u, 'POST', d);
  window.putJSON  = (u, d) => _sendJSON(u, 'PUT',  d);

  // ---------- Safe DOM roots (create if missing) ----------
  function ensureRoot(id, factory) {
    let el = document.getElementById(id);
    if (!el) { el = factory(); el.id = id; document.body.appendChild(el); }
    return el;
  }
  function roots() {
    const desktop = ensureRoot('desktop', () => {
      const d = document.createElement('div');
      d.className = 'desktop';
      return d;
    });
    const taskbar = ensureRoot('taskbar', () => {
      const t = document.createElement('div');
      t.className = 'taskbar';
      return t;
    });
    // Start button if missing (start.js will also hook it)
    if (!document.getElementById('start-button')) {
      const btn = document.createElement('button');
      btn.id = 'start-button';
      btn.className = 'start-button';
      btn.textContent = 'Start';
      taskbar.appendChild(btn);
    }
    // Start menu shell if missing
    ensureRoot('start-menu', () => {
      const m = document.createElement('div');
      m.className = 'start-menu hidden';
      return m;
    });
    // Windows layer
    ensureRoot('windows', () => {
      const w = document.createElement('div');
      w.className = 'windows-layer';
      return w;
    });
    return { desktop, taskbar };
  }

  // ---------- Minimal window open (uses WM if present) ----------
  async function openAppWindow(app) {
    const url = `/apps/${app.id}/layout.html`;
    if (window.WM && typeof window.WM.open === 'function') {
      return window.WM.open({ id: app.id, title: app.title || app.id, icon: app.icon, url });
    }
    // Fallback: very simple window
    const win = document.createElement('div');
    win.className = 'win';
    Object.assign(win.style, {
      position: 'absolute', left: (app.x||60)+'px', top: (app.y||60)+'px',
      width: (app.w||480)+'px', height: (app.h||360)+'px',
      background: '#1f1f1f', color:'#fff', border:'1px solid #444', boxShadow:'0 4px 16px rgba(0,0,0,.5)', zIndex: 1000
    });
    const bar = document.createElement('div');
    bar.textContent = app.title || app.id;
    Object.assign(bar.style, { background:'#2b2b2b', padding:'6px 8px', cursor:'move', userSelect:'none' });
    const close = document.createElement('button');
    close.textContent = '✕';
    Object.assign(close.style, { float:'right', background:'transparent', color:'#fff', border:'none', cursor:'pointer' });
    close.onclick = () => win.remove();
    bar.appendChild(close);
    const body = document.createElement('div');
    Object.assign(body.style, { width:'100%', height:'calc(100% - 32px)', background:'#fff' });
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { width:'100%', height:'100%', border:'0' });
    iframe.src = url;
    body.appendChild(iframe);
    win.appendChild(bar); win.appendChild(body);
    document.getElementById('windows').appendChild(win);
    // drag
    let sx=0, sy=0, ox=0, oy=0, dragging=false;
    bar.addEventListener('mousedown', e=>{ dragging=true; sx=e.clientX; sy=e.clientY; ox=win.offsetLeft; oy=win.offsetTop; e.preventDefault(); });
    window.addEventListener('mousemove', e=>{ if(!dragging) return; win.style.left = (ox + e.clientX - sx)+'px'; win.style.top = (oy + e.clientY - sy)+'px'; });
    window.addEventListener('mouseup', ()=> dragging=false);
  }

  // ---------- Desktop icons ----------
  function renderIcon(desktop, app) {
    const icon = document.createElement('div');
    icon.className = 'desktop-icon';
    Object.assign(icon.style, { width:'72px', margin:'12px', textAlign:'center', cursor:'pointer', userSelect:'none' });
    const img = document.createElement('img');
    img.src = app.icon || `/assets/apps/${app.id}/icon.png`;
    Object.assign(img.style, { width:'48px', height:'48px', display:'block', margin:'0 auto 6px auto' });
    const label = document.createElement('div');
    label.textContent = app.title || app.id;
    Object.assign(label.style, { fontSize:'12px', color:'#fff', textShadow:'0 1px 2px rgba(0,0,0,.8)' });
    icon.appendChild(img); icon.appendChild(label);
    icon.onclick = () => openAppWindow(app);
    desktop.appendChild(icon);
  }

  async function buildDesktop(desktop, API, me) {
    // Load app list
    let list = [];
    try { list = await getJSON('/apps/apps.json'); } catch (e) { console.warn('apps list failed', e); }
    if (!Array.isArray(list)) list = [];
    for (const id of list) {
      try {
        const meta = await getJSON(`/apps/${id}/app.json`);
        // tier check (guest/unverified/verified/closefriend/devmode)
        const need = (meta.access || 'guest');
        const have = me.tier || 'guest';
        const order = ['guest','unverified','verified','closefriend','devmode'];
        if (order.indexOf(have) < order.indexOf(need)) continue;
        const app = { id, title: meta.title || id, icon: meta.icon || `/assets/apps/${id}/icon.png`,
          x: meta.x, y: meta.y, w: meta.w, h: meta.h };
        renderIcon(desktop, app);
      } catch (e) {
        console.warn(`app ${id} failed`, e);
      }
    }
  }

  async function loadSite() {
    const { desktop } = roots();

    // Config
    let site = { apiBase: '/api', devMode: false, wallpaper: '/assets/wallpapers/frogs.jpg' };
    try { site = { ...site, ...(await getJSON('/config/site.json')) }; } catch {}
    const API = site.apiBase || '/api';
    window.API = API; window.API_BASE = API; window.siteConfig = site;

    // Wallpaper
    try {
      const wp = site.wallpaper || '/assets/wallpapers/frogs.jpg';
      Object.assign(document.body.style, {
        backgroundImage: `url('${wp}')`,
        backgroundSize: 'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat'
      });
    } catch {}

    // User
    let me = { username:null, name:'Guest', tier:'guest' };
    try { me = await getJSON(`${API}/me`); } catch {}
    window.currentUser = me;

    // Admin (non-blocking)
    if (me.tier === 'devmode') {
      getJSON(`${API}/admin/settings`).then(s => { window.siteAdmin = s; }).catch(()=>{});
    }

    // Build desktop icons
    await buildDesktop(desktop, API, me);

    // Notify
    try { window.dispatchEvent(new CustomEvent('auth:me', { detail: me })); } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSite().catch(e => console.error('loadSite fatal', e));
  });
})();
