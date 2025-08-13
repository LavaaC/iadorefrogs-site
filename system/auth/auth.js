// Auth UI (dev preview): create/login/logout, dispatches auth:me; stores in localStorage
(() => {
  const $ = (s, r=document) => r.querySelector(s);

  const USERS_KEY = "frogs_users";
  const ME_KEY    = "frogs_me";

  function loadUsers(){ try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; } }
  function saveUsers(arr){ localStorage.setItem(USERS_KEY, JSON.stringify(arr)); }
  function setMe(me){
    localStorage.setItem(ME_KEY, JSON.stringify(me||null));
    window.__ME__ = me||null;
    window.__USER_TIER__ = me?.tier || "guest";
    document.dispatchEvent(new CustomEvent("auth:me",{detail: me||{tier:"guest"}}));
  }

  try{ const me = JSON.parse(localStorage.getItem(ME_KEY)||"null"); if (me) setTimeout(()=> setMe(me), 0); } catch {}

  function updateStatus(){
    const el = $("#auth-status");
    const me = window.__ME__;
    el.textContent = me?.username ? `${me.username} (${me.tier||"unverified"})` : "Guest";
  }
  document.addEventListener("auth:me", updateStatus);
  updateStatus();

  function openCreate(){
    let w = $("#win-auth-create");
    if (!w){
      w = document.createElement("div");
      w.className = "window"; w.id = "win-auth-create"; w.dataset.title = "Create account";
      w.style.left="140px"; w.style.top="90px"; w.style.width="520px";
      w.innerHTML = `
        <div class="titlebar"><div class="title">Create account</div><div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div></div>
        <div class="content">
          <label>Username <input id="ca-user"></label><br>
          <label>Password <input id="ca-pass" type="password"></label><br>
          <label>Confirm Password <input id="ca-pass2" type="password"></label><br>
          <label>Name I know you as <input id="ca-name"></label><br>
          <label>Birthday (mm/dd) <input id="ca-met" placeholder="mm/dd"></label><br>
          <label><input id="ca-check" type="checkbox"> This is not (your) password for everything else because giving me that would be really dumb</label><br>
          <button id="ca-submit">Create</button>
        </div>`;
      document.body.appendChild(w);
      WM.makeDraggable(w); WM.attachWindowControls(w);
      w.querySelector("#ca-submit").onclick = ()=>{
        const u = w.querySelector("#ca-user").value.trim();
        const p = w.querySelector("#ca-pass").value;
        const p2= w.querySelector("#ca-pass2").value;
        const nm= w.querySelector("#ca-name").value.trim();
        const mt= w.querySelector("#ca-met").value.trim();
        const ok= w.querySelector("#ca-check").checked;
        if (!u || !p) return alert("Username and password required.");
        if (p !== p2) return alert("Passwords do not match.");
        if (!ok) return alert("Please confirm the checkbox.");
        const users = loadUsers();
        if (users.find(x=>x.username.toLowerCase()===u.toLowerCase())) return alert("Username already exists.");
        users.push({username:u, pass:p, name:nm, met:mt, tier:"unverified"});
        saveUsers(users);
        setMe({username:u, tier:"unverified"});
        WM.closeWindow(w);
      };
    }
    WM.openWindow(w);
  }

  function openLogin(){
    let w = $("#win-auth-login");
    if (!w){
      w = document.createElement("div");
      w.className = "window"; w.id = "win-auth-login"; w.dataset.title = "Log in";
      w.style.left="180px"; w.style.top="120px"; w.style.width="420px";
      w.innerHTML = `
        <div class="titlebar"><div class="title">Log in</div><div class="controls"><div class="btn" data-min>_</div><div class="btn" data-close>×</div></div></div>
        <div class="content">
          <label>Username <input id="li-user"></label><br>
          <label>Password <input id="li-pass" type="password"></label><br>
          <button id="li-submit">Log in</button>
        </div>`;
      document.body.appendChild(w);
      WM.makeDraggable(w); WM.attachWindowControls(w);
      w.querySelector("#li-submit").onclick = ()=>{
        const u = w.querySelector("#li-user").value.trim();
        const p = w.querySelector("#li-pass").value;
        const user = loadUsers().find(x=>x.username.toLowerCase()===u.toLowerCase() && x.pass===p);
        if (!user) return alert("Invalid credentials.");
        setMe({username:user.username, tier:user.tier||"unverified"});
        WM.closeWindow(w);
      };
    }
    WM.openWindow(w);
  }

  document.addEventListener("auth:openCreate", openCreate);
  document.addEventListener("auth:openLogin",  openLogin);
  document.addEventListener("auth:logout", ()=> setMe(null));
})();
