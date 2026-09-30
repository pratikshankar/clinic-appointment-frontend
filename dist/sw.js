/* Clinic Management — Web Push Service Worker
 *
 * This file runs in the background independent of any open tab. The browser
 * keeps it alive so push messages arrive even when the tab is hidden, the
 * phone screen is locked, or the laptop is locked — as long as the browser
 * process is running.
 *
 * iOS/Safari: requires iOS 16.4+ and the app added to the home screen (PWA).
 * Android Chrome, desktop Chrome/Firefox/Edge: works out of the box.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'New notification', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Clinic notification';
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    // A shared tag collapses multiple rapid-fire events into one banner
    // instead of stacking a wall of them.
    tag: 'clinic-notification',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/clinic/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an existing tab if one is open, navigate it to the right page.
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl);
            return;
          }
        }
        // No open tab — open a new one.
        if (clients.openWindow) return clients.openWindow(targetUrl);
      }),
  );
});
