// system/startmenu/start.v1.js
(() => {
  const $ = (s, r=document) => r.querySelector(s);

  function ensureChrome() {
    const bar = $('#taskbar');
    const menu = $('#start-menu');
    const btn = $('#start-button');
    if (!bar || !menu || !btn) return null;
    return { bar, menu, btn };
  }

  function mkItem(menu, label, onClick) {
    const el = document.createElement('div');
    el.textContent = label;
    el.className = 'start-item';
    el.onclick = () => { try { onClick(); } finally { menu.classList.add('hidden'); } };
    menu.appendChild(el);
  }

  function buildMenu(menu) {
    menu.innerHTML = '';
    const me = window.currentUser || { tier: 'guest' };

    if (me.username) {
      mkItem(menu, `Logged in as ${me.username}${me.tier ? ' ('+me.tier+')' : ''}`, () => {});
      mkItem(menu, 'Logout', async () => {
        try { await window.auth?.logout?.(); } catch {}
        window.location.reload();
      });
    } else {
      const openAuth = (hash) => {
        const inst = window.WM?.open({
          id: 'auth',
          title: 'Account',
          icon: 'assets/apps/auth/icon.png',
          url: `apps/auth/layout.html${hash}`,
          w: 420, h: 460, x: 80, y: 80
        });
        if (inst?.iframe) inst.iframe.src = `apps/auth/layout.html${hash}`;
      };
      mkItem(menu, 'Login', () => openAuth('#login'));
      mkItem(menu, 'Create account', () => openAuth('#create'));
    }

    // Always visible utilities (open if present)
    mkItem(menu, 'Customize', () => {
      window.WM?.open({
        id: 'customize',
        title: 'Customize',
        icon: 'assets/apps/profile/icon.png',
        url: 'apps/customize/layout.html',
        w: 520, h: 420, x: 120, y: 110
      });
    });
    mkItem(menu, 'Bug Report', () => {
      window.WM?.open({
        id: 'bug',
        title: 'Bug Report',
        icon: 'assets/apps/info/icon.png',
        url: 'apps/bug/layout.html',
        w: 520, h: 420, x: 140, y: 130
      });
    });

    // Developer-only tools
    if (me.tier === 'devmode') {
      mkItem(menu, 'Admin: Apps & Tiers', () => document.dispatchEvent(new Event('ui:openAdminApps')));
      mkItem(menu, 'Admin: Users',       () => document.dispatchEvent(new Event('ui:openAdminUsers')));
      mkItem(menu, 'Dev: App Mode',      () => document.dispatchEvent(new Event('ui:openDevAppMode')));
    }
  }

  function wire() {
    const chrome = ensureChrome();
    if (!chrome) return;
    const { btn, menu } = chrome;

    const toggle = () => {
      const hidden = menu.classList.contains('hidden');
      if (hidden) { buildMenu(menu); menu.classList.remove('hidden'); }
      else menu.classList.add('hidden');
    };
    btn.onclick = (e) => { e.stopPropagation(); toggle(); };
    document.addEventListener('click', () => menu.classList.add('hidden'));
  }

  window.addEventListener('auth:me', wire);
  document.addEventListener('DOMContentLoaded', wire);
})();
