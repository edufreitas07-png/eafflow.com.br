/* EAF Flow - page transitions and reveal animations. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isInternalPageLink(link) {
    if (!link.href || link.target || link.hasAttribute('download')) return false;
    var url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return url.pathname !== window.location.pathname || url.search !== window.location.search;
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('page-ready');

    if (!reduceMotion) {
      document.querySelectorAll('a[href]').forEach(function (link) {
        link.addEventListener('click', function (event) {
          if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (!isInternalPageLink(link)) return;

          event.preventDefault();
          document.body.classList.add('page-leaving');
          window.setTimeout(function () {
            window.location.href = link.href;
          }, 120);
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
  });
})();
