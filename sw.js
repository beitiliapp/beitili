// Service Worker — שבעת הנקיים
const CACHE = 'tahara-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Cache app files
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});

// Push notification received
self.addEventListener('push', e => {
  const data = e.data?.json() || { title:'שבעת הנקיים', body:'תזכורת' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      tag: data.tag || 'tahara',
      renotify: true,
    })
  );
});

// Notification click → open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});

// Scheduled check — runs every hour when SW is active
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_CHECK') checkReminders(e.data.settings);
});

function checkReminders(settings) {
  if (!settings) return;
  const now = new Date();
  const hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

  // Morning check reminder
  if (settings.remindersEnabled && hhmm === settings.morningReminder) {
    self.registration.showNotification('שבעת הנקיים — בדיקת בוקר', {
      body: `זמן לבדיקת בוקר לאחר ${settings.netz||'06:15'} (הנץ)`,
      icon: '/icon-192.png', dir:'rtl', tag:'morning', renotify:true
    });
  }

  // Evening check reminder  
  if (settings.remindersEnabled && hhmm === settings.eveningReminder) {
    self.registration.showNotification('שבעת הנקיים — בדיקה לפני השקיעה', {
      body: `זמן לבדיקה לפני השקיעה (${settings.shkia||'19:09'})`,
      icon: '/icon-192.png', dir:'rtl', tag:'evening', renotify:true
    });
  }

  // Veset reminder
  if (settings.vesetRemindersEnabled && hhmm === (settings.vesetReminder||'08:00')) {
    const data = JSON.parse(localStorage?.getItem('tahara-v3')||'{}');
    // Check if today is a veset day (handled in app)
  }
}

// Handle OneSignal data push — check if reminder is relevant for this user
self.addEventListener('push', e => {
  try {
    const data = e.data?.json();
    if (data?.type === 'reminder') {
      // Read user settings from IndexedDB / cache
      // For now just show the notification — user already agreed to receive
      return; // OneSignal SDK handles display
    }
  } catch(err) {}
});
