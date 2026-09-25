/* Chrome commun AJ : menu plein écran (rideau, décodage des liens, aperçu d'image), curseur point + anneau,
   indicateur de scènes (construit à partir des [data-scene]), transition de page par rideau.
   Dépend de core.js (window.AJ) et du balisage de partials/chrome.html. IIFE : ne fait rien si le partial est absent.
   Expose AJ.chrome = { open, close, toggle, refresh (reconstruit l'indicateur), decode(el, texte, ms) }.
   Options lues sur AJ : AJ.base (préfixe des chemins d'images, ex. '../' dans les démos), AJ.page (nom de fichier courant, sinon location.pathname). */
(function () {
  'use strict';
  /* ------------------------------------------------------------------ Réglages */
  var CFG = {
    decodeDur: 800,          /* ms : décodage d'un lien du menu */
    decodeStagger: 70,       /* ms entre deux liens (identique au calendrier CSS) */
    decodeDelay: 240,        /* ms après l'ouverture avant le premier lien (idem CSS) */
    btnDecodeDur: 420,       /* ms : Menu ↔ Fermer */
    previewLerp: 0.12,       /* amortissement de l'aperçu (0–1, 1 = collé au pointeur) */
    previewOffset: [0.62, 0.3], /* centre de l'aperçu à droite / sous le pointeur, en fraction de sa taille (0.5 = bord gauche sur le pointeur) */
    previewSkew: 0.06,       /* inclinaison de l'aperçu selon la vitesse horizontale (deg par px) */
    cursorLerp: 0.16,        /* amortissement de l'anneau du curseur */
    veilDur: 450,            /* ms : rideau avant de suivre un lien (synchro avec --chrome-veil-dur) */
    veilKey: 'aj-veil',      /* clé sessionStorage posée avant la navigation, lue à l'arrivée */
    sceneMid: 0.5,           /* la scène courante est celle qui contient ce point de l'écran (fraction de la hauteur) */
    sceneNames: { hero: 'Accueil', manifeste: 'Manifeste', pieces: 'Pièces', campagne: 'Campagne', julia: 'Julia', contact: 'Contact' },
    charsUp: 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/',
    charsLow: 'abcdefghijkmnopqrstuvwxyz'
  };

  var AJ = window.AJ; if (!AJ) return;
  var doc = document.documentElement;
  var root = document.querySelector('.chrome'); if (!root) return;
  var reduce = !!AJ.reduce, fine = !!AJ.fine;
  var mark = root.querySelector('.chrome-mark');
  var btn = root.querySelector('.chrome-menu-btn');
  var btnWord = btn && btn.querySelector('.chrome-menu-btn-word');
  var menu = root.querySelector('.chrome-menu');
  var links = menu ? Array.prototype.slice.call(menu.querySelectorAll('.chrome-menu-list a')) : [];
  var preview = menu && menu.querySelector('.chrome-menu-preview');
  var prog = root.querySelector('.chrome-progress');
  var veil = root.querySelector('.chrome-veil');
  var cur = root.querySelector('.cursor');
  var raf = window.requestAnimationFrame;

  /* ------------------------------------------------------------------ Décodage de texte, caractère par caractère */
  var decodeSeq = 0, letter = /[A-Za-z0-9À-ſ]/;
  function decode(el, text, dur, done) {
    if (!el) return;
    var id = ++decodeSeq; el._ajDecode = id;
    if (reduce || !dur) { el.textContent = text; if (done) done(); return; }
    var t0 = performance.now(), n = text.length;
    (function step(now) {
      if (el._ajDecode !== id) return;
      var p = Math.min(1, (now - t0) / dur), out = '';
      for (var i = 0; i < n; i++) {
        var ch = text[i];
        if (!letter.test(ch) || i / n < p) out += ch;
        else if (ch === ch.toUpperCase()) out += CFG.charsUp[(Math.random() * CFG.charsUp.length) | 0];
        else out += CFG.charsLow[(Math.random() * CFG.charsLow.length) | 0];
      }
      el.textContent = out;
      if (p < 1) raf(step); else { el.textContent = text; if (done) done(); }
    })(t0);
  }

  /* ------------------------------------------------------------------ Lien courant (aria-current) et noms accessibles */
  var page = String(AJ.page || location.pathname.split('/').pop() || 'index.html').toLowerCase();
  links.forEach(function (a) {
    var w = a.querySelector('.chrome-menu-word');
    var t = w ? (w.getAttribute('data-text') || w.textContent.trim()) : a.textContent.trim();
    if (w) w.setAttribute('data-text', t);
    a.setAttribute('aria-label', t);                       /* nom stable pendant le décodage */
    var file = (a.getAttribute('href') || '').split('/').pop().split(/[?#]/)[0].toLowerCase();
    if (file && file === page) a.setAttribute('aria-current', 'page');
  });

  /* ------------------------------------------------------------------ Menu plein écran */
  var isOpen = false, inerted = [], focusBefore = null;
  function setInert(on) {
    if (on) {
      inerted = [];
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === root || el.tagName === 'SCRIPT' || el.inert) return;
        el.inert = true; inerted.push(el);
      });
    } else { inerted.forEach(function (el) { el.inert = false; }); inerted = []; }
  }
  function openMenu() {
    if (isOpen || !menu || !btn) return;
    isOpen = true; focusBefore = document.activeElement;
    doc.classList.add('menu-open'); menu.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
    decode(btnWord, 'Fermer', CFG.btnDecodeDur);
    if (AJ.lenis) { try { AJ.lenis.stop(); } catch (e) {} }
    setInert(true); buildPreviews(); measurePreview();
    links.forEach(function (a, i) {
      var w = a.querySelector('.chrome-menu-word'); if (!w) return;
      var t = w.getAttribute('data-text');
      if (reduce) { w.textContent = t; return; }
      setTimeout(function () { if (isOpen) decode(w, t, CFG.decodeDur); }, CFG.decodeDelay + i * CFG.decodeStagger);
    });
    setTimeout(function () { if (isOpen && links[0]) links[0].focus({ preventScroll: true }); }, 50);
  }
  function closeMenu(opts) {
    if (!isOpen || !menu || !btn) return;
    isOpen = false;
    doc.classList.remove('menu-open'); menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false');
    decode(btnWord, 'Menu', CFG.btnDecodeDur);
    if (AJ.lenis) { try { AJ.lenis.start(); } catch (e) {} }
    setInert(false); hidePreview();
    if (!(opts && opts.keepFocus)) {
      var back = (focusBefore && focusBefore !== document.body && document.contains(focusBefore) && !menu.contains(focusBefore)) ? focusBefore : btn;
      try { back.focus({ preventScroll: true }); } catch (e) {}
    }
  }
  if (btn && menu) {
    btn.addEventListener('click', function () { if (isOpen) closeMenu(); else openMenu(); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeMenu(); return; }
      if (e.key !== 'Tab') return;
      /* focus piégé : monogramme, bouton, liens du menu */
      var f = [mark, btn].concat(links).filter(function (el) { return el && el.getClientRects().length; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey) { if (i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } }
      else if (i === -1 || i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    /* le focus ne doit pas quitter le menu (repli si inert n'est pas pris en charge) */
    document.addEventListener('focusin', function (e) {
      if (!isOpen || root.contains(e.target)) return;
      if (links[0]) links[0].focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------------ Aperçu d'image qui suit la souris (souris précise seulement) */
  var pv = { built: false, on: false, key: null, x: 0, y: 0, tx: 0, ty: 0, vx: 0, w: 0, h: 0, inner: null, pics: {} };
  var previewOK = !!preview && fine && !reduce && links.length > 0;
  function buildPreviews() {
    if (pv.built || !previewOK) return;
    pv.built = true;
    var base = AJ.base || '', inner = document.createElement('div');
    inner.className = 'chrome-menu-preview-in';
    links.forEach(function (a) {
      var key = a.getAttribute('data-preview'), im = AJ.images && AJ.images[key];
      if (!key || !im || pv.pics[key]) return;
      var pic = document.createElement('picture');
      pic.setAttribute('data-key', key);
      if (im.pos) pic.style.setProperty('--pos', Math.round(im.pos[0] * 100) + '% ' + Math.round(im.pos[1] * 100) + '%');
      pic.innerHTML = '<source type="image/webp" srcset="' + base + im.webp768 + ' 768w, ' + base + im.webp1536 + ' 1536w" sizes="24vw">' +
        '<img src="' + base + im.jpg768 + '" srcset="' + base + im.jpg768 + ' 768w, ' + base + im.jpg1536 + ' 1536w" sizes="24vw" width="1536" height="1024" alt="" decoding="async" draggable="false">';
      inner.appendChild(pic); pv.pics[key] = pic;
    });
    preview.appendChild(inner); pv.inner = inner;
    AJ.on('resize', measurePreview);
  }
  function measurePreview() { if (pv.built) { pv.w = preview.offsetWidth || 0; pv.h = preview.offsetHeight || 0; } }
  function showPreview(key, x, y, snap) {
    if (!pv.built || !pv.pics[key]) return;
    if (pv.key !== key) {
      if (pv.key && pv.pics[pv.key]) pv.pics[pv.key].classList.remove('is-on');
      pv.pics[key].classList.add('is-on'); pv.key = key;
    }
    if (!pv.w) measurePreview();
    pv.tx = x + pv.w * CFG.previewOffset[0]; pv.ty = y + pv.h * CFG.previewOffset[1];
    if (!pv.on || snap) { pv.x = pv.tx; pv.y = pv.ty; }
    if (!pv.on) { pv.on = true; preview.classList.add('is-on'); startLoop(); }
  }
  function hidePreview() {
    if (!pv.on) return;
    pv.on = false; preview.classList.remove('is-on');
  }
  function focusVisible(el) { try { return el.matches(':focus-visible'); } catch (e) { return false; } }
  if (previewOK) {
    links.forEach(function (a) {
      var key = a.getAttribute('data-preview'); if (!key) return;
      a.addEventListener('pointerenter', function (e) { if (e.pointerType === 'touch') return; showPreview(key, e.clientX, e.clientY); });
      a.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; showPreview(key, e.clientX, e.clientY); }, { passive: true });
      a.addEventListener('pointerleave', hidePreview);
      a.addEventListener('focus', function () {        /* navigation clavier seulement : aperçu posé à droite, au centre */
        if (!isOpen || !focusVisible(a)) return;
        showPreview(key, window.innerWidth * 0.64, window.innerHeight * 0.45, true);
      });
      a.addEventListener('blur', function () { if (!menu.matches(':hover')) hidePreview(); });
    });
  }

  /* ------------------------------------------------------------------ Curseur point + anneau */
  var cs = { on: false, mx: window.innerWidth / 2, my: window.innerHeight / 2, rx: 0, ry: 0, dot: null, ring: null, label: null };
  if (cur && fine && !reduce) {
    doc.classList.add('has-cursor');
    cs.dot = cur.querySelector('.cursor-dot'); cs.ring = cur.querySelector('.cursor-ring'); cs.label = cur.querySelector('.cursor-label');
    cs.rx = cs.mx; cs.ry = cs.my;
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      cs.mx = e.clientX; cs.my = e.clientY;
      if (!cs.on) { cs.on = true; cs.rx = cs.mx; cs.ry = cs.my; cur.classList.add('on'); }
      startLoop();
    }, { passive: true });
    doc.addEventListener('mouseleave', function () { cs.on = false; cur.classList.remove('on'); });
    doc.addEventListener('mouseenter', function () { if (!cs.on) { cs.on = true; cur.classList.add('on'); } });
    window.addEventListener('pointerdown', function (e) { if (!e.pointerType || e.pointerType === 'mouse') cur.classList.add('down'); });
    window.addEventListener('pointerup', function () { cur.classList.remove('down'); });
    window.addEventListener('blur', function () { cur.classList.remove('down'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var hide = t.closest('[data-cursor="hide"]');
      var view = t.closest('[data-cursor="view"]');
      var link = !view && t.closest('a, button, .btn, [role="button"], label, input, select, textarea, summary, [data-cursor="link"]');
      cur.classList.toggle('hidden', !!hide);
      cur.classList.toggle('view', !!view);
      cur.classList.toggle('link', !!link);
      if (view && cs.label) cs.label.textContent = view.getAttribute('data-cursor-label') || 'Voir';
    });
  }

  /* ------------------------------------------------------------------ Boucle partagée (curseur + aperçu), active seulement si nécessaire */
  var looping = false;
  function startLoop() { if (!looping) { looping = true; raf(loop); } }
  function loop() {
    var busy = false;
    if (cs.dot && cs.on) {
      cs.rx += (cs.mx - cs.rx) * CFG.cursorLerp; cs.ry += (cs.my - cs.ry) * CFG.cursorLerp;
      cs.dot.style.transform = 'translate3d(' + cs.mx + 'px,' + cs.my + 'px,0)';
      cs.ring.style.transform = 'translate3d(' + cs.rx.toFixed(1) + 'px,' + cs.ry.toFixed(1) + 'px,0)';
      if (Math.abs(cs.mx - cs.rx) + Math.abs(cs.my - cs.ry) > 0.2) busy = true;
    }
    if (pv.on || (preview && preview.classList.contains('is-on'))) {
      var dx = (pv.tx - pv.x) * CFG.previewLerp, dy = (pv.ty - pv.y) * CFG.previewLerp;
      pv.x += dx; pv.y += dy; pv.vx += (dx - pv.vx) * 0.2;
      var skew = Math.max(-8, Math.min(8, pv.vx * CFG.previewSkew * 10));
      preview.style.transform = 'translate3d(' + (pv.x - pv.w / 2).toFixed(1) + 'px,' + (pv.y - pv.h / 2).toFixed(1) + 'px,0) skewX(' + skew.toFixed(2) + 'deg)';
      if (pv.on || Math.abs(dx) + Math.abs(dy) > 0.1) busy = true;
    }
    if (busy) raf(loop); else looping = false;
  }

  /* ------------------------------------------------------------------ Indicateur de scènes */
  var scenes = [], items = [], current = -1, pending = false;
  function sceneBox(el) { var p = el.parentElement; return (p && p.classList.contains('pin-spacer')) ? p : el; }
  function sceneName(el) {
    return el.getAttribute('data-scene-name') || CFG.sceneNames[el.getAttribute('data-scene')] || el.getAttribute('data-scene');
  }
  function scrollToScene(el) {
    var box = sceneBox(el);
    if (AJ.lenis) { try { AJ.lenis.scrollTo(box, { duration: reduce ? 0 : 1.4, offset: 0 }); return; } catch (e) {} }
    var y = box.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }
  function buildProgress() {
    if (!prog) return;
    scenes = Array.prototype.slice.call(document.querySelectorAll('[data-scene]')).filter(function (el) {
      return !root.contains(el) && !el.hidden && !el.hasAttribute('data-scene-skip') && el.getAttribute('aria-hidden') !== 'true' &&
        el.getClientRects().length && el.offsetHeight > 0;
    });
    prog.innerHTML = ''; items = []; current = -1;
    if (scenes.length < 2) { prog.hidden = true; return; }
    var ol = document.createElement('ol');
    items = scenes.map(function (el) {
      var name = sceneName(el), a = document.createElement('a'), li = document.createElement('li');
      a.href = '#' + (el.id || el.getAttribute('data-scene'));
      a.className = 'chrome-progress-item'; a.setAttribute('aria-label', name);
      var span = document.createElement('span'); span.className = 'chrome-progress-name'; span.setAttribute('aria-hidden', 'true'); span.textContent = name;
      var line = document.createElement('i'); line.className = 'chrome-progress-line'; line.setAttribute('aria-hidden', 'true');
      a.appendChild(span); a.appendChild(line);
      a.addEventListener('click', function (e) { e.preventDefault(); scrollToScene(el); });
      li.appendChild(a); ol.appendChild(li); return a;
    });
    prog.appendChild(ol); prog.hidden = false;
    updateProgress();
  }
  function updateProgress() {
    pending = false;
    if (!items.length) return;
    var mid = window.innerHeight * CFG.sceneMid, idx = 0, p = 0;
    for (var i = 0; i < scenes.length; i++) {
      var r = sceneBox(scenes[i]).getBoundingClientRect();
      if (r.top <= mid) { idx = i; p = r.height > 0 ? (mid - r.top) / r.height : 0; }
    }
    p = Math.max(0, Math.min(1, p));
    if (idx !== current) {
      if (current >= 0) { items[current].removeAttribute('aria-current'); items[current].style.setProperty('--p', 0); }
      items[idx].setAttribute('aria-current', 'true'); current = idx;
    }
    items[idx].style.setProperty('--p', p.toFixed(3));
  }
  function scheduleProgress() { if (!pending && items.length) { pending = true; raf(updateProgress); } }
  if (prog) {
    buildProgress();
    AJ.on('scroll', scheduleProgress);
    AJ.on('resize', scheduleProgress);
    window.addEventListener('load', function () { buildProgress(); });
    AJ.ready.then(function () { setTimeout(buildProgress, 0); });
    if (AJ.ScrollTrigger && AJ.ScrollTrigger.addEventListener) { try { AJ.ScrollTrigger.addEventListener('refresh', scheduleProgress); } catch (e) {} }
  }

  /* ------------------------------------------------------------------ Transition de page : rideau qui monte, puis navigation ; rideau qui se retire à l'arrivée */
  var leaving = false;
  function arrive() {
    var flag = false;
    try { flag = sessionStorage.getItem(CFG.veilKey) === '1'; sessionStorage.removeItem(CFG.veilKey); } catch (e) {}
    /* pas de rideau d'arrivée si le préchargeur tourne (core.js le retire sinon), ni en mouvement réduit */
    if (!veil || reduce || !flag || document.querySelector('.loader')) { doc.classList.remove('chrome-enter'); return; }
    doc.classList.add('chrome-enter');
    var done = function () { doc.classList.remove('chrome-enter'); };
    veil.addEventListener('animationend', done, { once: true });
    setTimeout(done, 1400);
  }
  arrive();
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript|sms):/i.test(href)) return;
    var url; try { url = new URL(a.href, location.href); } catch (x) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;   /* ancre de la même page */
    if (!veil || reduce || leaving) return;
    e.preventDefault(); leaving = true;
    try { sessionStorage.setItem(CFG.veilKey, '1'); } catch (x) {}
    doc.classList.add('chrome-leave');
    setTimeout(function () { location.href = url.href; }, CFG.veilDur);
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { leaving = false; doc.classList.remove('chrome-leave'); doc.classList.remove('chrome-enter'); }
  });

  /* ------------------------------------------------------------------ API */
  AJ.chrome = { open: openMenu, close: closeMenu, toggle: function () { if (isOpen) closeMenu(); else openMenu(); }, refresh: buildProgress, decode: decode, isOpen: function () { return isOpen; } };
})();
