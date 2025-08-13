// system/startmenu/start.v1.js
(function () {
  function ensureStartUI() {
    const bar = document.getElementById('taskbar') || document.body.appendChild(Object.assign(document.createElement('div'),{id:'taskbar',className:'taskbar'}));
    let btn = document.getElementById('start-button'); if(!btn){ btn=document.createElement('button'); btn.id='start-button'; btn.className='start-button'; btn.textContent='Start'; bar.appendChild(btn); }
    let menu= document.getElementById('start-menu'); if(!menu){ menu=document.createElement('div'); menu.id='start-menu'; menu.className='start-menu hidden'; Object.assign(menu.style,{position:'absolute',left:'6px',bottom:'36px',background:'#222',color:'#fff',border:'1px solid #444',minWidth:'220px',padding:'6px',zIndex:2000}); document.body.appendChild(menu); }
    return {btn,menu};
  }
  function buildMenu(menu){
    const me=window.currentUser||{tier:'guest'}; menu.innerHTML='';
    const mk=(label,on)=>{ const el=document.createElement('div'); el.textContent=label; Object.assign(el.style,{padding:'8px 10px',cursor:'pointer'}); el.onmouseenter=()=>el.style.background='#333'; el.onmouseleave=()=>el.style.background='transparent'; el.onclick=on; menu.appendChild(el); };
    if(me.username){ mk(`Logged in as ${me.username}`,()=>{}); mk('Logout', async()=>{ try{ await window.auth?.logout?.(); }catch{} window.location.reload(); }); }
    else { mk('Login', async()=>{ const u=prompt('Username:'); if(!u)return; const p=prompt('Password:'); if(p==null)return; try{ await window.auth?.login?.(u,p); window.location.reload(); }catch{ alert('Login failed'); } }); }
    if(me.tier==='devmode'){ mk('Admin: Apps & Tiers',()=> (window.WM?.open && window.WM.open({id:'admin-apps',title:'Admin',url:'/apps/admin/layout.html'}))||null);
                              mk('Admin: Users',      ()=> (window.WM?.open && window.WM.open({id:'admin-users',title:'Users',url:'/apps/users/layout.html'}))||null); }
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
