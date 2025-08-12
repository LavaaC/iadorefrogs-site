// Loader: wallpaper, desktop icons (image-only), tier access, open windows (single-instance)
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
    if (!isImg) return { html: (icon || "🗂️"), path: "" };
    var abs = /^(https?:)?\//.test(icon);
    var path = abs ? icon : (base + "/" + id + "/" + icon);
    return { html: '<img src="'+path+'" alt="'+title+'" class="desk-icon-img">', path: path };
  }

  // Prevent double-create races
  var openingApps = new Set();

  function loadSite(){
    var site = { wallpaper: null, appsOrder: [], appsAssetsBase: "assets/apps", devTier: null };

    // 1) Config
    getJSON("config/site.json").then(function(cfg){
      Object.keys(cfg || {}).forEach(function(k){ site[k] = cfg[k]; });
    }).catch(function(){ /* keep defaults */ }).then(function(){
      if (site.wallpaper) document.body.style.backgroundImage = "url('"+site.wallpaper+"')";

      // 2) Desktop icon grid
      var icons = document.createElement("div");
      icons.id = "icons";
      $("#desktop").appendChild(icons);

      // 3) App list
      return getJSON("apps/apps.json").then(function(list){
        var ordered = (site.appsOrder && site.appsOrder.length)
          ? site.appsOrder.filter(function(x){ return list.indexOf(x) !== -1; })
          : list.slice();

        // 4) Tier (on Pages, auth.js may set devTier)
        var userTier = (window.__USER_TIER__ || site.devTier || "guest");
        document.addEventListener("auth:me", function(ev){
          var t = ev && ev.detail ? ev.detail.tier : null;
          userTier = t || "guest";
        });

        // 5) Build desktop icons
        return ordered.reduce(function(seq, id){
          return seq.then(function(){
            return getJSON("apps/"+id+"/app.json").then(function(meta){
              var access = meta.access || "guest";
              var title  = meta.title  || id;
              var iconRes = resolveIcon(id, meta.icon, title, site.appsAssetsBase);

              var ic = document.createElement("div");
              ic.className = "icon";
              ic.dataset.appId = id;
              ic.innerHTML = `
                <div class="icon-img">${iconRes.html || "🗂️"}</div>
                <div class="label">${title}</div>
              `;

              if (!canAccess(userTier, access)) {
                ic.style.opacity = "0.6";
                ic.title = "Locked: requires " + access;
              }
              icons.appendChild(ic);

              ic.addEventListener("click", function(){
                // Re-check access at click time
                var tierNow = (window.__USER_TIER__ || site.devTier || "guest");
                if (!canAccess(tierNow, access)) { alert("Access denied. Requires: " + access); return; }

                var wid = "win-"+id;
                var existing = document.getElementById(wid);
                if (existing){
                  // Already exists → just bring/open
                  if (window.WM) WM.openWindow(existing);
                  return;
                }
                if (openingApps.has(id)) {
                  // Creation in progress, ignore extra clicks
                  return;
                }
                openingApps.add(id);

                // Create new window
                var w = document.createElement("div");
                w.className = "window";
                w.id = wid;
                w.dataset.title = title;
                if (iconRes.path) w.dataset.icon = iconRes.path;

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

                // Dragging + controls
                if (window.WM && WM.makeDraggable) WM.makeDraggable(w);
                if (window.WM && typeof WM.attachWindowControls === "function") {
                  WM.attachWindowControls(w);
                } else {
                  const closeBtn = w.querySelector("[data-close]");
                  const minBtn = w.querySelector("[data-min]");
                  if (minBtn)  minBtn.onclick  = function(){ WM.minimizeWindow(w); };
                  if (closeBtn) closeBtn.onclick = function(){ WM.closeWindow(w); };
                }

                // Open immediately as active (lighter gray)
                if (window.WM) WM.openWindow(w);

                // Load layout.html (fallback to .htm) asynchronously
                getText("apps/"+id+"/layout.html").then(function(html){
                  $("#content-"+id).innerHTML = html;
                }).catch(function(){
                  return getText("apps/"+id+"/layout.htm").then(function(html){
                    $("#content-"+id).innerHTML = html;
                  }).catch(function(){
                    $("#content-"+id).innerHTML =
                      '<div class="ph"><div><div class="ph-box"></div><div class="ph-cap">Missing layout.html/htm</div></div></div>';
                  });
                }).finally(function(){
                  openingApps.delete(id);
                });
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

    // 6) Clock
    function tick(){
      var d = new Date();
      var hh = String(d.getHours()).padStart(2, "0");
      var mm = String(d.getMinutes()).padStart(2, "0");
      var clk = document.getElementById("clock");
      if (clk) clk.textContent = hh+":"+mm;
    }
    tick(); setInterval(tick, 10000);
  }

  try { loadSite(); } catch(e){ console.error(e); }
})();
