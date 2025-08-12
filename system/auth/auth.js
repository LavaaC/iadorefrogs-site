// Auth status + helpers. On GitHub Pages (no backend), uses devTier from config/site.json
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const status = $("#auth-status");

  async function getJSON(url){ const r=await fetch(url,{cache:"no-cache"}); if(!r.ok) throw new Error(url+" "+r.status); return r.json(); }

  async function api(path, data){
    const res = await fetch(path, {
      method: data ? "POST" : "GET",
      headers: data ? { "Content-Type":"application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "same-origin"
    });
    const json = await res.json().catch(()=> ({}));
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json;
  }

  async function refreshMe(){
    // If we're on GitHub Pages, there's no backend; use devTier if provided.
    const onPages = location.hostname.endsWith(".github.io");
    if (onPages) {
      try{
        const cfg = await getJSON("config/site.json");
        const simulated = cfg.devTier || "guest";
        window.__USER_TIER__ = simulated;
        status.textContent = `Guest (preview: ${simulated})`;
        document.dispatchEvent(new CustomEvent("auth:me", { detail: { tier: simulated } }));
        return;
      }catch{
        window.__USER_TIER__ = "guest";
        status.textContent = "Guest";
        document.dispatchEvent(new CustomEvent("auth:me", { detail: { tier: "guest" } }));
        return;
      }
    }

    // Real backend path
    try{
      const me = await api("/api/me");
      if (me.loggedIn){
        window.__USER_TIER__ = me.tier || "unverified";
        status.textContent = `Logged in as ${me.username}${me.knowAs ? " ("+me.knowAs+")" : ""}`;
      }else{
        window.__USER_TIER__ = "guest";
        status.textContent = "Guest";
      }
      document.dispatchEvent(new CustomEvent("auth:me", { detail: { tier: window.__USER_TIER__ } }));
    }catch{
      window.__USER_TIER__ = "guest";
      status.textContent = "Guest";
      document.dispatchEvent(new CustomEvent("auth:me", { detail: { tier: "guest" } }));
    }
  }

  window.AUTH = {
    me: refreshMe,
    signup: (data)=> api("/api/signup", data),
    login:  (data)=> api("/api/login",  data),
    logout: ()=> api("/api/logout", {})
  };

  refreshMe();
})();
