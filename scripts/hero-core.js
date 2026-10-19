// ヒーロー背景「光の核」：散らばった粒が集まって球になり、金の光の帯が表面を上下になぞり、2本の輪の上を光が回る
// 2026-10-19 田中さんが5案から「洗練」を選択。WebGL が無い・失敗した時は暖色のぼかしだけを敷く
(function () {
  var stage = document.querySelector('.hero .hero-architecture');
  if (!stage) return;
  stage.classList.add('sculpture-ready', 'hc-stage');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = document.createElement('canvas');
  cv.className = 'hc-canvas';
  cv.setAttribute('aria-hidden', 'true');
  stage.append(cv);
  var shade = document.createElement('div');
  shade.className = 'hc-shade';
  stage.append(shade);

  var gl = null;
  try { gl = cv.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' }); } catch (e) {}
  if (!gl) { stage.style.background = 'radial-gradient(40% 50% at 68% 48%, #3a2c20, #0c0c12 70%)'; return; }

  var INTRO = 8;
  var W = 0, H = 0, q = 1, t0 = 0, introAt = -1, running = true, raf = 0;
  var mx = 0, my = 0, tx = 0, ty = 0;
  // 核の位置（画面の座標：右寄り）と大きさ
  var CX = 0.36, CY = 0.02;

  // ───── 背景：暗い夜色に、核のまわりの光と、開く時に広がる光の輪 ─────
  var VS_BG = 'attribute vec2 a;varying vec2 vS;void main(){vS=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}';
  var FS_BG = [
    'precision highp float;uniform vec2 uRes,uG;uniform float uT,uP,uGs;varying vec2 vS;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'void main(){vec2 s=vS;float sa=uRes.x/uRes.y;',
    '  vec3 col=mix(vec3(.03,.035,.055),vec3(.08,.075,.085),s.y);',
    '  vec2 c=(s-uG)*vec2(sa,1.);float r=length(c);',
    '  col+=vec3(1.,.76,.48)*exp(-r*3.6)*.13*uGs;',
    '  col+=vec3(.55,.7,1.)*exp(-r*1.4)*.035*uGs;',
    '  col+=vec3(1.,.85,.62)*exp(-pow((r-uP*2.2)/.03,2.))*(1.-uP)*.3;',
    '  gl_FragColor=vec4(col+(h21(s*uRes+fract(uT*7.)*91.)-.5)*.02,1.);}'
  ].join('\n');

  // ───── 粒：共通の部品（回転・奥行き・画面への置き方） ─────
  var HEAD = [
    'precision highp float;attribute vec4 aP;attribute vec2 aQ;',
    'uniform float uT,uP,uAs,uPx,uSc;uniform vec2 uM,uC;varying vec3 vC;',
    'const vec3 GOLD=vec3(1.,.8,.54),COOL=vec3(.5,.62,.95),WHITE=vec3(1.,.95,.88);',
    'vec3 rY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x*c-p.z*s,p.y,p.x*s+p.z*c);}',
    'vec3 rX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}',
    'vec3 view(vec3 p,float spin){return rX(rY(p,spin+uM.x*.35),.3+uM.y*.15);}',
    'float ease(float k){k=clamp(k,0.,1.);return k*k*(3.-2.*k);}',
    'float front(vec3 p){return 1.-smoothstep(-1.,1.,p.z);}',
    'void put(vec3 p,float sz,vec3 col){float per=3./(3.+p.z);',
    '  gl_Position=vec4(uC.x+p.x*per*uSc/uAs,uC.y+p.y*per*uSc,0.,1.);',
    '  gl_PointSize=max(1.,uPx*sz*per);vC=col;}',
    ''
  ].join('\n');

  // 種類 0＝球の表面・1＝球の中のかすみ・2＝2本の輪（先頭だけ明るい）
  var VS = HEAD + [
    'void main(){float ty=aQ.x,r=aQ.y;vec3 p=aP.xyz;vec3 col;float sz;float band=0.,head=0.;',
    '  if(ty<.5){p*=1.+.02*sin(uT*.6)+.015*sin(dot(p,vec3(5.,3.,4.))+uT*.9);',
    '    band=exp(-pow((aP.y-sin(uT*.35)*.95)*9.,2.));}',
    '  else if(ty<1.5){p*=.92+.04*sin(uT*.5+r*20.);}',
    '  else{float a=aP.y+uT*aP.w;p=rX(vec3(cos(a),0.,sin(a))*aP.x,aP.z);head=pow(fract(aP.y/6.2832*2.),10.);}',
    '  vec3 from=normalize(vec3(sin(r*91.),cos(r*53.),sin(r*27.)+.01))*(2.5+r*2.);',
    '  float k=ease(uP*1.6-r*.6);p=mix(from,p,k);',
    '  p=view(p,uT*.07);float fr=front(p);',
    '  if(ty<.5){col=mix(COOL*.4,WHITE*.8,fr*.7)*(.25+.75*fr)*(.8+.2*sin(uT*2.+r*40.))*(1.-.6*band)+GOLD*band*2.6*(.4+.6*fr);sz=1.5+1.3*fr+1.4*band;}',
    '  else if(ty<1.5){col=GOLD*.16*(.5+.5*fr);sz=2.4;}',
    '  else{col=mix(GOLD*.22,WHITE*1.3,head)*(.4+.6*fr);sz=1.3+2.2*head;}',
    '  put(p,sz,col*(.3+.7*k));}'
  ].join('\n');
  var FS_PT = 'precision mediump float;varying vec3 vC;void main(){vec2 d=gl_PointCoord-.5;float r=dot(d,d)*4.;gl_FragColor=vec4(vC*exp(-r*3.)*(1.-r)*1.4*step(r,1.),1.);}';

  // ───── 粒の並べ方：(x, y, z, w, 種類, 乱数) を1粒ずつ ─────
  var D = [];
  function push(a, b, c, d, type) { D.push(a, b, c, d, type, Math.random()); }
  function sphere(n, type) {
    for (var i = 0; i < n; i++) {
      var y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996323;
      push(Math.cos(th) * r, y, Math.sin(th) * r, 0, type);
    }
  }
  function dir() {
    var u = Math.random() * 2 - 1, a = Math.random() * 6.2832, s = Math.sqrt(1 - u * u);
    return [Math.cos(a) * s, u, Math.sin(a) * s];
  }
  var i, d;
  sphere(9000, 0);
  for (i = 0; i < 2500; i++) { d = dir(); var rb = 0.85 * Math.cbrt(Math.random()); push(d[0] * rb, d[1] * rb, d[2] * rb, 0, 1); }
  for (i = 0; i < 1600; i++) push(1.45 + (Math.random() - 0.5) * 0.04, i / 1600 * 6.2832, 0.42, 0.09, 2);
  for (i = 0; i < 1600; i++) push(1.8 + (Math.random() - 0.5) * 0.05, i / 1600 * 6.2832, -0.6, -0.06, 2);
  var N = D.length / 6;

  // ───── WebGL の準備 ─────
  function sh(type, src) {
    var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn('[hero-core]', gl.getShaderInfoLog(o)); return null; }
    return o;
  }
  function prog(vs, fs, names) {
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('[hero-core]', gl.getProgramInfoLog(p)); return null; }
    var u = {}; names.forEach(function (k) { u[k] = gl.getUniformLocation(p, k); });
    return { p: p, u: u };
  }
  var bg = prog(VS_BG, FS_BG, ['uRes', 'uG', 'uT', 'uP', 'uGs']);
  var pts = prog(VS, FS_PT, ['uT', 'uP', 'uAs', 'uPx', 'uSc', 'uM', 'uC']);
  if (!bg || !pts) { stage.style.background = 'radial-gradient(40% 50% at 68% 48%, #3a2c20, #0c0c12 70%)'; return; }
  var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(D), gl.STATIC_DRAW);
  D = null;
  var lA = gl.getAttribLocation(bg.p, 'a'), lP = gl.getAttribLocation(pts.p, 'aP'), lQ = gl.getAttribLocation(pts.p, 'aQ');

  function draw(t, p) {
    var sc = W / H < 1 ? 0.34 : 0.46;
    gl.disable(gl.BLEND);
    gl.useProgram(bg.p);
    gl.uniform2f(bg.u.uRes, W, H); gl.uniform2f(bg.u.uG, 0.5 + CX * 0.5, 0.5 - CY * 0.5);
    gl.uniform1f(bg.u.uT, t); gl.uniform1f(bg.u.uP, p);
    gl.uniform1f(bg.u.uGs, p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(lA); gl.vertexAttribPointer(lA, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(lA);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pts.p);
    gl.uniform1f(pts.u.uT, t); gl.uniform1f(pts.u.uP, p); gl.uniform1f(pts.u.uAs, W / H);
    gl.uniform1f(pts.u.uPx, q); gl.uniform1f(pts.u.uSc, sc); gl.uniform2f(pts.u.uM, mx, my);
    gl.uniform2f(pts.u.uC, CX, CY);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(lP); gl.vertexAttribPointer(lP, 4, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(lQ); gl.vertexAttribPointer(lQ, 2, gl.FLOAT, false, 24, 16);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(lP); gl.disableVertexAttribArray(lQ);
  }

  function resize() {
    var r = stage.getBoundingClientRect();
    q = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width * q)); H = Math.max(1, Math.round(r.height * q));
    cv.width = W; cv.height = H; gl.viewport(0, 0, W, H);
    if (still) frame(0);
  }
  window.addEventListener('resize', resize);
  if (!still && matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // 冒頭のロゴの演出が終わってから始める（最長8秒）
  function waitOpening() {
    var go = function () { if (introAt < 0) introAt = (performance.now() - t0) / 1000 + 0.2; };
    if (document.body.classList.contains('brand-opening-complete') || !document.querySelector('.hero-opening-skip')) { go(); return; }
    new MutationObserver(function (_, ob) {
      if (document.body.classList.contains('brand-opening-complete')) { ob.disconnect(); go(); }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(go, 8000);
  }

  function frame(now) {
    if (!t0) t0 = now || performance.now();
    var t = still ? 30 : ((now || performance.now()) - t0) / 1000;
    var x = still ? 1 : introAt < 0 ? 0 : Math.min(1, Math.max(0, (t - introAt) / INTRO));
    var p = 0.5 - 0.5 * Math.cos(Math.PI * x);
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    draw(t, p);
    if (!still && running) raf = requestAnimationFrame(frame);
  }

  resize(); cv.classList.add('is-on');
  if (still) frame(0);
  else { waitOpening(); raf = requestAnimationFrame(frame); }

  function setRun(on) {
    if (still || on === running) return;
    running = on;
    if (on) raf = requestAnimationFrame(frame); else cancelAnimationFrame(raf);
  }
  var inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; setRun(inView && !document.hidden); }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { setRun(inView && !document.hidden); });
})();
