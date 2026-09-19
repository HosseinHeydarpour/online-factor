const CACHE_VERSION = "cafe-pwa-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/src/js/app.js",
  "/src/js/store.js",
  "/src/js/invoice.js",
  "/src/js/products.js",
  "/src/js/invoices-list.js",
  "/src/js/reports.js",
  "/src/js/auth.js",
  "/src/js/backup.js",
  "/src/js/github.js",
  "/data/rates.js",
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css",
  "https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css",
  "https://npmcdn.com/flatpickr/dist/themes/light.css",
  "https://cdn.jsdelivr.net/npm/flatpickr",
  "https://code.jquery.com/jquery-3.7.1.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/persian-date@1.1.0/dist/persian-date.min.js",
  "https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/js/persian-datepicker.min.js",
  "https://cdn.jsdelivr.net/npm/persian-datepicker@1.2.0/dist/css/persian-datepicker.min.css",
  "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js",
];

/* ---------- نصب: پیش‌کش کردن دارایی‌های اصلی ---------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // کش کردن به‌صورت امن: اگر یک فایل ۴۰۴ شد بقیه نصب متوقف نشود
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("[SW] نتوانست کش کند:", url, err);
        }
      }
      return self.skipWaiting();
    }),
  );
});

/* ---------- فعال‌سازی: حذف کش‌های قدیمی ---------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      );
      return self.clients.claim();
    })(),
  );
});

/* ---------- دریافت درخواست‌ها ---------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // فقط GET را مدیریت می‌کنیم
  if (request.method !== "GET") return;

  // API گیت‌هاب و درخواست‌های داینامیک → فقط شبکه
  if (request.url.includes("api.github.com")) return;

  // CDN های خارجی → Network-first (اگر نت نبود، از کش بده)
  if (
    request.url.includes("cdn.jsdelivr.net") ||
    request.url.includes("code.jquery.com") ||
    request.url.includes("npmcdn.com") ||
    request.url.includes("cdn.tailwindcss.com") ||
    request.url.includes("rastikerdar")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        try {
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          return new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // سایر فایل‌های محلی → Stale-while-revalidate (سریع + به‌روز)
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);

      return cached || (await fetchPromise);
    })(),
  );
});
