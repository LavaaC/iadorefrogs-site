// Chat frontend (GH: localStorage; Pi: API). Access: verified+ (devmode allowed).
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const site = window.__SITE__ || {};
  const usingGitHub = location.hostname.endsWith("github.io");
  const useApi = !!site.apiBase && !usingGitHub;

  // simple env
  function me(){ return window.__ME__ || null; }
  function tier(){ return window.__USER_TIER__ || "guest"; }
  function canPost(){ const t = tier(); return ["verified","closefriend","devmode"].includes(t); }

  // storage adapters
  const LS_ROOMS_KEY = "chat_rooms";
  const LS_ROOM_PREFIX = "chat_room_"; // e.g. chat_room_public

  async function listRooms(){
    if (useApi) {
      const r = await fetch(`${site.apiBase}/chat/rooms`); if(!r.ok) throw new Error("rooms "+r.status);
      return r.json();
    } else {
      let rooms = JSON.parse(localStorage.getItem(LS_ROOMS_KEY) || "[]");
      if (!rooms.includes("public")) { rooms.unshift("public"); localStorage.setItem(LS_ROOMS_KEY, JSON.stringify(rooms)); }
      return rooms;
    }
  }
  async function createRoom(name){
    name = String(name || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    if (!name) throw new Error("invalid room");
    if (useApi) {
      const r = await fetch(`${site.apiBase}/chat/rooms`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ name }) });
      if(!r.ok) throw new Error("create "+r.status);
    } else {
      const rooms = await listRooms();
      if (!rooms.includes(name)) {
        rooms.push(name);
        localStorage.setItem(LS_ROOMS_KEY, JSON.stringify(rooms));
      }
    }
    return name;
  }
  async function getMessages(room){
    if (useApi) {
      const r = await fetch(`${site.apiBase}/chat/rooms/${encodeURIComponent(room)}`); if(!r.ok) throw new Error("msgs "+r.status);
      return r.json();
    } else {
      return JSON.parse(localStorage.getItem(LS_ROOM_PREFIX+room) || "[]");
    }
  }
  async function postMessage(room, text){
    const user = me()?.username || "guest";
    const msg = { user, text:String(text||"").slice(0,1000), ts: Date.now() };
    if (useApi) {
      const r = await fetch(`${site.apiBase}/chat/rooms/${encodeURIComponent(room)}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(msg) });
      if(!r.ok) throw new Error("post "+r.status);
      return;
    } else {
      const key = LS_ROOM_PREFIX+room;
      const arr = JSON.parse(localStorage.getItem(key) || "[]"); arr.push(msg);
      localStorage.setItem(key, JSON.stringify(arr));
    }
  }

  // bootstrap into Chat window
  window.AppBoot = window.AppBoot || {};
  window.AppBoot.chat = async () => {
    const roomsEl = $("#chat-rooms");
    const titleEl = $("#chat-room-title");
    const logEl = $("#chat-log");
    const txtEl = $("#chat-text");
    const sendBtn = $("#chat-send");
    const newNameEl = $("#chat-new-name");
    const newBtn = $("#chat-new-btn");

    let current = "public";
    async function drawRooms(){
      const rooms = await listRooms();
      roomsEl.innerHTML = rooms.map(r=> `<button class="room-btn ${r===current?"active":""}" data-r="${r}">${r}</button>`).join("");
      roomsEl.querySelectorAll(".room-btn").forEach(b=>{
        b.onclick = async ()=>{ current = b.dataset.r; titleEl.textContent = current; await drawMessages(); await drawRooms(); };
      });
    }
    function fmt(ts){ const d = new Date(ts); return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
    async function drawMessages(){
      const msgs = await getMessages(current);
      logEl.innerHTML = msgs.map(m=> `<div class="msg"><b>${m.user}</b> <span class="ts">${fmt(m.ts)}</span><div class="body">${escapeHtml(m.text)}</div></div>`).join("");
      logEl.scrollTop = logEl.scrollHeight;
    }
    function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c])); }

    sendBtn.onclick = async ()=>{
      if (!canPost()) return alert("Posting requires tier: verified");
      const t = txtEl.value.trim(); if (!t) return;
      await postMessage(current, t); txtEl.value = ""; await drawMessages();
    };
    newBtn.onclick = async ()=>{
      if (!canPost()) return alert("Creating rooms requires tier: verified");
      const nm = newNameEl.value.trim(); if (!nm) return;
      const n = await createRoom(nm); newNameEl.value=""; if (n) { current = n; titleEl.textContent = current; await drawRooms(); await drawMessages(); }
    };

    await drawRooms(); await drawMessages();
    // simple auto-refresh
    const timer = setInterval(drawMessages, 3000);
    // stop when window closes
    const win = document.getElementById("win-chat");
    const obs = new MutationObserver(()=>{ if (!document.body.contains(win)) { clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList:true, subtree:true });
  };
})();
