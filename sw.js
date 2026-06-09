const CACHE = 'beitili-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => r))
  );
});
self.addEventListener('push', e => {
  try {
    const data = e.data?.json() || {};
    if (data.silent) return;
    e.waitUntil(self.registration.showNotification(data.title || 'ביתילי', {
      body: data.body || '', icon: '/icon-192.png', dir: 'rtl', lang: 'he', tag: 'beitili',
    }));
  } catch(err) {}
});
self.addEventListener('message', e => {
  if (e.data?.type === 'GET_SETTINGS') {
    try {
      const raw = e.data.raw || '';
      const settings = raw ? JSON.parse(raw).settings : null;
      e.ports[0].postMessage(settings);
    } catch(err) { e.ports[0].postMessage(null); }
  }
  if (e.data?.type === 'SAVE_SETTINGS') {
    caches.open(CACHE).then(c => {
      c.put('/settings', new Response(JSON.stringify(e.data.settings), {headers:{'Content-Type':'application/json'}}));
    });
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
