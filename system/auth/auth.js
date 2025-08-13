// system/auth/auth.js
(function () {
  const API = '/api';

  async function login(username, password) {
    const r = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    if (!r.ok) throw new Error('Login failed');
    const me = await r.json();
    window.currentUser = me;
    window.dispatchEvent(new CustomEvent('auth:me', { detail: me }));
    return me;
  }

  async function logout() {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    window.currentUser = { username: null, name: 'Guest', tier: 'guest' };
    window.dispatchEvent(new CustomEvent('auth:me', { detail: window.currentUser }));
  }

  async function me() {
    const r = await fetch(`${API}/me`, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) return { username: null, name: 'Guest', tier: 'guest' };
    const m = await r.json();
    window.currentUser = m;
    return m;
  }

  // No localStorage accounts; server is the source of truth.
  window.auth = { login, logout, me };
})();
