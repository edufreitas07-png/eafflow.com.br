/* EAF Flow - reveal animations. */
(function () {
  'use strict';

  function init() {
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

  if (document.body) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
