// Keepsake — a tiny, zero-dependency server for animated birthday cards.
// Run: node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_BODY = 12 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

// ---------- storage ----------
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
catch { db = { users: {}, sessions: {}, cards: {} }; }

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const id = (n = 12) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const now = () => new Date().toISOString();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

// ---------- demo card ----------
if (!db.cards.demo) {
  db.cards.demo = {
    slug: 'demo', ownerId: null, createdAt: now(), updatedAt: now(),
    recipient: 'Daniel', sender: 'Felicity', birthday: '2026-10-29', theme: 'rose',
    cover: 'Open me, birthday boy',
    headline: 'Happy Birthday, my love',
    letter: "I've been trying to find the right words for weeks, and every draft ends up sounding the same: I'm so glad you were born.\n\nThank you for the late-night drives, the terrible jokes, the way you hold my hand in crowds without thinking about it. You make ordinary days feel like something worth remembering.\n\nHere's to another year of you — and of us.",
    memories: [
      { id: id(), image: null, caption: 'The night we met', date: 'March 2023' },
      { id: id(), image: null, caption: 'Our first trip together', date: 'August 2023' },
      { id: id(), image: null, caption: 'That rainy picnic', date: 'May 2024' },
      { id: id(), image: null, caption: 'Dancing in the kitchen', date: 'December 2024' },
      { id: id(), image: null, caption: 'Sunsets & you', date: 'June 2025' },
    ],
    notes: [
      'The way you laugh at your own jokes before the punchline',
      'How safe I feel when you hug me',
      'You always save me the last bite',
      'Your terrible, wonderful singing in the car',
      'How you make every place feel like home',
      'You believe in me, even when I don\'t',
    ],
    finale: 'Make a wish — I already got mine.',
    guestbook: true, inviteToken: 'demo-invite',
    messages: [
      { id: id(), name: 'Mum', text: 'Happy birthday, sweetheart! So proud of the man you are.', createdAt: now() },
      { id: id(), name: 'Tolu', text: 'Another lap around the sun! Drinks are on you this time 🥂', createdAt: now() },
    ],
  };
  save();
}

// ---------- helpers ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm',
};
const AUDIO_EXT = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm' };
const MAX_AUDIO = 25 * 1024 * 1024;

