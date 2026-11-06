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

  /* ---------- Movimento na rolagem (site inteiro) ---------- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initScrollMotion() {
    if (reduceMotion) return;
    var root = document.documentElement;
    root.classList.add('has-motion');

    // barra de progresso no topo + header com sombra ao rolar
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var header = document.querySelector('.site-header');
    var mockup = document.querySelector('.hero-visual .dashboard-mockup');
    var ticking = false;

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      if (header) header.classList.toggle('is-scrolled', y > 8);
      if (mockup && y < window.innerHeight * 1.2) {
        mockup.style.setProperty('--mock-y', (y * -0.06).toFixed(1) + 'px');
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    // cartões e blocos entram em sequência
    var selector = '.solution-card, .flow-card, .inside-card, .process-step, .faq-item, .product-card, .service-card, .section-heading, .label, .title, .services-title, .product-features li, .service-features li';
    var items = [].slice.call(document.querySelectorAll(selector)).filter(function (el) {
      return !el.closest('.cinema');
    });
    items.forEach(function (el) {
      var siblings = el.parentElement ? [].slice.call(el.parentElement.children).filter(function (s) { return s.matches(selector); }) : [el];
      el.style.setProperty('--stagger', Math.max(0, siblings.indexOf(el)) * 70 + 'ms');
      el.classList.add('stagger-item');
    });
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  function init() {
    initReveals(document);
    initNavToggle();
    initScrollMotion();
  }

  if (document.body) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
