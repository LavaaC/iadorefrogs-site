// system/chat/chat.js — GH Pages: localStorage; Pi: /api backend. Posting requires verified+.
(() => {
  const usingGitHub = location.hostname.endsWith("github.io");

  function $(sel, root=document){ return root.querySelector(sel); }
  function me(){ return window.__ME__ || null; }
  function tier(){ return (window.__USER_TIER__ || "guest").toLowerCase(); }
  function canPost(){ return ["verified","closefriend","devmode"].includes(tier()); }

  const SITE = () => window.__SITE__ || {};
  const useApi = () => !!SITE().apiBase && !usingGitHub;

  // ---- localStorage adapters (GH Pages) ----
  const ROOMS_KEY = "frogs_chat_rooms";
  const ROOM_PREFIX = "frogs_chat_room_"; // + roomId

  async function lsListRooms(){
    let rooms = JSON.parse(localStorage.getItem(ROOMS_KEY) || "[]");
    if (!rooms.includes("public")) {
      rooms.unshift("public");
      localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
      // seed welcome
      const k = ROOM_PREFIX+"public";
      if (!localStorage.getItem(k)) {
        localStorage.setItem(k, JSON.stringify([{user:"system", text:"Welcome to public chat!", ts: Date.now()}]));
      }
    }
    return rooms;
  }
  async function lsCreateRoom(name){
    const n = sanitizeRoom(name);
    if (!n) throw new Error("invalid room");
    const rooms = await lsListRooms();
    if (!rooms.includes(n)) {
      rooms.push(n);
      localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
      localStorage.setItem(ROOM_PREFIX+n, JSON.stringify([{user:"system", text:`Room '${n}' created.`, ts: Date.now()}]));
    }
    return n;
  }
  async function lsGetMsgs(room){
    return JSON.parse(localStorage.getItem(ROOM_PREFIX+room) || "[]");
  }
  async function lsPostMsg(room, msg){
    const k = ROOM_PREFIX+room;
    const arr = JSON.parse(localStorage.getItem(k) || "[]");
    arr.push(msg);
    localStorage.setItem(k, JSON.stringify(arr));
  }

  // ---- API adapters (Pi) ----
  async function apiListRooms(){
    const r = await fetch(`${SITE().apiBase}/chat/rooms`, {cache:"no-cache"});
    if (!r.ok) throw new Error("rooms "+r.status);
    return r.json();
  }
  async function apiCreateRoom(name){
    const r = await fetch(`${SITE().apiBase}/chat/rooms`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ name: sanitizeRoom(name) })
    });
    if (!r.ok) throw new Error("create "+r.status);
    return (await r.json())?.name || sanitizeRoom(name);
  }
  async function apiGetMsgs(room){
    const r = await fetch(`${SITE().apiBase}/chat/rooms/${encodeURIComponent(room)}`, {cache:"no-cache"});
    if (!r.ok) throw new Error("msgs "+r.status);
    return r.json();
  }
  async function apiPostMsg(room, msg){
    const r = await fetch(`${SITE().apiBase}/chat/rooms/${encodeURIComponent(room)}`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(msg)
    });
    if (!r.ok) throw new Error("post "+r.status);
  }

  // ---- shared helpers ----
  function sanitizeRoom(n){ return String(n||"").trim().toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,40); }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function fmt(ts){ const d = new Date(ts); return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }

  // ---- pick backend based on env ----
  const listRooms = () => useApi() ? apiListRooms() : lsListRooms();
  const createRoom = (n) => useApi() ? apiCreateRoom(n) : lsCreateRoom(n);
  const getMsgs = (r) => useApi() ? apiGetMsgs(r) : lsGetMsgs(r);
  const postMsg = (r,m) => useApi() ? apiPostMsg(r,m) : lsPostMsg(r,m);

  // ---- boot into the Chat window ----
  window.AppBoot = window.AppBoot || {};
  window.AppBoot.chat = async ({ id }) => {
    const win = document.getElementById(`win-${id}`) || document.getElementById("win-chat");
    if (!win) return;
    const scope = win; // scope queries to this window

    const roomsEl   = $("#chat-rooms", scope);
    const titleEl   = $("#chat-room-title", scope);
    const logEl     = $("#chat-log", scope);
    const txtEl     = $("#chat-text", scope);
    const sendBtn   = $("#chat-send", scope);
    const newNameEl = $("#chat-new-name", scope);
    const newBtn    = $("#chat-new-btn", scope);
    const bannerEl  = $("#chat-banner", scope);

    // banner for read-only users
    function updateBanner(){
      if (canPost()) {
        bannerEl.style.display = "none";
      } else {
        bannerEl.textContent = "Read-only. Posting requires tier: verified (or higher).";
        bannerEl.style.display = "";
      }
    }
    updateBanner();
    document.addEventListener("auth:me", updateBanner);

    let current = "public";
    let pollTimer = null;

    async function drawRooms(){
      const rooms = await listRooms();
      roomsEl.innerHTML = rooms.map(r => `<button class="room-btn ${r===current?"active":""}" data-r="${r}">${escapeHtml(r)}</button>`).join("");
      roomsEl.querySelectorAll(".room-btn").forEach(b=>{
        b.onclick = async ()=>{
          current = b.dataset.r;
          titleEl.textContent = current;
          await drawMessages();
          await drawRooms();
        };
      });
    }

    async function drawMessages(){
      const msgs = await getMsgs(current);
      logEl.innerHTML = msgs.map(m =>
        `<div class="msg"><b>${escapeHtml(m.user)}</b> <span class="ts">${fmt(m.ts)}</span><div class="body">${escapeHtml(m.text)}</div></div>`
      ).join("");
      logEl.scrollTop = logEl.scrollHeight;
    }

    async function send(){
      if (!canPost()) { alert("Posting requires verified (or higher)."); return; }
      const t = txtEl.value.trim();
      if (!t) return;
      const user = me()?.username || "guest";
      const msg = { user, text: t.slice(0,1000), ts: Date.now() };
      await postMsg(current, msg);
      txtEl.value = "";
      await drawMessages();
    }

    async function makeRoom(){
      if (!canPost()) { alert("Creating rooms requires verified (or higher)."); return; }
      const nm = newNameEl.value.trim();
      if (!nm) return;
      const n = await createRoom(nm);
      newNameEl.value = "";
      if (n) {
        current = n;
        titleEl.textContent = current;
        await drawRooms();
        await drawMessages();
      }
    }

    sendBtn.onclick = send;
    txtEl.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
    newBtn.onclick = makeRoom;

    await drawRooms();
    await drawMessages();

    // poll every 3s for updates (simple)
    pollTimer = setInterval(drawMessages, 3000);

    // stop polling if window closes
    const obs = new MutationObserver(() => {
      if (!document.body.contains(win)) {
        if (pollTimer) clearInterval(pollTimer);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList:true, subtree:true });
  };
})();
