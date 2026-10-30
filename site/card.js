// ===== The card experience =====
(async function () {
  const slug = location.pathname.split('/').pop();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  let data;
  try {
    data = window.CARD_DATA ? { card: window.CARD_DATA, isOwner: false, canPost: false } : await api(`/api/cards/${slug}`);
  } catch {
    document.body.innerHTML = '<div style="display:grid;place-items:center;height:100vh;font-family:serif;font-size:28px;text-align:center;padding:16px">This card could not be found.<br><a href="/" style="font-size:16px;margin-top:12px">Go home</a></div>';
    return;
  }
  const { card, isOwner, canPost } = data;
  document.documentElement.dataset.theme = card.theme || 'rose';
  document.body.dataset.theme = card.theme || 'rose';
  const recipient = card.recipient || 'you';
  document.title = `Happy Birthday, ${recipient} ♥`;

  // ---------- fill content ----------
  const setAll = (sel, text) => document.querySelectorAll(sel).forEach((n) => (n.textContent = text));
  setAll('.js-recipient', recipient);
  setAll('.js-sender', card.sender || 'me');
  setAll('.js-cover-line', card.cover || 'Open me');
  setAll('.js-headline', card.headline || 'Happy Birthday');
  setAll('.js-finale', card.finale || '');
  setAll('.js-cake-text', `HBD ${recipient}`);
  document.querySelector('.cake-doodle').innerHTML = doodleSVG('blob');
  if (card.birthday) {
    const [y, m, d] = card.birthday.split('-').map(Number);
    setAll('.js-date', new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }));
  }

  // Headline split into characters for the entrance animation
  const headline = document.querySelector('.js-headline-split');
  (card.headline || 'Happy Birthday').split(' ').forEach((word, i, arr) => {
    const w = el('span', { class: 'word' }, [...word].map((c) => el('span', { class: 'ch' }, c)));
    headline.append(w, i < arr.length - 1 ? ' ' : '');
  });

  // Letter, split into words so they light up as you read
  const letterBody = document.querySelector('.letter-body');
  const paras = (card.letter || '').split(/\n+/).filter((p) => p.trim());
  if (!paras.length) document.getElementById('letter').remove();
  paras.forEach((p) => {
    const para = el('p');
    p.trim().split(/\s+/).forEach((word) => para.append(el('span', { class: 'w' }, word), ' '));
    letterBody.append(para);
  });

  // Memories as polaroids
  const track = document.querySelector('.mem-track');
  const placeholders = ['♥', '✿', '☾', '✦', '❀', '☀'];
  if (!card.memories.length) document.getElementById('memories').remove();
  card.memories.forEach((mem, i) => {
    const hue = (i * 47) % 360;
    const ph = mem.image
      ? el('div', { class: 'ph' }, el('img', { src: mem.image, alt: mem.caption || 'A memory', loading: 'lazy' }))
      : el('div', { class: 'ph empty', style: `background:linear-gradient(135deg,hsl(${hue} 70% 82%),hsl(${(hue + 40) % 360} 65% 68%))` }, placeholders[i % placeholders.length]);
    track.append(el('figure', { class: 'polaroid', style: 'margin:0' }, ph,
      mem.caption ? el('figcaption', { class: 'cap' }, mem.caption) : null,
      mem.date ? el('p', { class: 'dt' }, mem.date) : null));
  });

  // Reasons as flip notes
  const grid = document.querySelector('.notes-grid');
  if (!card.notes.length) document.getElementById('reasons').remove();
  card.notes.forEach((text, i) => {
    const note = el('div', { class: 'note', role: 'button', tabindex: 0, 'aria-label': `Reason ${i + 1} — tap to flip` },
      el('span', { class: 'note-inner' },
        el('span', { class: 'note-face note-front' }, el('span', {}, el('b', {}, String(i + 1).padStart(2, '0')), el('span', {}, 'tap me ♥'))),
        el('span', { class: 'note-face note-back' }, text)));
    note.addEventListener('click', (e) => {
      note.classList.toggle('flipped');
      if (note.classList.contains('flipped')) heartBurst(e.clientX, e.clientY, 10);
    });
    note.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const r = note.getBoundingClientRect();
      note.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    });
    grid.append(note);
  });

  // Guestbook — turned off for now (the section is commented out in card.html).
  // const gbGrid = document.querySelector('.gb-grid');
  // const msgNode = (m) => el('article', { class: 'gb-msg', style: `rotate:${(Math.random() * 3 - 1.5).toFixed(2)}deg` },
  //   el('p', {}, m.text), el('div', { class: 'who' }, `— ${m.name}`));
  // card.messages.forEach((m) => gbGrid.append(msgNode(m)));
  // const gbForm = document.getElementById('gb-form');
  // if (canPost) gbForm.hidden = false;
  // if (!card.messages.length && !canPost) document.getElementById('guestbook').remove();

  // gbForm.addEventListener('submit', async (e) => {
  //   e.preventDefault();
  //   const btn = gbForm.querySelector('button');
  //   btn.disabled = true;
  //   try {
  //     const { message } = await api(`/api/cards/${slug}/messages`, {
  //       method: 'POST',
  //       body: { name: gbForm.querySelector('#gb-name').value, text: gbForm.querySelector('#gb-text').value },
  //     });
  //     const node = msgNode(message);
  //     gbGrid.prepend(node);
  //     gbForm.reset();
  //     const r = gbForm.getBoundingClientRect();
  //     confetti(r.left + r.width / 2, r.top + 40, 90);
  //     if (hasGsap) gsap.from(node, { scale: .6, y: 60, opacity: 0, duration: 1.2, ease: 'elastic.out(1, .6)' });
  //     toast('Your message was added ♥');
  //     window.ScrollTrigger?.refresh();
  //   } catch (err) { toast(err.message); }
  //   btn.disabled = false;
  // });

  // Floating helpers
  if (isOwner) {
    const p = document.getElementById('owner-pill');
    p.href = `/edit/${slug}`; p.hidden = false;
  }
  const invitePill = document.getElementById('invite-pill');

  // ---------- canvases ----------
  const css = getComputedStyle(document.body);
  const palette = ['--accent', '--accent-2', '--gold'].map((v) => css.getPropertyValue(v).trim());
  const sky = document.getElementById('sky'), sctx = sky.getContext('2d');
  const fx = document.getElementById('fx'), fctx = fx.getContext('2d');
  let W, H, DPR;
  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    for (const c of [sky, fx]) { c.width = W * DPR; c.height = H * DPR; c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0); }
  }
  resize(); addEventListener('resize', resize);

  function heartPath(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * .3);
    ctx.bezierCurveTo(-s * .05, s * .25, -s * .5, s * .05, -s * .5, -s * .2);
    ctx.bezierCurveTo(-s * .5, -s * .5, -s * .1, -s * .55, 0, -s * .25);
    ctx.bezierCurveTo(s * .1, -s * .55, s * .5, -s * .5, s * .5, -s * .2);
    ctx.bezierCurveTo(s * .5, s * .05, s * .05, s * .25, 0, s * .3);
    ctx.fill();
  }

  // Dreamy bokeh + drifting hearts in the background
  const orbs = Array.from({ length: W < 640 ? 22 : 38 }, () => newOrb(true));
  function newOrb(anywhere) {
    const heart = Math.random() < .3;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : H + 40,
      r: heart ? 6 + Math.random() * 8 : 20 + Math.random() * 70,
      heart, c: palette[(Math.random() * palette.length) | 0],
      a: heart ? .25 + Math.random() * .3 : .06 + Math.random() * .12,
      vy: .15 + Math.random() * .45, sway: Math.random() * Math.PI * 2, rot: Math.random() - .5,
    };
  }
  let mx = 0, my = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / W - .5; my = e.clientY / H - .5; });

  // Effects layer particles (confetti, bursts, cursor sparkles)
  const parts = [];
  function confetti(x, y, n = 120, power = 1) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2, sp = (4 + Math.random() * 9) * power;
      parts.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 6 * power, g: .22, drag: .985,
        s: 6 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - .5) * .3,
        c: palette[(Math.random() * palette.length) | 0], life: 1, decay: .006 + Math.random() * .008,
        kind: Math.random() < .45 ? 'heart' : 'ribbon',
      });
    }
  }
  function heartBurst(x, y, n = 18) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, sp = 2 + Math.random() * 3;
      parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: -.02, drag: .96,
        s: 8 + Math.random() * 8, rot: 0, vr: 0, c: palette[i % 2], life: 1, decay: .016, kind: 'heart' });
    }
  }
  let lastSpark = 0;
  addEventListener('pointermove', (e) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const t = performance.now(); if (t - lastSpark < 40) return; lastSpark = t;
    parts.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - .5), vy: -.4 - Math.random() * .6, g: 0, drag: .99,
      s: 5 + Math.random() * 5, rot: 0, vr: 0, c: palette[(Math.random() * 2) | 0], life: .8, decay: .02, kind: 'heart' });
  });

  function frame() {
    sctx.clearRect(0, 0, W, H);
    for (const o of orbs) {
      o.y -= o.vy; o.sway += .01;
      const x = o.x + Math.sin(o.sway) * 20 + mx * o.r * .6, y = o.y + my * o.r * .6;
      sctx.globalAlpha = o.a; sctx.fillStyle = o.c;
      if (o.heart) { sctx.save(); sctx.translate(x, y); sctx.rotate(o.rot + Math.sin(o.sway) * .2); heartPath(sctx, o.r * 2); sctx.restore(); }
      else {
        const g = sctx.createRadialGradient(x, y, 0, x, y, o.r);
        g.addColorStop(0, o.c); g.addColorStop(1, 'transparent');
        sctx.fillStyle = g; sctx.beginPath(); sctx.arc(x, y, o.r, 0, Math.PI * 2); sctx.fill();
      }
      if (o.y < -100) Object.assign(o, newOrb(false));
    }
    fctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
      if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      fctx.save(); fctx.globalAlpha = Math.min(1, p.life * 1.5); fctx.fillStyle = p.c;
      fctx.translate(p.x, p.y); fctx.rotate(p.rot);
      if (p.kind === 'heart') heartPath(fctx, p.s * 1.6);
      else { fctx.scale(1, Math.cos(p.rot * 3)); fctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      fctx.restore();
    }
    sctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  if (!reduced) requestAnimationFrame(frame);

  // ---------- music ----------
  const player = document.getElementById('player');
  const song = document.getElementById('song');
  const playBtn = document.getElementById('play-btn');
  const MAX_VOL = .8;
  let fade;
  if (card.music?.url) {
    song.src = card.music.url;
    setAll('.js-song', card.music.title || 'Our song');
  }
  function fadeTo(target, ms, done) {
    clearInterval(fade);
    const step = (target - song.volume) / Math.max(1, ms / 50);
    fade = setInterval(() => {
      const v = song.volume + step;
      if ((step >= 0 && v >= target) || (step < 0 && v <= target)) { song.volume = target; clearInterval(fade); done?.(); }
      else song.volume = Math.min(1, Math.max(0, v));
    }, 50);
  }
  function setPlaying(on) {
    player.classList.toggle('playing', on);
    playBtn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
  }
  function playSong(fadeMs = 1200) {
    song.volume = 0;
    song.play().then(() => { setPlaying(true); fadeTo(MAX_VOL, fadeMs); }).catch(() => setPlaying(false));
  }
  function pauseSong() { setPlaying(false); fadeTo(0, 500, () => song.pause()); }
  function startMusic() {
    if (!card.music?.url) return;
    playSong(3000);
    player.hidden = false;
    if (hasGsap && !reduced) gsap.from(player, { y: 90, scale: .6, opacity: 0, duration: 1.2, ease: 'back.out(2)', delay: 1.2 });
  }
  playBtn.addEventListener('click', () => (song.paused || !player.classList.contains('playing') ? playSong() : pauseSong()));
  song.addEventListener('pause', () => { if (song.volume > 0) setPlaying(false); });

  // ---------- the opening sequence ----------
  const intro = document.getElementById('intro');
  const envelope = document.getElementById('envelope');
  const seal = document.getElementById('seal');
  const book = document.getElementById('book');
  const story = document.getElementById('story');
  let opened = false;

  // ---------- silly doodles ----------
  const KINDS = Object.keys(DOODLES);
  const rand = (a, b) => a + Math.random() * (b - a);
  const burstAt = (x, y) => heartBurst(x, y, 12);
  function drift(d, amount = 1) {
    if (!hasGsap || reduced) return;
    gsap.to(d, { x: `+=${rand(-50, 50) * amount}`, y: `+=${rand(-40, 40) * amount}`, rotation: rand(-18, 18),
      duration: rand(4, 8), ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  const introLayer = el('div', { class: 'intro-doodles' });
  intro.prepend(introLayer);
  const introSpots = W < 640
    ? [[4, 6, 'blob'], [68, 4, 'balloon'], [6, 80, 'cat'], [70, 84, 'star'], [36, 90, 'word:open it!!']]
    : [[8, 10, 'blob'], [82, 8, 'balloon'], [5, 64, 'cat'], [85, 66, 'star'], [44, 3, 'word:hbd!!'], [20, 84, 'ghost'], [66, 86, 'word:open it!!']];
  introSpots.forEach(([x, y, kind]) => {
    const size = (W < 640 ? 62 : 92) * (kind.startsWith('word:') ? 1.6 : 1);
    const d = makeDoodle(kind, size);
    Object.assign(d.style, { left: `${x}%`, top: `${y}%` });
    boop(d, burstAt);
    introLayer.append(d);
    drift(d, .6);
  });
  if (hasGsap && !reduced) gsap.from(introLayer.children, { scale: 0, rotation: -120, duration: 1.1, ease: 'back.out(2.5)', stagger: .12, delay: .9 });

  const buddy = document.querySelector('.hero-buddy');
  const buddyDoodle = makeDoodle('party', 110);
  buddy.prepend(buddyDoodle);
  boop(buddyDoodle, (x, y) => confetti(x, y, 50));

  function scatterDoodles() {
    const layer = el('div', { class: 'doodle-layer' });
    story.prepend(layer);
    const h = story.scrollHeight, narrow = W < 700;
    const count = Math.max(6, Math.round(h / (narrow ? 560 : 340)));
    const pool = [...KINDS, ...DOODLE_WORDS.map((w) => `word:${w}`)].sort(() => Math.random() - .5);
    for (let i = 0; i < count; i++) {
      const kind = pool[i % pool.length];
      const size = (narrow ? 54 : 84) * (kind.startsWith('word:') ? 1.5 : 1) * rand(.85, 1.2);
      const d = makeDoodle(kind, size);
      d.style.top = `${((i + rand(.1, .7)) / count) * h}px`;
      d.style[i % 2 ? 'right' : 'left'] = `${rand(1, narrow ? 4 : 8)}%`;
      boop(d, burstAt);
      layer.append(d);
    }
  }

  if (hasGsap && !reduced) {
    gsap.from('.stage', { y: 60, opacity: 0, scale: .92, duration: 1.8, ease: 'expo.out' });
    gsap.from(['.intro-to', '.intro-hint'], { y: 20, opacity: 0, duration: 1.4, ease: 'expo.out', delay: .5, stagger: .15 });
    gsap.to(envelope, { y: -10, rotation: .6, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  envelope.addEventListener('click', openEnvelope);

  function openEnvelope() {
    if (opened) return; opened = true;
    startMusic();
    if (!hasGsap || reduced) return revealStory();
    gsap.killTweensOf(envelope);
    seal.style.animation = 'none';
    const sr = seal.getBoundingClientRect();
    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });

    tl.to(['.intro-to', '.intro-hint'], { autoAlpha: 0, y: 14, duration: .6, ease: 'power2.out' })
      .to('.intro-doodles .doodle', { scale: 0, opacity: 0, duration: .5, ease: 'back.in(2)', stagger: .05, overwrite: 'auto' }, 0)
      .to(seal, { scale: 1.25, duration: .25, ease: 'power2.out' }, 0)
      .to(seal, { scale: 0, rotation: 120, opacity: 0, duration: .45, ease: 'back.in(2)',
        onStart: () => heartBurst(sr.left + sr.width / 2, sr.top + sr.height / 2, 22) }, .25)
      .to(envelope, { y: 0, rotation: 0, duration: .5 }, 0)
      .to('.env-flap', { rotationX: 180, duration: 1, onUpdate() {
        if (this.progress() > .5) document.querySelector('.env-flap').style.zIndex = 1;
      } }, .55)
      .to('.env-letter', { yPercent: -62, duration: 1.1, ease: 'power3.out' }, 1.35)
      .add(() => morphToBook(), 2.35);
  }

  function morphToBook() {
    // Swap the letter for the folded card at exactly the same spot, then bring it centre stage
    const lr = document.querySelector('.env-letter').getBoundingClientRect();
    const br = book.getBoundingClientRect();
    const scale = lr.height / br.height;
    const dx = (lr.left + lr.width / 2) - (br.left + br.width / 2);
    const dy = (lr.top + lr.height / 2) - (br.top + br.height / 2);
    document.querySelector('.env-letter').style.visibility = 'hidden';
    gsap.set(book, { visibility: 'visible', x: dx, y: dy, scale, rotation: 0 });

    const tl = gsap.timeline();
    tl.to(envelope, { y: '70vh', rotation: 8, opacity: 0, duration: 1.3, ease: 'power2.in' }, 0)
      .to(book, { x: 0, y: 0, scale: 1, rotation: -2, duration: 1.4, ease: 'expo.out' }, .1)
      .to(book, { rotation: 0, duration: .8, ease: 'sine.inOut' }, 1.3)
      .to('.book-cover', { rotationY: -180, duration: 1.8, ease: 'power3.inOut' }, 1.3)
      .to('.book-inner', { xPercent: 50, duration: 1.8, ease: 'power3.inOut' }, 1.3)
      .add(() => {
        const r = book.getBoundingClientRect();
        confetti(r.left + r.width, r.top + r.height * .3, 160, 1.1);
      }, 2.3)
      .from('.page-right > *', { y: 24, opacity: 0, filter: 'blur(6px)', stagger: .14, duration: 1.1, ease: 'expo.out' }, 2.4);
  }

  document.getElementById('begin').addEventListener('click', (e) => { e.stopPropagation(); revealStory(); });

  // ---------- story & scroll animations ----------
  let lenis;
  function revealStory() {
    story.style.visibility = 'visible';
    story.removeAttribute('aria-hidden');
    const done = () => {
      intro.remove();
      document.body.classList.remove('locked');
      window.scrollTo(0, 0);
      lenis = smoothScroll();
      scatterDoodles();
      setupScroll();
      if (canPost && !isOwner) invitePill.hidden = false;
    };
    if (!hasGsap || reduced) {
      story.querySelectorAll('.w').forEach((w) => (w.style.opacity = 1));
      story.querySelector('.finale-after').style.visibility = 'visible';
      return done();
    }
    gsap.timeline()
      .to(book, { scale: 1.25, opacity: 0, filter: 'blur(14px)', duration: 1.1, ease: 'power2.in' })
      .to(intro, { opacity: 0, duration: .6 }, .6)
      .add(done)
      .from('.hero .eyebrow', { y: 20, opacity: 0, duration: 1.2, ease: 'expo.out' })
      .from('.hero-title .ch', { yPercent: 120, rotate: 12, opacity: 0, duration: 1.6, ease: 'expo.out', stagger: .045 }, '<.1')
      .from('.hero-name', { y: 40, scale: .85, opacity: 0, filter: 'blur(12px)', duration: 2, ease: 'expo.out' }, '<.5')
      .add(() => { const r = document.querySelector('.hero-name').getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 120); }, '<.3')
      .from('.scroll-cue', { opacity: 0, duration: 1 }, '<1');
  }

  function setupScroll() {
    if (!hasGsap || reduced) return;
    ScrollTrigger.refresh();

    // doodles pop in, float about and drift at their own speed as you scroll
    gsap.utils.toArray('.doodle-layer .doodle').forEach((d) => {
      gsap.from(d, { scale: 0, rotation: rand(-90, 90), duration: 1, ease: 'back.out(2.5)', scrollTrigger: { trigger: d, start: 'top 95%' } });
      gsap.to(d, { yPercent: rand(-160, 160), ease: 'none', scrollTrigger: { trigger: d, start: 'top bottom', end: 'bottom top', scrub: true } });
      drift(d);
    });
    gsap.from('.hero-buddy', { scale: 0, rotation: -30, duration: 1.2, ease: 'back.out(2.2)', delay: 2.2 });
    gsap.to('.hero-buddy', { y: -12, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    // progress bar
    gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });

    // hero drifts away softly
    gsap.to('.hero-title', { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-name', { yPercent: -15, scale: 1.08, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-name', { y: -10, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    // section headings
    gsap.utils.toArray('#story h2, #story .eyebrow:not(.hero .eyebrow)').forEach((h) => {
      gsap.from(h, { y: 60, opacity: 0, filter: 'blur(10px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
    });

    // letter: paper rises, words glow in as you scroll
    if (document.querySelector('.paper')) {
      gsap.from('.paper', { y: 120, rotation: 3, opacity: 0, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: '.paper', start: 'top 90%' } });
      gsap.to('.letter-body .w', { opacity: 1, stagger: .1, ease: 'none',
        scrollTrigger: { trigger: '.letter-body', start: 'top 75%', end: 'bottom 45%', scrub: .8 } });
      gsap.from('.sign', { x: 40, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.sign', start: 'top 90%' } });
    }

    // memories: pinned horizontal glide
    if (document.getElementById('memories')) {
      const polaroids = gsap.utils.toArray('.polaroid');
      polaroids.forEach((p, i) => gsap.set(p, { rotation: i % 2 ? 3 : -3, y: i % 2 ? 30 : 0 }));
      const distance = () => Math.max(0, track.scrollWidth - innerWidth);
      if (distance() > 40) {
        const slide = gsap.to(track, { x: () => -distance(), ease: 'none',
          scrollTrigger: { trigger: '#memories', start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 1, invalidateOnRefresh: true } });
        polaroids.forEach((p) => {
          gsap.from(p, { opacity: 0, scale: .8, rotation: '+=10', y: '+=80', ease: 'power2.out',
            scrollTrigger: { trigger: p, containerAnimation: slide, start: 'left 100%', end: 'left 65%', scrub: true } });
          const img = p.querySelector('img');
          if (img) gsap.fromTo(img, { xPercent: -6, yPercent: -6 }, { xPercent: 0, yPercent: 0, ease: 'none',
            scrollTrigger: { trigger: p, containerAnimation: slide, start: 'left right', end: 'right left', scrub: true } });
        });
      } else {
        gsap.from(polaroids, { y: 100, opacity: 0, rotation: 8, stagger: .15, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: track, start: 'top 85%' } });
      }
    }

    // reasons pop in like scattered notes
    gsap.utils.toArray('.note').forEach((n, i) => {
      gsap.from(n, { y: 90, rotation: (i % 2 ? 1 : -1) * (6 + Math.random() * 6), scale: .85, opacity: 0, duration: 1.4, ease: 'expo.out',
        delay: (i % 3) * .12, scrollTrigger: { trigger: n, start: 'top 92%' } });
    });

    // guestbook messages
    gsap.utils.toArray('.gb-msg, .gb-form').forEach((m, i) => {
      gsap.from(m, { y: 70, opacity: 0, scale: .94, duration: 1.4, ease: 'expo.out', delay: (i % 3) * .1, scrollTrigger: { trigger: m, start: 'top 92%' } });
    });

    // finale
    gsap.from('.cake', { y: 80, scale: .8, opacity: 0, duration: 1.8, ease: 'elastic.out(1, .7)', scrollTrigger: { trigger: '.cake', start: 'top 90%' } });

    // invite pill hides once you reach the guestbook form
    if (!invitePill.hidden) {
      ScrollTrigger.create({ trigger: '#gb-form', start: 'top 85%', onEnter: () => gsap.to(invitePill, { autoAlpha: 0 }), onLeaveBack: () => gsap.to(invitePill, { autoAlpha: 1 }) });
    }
  }

  invitePill.addEventListener('click', () => {
    const target = document.getElementById('gb-form');
    lenis ? lenis.scrollTo(target, { offset: -80, duration: 2.4 }) : target.scrollIntoView({ behavior: 'smooth' });
  });

  // ---------- make a wish ----------
  let blown = false;
  document.getElementById('cake').addEventListener('click', () => {
    if (blown) return; blown = true;
    const flames = document.querySelectorAll('.flame');
    flames.forEach((f) => (f.style.animation = 'none'));
    if (!hasGsap || reduced) {
      flames.forEach((f) => (f.style.opacity = 0));
      document.querySelector('.finale-after').style.visibility = 'visible';
      return;
    }
    gsap.to(flames, { scaleY: 0, opacity: 0, duration: .35, stagger: .12, ease: 'power2.in' });
    document.querySelectorAll('.candle').forEach((c, i) => {
      for (let k = 0; k < 4; k++) {
        const s = el('span', { class: 'smoke' }); c.append(s);
        gsap.fromTo(s, { opacity: .7, y: 0, x: 0, scale: .6 }, { opacity: 0, y: -70 - k * 18, x: (Math.random() - .5) * 30, scale: 2.4,
          duration: 2, delay: i * .12 + k * .15, ease: 'power1.out', onComplete: () => s.remove() });
      }
    });
    gsap.to('.finale-hint', { opacity: 0, height: 0, margin: 0, duration: .6 });
    const r = document.getElementById('cake').getBoundingClientRect();
    [0, .5, 1, 1.5, 2.1].forEach((t, i) => gsap.delayedCall(.6 + t, () => {
      confetti(i === 0 ? r.left + r.width / 2 : W * (.15 + Math.random() * .7), i === 0 ? r.top : H * (.2 + Math.random() * .3), 140, 1.15);
    }));
    gsap.set('.finale-after', { visibility: 'visible' });
    gsap.from('.finale-after > *', { y: 40, opacity: 0, filter: 'blur(10px)', stagger: .25, duration: 1.8, ease: 'expo.out', delay: .9 });
    gsap.delayedCall(.9, () => lenis?.scrollTo('.finale-after', { offset: -innerHeight * .3, duration: 2.2 }));
  });

  document.getElementById('replay').addEventListener('click', () => {
    lenis ? lenis.scrollTo(0, { duration: 3.2 }) : window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
