/* Scène « campagne » : tunnel des neuf images le long de l’axe Z.
   La section est épinglée ; le défilement avance la caméra. Chaque image est placée à z = i (unités image),
   projetée en perspective (scale = P / (P + z)), voilée et floue au loin, nette et lumineuse au plan focal,
   puis dépasse la caméra en fondu. L’image la plus proche du plan focal reçoit AJ.Photo3D (une seule instance).
   Sans JS, avec html.reduce ou sans GSAP : les images restent empilées à plat (CSS), seuls les clics sont gérés. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ Réglages */
  var CFG = {
    perspective: 1000,          // distance focale (px) : scale = P / (P + z)
    gap: 900,                   // écart en Z entre deux images (px)
    scrollPerImage: 900,        // défilement (px) par unité image, bureau  → hauteur d’épinglage = (camEnd − camStart) × 900 ≈ 9 200 px
    scrollPerImageMobile: 520,  // idem, mobile (≤ 760 px de large) ≈ 5 300 px
    camStart: -1.7,             // caméra au départ (unités image : l’image i est à z = i)
    camEnd: 8.45,               // caméra à la fin : la neuvième image vient de dépasser la caméra
    titleSpan: 1.0,             // unités de caméra pendant lesquelles le titre s’éloigne
    fadeOut: [-0.04, -0.36],    // rel = i − cam : opacité 1 → 0 quand l’image dépasse la caméra (échelle 1,04 → 1,48)
    fogNear: [0.18, 0.95],      // rel : voile 0 → fogNearMax juste derrière le plan focal (l’image suivante attend, voilée, que la précédente soit passée)
    fogNearMax: 0.42,
    fog: [0.95, 3.4],           // rel : voile fogNearMax → fogMax au loin
    fogMax: 0.94,
    passDim: 0.7,               // voile ajouté à l’image qui dépasse la caméra (elle s’enfonce dans le noir en plus de s’effacer)
    farFade: [3.2, 4.4],        // rel : opacité 1 → 0 tout au loin (au-delà : masquée)
    blur: [0.9, 3.6],           // rel : flou 0 → blurMax (bureau seulement)
    blurMax: 8,
    capIn: [0.62, 0.3],         // rel : légende 0 → 1 à l’approche
    capOut: [-0.08, -0.3],      // rel : légende 1 → 0 au dépassement
    spread: 0.7,                // exposant appliqué à l’échelle pour le décalage X/Y : < 1 étale les images lointaines autour du point de fuite
    meander: [4.5, 2.2],        // amplitude [vw, vh] du méandre latéral de la caméra le long du tunnel (0 : rectiligne)
    mouseShift: 14,             // px de parallaxe souris sur les images au plan focal (proportionnel à l’échelle ; bureau seulement)
    tilt: 0.2,                  // degrés de rotateY par vw de décalage X (0 : aucune inclinaison ; bureau seulement)
    scrub: 0.5,
    /* décalages [x en vw, y en vh] au plan focal : disposés sur une ellipse, pas de 140° entre deux images
       successives pour que la suivante dépasse toujours derrière la précédente */
    offsets: [[-11.3, -2.7], [11.3, -2.7], [-6, 6.9], [-2.1, -7.9], [9.2, 5.1], [-12, 0], [9.2, -5.1], [-2.1, 7.9], [-6, -6.9]],
    offsetsMobile: [[-3.8, -3.1], [3.8, -3.1], [-2, 7.7], [-0.7, -8.9], [3.1, 5.8], [-4, 0], [3.1, -5.8], [-0.7, 8.9], [-2, -7.7]],
    photo3d: { amount: 1, dolly: 0.9 }  // dolly : amplitude de setOffset pilotée par l’approche (0 : désactivé)
  };

  var root = document.querySelector('[data-scene="campagne"]');
  if (!root) return;
  var AJ = window.AJ || {};
  var items = [].slice.call(root.querySelectorAll('.cp-item'));
  if (!items.length) return;
  var n = items.length;

  /* Données : nom de la pièce et slug depuis AJ.pieces (le HTML à plat les contient déjà ; on les resynchronise) */
  items.forEach(function (el) {
    var key = el.getAttribute('data-key');
    var piece = (AJ.pieces || []).filter(function (p) { return (p.images || []).some(function (im) { return im[0] === key; }); })[0];
    if (piece) {
      el.setAttribute('data-slug', piece.slug);
      el.setAttribute('href', piece.slug + '.html');
      var name = el.querySelector('.cp-name'); if (name) name.textContent = piece.name;
    }
  });

  /* Clic → AJ.openPiece(slug) (la scène detail remplace la fonction) */
  items.forEach(function (el) {
    el.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var slug = el.getAttribute('data-slug');
      if (!slug || typeof AJ.openPiece !== 'function') return;
      e.preventDefault(); AJ.openPiece(slug);
    });
  });

  var G = AJ.gsap, ST = AJ.ScrollTrigger;
  if (AJ.reduce || !G || !ST || !document.documentElement.classList.contains('js')) { root.classList.add('cp-flat'); return; }

  /* ------------------------------------------------------------------ État */
  var mq = window.matchMedia('(max-width: 760px)');
  var state = { cam: CFG.camStart, reveal: 0 };
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var head = root.querySelector('.cp-head');
  var eyebrow = head && head.querySelector('.eyebrow');
  var lines = head ? [].slice.call(head.querySelectorAll('.cp-line-in')) : [];
  var frames = items.map(function (el) { return el.querySelector('.cp-frame'); });
  var veils = items.map(function (el) { return el.querySelector('.cp-veil'); });
  var caps = items.map(function (el) { return el.querySelector('.cp-cap'); });
  var last = items.map(function () { return { t: '', o: -1, v: -1, f: '', c: -1, cs: '', vis: '', pe: '' }; });
  var lastHead = '';
  var P = CFG.perspective, Gp = CFG.gap;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function ramp(x, a, b) { return smooth((x - a) / (b - a)); }   /* 0 en a, 1 en b */

  /* ------------------------------------------------------------------ Rendu d’une position de caméra */
  function render(cam) {
    var vw = AJ.viewport ? AJ.viewport.w : window.innerWidth, vh = AJ.viewport ? AJ.viewport.h : window.innerHeight;
    var mobile = mq.matches, offsets = mobile ? CFG.offsetsMobile : CFG.offsets;
    var reveal = state.reveal;
    /* méandre : la caméra dérive latéralement le long du tunnel (parallaxe entre les plans) */
    var camX = CFG.meander[0] / 100 * vw * Math.sin(cam * 0.85 + 0.6), camY = CFG.meander[1] / 100 * vh * Math.cos(cam * 0.6);
    var ms = mobile ? 0 : CFG.mouseShift;
    for (var i = 0; i < n; i++) {
      var el = items[i], L = last[i], rel = i - cam;
      if (rel > CFG.farFade[1] || rel < CFG.fadeOut[1]) {
        /* hors champ : opacité 0 (pas visibility:hidden, pour que le lien reste focusable au clavier) */
        if (L.vis !== 'off') { el.style.opacity = '0'; el.style.pointerEvents = 'none'; el.classList.remove('is-near'); L.vis = 'off'; L.o = 0; L.pe = 'none'; }
        continue;
      }
      var z = rel * Gp, s = P / (P + z);
      var off = offsets[i] || [0, 0], sp = Math.pow(s, CFG.spread);
      var ox = off[0] / 100 * vw * sp - camX * s + mouse.x * ms * s, oy = off[1] / 100 * vh * sp - camY * s + mouse.y * ms * 0.6 * s;
      var a = 1;
      if (rel < CFG.fadeOut[0]) a = ramp(rel, CFG.fadeOut[1], CFG.fadeOut[0]);
      if (rel > CFG.farFade[0]) a *= 1 - ramp(rel, CFG.farFade[0], CFG.farFade[1]);
      a *= reveal;
      var v = rel < 0 ? ramp(-rel, 0, -CFG.fadeOut[1]) * CFG.passDim
        : ramp(rel, CFG.fogNear[0], CFG.fogNear[1]) * CFG.fogNearMax + ramp(rel, CFG.fog[0], CFG.fog[1]) * (CFG.fogMax - CFG.fogNearMax);
      var b = mobile ? 0 : ramp(rel, CFG.blur[0], CFG.blur[1]) * CFG.blurMax;
      var c = ramp(rel, CFG.capIn[0], CFG.capIn[1]) * (1 - ramp(rel, CFG.capOut[0], CFG.capOut[1])) * reveal;
      var tilt = CFG.tilt && !mobile ? (-off[0] * CFG.tilt) : 0;
      var t = 'translate(-50%,-50%) translate3d(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')' + (tilt ? ' perspective(1400px) rotateY(' + tilt.toFixed(2) + 'deg)' : '');
      L.vis = 'on';
      if (t !== L.t) { el.style.transform = t; L.t = t; }
      if (Math.abs(a - L.o) > 0.002) { el.style.opacity = a.toFixed(3); L.o = a; }
      if (Math.abs(v - L.v) > 0.002 && veils[i]) { veils[i].style.opacity = v.toFixed(3); L.v = v; }
      var f = b > 0.08 ? 'blur(' + b.toFixed(2) + 'px)' : '';
      if (f !== L.f) { frames[i].style.filter = f; L.f = f; }
      if (caps[i]) {
        if (Math.abs(c - L.c) > 0.002) { caps[i].style.opacity = c.toFixed(3); L.c = c; }
        if (c > 0.001) { var cs = 'scale(' + (1 / s).toFixed(4) + ')'; if (cs !== L.cs) { caps[i].style.transform = cs; L.cs = cs; } }
      }
      var near = rel > -0.45 && rel < 0.55;
      var pe = near ? 'auto' : 'none';
      if (pe !== L.pe) { el.style.pointerEvents = pe; L.pe = pe; el.classList.toggle('is-near', near); }
    }
    /* titre : s’éloigne quand la caméra avance */
    if (head) {
      var k = ramp(cam, CFG.camStart, CFG.camStart + CFG.titleSpan);
      var hs = 1 - 0.34 * k, ho = 1 - ramp(k, 0, 0.75), hb = 12 * ramp(k, 0.1, 1), hy = -6 * k;
      var hstr = hs.toFixed(4) + '|' + ho.toFixed(3) + '|' + hb.toFixed(2);
      if (hstr !== lastHead) {
        lastHead = hstr;
        head.style.transform = 'translate3d(0,' + hy.toFixed(2) + 'vh,0) scale(' + hs.toFixed(4) + ')';
        head.style.opacity = ho.toFixed(3);
        head.style.filter = hb > 0.1 ? 'blur(' + hb.toFixed(2) + 'px)' : '';
        head.style.visibility = ho > 0.001 ? 'visible' : 'hidden';
      }
    }
    updateFocal(cam);
  }

  /* ------------------------------------------------------------------ Photo3D : une seule instance, sur l’image la plus proche du plan focal */
  var focal = -1, inst = null, active = false;
  function updateFocal(cam) {
    var f = clamp(Math.round(cam), 0, n - 1);
    if (f !== focal) {
      if (inst) { try { inst.destroy(); } catch (e) {} inst = null; }
      focal = f;
      var P3 = AJ.Photo3D;
      if (P3 && typeof P3.attach === 'function') {
        try {
          inst = P3.attach(frames[f], { key: items[f].getAttribute('data-key'), amount: CFG.photo3d.amount, mouse: !!AJ.fine, scroll: !CFG.photo3d.dolly, gyro: false, dissolve: false, mist: false });
          if (inst && !active && typeof inst.pause === 'function') inst.pause();
        } catch (e) { inst = null; }
      }
    }
    if (inst && CFG.photo3d.dolly && typeof inst.setOffset === 'function') {
      var rel = focal - cam;   /* approche : l’image « respire » en profondeur quand elle passe le plan focal */
      try { inst.setOffset(0, clamp(-rel * CFG.photo3d.dolly, -1, 1)); } catch (e) {}
    }
  }
  function setActive(on) {
    active = on;
    if (!inst) return;
    try { if (on && inst.resume) inst.resume(); else if (!on && inst.pause) inst.pause(); } catch (e) {}
  }

  /* ------------------------------------------------------------------ Défilement épinglé */
  function totalScroll() { return Math.round((CFG.camEnd - CFG.camStart) * (mq.matches ? CFG.scrollPerImageMobile : CFG.scrollPerImage)); }
  var tl = G.timeline({
    scrollTrigger: {
      trigger: root, start: 'top top', end: function () { return '+=' + totalScroll(); },
      pin: true, scrub: CFG.scrub, anticipatePin: 1, invalidateOnRefresh: true,
      onToggle: function (self) { setActive(self.isActive); }
    }
  });
  tl.fromTo(state, { cam: CFG.camStart }, { cam: CFG.camEnd, ease: 'none', duration: 1, onUpdate: function () { render(state.cam); } });
  var st = tl.scrollTrigger;

  /* Souris (pointeur fin) : légère parallaxe du monde, lissée dans le ticker GSAP, seulement quand la scène est épinglée */
  if (AJ.fine && CFG.mouseShift) {
    window.addEventListener('pointermove', function (e) {
      mouse.tx = clamp(e.clientX / window.innerWidth * 2 - 1, -1, 1); mouse.ty = clamp(e.clientY / window.innerHeight * 2 - 1, -1, 1);
    }, { passive: true });
    G.ticker.add(function () {
      if (!active) return;
      var dx = mouse.tx - mouse.x, dy = mouse.ty - mouse.y;
      if (Math.abs(dx) < 0.0006 && Math.abs(dy) < 0.0006) return;
      mouse.x += dx * 0.06; mouse.y += dy * 0.06;
      render(state.cam);
    });
  }

  /* Clavier : le focus sur une image amène la caméra dessus */
  items.forEach(function (el, i) {
    el.addEventListener('focus', function () {
      if (!st) return;
      var y = st.start + ((i - CFG.camStart) / (CFG.camEnd - CFG.camStart)) * (st.end - st.start);
      if (Math.abs(window.scrollY - y) < 4) return;
      if (AJ.lenis && AJ.lenis.scrollTo) AJ.lenis.scrollTo(y, { duration: 0.9 });
      else window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  /* ------------------------------------------------------------------ Entrée : titre et tunnel qui émergent (après AJ.ready) */
  function showNow() {
    if (eyebrow) G.set(eyebrow, { opacity: 1 });
    if (lines.length) G.set(lines, { yPercent: 0 });
    state.reveal = 1; render(state.cam);
  }
  function entrance() {
    root.classList.add('is-in');
    if (st && st.progress > 0.12) { showNow(); return; }
    if (eyebrow) G.fromTo(eyebrow, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power2.out', delay: 0.1 });
    if (lines.length) G.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.14, delay: 0.15 });
    G.to(state, { reveal: 1, duration: 2.2, ease: 'power2.out', delay: 0.2, onUpdate: function () { render(state.cam); } });
  }
  render(state.cam);
  var readyP = AJ.ready && typeof AJ.ready.then === 'function' ? AJ.ready : Promise.resolve();
  readyP.then(function () {
    ST.create({ trigger: root, start: 'top 80%', once: true, onEnter: entrance });
    /* si la scène est déjà à l’écran, ScrollTrigger appelle onEnter au refresh ; sinon on attend l’arrivée */
  });

  /* Recalcul après chargement des images et sur redimensionnement */
  var refreshTO = null;
  function refreshSoon() { clearTimeout(refreshTO); refreshTO = setTimeout(function () { ST.refresh(); render(state.cam); }, 80); }
  var imgs = root.querySelectorAll('img');
  for (var k = 0; k < imgs.length; k++) { if (!imgs[k].complete) imgs[k].addEventListener('load', refreshSoon, { once: true }); }
  window.addEventListener('load', refreshSoon, { once: true });
  if (AJ.on) AJ.on('resize', function () { render(state.cam); });
  if (mq.addEventListener) mq.addEventListener('change', refreshSoon);
})();
