// system/startmenu/start.v1.js
(() => {
  function ensureStartUI() {
    const bar = document.getElementById('taskbar') || document.body.appendChild(Object.assign(document.createElement('div'),{id:'taskbar',className:'taskbar'}));
    let btn = document.getElementById('start-button'); if(!btn){ btn=document.createElement('button'); btn.id='start-button'; btn.className='start'; btn.textContent='Start'; bar.appendChild(btn); }
    if(!document.querySelector('.spacer')){ bar.appendChild(Object.assign(document.createElement('div'),{className:'spacer'})); }
    if(!document.querySelector('.clock')){ bar.appendChild(Object.assign(document.createElement('div'),{className:'clock'})); }
    let menu= document.getElementById('start-menu'); if(!menu){ menu=document.createElement('div'); menu.id='start-menu'; menu.className='start-menu hidden'; document.body.appendChild(menu); }
    return {btn,menu};
  }

  function buildMenu(menu){
    const me = window.currentUser || { tier:'guest' };
    menu.innerHTML = '';

    const mk = (label, on) => {
      const el = document.createElement('div');
      el.textContent = label;
      el.style.padding = '6px 8px';
      el.style.cursor = 'pointer';
      el.onclick = () => { on(); menu.classList.add('hidden'); };
      menu.appendChild(el);
    };

    if (me.username) {
      mk(`Logged in as ${me.username}`, ()=>{});
      mk('Logout', async ()=>{
        try { await window.auth?.logout?.(); } catch {}
        window.location.reload();
      });
    } else {
      // Open Auth window instead of prompt popups
      mk('Login / Create account', ()=>{
        if (window.WM?.open) {
          window.WM.open({
            id: 'auth',
            title: 'Account',
            icon: '/assets/apps/auth/icon.png',
            url: '/apps/auth/layout.html',
            w: 420, h: 360, x: 80, y: 80
          });
        } else {
          // fallback (shouldn't happen in your stack)
          alert('Window manager not ready.');
        }
      });
    }

    // Developer tools (unchanged)
    if (me.tier === 'devmode') {
      mk('Admin: Apps & Tiers', () => { document.dispatchEvent(new Event('ui:openAdminApps')); });
      mk('Admin: Users',       () => { document.dispatchEvent(new Event('ui:openAdminUsers')); });
    }
  }

  function wire(){
    const {btn,menu} = ensureStartUI();
    const toggle = ()=> {
      const hidden = menu.classList.contains('hidden');
      if (hidden) { buildMenu(menu); menu.classList.remove('hidden'); }
      else { menu.classList.add('hidden'); }
    };
    btn.onclick = (e)=>{ e.stopPropagation(); toggle(); };
    document.addEventListener('click', ()=> menu.classList.add('hidden'));
  }

  window.addEventListener('auth:me', wire);
  document.addEventListener('DOMContentLoaded', wire);
})();
