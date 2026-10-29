// Silly hand-drawn doodles (think black icing on a cake) that wiggle around the card.
// Classes inside each SVG: "f" = filled with ink, "w" = filled with paper.
window.DOODLES = {
  blob: '<path class="w" d="M22 58 Q19 22 50 20 Q81 19 78 57 Q50 62 22 58Z"/><circle class="f" cx="42" cy="40" r="3"/><circle class="f" cx="58" cy="40" r="3"/><path d="M44 50 Q50 54 56 49"/><path d="M40 59 L37 80 L30 82 M60 59 L63 80 L70 81"/>',
  cat: '<path class="w" d="M15 75 Q14 50 34 48 L66 47 Q86 48 85 74 Q50 79 15 75Z"/><path class="w" d="M24 52 L27 34 L38 48 M62 48 L73 34 L76 52"/><circle class="f" cx="40" cy="60" r="2.6"/><circle class="f" cx="60" cy="60" r="2.6"/><path d="M47 66 Q50 69 53 66 M6 61 L25 64 M6 70 L25 68 M94 61 L75 64 M94 70 L75 68"/>',
  party: '<path class="w" d="M38 30 L50 6 L63 30Z"/><circle class="f" cx="50" cy="6" r="4"/><circle class="w" cx="50" cy="42" r="13"/><circle class="f" cx="45" cy="40" r="2"/><circle class="f" cx="55" cy="40" r="2"/><path d="M45 47 Q50 51 55 47 M50 55 L50 78 M50 62 L34 52 M50 62 L67 50 M50 78 L40 95 M50 78 L61 95"/>',
  squiggle: '<path d="M6 55 C16 25 26 85 36 55 S56 25 66 55 S86 85 94 50"/>',
  ghost: '<path class="w" d="M28 86 L28 46 Q28 18 50 18 Q72 18 72 46 L72 86 L64 78 L57 86 L50 78 L43 86 L36 78Z"/><circle class="f" cx="42" cy="44" r="3"/><circle class="f" cx="58" cy="44" r="3"/><ellipse cx="50" cy="58" rx="4" ry="5"/>',
  balloon: '<path class="w" d="M50 12 C70 12 76 30 72 44 C68 58 56 64 50 64 C44 64 32 58 28 44 C24 30 30 12 50 12Z"/><path d="M47 64 L53 64 L50 69 Z M50 69 C42 78 58 84 48 96"/><path d="M38 28 Q40 22 46 21"/>',
  sun: '<circle class="w" cx="50" cy="50" r="20"/><path d="M50 8 L50 20 M50 80 L50 92 M8 50 L20 50 M80 50 L92 50 M20 20 L28 28 M72 72 L80 80 M80 20 L72 28 M20 80 L28 72"/><path class="f" d="M36 44 L48 44 L46 52 Q40 54 37 50Z M52 44 L64 44 L63 50 Q60 54 54 52Z"/><path d="M48 46 L52 46 M42 60 Q50 65 58 60"/>',
  star: '<path class="w" d="M50 8 L61 36 L91 37 L67 56 L76 86 L50 68 L24 86 L33 56 L9 37 L39 36Z"/><circle class="f" cx="43" cy="48" r="2.5"/><circle class="f" cx="57" cy="48" r="2.5"/><path d="M45 57 Q50 61 55 57"/>',
  crown: '<path class="w" d="M16 72 L12 30 L32 50 L50 22 L68 50 L88 30 L84 72Z"/><path d="M16 82 L84 82"/><circle class="f" cx="50" cy="56" r="4"/>',
  heart: '<path class="w" d="M50 84 C20 62 10 46 14 32 C18 18 38 14 50 32 C62 14 82 18 86 32 C90 46 80 62 50 84Z"/><path d="M30 34 Q34 28 40 30"/>',
  snail: '<path d="M10 78 L80 78 Q92 78 90 66 L84 60"/><circle class="w" cx="50" cy="56" r="20"/><path d="M50 48 a8 8 0 1 1 -8 8 a4 4 0 1 1 4 -4"/><path d="M84 60 L80 44 M88 60 L92 44"/><circle class="f" cx="80" cy="42" r="2.5"/><circle class="f" cx="92" cy="42" r="2.5"/>',
  worm: '<path d="M12 80 C22 60 32 90 42 70 S62 55 70 50"/><circle class="w" cx="78" cy="42" r="11"/><circle class="f" cx="75" cy="40" r="2"/><circle class="f" cx="82" cy="40" r="2"/><path d="M75 47 Q78 49 81 47 M70 32 L66 20 L76 26 L80 14 L84 29"/>',
};
window.DOODLE_WORDS = ['hbd!!', 'yay!!', 'ily', 'old man lol', 'cutie', 'party time', 'wish big', 'wooo', 'ur the best', 'cake pls'];

window.doodleSVG = function (name) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${window.DOODLES[name]}</svg>`;
};

// Build one wiggly doodle element (an SVG or a scribbled word).
window.makeDoodle = function (kind, size) {
  const d = document.createElement('div');
  d.className = 'doodle';
  d.style.width = `${size}px`;
  const wig = document.createElement('div');
  wig.className = 'wig';
  wig.style.animationDelay = `${(-Math.random()).toFixed(2)}s`;
  wig.style.animationDuration = `${(.5 + Math.random() * .4).toFixed(2)}s`;
  if (kind.startsWith('word:')) { wig.classList.add('word'); wig.textContent = kind.slice(5); wig.style.fontSize = `${size * .32}px`; }
  else wig.innerHTML = window.doodleSVG(kind);
  const hop = document.createElement('div');
  hop.className = 'hop';
  hop.append(wig);
  d.append(hop);
  return d;
};

// Make a doodle hop and spin when tapped.
window.boop = function (d, onBoop) {
  d.addEventListener('click', (e) => {
    const hop = d.querySelector('.hop');
    if (window.gsap && !gsap.isTweening(hop)) gsap.timeline()
      .to(hop, { y: '-=40', rotation: '+=360', scale: 1.25, duration: .5, ease: 'power2.out' })
      .to(hop, { y: '+=40', scale: 1, duration: .6, ease: 'bounce.out' });
    onBoop?.(e.clientX, e.clientY);
  });
};
