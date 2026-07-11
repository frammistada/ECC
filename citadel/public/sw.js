/* Citadel service worker — push only.
 *
 * Deliberately minimal: no offline caching, no precaching, no fetch
 * handler. Its only jobs are to receive a push and show the notification,
 * and to open the app to the entry screen when the notification is tapped.
 * Keeping it push-only means registering it for reminders adds no caching
 * behavior that could interfere with the rest of the app.
 */

self.addEventListener("install", () => {
  // Take over as soon as it's installed — no waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "Citadel";
  const options = {
    body: data.body || "Something tested you today.",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    // A tag + renotify collapses repeats into one line rather than stacking.
    tag: "citadel-daily-reminder",
    renotify: true,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an already-open Citadel tab if there is one; else open one.
        for (const client of clients) {
          const url = new URL(client.url);
          if (url.pathname === target && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});
