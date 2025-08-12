// Start menu: reliable toggle, conditional auth items, Customize & Bug report
(() => {
  const $ = (s, r=document) => r.querySelector(s);

  let menu = document.getElementById("start-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "start-menu";
    menu.className = "hidden";
    document.body.appendChild(menu);
  }

  let open = false;
  const btn = $("#btn-start");
  const state = { loggedIn: false, me: null };

  document.addEventListener("auth:me", ev => {
    state.me = ev.detail || null;
    state.loggedIn = !!state.me?.username;
    render();
  });

  function item(id, label){ return `<button data-id="${id}" class="start-item">${label}</button>`; }

  function render(){
    const items = [];
    items.push(item("create", "Create account"));
    if (state.loggedIn) items.push(item("logout", "Log out"));
    else items.push(item("login", "Log in"));
    items.push("<hr>");
    items.push(item("customize", "Customize…"));
    items.push(item("bug", "Bug report…"));
    menu.innerHTML = `<div class="start-wrap">${items.join("")}</div>`;
    wire();
  }

  function wire(){
    menu.querySelectorAll(".start-item").forEach(b=>{
      b.addEventListener("click", ()=>{
        const id = b.dataset.id;
        closeMenu();
        if (id === "create") document.dispatchEvent(new CustomEvent("auth:openCreate"));
        else if (id === "login") document.dispatchEvent(new CustomEvent("auth:openLogin"));
        else if (id === "logout") document.dispatchEvent(new CustomEvent("auth:logout"));
        else if (id === "customize") document.dispatchEvent(new CustomEvent("ui:openCustomize"));
        else if (id === "bug") document.dispatchEvent(new CustomEvent("ui:openBug"));
      });
    });
  }

  function openMenu(){
    const r = btn.getBoundingClientRect();
    // place right above Start; compute bottom to avoid CSS hardcoding
    menu.style.left = r.left + "px";
    menu.style.bottom = (window.innerHeight - r.top + 6) + "px";
    menu.classList.remove("hidden");
    open = true;
  }
  function closeMenu(){ menu.classList.add("hidden"); open = false; }
  function toggleMenu(){ open ? closeMenu() : openMenu(); }

  document.addEventListener("click", (e)=>{
    if (!open) return;
    if (e.target.closest("#start-menu") || e.target.closest("#btn-start")) return;
    closeMenu();
  });
  document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeMenu(); });
  btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggleMenu(); });

  // Reuse Customize + Bug handlers from here (in case you don't have other listeners yet)
  document.addEventListener("ui:openCustomize", ()=>{
    const ev = new Event("openCustomize"); document.dispatchEvent(ev);
  });
  document.addEventListener("ui:openBug", ()=>{
    const ev = new Event("openBug"); document.dispatchEvent(ev);
  });

  render();
})();
