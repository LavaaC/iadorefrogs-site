// Start menu at bottom-left: Create account / Log in / Log out + forms
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const startBtn = $("#btn-start");

  // Menu
  const menu = document.createElement("div");
  menu.id = "start-menu";
  menu.className = "hidden";
  menu.innerHTML = `
    <button id="menu-signup">Create account</button>
    <button id="menu-login">Log in</button>
    <button id="menu-logout">Log out</button>
  `;
  document.body.appendChild(menu);

  // Toggle
  startBtn.addEventListener("click", (e)=> { e.stopPropagation(); menu.classList.toggle("hidden"); });
  document.addEventListener("click", (e)=> { if (!menu.contains(e.target) && e.target !== startBtn) menu.classList.add("hidden"); });

  // Small helper to build windows
  function makeAuthWindow(id, title, inner){
    let w = document.getElementById(id);
    if (w) return w;
    w = document.createElement("div");
    w.className = "window"; w.id = id; w.dataset.title = title;
    w.style.cssText = "left:180px;top:100px;width:420px;display:none;";
    w.innerHTML = `
      <div class="titlebar">
        <div class="title">${title}</div>
        <div class="controls">
          <div class="btn" data-min>_</div>
          <div class="btn" data-close>×</div>
        </div>
      </div>
      <div class="content">${inner}</div>`;
    document.body.appendChild(w);
    WM.makeDraggable(w);
    WM.attachWindowControls(w);
    return w;
  }

  const signupWin = makeAuthWindow("win-signup","Create account",`
    <form id="form-signup" class="form">
      <label>Username<br><input name="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_.-]+"></label><br>
      <label>Password<br><input name="password" type="password" required minlength="8"></label><br>
      <label>Confirm Password<br><input name="confirmPassword" type="password" required minlength="8"></label><br>
      <label>Name I know you as<br><input name="knowAs" required maxlength="40"></label><br>
      <label>Date we met (mm/dd/yy)<br><input name="metDate" required pattern="(0[1-9]|1[0-2])\\/([0-2][0-9]|3[01])\\/\\d{2}"></label><br>
      <label style="display:flex;align-items:center;gap:8px;margin-top:8px;">
        <input type="checkbox" name="confirmNotReuse" required>
        <span>This is not my password for everything else because giving me that would be really dumb</span>
      </label>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button type="submit">Create account</button>
        <button type="button" id="signup-cancel">Cancel</button>
      </div>
      <div id="signup-msg" style="margin-top:8px;color:#a00;"></div>
    </form>`);

  const loginWin = makeAuthWindow("win-login","Log in",`
    <form id="form-login" class="form">
      <label>Username<br><input name="username" required></label><br>
      <label>Password<br><input name="password" type="password" required></label><br>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button type="submit">Log in</button>
        <button type="button" id="login-cancel">Cancel</button>
      </div>
      <div id="login-msg" style="margin-top:8px;color:#a00;"></div>
    </form>`);

  // menu actions
  $("#menu-signup").onclick = ()=> { WM.openWindow(signupWin); menu.classList.add("hidden"); };
  $("#menu-login").onclick  = ()=> { WM.openWindow(loginWin);  menu.classList.add("hidden"); };
  $("#menu-logout").onclick = async ()=>{
    try { await AUTH.logout(); await AUTH.me(); } catch(e){ alert(e.message); }
    menu.classList.add("hidden");
  };

  // form handlers
  $("#signup-cancel").onclick = ()=> WM.minimizeWindow(signupWin);
  $("#login-cancel").onclick  = ()=> WM.minimizeWindow(loginWin);

  $("#form-signup").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f.entries());
    data.confirmNotReuse = !!f.get("confirmNotReuse");
    const msg = $("#signup-msg"); msg.textContent = "";
    try { await AUTH.signup(data); msg.style.color="#070"; msg.textContent="Account created!"; WM.minimizeWindow(signupWin); await AUTH.me(); }
    catch(err){ msg.style.color="#a00"; msg.textContent = err.message || "Error creating account"; }
  });

  $("#form-login").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f.entries());
    const msg = $("#login-msg"); msg.textContent = "";
    try { await AUTH.login(data); msg.style.color="#070"; msg.textContent="Logged in!"; WM.minimizeWindow(loginWin); await AUTH.me(); }
    catch(err){ msg.style.color="#a00"; msg.textContent = err.message || "Login failed"; }
  });
})();
