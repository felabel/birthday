// ===== Fun extras: player card, penalty shootout, quiz, "open when" letters, coupons, scratch card, man of the match =====
// Each section only appears when the card has content for it (set in the editor).
window.renderExtras = function (card, ctx) {
  const x = card.extras || {};
  const { confetti, heartBurst, hasGsap, reduced } = ctx;
  const anim = hasGsap && !reduced;
  const UNITED = ['#DA291C', '#ffffff', '#111111', '#FBE122'];
  const finale = document.getElementById('finale');
  const who = (x.player?.name || card.recipient || 'you').trim();
  const centre = (node) => { const r = node.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const section = (id, eyebrow, title, em, ...children) => el('section', { class: `x-sec ${id}`, id },
    el('p', { class: 'eyebrow' }, eyebrow), el('h2', {}, title, ' ', el('em', {}, em)), ...children);
  const added = [];
  const add = (node, before = finale) => { before.before(node); added.push(node); };

  // Stadium crowd roar, made on the fly (no sound file needed)
  let audio;
  function roar(seconds = 3.2) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const len = audio.sampleRate * seconds;
      const buf = audio.createBuffer(2, len, audio.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
      const src = audio.createBufferSource(); src.buffer = buf;
      const band = audio.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 700; band.Q.value = .6;
      const gain = audio.createGain(); const t = audio.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(.55, t + .5);
      gain.gain.setValueAtTime(.55, t + seconds * .45);
      gain.gain.exponentialRampToValueAtTime(.001, t + seconds);
      src.connect(band).connect(gain).connect(audio.destination);
      src.start();
    } catch {}
  }
  const unitedBurst = (big) => {
    const W = innerWidth, H = innerHeight;
    confetti(W * .5, H * .45, big ? 160 : 90, 1.1, UNITED);
    if (big) { setTimeout(() => confetti(W * .15, H * .6, 110, 1, UNITED), 300); setTimeout(() => confetti(W * .85, H * .6, 110, 1, UNITED), 550); }
  };

  // ---------- player card ----------
  const P = x.player;
  if (P && (P.name || P.ratings?.length)) {
    const photo = P.photo || card.memories.find((m) => m.image)?.image;
    const front = el('div', { class: 'fut-face fut-front' },
      el('div', { class: 'fut-top' }, el('b', { class: 'fut-ovr' }, P.overall || '99'), el('span', { class: 'fut-pos' }, P.position || 'GOAT'),
        el('span', { class: 'fut-badge', 'aria-hidden': 'true' }, P.number ? `#${P.number}` : '♥')),
      el('div', { class: 'fut-photo' }, photo ? el('img', { src: photo, alt: '' }) : null),
      el('p', { class: 'fut-name' }, (P.name || card.recipient || '').toUpperCase()),
      el('div', { class: 'fut-ratings' }, P.ratings.map((r) => el('span', {}, el('b', {}, r.value), ` ${r.label}`))));
    const back = el('div', { class: 'fut-face fut-back' },
      el('span', { class: 'fut-big', 'aria-hidden': 'true' }, P.number || '♥'),
      el('p', { class: 'fut-title' }, 'Career stats'),
      el('dl', {}, (P.stats || []).flatMap((s) => [el('dt', {}, s.label), el('dd', {}, s.value)])));
    const fut = el('div', { class: 'fut', role: 'button', tabindex: 0, 'aria-label': 'Player card — tap to flip' },
      el('div', { class: 'fut-tilt' }, el('div', { class: 'fut-inner' }, front, back)));
    fut.addEventListener('click', (e) => { fut.classList.toggle('flipped'); heartBurst(e.clientX || centre(fut)[0], e.clientY || centre(fut)[1], 12); });
    fut.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fut.click(); } });
    fut.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = fut.getBoundingClientRect();
      fut.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - .5) * -16}deg`);
      fut.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - .5) * 16}deg`);
    });
    fut.addEventListener('pointerleave', () => { fut.style.setProperty('--rx', '0deg'); fut.style.setProperty('--ry', '0deg'); });
    add(section('fut-sec', 'Scouting report', 'Player of the', 'season', fut, el('p', { class: 'x-hint' }, 'tap the card to see his stats')),
      document.getElementById('reasons') || finale);
  }

  // ---------- penalty shootout ----------
  const S = x.shootout;
  if (S && (S.prizes?.length || S.final)) {
    const needed = S.prizes.length || 3;
    let goals = 0, busy = false, lastSaved = false;
    const keeper = makeDoodle('blob', 86); keeper.classList.add('keeper');
    const ball = el('div', { class: 'ball' }); ball.innerHTML = doodleSVG('football');
    const banner = el('p', { class: 'shot-banner', 'aria-live': 'polite' });
    const dots = el('div', { class: 'shot-dots' }, Array.from({ length: needed }, () => el('i')));
    const prizes = el('ol', { class: 'shot-prizes' });
    const finalBox = el('div', { class: 'shot-final', hidden: true }, el('p', { class: 'script' }, 'Full time!'), el('p', {}, S.final || `${who}, you win. Always.`));
    const zones = ['left', 'middle', 'right'].map((side, i) => el('button', { class: `zone z-${side}`, 'aria-label': `Shoot ${side}`, onclick: () => shoot(i) }));
    const goal = el('div', { class: 'goal' }, el('div', { class: 'net' }), keeper, ...zones);
    const pitch = el('div', { class: 'pitch' }, goal, ball, banner);

    function say(text, kind) {
      banner.textContent = text; banner.className = `shot-banner show ${kind}`;
      if (anim) gsap.fromTo(banner, { scale: .3, rotate: -12, opacity: 0 }, { scale: 1, rotate: -4, opacity: 1, duration: .6, ease: 'back.out(3)' });
    }
    function shoot(aim) {
      if (busy || goals >= needed) return; busy = true;
      // the keeper guesses right now and then, but never twice in a row (and never on the first shot)
      const saved = goals > 0 && !lastSaved && Math.random() < .3;
      const dive = saved ? aim : [0, 1, 2].filter((d) => d !== aim)[Math.random() < .5 ? 0 : 1];
      lastSaved = saved;
      const zr = zones[aim].getBoundingClientRect(), br = ball.getBoundingClientRect();
      const dx = zr.left + zr.width / 2 - (br.left + br.width / 2), dy = zr.top + zr.height * .45 - (br.top + br.height / 2);
      const kx = (dive - 1) * goal.clientWidth * .3;
      const result = () => {
        if (saved) { say('SAVED! 🧤 go again', 'saved'); }
        else {
          goals++;
          goal.classList.remove('rip'); void goal.offsetWidth; goal.classList.add('rip');
          dots.children[goals - 1].classList.add('on');
          const [cx, cy] = centre(goal); confetti(cx, cy, 70, .9, UNITED);
          say(goals >= needed ? 'WHAT A FINISH!!' : 'GOAAAL! ⚽', 'goal');
          const text = S.prizes[goals - 1];
          if (text) {
            const li = el('li', {}, el('b', {}, `Goal ${goals}`), text); prizes.append(li);
            if (anim) gsap.from(li, { y: 30, opacity: 0, scale: .9, duration: .8, ease: 'back.out(2)' });
          }
          if (goals >= needed) setTimeout(() => {
            finalBox.hidden = false; roar(); unitedBurst(true);
            if (anim) gsap.from(finalBox.children, { y: 30, opacity: 0, stagger: .2, duration: 1, ease: 'expo.out' });
          }, 700);
        }
        setTimeout(() => {
          if (anim) { gsap.to(ball, { x: 0, y: 0, scale: 1, rotation: 0, duration: .5, ease: 'power2.inOut' }); gsap.to(keeper, { x: 0, rotation: 0, duration: .5 }); }
          if (anim) gsap.to(banner, { opacity: 0, duration: .3, delay: .2 }); else banner.className = 'shot-banner';
          busy = false;
        }, 1400);
      };
      if (!anim) return result();
      gsap.to(keeper, { x: kx, rotation: (dive - 1) * 40, duration: .45, ease: 'power2.out', delay: .08 });
      gsap.to(ball, { x: saved ? dx * .9 : dx, y: saved ? dy * .85 : dy, scale: .5, rotation: 540, duration: .5, ease: 'power2.out', onComplete: () => {
        if (saved) gsap.to(ball, { y: '+=90', x: `+=${(Math.random() - .5) * 120}`, duration: .5, ease: 'power1.out' });
        result();
      } });
    }

    add(section('shootout', 'Penalty shootout', 'Score to', 'unlock',
      el('p', { class: 'x-lead' }, 'Tap a spot in the goal to shoot. Every goal unlocks a little surprise.'),
      el('div', { class: 'shot-score' }, el('span', {}, 'Goals'), dots), pitch, prizes, finalBox));
  }

  // ---------- quiz ----------
  const Q = (x.quiz || []).filter((q) => q.q);
  if (Q.length) {
    let i = 0, score = 0;
    const box = el('div', { class: 'quiz-card' });
    function showQ() {
      const q = Q[i], right = q.options[q.answer];
      const msg = el('p', { class: 'quiz-msg', 'aria-live': 'polite' });
      const opts = q.options.filter(Boolean).map((o) => el('button', { class: 'quiz-opt', onclick: (e) => {
        if (box.dataset.locked) return; box.dataset.locked = 1;
        const ok = o === right;
        if (ok) { score++; e.currentTarget.classList.add('right'); msg.textContent = ['Correct! 🎉', 'Yesss 😍', 'Obviously ❤️'][i % 3]; heartBurst(e.clientX, e.clientY, 14); }
        else {
          e.currentTarget.classList.add('wrong'); msg.textContent = `Wrong 😤 it's "${right}"`;
          opts.find((b) => b.textContent === right)?.classList.add('right');
          if (anim) gsap.fromTo(box, { x: -10 }, { x: 0, duration: .5, ease: 'elastic.out(1, .3)' });
        }
        setTimeout(() => { i++; delete box.dataset.locked; i < Q.length ? showQ() : showEnd(); }, 1500);
      } }, o));
      box.replaceChildren(el('p', { class: 'quiz-count' }, `Question ${i + 1} of ${Q.length}`), el('h3', {}, q.q), el('div', { class: 'quiz-opts' }, opts), msg);
      if (anim) gsap.from(box.children, { y: 20, opacity: 0, stagger: .07, duration: .6, ease: 'expo.out' });
    }
    function showEnd() {
      const r = score / Q.length;
      const verdict = r === 1 ? 'Perfect score. You really do know us ❤️' : r >= .5 ? 'Not bad… but we need to talk 😏' : 'Wow. Study harder, baby 😂';
      box.replaceChildren(el('p', { class: 'quiz-count' }, 'Final score'), el('p', { class: 'quiz-score' }, `${score}/${Q.length}`), el('h3', {}, verdict),
        el('button', { class: 'btn ghost', onclick: () => { i = 0; score = 0; showQ(); } }, 'Try again'));
      const [cx, cy] = centre(box); confetti(cx, cy, r === 1 ? 140 : 60);
      if (anim) gsap.from(box.children, { y: 24, opacity: 0, stagger: .12, duration: .8, ease: 'back.out(2)' });
    }
    showQ();
    add(section('quiz', 'Pop quiz', 'How well do you', 'know us?', box));
  }

  // ---------- "open when" letters ----------
  const O = x.openWhen || [];
  if (O.length) {
    const modal = el('div', { class: 'ow-modal', hidden: true, role: 'dialog', 'aria-modal': 'true' });
    const close = () => {
      const lenis = ctx.getLenis?.();
      const done = () => { modal.hidden = true; lenis?.start(); document.documentElement.classList.remove('ow-lock'); };
      anim ? gsap.to(modal, { opacity: 0, duration: .35, onComplete: done }) : done();
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
    document.body.append(modal);
    const grid = el('div', { class: 'ow-grid' }, O.map((o, n) => {
      const env = el('button', { class: 'ow', style: `rotate:${[-3, 2, -1.5, 3][n % 4]}deg`, onclick: () => {
        env.classList.add('opened');
        const letter = el('div', { class: 'ow-letter' },
          el('p', { class: 'eyebrow' }, 'Open when…'), el('h3', { class: 'script' }, o.label),
          ...o.text.split(/\n+/).filter((p) => p.trim()).map((p) => el('p', {}, p)),
          el('p', { class: 'script ow-sign' }, `— ${card.sender || 'me'}`),
          el('button', { class: 'btn small', onclick: close }, 'Close ♥'));
        modal.replaceChildren(letter); modal.hidden = false;
        ctx.getLenis?.()?.stop(); document.documentElement.classList.add('ow-lock');
        if (anim) {
          gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: .3 });
          gsap.from(letter, { y: 120, rotate: -6, scale: .7, opacity: 0, duration: .9, ease: 'back.out(1.6)' });
        }
        letter.querySelector('button').focus({ preventScroll: true });
      } }, el('span', { class: 'ow-flap' }), el('span', { class: 'ow-heart' }, '♥'), el('span', { class: 'ow-label script' }, `Open when ${o.label}`));
      return env;
    }));
    add(section('openwhen', 'For later', 'Open', 'when…', el('p', { class: 'x-lead' }, 'Little letters for whenever you need one. Tap to open.'), grid));
  }

  // ---------- love coupons ----------
  const C = x.coupons || [];
  if (C.length) {
    const key = `coupons:${card.slug}`;
    let used = [];
    try { used = JSON.parse(localStorage.getItem(key)) || []; } catch {}
    const grid = el('div', { class: 'coupon-grid' }, C.map((text, n) => {
      const stamp = el('span', { class: 'stamp', 'aria-hidden': 'true' }, 'Redeemed');
      const c = el('button', { class: `coupon${used.includes(n) ? ' used' : ''}`, onclick: (e) => {
        if (c.classList.contains('used')) return toast('Already used! 😅');
        c.classList.add('used'); used.push(n);
        try { localStorage.setItem(key, JSON.stringify(used)); } catch {}
        if (anim) gsap.fromTo(stamp, { scale: 2.6, opacity: 0, rotate: -40 }, { scale: 1, opacity: 1, rotate: -14, duration: .5, ease: 'back.out(2)' });
        heartBurst(e.clientX, e.clientY, 16);
        toast(`Redeemed! Show ${card.sender || 'me'} this 😉`);
      } }, el('span', { class: 'coupon-top' }, 'Love coupon'), el('span', { class: 'coupon-text' }, text),
      el('span', { class: 'coupon-foot' }, 'tap to redeem · no expiry'), stamp);
      return c;
    }));
    add(section('coupons', 'Valid forever', 'Love', 'coupons', el('p', { class: 'x-lead' }, 'Tap one when you want to use it. No take-backs.'), grid));
  }

  // ---------- scratch card ----------
  const X = x.scratch;
  let setupScratch = () => {};
  if (X?.text) {
    const canvas = el('canvas', { class: 'scratch-cover', 'aria-label': 'Scratch to reveal' });
    const prize = el('div', { class: 'scratch-prize' }, el('p', { class: 'eyebrow' }, X.title || 'Your surprise'), el('p', { class: 'scratch-text' }, X.text));
    const wrap = el('div', { class: 'scratch-card' }, prize, canvas);
    let done = false, ready = false, moves = 0;
    const reveal = () => {
      if (done) return; done = true;
      const [cx, cy] = centre(wrap); confetti(cx, cy, 140, 1.1);
      anim ? gsap.to(canvas, { opacity: 0, duration: .6, onComplete: () => canvas.remove() }) : canvas.remove();
      if (anim) gsap.from(prize.children, { scale: .7, opacity: 0, stagger: .15, duration: .8, ease: 'back.out(2.5)' });
    };
    setupScratch = () => {
      if (done) return;
      const r = wrap.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      if (!r.width) return;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const grad = g.createLinearGradient(0, 0, r.width, r.height);
      grad.addColorStop(0, '#c9c9cf'); grad.addColorStop(.5, '#f1f1f4'); grad.addColorStop(1, '#a9a9b2');
      g.fillStyle = grad; g.fillRect(0, 0, r.width, r.height);
      g.fillStyle = 'rgba(60,60,70,.55)'; g.font = `700 ${Math.max(18, r.width / 14)}px DM Sans, sans-serif`; g.textAlign = 'center';
      g.fillText('✦ SCRATCH ME ✦', r.width / 2, r.height / 2 + 8);
      ready = true;
    };
    const scratch = (e) => {
      if (!ready || done || !(e.buttons || e.pointerType === 'touch')) return;
      const r = canvas.getBoundingClientRect(), g = canvas.getContext('2d');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
      g.beginPath(); g.arc(e.clientX - r.left, e.clientY - r.top, Math.max(22, r.width / 16), 0, Math.PI * 2); g.fill();
      if (++moves % 12) return;
      const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0, total = 0;
      for (let k = 3; k < d.length; k += 4 * 40) { total++; if (d[k] < 40) clear++; }
      if (clear / total > .5) reveal();
    };
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); scratch({ ...e, clientX: e.clientX, clientY: e.clientY, buttons: 1 }); });
    canvas.addEventListener('pointermove', scratch);
    addEventListener('resize', () => { if (!done && !moves) setupScratch(); });
    add(section('scratch', 'One more surprise', 'Scratch to', 'reveal', wrap, el('p', { class: 'x-hint' }, 'use your finger (or mouse) to scratch')));
  }

  // ---------- man of the match ----------
  const M = x.motm;
  if (M?.text) {
    const trophy = el('div', { class: 'motm-trophy', 'aria-hidden': 'true' }); trophy.innerHTML = doodleSVG('trophy');
    const btn = el('button', { class: 'btn motm-btn' }, 'Lift the trophy 🏆');
    btn.addEventListener('click', () => {
      roar(); unitedBurst(true);
      btn.textContent = 'GGMU!! 🔴';
      if (anim) gsap.timeline().to(trophy, { y: -60, scale: 1.25, rotation: -8, duration: .5, ease: 'power3.out' })
        .to(trophy, { rotation: 8, duration: .18, yoyo: true, repeat: 5, ease: 'sine.inOut' })
        .to(trophy, { y: 0, scale: 1, rotation: 0, duration: .8, ease: 'bounce.out' });
    });
    add(el('section', { class: 'x-sec motm', id: 'motm' }, el('div', { class: 'motm-board' },
      el('p', { class: 'eyebrow' }, 'Official announcement'), trophy,
      el('p', { class: 'motm-label' }, 'Man of the Match'), el('h2', { class: 'motm-name script' }, who),
      el('p', { class: 'motm-text' }, M.text), btn)));
  }

  return {
    // called once the story is visible: scroll reveals + things that need real sizes
    animate() {
      setupScratch();
      if (!anim) return;
      gsap.utils.toArray('.fut, .pitch, .shot-score, .quiz-card, .ow, .coupon, .scratch-card, .motm-board').forEach((n, k) => {
        gsap.from(n, { y: 80, opacity: 0, scale: .9, rotation: (k % 2 ? 1 : -1) * 4, duration: 1.3, ease: 'expo.out',
          delay: (k % 3) * .08, scrollTrigger: { trigger: n, start: 'top 92%' } });
      });
      const fut = document.querySelector('.fut');
      if (fut) ScrollTrigger.create({ trigger: fut, start: 'top 70%', once: true, onEnter: () => { fut.classList.add('shine'); const [cx, cy] = centre(fut); confetti(cx, cy, 60, .8, ['#f6d77b', '#fff4c9', '#c9a24a']); } });
    },
  };
};
