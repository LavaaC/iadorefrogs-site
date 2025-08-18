// system/auth/auth.v1.js
(function () {
  function api(path){ const base = window.API || '/api'; return `${base}${path}`; }
  async function login(username, password) {
    const r = await fetch(api('/login'), { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({ username, password }) });
    if (!r.ok) throw new Error('Login failed');
    const me = await r.json(); window.currentUser = me; window.dispatchEvent(new CustomEvent('auth:me',{detail:me})); return me;
  }
  async function logout() {
    await fetch(api('/logout'), { method:'POST', credentials:'include' });
    const me = { username:null, name:'Guest', tier:'guest' }; window.currentUser=me; window.dispatchEvent(new CustomEvent('auth:me',{detail:me}));
  }
  async function me() {
    const r = await fetch(api('/me'), { credentials:'include', cache:'no-store' });
    if (!r.ok) return { username:null, name:'Guest', tier:'guest' };
    const m = await r.json(); window.currentUser=m; return m;
  }
  window.auth = { login, logout, me };
})();
