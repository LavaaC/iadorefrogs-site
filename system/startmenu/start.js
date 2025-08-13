// system/startmenu/start.js
(function () {
  function ensureStart() {
    let btn = document.getElementById('start-button');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'start-button';
      btn.className = 'start-button';
      btn.textContent = 'Start';
      const bar = document.getElementById('taskbar') || document.body.appendChild(Object.assign(document.createElement('div'), { id:'taskbar', className:'taskbar' }));
      bar.appendChild(btn);
    }
    let menu = document.getElementById('start-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'start-menu';
      menu.className = 'start-menu hidden';
      Object.assign(menu.style, { position:'absolute', left:'6px', bottom:'36px', background:'#222', color:'#fff', border:'1px solid #444', minWidth:'220px', padding:'6px', zIndex:2000 });
      document.body.appendChild(menu);
    }
    return { btn, menu };
  }

  function buildMenu(menu) {
    menu.innerHTML = '';
    const me = window.currentUser || { tier:'guest' };

    const mk = (label, onclick) => {
      const it = document.createElement('div');
      it.textContent = label;
      Object.assign(it.style, { padding:'8px 10px', cursor:'pointer' });
      it.onmouseenter = () => it.style.background = '#333';
      it.onmouseleave = () => it.style.background = 'transparent';
      it.onclick = onclick;
      menu.appendChild(it);
    };

    if (me.username) {
      mk(`Logged in as ${me.username}`, () => {});
      mk('Logout', async () => {
        try { await window.auth?.logout?.(); } catch {}
        window.location.reload();
      });
    } else {
      mk('Login', async () => {
        const u = prompt('Username:'); if (!u) return;
        const p = prompt('Password:'); if (p == null) return;
        try { await window.auth?.login?.(u, p); window.location.reload(); }
        catch { alert('Login failed'); }
      });
    }

    if (me.tier === 'devmode') {
      mk('Admin: Apps & Tiers', () => {
        // if admin app exists, open it; otherwise noop
        (window.WM?.open && window.WM.open({ id:'admin-apps', title:'Admin', url:'/apps/admin/layout.html' })) || null;
      });
      mk('Admin: Users', () => {
        (window.WM?.open && window.WM.open({ id:'admin-users', title:'Users', url:'/apps/users/layout.html' })) || null;
      });
    }
  }

  function wire() {
    const { btn, menu } = ensureStart();
    const toggle = () => {
      const isHidden = menu.classList.contains('hidden');
      if (isHidden) { buildMenu(menu); menu.classList.remove('hidden'); }
      else { menu.classList.add('hidden'); }
    };
    btn.onclick = (e) => { e.stopPropagation(); toggle(); };
    document.addEventListener('click', () => menu.classList.add('hidden'));
    // basic styles for hidden
    if (!document.getElementById('startmenu-style')) {
      const st = document.createElement('style'); st.id='startmenu-style';
      st.textContent = `.hidden{display:none} .taskbar{position:fixed;left:0;right:0;bottom:0;height:32px;background:#202020;border-top:1px solid #444;display:flex;align-items:center;gap:8px;padding:0 6px;z-index:1500} .start-button{height:24px;padding:0 10px;}`;
      document.head.appendChild(st);
    }
  }

  window.addEventListener('auth:me', wire);
  document.addEventListener('DOMContentLoaded', wire);
})();
