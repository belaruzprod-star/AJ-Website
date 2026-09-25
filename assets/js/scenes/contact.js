/* AJ — scène « contact » (scène finale et pied de page).
   S'initialise seule sur [data-scene="contact"] ; sans cet élément, ne fait rien.
   Rôle : découper le titre en lettres et les faire entrer en profondeur (une fois, à l'arrivée de la scène),
   apparition des textes et du pied de page, décodage des liens au survol, inclinaison du champ de lignes
   à la souris, léger parallaxe au défilement. Sans GSAP, en mode « reduce » ou sans JS : tout est visible à plat. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- Réglages */
  var TITLE_STAGGER = 0.045;      /* s entre deux lettres */
  var TITLE_DURATION = 1.5;       /* s par lettre */
  var TITLE_DEPTH = -720;         /* px : les lettres viennent de cette profondeur (translateZ) */
  var TITLE_ROTATE = -55;         /* deg : bascule rotateX de départ */
  var TITLE_BLUR = 14;            /* px : flou de départ */
  var TITLE_RISE = 40;            /* % de la hauteur d'une lettre : montée de départ */
  var TEXT_DELAY = 0.55;          /* s : départ des textes après le début des lettres */
  var TEXT_STAGGER = 0.12;        /* s entre lead, adresse, Instagram, note */
  var FOOT_STAGGER = 0.07;        /* s entre les éléments du pied de page */
  var START = 'top 88%';          /* ScrollTrigger : quand le haut du titre atteint 88 % de l'écran */
  var FOOT_START = 'top 92%';     /* idem pour le pied de page */
  var PARALLAX_Y = -70;           /* px : dérive du champ pendant la traversée de la scène (scrub) */
  var TITLE_PARALLAX_Y = -36;     /* px : dérive du titre */
  var TILT_DEG = 1.4;             /* deg : inclinaison maximale du champ à la souris */
  var DECODE_MS = 620;            /* ms : durée du décodage d'un lien */
  var DECODE_CHARS = 'ABCDEFGHIJKLNOPQRSTUVXYZabcdefghijklnopqrstuvxyzéèàçùâêîôû·';
  var MAIL_MIN = 22;              /* px : taille minimale de l'adresse quand on la réduit pour tenir sur une ligne */

  var section = document.querySelector('[data-scene="contact"]');
  if (!section) return;

  var AJ = window.AJ || {};
  var G = AJ.gsap || window.gsap || null;
  var ST = AJ.ScrollTrigger || window.ScrollTrigger || null;
  var reduce = AJ.reduce != null ? !!AJ.reduce : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = AJ.fine != null ? !!AJ.fine : window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var ready = AJ.ready && typeof AJ.ready.then === 'function' ? AJ.ready : Promise.resolve();

  var title = section.querySelector('.contact-title');
  var field = section.querySelector('.contact-field');
  var space = section.querySelector('.contact-space');
  var foot = section.querySelector('.contact-foot');
  var texts = [].slice.call(section.querySelectorAll('.contact-lead, [data-aj="email"], [data-aj="instagram"], .contact-note'))
    .filter(function (el) { return !el.hidden; });
  var footItems = [].slice.call(section.querySelectorAll('.contact-mono, .contact-baseline, .contact-nav a, .contact-legal'));
  var navTexts = [].slice.call(section.querySelectorAll('.contact-nav a .t'));

  var api = window.AJ ? (AJ.contact = {}) : {};
  api.section = section;
  var decoding = new WeakMap();   /* liens en cours de décodage (utilisé aussi sans GSAP) */

  /* ---------------------------------------------------------------- Adresse injectée : tenir sur une ligne */
  function fitEmail() {
    var p = section.querySelector('[data-aj="email"].contact-big'), a = p && p.querySelector('a');
    if (!a) return;
    p.style.fontSize = '';
    var avail = p.clientWidth;               /* mesuré avant nowrap : la colonne ne doit pas s'élargir avec le texte */
    a.style.whiteSpace = 'nowrap';
    var w = a.getBoundingClientRect().width;
    if (w > avail && avail > 0) {
      var fs = parseFloat(getComputedStyle(p).fontSize);
      p.style.fontSize = Math.max(MAIL_MIN, Math.floor(fs * avail / w)) + 'px';
    }
    a.style.whiteSpace = '';
  }
  fitEmail();
  window.addEventListener('resize', fitEmail);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitEmail);
  api.fitEmail = fitEmail;

  /* ---------------------------------------------------------------- Repli : tout visible, rien d'animé */
  function showAll() {
    section.classList.add('is-in', 'is-foot-in');
  }
  if (reduce || !G) { showAll(); bindDecode(); return; }

  /* ---------------------------------------------------------------- Découpage du titre en lettres */
  function splitTitle() {
    if (!title || title.classList.contains('is-split')) return [];
    var label = title.textContent.replace(/\s+/g, ' ').trim();
    var words = [].slice.call(title.querySelectorAll('.w'));
    if (!words.length) {
      /* Titre collé sans <span class="w"> : on fabrique les mots, le dernier en contour */
      var parts = label.split(' ');
      title.textContent = '';
      parts.forEach(function (p, i) {
        var w = document.createElement('span');
        w.className = 'w' + (i === parts.length - 1 && parts.length > 1 ? ' w-outline' : '');
        w.textContent = p;
        title.appendChild(w);
        if (i < parts.length - 1) title.appendChild(document.createTextNode(' '));
      });
      words = [].slice.call(title.querySelectorAll('.w'));
    }
    var chars = [];
    words.forEach(function (w) {
      var txt = w.textContent;
      w.textContent = '';
      w.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(txt, function (ch) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch === ' ' ? ' ' : ch;
        w.appendChild(s);
        chars.push(s);
      });
    });
    title.setAttribute('aria-label', label);
    title.classList.add('is-split');
    return chars;
  }

  var chars = splitTitle();

  /* ---------------------------------------------------------------- Entrée de la scène (une fois) */
  var tl = G.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  if (chars.length) {
    tl.fromTo(chars,
      { opacity: 0, z: TITLE_DEPTH, yPercent: TITLE_RISE, rotationX: TITLE_ROTATE, filter: 'blur(' + TITLE_BLUR + 'px)' },
      { opacity: 1, z: 0, yPercent: 0, rotationX: 0, filter: 'blur(0px)', duration: TITLE_DURATION, stagger: TITLE_STAGGER, clearProps: 'filter', immediateRender: true }, 0);
  }
  if (field) tl.fromTo(field, { opacity: 0 }, { opacity: 1, duration: 2.4, ease: 'power1.out', immediateRender: true }, 0);
  if (texts.length) tl.fromTo(texts, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.2, stagger: TEXT_STAGGER, immediateRender: true }, TEXT_DELAY);
  section.classList.add('is-in');   /* l'état initial est déjà posé en ligne par fromTo : pas de flash */

  var ftl = G.timeline({ paused: true, defaults: { ease: 'expo.out' } });
  if (footItems.length) ftl.fromTo(footItems, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.1, stagger: FOOT_STAGGER, immediateRender: true }, 0);
  section.classList.add('is-foot-in');

  api.tl = tl; api.footTl = ftl;
  api.replay = function () { tl.restart(); ftl.restart(); };

  function bindDecode() {
    if (reduce) return;
    navTexts.forEach(function (t) {
      var a = t.closest('a') || t;
      if (fine) a.addEventListener('pointerenter', function () { decode(t); });
      a.addEventListener('focus', function () { decode(t); });
    });
  }

  ready.then(function () {
    if (ST) {
      ST.create({ trigger: title || section, start: START, once: true, onEnter: function () { tl.play(); } });
      ST.create({ trigger: foot || section, start: FOOT_START, once: true, onEnter: function () { ftl.play(); } });
      /* Parallaxe léger pendant la traversée : profondeur entre le champ et le titre */
      if (space) G.fromTo(space, { y: 0 }, { y: PARALLAX_Y, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
      if (title) G.fromTo(title, { y: 0 }, { y: TITLE_PARALLAX_Y, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          if (e.target === (title || section)) tl.play(); else ftl.play();
          io.unobserve(e.target);
        });
      }, { threshold: 0.15 });
      io.observe(title || section); if (foot) io.observe(foot);
    } else { tl.play(); ftl.play(); }
    bindTilt();
    bindDecode();
  });

  /* ---------------------------------------------------------------- Inclinaison du champ à la souris (bureau) */
  function bindTilt() {
    if (!fine || !space) return;
    var active = false;
    var rx = G.quickTo(space, 'rotationX', { duration: 1.4, ease: 'power2.out' });
    var ry = G.quickTo(space, 'rotationY', { duration: 1.4, ease: 'power2.out' });
    if (ST) ST.create({ trigger: section, start: 'top bottom', end: 'bottom top',
      onToggle: function (s) { active = s.isActive; if (!active) { rx(0); ry(0); } } });
    else active = true;
    window.addEventListener('pointermove', function (e) {
      if (!active) return;
      var nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
      ry(nx * TILT_DEG * 2);
      rx(-ny * TILT_DEG * 2);
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- Décodage caractère par caractère */
  function decode(el) {
    if (decoding.get(el)) return;
    var final = el.getAttribute('data-text') || el.textContent;
    el.setAttribute('data-text', final);
    if (!el.style.minWidth && el.offsetWidth) el.style.minWidth = el.offsetWidth + 'px';
    decoding.set(el, true);
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / DECODE_MS), out = '';
      for (var i = 0; i < final.length; i++) {
        var ch = final[i];
        out += (ch === ' ' || ch === ' ' || ch === ' ' || i / final.length < p) ? ch
          : DECODE_CHARS[(Math.random() * DECODE_CHARS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step); else { el.textContent = final; decoding.set(el, false); }
    })(t0);
  }
})();
