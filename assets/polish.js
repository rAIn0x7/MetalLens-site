/* polish.js — UI/UX micro-interactions (scroll progress + nav elevation).
   Pure progressive enhancement: idempotent, rAF-throttled, passive, no deps.
   Visual styling lives in assets/style.css (.scroll-progress / .nav.is-scrolled). */
(function () {
  if (window.__polishInit) return;
  window.__polishInit = true;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var bar = document.querySelector('.scroll-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'scroll-progress';
      document.body.appendChild(bar);
    }
    var nav = document.querySelector('.nav');
    var ticking = false;

    function update() {
      var st = window.scrollY || document.documentElement.scrollTop || 0;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (st / h) * 100 : 0) + '%';
      if (nav) nav.classList.toggle('is-scrolled', st > 10);
      ticking = false;
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  });
})();
