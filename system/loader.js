// system/loader.js
(function () {
  // ---- GLOBAL HELPERS (used by admin.js/chat.js/etc.) ----
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
  window.getJSON = (url, opts) => _fetchJSON(url, opts);
  window.postJSON = (url, data) => _sendJSON(url, 'POST', data);
  window.putJSON  = (url, data) => _sendJSON(url, 'PUT',  data);

  // ---- SAFE BOOT ----
  const guest = { username: null, name: 'Guest', tier: 'guest' };

  async function loadSite() {
    // 1) Config (fallback-safe)
    let site = { apiBase: '/api', devMode: false, wallpaper: '/assets/wallpapers/frogs.jpg' };
    try {
      const cfg = await getJSON('/config/site.json');
      site = { ...site, ...cfg };
    } catch (e) {
      console.warn('site.json load failed, using defaults', e);
    }

    const API = site.apiBase || '/api';
    window.API = API;            // legacy alias
    window.API_BASE = API;       // extra alias some code may use
    window.siteConfig = site;

    // 2) Current user (server session only)
    let me = guest;
    try { me = await getJSON(`${API}/me`); } catch (e) { console.warn('/api/me failed', e); }
    window.currentUser = me;

    // 3) Admin settings only for devs (non-blocking)
    let admin = null;
    if (me.tier === 'devmode') {
      try { admin = await getJSON(`${API}/admin/settings`); }
      catch (e) { console.warn('/api/admin/settings failed (non-blocking)', e); }
    }
    window.siteAdmin = admin;

    // 4) Wallpaper
    try {
      const wp = site.wallpaper || '/assets/wallpapers/frogs.jpg';
      Object.assign(document.body.style, {
        backgroundImage: `url('${wp}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      });
    } catch (e) { console.warn('wallpaper failed', e); }

    // 5) Notify UI
    try { window.dispatchEvent(new CustomEvent('auth:me', { detail: me })); }
    catch (e) { console.warn('auth:me dispatch failed', e); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSite().catch(err => console.error('loadSite fatal', err));
  });
})();
