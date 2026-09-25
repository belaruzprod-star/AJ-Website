/* Scène « detail » : fiche d'une pièce.
   Deux montages avec le même contenu :
   - overlay plein écran, ouvert par AJ.openPiece(slug) (remplacé ici) : rideau, image cover en Photo3D, num, nom,
     lead, corps, détails, galerie horizontale, bouton « Nous écrire », précédente / suivante ; fermeture par Échap,
     bouton, clic sur le fond et bouton retour (history.pushState avec ?piece=<slug>) ; ouverture directe si l'URL
     contient déjà ?piece=<slug> ; focus piégé puis restitué ; défilement du fond bloqué (Lenis ou overflow hidden) ;
   - à plat dans une page (<section data-scene="detail" data-slug="veste-bleue">) : même rendu, sans overlay.
   Dépendances : core.js (AJ.pieces, AJ.images, AJ.pictureHTML, AJ.ready, AJ.lenis). Photo3D facultatif (repli image). */
(function () {
  'use strict';
  var AJ = window.AJ; if (!AJ) return;

  /* ------------------------------------------------------------------ Réglages */
  var PARAM = 'piece';        /* paramètre d'URL de l'overlay : index.html?piece=veste-bleue */
  var AMOUNT = 0.9;           /* amplitude Photo3D de l'image cover (0.5–2) */
  var OPEN_MS = 950;          /* durée du rideau d'ouverture (= transition CSS de .detail-overlay) */
  var CLOSE_MS = 600;         /* durée de la fermeture (= transition CSS de .is-closing) */
  var SWITCH_MS = 420;        /* sortie du contenu avant d'afficher l'autre pièce */
  var CONTENT_DELAY = 420;    /* ms : le contenu entre quand le rideau est presque levé (--d0 sur .detail-inner) */
  var PHOTO_DELAY = 560;      /* ms après l'ouverture : attache Photo3D (le rideau est levé, l'image décodée) */
  var DECODE_WAIT = 700;      /* ms max d'attente du décodage de la cover avant de lancer l'entrée */
  var GAL_LERP = 0.14;        /* inertie de la galerie à la molette / au glisser (souris) */
  var GAL_DRAG_LERP = 0.35;   /* suivi du pointeur pendant le glisser */
  var GAL_WHEEL = 1.0;        /* facteur molette → défilement horizontal */
  var GAL_SNAP_MS = 160;      /* repos avant de caler sur l'image la plus proche */
  var PARALLAX = true;        /* parallaxe souris (titre et grand numéro) sur bureau */

  var doc = document.documentElement, body = document.body;
  var reduce = !!AJ.reduce;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function find(slug) { for (var i = 0; i < AJ.pieces.length; i++) if (AJ.pieces[i].slug === slug) return AJ.pieces[i]; return null; }
  function index(slug) { for (var i = 0; i < AJ.pieces.length; i++) if (AJ.pieces[i].slug === slug) return i; return -1; }
  function posStyle(key) { var im = AJ.images[key]; var p = (im && im.pos) || [0.5, 0.5]; return '--pos:' + Math.round(p[0] * 100) + '% ' + Math.round(p[1] * 100) + '%'; }
  function words(text, start) {
    var i = start || 0;
    return text.split(/\s+/).filter(Boolean).map(function (w) {
      return '<span class="w"><span class="wi" style="--i:' + (i++) + '">' + esc(w) + '</span></span>';
    }).join(' ');
  }
  function mailto(root) {
    /* site.js fait la même chose au chargement ; ce contenu arrive plus tard, on l'applique ici. */
    var c = window.AJ_CONFIG || {}, email = String(c.email || '').trim().replace(/^mailto:/i, '');
    if (!email) return;
    root.querySelectorAll('[data-aj-mailto]').forEach(function (a) {
      a.href = 'mailto:' + email + '?subject=' + encodeURIComponent(a.getAttribute('data-aj-mailto'));
    });
  }

  /* ------------------------------------------------------------------ Rendu (identique en overlay et à plat) */
  function render(piece, mode) {
    var T = AJ.texts || {}, n = AJ.pieces.length, k = index(piece.slug);
    var prev = AJ.pieces[(k - 1 + n) % n], next = AJ.pieces[(k + 1) % n];
    var H = mode === 'flat' ? 'h1' : 'h2';
    var titleId = mode === 'flat' ? 'detail-title-flat' : 'detail-title';
    var coverSizes = '(min-width: 900px) 52vw, 100vw';
    var galSizes = '(min-width: 900px) 1000px, 84vw';
    var i = 0, h = '';
    h += '<div class="detail-inner" data-slug="' + esc(piece.slug) + '">';
    /* Image cover (Photo3D sur .detail-media-in ; repli : <picture>) */
    h += '<div class="detail-media-col"><div class="detail-media" style="' + posStyle(piece.cover) + '">' +
      '<div class="detail-media-in" data-detail-photo="' + esc(piece.cover) + '">' +
      AJ.pictureHTML(piece.cover, coverSizes, { eager: true, priority: mode === 'flat' }) + '</div>' +
      '<span class="detail-bignum" aria-hidden="true">' + esc(piece.num) + '</span></div></div>';
    /* Texte */
    h += '<div class="detail-text">';
    h += '<p class="eyebrow detail-eyebrow" data-in style="--i:' + (i++) + '">' + esc(piece.num) + ' · Pièce unique</p>';
    h += '<' + H + ' class="detail-name" id="' + titleId + '">' + words(piece.name) + '</' + H + '>';
    i += 2;
    h += '<p class="lead detail-lead" data-in style="--i:' + (i++) + '">' + esc(piece.lead) + '</p>';
    h += '<div class="detail-body" data-in style="--i:' + (i++) + '">' + (piece.body || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    if (piece.details && piece.details.length) {
      h += '<dl class="details detail-details" data-in style="--i:' + (i++) + '">' + piece.details.map(function (d) {
        return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>';
      }).join('') + '</dl>';
    }
    h += '</div>';
    /* Galerie : les autres images de la pièce (la cover est déjà en grand) */
    var others = (piece.images || []).filter(function (im) { return im[0] !== piece.cover && AJ.images[im[0]]; });
    if (others.length) {
      h += '<div class="detail-gallery" data-in style="--i:' + (i++) + '">' +
        '<div class="detail-strip" tabindex="0" role="region" aria-label="Autres images — ' + esc(piece.name) + '" data-lenis-prevent>';
      others.forEach(function (im, j) {
        var cap = im[1];
        h += '<figure class="detail-item" style="' + posStyle(im[0]) + '">' +
          '<div class="detail-item-pic">' + AJ.pictureHTML(im[0], galSizes, { eager: mode !== 'flat' }) + '</div>' +
          '<figcaption><span class="detail-item-num">' + (j + 2 < 10 ? '0' : '') + (j + 2) + ' / ' + (others.length + 1 < 10 ? '0' : '') + (others.length + 1) + '</span>' +
          (cap ? '<span class="detail-item-cap">' + esc(cap) + '</span>' : '') + '</figcaption></figure>';
      });
      h += '</div></div>';
    }
    /* Appel et navigation */
    h += '<div class="detail-cta" data-in style="--i:' + (i++) + '">' +
      '<p class="detail-cta-text">' + esc(T.cta_piece || '') + '</p>' +
      '<a class="btn" href="contact.html" data-aj-mailto="À propos de — ' + esc(piece.name) + '">' + esc(T.btn_write || 'Nous écrire') + '</a></div>';
    if (n > 1) {
      h += '<nav class="detail-nav" aria-label="Autres pièces" data-in style="--i:' + (i++) + '">' +
        '<a class="detail-nav-link prev" href="' + esc(prev.slug) + '.html" data-detail-go="' + esc(prev.slug) + '" rel="prev">' +
        '<span class="detail-nav-label">Précédente</span><span class="detail-nav-name"><em>' + esc(prev.num) + '</em> ' + esc(prev.name) + '</span></a>' +
        '<a class="detail-nav-link next" href="' + esc(next.slug) + '.html" data-detail-go="' + esc(next.slug) + '" rel="next">' +
        '<span class="detail-nav-label">Suivante</span><span class="detail-nav-name"><em>' + esc(next.num) + '</em> ' + esc(next.name) + '</span></a></nav>';
    }
    h += '</div>';
    return h;
  }

  /* ------------------------------------------------------------------ Photo3D (repli : l'image reste) */
  function attachPhoto(inner, scroll) {
    var el = inner.querySelector('[data-detail-photo]');
    if (!el || reduce || !AJ.Photo3D || typeof AJ.Photo3D.attach !== 'function') return null;
    var key = el.getAttribute('data-detail-photo'), im = AJ.images[key];
    try {
      return AJ.Photo3D.attach(el, { key: key, amount: AMOUNT, mouse: AJ.fine, scroll: !!scroll, gyro: false, pos: im && im.pos, dissolve: false, mist: false });
    } catch (e) { console.warn('Photo3D indisponible pour la fiche', e); return null; }
  }
  function destroyPhoto(inst) { if (inst && typeof inst.destroy === 'function') { try { inst.destroy(); } catch (e) {} } }

  /* ------------------------------------------------------------------ Galerie horizontale */
  function initStrip(strip) {
    if (!strip) return;
    var items = strip.querySelectorAll('.detail-item');
    if (!AJ.fine) { strip.classList.add('native'); return; }   /* tactile : défilement natif + snap CSS */
    strip.classList.add('drag');
    var cur = 0, target = 0, raf = null, snapT = null, dragging = false, moved = false, startX = 0, startLeft = 0, pid = null;
    function max() { return Math.max(0, strip.scrollWidth - strip.clientWidth); }
    function pad() { return parseFloat(getComputedStyle(strip).paddingLeft) || 0; }
    function tick() {
      var k = dragging ? GAL_DRAG_LERP : GAL_LERP;
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.5) { cur = target; strip.scrollLeft = cur; raf = null; return; }
      strip.scrollLeft = cur; raf = requestAnimationFrame(tick);
    }
    function go(t, snap) {
      target = Math.max(0, Math.min(max(), t));
      if (!raf) raf = requestAnimationFrame(tick);
      clearTimeout(snapT);
      if (snap !== false) snapT = setTimeout(snapNearest, GAL_SNAP_MS);
    }
    function stops() { var p = pad(); return Array.prototype.map.call(items, function (it) { return Math.min(max(), it.offsetLeft - p); }); }
    function snapNearest() {
      if (dragging) return;
      var s = stops(), best = target, d = Infinity;
      for (var i = 0; i < s.length; i++) { var dd = Math.abs(s[i] - target); if (dd < d) { d = dd; best = s[i]; } }
      if (target >= max() - 1) return;   /* en butée : on y reste */
      go(best, false);
    }
    function step(dir) {
      var s = stops(), i;
      if (dir > 0) { for (i = 0; i < s.length; i++) if (s[i] > target + 2) return go(s[i]); return go(max()); }
      for (i = s.length - 1; i >= 0; i--) if (s[i] < target - 2) return go(s[i]);
      go(0);
    }
    strip.addEventListener('scroll', function () { if (!raf && !dragging) cur = target = strip.scrollLeft; }, { passive: true });
    strip.addEventListener('wheel', function (e) {
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= strip.clientWidth;
      var m = max();
      if (m <= 0 || (d > 0 && target >= m - 1) || (d < 0 && target <= 1)) return;   /* en butée : la page continue */
      e.preventDefault();
      go(target + d * GAL_WHEEL);
    }, { passive: false });
    strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true; moved = false; startX = e.clientX; startLeft = target; pid = e.pointerId;
      clearTimeout(snapT); strip.classList.add('is-dragging');
      try { strip.setPointerCapture(pid); } catch (err) {}
    });
    strip.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      go(startLeft - dx, false);
    });
    function up() {
      if (!dragging) return;
      dragging = false; strip.classList.remove('is-dragging');
      try { strip.releasePointerCapture(pid); } catch (err) {}
      clearTimeout(snapT); snapT = setTimeout(snapNearest, GAL_SNAP_MS);
    }
    strip.addEventListener('pointerup', up); strip.addEventListener('pointercancel', up);
    strip.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    strip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); step(-1); }
    });
    cur = target = strip.scrollLeft;
  }

  /* ------------------------------------------------------------------ Parallaxe souris (titre, grand numéro) */
  function initParallax(root, inner) {
    if (!PARALLAX || reduce || !AJ.fine) return function () {};
    var raf = null, mx = 0, my = 0;
    function move(e) {
      mx = (e.clientX / window.innerWidth) * 2 - 1; my = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(function () { raf = null; inner.style.setProperty('--mx', mx.toFixed(3)); inner.style.setProperty('--my', my.toFixed(3)); });
    }
    root.addEventListener('mousemove', move);
    return function () { root.removeEventListener('mousemove', move); };
  }

  /* ------------------------------------------------------------------ Entrée d'un contenu rendu */
  function enter(inner, opts) {
    var img = inner.querySelector('.detail-media img');
    var go = function () { inner.classList.add('is-in'); if (opts && opts.then) opts.then(); };
    if (reduce || !img) { go(); return; }
    var done = false, fire = function () { if (!done) { done = true; requestAnimationFrame(go); } };
    if (img.decode) img.decode().then(fire, fire); else if (img.complete) fire(); else { img.addEventListener('load', fire, { once: true }); img.addEventListener('error', fire, { once: true }); }
    setTimeout(fire, DECODE_WAIT);
  }

  /* ================================================================== Overlay */
  var overlay = document.querySelector('[data-detail-overlay]');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'detail-overlay'; overlay.setAttribute('data-detail-overlay', ''); overlay.hidden = true;
  }
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'detail-title');
  overlay.setAttribute('tabindex', '-1'); overlay.setAttribute('data-lenis-prevent', '');
  if (overlay.parentNode !== body) body.appendChild(overlay);   /* directement sous <body> : empilement et inert simples */
  overlay.innerHTML = '<div class="detail-bar"><p class="detail-counter"><b class="detail-counter-cur">01</b> / <span class="detail-counter-all">' + (AJ.pieces.length < 10 ? '0' : '') + AJ.pieces.length + '</span></p>' +
    '<button type="button" class="detail-close" aria-label="Fermer"><span class="detail-close-text">Fermer</span><span class="detail-close-x" aria-hidden="true"></span></button></div>' +
    '<div class="detail-scroller"></div>';
  var bar = overlay.querySelector('.detail-bar'), scroller = overlay.querySelector('.detail-scroller'), closeBtn = overlay.querySelector('.detail-close');
  var state = { open: false, slug: null, photo: null, timer: null, returnFocus: null, unParallax: null, switching: false, inerted: [] };

  function lockScroll() {
    doc.classList.add('detail-open');
    if (AJ.lenis && typeof AJ.lenis.stop === 'function') { try { AJ.lenis.stop(); } catch (e) {} }
  }
  function unlockScroll() {
    doc.classList.remove('detail-open');
    if (AJ.lenis && typeof AJ.lenis.start === 'function') { try { AJ.lenis.start(); } catch (e) {} }
  }
  function setInert(on) {
    if (!('inert' in HTMLElement.prototype)) return;
    if (on) {
      state.inerted = [];
      Array.prototype.forEach.call(body.children, function (el) {
        if (el === overlay || el.contains(overlay) || el.tagName === 'SCRIPT' || el.hasAttribute('inert')) return;
        el.inert = true; state.inerted.push(el);
      });
    } else { state.inerted.forEach(function (el) { el.inert = false; }); state.inerted = []; }
  }
  function urlWith(slug) { var u = new URL(window.location.href); if (slug) u.searchParams.set(PARAM, slug); else u.searchParams.delete(PARAM); return u.href; }
  function slugFromUrl() { try { return new URL(window.location.href).searchParams.get(PARAM); } catch (e) { return null; } }
  function ownsHistory() { return !!(window.history.state && window.history.state.ajDetail); }

  function mount(piece) {
    scroller.innerHTML = render(piece, 'overlay');
    var inner = scroller.firstElementChild;
    inner.style.setProperty('--d0', (reduce ? 0 : CONTENT_DELAY) + 'ms');
    mailto(inner);
    initStrip(inner.querySelector('.detail-strip'));
    overlay.querySelector('.detail-counter-cur').textContent = piece.num;
    state.slug = piece.slug;
    state.unParallax = initParallax(overlay, inner);
    return inner;
  }
  function unmount() {
    destroyPhoto(state.photo); state.photo = null;
    if (state.unParallax) { state.unParallax(); state.unParallax = null; }
  }

  function open(slug, opts) {
    opts = opts || {};
    var piece = find(slug);
    if (!piece) return false;
    if (state.open) { if (state.slug !== slug) switchTo(slug, opts); return true; }
    state.open = true;
    state.returnFocus = document.activeElement;
    clearTimeout(state.timer);
    lockScroll();
    var inner = mount(piece);
    overlay.hidden = false;
    overlay.classList.remove('is-closing');
    scroller.scrollTop = 0;
    void overlay.offsetWidth;                    /* reflow : la transition du rideau part de l'état fermé */
    overlay.classList.add('is-open');
    if (opts.push !== false && !ownsHistory()) {
      try { window.history.pushState({ ajDetail: slug }, '', urlWith(slug)); } catch (e) {}
    } else if (opts.push !== false && ownsHistory() && slugFromUrl() !== slug) {
      try { window.history.replaceState({ ajDetail: slug }, '', urlWith(slug)); } catch (e) {}
    }
    setInert(true);
    try { overlay.focus({ preventScroll: true }); } catch (e) { overlay.focus(); }
    enter(inner);
    state.timer = setTimeout(function () { if (state.open && state.slug === slug) state.photo = attachPhoto(inner, true); }, reduce ? 0 : PHOTO_DELAY);
    AJ.emit('detail:open', { slug: slug });
    return true;
  }

  function close(opts) {
    opts = opts || {};
    if (!state.open || state.switching) return;
    if (opts.history !== false) {
      if (ownsHistory()) { window.history.back(); return; }   /* popstate → close({history:false}) */
      if (slugFromUrl()) { try { window.history.replaceState(null, '', urlWith(null)); } catch (e) {} }
    }
    state.open = false;
    clearTimeout(state.timer);
    var inner = scroller.firstElementChild;
    if (inner) inner.classList.remove('is-in');
    overlay.classList.remove('is-open'); overlay.classList.add('is-closing');
    unmount();
    setInert(false);
    unlockScroll();
    var rf = state.returnFocus; state.returnFocus = null;
    if (rf && typeof rf.focus === 'function' && document.contains(rf)) { try { rf.focus({ preventScroll: true }); } catch (e) { rf.focus(); } }
    AJ.emit('detail:close', { slug: state.slug });
    state.timer = setTimeout(function () {
      if (state.open) return;
      overlay.hidden = true; overlay.classList.remove('is-closing'); scroller.innerHTML = ''; state.slug = null;
    }, reduce ? 0 : CLOSE_MS);
  }

  function switchTo(slug, opts) {
    var piece = find(slug); if (!piece || state.switching) return;
    opts = opts || {};
    state.switching = true;
    clearTimeout(state.timer);
    var old = scroller.firstElementChild, wasNext = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('next');
    var wasPrev = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('prev');
    if (old) { old.classList.remove('is-in'); old.classList.add('is-out'); }
    unmount();
    /* L'URL suit la pièce ; l'entrée d'historique n'est « à nous » que si l'ouverture l'a créée (sinon la fermeture ferait back()) */
    if (opts.push !== false) { try { window.history.replaceState(ownsHistory() ? { ajDetail: slug } : null, '', urlWith(slug)); } catch (e) {} }
    state.timer = setTimeout(function () {
      state.switching = false;
      if (!state.open) return;
      var inner = mount(piece);
      inner.style.setProperty('--d0', '0ms');
      scroller.scrollTop = 0;
      var f = wasNext ? inner.querySelector('.detail-nav-link.next') : wasPrev ? inner.querySelector('.detail-nav-link.prev') : null;
      try { (f || overlay).focus({ preventScroll: true }); } catch (e) {}
      enter(inner);
      state.timer = setTimeout(function () { if (state.open && state.slug === slug) state.photo = attachPhoto(inner, true); }, reduce ? 0 : PHOTO_DELAY);
      AJ.emit('detail:open', { slug: slug });
    }, reduce ? 0 : SWITCH_MS);
  }
  function neighbour(dir) {
    var n = AJ.pieces.length, k = index(state.slug); if (k < 0 || n < 2) return null;
    return AJ.pieces[(k + dir + n) % n].slug;
  }

  /* Interactions de l'overlay */
  closeBtn.addEventListener('click', function () { close(); });
  overlay.addEventListener('click', function (e) {
    var go = e.target.closest && e.target.closest('[data-detail-go]');
    if (go && overlay.contains(go)) { e.preventDefault(); switchTo(go.getAttribute('data-detail-go')); return; }
    /* Fond : la zone hors du contenu (autour de la fiche) */
    if (e.target === overlay || e.target === scroller) close();
  });
  overlay.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var list = Array.prototype.filter.call(overlay.querySelectorAll(FOCUSABLE), function (el) { return el.offsetWidth || el.offsetHeight || el.getClientRects().length; });
    if (!list.length) { e.preventDefault(); return; }
    var first = list[0], last = list[list.length - 1], a = document.activeElement;
    var outside = !a || a === overlay || !overlay.contains(a);
    if (e.shiftKey) { if (a === first || outside) { e.preventDefault(); last.focus(); } }
    else if (a === last || (outside && a !== overlay)) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    if (!state.open) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(); return; }
    if (e.target && e.target.closest && e.target.closest('.detail-strip')) return;
    if (e.key === 'ArrowRight') { var n = neighbour(1); if (n) switchTo(n); }
    else if (e.key === 'ArrowLeft') { var p = neighbour(-1); if (p) switchTo(p); }
  });
  window.addEventListener('popstate', function (e) {
    var slug = (e.state && e.state.ajDetail) || slugFromUrl();
    if (slug && find(slug)) open(slug, { push: false });
    else if (state.open) close({ history: false });
  });

  /* API publique */
  AJ.openPiece = function (slug) { if (!open(slug)) window.location.href = slug + '.html'; };
  AJ.closePiece = function () { close(); };
  AJ.detail = { open: open, close: close, next: function () { var n = neighbour(1); if (n) switchTo(n); }, prev: function () { var p = neighbour(-1); if (p) switchTo(p); }, isOpen: function () { return state.open; }, render: render };

  /* Ouverture directe : index.html?piece=veste-bleue */
  var initial = slugFromUrl();
  if (initial && find(initial)) {
    AJ.ready.then(function () { open(initial, { push: false }); });
  }

  /* ================================================================== Variante à plat */
  document.querySelectorAll('[data-scene="detail"][data-slug]').forEach(function (section) {
    var piece = find(section.getAttribute('data-slug'));
    if (!piece) return;
    section.innerHTML = render(piece, 'flat');
    var inner = section.firstElementChild;
    inner.style.setProperty('--d0', '0ms');
    section.setAttribute('aria-labelledby', 'detail-title-flat');
    mailto(inner);
    initStrip(inner.querySelector('.detail-strip'));
    initParallax(section, inner);
    if (AJ.ScrollTrigger) { try { AJ.ScrollTrigger.refresh(); } catch (e) {} }
    if (AJ.lenis && typeof AJ.lenis.resize === 'function') { try { AJ.lenis.resize(); } catch (e) {} }
    var img = inner.querySelector('.detail-media img');
    if (img) img.addEventListener('load', function () { if (AJ.ScrollTrigger) { try { AJ.ScrollTrigger.refresh(); } catch (e) {} } }, { once: true });
    AJ.ready.then(function () {
      var start = function () { enter(inner, { then: function () { setTimeout(function () { attachPhoto(inner, true); }, reduce ? 0 : 200); } }); };
      if (reduce || !('IntersectionObserver' in window)) { start(); return; }
      var r = section.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.85 && r.bottom > 0) { start(); return; }
      var io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); start(); } }, { threshold: 0.12 });
      io.observe(section);
    });
  });
})();
