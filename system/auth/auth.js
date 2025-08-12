// Auth: signup / login / logout + status (talks to /api/*)
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const status = $("#auth-status");
  async function api(path, data){
    const res = await fetch(path, {
      method: data ? "POST" : "GET",
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "same-origin"
    });
    const json = await res.json().catch(()=> ({}));
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json;
  }
  async function refreshMe(){
    try {
      const me = await api("/api/me");
      if (me.loggedIn){
        status.textContent = `Logged in as ${me.username}${me.knowAs ? " ("+me.knowAs+")" : ""}`;
        window.__USER_TIER__ = me.tier || "unverified"; // default tier if backend not set
      } else {
        status.textContent = "Guest";
        window.__USER_TIER__ = "guest";
      }
      document.dispatchEvent(new CustomEvent("auth:me", { detail: { tier: window.__USER_TIER__ } }));
    } catch {
      status.textContent = "Guest";
      window.__USER_TIER__ = "guest";
    }
  }
  // Expose helpers for Start menu
  window.AUTH = {
    me: refreshMe,
    signup: (data)=> api("/api/signup", data),
    login:  (data)=> api("/api/login",  data),
    logout: ()=> api("/api/logout", {})
  };
  // initial fetch
  refreshMe();
})();
