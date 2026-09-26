/* Scène « manifeste » : tunnel de mots. Les cinq phrases sont placées dans un espace à différentes profondeurs Z ;
   la section est épinglée et le défilement (scrub) avance la caméra en Z. Pour chaque phrase : z = zPhrase − zCaméra,
   échelle = P / (P + z), opacité pleine quand |z| est petit, nulle quand la phrase est loin (brouillard) ou passée
   derrière la caméra. La projection est calculée ici (translate3d + scale) plutôt qu'avec preserve-3d.
   Parallaxe souris légère (bureau). Entrée après AJ.ready. Repli : sans GSAP/ScrollTrigger ou en mouvement réduit,
   le CSS affiche les phrases à plat. */
(function () {
  'use strict';

  /* ---- Réglages ------------------------------------------------------------- */
  var P = 1000;               /* perspective (px), identique à manifeste.css */
  var PIN_DESKTOP = 4500;     /* hauteur de défilement de la section épinglée (px), bureau */
  var PIN_MOBILE = 2600;      /* idem, mobile (≤ 860 px) */
  var SCRUB = 0.9;            /* lissage du scrub (s) */
  var Z_START = -720;         /* position de la caméra au début (la première phrase est à 720 px devant) */
  var Z_AFTER = 0;            /* distance parcourue après la dernière phrase (elle passe derrière la caméra) */
  var NEAR = 300;             /* jusqu'à cette distance la phrase est pleinement nette et crème */
  var FAR = 1700;             /* au-delà : invisible (brouillard) */
  var BEHIND = 360;           /* distance derrière la caméra sur laquelle la phrase disparaît */
  var BLUR_MAX = 8;           /* flou maximal (px), bureau seulement */
  var MOUSE_AMP = 70;         /* amplitude de la parallaxe souris (px de décalage caméra) */
  var MOUSE_LERP = 0.08;      /* lissage de la souris */
  var MOBILE = '(max-width: 860px)';
  var MOBILE_X = 0.4;         /* sur mobile, les décalages horizontaux de composition sont réduits */

  var AJ = window.AJ; if (!AJ) return;
  var section = document.querySelector('[data-scene="manifeste"]'); if (!section) return;
  var G = AJ.gsap, ST = AJ.ScrollTrigger;
  var world = section.querySelector('.mf-world');
  var lines = [].slice.call(section.querySelectorAll('.mf-line'));
  var counter = section.querySelector('.mf-counter-cur');
  if (AJ.reduce || !G || !ST || !world || !lines.length) { section.classList.add('is-ready', 'is-static'); return; }

  var isMobile = function () { return window.matchMedia(MOBILE).matches; };
  var items = lines.map(function (el, i) {
    return { el: el, z: parseFloat(el.getAttribute('data-z')) || 0, x: parseFloat(el.getAttribute('data-x')) || 0, y: parseFloat(el.getAttribute('data-y')) || 0, i: i, lastBlur: -1 };
  });
  var zLast = items[items.length - 1].z, zEnd = zLast + Z_AFTER;
  var state = { p: 0 };
  var W = AJ.viewport.w, H = AJ.viewport.h, fine = AJ.fine;
  var mouse = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  var dirty = true, current = -1;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function render() {
    var zCam = Z_START + state.p * (zEnd - Z_START);
    var mob = isMobile(), kx = mob ? MOBILE_X : 1;
    var camX = mouse.x * MOUSE_AMP, camY = mouse.y * MOUSE_AMP * 0.6;
    var nearest = -1, nearestZ = Infinity;
    for (var k = 0; k < items.length; k++) {
      var it = items[k], z = it.z - zCam, s = it.el.style;
      if (z <= -P * 0.92 || z >= FAR) { if (s.visibility !== 'hidden') { s.visibility = 'hidden'; s.opacity = '0'; } continue; }
      var scale = P / (P + z);
      var o = z >= 0 ? 1 - clamp01((z - NEAR) / (FAR - NEAR)) : 1 - clamp01((-z - 60) / BEHIND);
      o = o * o * (3 - 2 * o);                                    /* lissage */
      var X = it.x * W * kx - camX, Y = it.y * H - camY;
      s.visibility = o > 0.005 ? 'visible' : 'hidden';
      s.opacity = o.toFixed(3);
      s.transform = 'translate(-50%,-50%) translate3d(' + (X * scale).toFixed(2) + 'px,' + (Y * scale).toFixed(2) + 'px,0) scale(' + scale.toFixed(4) + ')';
      if (fine) {
        var b = z >= 0 ? clamp01((z - NEAR * 0.9) / (FAR - NEAR)) * BLUR_MAX : clamp01((-z - 40) / BEHIND) * BLUR_MAX * 0.8;
        b = Math.round(b * 2) / 2;
        if (b !== it.lastBlur) { it.lastBlur = b; s.setProperty('--mf-blur', b + 'px'); }
      }
      if (z > -BEHIND && z < nearestZ) { nearestZ = z; nearest = k; }
    }
    if (nearest >= 0 && nearest !== current) { current = nearest; if (counter) counter.textContent = (current < 9 ? '0' : '') + (current + 1); }
    section.style.setProperty('--mf-p', state.p.toFixed(4));
  }

  /* Une seule boucle : lissage de la souris + rendu quand quelque chose a changé */
  function tick() {
    var dx = target.x - mouse.x, dy = target.y - mouse.y;
    if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) { mouse.x += dx * MOUSE_LERP; mouse.y += dy * MOUSE_LERP; dirty = true; }
    if (dirty) { dirty = false; render(); }
  }

  /* Défilement : section épinglée, la progression avance la caméra */
  G.to(state, {
    p: 1, ease: 'none',
    scrollTrigger: {
      trigger: section, start: 'top top', pin: true, scrub: SCRUB, invalidateOnRefresh: true, anticipatePin: 1,
      end: function () { return '+=' + (isMobile() ? PIN_MOBILE : PIN_DESKTOP); }
    },
    onUpdate: function () { dirty = true; }
  });

  if (fine) {
    window.addEventListener('mousemove', function (e) {
      target.x = (e.clientX / W) * 2 - 1; target.y = (e.clientY / H) * 2 - 1;
    }, { passive: true });
  }
  AJ.on('resize', function (v) { W = v.w; H = v.h; dirty = true; });

  render();
  AJ.ready.then(function () {
    section.classList.add('is-ready');
    G.ticker.add(tick);
    ST.refresh();
  });
})();
