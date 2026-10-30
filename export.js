// Turns one card into a plain static website in site/, ready for Vercel.
//   node export.js            exports your card (the one that isn't the demo)
//   node export.js <card-id>  exports a specific card
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// The live address, used for the link preview (WhatsApp, iMessage…). Change it if the Vercel URL changes.
const SITE_URL = 'https://birthday-two-theta-43.vercel.app';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const ROOT = __dirname;
const OUT = path.join(ROOT, 'site');
const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'db.json'), 'utf8'));
const cards = Array.isArray(db.cards) ? db.cards : Object.values(db.cards);

const wanted = process.argv[2];
const card = wanted
  ? cards.find((c) => c.slug === wanted)
  : cards.filter((c) => c.slug !== 'demo').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
if (!card) { console.error(wanted ? `No card with id "${wanted}".` : 'No card found. Make one at http://localhost:3001 first.'); process.exit(1); }

// Only what the card needs to show — no owner id, invite token or account data.
const data = {
  slug: card.slug, recipient: card.recipient, sender: card.sender, birthday: card.birthday, theme: card.theme,
  cover: card.cover, headline: card.headline, letter: card.letter, memories: card.memories, notes: card.notes,
  finale: card.finale, music: card.music, extras: card.extras || null, guestbook: false,
  messages: card.messages.map(({ name, text, createdAt }) => ({ name, text, createdAt })),
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'uploads'), { recursive: true });

for (const f of ['base.css', 'card.css', 'extras.css', 'app.js', 'doodles.js', 'extras.js', 'card.js']) {
  fs.copyFileSync(path.join(ROOT, 'public', f), path.join(OUT, f));
}

const files = [...new Set([...data.memories.map((m) => m.image), data.music?.url, data.extras?.player?.photo].filter(Boolean))];
for (const url of files) {
  const name = path.basename(url);
  fs.copyFileSync(path.join(ROOT, 'uploads', name), path.join(OUT, 'uploads', name));
}

// Link-preview image: render og.html with Chrome, then shrink to a small JPEG (WhatsApp ignores big images).
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ogImage = path.join(OUT, 'og.jpg');
try {
  const tmp = path.join(require('os').tmpdir(), `keepsake-og-${process.pid}`);
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, 'og.html'), fs.readFileSync(path.join(ROOT, 'og.html'), 'utf8')
    .replaceAll('{{NAME}}', esc(data.recipient || 'you')));
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1200,630', '--virtual-time-budget=5000',
    `--screenshot=${path.join(tmp, 'og.png')}`, `file://${path.join(tmp, 'og.html')}`], { stdio: 'ignore', timeout: 60000 });
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', path.join(tmp, 'og.png'), '--out', ogImage], { stdio: 'ignore' });
  fs.rmSync(tmp, { recursive: true, force: true });
} catch { console.warn('Could not make the link-preview image (needs Google Chrome). The card still works.'); }

const title = `Happy Birthday, ${data.recipient || 'you'} ♥`;
const meta = [
  `<meta name="description" content="A birthday card, just for you. Tap to open 💌">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:url" content="${SITE_URL}/">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="A birthday card, just for you. Tap to open 💌">`,
  fs.existsSync(ogImage) ? `<meta property="og:image" content="${SITE_URL}/og.jpg">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n  <meta name="twitter:card" content="summary_large_image">` : '',
].filter(Boolean).join('\n  ');

const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = fs.readFileSync(path.join(ROOT, 'public', 'card.html'), 'utf8')
  .replace('<title>A card for you ♥</title>', `<title>${esc(title)}</title>\n  ${meta}`)
  .replace('<script src="/card.js"></script>', `<script>window.CARD_DATA = ${json};</script>\n  <script src="/card.js"></script>`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

console.log(`Exported "${data.headline || 'Happy Birthday'}" for ${data.recipient} → site/ (${files.length} files)`);
