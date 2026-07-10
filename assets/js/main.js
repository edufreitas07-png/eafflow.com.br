/* EAF Flow - reveal animations e menu mobile.
   Navegacao interna e nativa: nenhum clique em link e interceptado. */
(function () {
  'use strict';

  var activeObserver = null;

  function initReveals(root) {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }

    var scope = root || document;
    var reveals = scope.querySelectorAll('.reveal');
    if (!reveals.length) return;

    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (section) { section.classList.add('visible'); });
      return;
    }

    activeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(function (section) { activeObserver.observe(section); });
  }

  /* ---------- Menu mobile (hamburguer) ---------- */
  function initNavToggle() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;

    function isOpen() {
      return nav.classList.contains('is-open');
    }

    function openMenu() {
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fechar menu');
      document.body.classList.add('nav-open');
    }

    function closeMenu() {
      if (!isOpen()) return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu');
      document.body.classList.remove('nav-open');
    }

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      if (isOpen()) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    nav.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      if (link) closeMenu();
    });

    document.addEventListener('click', function (event) {
      if (!isOpen()) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' || event.key === 'Esc') closeMenu();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  function init() {
    initReveals(document);
    initNavToggle();
  }

  if (document.body) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
