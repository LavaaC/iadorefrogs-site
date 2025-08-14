// system/loader.v1.js
(() => {
  async function _fetchJSON(url, opts={}) {
    const r = await fetch(url, { credentials:'include', cache:'no-store', ...opts });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  async function _sendJSON(url, method, data) {
    const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, credentials:'include', body:data!=null?JSON.stringify(data):undefined });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  window.getJSON=(u,o)=>_fetchJSON(u,o); window.postJSON=(u,d)=>_sendJSON(u,'POST',d); window.putJSON=(u,d)=>_sendJSON(u,'PUT',d);

  const guest={username:null,name:'Guest',tier:'guest'};

  function ensure(id,cls){let e=document.getElementById(id); if(!e){ e=document.createElement('div'); e.id=id; if(cls)e.className=cls; document.body.appendChild(e);} return e;}
  function ensureChrome(){
    const desktop=ensure('desktop','desktop');
    const taskbar=ensure('taskbar','taskbar');
    if(!document.getElementById('start-button')){
      const b=document.createElement('button'); b.id='start-button'; b.className='start-button'; b.textContent='Start'; taskbar.appendChild(b);
    }
    if(!document.querySelector('.spacer')){ taskbar.appendChild(Object.assign(document.createElement('div'),{className:'spacer'})); }
    if(!document.querySelector('.clock')){ taskbar.appendChild(Object.assign(document.createElement('div'),{className:'clock'})); }
    ensure('start-menu','start-menu hidden');
    ensure('windows','windows-layer');
    ensure('user-status','status-outside');
    return {desktop,taskbar};
  }
  function startClock(){
    const c=document.querySelector('.clock'); if(!c) return;
    function tick(){ c.textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
    tick(); clearInterval(startClock._t); startClock._t=setInterval(tick,1000);
  }

  async function openAppWindow(app) {
  const url = app.url || (app.path || `apps/${app.id}/layout.html`);
  const icon = app.icon || `assets/apps/${app.id}/icon.png`;
  const title = app.title || app.id;

  if (window.WM?.open) {
    window.WM.open({
      id: app.id, title, icon, url,
      w: app.w || 640, h: app.h || 420,
      x: app.x || 120, y: app.y || 90
    });
    return;
  }

  // Fallback if WM not present (should not happen)
  window.open(url, '_blank', 'noopener');
}

  function iconPath(id, icon){ if(!icon||!icon.trim()) return `assets/apps/${id}/icon.png`; if(icon.startsWith('/')||icon.startsWith('http')) return icon; return `assets/apps/${id}/${icon}`; }
  function addIcon(desktop, app) {
  const iconEl = document.createElement('div');
  iconEl.className = 'icon';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'icon-img';
  const img = document.createElement('img');
  img.className = 'desk-icon-img';
  img.src = app.icon || `assets/apps/${app.id}/icon.png`;
  imgWrap.appendChild(img);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = app.title || app.id;

  iconEl.appendChild(imgWrap);
  iconEl.appendChild(label);

  iconEl.onclick = (e) => {
    e.stopPropagation();
    openAppWindow(app);
  };

  (document.getElementById('icons') || desktop).appendChild(iconEl);
}


  async function buildDesktop(desktop, me){
    let ids=[]; try{ ids=await getJSON('apps/apps.json'); }catch(e){ console.warn('apps.json failed',e); }
    if(!Array.isArray(ids)) ids=[];
    for(const id of ids){
      try{
        const meta=await getJSON(`apps/${id}/app.json`);
        addIcon(desktop,{ id, title:meta.title||id, icon:iconPath(id,meta.icon), x:meta.x,y:meta.y,w:meta.w,h:meta.h });
      }catch(e){ console.warn(`app ${id} meta failed`,e); }
    }
  }

  function updateStatus(me){
    const el=document.getElementById('user-status');
    if(!el) return;
    const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
    if(me && (me.username || me.id)){
      const id = me.id ?? me.username;
      const status = cap(me.status ?? me.tier);
      el.textContent = status ? `${id} (${status})` : `${id}`;
    }else{
      el.textContent='Guest';
    }
  }

  const boot=async()=>{
    const {desktop}=ensureChrome();
    let site={apiBase:'/api',devMode:false,wallpaper:'assets/wallpapers/frogs.jpg'};
    try{ site={...site,...(await getJSON('config/site.json'))}; }catch{}
    const API=site.apiBase||'/api'; window.API=API; window.API_BASE=API; window.siteConfig=site;
    try{
      const wp=site.wallpaper||'assets/wallpapers/frogs.jpg';
      Object.assign(document.body.style,{backgroundImage:`url('${wp}')`,backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat'});
    }catch{}
    let me=guest; window.currentUser=me;
    try{ me=await getJSON(`${API}/me`); window.currentUser=me; }catch{}
    updateStatus(me);
    if(me.tier==='devmode'){ getJSON(`${API}/admin/settings`).then(s=>window.siteAdmin=s).catch(()=>{}); }
    await buildDesktop(desktop, me);
    startClock();
    try{ window.dispatchEvent(new CustomEvent('auth:me',{detail:me})); }catch{}
  };

  document.addEventListener('DOMContentLoaded', ()=> boot().catch(e=>console.error('loadSite fatal',e)) );
  window.addEventListener('auth:me', e=>updateStatus(e.detail||guest));
})();
