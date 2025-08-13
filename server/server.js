const express = require('express');
const session = require('express-session');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
// const cors = require('cors'); // same-origin via nginx proxy; not needed by default

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
// If you test cross-origin, you can enable carefully:
// app.use(cors({ origin: 'https://iadorefrogs.com', credentials: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'CHANGE_ME',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax', secure: false, httpOnly: true }
}));

// ----- Paths on the Pi -----
const SITE_ROOT = process.env.SITE_ROOT || '/var/www/html';
const DATA_DIR  = path.join(SITE_ROOT, 'system', 'data');
const CHAT_DIR  = path.join(SITE_ROOT, 'system', 'chat', 'rooms');
const USERS_JSON = path.join(DATA_DIR, 'users.json');
const ADMIN_JSON = path.join(DATA_DIR, 'admin.json');

const TIERS = ['guest','unverified','verified','closefriend','devmode'];
const idx = t => TIERS.indexOf(t || 'guest');
const canAccess = (userTier, reqTier) => idx(userTier) >= idx(reqTier || 'guest');

async function ensurePaths() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(CHAT_DIR, { recursive: true });
  try { await fsp.access(USERS_JSON); } catch { await fsp.writeFile(USERS_JSON, '[]'); }
  try { await fsp.access(ADMIN_JSON); } catch { await fsp.writeFile(ADMIN_JSON, JSON.stringify({order:[],hidden:[],pinned:[],perApp:{}}, null, 2)); }
}

function safeReadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJSON(file, data) {
  await fsp.writeFile(file, JSON.stringify(data, null, 2));
}

function sanitizeRoom(s) {
  return (s||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,40) || 'public';
}

function redactedUsersForList(users) {
  return users.map(u => ({ username: u.username, name: u.name || '', tier: u.tier || 'unverified' }));
}
function findUser(users, username) {
  const u = (username||'').toLowerCase();
  return users.find(x => (x.username||'').toLowerCase() === u);
}
async function checkPassword(user, plain) {
  if (!user) return false;
  if (user.passwordHash) return await bcrypt.compare(plain, user.passwordHash);
  return (user.password || '') === (plain || '');
}

app.get('/api/health', (req,res)=> res.json({ ok:true }));

app.post('/api/login', async (req,res)=>{
  await ensurePaths();
  const { username, password } = req.body || {};
  const users = safeReadJSON(USERS_JSON, []);
  const user = findUser(users, username);
  if (!user || !(await checkPassword(user, password))) return res.status(401).json({ error:'Invalid credentials' });
  req.session.user = { username: user.username, name: user.name || '', tier: user.tier || 'unverified' };
  res.json({ ok:true, me: req.session.user });
});

app.post('/api/logout', (req,res)=>{
  req.session.destroy(()=> res.json({ ok:true }));
});

app.get('/api/me', (req,res)=>{
  const me = req.session.user || { username:'', name:'', tier:'guest' };
  res.json({ me });
});

function requireDevmode(req,res,next){
  const u = req.session.user;
  if (!u || u.tier !== 'devmode') return res.status(403).json({ error:'forbidden' });
  next();
}

app.get('/api/admin/settings', requireDevmode, async (req,res)=>{
  await ensurePaths();
  const data = safeReadJSON(ADMIN_JSON, { order:[], hidden:[], pinned:[], perApp:{} });
  res.json(data);
});
app.put('/api/admin/settings', requireDevmode, async (req,res)=>{
  await ensurePaths();
  const p = req.body || {};
  const clean = {
    order: Array.isArray(p.order) ? p.order : [],
    hidden: Array.isArray(p.hidden) ? p.hidden : [],
    pinned: Array.isArray(p.pinned) ? p.pinned : [],
    perApp: typeof p.perApp === 'object' && p.perApp ? p.perApp : {}
  };
  await writeJSON(ADMIN_JSON, clean);
  res.json({ ok:true });
});

app.get('/api/admin/users', requireDevmode, async (req,res)=>{
  await ensurePaths();
  const users = safeReadJSON(USERS_JSON, []);
  res.json(redactedUsersForList(users));
});
app.put('/api/admin/users', requireDevmode, async (req,res)=>{
  await ensurePaths();
  const { updates } = req.body || {};
  if (!Array.isArray(updates)) return res.status(400).json({ error:'bad updates' });
  const users = safeReadJSON(USERS_JSON, []);
  updates.forEach(up=>{
    const u = findUser(users, up.username);
    if (u && TIERS.includes(up.tier)) u.tier = up.tier;
  });
  await writeJSON(USERS_JSON, users);
  res.json({ ok:true });
});

// optional signup (okay for testing; consider disabling later)
app.post('/api/signup', async (req,res)=>{
  await ensurePaths();
  const { username, password, name, metDate, ack } = req.body || {};
  if (!username || !password || ack !== true) return res.status(400).json({ error:'missing fields' });
  const users = safeReadJSON(USERS_JSON, []);
  if (findUser(users, username)) return res.status(409).json({ error:'exists' });
  users.push({ username, password, name: name||'', metDate: metDate||'', tier:'unverified' });
  await writeJSON(USERS_JSON, users);
  res.json({ ok:true });
});

// chat helpers
function requiredChatTier(){
  const admin = safeReadJSON(ADMIN_JSON, { perApp:{} });
  return admin?.perApp?.chat?.access || 'verified';
}
async function loadRoom(room){
  const file = path.join(CHAT_DIR, `${room}.txt`);
  try { return JSON.parse(await fsp.readFile(file, 'utf8') || '[]'); }
  catch { return []; }
}
async function saveRoom(room, arr){
  const file = path.join(CHAT_DIR, `${room}.txt`);
  await fsp.writeFile(file, JSON.stringify(arr, null, 2));
}

app.get('/api/chat/rooms', async (req,res)=>{
  await ensurePaths();
  const files = await fsp.readdir(CHAT_DIR);
  const rooms = files.filter(f=>f.endsWith('.txt')).map(f=>f.replace(/\.txt$/,''));
  res.json({ rooms });
});
app.post('/api/chat/rooms', requireDevmode, async (req,res)=>{
  await ensurePaths();
  const room = sanitizeRoom(req.body?.room);
  if (!room) return res.status(400).json({ error:'bad room' });
  const file = path.join(CHAT_DIR, `${room}.txt`);
  try { await fsp.access(file); return res.status(409).json({ error:'exists' }); }
  catch {}
  await saveRoom(room, []);
  res.json({ ok:true, room });
});

app.get('/api/chat/rooms/:room', async (req,res)=>{
  await ensurePaths();
  const room = sanitizeRoom(req.params.room);
  const msgs = await loadRoom(room);
  res.json({ room, messages: msgs });
});
app.post('/api/chat/rooms/:room', async (req,res)=>{
  await ensurePaths();
  const me = req.session.user || { tier:'guest', username:'' };
  const need = requiredChatTier();
  if (!canAccess(me.tier, need)) return res.status(403).json({ error:'tier' });
  const room = sanitizeRoom(req.params.room);
  const text = (req.body?.text || '').toString().slice(0,2000).trim();
  if (!text) return res.status(400).json({ error:'no text' });
  const msgs = await loadRoom(room);
  msgs.push({ ts: Date.now(), user: me.username || 'anon', text });
  await saveRoom(room, msgs);
  res.json({ ok:true });
});

const PORT = process.env.PORT || 3000;
ensurePaths().then(()=> app.listen(PORT, ()=> console.log('frogs-api on', PORT)));
