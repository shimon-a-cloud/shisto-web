/* Section motion is deliberately event-driven: there is no perpetual page-level frame loop. */
(() => {
  'use strict';

  const start = () => {
    const body = document.body;
    if (!body) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sections = [
      document.querySelector('.section-services'),
      document.querySelector('#contact')
    ].filter(Boolean);
    const sculptures = [];
    const visible = new WeakMap();
    let scrollFrame = 0;
    let fallbackControl = false;
    let resetAllTilt = () => {};
    let resetSectionProgress = () => {};
    let scheduleProgress = () => {};

    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    const makeSculpture = section => {
      const intro = section.querySelector(':scope > div > div:first-child');
      if (!intro || intro.querySelector(':scope > .section-sculpture')) return;

      const sculpture = document.createElement('div');
      sculpture.className = 'section-sculpture';
      sculpture.setAttribute('aria-hidden', 'true');
      const orbit = document.createElement('div');
      orbit.className = 'sculpture-orbit';
      for (let index = 0; index < 5; index += 1) orbit.append(document.createElement('i'));
      sculpture.append(orbit);
      intro.append(sculpture);
      sculptures.push({ section, sculpture });
    };

    sections.forEach(makeSculpture);

    const setControlCopy = control => {
      const paused = control.getAttribute('aria-pressed') === 'true';
      control.setAttribute('aria-label', paused ? '立体演出を再生する' : '立体演出を停止する');
      control.textContent = paused ? 'MOTION OFF' : 'MOTION ON';
    };

    const pageIsPaused = () => reduced.matches || body.classList.contains('motion-paused');

    const syncRunning = () => {
      const hidden = document.hidden;
      body.classList.toggle('page-hidden', hidden);
      const paused = pageIsPaused();
      sculptures.forEach(({ section, sculpture }) => {
        const isVisible = visible.get(section) === true;
        sculpture.classList.toggle('running', isVisible && !paused && !hidden);
      });
    };

    const setMotionState = control => {
      const pressed = control && control.getAttribute('aria-pressed') === 'true';
      body.classList.toggle('motion-paused', reduced.matches || pressed);
      if (reduced.matches || pressed) {
        resetAllTilt();
        resetSectionProgress();
      } else {
        scheduleProgress();
      }
      syncRunning();
    };

    const createPageControl = (pressed = 'false') => {
      const pageControl = document.createElement('button');
      pageControl.type = 'button';
      pageControl.className = 'sculpture-motion-control';
      pageControl.setAttribute('aria-pressed', pressed);
      pageControl.addEventListener('click', () => {
        if (reduced.matches) return;
        pageControl.setAttribute('aria-pressed', String(pageControl.getAttribute('aria-pressed') !== 'true'));
      });
      return pageControl;
    };

    const findOrCreateControl = () => {
      let control = document.querySelector('.sculpture-motion-control');
      if (control) {
        /* The hero has overflow isolation; the single global control must not be clipped there. */
        if (control.parentElement !== body) body.append(control);
      } else {
        fallbackControl = true;
        control = createPageControl();
        body.append(control);
      }
      return control;
    };

    let control = findOrCreateControl();
    let controlObserver;
    const refreshControl = () => {
      if (fallbackControl) {
        if (control.hidden !== reduced.matches) control.hidden = reduced.matches;
        if (reduced.matches && control.getAttribute('aria-pressed') !== 'true') {
          control.setAttribute('aria-pressed', 'true');
        }
      }
      setControlCopy(control);
      setMotionState(control);
    };

    const observeControl = () => {
      controlObserver?.disconnect();
      controlObserver = new MutationObserver(() => {
        /* home-3d hides its own button after WebGL context loss; leave that renderer stopped
           and replace only the page-wide control so the CSS motion remains controllable. */
        if (!fallbackControl && !reduced.matches && control.hidden) {
          fallbackControl = true;
          const pageControl = createPageControl(control.getAttribute('aria-pressed') || 'false');
          control.replaceWith(pageControl);
          control = pageControl;
          observeControl();
          refreshControl();
          return;
        }
        refreshControl();
      });
      controlObserver.observe(control, {
        attributes: true,
        attributeFilter: ['aria-pressed', 'hidden']
      });
    };
    observeControl();
    refreshControl();

    const setProgress = value => {
      sections.forEach(section => section.style.setProperty('--section-progress', value));
    };
    resetSectionProgress = () => setProgress('0');
    const updateProgress = () => {
      scrollFrame = 0;
      if (pageIsPaused() || document.hidden) {
        resetSectionProgress();
        return;
      }
      const viewport = Math.max(window.innerHeight, 1);
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const progress = clamp((viewport - rect.top) / (viewport + rect.height), 0, 1);
        section.style.setProperty('--section-progress', progress.toFixed(4));
      });
    };
    const requestProgress = () => {
      if (pageIsPaused() || document.hidden) {
        resetSectionProgress();
        return;
      }
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
    };
    scheduleProgress = requestProgress;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const inView = entry.isIntersecting && entry.intersectionRatio > 0;
          visible.set(entry.target, inView);
          entry.target.classList.toggle('immersive-visible', inView);
        });
        syncRunning();
        requestProgress();
      }, { threshold: [0, .001] });
      sections.forEach(section => observer.observe(section));
    } else {
      const updateVisibility = () => {
        const viewport = window.innerHeight;
        sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const isVisible = rect.bottom > 0 && rect.top < viewport;
          visible.set(section, isVisible);
          section.classList.toggle('immersive-visible', isVisible);
        });
        syncRunning();
      };
      updateVisibility();
      window.addEventListener('scroll', updateVisibility, { passive: true });
      window.addEventListener('resize', updateVisibility, { passive: true });
    }

    const tiltTargets = [
      ...document.querySelectorAll('.work-card, .bi-collage, .section-founder .rounded-lg')
    ];
    const resetTilt = target => {
      target.style.setProperty('--tilt-x', '0deg');
      target.style.setProperty('--tilt-y', '0deg');
      target.style.setProperty('--pointer-x', '50%');
      target.style.setProperty('--pointer-y', '50%');
    };
    tiltTargets.forEach(target => {
      resetTilt(target);
      target.addEventListener('pointermove', event => {
        if (!finePointer.matches || event.pointerType !== 'mouse' || pageIsPaused() || document.hidden) return;
        const rect = target.getBoundingClientRect();
        const x = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        const y = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
        target.style.setProperty('--pointer-x', `${(x * 100).toFixed(2)}%`);
        target.style.setProperty('--pointer-y', `${(y * 100).toFixed(2)}%`);
        target.style.setProperty('--tilt-x', `${((0.5 - y) * 5).toFixed(2)}deg`);
        target.style.setProperty('--tilt-y', `${((x - 0.5) * 5).toFixed(2)}deg`);
      }, { passive: true });
      target.addEventListener('pointerleave', () => resetTilt(target), { passive: true });
    });
    resetAllTilt = () => tiltTargets.forEach(resetTilt);

    const syncServiceRows = () => {
      document.querySelectorAll('.svc-row').forEach((row, index) => {
        const detail = row.parentElement && row.parentElement.querySelector(':scope > .svc-detail');
        if (!detail) return;
        if (!detail.id) detail.id = `service-detail-${index + 1}`;
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        row.setAttribute('aria-controls', detail.id);
        row.setAttribute('aria-expanded', String(row.classList.contains('active')));
      });
    };
    const serviceRows = [...document.querySelectorAll('.svc-row')];
    syncServiceRows();
    serviceRows.forEach(row => {
      row.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        row.click(); // Existing inline toggle stays the sole state-changing handler.
      });
      row.addEventListener('click', syncServiceRows);
      new MutationObserver(syncServiceRows).observe(row, {
        attributes: true,
        attributeFilter: ['class']
      });
    });

    const onReducedChange = () => {
      if (fallbackControl && !reduced.matches) control.setAttribute('aria-pressed', 'false');
      refreshControl();
      resetAllTilt();
      requestProgress();
    };
    reduced.addEventListener?.('change', onReducedChange);
    document.addEventListener('visibilitychange', () => {
      syncRunning();
      requestProgress();
    });
    window.addEventListener('scroll', requestProgress, { passive: true });
    window.addEventListener('resize', requestProgress, { passive: true });
    requestProgress();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
