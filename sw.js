// sw.js - Service Worker برای کارکرد آفلاین و قابلیت نصب PWA
const CACHE_NAME = "cafe-pwa-v2";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./manifest-customer.json",
  "./src/js/app.js",
  "./src/js/store.js",
  "./src/js/invoice.js",
  "./src/js/invoices-list.js",
  "./src/js/products.js",
  "./src/js/reports.js",
  "./src/js/customers.js",
  "./src/js/customer-portal.js",
  "./src/js/auth.js",
  "./src/js/backup.js",
  "./src/js/github.js",
  "./src/js/announcements.js",
  "./src/js/price-helper.js",
  "./data/rates.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("برخی فایل‌ها در کش اولیه قرار نگرفتند:", err);
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.url.includes("api.github.com") ||
    event.request.url.includes("goftino.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.method === "GET"
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("./index.html");
          }
        });
      }),
  );
});
