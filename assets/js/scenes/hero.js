/* Scène « hero » : image 07 en Photo3D (repli : <picture>), entrée des mots du titre en 3D (montée + rotateX + flou,
   échelonnée) après AJ.ready, parallaxe souris du bloc titre (deux couches à amplitudes différentes), sortie au
   défilement (section épinglée sur +100vh, scrub : l'image recule et s'efface, le texte disparaît plus vite).
   Repli : sans GSAP/ScrollTrigger ou en mouvement réduit, tout reste à plat et visible ; sans AJ.Photo3D, l'image reste. */
(function () {
  'use strict';

  /* ---- Réglages ------------------------------------------------------------- */
  var IMAGE = '07';            /* clé de l'image dans AJ.images */
  var AMOUNT = 1.4;            /* amplitude Photo3D (0.5–2) : fort */
  var DISSOLVE = true;         /* apparition par dissolution (Photo3D) */
  var MIST = true;             /* brume légère (Photo3D) */
  var SCROLL3D = true;         /* décalage Photo3D selon la position dans l'écran */
  var GYRO = false;            /* gyroscope mobile (permission iOS sur geste, gérée par Photo3D) */
  var ENTER_DELAY = 0.15;      /* s avant le premier mot, après AJ.ready */
  var WORD_DURATION = 1.4;     /* s : montée d'un mot */
  var WORD_STAGGER = 0.12;     /* s entre deux mots */
  var PARALLAX_BLOCK = 14;     /* px : amplitude souris du bloc titre */
  var PARALLAX_LAYER2 = 26;    /* px : amplitude souris de la seconde ligne (couche proche) */
  var LAYER2_Z = 40;           /* px : translateZ de la seconde ligne (même valeur que hero.css) */
  var PIN_LENGTH = function () { return window.innerHeight; };   /* hauteur de défilement de la sortie : +100vh */
  var PIN_SPACING = false;      /* false : la scène suivante glisse par-dessus pendant la sortie (elle doit alors être opaque et au-dessus) */
  var SCRUB = 0.6;             /* lissage du scrub (s) */
  var EXIT_SCALE = 0.86;       /* échelle finale de l'image */
  var EXIT_TEXT_Y = -70;       /* px : dérive verticale du texte pendant la sortie */
  var TEXT_SPEED = 0.5;        /* fraction de la sortie pendant laquelle le texte disparaît (image : 1) */

  var AJ = window.AJ; if (!AJ) return;
  var section = document.querySelector('[data-scene="hero"]'); if (!section) return;
  var G = AJ.gsap, ST = AJ.ScrollTrigger;
  var media = section.querySelector('.hero-media');
  var content = section.querySelector('.hero-content');
  var text = section.querySelector('.hero-text');
  var title = section.querySelector('.hero-title');
  var layer2 = section.querySelector('.hero-l2');
  var words = title ? title.querySelectorAll('.wi') : [];
  var rest = section.querySelectorAll('.hero-eyebrow, .hero-lead, .hero-cta, .hero-scroll');
  var animate = !AJ.reduce && !!G && words.length > 0;

  section.classList.add('hero-js');

  /* État initial, posé de façon synchrone (le préchargeur couvre encore l'écran) */
  if (animate) {
    G.set(words, { yPercent: 110, rotateX: -50, opacity: 0, filter: 'blur(8px)', transformOrigin: '50% 100%' });
    G.set(rest, { opacity: 0, y: 18 });
    if (layer2) G.set(layer2, { z: LAYER2_Z });
  }

  /* ---- Photo3D (facultatif) ------------------------------------------------- */
  var photo = null;
  function attachPhoto3D() {
    if (!media || !AJ.Photo3D || typeof AJ.Photo3D.attach !== 'function') return;
    try {
      photo = AJ.Photo3D.attach(media, {
        key: IMAGE, amount: AMOUNT, dissolve: DISSOLVE && !AJ.reduce, mist: MIST, scroll: SCROLL3D, gyro: GYRO,
        onReady: function () { section.classList.add('hero-3d'); }
      });
    } catch (e) { photo = null; if (window.console) console.warn('hero : Photo3D indisponible, image statique', e); }
  }

  /* ---- Entrée ---------------------------------------------------------------- */
  function enter() {
    attachPhoto3D();
    if (!animate) { section.classList.add('is-in'); return; }
    var tl = G.timeline({ onComplete: function () { section.classList.add('is-in'); } });
    tl.to(words, {
      yPercent: 0, rotateX: 0, opacity: 1, filter: 'blur(0px)', duration: WORD_DURATION, stagger: WORD_STAGGER, ease: 'expo.out',
      onComplete: function () { G.set(words, { clearProps: 'filter' }); }
    }, ENTER_DELAY)
      .to(rest, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'power3.out' }, ENTER_DELAY + 0.55);
  }
  if (AJ.ready && typeof AJ.ready.then === 'function') AJ.ready.then(enter); else enter();

  /* ---- Parallaxe souris (bloc titre ±14 px, seconde ligne ±26 px) ------------- */
  if (animate && AJ.fine && text) {
    var toX, toY, to2X, to2Y;
    if (G.quickTo) {
      var q = { duration: 1, ease: 'power3.out' };
      toX = G.quickTo(text, 'x', q); toY = G.quickTo(text, 'y', q);
      if (layer2) { to2X = G.quickTo(layer2, 'x', q); to2Y = G.quickTo(layer2, 'y', q); }
    } else {
      toX = function (v) { G.to(text, { x: v, duration: 1, ease: 'power3.out', overwrite: 'auto' }); };
      toY = function (v) { G.to(text, { y: v, duration: 1, ease: 'power3.out', overwrite: 'auto' }); };
      if (layer2) {
        to2X = function (v) { G.to(layer2, { x: v, duration: 1, ease: 'power3.out', overwrite: 'auto' }); };
        to2Y = function (v) { G.to(layer2, { y: v, duration: 1, ease: 'power3.out', overwrite: 'auto' }); };
      }
    }
    var visible = true;
    window.addEventListener('pointermove', function (e) {
      if (!visible) return;
      var nx = (e.clientX / AJ.viewport.w) * 2 - 1, ny = (e.clientY / AJ.viewport.h) * 2 - 1;
      toX(nx * PARALLAX_BLOCK); toY(ny * PARALLAX_BLOCK);
      if (to2X) { to2X(nx * PARALLAX_LAYER2); to2Y(ny * PARALLAX_LAYER2); }
    }, { passive: true });
    if (ST) ST.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: function (s) { visible = s.isActive; } });
  }

  /* ---- Sortie : épinglage +100vh, scrub ---------------------------------------- */
  if (animate && ST && media && content) {
    var exit = G.timeline({
      scrollTrigger: {
        trigger: section, start: 'top top', end: function () { return '+=' + PIN_LENGTH(); },
        pin: true, pinSpacing: PIN_SPACING, scrub: SCRUB, invalidateOnRefresh: true, anticipatePin: 1
      }
    });
    exit.to(content, { opacity: 0, y: EXIT_TEXT_Y, duration: TEXT_SPEED, ease: 'none' }, 0)
        .to(media, { scale: EXIT_SCALE, opacity: 0, duration: 1, ease: 'none' }, 0);
    var img = media.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', function () { ST.refresh(); }, { once: true });
    AJ.ready.then(function () { ST.refresh(); });
  }
})();
