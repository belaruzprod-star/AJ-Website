/* Animations et effets du site AJ. Dépendances optionnelles : Lenis (défilement inertiel), GSAP + ScrollTrigger
   (préchargeur, galerie épinglée), hero-gl.js (hero WebGL). Tout est désactivé si l'utilisateur préfère réduire
   les animations, et le site reste lisible sans JavaScript. */
(function () {
  var doc = document.documentElement;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { doc.classList.add('reduce'); return; }
  var G = window.gsap, ST = window.ScrollTrigger;
  if (G && ST) { try { G.registerPlugin(ST); } catch (e) { ST = null; } }
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var vh = window.innerHeight;
  window.addEventListener('resize', function () { vh = window.innerHeight; });

  /* ---------------------------------------------------------------- Défilement inertiel */
  var lenis = null, velocity = 0, dir = 1;
  if (typeof window.Lenis === 'function' && window.matchMedia('(hover: hover)').matches) {
    try {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
      lenis.on('scroll', function (e) { velocity = e.velocity || 0; if (velocity > 0.5) dir = 1; else if (velocity < -0.5) dir = -1; if (ST) ST.update(); });
      if (G) { G.ticker.add(function (t) { lenis.raf(t * 1000); }); G.ticker.lagSmoothing(0); }
      else { window.requestAnimationFrame(function raf(t) { lenis.raf(t); window.requestAnimationFrame(raf); }); }
    } catch (e) { lenis = null; }
  }
  if (!lenis) {
    var lastScrollY = window.scrollY || 0;
    window.addEventListener('scroll', function () { var y = window.scrollY || 0; velocity = (y - lastScrollY); if (velocity > 0.5) dir = 1; else if (velocity < -0.5) dir = -1; lastScrollY = y; }, { passive: true });
  }

  /* ---------------------------------------------------------------- Préchargeur (accueil), une fois par session */
  var loader = document.querySelector('.loader'), startDelay = 0;
  if (loader) {
    var seen = false;
    try { seen = sessionStorage.getItem('aj-intro') === '1'; } catch (e) {}
    if (seen || !G) { loader.remove(); }
    else {
      try { sessionStorage.setItem('aj-intro', '1'); } catch (e) {}
      var num = loader.querySelector('.loader-num'), bar = loader.querySelector('.loader-bar i'), inner = loader.querySelector('.loader-inner');
      var counter = { v: 0 };
      G.timeline({ onComplete: function () { if (loader.parentNode) loader.remove(); } })
        .to(counter, { v: 100, duration: 1.7, ease: 'power2.inOut', onUpdate: function () { num.textContent = Math.round(counter.v); } }, 0)
        .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.7, ease: 'power2.inOut' }, 0)
        .to(inner, { opacity: 0, y: -24, duration: .45, ease: 'power2.in' }, 1.75)
        .to(loader.querySelector('.loader-top'), { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, 2.0)
        .to(loader.querySelector('.loader-bottom'), { yPercent: 100, duration: 1.15, ease: 'expo.inOut' }, 2.0);
      startDelay = 2050;
      setTimeout(function () { if (loader.parentNode) loader.remove(); }, 6000);
    }
  }

  /* ---------------------------------------------------------------- Texte : découpe en mots, décodage */
  document.querySelectorAll('[data-split]').forEach(function (el) {
    var i = 0;
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType !== 3) return;
      var frag = document.createDocumentFragment();
      node.textContent.split(/([ \n\t]+)/).forEach(function (part) {
        if (!part) return;
        if (/^[ \n\t]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var w = document.createElement('span'); w.className = 'w';
        var wi = document.createElement('span'); wi.className = 'wi';
        wi.textContent = part; wi.style.setProperty('--i', i++);
        w.appendChild(wi); frag.appendChild(w);
      });
      el.replaceChild(frag, node);
    });
    el.setAttribute('data-reveal', '');
  });
  var CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/·';
  var scrambling = new WeakMap();
  function scramble(el, dur) {
    if (scrambling.get(el)) return;
    var final = el.getAttribute('data-text') || el.textContent;
    el.setAttribute('data-text', final);
    if (!el.style.minWidth && el.offsetWidth) el.style.minWidth = el.offsetWidth + 'px';
    scrambling.set(el, true);
    var t0 = performance.now(); dur = dur || 650;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), out = '';
      for (var i = 0; i < final.length; i++) {
        var ch = final[i];
        out += (ch === ' ' || ch === ' ' || ch === ' ' || ch === '·' || i / final.length < p) ? ch : CHARS[(Math.random() * CHARS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) window.requestAnimationFrame(step); else { el.textContent = final; scrambling.set(el, false); }
    })(t0);
  }
  if (fine) document.querySelectorAll('.nav a[data-scramble], .btn[data-scramble]').forEach(function (el) {
    el.addEventListener('pointerenter', function () { scramble(el, 500); });
  });

  /* ---------------------------------------------------------------- Apparitions au défilement */
  var hero = document.querySelector('.hero');
  var pending = [];
  function reveal() {
    if (!pending.length) return;
    var keep = [];
    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      if (el.getBoundingClientRect().top < vh) {
        el.classList.add('in');
        if (el.hasAttribute('data-scramble')) scramble(el, 800);
      } else keep.push(el);
    }
    pending = keep;
  }
  function start() {
    doc.classList.add('ready');
    pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    reveal();
    if (hero) { hero.classList.add('in'); if (window.AJ_heroReveal) window.AJ_heroReveal(); }
  }
  if (startDelay) setTimeout(start, startDelay); else start();

  /* ---------------------------------------------------------------- En-tête, progression, parallaxe, cisaillement, bande */
  var header = document.querySelector('.site-header');
  var progress = document.querySelector('.progress');
  var parallax = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var track = document.querySelector('.marquee .track'), trackX = 0, trackHalf = 0;
  function measureTrack() { trackHalf = track ? track.scrollWidth / 2 : 0; }
  measureTrack(); window.addEventListener('resize', measureTrack);
  var lastY = -1, skew = 0;
  function tick() {
    var y = window.scrollY || window.pageYOffset || 0;
    if (y !== lastY) {
      if (header) {
        header.classList.toggle('glass', y > 40 || header.classList.contains('solid'));
        header.classList.toggle('hide', y > lastY + 2 && y > 240 && lastY >= 0);
      }
      if (progress) { var h = doc.scrollHeight - vh; progress.style.setProperty('--p', h > 0 ? Math.min(1, y / h).toFixed(4) : 0); }
      parallax.forEach(function (el) {
        var box = el.closest('[data-parallax-box]') || el.parentElement;
        var r = box.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
        el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * speed).toFixed(1) + 'px,0)';
      });
      reveal();
      lastY = y;
    }
    /* cisaillement des images selon la vitesse, retour progressif */
    var targetSkew = Math.max(-7, Math.min(7, velocity * 0.05));
    skew += (targetSkew - skew) * 0.12;
    velocity *= 0.9;
    doc.style.setProperty('--skew', skew.toFixed(3) + 'deg');
    /* bande défilante : avance seule, accélère et suit le sens du défilement */
    if (track && trackHalf) {
      trackX -= (0.7 + Math.min(Math.abs(skew) * 1.2, 8)) * dir;
      if (trackX <= -trackHalf) trackX += trackHalf; if (trackX > 0) trackX -= trackHalf;
      track.style.transform = 'translate3d(' + trackX.toFixed(1) + 'px,0,0)';
    }
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);

  /* ---------------------------------------------------------------- Galerie de campagne épinglée (bureau) */
  var stripSection = document.querySelector('[data-strip]');
  var strip = stripSection && stripSection.querySelector('.strip');
  if (strip && G && ST && window.matchMedia('(min-width: 1024px) and (min-height: 600px)').matches) {
    stripSection.classList.add('pinned');
    var travel = function () {
      var last = strip.lastElementChild, gutter = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
      return Math.max(0, last.offsetLeft + last.offsetWidth + gutter - window.innerWidth);
    };
    G.to(strip, { x: function () { return -travel(); }, ease: 'none',
      scrollTrigger: { trigger: stripSection, start: 'top top', end: function () { return '+=' + travel(); }, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } });
    window.addEventListener('load', function () { ST.refresh(); });
  }

  /* ---------------------------------------------------------------- Souris : curseur, inclinaison 3D des cartes, boutons magnétiques */
  if (fine) {
    var cur = document.querySelector('.cursor');
    if (cur) {
      doc.classList.add('has-cursor');
      var dot = cur.querySelector('.cursor-dot'), ring = cur.querySelector('.cursor-ring'), label = cur.querySelector('.cursor-label');
      var mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my;
      window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; cur.classList.add('on'); }, { passive: true });
      doc.addEventListener('mouseleave', function () { cur.classList.remove('on'); });
      window.addEventListener('pointerdown', function () { cur.classList.add('down'); });
      window.addEventListener('pointerup', function () { cur.classList.remove('down'); });
      document.addEventListener('pointerover', function (e) {
        var view = e.target.closest && e.target.closest('[data-cursor="view"]');
        var link = e.target.closest && e.target.closest('a, button, .btn, [data-cursor="link"]');
        cur.classList.toggle('view', !!view);
        cur.classList.toggle('link', !view && !!link);
        if (view) label.textContent = view.getAttribute('data-cursor-label') || 'Voir';
      });
      (function loop() {
        rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
        dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
        window.requestAnimationFrame(loop);
      })();
    }
    document.querySelectorAll('.card').forEach(function (card) {
      var pic = card.querySelector('.pic'); if (!pic) return;
      card.addEventListener('pointermove', function (e) {
        var r = pic.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        pic.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        pic.style.setProperty('--ry', ((px - 0.5) * 12).toFixed(2) + 'deg');
        pic.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        pic.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () { pic.style.setProperty('--rx', '0deg'); pic.style.setProperty('--ry', '0deg'); });
    });
    document.querySelectorAll('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }
})();
