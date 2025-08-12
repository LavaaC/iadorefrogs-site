// Simple window manager: open/minimize/close + dragging + task buttons
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  let z = 10;
  const tasks = $("#tasks");

  function bringToFront(win){ win.style.zIndex = ++z; }
  function setActiveTask(win, on){
    const t = document.getElementById("task-"+win.id);
    if (t) t.classList.toggle("active", !!on);
  }

  function createTaskButton(win){
    const id = "task-"+win.id;
    if (document.getElementById(id)) return;
    const b = document.createElement("button");
    b.className = "taskbtn";
    b.id = id;
    b.textContent = win.dataset.title || win.id;
    b.onclick = () => {
      const hidden = getComputedStyle(win).display === "none";
      if (hidden) openWindow(win); else minimizeWindow(win);
    };
    tasks.appendChild(b);
  }

  function attachWindowControls(win){
    const closeBtn = win.querySelector("[data-close]");
    const minBtn   = win.querySelector("[data-min]");
    if (closeBtn) closeBtn.onclick = (e)=>{ e.stopPropagation(); closeWindow(win); };
    if (minBtn)   minBtn.onclick   = (e)=>{ e.stopPropagation(); minimizeWindow(win); };
    win.addEventListener("mousedown", ()=> { bringToFront(win); setActiveTask(win, true); });
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

  function openWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.style.display = "block";
    bringToFront(win);
    createTaskButton(win);
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
    const task = document.getElementById("task-"+win.id);
    if (task) task.remove();
    win.remove();
  }

  // expose
  window.WM = { openWindow, minimizeWindow, closeWindow, makeDraggable, bringToFront, attachWindowControls };
})();
