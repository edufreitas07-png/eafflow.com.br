// Service worker do painel: instalável, abre rápido e recebe as notificações de venda. Nunca guarda dados da API.
const V = 'vendas-v3';
const ARQ = ['/vendas/', '/vendas/icon-vendas-192.png', '/vendas/badge-vendas-96.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(ARQ)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') e.respondWith(fetch(e.request).catch(() => caches.match('/vendas/')));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil((async () => {
    // Avisa o painel aberto (atualiza a lista na hora) e mostra a notificação do sistema.
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    abertas.forEach((c) => c.postMessage({ tipo: 'venda' }));
    await self.registration.showNotification(d.titulo || 'Nova venda!', {
      body: d.corpo || 'Toque para enviar o acesso.',
      icon: '/vendas/icon-vendas-192.png',
      badge: '/vendas/badge-vendas-96.png',
      tag: d.tag || 'venda',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 400],
      data: { url: d.url || '/vendas/' }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = (e.notification.data && e.notification.data.url) || '/vendas/';
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) { if ('focus' in c) { c.postMessage({ tipo: 'venda' }); return c.focus(); } }
    return self.clients.openWindow(alvo);
  })());
});
