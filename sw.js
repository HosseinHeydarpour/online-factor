// sw.js - Service Worker برای کارکرد آفلاین و قابلیت نصب PWA
const CACHE_NAME = "cafe-pwa-v1";

// فایل‌های اصلی که در اولین اجرا در کش ذخیره می‌شوند
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
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
  "./data/rates.js",
];

// اضافه کردن اسکریپت وب‌پوش نجوا به سرویس ورکر PWA
try {
  importScripts(
    "https://static.najva.com/static/js/scripts/najva-service-worker.js",
  );
} catch (e) {
  console.warn("نجوا در حالت آفلاین لود نشد:", e);
}

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./manifest-customer.json",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

// مرحله ۱: نصب و ذخیره دارایی‌های استاتیک
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

// مرحله ۲: فعال‌سازی و پاک‌سازی نسخه‌های قدیمی کش
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

// مرحله ۳: رویداد Fetch (استراتژی Network First: اولویت اینترنت، در صورت آفلاین بودن خواندن از کش)
self.addEventListener("fetch", (event) => {
  if (
    event.request.url.includes("api.github.com") ||
    event.request.url.includes("goftino.com")
  ) {
    return;
  }

  // عدم کش کردن درخواست‌های مستقیم به API گیت‌هاب
  if (event.request.url.includes("api.github.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // در صورت دریافت پاسخ موفق، کش را آپدیت کن
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
        // در صورت نبود اینترنت، فایل را از کش بخوان
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // اگر صفحه HTML درخواست شده بود به index.html هدایت کن
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("./index.html");
          }
        });
      }),
  );
});
