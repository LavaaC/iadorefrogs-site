// server/server.js
const express = require('express');
const session = require('express-session');
const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');

const SITE_ROOT = process.env.SITE_ROOT || '/var/www/html';
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret';
const NODE_ENV = process.env.NODE_ENV || 'production';
// Use secure cookies only when running in production unless explicitly overridden
const COOKIE_SECURE = (process.env.SESSION_SECURE || NODE_ENV === 'production').toString().toLowerCase() !== 'false';

const DATA_DIR = path.join(SITE_ROOT, 'system', 'data');
const CHAT_DIR = path.join(SITE_ROOT, 'system', 'chat', 'rooms');
const USERS_JSON = path.join(DATA_DIR, 'users.json');
const ADMIN_JSON = path.join(DATA_DIR, 'admin.json');
const NEW_USERS_LOG = path.join(DATA_DIR, 'new-users.log');
const USER_SETTINGS_DIR = path.join(DATA_DIR, 'user-settings');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  name: 'frogs.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: COOKIE_SECURE }
}));

// ---------- utils ----------
const ensureDir = async (p) => { if (!fssync.existsSync(p)) await fs.mkdir(p, { recursive: true }); };
const readJson = async (p, fallback) => {
  try { return JSON.parse(await fs.readFile(p, 'utf8') || ''); }
  catch { return fallback; }
};
const writeJson = async (p, obj) => {
  await ensureDir(path.dirname(p));
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
  await fs.rename(tmp, p);
};
const sanitizeRoom = require('./utils/sanitizeRoom');
const isDev = (req) => req.session?.user?.tier === 'devmode';
const isLogged = (req) => !!req.session?.user;

// ---------- bootstrap minimal storage ----------
(async () => {
  await ensureDir(DATA_DIR);
  await ensureDir(CHAT_DIR);
  await ensureDir(USER_SETTINGS_DIR);
  if (!fssync.existsSync(USERS_JSON)) {
    await writeJson(USERS_JSON, [
      { username: 'Agu', password: 'CHANGE_ME', name: 'Agu', tier: 'devmode' }
    ]);
  }
  if (!fssync.existsSync(ADMIN_JSON)) {
    await writeJson(ADMIN_JSON, { order: [], hidden: [], pinned: [], perApp: {} });
  }
  if (!fssync.existsSync(path.join(CHAT_DIR, 'public.txt'))) {
    await writeJson(path.join(CHAT_DIR, 'public.txt'), []);
  }
})().catch(console.error);

// ---------- health/debug ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/whereami', (_req, res) => {
  res.json({ siteRoot: SITE_ROOT, nodeEnv: NODE_ENV, port: PORT, dataDir: DATA_DIR, chatDir: CHAT_DIR });
});

// ---------- auth ----------
let bcrypt = null;
try { bcrypt = require('bcryptjs'); } catch { /* optional */ }

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing-credentials' });
  const users = await readJson(USERS_JSON, []);
  const u = users.find(x => x.username === username);
  if (!u) return res.status(401).json({ error: 'invalid-credentials' });

  if (u.passwordHash && bcrypt) {
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid-credentials' });
  } else if (u.password) {
    if (password !== u.password) return res.status(401).json({ error: 'invalid-credentials' });
  } else {
    return res.status(500).json({ error: 'no-password-on-record' });
  }

  req.session.user = { username: u.username, name: u.name || u.username, tier: u.tier || 'guest' };
  res.json(req.session.user);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'missing-fields' });
    }
    const users = await readJson(USERS_JSON, []);
    // Check if username already exists (case-sensitive match)
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ error: 'username-taken' });
    }
    // Create new user object
    const newUser = { username, name: username, tier: 'unverified' };
    if (bcrypt) {
        newUser.passwordHash = await bcrypt.hash(password, 10);
    } else {
        newUser.password = password;
    }
    users.push(newUser);
    await writeJson(USERS_JSON, users);
    // Append basic details to an external log
    try {
        await fs.appendFile(NEW_USERS_LOG, JSON.stringify({
            username: newUser.username,
            tier: newUser.tier,
            createdAt: new Date().toISOString()
        }) + '\n');
    } catch (e) {
        console.error('Failed to log new user', e);
    }
    // Log the new user in by initializing session
    req.session.user = { username: newUser.username, name: newUser.name, tier: newUser.tier };
    res.json(req.session.user);
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ username: null, name: 'Guest', tier: 'guest' });
  res.json(req.session.user);
});

