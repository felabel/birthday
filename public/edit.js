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
    const body = { music: card.music || null, memories: card.memories, notes: card.notes.filter((n) => n.trim()), theme: document.querySelector('input[name=theme]:checked').value };
    SIMPLE.forEach((k) => (body[k] = $(k).value));
    $('save').disabled = true; status.textContent = 'Saving…';
    try {
      await api(`/api/cards/${slug}`, { method: 'PUT', body });
      dirty = false; status.textContent = 'All changes saved'; toast('Saved ♥');
    } catch (err) { status.textContent = 'Could not save'; toast(err.message); }
    $('save').disabled = false;
  }
  $('save').addEventListener('click', save);
  $('preview').addEventListener('click', async (e) => { if (dirty) { e.preventDefault(); await save(); window.open(`/c/${slug}`, '_blank'); } });
  addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } });
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
