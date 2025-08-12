// Simple window manager: open/minimize/close + dragging + tasks
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  let z = 10;
  const tasks = $("#tasks");

  function bringToFront(win){ win.style.zIndex = ++z; }
  function ensureTask(win){
    const id = win.id;
    if ($("#task-"+id)) return;
    const b = document.createElement("button");
    b.className = "taskbtn";
    b.id = "task-"+id;
    b.textContent = win.dataset.title || id;
    b.onclick = () => {
      if (getComputedStyle(win).display === "none") openWindow(win);
      else minimizeWindow(win);
    };
    tasks.appendChild(b);
  }
  function setActiveTask(win, on){
    const t = $("#task-"+win.id);
    if (t) t.classList.toggle("active", !!on);
  }

  function openWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.style.display = "block";
    bringToFront(win);
    ensureTask(win);
    setActiveTask(win, true);
  }
  function minimizeWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.style.display = "none";
    setActiveTask(win, false);
  }
  function closeWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.remove(); // actually remove so it doesn't pile up
    const t = $("#task-"+(win.id||""));
    if (t) t.remove();
  }

  function makeDraggable(win){
    const h = win.querySelector(".titlebar");
    if (!h) return;
    let d=false,sx=0,sy=0,ox=0,oy=0;
    h.addEventListener("pointerdown", e=>{
      d=true; h.setPointerCapture(e.pointerId);
      const r=win.getBoundingClientRect(); sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top;
    });
    h.addEventListener("pointermove", e=>{
      if(!d) return;
      win.style.left = Math.max(0, ox+(e.clientX-sx))+"px";
      win.style.top  = Math.max(0, oy+(e.clientY-sy))+"px";
    });
    h.addEventListener("pointerup", ()=> d=false);
  }

  // public API on window
  window.WM = { openWindow, minimizeWindow, closeWindow, makeDraggable, bringToFront };
})();
