// ご依頼の流れ：枠が画面に入ったら、線を引いて丸を順に出す（一度出したら戻さない）
(function () {
  var wrap = document.querySelector('#flow .fs-wrap');
  if (!wrap) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    wrap.classList.add('is-in');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { wrap.classList.add('is-in'); io.disconnect(); }
    });
  }, { threshold: 0.35 });
  io.observe(wrap);
})();

// 頼めること：画面に入ったら幕を上げる。カーソルの位置に光をともし、少し傾ける
(function () {
  var sec = document.querySelector('#services.sv-section');
  if (!sec) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    sec.classList.add('is-in');
  } else {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { sec.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(sec);
  }
  if (!matchMedia('(hover: hover)').matches) return;
  var grid = sec.querySelector('.sv-grid');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  sec.querySelectorAll('.sv-card').forEach(function (card) {
    var frame = 0;
    card.addEventListener('pointerenter', function () { card.classList.add('is-hover'); grid.classList.add('has-hover'); });
    card.addEventListener('pointerleave', function () {
      card.classList.remove('is-hover'); grid.classList.remove('has-hover');
      card.style.removeProperty('--rx'); card.style.removeProperty('--ry');
    });
    card.addEventListener('pointermove', function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        if (!still) {
          card.style.setProperty('--ry', ((x - .5) * 7).toFixed(2) + 'deg');
          card.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg');
        }
      });
    });
  });
})();

// 実績欄の背景動画：画面内だけ再生・断られたら<img>で流す・縦長は軽版
(function () {
  var bg = document.querySelector('.section-numbers > .jv-bg');
  if (!bg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var video = bg.querySelector('video');
  var inView = false, still = null, wait = 0;
  function pick() {
    var src = video.getAttribute(bg.clientWidth / bg.clientHeight <= 0.66 ? 'data-src-sp' : 'data-src');
    if (video.getAttribute('src') !== src) { video.src = src; if (still) still.src = src; play(); }
  }
  pick();
  addEventListener('resize', pick);
  function showStill() {
    if (still || !inView || !video.paused) return;
    still = new Image();
    still.alt = '';
    still.onerror = function () { still.remove(); };
    still.src = video.currentSrc || video.src;
    bg.insertBefore(still, video.nextSibling);
  }
  function play() {
    if (!inView || !video.paused) return;
    bg.classList.add('is-on');
    var p = video.play();
    if (p && p.catch) p.catch(showStill);
    clearTimeout(wait);
    wait = setTimeout(showStill, 2500);
  }
  video.addEventListener('playing', function () {
    clearTimeout(wait);
    if (still) { still.remove(); still = null; }
  });
  ['touchend', 'click', 'keydown'].forEach(function (t) {
    document.addEventListener(t, play, true);
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) play(); });
  addEventListener('pageshow', play);
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView) play();
    else { clearTimeout(wait); video.pause(); }
  }, { threshold: 0.15 }).observe(bg);
})();
