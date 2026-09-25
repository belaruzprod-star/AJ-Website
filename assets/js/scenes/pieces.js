/* Scène « pieces » : anneau 3D de trois panneaux, tourné par le défilement (section épinglée),
   au doigt/à la souris (pointer events, inertie légère) et au clavier. Panneau de face : classe is-front + Photo3D léger. */
(function () {
  var PIN_LENGTH = 2400;        /* hauteur de défilement de la section épinglée (px) */
  var TURN = -360;              /* rotation totale de l'anneau sur la durée du pin (deg) */
  var STEP = 120;               /* angle entre deux panneaux (deg) */
  var DRAG_DEG_PER_PX = 0.32;   /* sensibilité du glisser (deg par px), ×1.5 sur écran étroit */
  var INERTIA_MS = 140;         /* élan après relâchement : vitesse (deg/ms) × INERTIA_MS */
  var SETTLE = 0.9;             /* durée du recalage après glisser (s) */
  var PHOTO3D_AMOUNT = 0.7;     /* intensité Photo3D du panneau de face */
  var CLICK_TOLERANCE = 6;      /* px : au-delà, un pointerup n'est plus un clic */
  var FACE_K = 0.3, FACE_P = 4; /* redressement des panneaux latéraux : angle vu = φ·(K + (1−K)·(|φ|/180)^P) */

  var section = document.querySelector('[data-scene="pieces"]');
  if (!section) return;
  var AJ = window.AJ || {};
  var stage = section.querySelector('.ring-stage');
  var ring = section.querySelector('.ring');
  var panels = Array.prototype.slice.call(section.querySelectorAll('.ring-panel'));
  if (!stage || !ring || !panels.length) return;
  var n = panels.length;
  var G = AJ.gsap, ST = AJ.ScrollTrigger;

  var state = { scrollAngle: 0, drag: 0, front: -1, moved: false, settling: null };
  var st = null;

  function mod(k) { return ((k % n) + n) % n; }
  function angle() { return state.scrollAngle + state.drag; }
  function frontIndex(a) { return mod(Math.round(-a / STEP)); }

  /* Photo3D : une instance par panneau, créée à la première mise de face ; seule celle de face tourne (les autres en pause).
     Trois contextes WebGL au plus ; sans AJ.Photo3D (ou en mouvement réduit) : l'image reste. */
  var photos = [];
  function attachPhoto(panel) {
    var P = window.AJ && window.AJ.Photo3D, idx = panels.indexOf(panel);
    if (!P || typeof P.attach !== 'function' || AJ.reduce) return;
    photos.forEach(function (inst, i) { if (inst && i !== idx) { try { inst.pause(); } catch (e) {} } });
    if (photos[idx]) { try { photos[idx].resume(); } catch (e) {} return; }
    var media = panel.querySelector('.ring-media'), key = panel.getAttribute('data-key');
    if (!media || !key || !AJ.images || !AJ.images[key]) return;
    try { photos[idx] = P.attach(media, { key: key, amount: PHOTO3D_AMOUNT, scroll: false }); } catch (e) { photos[idx] = null; }
  }

  function setFront(i, silent) {
    if (i === state.front) return;
    state.front = i;
    panels.forEach(function (p, j) {
      p.classList.toggle('is-front', j === i);
      p.setAttribute('aria-current', j === i ? 'true' : 'false');
      if (j !== i) p.setAttribute('tabindex', '-1'); else p.removeAttribute('tabindex');
    });
    if (!silent) attachPhoto(panels[i]);
  }

  function render() {
    var a = angle();
    ring.style.setProperty('--ring-a', a.toFixed(3) + 'deg');
    for (var i = 0; i < n; i++) {
      var phi = a + i * STEP; phi = phi - 360 * Math.round(phi / 360);           /* angle du panneau vu de face, dans ]-180, 180] */
      var t = Math.abs(phi) / 180, facing = phi * (FACE_K + (1 - FACE_K) * Math.pow(t, FACE_P));
      panels[i].style.setProperty('--face', (facing - phi).toFixed(3) + 'deg');
    }
    setFront(frontIndex(a));
  }

  /* Mode réduit / sans GSAP : rien ne tourne, le premier panneau est « de face », clic → openPiece */
  function bindClicks() {
    panels.forEach(function (p) {
      p.addEventListener('click', function (e) {
        if (state.moved) { e.preventDefault(); state.moved = false; return; }
        var i = panels.indexOf(p);
        if (st && i !== state.front) { e.preventDefault(); goTo(i); return; }
        if (AJ.openPiece) { e.preventDefault(); AJ.openPiece(p.getAttribute('data-slug')); }
      });
    });
  }

  if (AJ.reduce || !G || !ST) {
    setFront(0, true);
    panels.forEach(function (p) { p.removeAttribute('tabindex'); });
    bindClicks();
    return;
  }

  /* Défilement : section épinglée, rotation 0 → TURN, accrochage doux sur chaque panneau */
  st = ST.create({
    trigger: section, start: 'top top', end: '+=' + PIN_LENGTH, pin: true, scrub: true,
    anticipatePin: 1, invalidateOnRefresh: true,
    snap: { snapTo: 1 / n, duration: { min: 0.25, max: 0.7 }, delay: 0.08, ease: 'power2.inOut' },
    onUpdate: function (self) { state.scrollAngle = TURN * self.progress; render(); },
    onRefresh: function (self) { state.scrollAngle = TURN * self.progress; render(); }
  });

  function scrollFor(progress) { return st.start + (st.end - st.start) * progress; }
  function jumpScroll(y) {
    if (AJ.lenis && typeof AJ.lenis.scrollTo === 'function') { try { AJ.lenis.scrollTo(y, { immediate: true, force: true }); } catch (e) { window.scrollTo(0, y); } }
    else window.scrollTo(0, y);
    ST.update();
  }

  /* Amène l'anneau sur l'angle cible (multiple de STEP) : le défilement saute au point d'accrochage
     correspondant, le décalage de glisser compense visuellement, puis se résorbe en douceur. */
  function settleTo(targetAngle) {
    var current = angle();
    var wrapped = targetAngle;                                     /* ramené dans [TURN, 0] */
    while (wrapped > 0) wrapped += TURN;
    while (wrapped < TURN) wrapped -= TURN;
    var progress = wrapped / TURN;
    if (state.settling) state.settling.kill();
    jumpScroll(scrollFor(progress));
    state.scrollAngle = TURN * progress;
    state.drag = current - state.scrollAngle;
    /* choisir le tour le plus court */
    state.drag = state.drag - 360 * Math.round(state.drag / 360);
    render();
    state.settling = G.to(state, { drag: 0, duration: SETTLE, ease: 'power3.out', onUpdate: render, onComplete: function () { state.settling = null; } });
  }
  function goTo(index) {
    var cur = frontIndex(angle());
    var delta = mod(index - cur); if (delta > n / 2) delta -= n;    /* chemin le plus court */
    settleTo(-STEP * (Math.round(-angle() / STEP) + delta));
  }

  /* Glisser au doigt / à la souris */
  var drag = null;
  stage.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (state.settling) { state.settling.kill(); state.settling = null; }
    drag = { x: e.clientX, x0: e.clientX, t: e.timeStamp, v: 0, id: e.pointerId };
    state.moved = false;
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dt = Math.max(1, e.timeStamp - drag.t);
    var k = DRAG_DEG_PER_PX * (window.innerWidth < 760 ? 1.5 : 1);
    if (!state.moved && Math.abs(e.clientX - drag.x0) > CLICK_TOLERANCE) {
      state.moved = true; section.classList.add('is-dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}   /* capturé seulement après un vrai glisser : un clic simple reste un clic */
    }
    if (!state.moved) return;
    state.drag += dx * k;
    drag.v = drag.v * 0.6 + (dx * k / dt) * 0.4;
    drag.x = e.clientX; drag.t = e.timeStamp;
    render();
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var v = drag.v; drag = null;
    section.classList.remove('is-dragging');
    if (!state.moved) return;
    try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
    var a = angle() + v * INERTIA_MS;
    settleTo(Math.round(a / STEP) * STEP);
    /* state.moved reste vrai jusqu'au clic synthétique qui suit, pour l'annuler */
    setTimeout(function () { state.moved = false; }, 0);
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* Clavier : flèches ; un panneau qui reçoit le focus vient de face */
  section.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(state.front + 1); focusFront(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(state.front - 1); focusFront(); }
  });
  function focusFront() { var p = panels[state.front]; if (p && document.activeElement !== p) p.focus({ preventScroll: true }); }
  panels.forEach(function (p, i) {
    p.addEventListener('focus', function () { if (i !== state.front && !state.settling) goTo(i); });
  });

  bindClicks();
  render();

  /* Rafraîchir les mesures quand les images sont chargées */
  var imgs = panels.map(function (p) { return p.querySelector('img'); }).filter(Boolean);
  Promise.all(imgs.map(function (img) {
    return img.complete ? Promise.resolve() : new Promise(function (res) { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); });
  })).then(function () { ST.refresh(); });

  /* Entrée après le préchargeur */
  var ready = AJ.ready && typeof AJ.ready.then === 'function' ? AJ.ready : Promise.resolve();
  ready.then(function () {
    var head = section.querySelector('.pieces-head');
    G.from(head, { opacity: 0, y: 36, duration: 1.3, ease: 'power3.out', clearProps: 'opacity,transform',
      scrollTrigger: { trigger: section, start: 'top 75%', once: true } });
    G.from(stage, { opacity: 0, duration: 1.6, ease: 'power2.out', clearProps: 'opacity',
      scrollTrigger: { trigger: section, start: 'top 75%', once: true } });
    attachPhoto(panels[state.front]);
  });
})();
