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
  const tiers=['guest','unverified','verified','closefriend','devmode'];
  const needOK=(have,need)=> tiers.indexOf(have)>=tiers.indexOf(need);

  function ensure(id,cls){let e=document.getElementById(id); if(!e){ e=document.createElement('div'); e.id=id; if(cls)e.className=cls; document.body.appendChild(e);} return e;}
  function ensureChrome(){
    const desktop=ensure('desktop','desktop');
    const taskbar=ensure('taskbar','taskbar');
    if(!document.getElementById('start-button')){
      const b=document.createElement('button'); b.id='start-button'; b.className='start-button'; b.textContent='Start'; taskbar.appendChild(b);
    }
    if(!document.querySelector('.spacer')){ taskbar.appendChild(Object.assign(document.createElement('div'),{className:'spacer'})); }
    if(!document.querySelector('.clock')){ taskbar.appendChild(Object.assign(document.createElement('div'),{className:'clock'})); }
    ensure('start-menu','start-menu hidden'); ensure('windows','windows-layer');
    return {desktop,taskbar};
  }
  function startClock(){
    const c=document.querySelector('.clock'); if(!c) return;
    function tick(){ c.textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
    tick(); clearInterval(startClock._t); startClock._t=setInterval(tick,1000);
  }

  async function openAppWindow(app){
    const url=`/apps/${app.id}/layout.html`;
    if (window.WM?.open) return window.WM.open({ id:app.id, title:app.title||app.id, icon:app.icon, url });
    const win=document.createElement('div');
    Object.assign(win.style,{position:'absolute',left:(app.x||60)+'px',top:(app.y||60)+'px',width:(app.w||560)+'px',height:(app.h||400)+'px',background:'#1f1f1f',color:'#fff',border:'1px solid #444',boxShadow:'0 4px 16px rgba(0,0,0,.5)',zIndex:1000});
    const bar=document.createElement('div'); bar.textContent=app.title||app.id; Object.assign(bar.style,{background:'#2b2b2b',padding:'6px 8px',cursor:'move',userSelect:'none'});
    const x=document.createElement('button'); x.textContent='✕'; Object.assign(x.style,{float:'right',background:'transparent',color:'#fff',border:'none',cursor:'pointer'}); x.onclick=()=>win.remove();
    bar.appendChild(x);
    const body=document.createElement('div'); Object.assign(body.style,{width:'100%',height:'calc(100% - 32px)',background:'#fff'});
    const iframe=document.createElement('iframe'); Object.assign(iframe.style,{width:'100%',height:'100%',border:'0'}); iframe.src=url;
    body.appendChild(iframe); win.appendChild(bar); win.appendChild(body);
    document.getElementById('windows').appendChild(win);
    let sx=0,sy=0,ox=0,oy=0,on=false;
    bar.addEventListener('mousedown',e=>{on=true;sx=e.clientX;sy=e.clientY;ox=win.offsetLeft;oy=win.offsetTop;e.preventDefault();});
    window.addEventListener('mousemove',e=>{if(!on)return;win.style.left=(ox+e.clientX-sx)+'px';win.style.top=(oy+e.clientY-sy)+'px';});
    window.addEventListener('mouseup',()=>on=false);
  }

  function iconPath(id, icon){ if(!icon||!icon.trim()) return `/assets/apps/${id}/icon.png`; if(icon.startsWith('/')||icon.startsWith('http')) return icon; return `/assets/apps/${id}/${icon}`; }
  function addIcon(desktop, app) {
    // Create icon container using existing CSS classes
    const iconEl = document.createElement('div');
    iconEl.className = 'icon';  // Windows 95 icon style container (.icon)
    
    // Create inner image wrapper and image
    const imgWrap = document.createElement('div');
    imgWrap.className = 'icon-img';  // fixed 64x64 icon frame
    const img = document.createElement('img');
    img.src = app.icon;
    img.className = 'desk-icon-img'; // actual icon image (pixelated style)
    imgWrap.appendChild(img);
    
    // Create label for the icon
    const label = document.createElement('div');
    label.className = 'label';  // Windows 95 style label (white text with shadow)
    label.textContent = app.title || app.id;
    
    // Assemble icon element
    iconEl.appendChild(imgWrap);
    iconEl.appendChild(label);
    // Single-click to open the app window
    iconEl.onclick = () => openAppWindow(app);
    
    // Append to the #icons container (or desktop as fallback)
    const container = document.getElementById('icons') || desktop;
    container.appendChild(iconEl);
}

  async function buildDesktop(desktop, me){
    let ids=[]; try{ ids=await getJSON('/apps/apps.json'); }catch(e){ console.warn('apps.json failed',e); }
    if(!Array.isArray(ids)) ids=[];
    for(const id of ids){
      try{
        const meta=await getJSON(`/apps/${id}/app.json`);
        const need=meta.access||'guest'; const have=me.tier||'guest';
        if(!needOK(have,need)) continue;
        addIcon(desktop,{ id, title:meta.title||id, icon:iconPath(id,meta.icon), x:meta.x,y:meta.y,w:meta.w,h:meta.h });
      }catch(e){ console.warn(`app ${id} meta failed`,e); }
    }
  }

  const boot=async()=>{
    const {desktop}=ensureChrome();
    let site={apiBase:'/api',devMode:false,wallpaper:'/assets/wallpapers/frogs.jpg'};
    try{ site={...site,...(await getJSON('/config/site.json'))}; }catch{}
    const API=site.apiBase||'/api'; window.API=API; window.API_BASE=API; window.siteConfig=site;
    try{
      const wp=site.wallpaper||'/assets/wallpapers/frogs.jpg';
      Object.assign(document.body.style,{backgroundImage:`url('${wp}')`,backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat'});
    }catch{}
    let me=guest; try{ me=await getJSON(`${API}/me`);}catch{} window.currentUser=me;
    if(me.tier==='devmode'){ getJSON(`${API}/admin/settings`).then(s=>window.siteAdmin=s).catch(()=>{}); }
    await buildDesktop(desktop, me);
    startClock();
    try{ window.dispatchEvent(new CustomEvent('auth:me',{detail:me})); }catch{}
  };

  document.addEventListener('DOMContentLoaded', ()=> boot().catch(e=>console.error('loadSite fatal',e)) );
})();
