// system/loader.js
(function () {
  // ---- GLOBAL HELPERS (so admin.js/chat.js/etc. can use them) ----
  async function _fetchJSON(url, opts = {}) {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store', ...opts })
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  }
  async function _sendJSON(url, method, data) {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: data != null ? JSON.stringify(data) : undefined
    })
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  }
  window.getJSON = (url, opts) => _fetchJSON(url, opts)
  window.postJSON = (url, data) => _sendJSON(url, 'POST', data)
  window.putJSON  = (url, data) => _sendJSON(url, 'PUT',  data)

  const guest = { username: null, name: 'Guest', tier: 'guest' }

  async function loadSite() {
    // 1) Config with safe defaults; never crash if missing
    let site = { apiBase: '/api', devMode: false, wallpaper: '/assets/wallpapers/frogs.jpg' }
    try { site = { ...site, ...(await getJSON('/config/site.json')) } } catch {}

    const API = site.apiBase || '/api'
    window.API = API
    window.API_BASE = API
    window.siteConfig = site

    // 2) Current user from server session only
    let me = guest
    try { me = await getJSON(`${API}/me`) } catch {}
    window.currentUser = me

    // 3) Devs may fetch admin settings (non-blocking)
    let admin = null
    if (me.tier === 'devmode') {
      try { admin = await getJSON(`${API}/admin/settings`) } catch {}
    }
    window.siteAdmin = admin

    // 4) Wallpaper
    try {
      const wp = site.wallpaper || '/assets/wallpapers/frogs.jpg'
      Object.assign(document.body.style, {
        backgroundImage: `url('${wp}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      })
    } catch {}

    // 5) Notify rest of UI
    try { window.dispatchEvent(new CustomEvent('auth:me', { detail: me })) } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSite().catch(err => console.error('loadSite fatal', err))
  })
})()
