// system/wm.v1.js
(() => {
  const zBase = 1000;
  let zCounter = zBase;
  const wins = new Map();   // id -> { win, btn, iframe, state }

  const $ = (s, r=document) => r.querySelector(s);
  const tasks = () => $('#tasks') || document.body.appendChild(Object.assign(document.createElement('div'),{id:'tasks',className:'tasks'}));

  function bringToFront(id) {
    const w = wins.get(id);
    if (!w) return;
    // deactivate all task buttons
    for (const { btn } of wins.values()) btn.classList.remove('active');
    // focus this one
    w.btn.classList.add('active');
    w.win.classList.add('active-window');
    w.win.style.zIndex = ++zCounter;
  }

  function minimize(id) {
    const w = wins.get(id);
    if (!w) return;
    w.state.minimized = true;
    w.win.style.display = 'none';
    w.btn.classList.remove('active');
  }

  function restore(id) {
    const w = wins.get(id);
    if (!w) return;
    w.state.minimized = false;
    w.win.style.display = '';           // ensure visible regardless of CSS defaults
    bringToFront(id);
  }

  function close(id) {
    const w = wins.get(id);
    if (!w) return;
    w.win.remove();
    w.btn.remove();
    wins.delete(id);
  }

  function createTaskButton(id, title, icon) {
    const b = document.createElement('button');
    b.className = 'taskbtn';
    const img = document.createElement('img');
    img.className = 'taskicon';
    img.src = icon || 'assets/favicon.png';
    const span = document.createElement('span');
    span.className = 'tasklabel';
    span.textContent = title || id;
    b.appendChild(img); b.appendChild(span);
    b.onclick = () => {
      const w = wins.get(id);
      if (!w) return;
      if (w.state.minimized) restore(id);
      else if (w.btn.classList.contains('active')) minimize(id);
      else restore(id);
    };
    tasks().appendChild(b);
    return b;
  }

  function makeDraggable(win, titlebar) {
    let sx=0, sy=0, ox=0, oy=0, dragging=false;
    titlebar.onmousedown = (e) => {
      if (e.target.closest('.controls')) return; // don't drag on controls
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const rect = win.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      win.style.left = Math.max(0, ox + dx) + 'px';
      win.style.top  = Math.max(0, oy + dy) + 'px';
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      document.body.style.userSelect = '';
    });
  }

  function createWindow({ id, title, icon, url, w=640, h=420, x=120, y=90 }) {
    const win = document.createElement('div');
    win.className = 'window active-window';
    win.style.position = 'absolute';
    win.style.left = x + 'px';
    win.style.top  = y + 'px';
    win.style.width = w + 'px';
    win.style.height = h + 'px';
    win.style.display = '';                // force visible

    const titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    const tspan = document.createElement('span');
    tspan.className = 'title';
    tspan.textContent = title || id;

    const ctrls = document.createElement('div');
    ctrls.className = 'controls';
    const btnMin = document.createElement('button');
    btnMin.setAttribute('data-min','');
    btnMin.textContent = '_';
    const btnClose = document.createElement('button');
    btnClose.setAttribute('data-close','');
    btnClose.textContent = '×';
    ctrls.appendChild(btnMin);
    ctrls.appendChild(btnClose);

    titlebar.appendChild(tspan);
    titlebar.appendChild(ctrls);

    const content = document.createElement('div');
    content.className = 'content';
    const iframe = document.createElement('iframe');
    iframe.src = url || 'about:blank';
    iframe.setAttribute('frameborder','0');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.display = 'block';
    content.appendChild(iframe);

    win.appendChild(titlebar);
    win.appendChild(content);
    document.body.appendChild(win);

    // z / focus
    win.addEventListener('mousedown', () => bringToFront(id));

    // controls
    btnMin.onclick   = () => minimize(id);
    btnClose.onclick = () => close(id);

    // dragging
    makeDraggable(win, titlebar);

    return { win, iframe };
  }

  function open(opts) {
    if (!opts || !opts.id) throw new Error('WM.open requires {id}');
    const id = opts.id;

    // Single-instance: if exists, restore + focus instead of creating another
    if (wins.has(id)) {
      restore(id);
      return wins.get(id);
    }

    const { win, iframe } = createWindow(opts);
    const btn = createTaskButton(id, opts.title || opts.id, opts.icon);
    const state = { minimized: false };
    wins.set(id, { win, btn, iframe, state, opts });

    bringToFront(id);
    return wins.get(id);
  }

  window.WM = { open, close, minimize, restore, bringToFront, get: id => wins.get(id) };
})();
