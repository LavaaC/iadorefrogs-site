// Loader: sets wallpaper, builds icons, enforces tier access, opens windows (GH Pages + Pi) - compat version
(() => {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var tiers = ["guest","unverified","verified","closefriend","gf"];
  function canAccess(userTier, appTier){ return tiers.indexOf(userTier) >= tiers.indexOf(appTier); }

  function getJSON(url){
    return fetch(url, { cache: "no-cache" }).then(function(r){
      if(!r.ok) throw new Error(url+" "+r.status);
      return r.json();
    });
  }
  function getText(url){
    return fetch(url, { cache: "no-cache" }).then(function(r){
      if(!r.ok) throw new Error(url+" "+r.status);
      return r.text();
    });
  }

  function resolveIcon(id, icon, title, base){
    var isImg = icon && /\.(png|jpe?g|gif|svg|webp)$/i.test(icon);
    if (!isImg) return { html: (icon || "🗂️") };
    var abs = /^(https?:)?\//.test(icon);
    var path = abs ? icon : (base + "/" + id + "/" + icon);
    return { html: '<img src="'+path+'" alt="'+title+'" class="tile-img">', path: path };
  }

  // minimal taskbar helpers (work even if WM.attachWindowControls is missing)
  function setActiveTask(win, on){
    var t = document.getElementById("task-"+win.id);
    if (t) t.classList.toggle("active", !!on);
  }
  function ensureTask(win){
    var id = "task-"+win.id;
    if (document.getElementById(id)) return;
    var b = document.createElement("button");
    b.className = "taskbtn";
    b.id = id;
    b.textContent = win.dataset.title || win.id;
    b.onclick = function(){
      var hidden = getComputedStyle(win).display === "none";
      if (hidden) openWindow(win); else minimizeWindow(win);
    };
    $("#tasks").appendChild(b);
  }
  function attachControlsFallback(w){
    var closeBtn = w.querySelector("[data-close]");
    var minBtn   = w.querySelector("[data-min]");
    if (closeBtn) closeBtn.onclick = function(e){ e.stopPropagation(); closeWindow(w); };
    if (minBtn)   minBtn.onclick   = function(e){ e.stopPropagation(); minimizeWindow(w); };
    w.addEventListener("mousedown", function(){
      if (window.WM && WM.bringToFront) { WM.bringToFront(w); }
      setActiveTask(w, true);
    });
  }
  function openWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.style.display = "block";
    if (window.WM && WM.bringToFront) WM.bringToFront(win);
    ensureTask(win);
    setActiveTask(win, true);
  }
  function minimizeWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    win.style.display = "none";
    setActiveTask(win, false);
  }
  function closeWindow(win){
    if (typeof win === "string") win = document.querySelector(win);
    if (!win) return;
    var task = document.getElementById("task-"+win.id);
    if (task) task.remove();
    win.remove();
  }

  function loadSite(){
    var site = { wallpaper: null, appsOrder: [], appsAssetsBase: "assets/apps", devTier: null };

    // 1) Config
    getJSON("config/site.json").then(function(cfg){
      Object.keys(cfg || {}).forEach(function(k){ site[k] = cfg[k]; });
    }).catch(function(){ /* keep defaults */ }).then(function(){
      if (site.wallpaper) document.body.style.backgroundImage = "url('"+site.wallpaper+"')";

      // 2) Icons grid
      var icons = document.createElement("div");
      icons.id = "icons";
      $("#desktop").appendChild(icons);

      // 3) App list
      return getJSON("apps/apps.json").then(function(list){
        var ordered = (site.appsOrder && site.appsOrder.length)
          ? site.appsOrder.filter(function(x){ return list.indexOf(x) !== -1; })
          : list.slice();

        // 4) Tier from AUTH (on Pages, auth.js sets devTier)
        var userTier = (window.__USER_TIER__ || site.devTier || "guest");
        document.addEventListener("auth:me", function(ev){
          var t = ev && ev.detail ? ev.detail.tier : null;
          userTier = t || "guest";
        });

        // 5) Build icons (sequential to keep logs tidy)
        return ordered.reduce(function(promise, id){
          return promise.then(function(){
            return getJSON("apps/"+id+"/app.json").then(function(meta){
              var access = meta.access || "guest";
              var title  = meta.title  || id;
              var iconRes = resolveIcon(id, meta.icon, title, site.appsAssetsBase);

              var ic = document.createElement("div");
              ic.className = "icon";
              ic.dataset.appId = id;
              ic.innerHTML = '<div class="tile">'+iconRes.html+'</div><div class="label">'+title+'</div>';

              if (!canAccess(userTier, access)) {
                ic.style.opacity = "0.5";
                ic.title = "Locked: requires " + access;
              }
              icons.appendChild(ic);

              ic.addEventListener("click", function(){
                var tierNow = (window.__USER_TIER__ || site.devTier || "guest");
                if (!canAccess(tierNow, access)) { alert("Access denied. Requires: " + access); return; }

                var w = document.getElementById("win-"+id);
                if (!w) {
                  w = document.createElement("div");
                  w.className = "window";
                  w.id = "win-"+id;
                  w.dataset.title = title;
                  var px = meta.pos && typeof meta.pos.x !== "undefined" ? meta.pos.x : 180;
                  var py = meta.pos && typeof meta.pos.y !== "undefined" ? meta.pos.y : 80;
                  var ww = meta.size && typeof meta.size.w !== "undefined" ? meta.size.w : 560;
                  w.style.left  = px + "px";
                  w.style.top   = py + "px";
                  w.style.width = ww + "px";
                  w.innerHTML =
                    '<div class="titlebar">' +
                      '<div class="title">'+title+'</div>' +
                      '<div class="controls">' +
                        '<div class="btn" data-min>_</div>' +
                        '<div class="btn" data-close>×</div>' +
                      '</div>' +
                    '</div>' +
                    (meta.toolbar ? ('<div class="toolbar">'+meta.toolbar+'</div>') : '') +
                    '<div class="content" id="content-'+id+'">Loading…</div>';
                  document.body.appendChild(w);

                  // Dragging
                  if (window.WM && WM.makeDraggable) WM.makeDraggable(w);
                  // Controls (works even if WM.attachWindowControls is missing)
                  if (window.WM && typeof WM.attachWindowControls === "function") {
                    WM.attachWindowControls(w);
                  } else {
                    attachControlsFallback(w);
                  }

                  // Load layout.html, fallback to layout.htm
                  getText("apps/"+id+"/layout.html").then(function(html){
                    $("#content-"+id).innerHTML = html;
                  }).catch(function(){
                    return getText("apps/"+id+"/layout.htm").then(function(html){
                      $("#content-"+id).innerHTML = html;
                    }).catch(function(){
                      $("#content-"+id).innerHTML =
                        '<div class="ph"><div><div class="ph-box"></div><div class="ph-cap">Missing layout.html/htm</div></div></div>';
                    });
                  });
                }
                openWindow(w);
              });
            }).catch(function(e){
              console.error("Failed to load app "+id+":", e.message);
            });
          });
        }, Promise.resolve());
      });
    }).catch(function(e){
      console.error("loadSite error:", e);
    });

    // 6) Clock (always init)
    function tick(){
      var d = new Date();
      var hh = String(d.getHours()).padStart(2, "0");
      var mm = String(d.getMinutes()).padStart(2, "0");
      var clk = document.getElementById("clock");
      if (clk) clk.textContent = hh+":"+mm;
    }
    tick(); setInterval(tick, 10000);
  }

  // Run
  try { loadSite(); } catch(e){ console.error(e); }
})();
