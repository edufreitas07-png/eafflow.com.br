/* EAF Flow - page transitions and reveal animations. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isInternalPageLink(link) {
    if (!link.href || link.target || link.hasAttribute('download')) return false;
    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return false;
    }
    if (url.origin !== window.location.origin) return false;
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return false;
    return url.pathname !== window.location.pathname || url.search !== window.location.search;
  }

  function startPageExit(href) {
    document.body.classList.remove('page-ready');
    window.requestAnimationFrame(function () {
      document.body.classList.add('page-leaving');
      window.setTimeout(function () {
        window.location.assign(href);
      }, 90);
    });
  }

  function setPageReady() {
    document.body.classList.remove('page-leaving');
    document.body.classList.add('page-ready');
  }

  function init() {
    var readyApplied = false;
    function applyReady() {
      if (readyApplied) return;
      readyApplied = true;
      setPageReady();
    }

    window.requestAnimationFrame(function () {
      applyReady();
    });
    window.setTimeout(applyReady, 40);

    if (!reduceMotion) {
      document.querySelectorAll('a[href]').forEach(function (link) {
        link.addEventListener('click', function (event) {
          if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (!isInternalPageLink(link)) return;

          event.preventDefault();
          startPageExit(link.href);
        });
      });
    }

    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    if (window.location.hash) {
      var target = document.querySelector(window.location.hash);
      if (target && target.classList.contains('reveal')) {
        target.classList.add('visible');
      }
    }

    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (section) { section.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(function (section) { observer.observe(section); });
  }

  window.addEventListener('pageshow', function () {
    if (document.body) setPageReady();
  });

  if (document.body) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
