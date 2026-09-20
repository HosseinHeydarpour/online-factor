// sw.js - Service Worker برای کارکرد ۱۰۰٪ آفلاین و قابلیت نصب PWA با سرعت حداکثری
const CACHE_NAME = "cafe-pwa-v3";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./manifest-customer.json",
  "./assets/css/tailwind.css",
  "./assets/vendor/vazirmatn/Vazirmatn-font-face.css",
  "./assets/vendor/vazirmatn/fonts/webfonts/Vazirmatn-Regular.woff2",
  "./assets/vendor/vazirmatn/fonts/webfonts/Vazirmatn-Bold.woff2",
  "./assets/vendor/vazirmatn/fonts/webfonts/Vazirmatn-Medium.woff2",
  "./assets/vendor/vazirmatn/fonts/webfonts/Vazirmatn-SemiBold.woff2",
  "./assets/vendor/jquery.min.js",
  "./assets/vendor/persian-date/persian-date.min.js",
  "./assets/vendor/persian-datepicker/persian-datepicker.min.js",
  "./assets/vendor/persian-datepicker/persian-datepicker.min.css",
  "./assets/vendor/chart.umd.min.js",
  "./assets/vendor/quill/quill.js",
  "./assets/vendor/quill/quill.snow.css",
  "./assets/vendor/qrcode.min.js",
  "./assets/vendor/xlsx.full.min.js",
  "./src/js/app.js",
  "./src/js/store.js",
  "./src/js/invoice.js",
  "./src/js/invoices-list.js",
  "./src/js/products.js",
  "./src/js/reports.js",
  "./src/js/customers.js",
  "./src/js/customer-portal.js",
  "./src/js/nice-select.js",
  "./src/js/progress-indicator.js",
  "./src/js/auth.js",
  "./src/js/backup.js",
  "./src/js/github.js",
  "./src/js/announcements.js",
  "./src/js/price-helper.js",
  "./src/data/rates.js",
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

  // استراتژی کش بهینه: برای فایل‌های استاتیک محلی ابتدا کش، برای داده‌های json استراتژی شبکه با فال‌بک به کش
  const isDataJson = event.request.url.includes("/data/") && event.request.url.endsWith(".json");

  if (isDataJson) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // بازگشت آنی فایل از کش در کمتر از ۱۰ میلی‌ثانیه
        return cachedResponse;
      }
      return fetch(event.request)
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
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("./index.html");
          }
        });
    }),
  );
});
