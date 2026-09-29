/*
 * Section Depth
 * A single fixed WebGL context paints all visible non-hero sections with
 * scissored, ray-marched folded architecture. No library, image, or network
 * request is used. Animation is capped, visibility-aware, and optional.
 */
(() => {
  'use strict';

  const start = () => {
    const body = document.body;
    if (!body || body.dataset.sectionDepth === 'active') return;

    const defaultSelectors = [
      '.section-services',
      '.section-numbers',
      '.section-why',
      '.section-flow',
      '.section-founder',
      '.section-faq',
      '#contact.section-contact'
    ];
    /* Other dark pages may opt into this same gallery with their own reading
       regions. Leaving the attributes absent retains the homepage's original
       selector list and per-section tonal order exactly. */
    const selectors = body.dataset.sectionDepthTargets
      ? body.dataset.sectionDepthTargets.split('|').map(value => value.trim()).filter(Boolean)
      : defaultSelectors;
    const requestedStyles = body.dataset.sectionDepthStyles
      ? body.dataset.sectionDepthStyles.split('|').map(value => Number(value.trim()))
      : null;
    const sections = selectors.map((selector, index) => {
      const element = document.querySelector(selector);
      const style = requestedStyles && Number.isFinite(requestedStyles[index])
        ? requestedStyles[index]
        : index;
      return element ? { element, style, visible: false } : null;
    }).filter(Boolean);
    if (!sections.length) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = document.createElement('canvas');
    canvas.className = 'section-depth-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    let gl = null;
    let program = null;
    let buffer = null;
    let locations = null;
    let frame = 0;
    let lastFrame = 0;
    let lastAnimationFrame = 0;
    let elapsed = 0;
    let lost = false;
    let ready = false;
    let needsDraw = true;
    let pixelScaleX = 1;
    let pixelScaleY = 1;

    const vertexSource = `
      attribute vec2 aPosition;
      void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
    `;

    const fragmentSource = `
      precision highp float;

      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uProgress;
      uniform float uStyle;

      #define FAR 16.0
      /* Keep the surface test below a rendered pixel without materially
         increasing the march cost. This keeps the thin folded rim clean at
         the fixed PC/SP resolution ceilings. */
      #define EPSILON 0.00245

      mat2 rotate2(float angle) {
        float c = cos(angle), s = sin(angle);
        return mat2(c, -s, s, c);
      }

      float roundedBox(vec3 p, vec3 halfSize, float radius) {
        vec3 q = abs(p) - halfSize;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - radius;
      }

      /* A thin solid plate is bent along its length, sharply folded in depth,
         and continuously twisted. Its narrow third dimension creates the crisp
         chrome edge that a flat gradient cannot produce. */
      float foldedRibbon(vec3 p, vec3 centre, float angle, float side, float lane) {
        vec3 q = p - centre;
        q.xy = rotate2(angle) * q.xy;
        float along = q.y;
        float phase = lane * 1.71;
        float breathe = uTime * (0.075 + lane * 0.012);
        q.x -= 0.42 * sin(along * 0.53 + phase + breathe);
        q.z -= 0.52 * sin(along * 0.67 - phase * 0.42 + breathe);
        q.xz = rotate2(side * (0.39 * sin(along * 0.42 + phase + breathe) + 0.11)) * q.xz;
        float aspect = uResolution.x / uResolution.y;
        float portrait = 1.0 - smoothstep(0.72, 1.15, aspect);
        float width = mix(1.04, 0.60, portrait);
        float length = mix(5.65, 7.10, portrait);
        return roundedBox(q, vec3(width, length, 0.046), 0.105);
      }

      float sceneDistance(vec3 p) {
        float aspect = uResolution.x / uResolution.y;
        float portrait = 1.0 - smoothstep(0.72, 1.15, aspect);
        float spread = mix(5.00, 2.58, portrait);
        float travel = (uProgress - 0.5) * 0.52;

        float d = foldedRibbon(
          p,
          vec3(-spread, travel, 0.08),
          -0.065, -1.0, 0.0
        );
        d = min(d, foldedRibbon(
          p,
          vec3(spread, -travel, -0.02),
          0.060, 1.0, 2.0
        ));
        return d;
      }

      vec3 surfaceNormal(vec3 p) {
        vec2 e = vec2(EPSILON, 0.0);
        return normalize(vec3(
          sceneDistance(p + e.xyy) - sceneDistance(p - e.xyy),
          sceneDistance(p + e.yxy) - sceneDistance(p - e.yxy),
          sceneDistance(p + e.yyx) - sceneDistance(p - e.yyx)
        ));
      }

      float band(float value, float centre, float width) {
        return exp(-pow((value - centre) / width, 2.0));
      }

      vec3 sectionBase() {
        if (uStyle < 0.5) return vec3(0.090, 0.098, 0.122); /* #17191f */
        if (uStyle < 1.5) return vec3(0.031, 0.035, 0.047); /* #08090c */
        if (uStyle < 2.5) return vec3(0.125, 0.149, 0.188); /* #202630 */
        if (uStyle < 3.5) return vec3(0.063, 0.071, 0.086); /* #101216 */
        if (uStyle < 4.5) return vec3(0.137, 0.122, 0.125); /* #231f20 */
        if (uStyle < 5.5) return vec3(0.063, 0.071, 0.086); /* #101216 */
        return vec3(0.125, 0.169, 0.227);                  /* #202b3a */
      }

      vec3 studioReflection(vec3 reflected, vec3 normal, vec3 point) {
        float cyan = band(reflected.y + 0.22 * sin(reflected.x * 3.2), -0.27, 0.13);
        float rose = band(reflected.y - 0.28 * cos(reflected.x * 2.7), 0.31, 0.12);
        float amber = band(reflected.x + 0.16 * sin(reflected.y * 4.0), 0.42, 0.14);
        float cobalt = band(reflected.x, -0.45, 0.25);
        /* Narrow, separated studio strips describe the bend more clearly than
           a broad wash of white, so the chroma remains legible in motion. */
        float whiteStrip = band(reflected.x + reflected.y * 0.18, 0.04, 0.024);
        float secondStrip = band(reflected.y - reflected.x * 0.12, -0.05, 0.017);

        vec3 colour = vec3(0.008, 0.015, 0.034);
        colour += vec3(0.00, 0.71, 1.00) * cyan * 1.80;
        colour += vec3(1.00, 0.025, 0.34) * rose * 1.62;
        colour += vec3(1.00, 0.29, 0.018) * amber * 1.48;
        colour += vec3(0.028, 0.075, 0.58) * cobalt * 1.42;
        colour += vec3(1.00, 0.99, 1.00) * whiteStrip * 4.15;
        colour += vec3(0.54, 0.82, 1.00) * secondStrip * 2.02;

        return colour;
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 frag = gl_FragCoord.xy;
        vec2 uv = (2.0 * frag - uResolution.xy) / uResolution.y;
        float screenX = abs(frag.x / uResolution.x * 2.0 - 1.0);
        float aspect = uResolution.x / uResolution.y;

        vec3 base = sectionBase();
        float sideAura = smoothstep(0.18, 1.0, screenX);
        float upperLight = smoothstep(-0.72, 0.82, uv.y);
        vec3 colour = base * (0.83 + 0.15 * upperLight);
        colour += vec3(0.018, 0.045, 0.105) * sideAura * 0.42;

        /* Pulling back on portrait screens keeps the sculpture visibly large at
           both margins without letting it cross the central reading column. */
        float portrait = 1.0 - smoothstep(0.72, 1.15, aspect);
        float cameraZ = mix(5.35, 8.35, portrait);
        vec3 origin = vec3(
          0.10 * sin((uProgress - 0.5) * 1.8),
          (uProgress - 0.5) * 0.34,
          cameraZ
        );
        vec3 target = vec3(0.0, (uProgress - 0.5) * -0.16, 0.0);
        vec3 forward = normalize(target - origin);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
        vec3 up = cross(forward, right);
        vec3 ray = normalize(forward + uv.x * right * 0.82 + uv.y * up * 0.82);

        float distanceTravelled = 0.0;
        float distanceToScene = 0.0;
        bool hit = false;
        for (int index = 0; index < 60; index++) {
          vec3 point = origin + ray * distanceTravelled;
          distanceToScene = sceneDistance(point);
          if (distanceToScene < EPSILON) { hit = true; break; }
          distanceTravelled += distanceToScene * 0.77;
          if (distanceTravelled > FAR) break;
        }

        if (hit) {
          vec3 point = origin + ray * distanceTravelled;
          vec3 normal = surfaceNormal(point);
          vec3 reflected = reflect(ray, normal);
          float facing = max(0.0, dot(-ray, normal));
          float fresnel = pow(1.0 - facing, 3.1);
          vec3 reflection = studioReflection(reflected, normal, point);

          vec3 key = normalize(vec3(-0.48, 0.72, 0.55));
          vec3 rim = normalize(vec3(0.62, -0.18, 0.76));
          float diffuse = max(0.0, dot(normal, key));
          float edgeLight = pow(max(0.0, dot(normal, rim)), 8.0);
          float specular = pow(max(0.0, dot(reflect(-key, normal), -ray)), 46.0);
          vec3 darkGlass = vec3(0.004, 0.014, 0.046) * (0.44 + diffuse * 0.68);
          vec3 material = mix(darkGlass, reflection, 0.74 + 0.22 * fresnel);
          material += vec3(0.32, 0.58, 1.00) * edgeLight * 0.86;
          material += vec3(1.00, 0.94, 0.90) * specular * 1.82;
          material = 1.0 - exp(-material * 1.13);

          /* The polished material exists only at the outer perimeter. Forms may
             continue through world space, but never wash through the reading
             column. Left-side exposure is slightly lower because several real
             headings begin near that edge. */
          float sculptureExposure = smoothstep(0.66, 0.86, screenX);
          float leftCopyGuard = mix(0.68, 1.0, smoothstep(0.0, 0.56, frag.x / uResolution.x));
          colour = mix(colour, material, sculptureExposure * leftCopyGuard);
        }

        /* A broad, non-graphic exposure mask protects real headings, details,
           and fields. It does not erase the high-impact edge silhouettes. */
        float readingGuard = 1.0 - smoothstep(0.26, 0.72, screenX);
        colour *= 1.0 - readingGuard * 0.42;

        float vignette = 1.0 - smoothstep(0.26, 1.35, length(uv * vec2(0.66, 0.82)));
        colour *= 0.88 + 0.12 * vignette;
        colour += (hash21(frag) - 0.5) / 255.0;
        gl_FragColor = vec4(colour, 1.0);
      }
    `;

    const destroyResources = () => {
      if (!gl || lost) return;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      buffer = null;
      program = null;
      locations = null;
    };

    const fail = () => {
      ready = false;
      body.classList.remove('section-depth-ready');
      canvas.style.visibility = 'hidden';
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      lastAnimationFrame = 0;
    };

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        throw new Error('Section depth shader unavailable');
      }
      return shader;
    };

    const initialiseGL = () => {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      });
      if (!gl) throw new Error('Section depth WebGL unavailable');

      const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Section depth program unavailable');
      }

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      locations = {
        resolution: gl.getUniformLocation(program, 'uResolution'),
        time: gl.getUniformLocation(program, 'uTime'),
        progress: gl.getUniformLocation(program, 'uProgress'),
        style: gl.getUniformLocation(program, 'uStyle')
      };
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
    };

    const resize = () => {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      const longEdgeLimit = width <= 768 ? 1000 : 1440;
      const scale = Math.min(window.devicePixelRatio || 1, 1.25, longEdgeLimit / Math.max(width, height));
      const nextWidth = Math.max(1, Math.round(width * scale));
      const nextHeight = Math.max(1, Math.round(height * scale));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      pixelScaleX = canvas.width / width;
      pixelScaleY = canvas.height / height;
      needsDraw = true;
    };

    const draw = () => {
      if (!gl || !program || lost) return false;
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.scissor(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(locations.resolution, canvas.width, canvas.height);
      gl.uniform1f(locations.time, elapsed);
      const firstRect = sections[0].element.getBoundingClientRect();
      const lastRect = sections[sections.length - 1].element.getBoundingClientRect();
      const contentHeight = Math.max(lastRect.bottom - firstRect.top, 1);
      const globalProgress = reduced.matches
        ? 0.5
        : Math.min(1, Math.max(0, (window.innerHeight - firstRect.top) / (window.innerHeight + contentHeight)));

      let draws = 0;
      sections.forEach(section => {
        if (!section.visible) return;
        const rect = section.element.getBoundingClientRect();
        const left = Math.max(0, rect.left);
        const right = Math.min(window.innerWidth, rect.right);
        const top = Math.max(0, rect.top);
        const bottom = Math.min(window.innerHeight, rect.bottom);
        if (right <= left || bottom <= top) return;

        /* Rounding both sides of an adjacent boundary to the same canvas pixel
           prevents a one-pixel overlap or gap between scissored sections. */
        const x = Math.max(0, Math.round(left * pixelScaleX));
        const y = Math.max(0, Math.round((window.innerHeight - bottom) * pixelScaleY));
        const rightEdge = Math.min(canvas.width, Math.round(right * pixelScaleX));
        const topEdge = Math.min(canvas.height, Math.round((window.innerHeight - top) * pixelScaleY));
        const width = rightEdge - x;
        const height = topEdge - y;
        if (width <= 0 || height <= 0) return;

        gl.scissor(x, y, width, height);
        gl.uniform1f(locations.style, section.style);
        gl.uniform1f(locations.progress, globalProgress);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        draws += 1;
      });
      needsDraw = false;
      const succeeded = draws > 0 && gl.getError() === gl.NO_ERROR;
      /* Activation belongs to the successful draw path so a restored context
         comes back immediately even when the page has not scrolled. */
      if (succeeded && !ready) {
        ready = true;
        canvas.style.visibility = '';
        body.classList.add('section-depth-ready');
      }
      return succeeded;
    };

    const animationAllowed = () => (
      !reduced.matches &&
      !body.classList.contains('motion-paused') &&
      !document.hidden &&
      sections.some(section => section.visible)
    );

    const tick = now => {
      frame = 0;
      if (lost) return;
      const interval = window.innerWidth <= 768 ? 1000 / 24 : 1000 / 30;
      if (!lastFrame || now - lastFrame >= interval) {
        const delta = lastAnimationFrame ? now - lastAnimationFrame : 0;
        elapsed += lastFrame ? Math.min(delta / 1000, 0.08) : 0;
        /* Retain the interval remainder instead of anchoring every draw to
           the browser callback. The cadence stays at 30/24fps, but avoids
           the subtle alternating frame lengths caused by discarded time. */
        lastFrame = lastFrame
          ? lastFrame + Math.floor((now - lastFrame) / interval) * interval
          : now;
        lastAnimationFrame = now;
        draw();
      }
      if (animationAllowed()) frame = requestAnimationFrame(tick);
      else {
        lastFrame = 0;
        lastAnimationFrame = 0;
      }
    };

    const schedule = () => {
      needsDraw = true;
      if (lost || document.hidden) return;
      if (animationAllowed()) {
        if (!frame) frame = requestAnimationFrame(tick);
        return;
      }
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          lastFrame = 0;
          lastAnimationFrame = 0;
          if (needsDraw) draw();
        });
      }
    };

    try {
      body.prepend(canvas);
      initialiseGL();
      resize();
      body.dataset.sectionDepth = 'active';
    } catch (_) {
      destroyResources();
      canvas.remove();
      return;
    }

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      lost = true;
      fail();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      lost = false;
      try {
        initialiseGL();
        resize();
        schedule();
      } catch (_) {
        fail();
      }
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const section = sections.find(item => item.element === entry.target);
          if (section) section.visible = entry.isIntersecting && entry.intersectionRatio > 0;
        });
        draw();
        schedule();
      }, { threshold: [0, 0.001] });
      sections.forEach(section => observer.observe(section.element));
    } else {
      const updateVisibility = () => {
        sections.forEach(section => {
          const rect = section.element.getBoundingClientRect();
          section.visible = rect.bottom > 0 && rect.top < window.innerHeight;
        });
        draw();
        schedule();
      };
      updateVisibility();
      window.addEventListener('scroll', updateVisibility, { passive: true });
    }

    const syncMotion = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      lastAnimationFrame = 0;
      schedule();
    };
    const bodyObserver = new MutationObserver(syncMotion);
    bodyObserver.observe(body, { attributes: true, attributeFilter: ['class'] });
    reduced.addEventListener?.('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
