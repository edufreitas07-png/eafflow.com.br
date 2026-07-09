/* =========================================================
   EAF Flow — main.js
   Interações gerais da interface (sem rastreamento).
   Sistema simples de abas de navegação e revelação de
   seções ao rolar a página.
   ========================================================= */

(function () {
  'use strict';

  /* Marca a aba de navegação ativa ao clicar */
  function setTab(el) {
    document.querySelectorAll('.nav-tab').forEach(function (t) {
      t.classList.remove('active');
    });
    el.classList.add('active');
  }
  window.setTab = setTab;

  /* Revela seções com a classe .reveal conforme entram na tela */
  document.addEventListener('DOMContentLoaded', function () {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (r) { r.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(function (r) { observer.observe(r); });
  });
})();
