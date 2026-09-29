/* Accessible motion control for the works page's shared section-depth canvas. */
(() => {
  'use strict';

  const start = () => {
    const body = document.body;
    if (!body || !body.classList.contains('works-page')) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'works-motion-control';
    control.setAttribute('aria-pressed', 'false');
    control.hidden = true;
    let paused = false;

    const update = () => {
      const stopped = reduced.matches || paused;
      body.classList.toggle('motion-paused', stopped);
      control.setAttribute('aria-pressed', String(stopped));
      control.disabled = reduced.matches;
      control.textContent = reduced.matches
        ? '動きを減らす設定中'
        : stopped ? '動きを再開' : '動きを止める';
    };

    control.addEventListener('click', () => {
      if (reduced.matches) return;
      paused = !paused;
      update();
    });
    reduced.addEventListener?.('change', update);
    body.append(control);
    const syncCanvasControl = () => {
      control.hidden = !body.classList.contains('section-depth-ready');
    };
    new MutationObserver(syncCanvasControl).observe(body, {
      attributes: true,
      attributeFilter: ['class']
    });
    syncCanvasControl();
    update();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
