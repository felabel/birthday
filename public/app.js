// Shared helpers used by every page
window.api = async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
};

window.toast = function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
};

window.el = function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c.nodeType ? c : document.createTextNode(c));
  return node;
};

// Soft smooth scrolling + scroll-triggered reveals, shared by landing pages.
window.smoothScroll = function smoothScroll() {
  if (!window.Lenis || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const lenis = new Lenis({ duration: 1.35, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  if (window.gsap && window.ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  return lenis;
};

window.revealOnScroll = function revealOnScroll(selector = '[data-reveal]') {
  const items = document.querySelectorAll(selector);
  if (!window.gsap || !window.ScrollTrigger) { items.forEach((i) => (i.style.opacity = 1)); return; }
  gsap.registerPlugin(ScrollTrigger);
  items.forEach((item) => {
    gsap.fromTo(item, { y: 50, opacity: 0, filter: 'blur(8px)' }, {
      y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.4, ease: 'expo.out',
      delay: +(item.dataset.delay || 0),
      scrollTrigger: { trigger: item, start: 'top 88%' },
    });
  });
};

// Resize an image file in the browser before upload so cards stay fast.
window.resizeImage = function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
