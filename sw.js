const CACHE = 'beitili-v1';

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

// Handle push — check user settings and show if time matches
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch(err) {}

  const slot   = data.slot || '';
  const silent = data.silent || false;

  if (!silent) {
    // Regular notification — show directly
    e.waitUntil(
      self.registration.showNotification(data.title || 'ביתילי', {
        body: data.body || '',
        icon: '/icon-192.png',
        dir: 'rtl',
        lang: 'he',
        tag: 'beitili',
      })
    );
    return;
  }

  // Silent tick — check user settings from IndexedDB/localStorage via client
  e.waitUntil(
    clients.matchAll({ type:'window' }).then(async cls => {
      // Get settings from any open client
      if (cls.length > 0) {
        return new Promise(resolve => {
          const mc = new MessageChannel();
          mc.port1.onmessage = evt => {
            checkAndNotify(slot, evt.data);
            resolve();
          };
          cls[0].postMessage({ type:'GET_SETTINGS' }, [mc.port2]);
        });
      } else {
        // No open client — try cache
        const cache = await caches.open(CACHE);
        const res   = await cache.match('/settings');
        if (res) {
          const settings = await res.json();
          checkAndNotify(slot, settings);
        }
      }
    })
  );
});

function checkAndNotify(slot, settings) {
  if (!settings) return;
  const show = (enabled, time, title, body) => {
    if (enabled && time === slot) {
      self.registration.showNotification(title, {
        body, icon:'/icon-192.png', dir:'rtl', lang:'he',
        tag: title, renotify: true,
      });
    }
  };
  show(settings.remindersEnabled,      settings.morningReminder || '07:00', 'ביתילי — בדיקת בוקר',           `זמן לבדיקת בוקר לאחר ${settings.netz||'06:15'} 🌅`);
  show(settings.remindersEnabled,      settings.eveningReminder || '19:00', 'ביתילי — בדיקה לפני השקיעה',    `זמן לבדיקה לפני השקיעה (${settings.shkia||'19:09'}) 🌇`);
  show(settings.vesetRemindersEnabled, settings.vesetReminder   || '08:00', 'ביתילי — תזכורת וסתות',          'בדקי אם יש וסת צפוי היום 📅');
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});

// Listen for settings updates from app
self.addEventListener('message', e => {
  if (e.data?.type === 'SAVE_SETTINGS') {
    caches.open(CACHE).then(c => {
      const res = new Response(JSON.stringify(e.data.settings), {headers:{'Content-Type':'application/json'}});
      c.put('/settings', res);
    });
  }
});
