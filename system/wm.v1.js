// system/wm.v1.js
(() => {
  let z = 1000;

  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function bringToFront(win){
    z += 1;
    win.style.zIndex = z;
    qsa('.window').forEach(w => w.classList.remove('active-window'));
    win.classList.add('active-window');
  }

  function createTaskButton(win){
    const tasks = qs('#tasks') || (() => {
      const t = document.createElement('div');
      t.id='tasks'; t.className='tasks';
      (qs('#taskbar')||document.body).appendChild(t);
      return t;
    })();

    const btn = document.createElement('button');
    btn.className = 'task';
    const ico = document.createElement('img');
    ico.className = 'task-icon';
    ico.src = win.dataset.icon || '/assets/favicon.png';
    const span = document.createElement('span');
    span.className = 'task-title';
    span.textContent = win.dataset.title || win.id || 'App';
    btn.appendChild(ico); btn.appendChild(span);

    btn.addEventListener('click', () => {
      if (win.classList.contains('minimized')) {
        win.classList.remove('minimized');
        win.style.display = '';
        bringToFront(win);
        btn.classList.add('active');
      } else if (qs('.active-window') === win) {
        // minimize if active
        win.classList.add('minimized');
        win.style.display = 'none';
        btn.classList.remove('active');
      } else {
        bringToFront(win);
        btn.classList.add('active');
      }
    });

    win._taskBtn = btn;
    tasks.appendChild(btn);
    btn.classList.add('active');
  }

  function openWindow(win){
    document.getElementById('windows')?.appendChild(win);
    createTaskButton(win);
    bringToFront(win);
  }

  function minimizeWindow(win){
    win.classList.add('minimized');
    win.style.display = 'none';
    win._taskBtn && win._taskBtn.classList.remove('active');
  }

  function closeWindow(win){
    win._taskBtn && win._taskBtn.remove();
    win.remove();
  }

  function attachWindowControls(win){
    const bar = win.querySelector('.titlebar');
    const min = win.querySelector('[data-min]');
    const cls = win.querySelector('[data-close]');

    win.addEventListener('mousedown', () => bringToFront(win));

    min && min.addEventListener('click', (e)=>{ e.stopPropagation(); minimizeWindow(win); });
    cls && cls.addEventListener('click', (e)=>{ e.stopPropagation(); closeWindow(win); });

    // Drag by titlebar
    let dragging=false, sx=0, sy=0, ox=0, oy=0;
    bar && bar.addEventListener('mousedown', (e)=>{
      dragging=true; sx=e.clientX; sy=e.clientY; ox=win.offsetLeft; oy=win.offsetTop; e.preventDefault();
      bringToFront(win);
    });
    window.addEventListener('mousemove', (e)=>{
      if(!dragging) return;
      win.style.left = (ox + e.clientX - sx) + 'px';
      win.style.top  = (oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('mouseup', ()=> dragging=false);
  }

  // New: WM.open for apps
  function open(opts) {
    const win = document.createElement('div');
    win.id = opts.id ? `win-${opts.id}` : `win-${Date.now()}`;
    win.className = 'window';
    if (opts.title) win.dataset.title = opts.title;
    if (opts.icon)  win.dataset.icon  = opts.icon;

    // Titlebar + controls
    const titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = opts.title || opts.id || '';
    const controls = document.createElement('div');
    controls.className = 'controls';
    const minBtn = document.createElement('button');
    minBtn.className = 'btn'; minBtn.setAttribute('data-min',''); minBtn.textContent = '_';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn'; closeBtn.setAttribute('data-close',''); closeBtn.textContent = '✕';
    controls.appendChild(minBtn); controls.appendChild(closeBtn);
    titlebar.appendChild(title); titlebar.appendChild(controls);

    // Content
    const content = document.createElement('div');
    content.className = 'content';
    if (opts.url) {
      const iframe = document.createElement('iframe');
      Object.assign(iframe.style, {width:'100%',height:'100%',border:'0'});
      iframe.src = opts.url;
      content.appendChild(iframe);
    }

    win.appendChild(titlebar);
    win.appendChild(content);

    // Geometry
    win.style.left = (opts.x || 60) + 'px';
    win.style.top  = (opts.y || 60) + 'px';
    if (opts.w) win.style.width  = opts.w + 'px';
    if (opts.h) win.style.height = opts.h + 'px';

    document.getElementById('windows')?.appendChild(win);
    attachWindowControls(win);
    openWindow(win);
    return win;
  }

  // Expose WM API
  window.WM = { openWindow, minimizeWindow, closeWindow, attachWindowControls, open, bringToFront };
})();
