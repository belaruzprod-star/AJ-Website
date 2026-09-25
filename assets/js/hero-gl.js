/* Hero en WebGL : distorsion liquide réactive à la souris, brume animée, apparition par dissolution.
   Sans WebGL, ou si l'utilisateur préfère réduire les animations, l'image <img> reste affichée telle quelle. */
(function () {
  var doc = document.documentElement;
  if (doc.classList.contains('reduce') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var hero = document.querySelector('.hero');
  var canvas = hero && hero.querySelector('canvas.hero-gl');
  var img = hero && hero.querySelector('picture img');
  if (!canvas || !img) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return;

  var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;varying vec2 v;',
    'uniform sampler2D t;uniform vec2 r,tr,m,ps;uniform float ti,en,rv;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*n(p);p=p*2.03+1.7;a*=.5;}return s;}',
    'void main(){',
    ' vec2 uv=v; float ra=r.x/r.y, ta=tr.x/tr.y; vec2 s=vec2(1.); if(ra>ta) s.y=ta/ra; else s.x=ra/ta;',
    ' vec2 asp=vec2(ra,1.); float d=distance(uv*asp,m*asp);',
    ' float rip=sin(d*30.-ti*3.)*exp(-d*4.5)*en;',
    ' vec2 fl=vec2(fb(uv*3.+ti*.05),fb(uv*3.+5.3-ti*.04))-.5;',
    ' float pre=(1.-rv)*(1.-rv);',
    ' vec2 disp=fl*(.008+en*.014+pre*.07)+normalize(uv-m+1e-4)*rip*.018;',
    ' vec2 cuv=(uv+disp)*s+ps*(1.-s);',
    ' float ca=.0008+en*.0025+abs(rip)*.006+pre*.012;',
    ' vec3 c=vec3(texture2D(t,cuv+vec2(ca,0.)).r,texture2D(t,cuv).g,texture2D(t,cuv-vec2(ca,0.)).b);',
    ' float mist=fb(uv*2.2+vec2(ti*.03,-ti*.02));',
    ' c+=vec3(.5,.66,.9)*mist*.07;',
    ' float nz=fb(uv*5.5+2.);',
    ' float vis=smoothstep(nz-.07,nz+.07,rv*1.3);',
    ' c=mix(vec3(.043,.059,.075),c,vis);',
    ' gl_FragColor=vec4(c,1.);}'
  ].join('\n');

  function compile(type, src) {
    var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['t', 'r', 'tr', 'm', 'ps', 'ti', 'en', 'rv'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  var tex = gl.createTexture(), ready = false, texW = 1536, texH = 1024;
  var image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texW = image.naturalWidth; texH = image.naturalHeight; ready = true;
    canvas.classList.add('on');
  };
  image.src = img.getAttribute('data-hero-src') || img.currentSrc || img.src;

  var pos = (img.getAttribute('data-pos') || '0.5 0.5').split(' ').map(parseFloat);
  var mouse = { x: .5, y: .5 }, target = { x: .5, y: .5 }, last = null, energy = 0, reveal = 0, revealTarget = 0;
  var t0 = performance.now(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    var W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
  }
  /* Résolution adaptative : si les images sont lentes (appareil modeste, rendu logiciel), on baisse la définition. */
  var frames = 0, slow = 0, lastFrame = 0;
  function adapt(now) {
    if (lastFrame) { var dt = now - lastFrame; frames++; if (dt > 40) slow++; if (frames >= 30) { if (slow > 10 && dpr > 0.4) { dpr *= 0.7; resize(); } frames = 0; slow = 0; } }
    lastFrame = now;
  }
  window.addEventListener('resize', resize);
  hero.addEventListener('pointermove', function (e) {
    var rc = canvas.getBoundingClientRect();
    var x = (e.clientX - rc.left) / rc.width, y = 1 - (e.clientY - rc.top) / rc.height;
    if (last) { var dx = x - last.x, dy = y - last.y; energy = Math.min(1, energy + Math.sqrt(dx * dx + dy * dy) * 7); }
    last = { x: x, y: y }; target.x = x; target.y = y;
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { last = null; });
  /* Appelé par motion.js quand le rideau s'ouvre ; sécurité si motion.js ne se charge pas. */
  window.AJ_heroReveal = function () { revealTarget = 1; };
  setTimeout(function () { revealTarget = 1; }, 4000);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!ready) return;
    var rc = hero.getBoundingClientRect();
    if (rc.bottom < 0 || rc.top > window.innerHeight) { lastFrame = 0; return; }
    var dt = Math.min(100, lastFrame ? now - lastFrame : 16.7);   /* en ms : les vitesses ne dépendent pas de la cadence */
    adapt(now);
    resize();
    var k = 1 - Math.exp(-dt / 200);
    mouse.x += (target.x - mouse.x) * k; mouse.y += (target.y - mouse.y) * k;
    energy *= Math.pow(0.95, dt / 16.7);
    reveal += (revealTarget - reveal) * (1 - Math.exp(-dt / 550));
    gl.uniform1i(U.t, 0);
    gl.uniform2f(U.r, canvas.width, canvas.height);
    gl.uniform2f(U.tr, texW, texH);
    gl.uniform2f(U.m, mouse.x, mouse.y);
    gl.uniform2f(U.ps, pos[0], 1 - pos[1]);
    gl.uniform1f(U.ti, (now - t0) / 1000);
    gl.uniform1f(U.en, energy);
    gl.uniform1f(U.rv, reveal);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  requestAnimationFrame(frame);
})();
