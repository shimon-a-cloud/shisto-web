/* Opening film "code becomes form" (23rd revision). The page first types out the
   very source that is drawing it, a scanning beam turns every glyph pixel into a
   GPU particle, the particles spiral into SHISTO, melt into liquid glass, fall
   into one drop and open onto the hero. Positions are a pure function of time
   (plus the live pointer), so no video, image or library is involved. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  const skip = hero?.querySelector('.hero-opening-skip');
  if (!hero || !skip) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const navigation = performance.getEntriesByType?.('navigation')[0];
  const bypass = () => reduced.matches || Boolean(location.hash) || scrollY > 2 || navigation?.type === 'back_forward';
  if (bypass()) return;
  /* Tells hero-decode.js to hold the hero copy until the film hands over. */
  document.body.classList.add('brand-opening-pending');

  /* Timeline in seconds. Particles, beam and HUD all read this table. */
  const END = 8.0;
  const T = {
    type: [.12, 1.22],        // source code is typed
    launch: 1.30, wave: .78,  // beam sweeps left to right; each glyph leaves as it passes
    arrive: 4.05, spread: .30,// particles land on SHISTO
    shock: 4.30,              // landing shockwave
    liquid: [4.85, 5.55],     // particles melt into glass
    origin: [4.55, 5.45],     // "Shimon × Assist" decodes under the word
    collapse: [6.20, 6.90],   // letters fall into one drop
    reveal: [7.00, 7.95],     // the drop opens onto the hero
  };
  const PHASES = [[0, '01 / SOURCE'], [T.launch, '02 / PARTICLES'], [T.arrive - .3, '03 / FORM'], [T.liquid[0], '04 / LIQUID'], [T.collapse[0], '05 / OPEN']];

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const span = (t, [a, b]) => clamp01((t - a) / (b - a));
  const easeOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
  const smooth = x => x * x * (3 - 2 * x);
  const random = (seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let v = Math.imul(seed ^ seed >>> 15, 1 | seed); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296; })(20260925);

  const VERT = `attribute vec2 aStart;
attribute vec2 aTarget;
attribute vec4 aSeed;
attribute vec3 aTint;
uniform vec2 uView;
uniform vec2 uCenter;
uniform vec2 uMouse;
uniform float uTime;
uniform float uScale;
uniform float uLiquid;
uniform float uMouseAmt;
uniform float uBlob;
varying vec3 vColor;
varying float vAlpha;
varying float vLiquid;
const float PI = 3.14159265;
float easeIO(float x) {
  return x < .5 ? 4. * x * x * x : 1. - pow(-2. * x + 2., 3.) / 2.;
}
vec3 spectrum(float h) {
  return .5 + .5 * cos(6.28318 * (h + vec3(0., .33, .67)));
}
vec2 rotate(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
void main() {
  float launch = ${T.launch.toFixed(3)} + ${T.wave.toFixed(3)} * aStart.x / uView.x - .06 * aSeed.x;
  float arrive = ${T.arrive.toFixed(3)} + ${T.spread.toFixed(3)} * aSeed.y;
  float u = clamp((uTime - launch) / (arrive - launch), 0., 1.);
  float e = easeIO(u);
  float lift = sin(PI * e);
  // a vortex that winds up mid-flight and unwinds exactly on arrival
  float spin = pow(1. - e, 1.6) * (1.5 + 2.3 * aSeed.w) * (aSeed.z < .5 ? -1. : 1.);
  vec2 rel = rotate(mix(aStart, aTarget, e) - uCenter, spin * lift);
  rel *= 1. + .30 * lift * (aSeed.x - .3);
  rel += lift * vec2(sin(aSeed.y * 40. + uTime * 1.7), cos(aSeed.x * 37. + uTime * 1.3)) * 42. * (.35 + aSeed.w);
  vec2 p = uCenter + rel;
  // landing: squash past the mark, spring back, then breathe
  float since = uTime - arrive;
  if (since > 0.) {
    p += (aTarget - uCenter) * .06 * exp(-4.5 * since) * sin(11. * since);
    p += vec2(sin(uTime * 2.1 + aSeed.x * 30.), cos(uTime * 1.9 + aSeed.y * 30.)) * 1.2;
  }
  // one shockwave ring when the word lands
  float shock = uTime - ${T.shock.toFixed(3)};
  if (shock > 0.) {
    vec2 r = p - uCenter;
    float d = length(r) + .001;
    p += r / d * 24. * exp(-pow((d - shock * 1500.) / 70., 2.)) * exp(-shock * 1.6);
  }
  // the visitor's pointer parts the particles; they heal when it leaves
  vec2 m = p - uMouse;
  float md = length(m) + .001;
  p += m / md * uMouseAmt * 72. * exp(-md * md / 14400.);
  // everything falls into one drop
  float c = clamp((uTime - ${T.collapse[0].toFixed(3)}) / ${(T.collapse[1] - T.collapse[0]).toFixed(3)}, 0., 1.);
  p = mix(p, uCenter + vec2(cos(aSeed.x * 6.28318), sin(aSeed.x * 6.28318)) * sqrt(aSeed.y) * 17., c * c * c);
  vec2 ndc = p / uView * 2. - 1.;
  gl_Position = vec4(ndc.x, -ndc.y, 0., 1.);
  gl_PointSize = mix(mix(1.8, 2.8, lift), mix(11., 16., aSeed.w) * uBlob, uLiquid) * uScale;
  vec3 glow = spectrum(aSeed.x * .35 + p.x / uView.x * .6 + uTime * .06) * 1.25 + .06;
  vColor = mix(aTint, glow, smoothstep(0., .22, u));
  vAlpha = step(launch, uTime);
  vLiquid = uLiquid;
}`;

  const SPLAT = `precision mediump float;
varying vec3 vColor;
varying float vAlpha;
varying float vLiquid;
void main() {
  vec2 q = gl_PointCoord * 2. - 1.;
  float r2 = dot(q, q);
  if (r2 > 1. || vAlpha < .5) discard;
  float g = exp(-r2 * 3.2) * mix(.62, .05, vLiquid);
  gl_FragColor = vec4(vColor * g, g);
}`;

  const QUAD = 'attribute vec2 aPosition;\nvoid main() {\n  gl_Position = vec4(aPosition, 0., 1.);\n}';

  const COMPOSITE = `precision highp float;
uniform sampler2D uField;
uniform vec2 uRes;
uniform vec2 uCenterPx;
uniform float uTime;
uniform float uScale;
uniform float uLiquid;
uniform float uReveal;
uniform float uRing;
vec3 spectrum(float h) {
  return .5 + .5 * cos(6.28318 * (h + vec3(0., .33, .67)));
}
vec4 tap(vec2 offset) {
  return texture2D(uField, (gl_FragCoord.xy + offset * uScale) / uRes);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 f = tap(vec2(0.));
  vec4 bloom = vec4(0.);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * .7854 + .39;
    vec2 d = vec2(cos(a), sin(a));
    bloom += tap(d * 3.) + tap(d * 10.) * .7;
  }
  bloom /= 13.6;
  vec2 q = uv * 2. - 1.;
  vec3 bg = vec3(.014, .015, .026) * (1.15 - .45 * dot(q, q));
  vec3 dust = bg + f.rgb * 1.3 + bloom.rgb * 1.25;
  // liquid glass: the particle density is a height field, smoothed before shading
  float h0 = 0.;
  vec2 grad = vec2(0.);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * .7854;
    vec2 d = vec2(cos(a), sin(a));
    float v = tap(d * 4.).a;
    h0 += v;
    grad += d * v;
  }
  h0 = (h0 / 8. + f.a) * .5;
  float th = .30;
  float mask = smoothstep(th - .05, th + .05, h0);
  vec3 n = normalize(vec3(-grad * 1.6, .18 + 1.2 * smoothstep(th, .75, h0)));
  float fres = pow(1. - n.z, 1.3);
  vec3 body = spectrum(uv.x * .75 - uv.y * .2 + dot(n.xy, vec2(.35, .2)) + uTime * .08);
  vec3 h = normalize(normalize(vec3(-.42, .58, .7)) + vec3(0., 0., 1.));
  float spec = pow(max(dot(n, h), 0.), 48.);
  float sweep = exp(-pow((uv.x - uv.y * .35) - (fract(uTime * .3) * 1.9 - .5), 2.) / .002);
  vec3 refr = tap(n.xy * 26.).rgb;
  vec3 glass = body * (.16 + fres) + refr * .18 + vec3(1.) * (spec * 1.6 + sweep * .45 + fres * fres * .5);
  vec3 liquid = mix(bg + bloom.rgb * .45, glass, mask);
  vec3 col = mix(dust, liquid, uLiquid);
  // the drop opens as an iridescent ring
  float d = length(gl_FragCoord.xy - uCenterPx);
  float alpha = smoothstep(uReveal - 1.5 * uScale, uReveal + 1.5 * uScale, d);
  float ring = exp(-pow((d - uReveal) / (16. * uScale), 2.)) * uRing;
  vec3 ringCol = spectrum(atan(gl_FragCoord.y - uCenterPx.y, gl_FragCoord.x - uCenterPx.x) / 6.28318 + uTime * .2) * 1.3 + .25;
  col = col * alpha + ringCol * ring;
  alpha = max(alpha, ring);
  col = 1. - exp(-col * 1.1);
  gl_FragColor = vec4(col, alpha);
}`;

  const layoutCode = (width, height) => {
    const narrow = width < 769;
    const size = narrow ? 9.5 : 12.5, lineH = Math.round(size * 1.48), margin = narrow ? 18 : 44;
    const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1, gap = narrow ? 0 : 36;
    const top = narrow ? 144 : 150, bottom = narrow ? 48 : 56;
    const colW = (width - margin * 2 - gap * (columns - 1)) / columns;
    const source = `// shisto — opening film, drawn live in your browser\n${VERT}\n\n${SPLAT}\n\n${COMPOSITE}\n\n${layoutCode.toString()}`.split('\n').filter(line => line.trim());
    const rows = Math.max(4, Math.floor((height - top - bottom) / lineH));
    const lines = [];
    let cursor = 0;
    for (let c = 0; c < columns; c += 1) for (let r = 0; r < rows; r += 1) { lines.push({ text: source[cursor % source.length], x: margin + c * (colW + gap), y: top + r * lineH, col: c }); cursor += 1; }
    return { size, lineH, colW, columns, rows, lines };
  };

  const TOKENS = /(\/\/.*$)|\b(float|vec2|vec3|vec4|uniform|attribute|varying|void|const|return|if|for|int|precision|highp|mediump|sampler2D|let|function|new)\b|(\b\d+\.?\d*|\.\d+)/g;
  const COLORS = { plain: 'rgba(184,194,214,.82)', keyword: 'rgba(122,214,255,.95)', number: 'rgba(255,178,110,.95)', comment: 'rgba(120,130,152,.8)' };

  /* Draws the full code sheet once; typing and the beam only reveal slices of it. */
  const paintCode = (layout, width, height, ratio) => {
    const sheet = document.createElement('canvas');
    sheet.width = Math.round(width * ratio); sheet.height = Math.round(height * ratio);
    const ctx = sheet.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.font = `400 ${layout.size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';
    const charW = ctx.measureText('M').width;
    const maxChars = Math.floor(layout.colW / charW);
    layout.charW = charW; layout.maxChars = maxChars;
    layout.lines.forEach(line => {
      const text = line.text.slice(0, maxChars);
      line.shown = text.length;
      let last = 0;
      const put = (chunk, colour) => { if (!chunk) return; ctx.fillStyle = colour; ctx.fillText(chunk, line.x + last * charW, line.y); last += chunk.length; };
      text.replace(TOKENS, (match, comment, keyword, number, offset) => {
        put(text.slice(last, offset), COLORS.plain);
        put(match, comment ? COLORS.comment : keyword ? COLORS.keyword : COLORS.number);
        return match;
      });
      put(text.slice(last), COLORS.plain);
    });
    return sheet;
  };

  const sample = (source, width, height, ratio, threshold, count, withColour) => {
    const data = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
    const hits = [];
    for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) if (data[(y * source.width + x) * 4 + 3] > threshold) hits.push(y * source.width + x);
    if (!hits.length) return null;
    const points = [];
    for (let i = 0; i < count; i += 1) {
      const index = hits[Math.floor(random() * hits.length)], px = index % source.width, py = Math.floor(index / source.width);
      const point = { x: (px + random()) / ratio, y: (py + random()) / ratio };
      if (withColour) { const o = index * 4, a = Math.max(data[o + 3], 1) / 255; point.r = data[o] / 255 / a; point.g = data[o + 1] / 255 / a; point.b = data[o + 2] / 255 / a; }
      points.push(point);
    }
    return points;
  };

  const paintWord = (width, height, centerY) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
    const ctx = canvas.getContext('2d');
    const letters = [...'SHISTO'];
    let size = 200;
    ctx.font = `400 ${size}px "Cormorant Garamond", Georgia, serif`;
    const measure = () => letters.reduce((sum, letter) => sum + ctx.measureText(letter).width, 0) + size * .16 * (letters.length - 1);
    size *= Math.min(width * (width < 769 ? .86 : .70), height * 1.45) / measure();
    ctx.font = `400 ${size}px "Cormorant Garamond", Georgia, serif`;
    const tracking = size * .16, total = measure();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    let x = (width - total) / 2;
    letters.forEach(letter => { ctx.fillText(letter, x, centerY); x += ctx.measureText(letter).width + tracking; });
    return { canvas, size };
  };

  let started = false;
  const start = () => {
    if (started || bypass()) return;
    started = true;
    const W = innerWidth, H = innerHeight, narrow = W < 769;
    const canvas = document.createElement('canvas');
    canvas.className = 'brand-opening-canvas'; canvas.setAttribute('aria-hidden', 'true');
    let gl;
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' }); } catch (_) { return; }
    if (!gl) return;

    /* Geometry: code glyph pixels are the start points, SHISTO pixels the targets. */
    const center = { x: W / 2, y: H * (narrow ? .44 : .46) };
    const layout = layoutCode(W, H);
    const sheet = paintCode(layout, W, H, 1);
    const word = paintWord(W, H, center.y);
    const count = narrow ? 9000 : W * H > 1.6e6 ? 26000 : 20000;
    const starts = sample(sheet, W, H, 1, 90, count, true), targets = sample(word.canvas, W, H, 1, 128, count, false);
    if (!starts || !targets) return;
    const order = list => list.map((point, index) => ({ index, key: point.x + random() * W * .18 })).sort((a, b) => a.key - b.key).map(entry => list[entry.index]);
    const from = order(starts), to = order(targets);
    const attributes = new Float32Array(count * 11);
    for (let i = 0; i < count; i += 1) {
      const o = i * 11;
      attributes.set([from[i].x, from[i].y, to[i].x, to[i].y, random(), random(), random(), random(), from[i].r, from[i].g, from[i].b], o);
    }

    const ratio = Math.min(devicePixelRatio || 1, 2);
    const glScale = Math.min(devicePixelRatio || 1, 1.5, (narrow ? 1000 : 1700) / Math.max(W, H, 1));
    canvas.width = Math.max(1, Math.round(W * glScale)); canvas.height = Math.max(1, Math.round(H * glScale));

    const shaders = []; let splat, composite, particleBuffer, quadBuffer, fieldTexture, framebuffer;
    const release = () => { shaders.forEach(shader => gl.deleteShader(shader)); [splat, composite].forEach(program => program && gl.deleteProgram(program)); [particleBuffer, quadBuffer].forEach(buffer => buffer && gl.deleteBuffer(buffer)); if (fieldTexture) gl.deleteTexture(fieldTexture); if (framebuffer) gl.deleteFramebuffer(framebuffer); };
    try {
      const compile = (type, source) => { const shader = gl.createShader(type); shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'opening shader unavailable'); return shader; };
      const link = (vs, fs) => { const program = gl.createProgram(); gl.attachShader(program, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('opening program unavailable'); return program; };
      splat = link(VERT, SPLAT); composite = link(QUAD, COMPOSITE);
      particleBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer); gl.bufferData(gl.ARRAY_BUFFER, attributes, gl.STATIC_DRAW);
      quadBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      fieldTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTexture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('opening framebuffer unavailable');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      shaders.forEach(shader => gl.deleteShader(shader)); shaders.length = 0;
    } catch (_) { release(); return; }

    const loc = (program, names) => Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    const su = loc(splat, ['uView', 'uCenter', 'uMouse', 'uTime', 'uScale', 'uLiquid', 'uMouseAmt', 'uBlob']);
    const cu = loc(composite, ['uField', 'uRes', 'uCenterPx', 'uTime', 'uScale', 'uLiquid', 'uReveal', 'uRing']);
    const sa = ['aStart', 'aTarget', 'aSeed', 'aTint'].map(name => gl.getAttribLocation(splat, name));
    const quadPosition = gl.getAttribLocation(composite, 'aPosition');
    /* liquid droplets are sized for a ~200px word; smaller words get thinner glass */
    const blob = Math.max(.5, Math.min(1.1, word.size / 200));
    /* "Shimon × Assist": the origin of the name, decoded like the code it came from */
    const origin = (() => {
      const text = 'Shimon × Assist', size = Math.max(13, Math.min(34, word.size * .17)), gap = size * .34;
      const measure = document.createElement('canvas').getContext('2d');
      measure.font = `400 ${size}px "Cormorant Garamond", Georgia, serif`;
      const widths = [...text].map(ch => measure.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
      let x = (W - total) / 2;
      const chars = [...text].map((ch, i) => { const item = { ch, x: x + widths[i] / 2 }; x += widths[i] + gap; return item; });
      return { chars, size, total, y: center.y + word.size * .56 };
    })();
    const GLYPHS = '{}[]<>/=+*;:01#$%&?';
    const drawOrigin = t => {
      const p = span(t, T.origin), out = 1 - smooth(span(t, [T.collapse[0], T.collapse[0] + .3]));
      if (!p || !out) return;
      const n = origin.chars.length, y = origin.y + (1 - out) * -origin.size;
      ux.save();
      ux.globalAlpha = out;
      ux.font = `400 ${origin.size}px "Cormorant Garamond", Georgia, serif`;
      ux.textAlign = 'center'; ux.textBaseline = 'middle';
      origin.chars.forEach((item, i) => {
        if (item.ch === ' ') return;
        const local = clamp01((p - i / n * .55) / .45);
        if (!local) return;
        const settled = local >= 1, cross = item.ch === '×';
        const glyph = settled ? item.ch : GLYPHS[(i * 7 + Math.floor(t * 28)) % GLYPHS.length];
        if (settled && cross) {
          const g = ux.createLinearGradient(item.x - origin.size * .4, 0, item.x + origin.size * .4, 0);
          g.addColorStop(0, '#7ad6ff'); g.addColorStop(.5, '#ff6ad5'); g.addColorStop(1, '#ffb26e');
          ux.fillStyle = g;
        } else ux.fillStyle = settled ? 'rgba(255,255,255,.92)' : `rgba(122,214,255,${(.35 + .5 * local).toFixed(3)})`;
        if (settled) { ux.shadowColor = 'rgba(160,226,255,.55)'; ux.shadowBlur = 14 * (1 - smooth(clamp01((p - i / n * .55 - .45) / .25))); }
        ux.fillText(glyph, item.x, y);
        ux.shadowBlur = 0;
      });
      /* hairlines grow outward from the text edges */
      const line = easeOutExpo(span(t, [T.origin[0] + .25, T.origin[1] + .35])), reach = Math.min(W * .16, 180) * line, edge = origin.total / 2 + origin.size * .9;
      if (reach > 1) [-1, 1].forEach(dir => {
        const x0 = W / 2 + dir * edge, x1 = x0 + dir * reach, g = ux.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(122,214,255,0)');
        ux.fillStyle = g; ux.fillRect(Math.min(x0, x1), y - .5, Math.abs(reach), 1);
      });
      ux.restore();
    };
    const maxReveal = Math.hypot(Math.max(center.x, W - center.x), Math.max(center.y, H - center.y)) + 40;

    /* Overlay: WebGL film, a 2D layer for the code sheet and HUD. */
    const ui = document.createElement('canvas');
    ui.className = 'brand-opening-ui'; ui.setAttribute('aria-hidden', 'true');
    ui.width = Math.round(W * ratio); ui.height = Math.round(H * ratio);
    const ux = ui.getContext('2d');
    const codeSheet = paintCode(layout, W, H, ratio);

    let overlay, frame = 0, last = 0, elapsed = 0, active = true, finishing = false, finishTimer = 0, revealing = false;
    let mouse = { x: -9999, y: -9999 }, mouseAmt = 0, fpsFrames = 0, fpsTime = 0, fps = 0;

    const drawGL = t => {
      const liquid = smooth(span(t, T.liquid));
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(splat);
      gl.uniform2f(su.uView, W, H); gl.uniform2f(su.uCenter, center.x, center.y); gl.uniform2f(su.uMouse, mouse.x, mouse.y);
      gl.uniform1f(su.uTime, t); gl.uniform1f(su.uScale, glScale); gl.uniform1f(su.uLiquid, liquid); gl.uniform1f(su.uBlob, blob); gl.uniform1f(su.uMouseAmt, mouseAmt * (t > T.launch ? 1 : 0));
      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 3, 8]].forEach(([i, size, offset]) => { gl.enableVertexAttribArray(sa[i]); gl.vertexAttribPointer(sa[i], size, gl.FLOAT, false, 44, offset * 4); });
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);
      sa.forEach(index => gl.disableVertexAttribArray(index));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(composite);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fieldTexture);
      const reveal = easeOutExpo(span(t, T.reveal));
      gl.uniform1i(cu.uField, 0); gl.uniform2f(cu.uRes, canvas.width, canvas.height); gl.uniform2f(cu.uCenterPx, center.x * glScale, (H - center.y) * glScale);
      gl.uniform1f(cu.uTime, t); gl.uniform1f(cu.uScale, glScale); gl.uniform1f(cu.uLiquid, liquid);
      gl.uniform1f(cu.uReveal, t < T.reveal[0] ? -100 : reveal * maxReveal * glScale); gl.uniform1f(cu.uRing, t < T.reveal[0] ? 0 : 1 - reveal * reveal);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer); gl.enableVertexAttribArray(quadPosition); gl.vertexAttribPointer(quadPosition, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(quadPosition);
    };

    const drawUI = t => {
      ux.setTransform(ratio, 0, 0, ratio, 0, 0);
      ux.clearRect(0, 0, W, H);
      /* typing: every column is typed at once, line by line, with a block cursor */
      const typed = span(t, T.type), beam = T.launch <= t ? (t - T.launch) / T.wave * W : -1;
      if (t < T.launch + T.wave + .1) {
        const perColumn = layout.rows, lineProgress = typed * perColumn;
        ux.save();
        if (beam >= 0) { ux.beginPath(); ux.rect(beam, 0, W - beam, H); ux.clip(); }
        layout.lines.forEach((line, index) => {
          const row = index % perColumn, visible = Math.max(0, Math.min(1, lineProgress - row));
          if (!visible || !line.shown) return;
          const chars = Math.ceil(line.shown * visible);
          ux.drawImage(codeSheet, line.x * ratio, line.y * ratio, chars * layout.charW * ratio, layout.lineH * ratio, line.x, line.y, chars * layout.charW, layout.lineH);
          if (visible < 1 && row === Math.floor(lineProgress)) { ux.fillStyle = 'rgba(122,214,255,.9)'; ux.fillRect(line.x + chars * layout.charW + 1, line.y, layout.charW * .9, layout.size * 1.15); }
        });
        ux.restore();
        if (beam >= 0 && beam <= W + 40) {
          const glow = ux.createLinearGradient(beam - 90, 0, beam + 6, 0);
          glow.addColorStop(0, 'rgba(122,214,255,0)'); glow.addColorStop(.85, 'rgba(160,226,255,.18)'); glow.addColorStop(1, 'rgba(255,255,255,.9)');
          ux.fillStyle = glow; ux.fillRect(beam - 90, 0, 96, H);
        }
      }
      drawOrigin(t);
      /* HUD: live numbers, not decoration — they prove the film is being computed */
      const hud = 1 - smooth(span(t, T.reveal));
      if (hud > 0) {
        const inset = narrow ? 12 : 18, arm = narrow ? 12 : 18;
        ux.globalAlpha = hud * .72; ux.strokeStyle = 'rgba(255,255,255,.55)'; ux.lineWidth = 1;
        [[inset, inset, 1, 1], [W - inset, inset, -1, 1], [inset, H - inset, 1, -1], [W - inset, H - inset, -1, -1]].forEach(([x, y, sx, sy]) => { ux.beginPath(); ux.moveTo(x, y + arm * sy); ux.lineTo(x, y); ux.lineTo(x + arm * sx, y); ux.stroke(); });
        ux.font = `500 ${narrow ? 8.5 : 10}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`; ux.fillStyle = 'rgba(255,255,255,.7)'; ux.textBaseline = 'middle';
        const phase = PHASES.filter(([at]) => t >= at).pop()[1];
        const frames = Math.floor(t * 60), tc = `TC 00:00:${String(Math.floor(t)).padStart(2, '0')}:${String(frames % 60).padStart(2, '0')}`;
        const pad = inset + (narrow ? 8 : 12), rowTop = inset + (narrow ? 9 : 11), rowBottom = H - inset - (narrow ? 9 : 11);
        ux.textAlign = 'left'; ux.fillText(narrow ? phase : `SHISTO  //  ${phase}`, pad, rowTop); ux.fillText(tc, pad, rowBottom);
        ux.textAlign = 'right'; ux.fillText(`PARTICLES ${count.toLocaleString('en-US')}`, W - pad, rowTop); ux.fillText(fps ? `${fps} FPS · LIVE` : 'LIVE', W - pad, rowBottom);
        ux.fillStyle = 'rgba(255,255,255,.14)'; ux.fillRect(W * .3, rowBottom, W * .4, 1); ux.fillStyle = 'rgba(255,255,255,.7)'; ux.fillRect(W * .3, rowBottom, W * .4 * Math.min(1, t / END), 1);
        ux.globalAlpha = 1; ux.textAlign = 'left';
      }
    };

    const draw = t => { drawGL(t); drawUI(t); };

    const destroy = () => {
      active = false; if (frame) cancelAnimationFrame(frame); frame = 0;
      release(); overlay?.remove(); canvas.remove();
      if (skip.parentElement !== hero) hero.append(skip);
      skip.hidden = true; document.body.classList.remove('brand-opening-active', 'brand-opening-leaving', 'brand-opening-revealing', 'brand-opening-pending'); document.body.classList.add('brand-opening-complete');
    };
    const finish = (immediate = false) => {
      if (!active) return;
      if (finishing) { if (immediate) { window.clearTimeout(finishTimer); destroy(); } return; }
      finishing = true;
      if (immediate) { destroy(); return; }
      document.body.classList.add('brand-opening-leaving');
      finishTimer = window.setTimeout(destroy, 520);
    };
    /* The hero is woken under the opening ring so it is already moving when uncovered. */
    const beginReveal = () => {
      if (revealing) return;
      revealing = true;
      document.body.classList.add('brand-opening-revealing', 'brand-opening-complete');
      document.body.classList.remove('brand-opening-active');
      skip.hidden = true;
    };

    const tick = now => {
      frame = 0;
      if (!active || document.hidden) { last = 0; return; }
      const delta = last ? Math.max(0, now - last) : 0;
      last = now; elapsed = Math.min(END * 1000, elapsed + delta);
      const t = elapsed / 1000;
      fpsFrames += 1; fpsTime += delta; if (fpsTime >= 500) { fps = Math.round(fpsFrames * 1000 / fpsTime); fpsFrames = 0; fpsTime = 0; }
      mouseAmt *= .94;
      if (t >= T.reveal[0]) beginReveal();
      if (t >= END) { destroy(); return; }
      draw(t);
      frame = requestAnimationFrame(tick);
    };
    const resume = () => { if (active && !frame && !document.hidden) frame = requestAnimationFrame(tick); };

    gl.viewport(0, 0, canvas.width, canvas.height); draw(0);
    if (gl.getError() !== gl.NO_ERROR) { destroy(); return; }
    overlay = document.createElement('div'); overlay.className = 'brand-opening';
    overlay.append(canvas, ui); document.body.append(overlay); overlay.append(skip); skip.hidden = false;
    document.body.classList.add('brand-opening-active'); resume();

    skip.addEventListener('click', () => finish(true), { once: true });
    overlay.addEventListener('pointermove', event => { if (event.pointerType !== 'mouse') return; mouse = { x: event.clientX, y: event.clientY }; mouseAmt = Math.min(1, mouseAmt + .22); }, { passive: true });
    overlay.addEventListener('pointerleave', () => { mouse = { x: -9999, y: -9999 }; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' || ['Tab', ' ', 'PageDown', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) finish(true); });
    /* Initial document focus is not user interruption; every real element focus is. */
    document.addEventListener('focusin', event => { if (active && event.target !== skip && event.target !== document.body && event.target !== document.documentElement) finish(true); });
    window.addEventListener('wheel', () => finish(true), { passive: true, once: true }); window.addEventListener('touchstart', () => finish(true), { passive: true, once: true });
    window.addEventListener('scroll', () => { if (scrollY > 2) finish(true); }, { passive: true });
    /* The film is laid out for one viewport; a real width change ends it rather than distorting it. */
    window.addEventListener('resize', () => { if (active && Math.abs(innerWidth - W) > 2) finish(true); }, { passive: true });
    document.addEventListener('visibilitychange', () => { last = 0; resume(); }); window.addEventListener('pageshow', event => { if (event.persisted) finish(); });
    reduced.addEventListener?.('change', () => { if (reduced.matches) finish(true); });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); finish(true); });
  };

  const fontReady = document.fonts?.load ? Promise.race([document.fonts.load('400 120px "Cormorant Garamond"'), new Promise(resolve => window.setTimeout(resolve, 900))]) : Promise.resolve();
  fontReady.catch(() => {}).then(() => window.requestAnimationFrame(() => {
    start();
    /* Bypassed or no WebGL: the film never ran, so release the hero copy now. */
    if (!document.body.classList.contains('brand-opening-active') && !document.body.classList.contains('brand-opening-complete')) document.body.classList.remove('brand-opening-pending');
  }));
})();
