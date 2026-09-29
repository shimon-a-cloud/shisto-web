/* Keep the approved code-to-text entrance in the hero and IN PRODUCTION intro.
   Section copy enters as whole blocks: a small rise for headings, a quiet fade
   for everything else. Photos and non-text frames retain their own entrances. */
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const GLYPHS = '{}[]<>/=+*;:01#$%&?';
  const DIGITS = '0123456789';
  const SKIP = '.faq-icon, .svc-toggle, svg, script, style';
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  /* A fixed scatter, so the order is the same on every visit. */
  const scatter = i => { const v = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v); };

  /* Split text into per-character spans. Shallow: only the element's direct text
     (the hero keeps its child elements whole). Deep: every text node inside, except
     icons. Leading and trailing whitespace stays a plain text node. Each span carries
     the colour its text had, so selectors aimed at real spans cannot recolour it. */
  const split = (el, deep) => {
    const nodes = [];
    if (deep) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: node => node.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    } else {
      nodes.push(...[...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE));
    }
    const chars = [];
    chars.wraps = [];
    nodes.forEach(node => {
      const text = node.textContent;
      const core = text.trim();
      if (!core) return;
      const lead = text.slice(0, text.indexOf(core));
      const tail = text.slice(lead.length + core.length);
      const frag = document.createDocumentFragment();
      const parentStyle = getComputedStyle(node.parentElement);
      /* Inside a flex/grid box a bare text run is one item that wraps; loose spans
         would each become an item and stop wrapping, so they share one wrapper. */
      const run = /flex|grid/.test(parentStyle.display) ? document.createElement('span') : frag;
      if (run !== frag) chars.wraps.push(run);
      if (lead) frag.append(lead);
      [...core].forEach(ch => {
        const span = document.createElement('span');
        span.className = 'hd-ch'; span.textContent = ch; span.hdSplit = true;
        span.style.setProperty('color', parentStyle.color, 'important');
        run.append(span); chars.push(span);
      });
      if (run !== frag) frag.append(run);
      if (tail) frag.append(tail);
      node.replaceWith(frag);
    });
    return chars;
  };

  /* Put the text back exactly as it was once an entrance has finished. */
  const restore = chars => {
    const parents = new Set();
    chars.forEach(ch => {
      if (!ch.hdSplit || !ch.parentNode) return;
      parents.add(ch.parentNode); ch.replaceWith(ch.textContent);
    });
    (chars.wraps || []).forEach(wrap => { parents.add(wrap.parentNode); wrap.replaceWith(...wrap.childNodes); });
    parents.forEach(parent => parent?.normalize());
  };

  /* ── Entrances. Each is prepared (hidden) up front, then drawn from its own start
     time by one shared animation loop, and leaves no trace when done. ── */
  const decode = (chars, dur, scramble) => {
    chars.forEach(ch => { ch.classList.add('hd-ch', 'is-wait'); if (ch.textContent.trim() === '') ch.dataset.blank = '1'; });
    const n = Math.max(1, chars.length - 1);
    return {
      total: dur + .5,
      render: t => chars.forEach((ch, i) => {
        const appear = (i / n) * (dur - scramble);
        const settle = appear + scramble;
        if (t < appear) return;
        if (ch.dataset.blank) { ch.classList.remove('is-wait'); return; }
        if (t < settle) {
          ch.classList.remove('is-wait'); ch.classList.add('is-scr');
          const set = /\d/.test(ch.textContent) ? DIGITS : GLYPHS;
          ch.dataset.g = set[(Math.floor(t * 30) + i * 7) % set.length];
          return;
        }
        ch.classList.remove('is-wait', 'is-scr');
        const glow = 1 - clamp01((t - settle) / .45);
        if (glow > 0) ch.style.textShadow = `0 0 ${(14 * glow).toFixed(1)}px rgba(120,235,255,${(.85 * glow).toFixed(2)})`;
        else ch.style.removeProperty('text-shadow');
      }),
      finish: () => {
        chars.forEach(ch => {
          ch.classList.remove('is-wait', 'is-scr', 'hd-ch'); ch.style.removeProperty('text-shadow');
          delete ch.dataset.g; delete ch.dataset.blank;
        });
        restore(chars);
      },
    };
  };

  const setMask = (el, value) => {
    if (value) { el.style.setProperty('-webkit-mask-image', value); el.style.setProperty('mask-image', value); return; }
    el.style.removeProperty('-webkit-mask-image'); el.style.removeProperty('mask-image');
  };

  const wipe = (el, dur) => {
    el.classList.add('hd-wipe');
    return {
      total: dur,
      /* A soft edge 10% wide travels from the left; everything behind it is shown. */
      render: t => {
        const edge = -10 + easeOut(clamp01(t / dur)) * 120;
        setMask(el, `linear-gradient(90deg, #000 ${edge}%, rgba(0,0,0,.35) ${edge + 5}%, transparent ${edge + 10}%)`);
      },
      finish: () => { setMask(el, ''); el.classList.remove('hd-wipe'); },
    };
  };

  /* Per-character focus: opacity and blur, plus a brief white bloom as it lands. */
  const focusChar = (ch, p, blur, bloom) => {
    if (p <= 0) { ch.style.opacity = '0'; return; }
    const e = easeOut(p);
    ch.style.opacity = e.toFixed(3);
    ch.style.filter = e < 1 ? `blur(${(blur * (1 - e)).toFixed(2)}px)` : '';
    const g = bloom * Math.sin(Math.PI * clamp01(p * 1.15));
    ch.style.textShadow = g > .01 ? `0 0 ${(16 * g).toFixed(1)}px rgba(255,255,255,${(.55 * g).toFixed(2)})` : '';
  };
  const clearChars = chars => chars.forEach(ch => {
    ch.classList.remove('hd-ch', 'is-wait');
    ['opacity', 'filter', 'text-shadow'].forEach(prop => ch.style.removeProperty(prop));
  });

  /* h2: characters crystallise out of a blur in scattered order. */
  const crystal = chars => {
    const n = chars.length;
    const rank = chars.map((_, i) => i).sort((a, b) => scatter(a) - scatter(b));
    const at = new Array(n);
    rank.forEach((index, k) => { at[index] = (k / Math.max(1, n - 1)) * Math.min(.9, .25 + n * .05); });
    chars.forEach(ch => { ch.style.opacity = '0'; });
    const life = .8;
    return {
      total: Math.max(...at, 0) + life + .05,
      render: t => chars.forEach((ch, i) => focusChar(ch, (t - at[i]) / life, 14, 1)),
      finish: () => { clearChars(chars); restore(chars); },
    };
  };

  /* Titles: a soft focus front passes from left to right. */
  const sweep = (chars, delay = 0) => {
    const n = chars.length;
    const spread = Math.min(.7, .12 + n * .035);
    chars.forEach(ch => { ch.style.opacity = '0'; });
    const life = .55;
    return {
      total: delay + spread + life + .05,
      render: t => chars.forEach((ch, i) => focusChar(ch, (t - delay - (i / Math.max(1, n - 1)) * spread) / life, 7, .45)),
      finish: () => { clearChars(chars); restore(chars); },
    };
  };

  /* Figures: every digit spins like an odometer and settles, the leading digit first;
     anything that is not a digit (本, 領域, +) comes into focus as the spin ends. */
  const roll = chars => {
    const digits = chars.filter(ch => /\d/.test(ch.textContent));
    const rest = chars.filter(ch => !/\d/.test(ch.textContent));
    const spins = digits.map((ch, j) => {
      ch.classList.add('hd-roll');
      const target = +ch.textContent;
      const dur = 1.05 + j * .22;
      const end = (1 + j) * 10 + target;
      ch.dataset.a = '0'; ch.dataset.b = '1';
      return { ch, dur, end, last: -1 };
    });
    const tailAt = spins.length ? Math.max(...spins.map(s => s.dur)) - .3 : 0;
    const text = sweep(rest, tailAt);
    return {
      total: Math.max(text.total, tailAt + .6),
      render: t => {
        spins.forEach(spin => {
          const p = clamp01(t / spin.dur);
          const value = spin.end * (1 - Math.pow(1 - p, 4));
          const whole = Math.floor(value);
          if (whole !== spin.last) { spin.ch.dataset.a = whole % 10; spin.ch.dataset.b = (whole + 1) % 10; spin.last = whole; }
          spin.ch.style.setProperty('--r', (value - whole).toFixed(3));
          const speed = spin.end * 4 * Math.pow(1 - p, 3) / spin.dur;
          spin.ch.style.filter = speed > 2 ? `blur(${Math.min(1.4, speed * .035).toFixed(2)}px)` : '';
        });
        text.render(t);
      },
      finish: () => {
        spins.forEach(({ ch }) => {
          ch.classList.remove('hd-roll'); delete ch.dataset.a; delete ch.dataset.b;
          ch.style.removeProperty('--r'); ch.style.removeProperty('filter');
        });
        clearChars(rest); restore(chars);
      },
    };
  };

  /* Body copy: each rendered line is written out in turn by its own soft edge. */
  const lines = el => {
    el.classList.add('hd-wipe');
    let rows = 0;
    let layers = [];
    const lineDur = .62;
    const gap = .11;
    const measure = () => {
      const cs = getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize) || 16;
      const lh = parseFloat(cs.lineHeight) || fontSize * 1.6;
      const top = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
      const height = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      rows = Math.max(1, Math.round(height / lh));
      layers = Array.from({ length: rows }, (_, k) => ({
        y: k === 0 ? 0 : top + k * lh,
        h: k === 0 ? top + lh : (k === rows - 1 ? el.offsetHeight : lh),
      }));
      item.total = (rows - 1) * gap + lineDur + .02;
    };
    const item = {
      total: lineDur,
      render: t => {
        if (!rows) measure();
        const images = []; const sizes = []; const places = [];
        layers.forEach((layer, k) => {
          const edge = -14 + easeOut(clamp01((t - k * gap) / lineDur)) * 128;
          images.push(`linear-gradient(90deg, #000 ${edge.toFixed(2)}%, transparent ${(edge + 14).toFixed(2)}%)`);
          sizes.push(`100% ${layer.h}px`); places.push(`0 ${layer.y}px`);
        });
        setMask(el, images.join(','));
        ['-webkit-mask-size', 'mask-size'].forEach(prop => el.style.setProperty(prop, sizes.join(',')));
        ['-webkit-mask-position', 'mask-position'].forEach(prop => el.style.setProperty(prop, places.join(',')));
      },
      finish: () => {
        setMask(el, ''); el.classList.remove('hd-wipe');
        ['-webkit-mask-size', 'mask-size', '-webkit-mask-position', 'mask-position'].forEach(prop => el.style.removeProperty(prop));
      },
    };
    return item;
  };

  /* Table values: typed behind a thin caret, which blinks twice and leaves. */
  const type = chars => {
    chars.forEach(ch => ch.classList.add('is-wait'));
    const step = Math.min(.045, .85 / Math.max(1, chars.length));
    const typed = chars.length * step;
    return {
      total: typed + .75,
      render: t => {
        const shown = Math.min(chars.length, Math.floor(t / step) + 1);
        chars.forEach((ch, i) => {
          ch.classList.toggle('is-wait', i >= shown);
          ch.classList.toggle('hd-caret', i === shown - 1 && (t < typed || Math.floor((t - typed) / .18) % 2 === 0));
        });
      },
      finish: () => { chars.forEach(ch => ch.classList.remove('is-wait', 'hd-caret', 'hd-ch')); restore(chars); },
    };
  };

  /* Cards: a point of light runs once around the inner edge, leaving a line that fades. */
  const SVG = 'http://www.w3.org/2000/svg';
  const trace = (el, dur) => {
    if (getComputedStyle(el).position === 'static') el.classList.add('hd-photo-place');
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'hd-trace'); svg.setAttribute('aria-hidden', 'true');
    const rect = document.createElementNS(SVG, 'rect');
    const head = document.createElementNS(SVG, 'circle');
    head.setAttribute('r', '2.2');
    svg.append(rect, head);
    let length = 0;
    return {
      total: dur + .6,
      render: t => {
        if (!length) {
          el.append(svg);
          const w = el.clientWidth; const h = el.clientHeight;
          const radius = Math.max(0, (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) - 1);
          svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          Object.entries({ x: .5, y: .5, width: w - 1, height: h - 1, rx: radius }).forEach(([k, v]) => rect.setAttribute(k, v));
          length = rect.getTotalLength();
        }
        const p = easeInOut(clamp01(t / dur));
        rect.style.strokeDasharray = `${(p * length).toFixed(1)} ${length}`;
        const point = rect.getPointAtLength(p * length);
        head.setAttribute('cx', point.x); head.setAttribute('cy', point.y);
        head.style.opacity = (1 - clamp01((t - dur) / .2)).toFixed(3);
        svg.style.opacity = (1 - clamp01((t - dur) / .6)).toFixed(3);
      },
      finish: () => { svg.remove(); el.classList.remove('hd-photo-place'); },
    };
  };

  /* FAQ: the rule under the question is drawn, then the question opens from a slit. */
  const fold = el => {
    const summary = el.querySelector('summary');
    const ruleWidth = parseFloat(getComputedStyle(el).borderBottomWidth) || 0;
    if (getComputedStyle(el).position === 'static') el.classList.add('hd-photo-place');
    let rule = null;
    if (ruleWidth) {
      rule = document.createElement('span');
      rule.className = 'hd-rule'; rule.setAttribute('aria-hidden', 'true');
      rule.style.height = `${Math.max(1, ruleWidth)}px`; rule.style.bottom = `${-ruleWidth}px`;
      el.append(rule);
    }
    const setClip = value => {
      if (!summary) return;
      ['clip-path', '-webkit-clip-path'].forEach(prop => (value ? summary.style.setProperty(prop, value) : summary.style.removeProperty(prop)));
    };
    setClip('inset(50% 0 50% 0)');
    return {
      total: 1.25,
      render: t => {
        if (rule) {
          rule.style.transform = `scaleX(${easeInOut(clamp01(t / .6)).toFixed(3)})`;
          rule.style.opacity = (1 - clamp01((t - .7) / .5)).toFixed(3);
        }
        const open = easeOut(clamp01((t - .28) / .6));
        const cut = ((1 - open) * 50).toFixed(2);
        setClip(`inset(${cut}% 0 ${cut}% 0)`);
        if (summary) summary.style.opacity = clamp01((t - .28) / .3).toFixed(3);
      },
      finish: () => { rule?.remove(); setClip(''); summary?.style.removeProperty('opacity'); el.classList.remove('hd-photo-place'); },
    };
  };

  /* Buttons and form fields: they surface out of a deep blur. */
  const surface = (el, delay = 0) => {
    el.style.opacity = '0';
    const dur = .8;
    return {
      total: delay + dur,
      render: t => {
        const e = easeOut(clamp01((t - delay) / dur));
        el.style.opacity = e.toFixed(3);
        el.style.filter = e < 1 ? `blur(${(10 * (1 - e)).toFixed(2)}px)` : '';
      },
      finish: () => { el.style.removeProperty('opacity'); el.style.removeProperty('filter'); },
    };
  };

  /* Section text stays whole, so line wrapping and inline formatting never change. */
  const revealText = (el, heading = false) => {
    const dur = heading ? .55 : .42;
    el.style.opacity = '0';
    if (heading) el.style.translate = '0 8px';
    return {
      total: dur,
      render: t => {
        const p = easeOut(clamp01(t / dur));
        el.style.opacity = p.toFixed(3);
        if (heading) el.style.translate = `0 ${(8 * (1 - p)).toFixed(2)}px`;
      },
      finish: () => {
        el.style.removeProperty('opacity');
        if (heading) el.style.removeProperty('translate');
      },
    };
  };

  /* Chips: each one surfaces a beat after the last. */
  const chips = el => {
    const parts = [...el.children].map((child, i) => surface(child, i * .09));
    return {
      total: Math.max(...parts.map(part => part.total), 0),
      render: t => parts.forEach(part => part.render(t)),
      finish: () => parts.forEach(part => part.finish()),
    };
  };

  /* Photos: a coarse mosaic arrives tile by tile, then sharpens in steps into the
     photo itself (drawn on a canvas laid exactly over each image). */
  const resolve = (el, dur) => {
    if (getComputedStyle(el).position === 'static') el.classList.add('hd-photo-place');
    const plates = [...el.querySelectorAll('img')].map(img => {
      const canvas = document.createElement('canvas');
      canvas.className = 'hd-mosaic'; canvas.setAttribute('aria-hidden', 'true');
      img.style.opacity = '0';
      return { img, canvas, ctx: canvas.getContext('2d'), from: null, placed: false };
    });
    const point = (value, room) => {
      const keyword = { left: 0, top: 0, center: .5, right: 1, bottom: 1 }[value];
      if (keyword !== undefined) return keyword * room;
      return value.endsWith('%') ? parseFloat(value) / 100 * room : parseFloat(value) || 0;
    };
    const draw = (plate, block, reveal) => {
      const { img, canvas, ctx } = plate;
      const w = img.offsetWidth; const h = img.offsetHeight;
      if (!plate.placed) {
        const z = getComputedStyle(img).zIndex;
        Object.assign(canvas.style, { zIndex: z === 'auto' ? '' : z });
        img.after(canvas); plate.placed = true;
      }
      Object.assign(canvas.style, { left: `${img.offsetLeft}px`, top: `${img.offsetTop}px`, width: `${w}px`, height: `${h}px` });
      const cols = Math.max(1, Math.round(w / block)); const rows = Math.max(1, Math.round(h / block));
      if (canvas.width !== cols || canvas.height !== rows) { canvas.width = cols; canvas.height = rows; }
      const nw = img.naturalWidth; const nh = img.naturalHeight;
      const scale = Math.max(w / nw, h / nh);
      const [px, py] = getComputedStyle(img).objectPosition.split(' ');
      const sx = -point(px, w - nw * scale) / scale; const sy = -point(py, h - nh * scale) / scale;
      ctx.clearRect(0, 0, cols, rows);
      ctx.drawImage(img, sx, sy, w / scale, h / scale, 0, 0, cols, rows);
      if (reveal < 1) {
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          if (scatter(y * 131 + x * 7 + 3) > reveal) ctx.clearRect(x, y, 1, 1);
        }
      }
    };
    const item = {
      total: dur + 3,
      render: t => {
        let pending = false;
        plates.forEach(plate => {
          const { img, canvas } = plate;
          if (plate.from === null) {
            if (!img.complete || !img.naturalWidth) { pending = t < 3; return; }
            plate.from = t;
          }
          const p = clamp01((t - plate.from) / dur);
          const base = Math.max(18, img.offsetWidth / 11);
          /* Tiles arrive at the coarsest size, then the size halves in clear steps. */
          const level = p < .28 ? 0 : Math.min(4, Math.floor((p - .28) / .12) + 1);
          draw(plate, Math.max(1, base / Math.pow(2, level)), clamp01(p / .26));
          const fade = clamp01((p - .78) / .22);
          canvas.style.opacity = (1 - fade).toFixed(3);
          canvas.style.filter = `grayscale(${(1 - clamp01(p / .7)).toFixed(3)}) brightness(${(1 + .25 * (1 - p)).toFixed(3)})`;
          img.style.opacity = fade.toFixed(3);
          if (p < 1) pending = true;
        });
        if (!pending) item.total = t;
      },
      finish: () => {
        plates.forEach(({ img, canvas }) => { canvas.remove(); img.style.removeProperty('opacity'); });
        el.classList.remove('hd-photo-place');
      },
    };
    return item;
  };

  const active = new Set();
  let frame = 0;
  const finishItem = item => { item.finish(); active.delete(item); item.done?.(); };
  const tick = now => {
    active.forEach(item => {
      if (now < item.start) return;
      const t = (now - item.start) / 1000;
      if (t >= item.total) { finishItem(item); return; }
      item.render(t);
    });
    frame = active.size ? requestAnimationFrame(tick) : 0;
  };
  const run = (item, start) => {
    if (document.body.classList.contains('motion-paused')) { finishItem(item); return; }
    item.start = start; active.add(item);
    if (!frame) frame = requestAnimationFrame(tick);
  };
  new MutationObserver(() => {
    if (!document.body.classList.contains('motion-paused')) return;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    [...active].forEach(finishItem);
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ── IN PRODUCTION intro: plays once on load. ── */
  const intro = document.querySelector('.works-page .intro');
  const title = intro?.querySelector('h1');
  if (intro && title) {
    const lead = intro.querySelector('.lead');
    const body = [...intro.querySelectorAll('p:not(.lead)')];
    const items = [
      [decode(split(title), .72, .26), .05],
      lead && [decode(split(lead), .62, .24), .38],
      body[0] && [wipe(body[0], .6), .82],
      body[1] && [wipe(body[1], .6), 1.0],
      intro.querySelector('.facts') && [wipe(intro.querySelector('.facts'), .5), 1.18],
    ].filter(Boolean);
    intro.classList.add('hd-on');
    let left = items.length;
    const now = performance.now();
    items.forEach(([item, at]) => { item.done = () => { if (!--left) intro.classList.remove('hd-on'); }; run(item, now + at * 1000); });
    return;
  }

  const hero = document.querySelector('.hero');
  const headline = hero?.querySelector('.hero-headline');
  if (!hero || !headline) return;

  /* ── Top hero: waits for the opening film to hand over (ring opening). ── */
  const heroRoot = hero.querySelector('.hero-content');
  const side = hero.querySelector('.hero-content > .flex > :last-child');
  const pill = ['#brand-origin', '#brand-name', '#brand-sub']
    .flatMap(sel => [...(hero.querySelector(sel)?.querySelectorAll('.split-char') || [])]);
  const heroItems = [
    [decode(pill, .62, .22), 0],
    [decode(split(headline), 1.0, .34), .16],
    ...[[hero.querySelector('.hero-introduction'), .78, .62], [side?.querySelector('div'), 1.02, .5], [side?.querySelector('p:last-child'), 1.16, .46]]
      .filter(([el]) => el).map(([el, at, dur]) => [wipe(el, dur), at]),
  ];
  heroRoot?.classList.add('hd-on');
  const playHero = () => {
    if (playHero.done) return;
    playHero.done = true;
    let left = heroItems.length;
    const now = performance.now();
    heroItems.forEach(([item, at]) => { item.done = () => { if (!--left) heroRoot?.classList.remove('hd-on'); }; run(item, now + at * 1000); });
  };
  const body = document.body;
  const ready = () => body.classList.contains('brand-opening-complete') || !body.classList.contains('brand-opening-pending');
  if (ready()) playHero();
  else {
    const observer = new MutationObserver(() => { if (ready()) { observer.disconnect(); playHero(); } });
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    /* Never leave the copy hidden if the film stalls for any reason. */
    window.setTimeout(() => { observer.disconnect(); playHero(); }, 14000);
  }

  /* ── Top sections: calm, whole-block text entrances on scroll. ── */
  const scopes = [...document.querySelectorAll('section:not(.hero), .photo-marquee, .section-flow ~ .mobile-hide')];
  const EXCLUDE = '#form-success, .svc-detail, details > :not(summary)';
  const KINDS = [
    ['resolve', '.bi-collage, .section-founder .rounded-lg'],
    ['trace', '.work-card, .flow-node'],
    ['heading', 'h2, h3'],
    ['text', 'details, .vb-num, .svc-num, .flow-node span, .section-numbers .grid > div > div:first-child, .sec-label, .flow-meta, .tag, .section-numbers [data-reveal] > span, .work-card > div:first-child > span, td, p, li, .work-card > div:last-child, .svc-row .flex-wrap, a.arrow-link, a[href="works.html"], form > div, form > button'],
    ['wipe', '.photo-marquee'],
  ];
  const make = {
    resolve: el => resolve(el, 1.5),
    trace: el => trace(el, el.matches('.flow-node') ? .9 : 1.3),
    heading: el => revealText(el, true),
    text: el => revealText(el),
    wipe: el => wipe(el, .7),
  };
  /* Cards and number boxes keep their own entrance while their contents also play. */
  const OPEN = '.work-card, .flow-node';
  const TEXT = ['heading', 'text'];

  const units = new Map();
  const taken = [];
  const inside = el => taken.some(owner => owner !== el && owner.contains(el) && !owner.matches(OPEN));
  const every = KINDS.map(([, selector]) => selector).join(', ');
  const candidates = scopes.flatMap(scope => [scope, ...scope.querySelectorAll(`${every}, [data-reveal]`)]);
  [...new Set(candidates)].forEach(el => {
    if (el.closest(EXCLUDE) || units.has(el) || inside(el)) return;
    const kind = KINDS.find(([, selector]) => el.matches(selector))?.[0];
    if (!kind) return;
    if (TEXT.includes(kind) && !el.textContent.trim()) return;
    units.set(el, make[kind](el)); taken.push(el);
  });
  /* A [data-reveal] block with nothing to play inside (a divider line) is drawn whole. */
  scopes.flatMap(scope => [...scope.querySelectorAll('[data-reveal]')]).forEach(block => {
    if (block.closest(EXCLUDE) || block.id === 'form-success') return;
    block.classList.add('hd-own');
    if (!units.has(block) && ![...units.keys()].some(el => block.contains(el))) units.set(block, revealText(block));
  });
  if (!units.size) return;

  const order = [...units.keys()];
  const io = new IntersectionObserver(entries => {
    /* Everything that enters together plays in reading order, a beat apart. */
    const entering = entries.filter(entry => entry.isIntersecting).map(entry => entry.target)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const step = Math.min(.07, .9 / Math.max(1, entering.length));
    const now = performance.now();
    entering.forEach((el, i) => { io.unobserve(el); run(units.get(el), now + i * step * 1000); });
  }, { rootMargin: '0px 0px -8% 0px' });
  order.forEach(el => io.observe(el));
})();
