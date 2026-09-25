/* Socle commun des scènes AJ : contexte partagé window.AJ (données, bibliothèques, bus d'événements, préchargeur).
   Chargé après config.js, site.js, lenis, gsap et ScrollTrigger ; avant photo3d.js et les scènes. */
(function () {
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) doc.classList.add('reduce');
  var G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) { try { G.registerPlugin(ST); } catch (e) { ST = null; } }
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var listeners = {};
  var AJ = window.AJ = {
    reduce: reduce, fine: fine, gsap: G || null, ScrollTrigger: ST || null, lenis: null,
    images: {}, pieces: [], texts: {}, nav: [], brand: {},
    viewport: { w: window.innerWidth, h: window.innerHeight },
    on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit: function (ev, data) { (listeners[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); },
    openPiece: function (slug) { window.location.href = slug + '.html'; },   /* remplacé par la scène detail */
    pictureHTML: function (key, sizes, opts) {
      var i = AJ.images[key]; if (!i) return ''; opts = opts || {};
      var load = opts.eager ? 'decoding="async"' + (opts.priority ? ' fetchpriority="high"' : '') : 'loading="lazy" decoding="async"';
      return '<picture' + (opts.picAttrs || '') + '><source type="image/webp" srcset="' + i.webp768 + ' 768w, ' + i.webp1536 + ' 1536w" sizes="' + sizes + '">' +
        '<img src="' + i.jpg1536 + '" srcset="' + i.jpg768 + ' 768w, ' + i.jpg1536 + ' 1536w" sizes="' + sizes + '" width="1536" height="1024" alt="' + (opts.alt != null ? opts.alt : i.alt) + '" ' + load + (opts.imgAttrs || '') + '></picture>';
    }
  };
  /* Données embarquées (assets/data/pieces.json copié dans un <script type="application/json" id="aj-data"> par le générateur) */
  try {
    var node = document.getElementById('aj-data');
    if (node) { var d = JSON.parse(node.textContent); AJ.images = d.images; AJ.pieces = d.pieces; AJ.texts = d.texts; AJ.nav = d.nav; AJ.brand = d.brand; }
  } catch (e) { console.error('données AJ illisibles', e); }
  window.addEventListener('resize', function () { AJ.viewport.w = window.innerWidth; AJ.viewport.h = window.innerHeight; AJ.emit('resize', AJ.viewport); });

  /* Défilement inertiel */
  if (!reduce && typeof window.Lenis === 'function' && window.matchMedia('(hover: hover)').matches) {
    try {
      var lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
      AJ.lenis = lenis;
      lenis.on('scroll', function (e) { AJ.emit('scroll', e); if (ST) ST.update(); });
      if (G) { G.ticker.add(function (t) { lenis.raf(t * 1000); }); G.ticker.lagSmoothing(0); }
      else { window.requestAnimationFrame(function raf(t) { lenis.raf(t); window.requestAnimationFrame(raf); }); }
    } catch (e) { AJ.lenis = null; }
  }
  if (!AJ.lenis) window.addEventListener('scroll', function () { AJ.emit('scroll', { scroll: window.scrollY, velocity: 0 }); }, { passive: true });

  /* Préchargeur (accueil) : compteur puis rideau ; AJ.ready se résout quand le rideau s'ouvre */
  var loader = document.querySelector('.loader'), resolveReady;
  AJ.ready = new Promise(function (res) { resolveReady = res; });
  var seen = false;
  try { seen = sessionStorage.getItem('aj-intro') === '1'; } catch (e) {}
  if (loader && !reduce && G && !seen) {
    try { sessionStorage.setItem('aj-intro', '1'); } catch (e) {}
    var num = loader.querySelector('.loader-num'), bar = loader.querySelector('.loader-bar i'), inner = loader.querySelector('.loader-inner');
    var counter = { v: 0 };
    G.timeline({ onComplete: function () { if (loader.parentNode) loader.remove(); } })
      .to(counter, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: function () { if (num) num.textContent = Math.round(counter.v); } }, 0)
      .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.7, ease: 'power2.inOut' }, 0)
      .to(inner, { opacity: 0, y: -24, duration: .45, ease: 'power2.in' }, 1.75)
      .to(loader.querySelector('.loader-top'), { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, 2.0)
      .to(loader.querySelector('.loader-bottom'), { yPercent: 100, duration: 1.15, ease: 'expo.inOut', onStart: function () { doc.classList.add('ready'); resolveReady(); AJ.emit('ready'); } }, 2.0);
    setTimeout(function () { if (loader.parentNode) loader.remove(); doc.classList.add('ready'); resolveReady(); }, 6000);
  } else {
    if (loader) loader.remove();
    doc.classList.add('ready'); resolveReady(); setTimeout(function () { AJ.emit('ready'); }, 0);
  }
})();
