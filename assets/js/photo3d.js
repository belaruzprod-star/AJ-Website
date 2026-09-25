/* Photo3D — « photo 3D » : parallaxe par pixel pilotée par une carte de profondeur, en WebGL brut, sans dépendance.
   Usage : var p = AJ.Photo3D.attach(el, { key: '07', amount: 1.4, mouse: true, scroll: true, gyro: true, dissolve: true, mist: true, onReady: fn });
           p.setOffset(dx, dy) (−1..1, dy > 0 = vers le haut) · p.setAmount(a) · p.pause() · p.resume() · p.destroy() · p.reveal() (dissolution manuelle).
   `el` est un conteneur positionné qui contient déjà l'<img>/<picture> de repli ; un <canvas aria-hidden> absolu le recouvre (object-fit cover
   reproduit dans le shader). Sans WebGL, avec « réduire les animations », ou si le contexte est perdu : le canvas est retiré/masqué, l'image reste.
   Cartes de profondeur : assets/depth/<nom>.png (blanc = proche). Si absente : dégradé radial + vertical généré en mémoire (parallaxe douce). */
(function () {
  'use strict';
  var AJ = window.AJ || (window.AJ = {});
  if (AJ.Photo3D) return;

  /* ---- Réglages ---- */
  var PARALLAX = 0.06;        /* amplitude du déplacement des uv : (profondeur − 0.5) × offset × amount × PARALLAX */
  var TILT = 0.12;            /* recul/inclinaison globale : part de PARALLAX appliquée à toute l'image (la caméra bouge un peu) */
  var INSET = 0.06;           /* marge d'échantillonnage : les uv sont rétrécies de INSET × min(amount, 1.5) pour ne pas révéler le bord */
  var ABERR = 0.035;          /* aberration chromatique proportionnelle au déplacement (0 = aucune) */
  var MOUSE_MS = 260;         /* constante de temps de l'amortissement (ms) : plus grand = plus lent */
  var SCROLL_STRENGTH = 0.55; /* offset vertical (−1..1) dû à la position du conteneur dans l'écran (opts.scroll) */
  var GYRO_DEG = 22;          /* degrés d'inclinaison pour un offset de 1 (opts.gyro) */
  var DPR_MAX = 1.5;          /* densité de pixels maximale ; réduite automatiquement si le rendu est lent */
  var BG = [0.043, 0.059, 0.075]; /* couleur de fond de la dissolution (#0b0f13) */

  var reduce = AJ.reduce || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = (typeof AJ.fine === 'boolean') ? AJ.fine : window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;varying vec2 v;',
    'uniform sampler2D t,d;uniform vec2 r,tr,ps,of;uniform float am,ti,rv,mi;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*n(p);p=p*2.03+1.7;a*=.5;}return s;}',
    'void main(){',
    ' vec2 uv=v; float ra=r.x/r.y, ta=tr.x/tr.y; vec2 s=vec2(1.); if(ra>ta) s.y=ta/ra; else s.x=ra/ta;',
    ' float ins=' + INSET.toFixed(3) + '*min(am,1.5);',
    ' vec2 cuv=((uv-.5)*(1.-ins)+.5)*s+ps*(1.-s);',
    ' vec2 g=of*am*' + PARALLAX.toFixed(3) + '*s;',
    ' float dep=texture2D(d,cuv).r;',
    ' vec2 disp=(dep-.5)*g+g*' + TILT.toFixed(3) + ';',
    ' vec2 puv=cuv+disp;',
    ' float ca=length(disp)*' + ABERR.toFixed(3) + '+.0003;',
    ' vec3 c=vec3(texture2D(t,puv+vec2(ca,0.)).r,texture2D(t,puv).g,texture2D(t,puv-vec2(ca,0.)).b);',
    ' if(mi>0.){float m=fb(uv*2.2+vec2(ti*.03,-ti*.02));c+=vec3(.5,.66,.9)*m*.07*mi;}',
    ' if(rv<1.){float nz=fb(uv*5.5+2.);float vis=smoothstep(nz-.07,nz+.07,rv*1.3);c=mix(vec3(' + BG.join(',') + '),c,vis);}',
    ' gl_FragColor=vec4(c,1.);}'
  ].join('\n');

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* ---- Entrées partagées (une seule écoute souris / gyro pour toutes les instances) ---- */
  var shared = { mx: 0, my: 0, gx: 0, gy: 0, mouse: false, gyro: false, gyroOn: false };
  function bindMouse() {
    if (shared.mouse) return; shared.mouse = true;
    window.addEventListener('pointermove', function (e) {
      shared.mx = clamp((e.clientX / window.innerWidth - .5) * 2, -1, 1);
      shared.my = clamp(-(e.clientY / window.innerHeight - .5) * 2, -1, 1);
    }, { passive: true });
  }
  function bindGyro() {
    if (shared.gyro) return; shared.gyro = true;
    var DOE = window.DeviceOrientationEvent; if (!DOE) return;
    var base = null;
    function onOri(e) {
      if (e.beta == null || e.gamma == null) return;
      var land = Math.abs(window.orientation || (screen.orientation && screen.orientation.angle) || 0) === 90;
      var x = land ? e.beta : e.gamma, y = land ? -e.gamma : e.beta;
      if (!base) base = { x: x, y: y };
      base.x += (x - base.x) * .01; base.y += (y - base.y) * .01;   /* recalibrage lent : la position tenue devient le repos */
      shared.gx = clamp((x - base.x) / GYRO_DEG, -1, 1);
      shared.gy = clamp((y - base.y) / GYRO_DEG, -1, 1);
      shared.gyroOn = true;
    }
    function start() { window.addEventListener('deviceorientation', onOri, { passive: true }); }
    if (typeof DOE.requestPermission === 'function') {   /* iOS : permission sur un geste */
      var ask = function () {
        document.removeEventListener('click', ask); document.removeEventListener('touchend', ask);
        DOE.requestPermission().then(function (s) { if (s === 'granted') start(); }).catch(function () {});
      };
      document.addEventListener('click', ask); document.addEventListener('touchend', ask);
    } else start();
  }

  /* ---- Carte de profondeur de secours (en mémoire) : dégradé radial autour du sujet + vertical (sol proche en bas) ---- */
  function fallbackDepth(pos) {
    var W = 256, H = 171, c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'); if (!ctx) return null;
    var img = ctx.createImageData(W, H), px = img.data, cx = pos[0], cy = Math.min(1, pos[1] + .12);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var u = x / (W - 1), v = y / (H - 1), dx = (u - cx) * 1.5, dy = (v - cy) * 1.1;
      var rad = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.5);
      var val = .15 + .55 * rad * rad * (3 - 2 * rad) + .3 * v * v;
      var o = (y * W + x) * 4, g = Math.round(clamp(val, 0, 1) * 255);
      px[o] = g; px[o + 1] = g; px[o + 2] = g; px[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---- Boucle rAF partagée + résolution adaptative ---- */
  var instances = [], rafId = 0, lastFrame = 0, frames = 0, slow = 0, drew = false;
  var dprScale = 1;
  function loop(now) {
    rafId = 0;
    if (!instances.length) { lastFrame = 0; return; }
    rafId = requestAnimationFrame(loop);
    var dt = Math.min(100, lastFrame ? now - lastFrame : 16.7);
    if (lastFrame && drew) { frames++; if (dt > 40) slow++; if (frames >= 30) { if (slow > 10 && dprScale > 0.35) dprScale *= 0.7; frames = 0; slow = 0; } }
    lastFrame = now; drew = false;
    for (var i = 0; i < instances.length; i++) instances[i]._tick(now, dt);
  }
  function wake() { if (!rafId && instances.length) { lastFrame = 0; rafId = requestAnimationFrame(loop); } }

  function stub() { var f = function () {}; return { ok: false, el: null, canvas: null, setOffset: f, setAmount: f, pause: f, resume: f, destroy: f, reveal: f }; }

  var supported = (function () {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
  })();

  function attach(el, opts) {
    opts = opts || {};
    var info = (AJ.images && AJ.images[opts.key]) || null;
    var src = opts.src || (info && info.jpg1536);
    var depthSrc = opts.depth || (info && info.depth) || null;
    var pos = opts.pos || (info && info.pos) || [0.5, 0.5];
    if (!el || !src || reduce || !supported) return stub();

    var canvas = document.createElement('canvas');
    canvas.className = 'photo3d'; canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;transition:opacity .6s ease';
    var glOpts = { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, depth: false, stencil: false };
    var gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
    if (!gl) return stub();
    try { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; } catch (e) {}
    el.appendChild(canvas);

    var useMouse = opts.mouse != null ? !!opts.mouse : fine, useScroll = !!opts.scroll, useGyro = !!opts.gyro;
    var amount = opts.amount != null ? +opts.amount : 1, mist = opts.mist ? 1 : 0, dissolve = !!opts.dissolve;
    var ext = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, reveal = dissolve ? 0 : 1, revealTarget = dissolve ? 0 : 1;
    var prog = null, U = {}, tex = null, dtex = null, image = null, depthImg = null, texW = 1536, texH = 1024;
    var ready = false, paused = false, visible = true, dead = false, destroyed = false, drawn = false, t0 = performance.now();
    var inst;

    function compile(type, s) {
      var sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    function build() {
      try {
        prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      } catch (e) { return false; }
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['t', 'd', 'r', 'tr', 'ps', 'of', 'am', 'ti', 'rv', 'mi'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
      gl.uniform1i(U.t, 0); gl.uniform1i(U.d, 1);
      return true;
    }
    function uploadTex(unit, t, source, fmt) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    function upload() {
      if (!image || !depthImg) return false;
      try {
        tex = gl.createTexture(); dtex = gl.createTexture();
        uploadTex(0, tex, image, gl.RGB);
        uploadTex(1, dtex, depthImg, gl.LUMINANCE);
        texW = image.naturalWidth || image.width; texH = image.naturalHeight || image.height;
      } catch (e) { return false; }
      return true;
    }
    function show() {
      canvas.classList.add('on');
      if (dissolve) canvas.style.transition = 'none';
      canvas.style.opacity = '1';
    }
    function onLoaded() {
      if (ready || destroyed || !image || !depthImg) return;
      if (!build() || !upload()) { destroy(); return; }
      ready = true; drawn = false; show(); wake();
      if (dissolve) {
        var go = function () { revealTarget = 1; };
        if (AJ.ready && typeof AJ.ready.then === 'function') AJ.ready.then(go, go); else go();
        setTimeout(go, 6000);
      }
      if (typeof opts.onReady === 'function') { try { opts.onReady(inst); } catch (e) { console.error(e); } }
    }

    /* Chargement image + profondeur (la profondeur peut manquer : dégradé de secours) */
    image = new Image();
    image.onload = onLoaded;
    image.onerror = function () { destroy(); };
    image.src = src;
    var dimg = new Image();
    dimg.onload = function () { depthImg = dimg; onLoaded(); };
    dimg.onerror = function () { depthImg = fallbackDepth(pos); if (!depthImg) destroy(); else onLoaded(); };
    if (depthSrc) dimg.src = depthSrc; else dimg.onerror();

    /* Perte / restauration de contexte : repli image */
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); dead = true; canvas.classList.remove('on'); canvas.style.opacity = '0'; });
    canvas.addEventListener('webglcontextrestored', function () { if (build() && upload()) { dead = false; drawn = false; show(); wake(); } });

    /* Pause hors écran */
    var io = null;
    if ('IntersectionObserver' in window) {
      visible = false;
      io = new IntersectionObserver(function (es) { for (var i = 0; i < es.length; i++) visible = es[i].isIntersecting; if (visible) wake(); }, { rootMargin: '10%' });
      io.observe(el);
    }
    if (useMouse) bindMouse();
    if (useGyro) bindGyro();

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX) * dprScale;
      var W = Math.max(1, Math.round(canvas.clientWidth * dpr)), H = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); drawn = false; }
    }
    function tick(now, dt) {
      if (!ready || paused || !visible || dead || destroyed) return;
      var tx = ext.x, ty = ext.y;
      if (useMouse) { tx += shared.mx; ty += shared.my; }
      if (useGyro && shared.gyroOn) { tx += shared.gx; ty += shared.gy; }
      if (useScroll) {
        var rc = el.getBoundingClientRect(), hh = window.innerHeight / 2;
        ty += clamp(-(rc.top + rc.height / 2 - hh) / hh, -1, 1) * SCROLL_STRENGTH;
      }
      tx = clamp(tx, -1.5, 1.5); ty = clamp(ty, -1.5, 1.5);
      var k = 1 - Math.exp(-dt / MOUSE_MS);
      cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k;
      reveal += (revealTarget - reveal) * (1 - Math.exp(-dt / 550));
      var still = Math.abs(tx - cur.x) < 5e-4 && Math.abs(ty - cur.y) < 5e-4 && Math.abs(revealTarget - reveal) < 2e-3;
      resize();
      if (still && drawn && !mist) return;   /* rien ne bouge : on ne redessine pas */
      gl.uniform2f(U.r, canvas.width, canvas.height);
      gl.uniform2f(U.tr, texW, texH);
      gl.uniform2f(U.ps, pos[0], 1 - pos[1]);
      gl.uniform2f(U.of, cur.x, cur.y);
      gl.uniform1f(U.am, amount);
      gl.uniform1f(U.ti, (now - t0) / 1000);
      gl.uniform1f(U.rv, still ? 1 : reveal);
      gl.uniform1f(U.mi, mist);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      drawn = true; drew = true;
    }
    function destroy() {
      if (destroyed) return; destroyed = true;
      var i = instances.indexOf(inst); if (i >= 0) instances.splice(i, 1);
      if (io) io.disconnect();
      try { var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); } catch (e) {}
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }

    inst = {
      ok: true, el: el, canvas: canvas, key: opts.key || null,
      setOffset: function (dx, dy) { ext.x = clamp(+dx || 0, -1, 1); ext.y = clamp(+dy || 0, -1, 1); wake(); },
      setAmount: function (a) { amount = clamp(+a || 0, 0, 3); drawn = false; wake(); },
      pause: function () { paused = true; },
      resume: function () { paused = false; wake(); },
      reveal: function () { revealTarget = 1; wake(); },
      destroy: destroy,
      _tick: tick
    };
    instances.push(inst);
    wake();
    return inst;
  }

  window.addEventListener('resize', wake);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });

  AJ.Photo3D = { attach: attach, supported: supported && !reduce, instances: instances, input: shared };
})();
