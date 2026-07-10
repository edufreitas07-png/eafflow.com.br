/* EAF Flow - main reveal animations and lightweight page navigation. */
(function () {
  'use strict';

  var parser = new DOMParser();
  var activeObserver = null;
  var isNavigating = false;

  function initReveals(root) {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }

    var scope = root || document;
    var reveals = scope.querySelectorAll('.reveal');
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

    activeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    reveals.forEach(function (section) { activeObserver.observe(section); });
  }

  function getNormalizedPath(url) {
    var path = url.pathname;
    return path.endsWith('/index.html') ? path.replace(/index\.html$/, '') : path;
  }

  function shouldNavigate(link, event) {
    if (!link || !link.href || link.target || link.hasAttribute('download')) return false;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (!/^https?:$/.test(url.protocol)) return false;
    if (getNormalizedPath(url) === getNormalizedPath(window.location) && url.search === window.location.search) return false;
    return true;
  }

  function isSamePageHashLink(link, event) {
    if (!link || !link.href || link.target || link.hasAttribute('download')) return false;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return false;
    }

    return url.origin === window.location.origin &&
      url.hash &&
      getNormalizedPath(url) === getNormalizedPath(window.location) &&
      url.search === window.location.search;
  }

  function getEventLink(event) {
    if (!event.target) return null;
    if (event.target.closest) return event.target.closest('a[href]');
    if (event.target.parentElement && event.target.parentElement.closest) {
      return event.target.parentElement.closest('a[href]');
    }
    return null;
  }

  function updateMeta(name, content) {
    var current = document.querySelector('meta[name="' + name + '"]');
    if (!content) {
      if (current) current.remove();
      return;
    }

    if (!current) {
      current = document.createElement('meta');
      current.setAttribute('name', name);
      document.head.appendChild(current);
    }
    current.setAttribute('content', content);
  }

  function updateCanonical(href) {
    var current = document.querySelector('link[rel="canonical"]');
    if (!href) {
      if (current) current.remove();
      return;
    }

    if (!current) {
      current = document.createElement('link');
      current.setAttribute('rel', 'canonical');
      document.head.appendChild(current);
    }
    current.setAttribute('href', href);
  }

  function updateActiveNav(url) {
    var targetPath = getNormalizedPath(url);

    document.querySelectorAll('.main-nav a').forEach(function (link) {
      var linkUrl;
      try {
        linkUrl = new URL(link.href, window.location.href);
      } catch (error) {
        link.classList.remove('active');
        return;
      }

      var isActive = linkUrl.origin === window.location.origin && getNormalizedPath(linkUrl) === targetPath;
      link.classList.toggle('active', isActive);
    });
  }

  function applyDocument(nextDocument, url) {
    var nextMain = nextDocument.querySelector('main');
    var currentMain = document.querySelector('main');
    if (!nextMain || !currentMain) return false;

    var nextDescription = nextDocument.querySelector('meta[name="description"]');
    var nextCanonical = nextDocument.querySelector('link[rel="canonical"]');

    document.title = nextDocument.title || document.title;
    updateMeta('description', nextDescription ? nextDescription.getAttribute('content') : '');
    updateCanonical(nextCanonical ? nextCanonical.getAttribute('href') : '');
    var nextBodyClass = nextDocument.body ? nextDocument.body.className : document.body.className;
    document.body.className = (nextBodyClass + ' is-navigating').trim();
    currentMain.replaceWith(nextMain);
    updateActiveNav(url);
    initReveals(nextMain);
    return true;
  }

  function scrollForUrl(url) {
    if (!url.hash) {
      window.scrollTo(0, 0);
      return;
    }

    scrollToHash(url.hash);
  }

  function scrollToHash(hash) {
    if (!hash) return;
    var target = document.querySelector(hash);
    if (target) target.scrollIntoView();
  }

  function fetchPage(url) {
    return fetch(url.href, {
      headers: { 'X-Requested-With': 'fetch' },
      credentials: 'same-origin'
    }).then(function (response) {
      if (!response.ok) throw new Error('Navigation failed');
      return response.text();
    }).then(function (html) {
      return parser.parseFromString(html, 'text/html');
    });
  }

  function navigateTo(url, options) {
    if (isNavigating) return Promise.resolve(false);
    isNavigating = true;
    document.body.classList.add('is-navigating');

    return fetchPage(url).then(function (nextDocument) {
      if (!applyDocument(nextDocument, url)) throw new Error('Missing main');
      if (!options || !options.replace) history.pushState({}, '', url.href);
      scrollForUrl(url);
      window.requestAnimationFrame(function () {
        document.body.classList.remove('is-navigating');
      });
      return true;
    }).catch(function () {
      document.body.classList.remove('is-navigating');
      return false;
    }).finally(function () {
      isNavigating = false;
    });
  }

  function onClick(event) {
    var link = getEventLink(event);
    if (isSamePageHashLink(link, event)) {
      scrollToHash(new URL(link.href, window.location.href).hash);
      return;
    }

    if (!shouldNavigate(link, event)) return;

    var url = new URL(link.href, window.location.href);
    event.preventDefault();
    navigateTo(url).then(function (handled) {
      if (!handled) window.location.href = url.href;
    });
  }

  function onPopState() {
    navigateTo(new URL(window.location.href), { replace: true });
  }

  function init() {
    initReveals(document);
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', function () {
      scrollToHash(window.location.hash);
    });
    updateActiveNav(new URL(window.location.href));
    document.documentElement.classList.add('pjax-ready');
  }

  if (document.body) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
