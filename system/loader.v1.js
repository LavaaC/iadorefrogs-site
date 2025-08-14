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
  const SETTINGS_KEY='desktop_settings';
  let tempSettings={};
  function loadSettings(){
    if(window.currentUser?.username){
      try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY))||{}; }catch{ return {}; }
    }
    return tempSettings;
  }
  function saveSettings(s){
    if(window.currentUser?.username){
      try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }catch{}
    }else{
      tempSettings=s;
    }
  }

  function ensure(id,cls){let e=document.getElementById(id); if(!e){ e=document.createElement('div'); e.id=id; if(cls)e.className=cls; document.body.appendChild(e);} return e;}
  function ensureChrome(){
    const desktop=ensure('desktop','desktop');
    const taskbar=ensure('taskbar','taskbar');
    if(!document.getElementById('start-button')){
      const b=document.createElement('button'); b.id='start-button'; b.className='start-button'; b.textContent='Start'; taskbar.appendChild(b);
    }
    if(!document.getElementById('quick-launch')){
      const q=document.createElement('div'); q.id='quick-launch'; q.className='quick';
      const tasks=document.getElementById('tasks');
      taskbar.insertBefore(q, tasks);
    }
    if(!document.querySelector('.spacer')){ taskbar.appendChild(Object.assign(document.createElement('div'),{className:'spacer'})); }
    if(!document.querySelector('.clock')){ taskbar.appendChild(Object.assign(document.createElement('div'),{className:'clock'})); }
    ensure('start-menu','start-menu hidden');
    ensure('windows','windows-layer');
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

  function addQuickIcon(quick, app){
    if(!quick) return;
    const btn=document.createElement('button');
    btn.className='ql';
    btn.dataset.id=app.id;
    const img=document.createElement('img');
    img.className='ql-img';
    img.src=app.icon || `assets/apps/${app.id}/icon.png`;
    btn.appendChild(img);
    btn.onclick=(e)=>{ e.stopPropagation(); openAppWindow(app); };
    quick.appendChild(btn);
  }

  function addIcon(desktop, app){
    const iconEl = document.createElement('div');
    iconEl.className = 'icon';
    iconEl.dataset.id = app.id;
    iconEl.style.left = (app.x||20)+'px';
    iconEl.style.top  = (app.y||20)+'px';

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

    let drag=false,sx=0,sy=0,ox=0,oy=0;
    iconEl.addEventListener('mousedown',e=>{
      if(e.button!==0) return;
      drag=true; sx=e.clientX; sy=e.clientY;
      const r=iconEl.getBoundingClientRect();
      ox=r.left; oy=r.top; document.body.style.userSelect='none';
      e.preventDefault();
    });
    window.addEventListener('mousemove',e=>{
      if(!drag) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      iconEl.style.left=(ox+dx)+'px';
      iconEl.style.top =(oy+dy)+'px';
    });
    window.addEventListener('mouseup',()=>{
      if(!drag) return;
      drag=false; document.body.style.userSelect='';
      const s=loadSettings();
      s[app.id]=s[app.id]||{};
      s[app.id].x=parseInt(iconEl.style.left)||0;
      s[app.id].y=parseInt(iconEl.style.top)||0;
      saveSettings(s);
    });

    (document.getElementById('icons') || desktop).appendChild(iconEl);
  }


  async function buildDesktop(desktop, me){
    const quick=document.getElementById('quick-launch');
    if(quick) quick.innerHTML='';
    const settings=loadSettings();
    let ids=[]; try{ ids=await getJSON('apps/apps.json'); }catch(e){ console.warn('apps.json failed',e); }
    if(!Array.isArray(ids)) ids=[];

    const pinned=[];

    let idx=0;
    for(const id of ids){
      try{
        const meta=await getJSON(`apps/${id}/app.json`);
        const s=settings[id]||{};
        if(s.show===false) continue;
        const posX = s.x ?? meta.x ?? (20 + (idx%5)*110);
        const posY = s.y ?? meta.y ?? (20 + Math.floor(idx/5)*110);
        addIcon(desktop,{ id, title:meta.title||id, icon:iconPath(id,meta.icon), x:posX, y:posY, w:meta.w, h:meta.h });

        if(s.pinned) pinned.push({id,meta});

        if(!settings[id]) settings[id]={};
        if(settings[id].show===undefined) settings[id].show=true;
        if(settings[id].x===undefined) settings[id].x=posX;
        if(settings[id].y===undefined) settings[id].y=posY;
        idx++;
      }catch(e){ console.warn(`app ${id} meta failed`,e); }
    }

    const order=settings.pinnedOrder||[];
    pinned.sort((a,b)=>{
      const ai=order.indexOf(a.id); const bi=order.indexOf(b.id);
      return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);
    });
    for(const p of pinned){
      addQuickIcon(quick,{ id:p.id, title:p.meta.title||p.id, icon:iconPath(p.id,p.meta.icon), w:p.meta.w, h:p.meta.h });
    }

    saveSettings(settings);
  }

  window.refreshDesktop=async function(){
    const {desktop}=ensureChrome();
    if(desktop) desktop.innerHTML='<div id="icons"></div>';
    await buildDesktop(desktop, window.currentUser||guest);
  };

  window.applyDesktopSettings=async function(){
    const {desktop}=ensureChrome();
    const quick=document.getElementById('quick-launch');
    const settings=loadSettings();
    let ids=[]; try{ ids=await getJSON('apps/apps.json'); }catch{}
    if(!Array.isArray(ids)) ids=[];
    for(const id of ids){
      let meta=null;
      try{ meta=await getJSON(`apps/${id}/app.json`); }catch{}
      const s=settings[id]||{};
      const iconEl=desktop.querySelector(`.icon[data-id="${id}"]`);
      if(s.show===false){ if(iconEl) iconEl.remove(); }
      else if(iconEl){
        if(s.x!=null) iconEl.style.left=s.x+'px';
        if(s.y!=null) iconEl.style.top=s.y+'px';
      }else if(meta){
        addIcon(desktop,{ id, title:meta.title||id, icon:iconPath(id,meta.icon), x:s.x??meta.x, y:s.y??meta.y, w:meta.w, h:meta.h });
      }
      const ql=quick?.querySelector(`button[data-id="${id}"]`);
      if(s.pinned){
        if(!ql && meta) addQuickIcon(quick,{ id, title:meta.title||id, icon:iconPath(id,meta.icon), w:meta.w, h:meta.h });
      }else if(ql){ ql.remove(); }
    }
    const order=settings.pinnedOrder||[];
    if(quick){
      Array.from(quick.children)
        .sort((a,b)=>order.indexOf(a.dataset.id)-order.indexOf(b.dataset.id))
        .forEach(el=>quick.appendChild(el));
    }
  };

  function updateStatus(me){
    // status display removed
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
