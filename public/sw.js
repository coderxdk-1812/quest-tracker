/* Questify Web Push service worker */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Questify', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Questify';
  const options = {
    body: data.body || '',
    icon: data.icon || '/placeholder.svg',
    badge: data.badge || '/placeholder.svg',
    tag: data.tag || undefined,
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ('navigate' in client) {
              try { await client.navigate(targetUrl); } catch {}
            }
            return;
          }
        } catch {}
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
