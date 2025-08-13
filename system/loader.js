// system/loader.v1.js
(function () {
  // ---------- HTTP helpers (global) ----------
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

  // ---------- DOM roots (create if missing) ----------
  function ensure(id, klass) {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; if (klass) el.className = klass; document.body.appendChild(el); }
    return el;
  }
  function ensureChrome() {
    const desktop = ensure('desktop', 'desktop');
    const taskbar = ensure('taskbar', 'taskbar');
    if (!document.getElementById('start-button')) {
      const btn = document.createElement('button'); btn.id='start-button'; btn.className='start-button'; btn.textContent='Start'; taskbar.appendChild(btn);
    }
    ensure('start-menu', 'start-menu hidden');
    ensure('windows', 'windows-layer');
    return { desktop, taskbar };
  }

  // ---------- Windows (fallback if WM not present) ----------
  async function openAppWindow(app) {
    const url = `/apps/${app.id}/layout.html`;
    if (window.WM?.open) return window.WM.open({ id: app.id, title: app.title||app.id, icon: app.icon, url });
    const win = document.createElement('div');
    Object.assign(win.style,{position:'absolute',left:(app.x||60)+'px',top:(app.y||60)+'px',width:(app.w||520)+'px',height:(app.h||380)+'px',background:'#1f1f1f',color:'#fff',border:'1px solid #444',boxShadow:'0 4px 16px rgba(0,0,0,.5)',zIndex:1000});
    const bar = document.createElement('div'); bar.textContent=app.title||app.id; Object.assign(bar.style,{background:'#2b2b2b',padding:'6px 8px',cursor:'move',userSelect:'none'});
    const close = document.createElement('button'); close.textContent='✕'; Object.assign(close.style,{float:'right',background:'transparent',color:'#fff',border:'none',cursor:'pointer'}); close.onclick=()=>win.remove();
    bar.appendChild(close);
    const body = document.createElement('div'); Object.assign(body.style,{width:'100%',height:'calc(100% - 32px)',background:'#fff'});
    const iframe = document.createElement('iframe'); Object.assign(iframe.style,{width:'100%',height:'100%',border:'0'}); iframe.src=url;
    body.appendChild(iframe); win.appendChild(bar); win.appendChild(body);
    document.getElementById('windows').appendChild(win);
    // simple drag
    let sx=0, sy=0, ox=0, oy=0, on=false;
    bar.addEventListener('mousedown',e=>{on=true;sx=e.clientX;sy=e.clientY;ox=win.offsetLeft;oy=win.offsetTop;e.preventDefault();});
    window.addEventListener('mousemove',e=>{if(!on)return;win.style.left=(ox+e.clientX-sx)+'px';win.style.top=(oy+e.clientY-sy)+'px';});
    window.addEventListener('mouseup',()=>on=false);
  }

  // ---------- Icons ----------
  function resolveIconPath(id, icon) {
    if (!icon || !icon.trim()) return `/assets/apps/${id}/icon.png`;
    if (icon.startsWith('/') || icon.startsWith('http')) return icon;
    return `/assets/apps/${id}/${icon}`;
  }
  function renderIcon(desktop, app) {
    const icon = document.createElement('div'); icon.className='desktop-icon';
    const img = document.createElement('img'); img.src = app.icon;
    const label = document.createElement('div'); label.textContent = app.title || app.id;
    icon.appendChild(img); icon.appendChild(label);
    icon.onclick = () => openAppWindow(app);
    desktop.appendChild(icon);
  }

  async function buildDesktop(desktop, me) {
    let list = [];
    try { list = await getJSON('/apps/apps.json'); } catch (e) { console.warn('apps.json failed', e); }
    if (!Array.isArray(list)) list = [];
    const order = ['guest','unverified','verified','closefriend','devmode'];
    for (const id of list) {
      try {
        const meta = await getJSON(`/apps/${id}/app.json`);
        const need = meta.access || 'guest';
        const have = me.tier || 'guest';
        if (order.indexOf(have) < order.indexOf(need)) continue;
        renderIcon(desktop, {
          id,
          title: meta.title || id,
          icon: resolveIconPath(id, meta.icon),
          x: meta.x, y: meta.y, w: meta.w, h: meta.h
        });
      } catch (e) {
        console.warn(`app ${id} meta failed`, e);
      }
    }
  }

  // ---------- Boot ----------
  const guest = { username:null, name:'Guest', tier:'guest' };
  async function loadSite() {
    const { desktop } = ensureChrome();

    let site = { apiBase:'/api', devMode:false, wallpaper:'/assets/wallpapers/frogs.jpg' };
    try { site = { ...site, ...(await getJSON('/config/site.json')) }; } catch {}
    const API = site.apiBase || '/api';
    window.API = API; window.API_BASE = API; window.siteConfig = site;

    // wallpaper
    try {
      const wp = site.wallpaper || '/assets/wallpapers/frogs.jpg';
      Object.assign(document.body.style,{backgroundImage:`url('${wp}')`,backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat'});
    } catch {}

    // user + admin (non-blocking)
    let me = guest;
    try { me = await getJSON(`${API}/me`); } catch {}
    window.currentUser = me;
    if (me.tier === 'devmode') getJSON(`${API}/admin/settings`).then(s=>window.siteAdmin=s).catch(()=>{});

    // icons
    await buildDesktop(desktop, me);

    // notify
    try { window.dispatchEvent(new CustomEvent('auth:me', { detail: me })); } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSite().catch(e => console.error('loadSite fatal', e));
  });
})();
