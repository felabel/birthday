// ===== Card editor =====
(async function () {
  const slug = location.pathname.split('/').pop();
  const $ = (id) => document.getElementById(id);
  const status = $('status');
  let card, dirty = false;

  try {
    const res = await api(`/api/cards/${slug}`);
    if (!res.isOwner) return location.replace('/dashboard');
    card = res.card;
  } catch (err) {
    if (err.status === 404) return location.replace('/dashboard');
    return location.replace('/login');
  }

  const SIMPLE = ['recipient', 'sender', 'birthday', 'cover', 'headline', 'letter', 'finale'];
  SIMPLE.forEach((k) => ($(k).value = card[k] || ''));
  (document.querySelector(`input[name=theme][value=${card.theme}]`) || document.querySelector('input[name=theme]')).checked = true;
  $('preview').href = `/c/${slug}`;
  $('share-link').value = `${location.origin}/c/${slug}`;
  // Invite friends is turned off for now (see the commented-out panel in edit.html).
  // const setInvite = () => ($('invite-link').value = `${location.origin}/invite/${card.inviteToken}`);
  // setInvite();

  function markDirty() { dirty = true; status.textContent = 'Unsaved changes'; }
  document.querySelector('main').addEventListener('input', markDirty);

  // ---------- memories ----------
  const memList = $('memories');
  function renderMemories() {
    memList.replaceChildren(...card.memories.map((m, i) => {
      const file = el('input', { type: 'file', accept: 'image/*', hidden: true });
      const thumb = el('label', { class: `thumb${m.image ? ' has' : ''}`, style: m.image ? `background-image:url('${m.image}')` : '' }, 'Add photo', file);
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        thumb.textContent = 'Uploading…';
        try { m.image = await upload(file.files[0]); markDirty(); } catch (err) { toast(err.message); }
        renderMemories();
        if (dirty) save();
      });
      const caption = el('input', { class: 'input', placeholder: 'Caption — e.g. Our first date', maxlength: 120, value: m.caption || '' });
      const date = el('input', { class: 'input', placeholder: 'When — e.g. Summer 2024', maxlength: 40, value: m.date || '' });
      caption.addEventListener('input', () => (m.caption = caption.value));
      date.addEventListener('input', () => (m.date = date.value));
      return el('div', { class: 'mem' }, thumb, el('div', { class: 'fields' }, caption, date),
        el('div', { class: 'tools' },
          el('button', { class: 'icon', title: 'Move up', 'aria-label': 'Move up', onclick: () => move(card.memories, i, -1, renderMemories) }, '↑'),
          el('button', { class: 'icon', title: 'Move down', 'aria-label': 'Move down', onclick: () => move(card.memories, i, 1, renderMemories) }, '↓'),
          m.image ? el('button', { class: 'icon', title: 'Remove photo', 'aria-label': 'Remove photo', onclick: () => { m.image = null; markDirty(); renderMemories(); } }, '⌫') : null,
          el('button', { class: 'icon', title: 'Delete memory', 'aria-label': 'Delete memory', onclick: () => { card.memories.splice(i, 1); markDirty(); renderMemories(); } }, '✕')));
    }));
    dispatchEvent(new Event('memories-changed')); // keeps the player-card photo picker in sync
  }
  function move(arr, i, d, rerender) {
    const j = i + d; if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; markDirty(); rerender();
  }
  async function upload(f) {
    let data;
    try { data = await resizeImage(f); } catch { data = null; }
    if (data) return (await api('/api/upload', { method: 'POST', body: { data } })).url;
    // The browser can't read this format (e.g. iPhone HEIC): let the server convert it.
    const res = await fetch('/api/upload-image', { method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f, credentials: 'same-origin' });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Couldn't upload ${f.name}.`);
    return out.url;
  }
  $('add-mem').addEventListener('click', () => { card.memories.push({ caption: '', date: '', image: null }); markDirty(); renderMemories(); });
  $('bulk').addEventListener('change', async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    let failed = 0;
    for (const f of files) {
      status.textContent = `Uploading ${files.indexOf(f) + 1} of ${files.length}…`;
      try { card.memories.push({ caption: '', date: '', image: await upload(f) }); renderMemories(); }
      catch (err) { failed++; toast(err.message || `Couldn't upload ${f.name}.`); }
    }
    markDirty();
    await save(); // keep new photos safe straight away
    if (failed) toast(`${failed} photo${failed > 1 ? 's' : ''} couldn't be uploaded.`);
  });
  renderMemories();

  // ---------- reasons ----------
  const notesList = $('notes');
  function renderNotes() {
    if (!card.notes.length) card.notes.push('');
    notesList.replaceChildren(...card.notes.map((n, i) => {
      const input = el('input', { class: 'input', maxlength: 200, value: n, placeholder: 'e.g. The way you laugh at your own jokes' });
      input.addEventListener('input', () => (card.notes[i] = input.value));
      return el('div', { class: 'reason' }, input, el('div', { class: 'tools' },
        el('button', { class: 'icon', 'aria-label': 'Move up', onclick: () => move(card.notes, i, -1, renderNotes) }, '↑'),
        el('button', { class: 'icon', 'aria-label': 'Delete', onclick: () => { card.notes.splice(i, 1); markDirty(); renderNotes(); } }, '✕')));
    }));
  }
  $('add-note').addEventListener('click', () => {
    card.notes.push(''); renderNotes();
    notesList.lastElementChild.querySelector('input').focus();
  });
  renderNotes();

  // ---------- song ----------
  const AUDIO_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav' };
  function renderMusic() {
    const has = !!card.music;
    $('music-empty').hidden = has;
    $('music-set').hidden = !has;
    if (has) {
      $('music-title').value = card.music.title || '';
      if ($('music-preview').getAttribute('src') !== card.music.url) $('music-preview').src = card.music.url;
    } else $('music-preview').removeAttribute('src');
  }
  document.querySelectorAll('.music-file').forEach((input) => input.addEventListener('change', async () => {
    const f = input.files[0]; input.value = '';
    if (!f) return;
    const type = f.type || AUDIO_TYPES[f.name.split('.').pop().toLowerCase()] || '';
    if (f.size > 25 * 1024 * 1024) return toast('That song is too big (max 25 MB).');
    status.textContent = 'Uploading song…';
    try {
      const res = await fetch('/api/upload-audio', { method: 'POST', headers: { 'Content-Type': type }, body: f, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      card.music = { url: data.url, title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') };
      renderMusic(); markDirty(); toast('Song added ♫');
    } catch (err) { toast(err.message); status.textContent = 'Song upload failed'; }
  }));
  $('music-title').addEventListener('input', () => { if (card.music) card.music.title = $('music-title').value; });
  $('music-remove').addEventListener('click', () => { card.music = null; renderMusic(); markDirty(); });
  renderMusic();

  // ---------- fun stuff (player card, shootout, quiz, letters, coupons, scratch, man of the match) ----------
  const X = card.extras = Object.assign({ player: {}, shootout: {}, quiz: [], openWhen: [], coupons: [], scratch: {}, motm: {} }, card.extras || {});
  const P = X.player = Object.assign({ name: '', number: '', position: '', overall: '', photo: null, ratings: [], stats: [] }, X.player);
  X.shootout = Object.assign({ prizes: [], final: '' }, X.shootout);
  const bind = (id, obj, key) => { const n = $(id); n.value = obj[key] || ''; n.addEventListener('input', () => (obj[key] = n.value)); };
  bind('pl-name', P, 'name'); bind('pl-number', P, 'number'); bind('pl-position', P, 'position'); bind('pl-overall', P, 'overall');
  bind('shot-final', X.shootout, 'final');
  X.scratch = Object.assign({ title: '', text: '' }, X.scratch); bind('sc-title', X.scratch, 'title'); bind('sc-text', X.scratch, 'text');
  X.motm = Object.assign({ text: '' }, X.motm); bind('motm', X.motm, 'text');
  const input = (value, attrs, onInput) => { const n = el('input', { class: 'input', value: value || '', ...attrs }); n.addEventListener('input', () => onInput(n.value)); return n; };
  const del = (onclick) => el('button', { class: 'icon', type: 'button', 'aria-label': 'Delete', onclick: () => { onclick(); markDirty(); } }, '✕');

  function renderPhotos() {
    const imgs = card.memories.map((m) => m.image).filter(Boolean);
    $('pl-photos').replaceChildren(...imgs.map((src) => el('button', { type: 'button', class: `pick${P.photo === src ? ' on' : ''}`, style: `background-image:url('${src}')`,
      'aria-label': 'Use this photo', onclick: () => { P.photo = src; markDirty(); renderPhotos(); } })));
    if (!imgs.length) $('pl-photos').replaceChildren(el('span', { class: 'hint', style: 'margin:0' }, 'Add memory photos first.'));
  }
  function renderRatings() {
    while (P.ratings.length < 6) P.ratings.push({ label: '', value: '' });
    $('pl-ratings').replaceChildren(...P.ratings.map((r) => el('div', { class: 'pair' },
      input(r.label, { maxlength: 40, placeholder: 'e.g. Hugs' }, (v) => (r.label = v)),
      input(r.value, { maxlength: 3, placeholder: '99' }, (v) => (r.value = v)))));
  }
  function renderStats() {
    $('pl-stats').replaceChildren(...P.stats.map((s, i) => el('div', { class: 'pair wide', style: 'margin-bottom:8px' },
      input(s.label, { maxlength: 40, placeholder: 'e.g. Assists' }, (v) => (s.label = v)),
      input(s.value, { maxlength: 40, placeholder: 'e.g. Endless' }, (v) => (s.value = v)),
      del(() => { P.stats.splice(i, 1); renderStats(); }))));
  }
  $('pl-add-stat').addEventListener('click', () => { if (P.stats.length < 8) { P.stats.push({ label: '', value: '' }); renderStats(); } });

  function renderShots() {
    const pr = X.shootout.prizes;
    $('shots').replaceChildren(...[0, 1, 2, 3, 4].map((i) => el('div', { class: 'field' }, el('label', {}, `Goal ${i + 1} unlocks…`),
      input(pr[i], { maxlength: 160, placeholder: i ? '' : 'e.g. GOAL! You\'re my favourite person' }, (v) => (pr[i] = v)))));
  }

  function renderQuiz() {
    $('quiz').replaceChildren(...X.quiz.map((q, qi) => {
      while (q.options.length < 3) q.options.push('');
      const name = `q${qi}-${Math.random().toString(36).slice(2, 6)}`;
      return el('div', { class: 'qbox' },
        el('div', { class: 'item' }, input(q.q, { maxlength: 160, placeholder: 'Question, e.g. Who\'s the better cook?' }, (v) => (q.q = v)),
          del(() => { X.quiz.splice(qi, 1); renderQuiz(); })),
        ...q.options.map((o, oi) => {
          const radio = el('input', { type: 'radio', name, checked: q.answer === oi, 'aria-label': 'Correct answer' });
          radio.addEventListener('change', () => { q.answer = oi; markDirty(); });
          return el('label', { class: 'opt' }, radio, input(o, { maxlength: 80, placeholder: `Answer ${oi + 1}` }, (v) => (q.options[oi] = v)));
        }));
    }));
  }
  $('add-q').addEventListener('click', () => { if (X.quiz.length < 8) { X.quiz.push({ q: '', options: ['', '', ''], answer: 0 }); markDirty(); renderQuiz(); } });

  function renderOw() {
    $('ow').replaceChildren(...X.openWhen.map((o, i) => {
      const text = el('textarea', { class: 'input', rows: 3, maxlength: 1500, placeholder: 'What the letter says…' }); text.value = o.text || '';
      text.addEventListener('input', () => (o.text = text.value));
      return el('div', { class: 'item' }, el('div', { class: 'stack' },
        input(o.label, { maxlength: 60, placeholder: 'Open when… e.g. you miss me' }, (v) => (o.label = v)), text),
        del(() => { X.openWhen.splice(i, 1); renderOw(); }));
    }));
  }
  $('add-ow').addEventListener('click', () => { if (X.openWhen.length < 8) { X.openWhen.push({ label: '', text: '' }); markDirty(); renderOw(); } });

  function renderCoupons() {
    $('coupons').replaceChildren(...X.coupons.map((c, i) => el('div', { class: 'item' },
      input(c, { maxlength: 100, placeholder: 'e.g. One free massage' }, (v) => (X.coupons[i] = v)),
      del(() => { X.coupons.splice(i, 1); renderCoupons(); }))));
  }
  $('add-coupon').addEventListener('click', () => { if (X.coupons.length < 12) { X.coupons.push(''); markDirty(); renderCoupons(); } });

  addEventListener('memories-changed', renderPhotos);
  renderPhotos(); renderRatings(); renderStats(); renderShots(); renderQuiz(); renderOw(); renderCoupons();

  // ---------- guest messages ----------
  // function renderMessages() {
  //   const box = $('messages');
  //   if (!card.messages.length) return box.replaceChildren(el('p', { class: 'hint', style: 'margin:0' }, 'No messages yet — share the invite link above.'));
  //   box.replaceChildren(...[...card.messages].reverse().map((m) => el('div', { class: 'msg' },
  //     el('div', {}, el('p', {}, m.text), el('small', {}, `— ${m.name}`)),
  //     el('button', { class: 'icon', 'aria-label': 'Delete message', onclick: async () => {
  //       if (!confirm(`Remove ${m.name}'s message?`)) return;
  //       await api(`/api/cards/${slug}/messages/${m.id}`, { method: 'DELETE' });
  //       card.messages = card.messages.filter((x) => x.id !== m.id); renderMessages(); toast('Message removed');
  //     } }, '✕'))));
  // }
  // renderMessages();

  // $('reset-invite').addEventListener('click', async () => {
  //   if (!confirm('Make a new invite link? The old one will stop working.')) return;
  //   const res = await api(`/api/cards/${slug}`, { method: 'PUT', body: { regenerateInvite: true } });
  //   card.inviteToken = res.card.inviteToken; setInvite(); toast('New invite link ready');
  // });

  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const input = $(b.dataset.copy);
    try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
    toast('Link copied ♥');
  }));

  // ---------- save ----------
  async function save() {
    const body = { baseUpdatedAt: card.updatedAt, extras: card.extras, music: card.music || null, memories: card.memories, notes: card.notes.filter((n) => n.trim()), theme: document.querySelector('input[name=theme]:checked').value };
    SIMPLE.forEach((k) => (body[k] = $(k).value));
    $('save').disabled = true; status.textContent = 'Saving…';
    try {
      const res = await api(`/api/cards/${slug}`, { method: 'PUT', body });
      card.updatedAt = res.card.updatedAt;
      dirty = false; status.textContent = 'All changes saved'; toast('Saved ♥');
    } catch (err) {
      status.textContent = 'Could not save'; toast(err.message);
      if (err.status === 409 && confirm(`${err.message}\n\nReload now?`)) { dirty = false; location.reload(); }
    }
    $('save').disabled = false;
  }
  $('save').addEventListener('click', save);
  $('preview').addEventListener('click', async (e) => { if (dirty) { e.preventDefault(); await save(); window.open(`/c/${slug}`, '_blank'); } });
  addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } });
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
