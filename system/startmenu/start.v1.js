// system/startmenu/start.v1.js
(() => {
  function ensureStartUI() {
    const bar = document.getElementById('taskbar') || document.body.appendChild(Object.assign(document.createElement('div'),{id:'taskbar',className:'taskbar'}));
    let btn = document.getElementById('start-button'); if(!btn){ btn=document.createElement('button'); btn.id='start-button'; btn.className='start-button'; btn.textContent='Start'; bar.appendChild(btn); }
    if(!document.querySelector('.spacer')){ bar.appendChild(Object.assign(document.createElement('div'),{className:'spacer'})); }
    if(!document.querySelector('.clock')){ bar.appendChild(Object.assign(document.createElement('div'),{className:'clock'})); }
    let menu= document.getElementById('start-menu'); if(!menu){ menu=document.createElement('div'); menu.id='start-menu'; menu.className='start-menu hidden'; document.body.appendChild(menu); }
    return {btn,menu};
  }
  function buildMenu(menu){
    const me=window.currentUser||{tier:'guest'}; menu.innerHTML='';
    const mk=(label,on)=>{ const el=document.createElement('div'); el.textContent=label; Object.assign(el.style,{padding:'8px 10px',cursor:'pointer'}); el.onmouseenter=()=>el.style.background='#333'; el.onmouseleave=()=>el.style.background='transparent'; el.onclick=on; menu.appendChild(el); };
    if(me.username){ mk(`Logged in as ${me.username}`,()=>{}); mk('Logout', async()=>{ try{ await window.auth?.logout?.(); }catch{} window.location.reload(); }); }
    else { mk('Login', async()=>{ const u=prompt('Username:'); if(!u)return; const p=prompt('Password:'); if(p==null)return; try{ await window.auth?.login?.(u,p); window.location.reload(); }catch{ alert('Login failed'); } });mk('Create Account', async () => {
        const u = prompt('Choose a username:'); 
        if (!u) return;
        const p = prompt('Choose a password:'); 
        if (p == null) return;
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            if (!res.ok) throw new Error('Register failed');
            alert('Account created successfully! Logging you in...');
            window.location.reload();
        } catch (err) {
            alert('Account creation failed.');
        }
    });
} }
    if(me.tier==='devmode'){mk('Admin: Apps & Tiers', () => { document.dispatchEvent(new Event('ui:openAdminApps')); });
mk('Admin: Users', () => { document.dispatchEvent(new Event('ui:openAdminUsers')); }); }
  }
  function wire(){
    const {btn,menu}=ensureStartUI();
    const toggle=()=>{ const h=menu.classList.contains('hidden'); if(h){ buildMenu(menu); menu.classList.remove('hidden'); } else { menu.classList.add('hidden'); } };
    btn.onclick=(e)=>{ e.stopPropagation(); toggle(); };
    document.addEventListener('click',()=> menu.classList.add('hidden'));
  }
  window.addEventListener('auth:me', wire);
  document.addEventListener('DOMContentLoaded', wire);
})();