// ---------- user settings ----------
app.get('/api/settings', async (req, res) => {
  if (!isLogged(req)) return res.json({});
  const fp = path.join(USER_SETTINGS_DIR, `${req.session.user.username}.json`);
  const s = await readJson(fp, {});
  res.json(s);
});

app.put('/api/settings', async (req, res) => {
  if (!isLogged(req)) return res.status(401).json({ error: 'login-required' });
  const fp = path.join(USER_SETTINGS_DIR, `${req.session.user.username}.json`);
  const next = req.body && typeof req.body === 'object' ? req.body : {};
  await writeJson(fp, next);
  res.json({ ok: true });
});

// ---------- admin: settings ----------
app.get('/api/admin/settings', async (req, res) => {
  if (!isDev(req)) return res.status(403).json({ error: 'forbidden' });
  const s = await readJson(ADMIN_JSON, { order: [], hidden: [], pinned: [], perApp: {} });
  res.json(s);
});

app.put('/api/admin/settings', async (req, res) => {
  if (!isDev(req)) return res.status(403).json({ error: 'forbidden' });
  const next = req.body && typeof req.body === 'object' ? req.body : {};
  await writeJson(ADMIN_JSON, next);
  res.json({ ok: true });
});

// ---------- admin: users (view/update tiers) ----------
app.get('/api/admin/users', async (req, res) => {
  if (!isDev(req)) return res.status(403).json({ error: 'forbidden' });
  const users = await readJson(USERS_JSON, []);
  res.json(users.map(({ username, name, tier }) => ({ username, name, tier })));
});

app.put('/api/admin/users', async (req, res) => {
  if (!isDev(req)) return res.status(403).json({ error: 'forbidden' });
  const body = req.body || {};
  let updates = [];
  if (Array.isArray(body.users)) updates = body.users;
  else if (body.username && body.tier) updates = [body];
  else return res.status(400).json({ error: 'bad-payload' });

  const users = await readJson(USERS_JSON, []);
  for (const { username, tier } of updates) {
    const i = users.findIndex(u => u.username === username);
    if (i >= 0) users[i].tier = tier;
  }
  await writeJson(USERS_JSON, users);
  res.json({ ok: true });
});

// ---------- chat ----------
app.get('/api/chat/rooms', async (_req, res) => {
  const files = (await fs.readdir(CHAT_DIR)).filter(f => f.endsWith('.txt'));
  const rooms = files.map(f => path.basename(f, '.txt'));
  res.json({ rooms });
});

app.post('/api/chat/rooms', async (req, res) => {
  if (!isDev(req)) return res.status(403).json({ error: 'forbidden' });
  const room = sanitizeRoom(req.body?.room);
  const fp = path.join(CHAT_DIR, `${room}.txt`);
  if (!fssync.existsSync(fp)) await writeJson(fp, []);
  res.json({ ok: true, room });
});

app.get('/api/chat/rooms/:room', async (req, res) => {
  const room = sanitizeRoom(req.params.room);
  const fp = path.join(CHAT_DIR, `${room}.txt`);
  const msgs = await readJson(fp, []);
  const limit = Math.max(0, Math.min(500, Number(req.query.limit || 200)));
  res.set('Cache-Control', 'no-store');
  res.json(msgs.slice(-limit));
});

app.post('/api/chat/rooms/:room', async (req, res) => {
  if (!isLogged(req)) return res.status(401).json({ error: 'login-required' });
  const text = (req.body?.text || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const room = sanitizeRoom(req.params.room);
  const fp = path.join(CHAT_DIR, `${room}.txt`);
  const msgs = await readJson(fp, []);
  msgs.push({ ts: Date.now(), user: req.session.user.username, text });
  await writeJson(fp, msgs);
  res.json({ ok: true });
});

// ---------- start ----------
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API listening on 127.0.0.1:${PORT} (SITE_ROOT=${SITE_ROOT})`);
});
