/* Animations et effets du site AJ. Sans dépendance obligatoire : Lenis (défilement inertiel) est optionnel.
   Tout est désactivé si l'utilisateur préfère réduire les animations, et le site reste lisible sans JavaScript. */
(function () {
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { doc.classList.add('reduce'); return; }

  /* Rideau d'introduction (accueil), une seule fois par session */
  var intro = document.querySelector('.intro');
  var introShown = false;
  if (intro) {
    var seen = false;
    try { seen = sessionStorage.getItem('aj-intro') === '1'; } catch (e) {}
    if (seen) {
      intro.remove();
    } else {
      introShown = true;
      try { sessionStorage.setItem('aj-intro', '1'); } catch (e) {}
      intro.addEventListener('animationend', function (e) { if (e.target === intro) intro.remove(); });
      setTimeout(function () { if (intro.parentNode) intro.remove(); }, 4000);
    }
  }

  /* Titres découpés en mots, qui montent un à un */
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

  /* Apparitions au défilement */
  var hero = document.querySelector('.hero');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  function start() {
    doc.classList.add('ready');
    document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
    if (hero) hero.classList.add('in');
  }
  if (introShown) setTimeout(start, 1400); else start();

  /* En-tête, barre de progression, parallaxe */
  var header = document.querySelector('.site-header');
  var progress = document.querySelector('.progress');
  var parallax = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var lastY = 0, ticking = false;
  function onScroll() {
    var y = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight;
    if (header) {
      header.classList.toggle('glass', y > 40 || header.classList.contains('solid'));
      header.classList.toggle('hide', y > lastY + 2 && y > 240);
    }
    if (progress) {
      var h = doc.scrollHeight - vh;
      progress.style.setProperty('--p', h > 0 ? Math.min(1, y / h).toFixed(4) : 0);
    }
    parallax.forEach(function (el) {
      var box = el.closest('[data-parallax-box]') || el.parentElement;
      var r = box.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      var offset = (r.top + r.height / 2 - vh / 2) * speed;
      el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
    });
    lastY = y; ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* Boutons magnétiques (souris uniquement) */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.btn').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.18;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
  }

  /* Défilement inertiel (Lenis, licence MIT), si présent */
  if (typeof window.Lenis === 'function' && window.matchMedia('(hover: hover)').matches) {
    try {
      var lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
      var raf = function (t) { lenis.raf(t); window.requestAnimationFrame(raf); };
      window.requestAnimationFrame(raf);
    } catch (e) {}
  }
})();
