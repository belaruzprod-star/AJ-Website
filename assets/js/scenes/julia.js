/* Scène « julia » : image 05 en Photo3D derrière un voile, titre qui entre mot à mot en profondeur,
   puis lecture guidée : les quatre paragraphes se révèlent mot à mot au défilement (section épinglée, scrub)
   et une ligne verticale grandit avec la progression. Mobile (≤ 860 px) ou section plus haute que l'écran :
   pas d'épinglage, chaque paragraphe se révèle en traversant l'écran.
   Repli : sans GSAP/ScrollTrigger ou en mouvement réduit, tout reste à plat ; sans AJ.Photo3D, l'image <picture> reste. */
(function () {
  'use strict';

  /* ---- Réglages ------------------------------------------------------------- */
  var IMAGE = '05';           /* clé de l'image dans AJ.images */
  var AMOUNT = 1;             /* amplitude Photo3D (0.5–2) */
  var MIST = true;            /* brume légère Photo3D */
  var GYRO = false;           /* gyroscope sur mobile (permission iOS demandée sur geste par Photo3D) */
  var PIN_LENGTH = 1900;      /* hauteur de défilement de la section épinglée, en px (bureau) */
  var SCRUB = 0.7;            /* lissage du scrub (s) */
  var DIM = 0.16;             /* opacité des mots non encore lus */
  var WORD_RISE = 4;          /* léger soulèvement (px) d'un mot pendant son fondu */
  var WORD_FADE = 3;          /* durée du fondu d'un mot, en « mots » (chevauchement de la vague) */
  var PARA_GAP = 5;           /* pause entre deux paragraphes, en « mots » */
  var SCROLL_DRIFT = 0.5;     /* décalage vertical Photo3D piloté par la progression épinglée (sans souris fine) */
  var MOBILE = '(max-width: 860px)';   /* même seuil que julia.css */

  var AJ = window.AJ; if (!AJ) return;
  var section = document.querySelector('[data-scene="julia"]'); if (!section) return;
  var G = AJ.gsap, ST = AJ.ScrollTrigger;
  var media = section.querySelector('.julia-media');
  var text = section.querySelector('.julia-text');
  var eyebrow = section.querySelector('.julia-eyebrow');
  var title = section.querySelector('.julia-title');
  var lead = section.querySelector('.julia-lead');
  var paras = [].slice.call(section.querySelectorAll('.julia-body p'));
  var cta = section.querySelector('.julia-cta');
  var line = section.querySelector('.julia-line');
  var img = media && media.querySelector('img');

  /* Mouvement réduit, ou socle absent : contenu à plat, image statique */
  if (AJ.reduce || !G || !ST || !media || !text) { section.classList.add('is-ready', 'is-static'); return; }

  /* ---- Découpage mot à mot (espace ordinaire seulement : les insécables restent attachées au mot) ---- */
  function split(el) {
    var words = el.textContent.split(' '), frag = document.createDocumentFragment(), out = [];
    words.forEach(function (w, i) {
      if (i) frag.appendChild(document.createTextNode(' '));
      if (!w) return;
      var s = document.createElement('span'); s.className = 'jw'; s.textContent = w;
      frag.appendChild(s); out.push(s);
    });
    el.textContent = ''; el.appendChild(frag);
    return out;
  }
  var titleWords = title ? split(title) : [];
  var bodyWords = paras.map(split);

  /* État initial du texte (avant tout défilement), puis levée du masque CSS */
  G.set(titleWords, { opacity: 0 });
  if (eyebrow) G.set(eyebrow, { opacity: 0 });
  if (lead) G.set(lead, { opacity: 0 });
  G.set(media, { opacity: 0 });                        /* l'image arrive en fondu avec le titre */
  section.classList.add('is-ready');

  /* ---- Photo3D (code contre l'API : repli image si absent) ---- */
  var photo = null;
  function attachPhoto() {
    if (photo || !AJ.Photo3D || typeof AJ.Photo3D.attach !== 'function') return;
    var info = AJ.images[IMAGE];
    try {
      photo = AJ.Photo3D.attach(media, {
        key: IMAGE, amount: AMOUNT, mouse: AJ.fine, scroll: true, gyro: GYRO,
        pos: info && info.pos, dissolve: false, mist: MIST,
        onReady: function () { section.classList.add('has-3d'); ST.refresh(); }
      });
    } catch (e) { photo = null; console.warn('julia : Photo3D indisponible', e); }
  }
  attachPhoto();

  /* ---- Entrée (une fois) : image en fondu, sur-titre, titre mot à mot avec profondeur, chapeau ---- */
  var entered = false;
  function enter() {
    if (entered) return; entered = true;
    var tl = G.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(media, { opacity: 0 }, { opacity: 1, duration: 1.8, ease: 'power2.out' }, 0);
    if (eyebrow) tl.fromTo(eyebrow, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .9 }, .35);
    tl.fromTo(titleWords, { opacity: 0, y: 26, z: -180, filter: 'blur(14px)' },
      { opacity: 1, y: 0, z: 0, filter: 'blur(0px)', duration: 1.4, stagger: .12, onComplete: function () { G.set(titleWords, { clearProps: 'filter' }); } }, .5);
    if (lead) tl.fromTo(lead, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.1 }, 1.25);
  }
  var enterTrigger = ST.create({ trigger: section, start: 'top 85%', once: true, onEnter: function () { AJ.ready.then(enter); } });
  if (enterTrigger.isActive) AJ.ready.then(enter);

  /* ---- Lecture guidée ---- */
  var ctx = null, mode = '', pinTrigger = null;
  var mq = window.matchMedia(MOBILE);
  function fits() { return section.getBoundingClientRect().height <= window.innerHeight + 2; }
  function wantMode() { return (!mq.matches && fits()) ? 'pinned' : 'flow'; }
  function allWords() { return [].concat.apply([], bodyWords); }

  function buildPinned() {
    G.set(allWords(), { opacity: DIM, y: WORD_RISE });
    if (cta) G.set(cta, { opacity: 0, y: 12 });
    G.set(line, { scaleY: 0 });
    var tl = G.timeline({
      scrollTrigger: {
        trigger: section, start: 'top top', end: '+=' + PIN_LENGTH, pin: true, scrub: SCRUB,
        anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (st) { if (photo && photo.setOffset && !AJ.fine) photo.setOffset(0, (st.progress - .5) * SCROLL_DRIFT); }
      }
    });
    pinTrigger = tl.scrollTrigger;
    var t = 2;
    bodyWords.forEach(function (words) {
      tl.to(words, { opacity: 1, y: 0, duration: WORD_FADE, stagger: 1, ease: 'none' }, t);
      t += words.length + WORD_FADE + PARA_GAP;
    });
    if (cta) tl.to(cta, { opacity: 1, y: 0, duration: 8, ease: 'none' }, t - 1);
    t += 14;                                             /* tenue en fin de lecture avant le désépinglage */
    tl.to({}, { duration: 1 }, t);
    tl.to(line, { scaleY: 1, duration: t - 3, ease: 'none' }, 2);
    tl.fromTo(media, { scale: 1 }, { scale: 1.06, duration: t, ease: 'none' }, 0);
  }

  function buildFlow() {
    G.set(allWords(), { opacity: DIM, y: WORD_RISE });
    if (cta) G.set(cta, { opacity: 0, y: 12 });
    G.set(line, { scaleY: 0 });
    paras.forEach(function (p, i) {
      G.to(bodyWords[i], { opacity: 1, y: 0, duration: .3, stagger: .06, ease: 'none',
        scrollTrigger: { trigger: p, start: 'clamp(top 90%)', end: 'clamp(top 45%)', scrub: SCRUB, invalidateOnRefresh: true } });
    });
    G.to(line, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: text, start: 'clamp(top 88%)', end: 'clamp(bottom 60%)', scrub: SCRUB, invalidateOnRefresh: true } });
    if (cta) G.to(cta, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: cta, start: 'clamp(top 94%)', once: true } });
    if (mq.matches) G.fromTo(media, { scale: 1 }, { scale: 1.08, ease: 'none', scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  }

  function build() {
    mode = wantMode();
    pinTrigger = null;
    ctx = G.context(function () { if (mode === 'pinned') buildPinned(); else buildFlow(); }, section);
  }
  function rebuild() {
    if (ctx) ctx.revert();
    build();
    ST.refresh();
  }
  build();

  /* Changement de largeur ou de mode : reconstruction (une simple variation de hauteur, barre d'adresse mobile, ne reconstruit pas) */
  var resizeTimer = null, lastW = window.innerWidth;
  AJ.on('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth !== lastW || wantMode() !== mode) { lastW = window.innerWidth; rebuild(); }
    }, 200);
  });

  /* Clavier : une tabulation vers le bouton termine la lecture (le contenu épinglé reste navigable) */
  text.addEventListener('focusin', function (e) {
    if (mode !== 'pinned' || !pinTrigger) return;
    try { if (!e.target.matches(':focus-visible')) return; } catch (err) {}
    var y = pinTrigger.end;
    if (AJ.lenis) AJ.lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y);
  });

  /* Mesures à jour quand l'image et les polices sont chargées */
  if (img && !img.complete) img.addEventListener('load', function () { ST.refresh(); }, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });

  /* Photo3D chargé après la scène (ordre de chargement inhabituel) : nouvel essai à AJ.ready */
  AJ.ready.then(attachPhoto);
})();
