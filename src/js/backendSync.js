// ============================================================
// Backend Sync — ارتباط و همگام‌سازی فرانت‌اند با سرور Express و MongoDB
// ============================================================

import { api, getApiBaseUrl } from "./api.js";
import { store } from "./store.js";
import { startPushTask } from "./progress-indicator.js";

let isBackendOnline = false;
let isSyncing = false;
let syncDebounceTimer = null;

export function isServerOnline() {
  return isBackendOnline;
}

/**
 * بررسی آنلاین بودن سرور و بروزرسانی نشانگر وضعیت
 */
export async function checkBackendConnection() {
  try {
    const ok = await api.checkHealth();
    isBackendOnline = Boolean(ok);
    updateServerStatusUI(isBackendOnline);
    return isBackendOnline;
  } catch {
    isBackendOnline = false;
    updateServerStatusUI(false);
    return false;
  }
}

/**
 * بروزرسانی نشانگر وضعیت سرور در صفحه
 */
export function updateServerStatusUI(online) {
  const el = document.getElementById("backend-status-indicator");
  if (!el) return;

  if (online) {
    el.innerHTML = `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>دیتابیس ابری (MongoDB)</span>
      </span>
    `;
    el.title = `متصل به سرور بک‌اند: ${getApiBaseUrl()}`;
  } else {
    el.innerHTML = `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>حالت آفلاین (لوکال)</span>
      </span>
    `;
    el.title = "عدم اتصال به سرور بک‌اند — تغییرات در حافظه لوکال ذخیره می‌شوند.";
  }
}

/**
 * ارسال کامل یا تکه‌ای اطلاعات به سرور Express جهت ذخیره در MongoDB
 */
export async function uploadToBackend(title = "همگام‌سازی با سرور", options = {}) {
  // اگر درخواست‌های متوالی آمدند، با debounce ادغام شوند
  if (isSyncing) {
    clearTimeout(syncDebounceTimer);
    return new Promise((resolve) => {
      syncDebounceTimer = setTimeout(async () => {
        resolve(await uploadToBackend(title, options));
      }, 800);
    });
  }

  isSyncing = true;
  let task = null;

  try {
    if (options.showIndicator !== false) {
      task = startPushTask(title, "در حال ارسال به سرور Express...");
    }

    // ۱. بررسی دسترسی به سرور
    const online = await checkBackendConnection();
    if (!online) {
      if (task) task.complete("ذخیره در حافظه محلی (سرور آفلاین) 💾");
      return { ok: false, offline: true, message: "سرور در دسترس نیست؛ داده‌ها در لوکال ذخیره شدند." };
    }

    if (task) task.update(40, "در حال ذخیره‌سازی در پایگاه‌داده MongoDB...");

    // ۲. جمع‌آوری داده‌های فعلی از store
    const bundle = {
      invoices: store.getInvoices(),
      proformas: store.getProformas(),
      products: store.getProducts(),
      productCategories: store.getProductCategories(),
      customers: store.getCustomers(),
      announcements: store.getAnnouncements(),
      shopInfo: store.getShopInfo(),
      services: store.getServices(),
    };

    // ۳. ارسال پکیج کامل به روت /api/sync/import
    const res = await api.sync.importAll(bundle);

    if (task) {
      task.complete("با موفقیت در MongoDB ذخیره شد 🍃");
    }

    return { ok: true, data: res };
  } catch (err) {
    console.warn("[BackendSync] خطا در آپلود به سرور:", err.message);
    if (task) {
      task.complete("ذخیره در حافظه محلی 💾");
    }
    return { ok: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}

/**
 * دریافت و همگام‌سازی آخرین اطلاعات از MongoDB به داخل کلاینت (در شروع برنامه)
 */
export async function downloadFromBackend() {
  try {
    const online = await checkBackendConnection();
    if (!online) return false;

    console.log("🍃 در حال دریافت آخرین داده‌ها از دیتابیس MongoDB...");
    const res = await api.sync.exportAll();

    if (res && res.success && res.data) {
      const d = res.data;

      // همگام‌سازی داده‌ها در حافظه لوکال و رم
      if (Array.isArray(d.invoices) && d.invoices.length > 0) {
        store.saveInvoices(d.invoices);
      }
      if (Array.isArray(d.proformas) && d.proformas.length > 0) {
        store.saveProformas(d.proformas);
      }
      if (Array.isArray(d.products) && d.products.length > 0) {
        store.saveProducts(d.products);
      }
      if (Array.isArray(d.productCategories) && d.productCategories.length > 0) {
        store.saveProductCategories(d.productCategories);
      }
      if (Array.isArray(d.customers) && d.customers.length > 0) {
        store.saveCustomers(d.customers);
      }
      if (Array.isArray(d.announcements) && d.announcements.length > 0) {
        store.setAnnouncements(d.announcements);
      }
      if (d.shopInfo && Object.keys(d.shopInfo).length > 0) {
        store.saveShopInfo(d.shopInfo);
      }

      console.log("✅ کلیه اطلاعات کلاینت با پایگاه‌داده MongoDB همگام شدند.");
      return true;
    }
  } catch (err) {
    console.warn("[BackendSync] خطا در دریافت داده‌ها از سرور:", err.message);
  }
  return false;
}

/**
 * راه‌اندازی مانیتورینگ وضعیت سرور در ابتدای برنامه
 */
export function initBackendSync() {
  checkBackendConnection();

  // بررسی وضعیت اتصال در بازه‌های زمانی ۱ دقیقه‌ای
  setInterval(checkBackendConnection, 60000);

  // بررسی مجدد به محض آنلاین شدن مرورگر
  window.addEventListener("online", () => {
    checkBackendConnection().then((online) => {
      if (online) uploadToBackend("همگام‌سازی مجدد با بازگشت اینترنت");
    });
  });
}
