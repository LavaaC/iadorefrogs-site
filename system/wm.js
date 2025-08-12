// Window manager: task buttons with icons, open/minimize/close, dragging, active highlight
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  let z = 10;
  const tasks = $("#tasks");

  function bringToFront(win){
    win.style.zIndex = ++z;
    document.querySelectorAll(".window").forEach(w => w.classList.remove("active-window"));
    win.classList.add("active-window");
    setActiveTask(win, true);
  }

  function setActiveTask(win, on){
    const t = document.getElementById("task-"+win.id);
    if (t) t.classList.toggle("active", !!on);
  }

  function createTaskButton(win){
    const id = "task-"+win.id;
    if (document.getElementById(id)) return;

    const iconSrc = win.dataset.icon || "";
    const b = document.createElement("button");
    b.className = "taskbtn";
    b.id = id;

    // Button content: small icon + title
    b.innerHTML = `
      ${iconSrc ? `<img class="taskicon" src="${iconSrc}" alt="" aria-hidden="true">` : `<span class="taskicon-fallback">🗂️</span>`}
      <span class="tasklabel">${win.dataset.title || win.id}</span>
    `;

    b.onclick = () => {
      const hidden = getComputedStyle(win).display === "none";
      if (hidden) openWindow(win); else minimizeWindow(win);
    };
    tasks.appendChild(b);
  }

  function stop(e){ e.preventDefault(); e.stopPropagation(); }

  function attachWindowControls(win){
    const closeBtn = win.querySelector("[data-close]");
    const minBtn   = win.querySelector("[data-min]");

    if (minBtn){
      ["pointerdown","mousedown"].forEach(ev => minBtn.addEventListener(ev, stop));
      minBtn.addEventListener("click", (e)=>{ stop(e); minimizeWindow(win); });
    }
    if (closeBtn){
      ["pointerdown","mousedown"].forEach(ev => closeBtn.addEventListener(ev, stop));
      closeBtn.addEventListener("click", (e)=>{ stop(e); closeWindow(win); });
    }

    win.addEventListener("mousedown", ()=> bringToFront(win));
  }

  function makeDraggable(win){
    const h = win.querySelector(".titlebar");
    if (!h) return;
    let dragging=false,sx=0,sy=0,ox=0,oy=0;

    h.addEventListener("pointerdown", e=>{
      // Don't start drag when clicking controls
      if (e.target.closest(".controls")) return;
      dragging=true; h.setPointerCapture(e.pointerId);
      const r=win.getBoundingClientRect(); sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top;
      bringToFront(win);
    });
    h.addEventListener("pointermove", e=>{
      if(!dragging) return;
      win.style.left = Math.max(0, ox+(e.clientX-sx))+"px";
      win.style.top  = Math.max(0, oy+(e.clientY-sy))+"px";
    });
    h.addEventListener("pointerup", ()=> dragging=false);
  }

  function openWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.style.display = "block";
    bringToFront(win);
    createTaskButton(win);
  }

  function minimizeWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.style.display = "none";
    win.classList.remove("active-window");
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
