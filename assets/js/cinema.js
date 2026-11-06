/* EAF Flow — cinema.js
   Vídeo controlado pela rolagem: o celular fica fixo e o app avança
   (ou volta) conforme a página é rolada. Os capítulos de texto trocam
   conforme o tempo do vídeo. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function init(section) {
    var track = section.querySelector('.cinema-track');
    var stage = section.querySelector('.cinema-stage');
    var video = section.querySelector('video');
    var phone = section.querySelector('.cinema-phone');
    var chapters = [].slice.call(section.querySelectorAll('.cinema-chapter'));
    var dots = [].slice.call(section.querySelectorAll('.cinema-dots span i'));
    if (!track || !video) return;

    var loaded = false;
    function load() {
      if (loaded) return;
      loaded = true;
      video.preload = 'auto';
      video.src = video.getAttribute('data-src');
      video.load();
    }

    // Só define a altura da pista quando há rolagem animada.
    // (Com "reduzir movimento" a pista fica automática, senão sobra um vazio.)
    var length = parseFloat(section.getAttribute('data-length')) || 420;
    var narrow = window.matchMedia('(max-width: 860px)');
    function applyLength() {
      track.style.height = (narrow.matches ? Math.min(length, 360) : length) + 'vh';
    }

    if (reduce) {
      section.classList.add('no-scrub');
      load();
      video.controls = true;
      video.loop = true;
      chapters.forEach(function (c) { c.classList.add('is-active'); });
      return;
    }

    applyLength();
    window.addEventListener('resize', applyLength);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) load();
      }, { rootMargin: '1200px 0px' }).observe(section);
    } else {
      load();
    }

    var current = 0;      // tempo exibido (suavizado)
    var target = 0;       // tempo alvo vindo da rolagem
    var progress = 0;
    var running = false;
    var lastSet = -1;
    var activeIdx = -1;

    function readScroll() {
      var rect = track.getBoundingClientRect();
      var hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 68;
      var total = track.offsetHeight - (window.innerHeight - hh);
      progress = total > 0 ? clamp((hh - rect.top) / total, 0, 1) : 0;
      var d = video.duration || parseFloat(video.getAttribute('data-duration')) || 0;
      target = clamp(progress / 0.94, 0, 1) * d;  // segura o último quadro no fim
      if (!running) { running = true; requestAnimationFrame(tick); }
    }

    function setChapter(t) {
      var idx = 0;
      for (var i = 0; i < chapters.length; i++) {
        var s = parseFloat(chapters[i].getAttribute('data-start'));
        if (t >= s) idx = i;
      }
      if (idx !== activeIdx) {
        activeIdx = idx;
        chapters.forEach(function (c, i) { c.classList.toggle('is-active', i === idx); });
        section.setAttribute('data-chapter', String(idx));
      }
      dots.forEach(function (bar, i) {
        var s = parseFloat(chapters[i].getAttribute('data-start'));
        var e = parseFloat(chapters[i].getAttribute('data-end'));
        bar.style.width = (clamp((t - s) / (e - s), 0, 1) * 100).toFixed(1) + '%';
      });
    }

    function tick() {
      var diff = target - current;
      current += diff * 0.14;
      if (Math.abs(diff) < 0.015) current = target;

      if (video.readyState >= 1 && Math.abs(current - lastSet) > 0.03) {
        try { video.currentTime = current; lastSet = current; } catch (e) {}
      }
      setChapter(current);

      // celular entra "inclinado" e se alinha ao longo da rolagem
      if (phone) {
        var enter = clamp(progress / 0.12, 0, 1);
        var leave = clamp((progress - 0.9) / 0.1, 0, 1);
        phone.style.setProperty('--phone-ry', (-10 * (1 - enter) + 8 * leave).toFixed(2) + 'deg');
        phone.style.setProperty('--phone-rx', (3 * (1 - enter)).toFixed(2) + 'deg');
        phone.style.setProperty('--phone-s', (0.94 + 0.06 * enter - 0.04 * leave).toFixed(3));
        phone.style.setProperty('--phone-y', (30 * (1 - enter) - 24 * leave).toFixed(1) + 'px');
      }

      if (Math.abs(target - current) > 0.001) {
        requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    video.addEventListener('loadedmetadata', function () {
      video.pause();
      readScroll();
    });
    window.addEventListener('scroll', readScroll, { passive: true });
    window.addEventListener('resize', readScroll);
    readScroll();
    setChapter(0);
  }

  function boot() {
    [].slice.call(document.querySelectorAll('.cinema')).forEach(init);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
