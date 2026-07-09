/* =========================================================
   EAF Flow — analytics.js
   Google Analytics (GA4) + Meta Pixel + eventos de rastreamento
   Mantido idêntico ao comportamento original do site.
   ========================================================= */

/* ---------- Meta Pixel ---------- */
!function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
  t = b.createElement(e); t.async = !0; t.src = v;
  s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
}(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '1674671890520272');
fbq('track', 'PageView');

/* ---------- Google Analytics (gtag.js) ---------- */
(function () {
  var gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-FGT2HWFFMR';
  document.head.appendChild(gaScript);
})();

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-FGT2HWFFMR');
