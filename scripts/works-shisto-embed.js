/* Work 17 reuses the current homepage as a live, contained preview. */
(() => {
  'use strict';
  const item = document.querySelector('.work-shisto-current');
  const stage = item?.querySelector('.work-shisto-stage');
  const frame = stage?.querySelector('iframe');
  if (!frame) return;

  const wide = matchMedia('(hover: hover) and (min-width: 1100px)');
  const targetPath = new URL(frame.dataset.src, location.href).pathname;
  let active = false;
  let freezeTimer = 0;
  let serial = 0;

  const resize = () => {
    const width = stage.getBoundingClientRect().width;
    if (width) stage.style.setProperty('--work-shisto-scale', String(width / 1280));
  };
  const start = () => {
    if (active) return;
    active = true;
    resize();
    frame.src = `${frame.dataset.src}?work17=${++serial}`;
  };
  const stop = () => {
    if (!active) return;
    active = false;
    clearTimeout(freezeTimer);
    frame.src = 'about:blank';
  };
  const sync = () => {
    if (wide.matches ? item.matches(':hover, :focus-within') : item.classList.contains('open')) start();
    else stop();
  };

  frame.addEventListener('load', () => {
    if (!active) return;
    let doc;
    try {
      if (frame.contentWindow.location.pathname !== targetPath) return;
      doc = frame.contentDocument;
    } catch (_) { return; }
    if (!doc) return;
    doc.documentElement.style.overflow = 'hidden';
    doc.body.style.overflow = 'hidden';
    const style = doc.createElement('style');
    style.textContent = '#header,.sculpture-motion-control{display:none!important}';
    doc.head.append(style);
    clearTimeout(freezeTimer);
    freezeTimer = setTimeout(() => {
      const control = doc.querySelector('.sculpture-motion-control');
      if (control?.getAttribute('aria-pressed') === 'false') control.click();
    }, 11500);
  });

  item.addEventListener('mouseenter', sync);
  item.addEventListener('mouseleave', sync);
  item.addEventListener('focusin', sync);
  item.addEventListener('focusout', () => setTimeout(sync, 0));
  item.querySelector('.r').addEventListener('click', () => setTimeout(sync, 0));
  wide.addEventListener?.('change', sync);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
})();