function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isObj ? 'application/json' : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function serveFile(res, file, req) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? +range[1] : stat.size - +range[2];
      let end = range[1] && range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
      if (start < 0) start = 0;
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { reject(Object.assign(new Error('That file is too big (max 25 MB).'), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((c) => {
    const i = c.indexOf('='); return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
}

function currentUser(req) {
  const sid = cookies(req).sid;
  const session = sid && db.sessions[sid];
  return session ? db.users[session.userId] || null : null;
}

const str = (v, max) => String(v ?? '').slice(0, max);
const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email };

function cardSummary(c) {
  return { slug: c.slug, recipient: c.recipient, theme: c.theme, updatedAt: c.updatedAt, messageCount: c.messages.length };
}

function sanitizeCard(input, card) {
  const themes = ['rose', 'lavender', 'midnight', 'peach', 'burgundy'];
  const okImage = (v) => (typeof v === 'string' && v.startsWith('/uploads/') ? v : null);
  if ('recipient' in input) card.recipient = str(input.recipient, 60);
  if ('sender' in input) card.sender = str(input.sender, 60);
  if ('birthday' in input) card.birthday = str(input.birthday, 20);
  if ('theme' in input) card.theme = themes.includes(input.theme) ? input.theme : 'rose';
  if ('cover' in input) card.cover = str(input.cover, 80);
  if ('headline' in input) card.headline = str(input.headline, 100);
  if ('letter' in input) card.letter = str(input.letter, 6000);
  if ('finale' in input) card.finale = str(input.finale, 200);
  if ('guestbook' in input) card.guestbook = !!input.guestbook;
  if ('music' in input) {
    const m = input.music;
    card.music = m && typeof m.url === 'string' && /^\/uploads\/[\w-]+\.(mp3|m4a|aac|ogg|wav|webm)$/.test(m.url)
      ? { url: m.url, title: str(m.title, 100) } : null;
  }
  if (Array.isArray(input.memories)) {
    card.memories = input.memories.slice(0, 30).map((m) => ({
      id: str(m.id, 20) || id(), image: okImage(m.image), caption: str(m.caption, 120), date: str(m.date, 40),
    }));
  }
  if (Array.isArray(input.notes)) card.notes = input.notes.slice(0, 30).map((n) => str(n, 200)).filter(Boolean);
}

// ---------- API ----------
async function api(req, res, pathname, url) {
  const user = currentUser(req);
  const m = (re) => pathname.match(re);
  let match;

  if (pathname === '/api/me' && req.method === 'GET') return send(res, 200, { user: publicUser(user) });

  if (pathname === '/api/signup' && req.method === 'POST') {
    const b = await readBody(req);
    const email = str(b.email, 120).trim().toLowerCase();
    const name = str(b.name, 60).trim();
    const password = String(b.password || '');
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'Please enter your name and a valid email.' });
    if (password.length < 6) return send(res, 400, { error: 'Password must be at least 6 characters.' });
    if (Object.values(db.users).some((u) => u.email === email)) return send(res, 409, { error: 'An account with that email already exists.' });
    const u = { id: id(), name, email, ...hashPassword(password), createdAt: now() };
    db.users[u.id] = u;
    return startSession(res, u);
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const b = await readBody(req);
    const email = str(b.email, 120).trim().toLowerCase();
    const u = Object.values(db.users).find((x) => x.email === email);
    if (!u || !checkPassword(String(b.password || ''), u)) return send(res, 401, { error: 'Email or password is incorrect.' });
    return startSession(res, u);
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const sid = cookies(req).sid;
    if (sid) { delete db.sessions[sid]; save(); }
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' });
  }

  if (pathname === '/api/cards' && req.method === 'GET') {
    if (!user) return send(res, 401, { error: 'Please log in.' });
    const list = Object.values(db.cards).filter((c) => c.ownerId === user.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(cardSummary);
    return send(res, 200, { cards: list });
  }

  if (pathname === '/api/cards' && req.method === 'POST') {
    if (!user) return send(res, 401, { error: 'Please log in.' });
    let slug; do { slug = id(8); } while (db.cards[slug]);
    const card = {
      slug, ownerId: user.id, createdAt: now(), updatedAt: now(),
      recipient: '', sender: user.name, birthday: '', theme: 'rose',
      cover: 'Open me', headline: 'Happy Birthday', letter: '',
      memories: [], notes: [], finale: 'Make a wish!', music: null,
      guestbook: true, inviteToken: id(16), messages: [],
    };
    db.cards[slug] = card; save();
    return send(res, 201, { card });
  }

  if ((match = m(/^\/api\/cards\/([\w-]+)$/))) {
    const card = db.cards[match[1]];
    if (!card) return send(res, 404, { error: 'Card not found.' });
    const isOwner = !!user && card.ownerId === user.id;

    if (req.method === 'GET') {
      const { ownerId, inviteToken, ...pub } = card;
      return send(res, 200, {
        card: isOwner ? { ...pub, inviteToken } : pub,
        isOwner,
        canPost: card.guestbook && isOwner,
      });
    }
    if (!isOwner) return send(res, 403, { error: 'Only the card owner can do that.' });

    if (req.method === 'PUT') {
      const b = await readBody(req);
      sanitizeCard(b, card);
      if (b.regenerateInvite) card.inviteToken = id(16);
      card.updatedAt = now(); save();
      return send(res, 200, { card });
    }
    if (req.method === 'DELETE') {
      delete db.cards[card.slug]; save();
      return send(res, 200, { ok: true });
    }
  }

  if ((match = m(/^\/api\/cards\/([\w-]+)\/messages$/)) && req.method === 'POST') {
    const card = db.cards[match[1]];
    if (!card) return send(res, 404, { error: 'Card not found.' });
    if (!user || card.ownerId !== user.id) return send(res, 403, { error: 'Only the card owner can do that.' });
    return addMessage(res, card, await readBody(req));
  }

  // Guests only ever see the invite token, never the card's own address or content.
  if ((match = m(/^\/api\/invite\/([\w-]+)(\/messages)?$/))) {
    const card = Object.values(db.cards).find((c) => c.inviteToken === match[1]);
    if (!card) return send(res, 404, { error: 'This invite link is no longer valid.' });
    if (!match[2] && req.method === 'GET') {
      return send(res, 200, { recipient: card.recipient, sender: card.sender, theme: card.theme, open: card.guestbook });
    }
    if (match[2] && req.method === 'POST') {
      if (!card.guestbook) return send(res, 403, { error: 'This card isn\'t taking messages right now.' });
      return addMessage(res, card, await readBody(req));
    }
  }

  if ((match = m(/^\/api\/cards\/([\w-]+)\/messages\/([\w-]+)$/)) && req.method === 'DELETE') {
    const card = db.cards[match[1]];
    if (!card || !user || card.ownerId !== user.id) return send(res, 403, { error: 'Not allowed.' });
    card.messages = card.messages.filter((x) => x.id !== match[2]); save();
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/upload-audio' && req.method === 'POST') {
    if (!user) return send(res, 401, { error: 'Please log in.' });
    const ext = AUDIO_EXT[String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()];
    if (!ext) return send(res, 400, { error: 'Please choose an MP3, M4A, AAC, OGG or WAV file.' });
    const buf = await readRaw(req, MAX_AUDIO);
    if (!buf.length) return send(res, 400, { error: 'That file is empty.' });
    const name = `${id(16)}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return send(res, 201, { url: `/uploads/${name}` });
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    if (!user) return send(res, 401, { error: 'Please log in.' });
    const b = await readBody(req);
    const mm = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(String(b.data || ''));
    if (!mm) return send(res, 400, { error: 'Unsupported image.' });
    const ext = mm[1] === 'jpeg' ? 'jpg' : mm[1];
    const name = `${id(16)}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(mm[2], 'base64'));
    return send(res, 201, { url: `/uploads/${name}` });
  }

  return send(res, 404, { error: 'Not found' });
}

function addMessage(res, card, b) {
  const name = str(b.name, 60).trim(); const text = str(b.text, 800).trim();
  if (!name || !text) return send(res, 400, { error: 'Please add your name and a message.' });
  if (card.messages.length >= 500) return send(res, 429, { error: 'This card is full of love already!' });
  const msg = { id: id(), name, text, createdAt: now() };
  card.messages.push(msg); save();
  return send(res, 201, { message: msg });
}

function startSession(res, u) {
  const sid = crypto.randomBytes(32).toString('hex');
  db.sessions[sid] = { userId: u.id, createdAt: now() };
  save();
  return send(res, 200, { user: publicUser(u) }, {
    'Set-Cookie': `sid=${sid}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax`,
  });
}

// ---------- pages ----------
const PAGES = [
  [/^\/$/, 'index.html'],
  [/^\/(login|signup)$/, 'auth.html'],
  [/^\/dashboard$/, 'dashboard.html'],
  [/^\/edit\/[\w-]+$/, 'edit.html'],
  [/^\/c\/[\w-]+$/, 'card.html'],
  [/^\/invite\/[\w-]+$/, 'invite.html'],
];

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname.startsWith('/api/')) return await api(req, res, pathname, url);

    for (const [re, file] of PAGES) if (re.test(pathname)) return serveFile(res, path.join(PUBLIC, file), req);

    const base = pathname.startsWith('/uploads/') ? UPLOADS : PUBLIC;
    const rel = pathname.startsWith('/uploads/') ? pathname.slice('/uploads/'.length) : pathname;
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base + path.sep)) return send(res, 403, 'Forbidden');
    return serveFile(res, file, req);
  } catch (err) {
    send(res, err.status || 500, { error: err.status ? err.message : 'Something went wrong.' });
    if (!err.status) console.error(err);
  }
}).listen(PORT, () => console.log(`\n  ♥ Keepsake is running at http://localhost:${PORT}\n`));
