(async () => {
  // small helper
  const getJSON = async (url, opts = {}) => {
    const r = await fetch(url, { credentials: 'include', ...opts });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  };

  // 1) load site config
  let site = { apiBase: '/api', devMode: false };
  try { site = await getJSON('/config/site.json'); } catch {}

  const API = site.apiBase || '/api';

  // 2) find current user (never from localStorage)
  let me = { username: null, tier: 'guest', name: 'Guest' };
  try { me = await getJSON(`${API}/me`); } catch {}

  // 3) only devs may read admin settings; on any error, just continue
  let admin = null;
  if (me.tier === 'devmode') {
    try { admin = await getJSON(`${API}/admin/settings`); } catch {}
  }

  // 4) continue boot regardless of admin fetch result
  // TODO: initialize desktop, apps, wallpaper using `admin` if present, else defaults
  window.dispatchEvent(new CustomEvent('auth:me', { detail: me }));
  // ... your existing desktop boot here ...
})();
