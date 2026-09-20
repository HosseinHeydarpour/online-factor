import { store, toJalali, nowTimeFa } from "./store.js";

const DB_NAME = "cafe-fs-access";
const DB_STORE = "handles";
const FILE_HANDLE_KEY = "invoices-backup";
const DIR_HANDLE_KEY = "local-backup-directory-handle";

let fileHandle = null;
let dirHandle = null;
let backupIntervalTimer = null;

/* =========================================================================
   توابع پایگاه‌داده IndexedDB برای نگهداری امن Handle‌های فایل و پوشه
   ========================================================================= */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(DB_STORE);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const rq = db
      .transaction(DB_STORE, "readonly")
      .objectStore(DB_STORE)
      .get(key);
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror = () => reject(rq.error);
  });
}

async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* =========================================================================
   اعتبارسنجی مجوزهای فایل و پوشه در مرورگر
   ========================================================================= */
async function ensurePermission(handle, { request = true } = {}) {
  if (!handle) return false;
  const opts = { mode: "readwrite" };
  try {
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if (request) {
      return (await handle.requestPermission(opts)) === "granted";
    }
    return false;
  } catch {
    return false;
  }
}

/* =========================================================================
   تاریخ شمسی استاندارد برای نام‌گذاری پوشه‌ها (مثلاً ۱۴۰۵-۰۶-۲۹)
   ========================================================================= */
export function getTodayShamsiFolderDate() {
  const j = toJalali();
  return `${j.year}-${String(j.month).padStart(2, "0")}-${String(j.day).padStart(2, "0")}`;
}

/* =========================================================================
   گردآوری کامل بسته‌های داده‌ای جهت بک‌آپ (مطابق با ریپوی خصوصی و عمومی گیت‌هاب)
   ========================================================================= */
export function collectAllBackupDatasets() {
  const invoices = store.getInvoices();
  const products = store.getProducts();
  const productCategories = store.getProductCategories();
  const announcements = store.getAnnouncements();
  const customers = store.getCustomers();
  const shop = store.getShopInfo();
  const customServices = store.getCustomServices();
  const services = store.getServices();

  const metaPrivate = {
    exportedAt: new Date().toISOString(),
    invoiceCount: invoices.length,
    productCount: products.length,
    productCategoryCount: productCategories.length,
    customerCount: customers.length,
    announcementCount: announcements.length,
    type: "private_backup",
  };

  const metaPublic = {
    exportedAt: new Date().toISOString(),
    productCount: products.length,
    productCategoryCount: productCategories.length,
    announcementCount: announcements.length,
    type: "public_data",
  };

  return {
    privateFiles: [
      { name: "invoices.json", data: invoices },
      { name: "products.json", data: products },
      { name: "product-categories.json", data: productCategories },
      { name: "announcements.json", data: announcements },
      { name: "customers.json", data: customers },
      { name: "shop-info.json", data: shop },
      { name: "custom-services.json", data: customServices },
      { name: "services.json", data: services },
      { name: "meta.json", data: metaPrivate },
    ],
    publicFiles: [
      { name: "products.json", data: products },
      { name: "product-categories.json", data: productCategories },
      { name: "announcements.json", data: announcements },
      { name: "shop-info.json", data: shop },
      { name: "custom-services.json", data: customServices },
      { name: "services.json", data: services },
      { name: "meta.json", data: metaPublic },
    ],
    bundle: {
      version: 5,
      exportedAt: new Date().toISOString(),
      shamsiDate: toJalali().full,
      invoices,
      products,
      productCategories,
      announcements,
      customers,
      shop,
      customServices,
      services,
    },
  };
}

/* نوشتن یک فایل JSON داخل هندل پوشه */
async function writeJsonToDirectory(targetDirHandle, fileName, data) {
  const fh = await targetDirHandle.getFileHandle(fileName, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/* نمایش Toast اعلان */
function showBackupToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3500);
}

/* =========================================================================
   مدیریت مودال هشدار تغییر تاریخ پوشه
   ========================================================================= */
function askAdminNewDayFolderConfirm(prevDate, todayDate) {
  return new Promise((resolve) => {
    const modal = document.getElementById("local-backup-day-modal");
    const prevEl = document.getElementById("lb-modal-prev-date");
    const todayEl = document.getElementById("lb-modal-today-date");
    const btnConfirm = document.getElementById("btn-confirm-create-today-folder");
    const btnCancel = document.getElementById("btn-cancel-create-today-folder");

    if (!modal) {
      const ok = confirm(
        `⚠️ تاریخ روز تغییر کرده است!\n\n` +
          `تاریخ آخرین پوشه بک‌آپ: ${prevDate}\n` +
          `تاریخ شمسی امروز: ${todayDate}\n\n` +
          `آیا مایلید پوشه جدیدی برای تاریخ امروز در پوشه انتخاب‌شده ساخته شود؟`,
      );
      return resolve(ok);
    }

    if (prevEl) prevEl.textContent = prevDate || "نامشخص";
    if (todayEl) todayEl.textContent = todayDate;

    modal.classList.remove("hidden");

    function cleanup(result) {
      modal.classList.add("hidden");
      btnConfirm?.removeEventListener("click", onConfirm);
      btnCancel?.removeEventListener("click", onCancel);
      resolve(result);
    }

    function onConfirm() {
      cleanup(true);
    }
    function onCancel() {
      cleanup(false);
    }

    btnConfirm?.addEventListener("click", onConfirm);
    btnCancel?.addEventListener("click", onCancel);
  });
}

/* =========================================================================
   عملیات اصلی بک‌آپ‌گیری در پوشه سیستم (Local Folder Backup)
   ========================================================================= */
let isLocalBackingUp = false;

export async function performLocalFolderBackup({
  trigger = "manual",
  forceNewFolder = false,
  showToast = true,
} = {}) {
  if (isLocalBackingUp) return { ok: false, reason: "in_progress" };

  try {
    if (!dirHandle) {
      dirHandle = await idbGet(DIR_HANDLE_KEY).catch(() => null);
    }

    if (!dirHandle) {
      if (trigger === "manual") {
        alert("⚠️ هنوز هیچ پوشه‌ای برای ذخیره بک‌آپ انتخاب نشده است.\nلطفاً ابتدا روی «انتخاب پوشه ذخیره بک‌آپ» کلیک کنید.");
      }
      return { ok: false, reason: "no_dir" };
    }

    // بررسی مجوز دسترسی به پوشه
    const hasPerm = await ensurePermission(dirHandle, {
      request: trigger === "manual",
    });
    if (!hasPerm) {
      if (trigger === "manual") {
        alert("⚠️ دسترسی به پوشه انتخاب‌شده تایید نشد یا منقضی شده است.\nلطفاً دوباره پوشه را انتخاب کنید.");
      }
      refreshLocalFolderUI();
      return { ok: false, reason: "no_permission" };
    }

    isLocalBackingUp = true;

    const todayDate = getTodayShamsiFolderDate();
    const settings = store.getSettings();
    const lbConfig = settings.localFolderBackup || {};
    const lastFolderDate = lbConfig.lastBackupDate;
    const autoConfirmNewDay = Boolean(lbConfig.autoConfirmNewDay);

    // بررسی عدم همخوانی تاریخ پوشه قبلی با تاریخ امروز
    if (lastFolderDate && lastFolderDate !== todayDate && !forceNewFolder) {
      if (!autoConfirmNewDay) {
        // هشدار به ادمین و درخواست تأیید
        const userApproved = await askAdminNewDayFolderConfirm(lastFolderDate, todayDate);
        if (!userApproved) {
          if (showToast) {
            showBackupToast("⚠️ ساخت پوشه تاریخ جدید لغو شد — فایل‌ها ذخیره نشدند");
          }
          isLocalBackingUp = false;
          return { ok: false, reason: "user_cancelled" };
        }
      }
    }

    // ۱. دسترسی یا ساخت پوشه تاریخ امروز (مثلاً 1405-06-29)
    const todayDir = await dirHandle.getDirectoryHandle(todayDate, { create: true });

    // ۲. گردآوری کلیه داده‌های سیستم (دیتای ریپوی خصوصی و عمومی)
    const datasets = collectAllBackupDatasets();

    // ۳. ذخیره دیتای خصوصی داخل زیرپوشه backup/
    const backupSubDir = await todayDir.getDirectoryHandle("backup", { create: true });
    for (const f of datasets.privateFiles) {
      await writeJsonToDirectory(backupSubDir, f.name, f.data);
    }

    // ۴. ذخیره دیتای عمومی داخل زیرپوشه data/
    const dataSubDir = await todayDir.getDirectoryHandle("data", { create: true });
    for (const f of datasets.publicFiles) {
      await writeJsonToDirectory(dataSubDir, f.name, f.data);
    }

    // ۵. ذخیره فایل تجمیعی و مانیفست اطلاعات روز
    await writeJsonToDirectory(todayDir, "backup-bundle.json", datasets.bundle);
    await writeJsonToDirectory(todayDir, "manifest.json", {
      shamsiDate: todayDate,
      updatedAt: new Date().toISOString(),
      timeFa: nowTimeFa(),
      trigger,
      counts: {
        invoices: datasets.bundle.invoices.length,
        products: datasets.bundle.products.length,
        customers: datasets.bundle.customers.length,
        announcements: datasets.bundle.announcements.length,
      },
    });

    // ۶. به‌روزرسانی تنظیمات و متادیتای ذخیره‌سازی
    const now = Date.now();
    const timeStr = `${toJalali().full} ساعت ${nowTimeFa()}`;
    const updatedSettings = {
      ...store.getSettings(),
      localFolderBackup: {
        ...(store.getSettings().localFolderBackup || {}),
        folderName: dirHandle.name,
        lastBackupAt: now,
        lastBackupDate: todayDate,
        lastBackupTimeStr: timeStr,
      },
    };
    store.saveSettings(updatedSettings);

    refreshLocalFolderUI();

    if (showToast) {
      const triggerLabel =
        trigger === "push"
          ? "در زمان Push"
          : trigger === "timer"
            ? "زمان‌بندی خودکار"
            : "دستی";
      showBackupToast(`💾 بک‌آپ محلی (${triggerLabel}) با موفقیت در پوشه «${todayDate}» ذخیره شد`);
    }

    return { ok: true, folderDate: todayDate, timestamp: now };
  } catch (err) {
    console.error("خطا در پشتیبان‌گیری محلی در پوشه:", err);
    if (trigger === "manual") {
      alert("❌ خطا در ذخیره نسخه پشتیبان محلی:\n" + err.message);
    }
    return { ok: false, error: err.message };
  } finally {
    isLocalBackingUp = false;
  }
}

/* =========================================================================
   انتخاب پوشه توسط کاربر (Directory Picker)
   ========================================================================= */
export async function selectBackupDirectory() {
  if (!("showDirectoryPicker" in window)) {
    alert(
      "مرورگر شما از انتخاب مستقیم پوشه پشتیبانی نمی‌کند.\n" +
        "لطفاً از مرورگرهای مدرن مانند گوگل کروم (Chrome) یا مایکروسافت اج (Edge) استفاده کنید.",
    );
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const ok = await ensurePermission(handle, { request: true });
    if (!ok) {
      alert("⚠️ برای ذخیره خودکار فایل‌ها، اعطای مجوز ویرایش (Read & Write) الزامی است.");
      return;
    }

    dirHandle = handle;
    await idbSet(DIR_HANDLE_KEY, handle);

    // ذخیره اولیه تنظیمات پوشه
    const s = store.getSettings();
    store.saveSettings({
      ...s,
      localFolderBackup: {
        ...(s.localFolderBackup || {}),
        folderName: handle.name,
      },
    });

    refreshLocalFolderUI();

    // اجرای اولین بک‌آپ بلافاصله پس از انتخاب پوشه
    await performLocalFolderBackup({ trigger: "manual", showToast: true });
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn("خطا در انتخاب پوشه:", err);
      alert("خطا در انتخاب پوشه: " + err.message);
    }
  }
}

/* قطع اتصال پوشه */
export async function disconnectBackupDirectory() {
  dirHandle = null;
  await idbDel(DIR_HANDLE_KEY);
  const s = store.getSettings();
  if (s.localFolderBackup) {
    store.saveSettings({
      ...s,
      localFolderBackup: {
        ...s.localFolderBackup,
        folderName: null,
      },
    });
  }
  refreshLocalFolderUI();
  showBackupToast("اتصال پوشه محلی قطع شد");
}

/* به‌روزرسانی وضعیت نمایشی پوشه محلی در صفحه تنظیمات */
export async function refreshLocalFolderUI() {
  const statusEl = document.getElementById("local-dir-status");
  const nameEl = document.getElementById("local-dir-name");
  const todayEl = document.getElementById("local-today-date");
  const lastFolderEl = document.getElementById("local-last-folder-date");
  const lastTimeEl = document.getElementById("local-last-backup-time");
  const btnSelect = document.getElementById("btn-local-dir-select");
  const btnDisconnect = document.getElementById("btn-local-dir-disconnect");
  const intervalSelect = document.getElementById("local-backup-interval");
  const onPushCheck = document.getElementById("local-backup-on-push");
  const autoConfirmCheck = document.getElementById("local-backup-auto-confirm-new-day");

  const todayDate = getTodayShamsiFolderDate();
  if (todayEl) todayEl.textContent = todayDate;

  const s = store.getSettings();
  const lbConfig = s.localFolderBackup || {};

  if (intervalSelect && lbConfig.intervalMinutes !== undefined) {
    intervalSelect.value = String(lbConfig.intervalMinutes);
  }
  if (onPushCheck && lbConfig.onPush !== undefined) {
    onPushCheck.checked = Boolean(lbConfig.onPush);
  }
  if (autoConfirmCheck && lbConfig.autoConfirmNewDay !== undefined) {
    autoConfirmCheck.checked = Boolean(lbConfig.autoConfirmNewDay);
  }

  if (lastFolderEl) {
    lastFolderEl.textContent = lbConfig.lastBackupDate || "هنوز ساخته نشده";
  }
  if (lastTimeEl) {
    lastTimeEl.textContent = lbConfig.lastBackupTimeStr || "هیچ";
  }

  if (!dirHandle) {
    dirHandle = await idbGet(DIR_HANDLE_KEY).catch(() => null);
  }

  if (!dirHandle) {
    if (statusEl) {
      statusEl.className =
        "text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center gap-1.5";
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> قطع — پوشه‌ای انتخاب نشده`;
    }
    if (nameEl) nameEl.textContent = "انتخاب نشده";
    btnSelect?.classList.remove("hidden");
    btnDisconnect?.classList.add("hidden");
    return;
  }

  // بررسی وضعیت دسترسی
  const perm = await dirHandle.queryPermission({ mode: "readwrite" }).catch(() => "denied");
  if (nameEl) nameEl.textContent = dirHandle.name;

  if (perm === "granted") {
    if (statusEl) {
      statusEl.className =
        "text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5";
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> متصل ✅ (${dirHandle.name})`;
    }
  } else {
    if (statusEl) {
      statusEl.className =
        "text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5";
      statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> نیازمند تأیید مجوز`;
    }
  }

  btnSelect?.classList.remove("hidden");
  btnDisconnect?.classList.remove("hidden");
}

/* =========================================================================
   تایمر خودکار بک‌آپ‌گیری دوره‌ای (Periodic Interval)
   ========================================================================= */
export function initLocalBackupInterval() {
  if (backupIntervalTimer) clearInterval(backupIntervalTimer);

  // بررسی هر ۱ دقیقه
  backupIntervalTimer = setInterval(async () => {
    try {
      const s = store.getSettings();
      const lb = s.localFolderBackup || {};
      const intervalMin = Number(lb.intervalMinutes ?? 60);

      // اگر بازه زمانی غیرفعال (0) باشد کاری انجام نده
      if (intervalMin <= 0) return;

      const lastAt = Number(lb.lastBackupAt || 0);
      const elapsedMs = Date.now() - lastAt;
      const intervalMs = intervalMin * 60 * 1000;

      if (elapsedMs >= intervalMs) {
        if (!dirHandle) {
          dirHandle = await idbGet(DIR_HANDLE_KEY).catch(() => null);
        }
        if (dirHandle) {
          const perm = await dirHandle.queryPermission({ mode: "readwrite" }).catch(() => "denied");
          if (perm === "granted") {
            await performLocalFolderBackup({ trigger: "timer", showToast: false });
          }
        }
      }
    } catch (e) {
      console.warn("خطا در تایمر بک‌آپ محلی:", e);
    }
  }, 60 * 1000);
}

/* =========================================================================
   پشتیبان‌گیری تک‌فایلی قدیمی (Legacy Single File Backup) جهت سازگاری
   ========================================================================= */
async function writeInvoicesToFile(handle) {
  const writable = await handle.createWritable();
  const payload = {
    version: 4,
    exportedAt: new Date().toISOString(),
    invoices: store.getInvoices(),
    products: store.getProducts(),
    productCategories: store.getProductCategories(),
    announcements: store.getAnnouncements(),
    customers: store.getCustomers(),
    customServices: store.getCustomServices(),
    shop: store.getShopInfo(),
  };
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

async function refreshStatus() {
  const status = document.getElementById("backup-status");
  const btnConnect = document.getElementById("btn-backup-connect");
  const btnDisconnect = document.getElementById("btn-backup-disconnect");
  if (!status) return;

  if (!fileHandle) {
    status.textContent = "قطع — ذخیره خودکار غیرفعال";
    status.className = "text-rose-500 dark:text-rose-400 font-bold";
    btnConnect?.classList.remove("hidden");
    btnDisconnect?.classList.add("hidden");
    return;
  }
  const perm = await fileHandle.queryPermission({ mode: "readwrite" });
  if (perm === "granted") {
    status.textContent = "متصل ✅ — ذخیره خودکار فعال";
    status.className = "text-emerald-500 dark:text-emerald-400 font-bold";
  } else {
    status.textContent = "متصل ⚠️ — با ثبت فاکتور بعدی، مجوز خواسته می‌شود";
    status.className = "text-amber-500 dark:text-amber-400 font-bold";
  }
  btnConnect?.classList.add("hidden");
  btnDisconnect?.classList.remove("hidden");
}

export async function connectBackupFile() {
  if (!("showSaveFilePicker" in window)) {
    alert(
      "مرورگر شما از اتصال مستقیم به فایل پشتیبانی نمی‌کند.\nاز Chrome یا Edge استفاده کنید، یا از دکمه «خروجی JSON» بهره بگیرید.",
    );
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "invoices-backup.json",
      types: [
        { description: "فایل JSON", accept: { "application/json": [".json"] } },
      ],
    });
    fileHandle = handle;
    await idbSet(FILE_HANDLE_KEY, handle);
    const ok = await ensurePermission(handle);
    if (ok) await writeInvoicesToFile(handle);
    await refreshStatus();
  } catch (err) {
    if (err.name !== "AbortError") console.warn("connect failed:", err);
  }
}

export async function disconnectBackupFile() {
  fileHandle = null;
  await idbDel(FILE_HANDLE_KEY);
  await refreshStatus();
}

export async function autoSaveInvoices() {
  try {
    // ۱. اگر فایل تک‌فایلی متصل باشد
    if (!fileHandle) fileHandle = await idbGet(FILE_HANDLE_KEY);
    if (fileHandle) {
      const ok = await ensurePermission(fileHandle, { request: false });
      if (ok) await writeInvoicesToFile(fileHandle);
    }
  } catch (err) {
    console.warn("ذخیره خودکار روی فایل ناموفق بود:", err);
  }
}

export function exportAllData() {
  const data = {
    version: 4,
    exportedAt: new Date().toISOString(),
    invoices: store.getInvoices(),
    products: store.getProducts(),
    productCategories: store.getProductCategories(),
    announcements: store.getAnnouncements(),
    customers: store.getCustomers(),
    customServices: store.getCustomServices(),
    shop: store.getShopInfo(),
  };
  if (!data.invoices.length && !data.products.length && !data.customers.length)
    return alert("هیچ داده‌ای برای خروجی وجود ندارد!");

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-${toJalali().full.replaceAll("/", "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importInvoicesFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      const invoices = Array.isArray(parsed) ? parsed : parsed.invoices;
      const products = parsed.products;
      const productCategories = parsed.productCategories;
      const customers = parsed.customers;
      const shop = parsed.shop;
      const customServices = parsed.customServices;
      const announcements = parsed.announcements;

      const invValid = Array.isArray(invoices)
        ? invoices.filter(
            (inv) =>
              inv &&
              typeof inv.number === "number" &&
              Array.isArray(inv.items) &&
              typeof inv.total === "number",
          )
        : [];
      const prdValid = Array.isArray(products)
        ? products.filter((p) => p && p.id && p.name)
        : [];
      const cstValid = Array.isArray(customers)
        ? customers.filter((c) => c && (c.phone || c.name))
        : [];

      // ادغام فاکتورها
      const currentInv = store.getInvoices();
      const existingInvNums = new Set(currentInv.map((i) => i.number));
      const addedInv = invValid.filter((i) => !existingInvNums.has(i.number));
      store.setInvoices(
        [...currentInv, ...addedInv].sort((a, b) => b.number - a.number),
      );

      if (Array.isArray(announcements) && announcements.length) {
        const currentAnn = store.getAnnouncements();
        const annIds = new Set(currentAnn.map((a) => a.id));
        const addedAnn = announcements.filter(
          (a) => a && a.id && !annIds.has(a.id),
        );
        store.setAnnouncements([...currentAnn, ...addedAnn]);
      }

      // ادغام محصولات
      if (prdValid.length) {
        const currentPrd = store.getProducts();
        const prdIds = new Set(currentPrd.map((p) => p.id));
        store.setProducts([
          ...currentPrd,
          ...prdValid.filter((p) => !prdIds.has(p.id)),
        ]);
      }

      // ادغام دسته‌های محصولات
      if (Array.isArray(productCategories) && productCategories.length) {
        const currentCats = store.getProductCategories();
        const catIds = new Set(currentCats.map((c) => c.id));
        const addedCats = productCategories.filter(
          (c) => c && c.id && !catIds.has(c.id),
        );
        store.setProductCategories([...currentCats, ...addedCats]);
      }

      // ادغام مشتریان
      if (cstValid.length) {
        const currentCst = store.getCustomers();
        const cstPhones = new Set(
          currentCst.map((c) => c.phone).filter(Boolean),
        );
        store.saveCustomers([
          ...currentCst,
          ...cstValid.filter((c) => !c.phone || !cstPhones.has(c.phone)),
        ]);
      }

      // ادغام خدمات سفارشی
      if (customServices && typeof customServices === "object") {
        const current = store.getCustomServices();
        const currentNewCatIds = new Set(
          (current.newCategories || []).map((c) => c.id),
        );
        const addedNewCats = (customServices.newCategories || []).filter(
          (c) => c && !currentNewCatIds.has(c.id),
        );
        const mergedNewCategories = [
          ...(current.newCategories || []),
          ...addedNewCats,
        ];
        const mergedOverrides = {
          ...(current.categoryOverrides || {}),
          ...(customServices.categoryOverrides || {}),
        };
        store.saveCustomServices({
          newCategories: mergedNewCategories,
          categoryOverrides: mergedOverrides,
        });
      }

      if (shop && typeof shop === "object") store.saveShopInfo(shop);

      alert(
        `✅ ایمپورت انجام شد:\n` +
          `فاکتور: ${addedInv.length} جدید\n` +
          `محصول: ${prdValid.length} عدد\n` +
          `مشتری: ${cstValid.length} نفر\n` +
          `دسته‌بندی‌ها و خدمات با موفقیت بازیابی شدند.`,
      );
      autoSaveInvoices();
      if (window.initInvoicesList) window.initInvoicesList();
      location.reload();
    } catch {
      alert("❌ فایل انتخاب‌شده یک JSON معتبر نیست!");
    }
  };
  reader.readAsText(file);
}

/* =========================================================================
   راه‌اندازی ماژول پشتیبان‌گیری
   ========================================================================= */
export async function initBackup() {
  fileHandle = await idbGet(FILE_HANDLE_KEY).catch(() => null);
  dirHandle = await idbGet(DIR_HANDLE_KEY).catch(() => null);

  // دکمه‌های نسخه تک‌فایل
  document
    .getElementById("btn-backup-connect")
    ?.addEventListener("click", connectBackupFile);
  document
    .getElementById("btn-backup-disconnect")
    ?.addEventListener("click", () => {
      if (confirm("اتصال ذخیره خودکار قطع شود؟")) disconnectBackupFile();
    });
  document
    .getElementById("btn-export-json")
    ?.addEventListener("click", exportAllData);

  const fileInput = document.getElementById("import-file");
  document
    .getElementById("btn-import-json")
    ?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", () => {
    if (fileInput.files[0]) importInvoicesFile(fileInput.files[0]);
    fileInput.value = "";
  });

  // دکمه‌ها و رویدادهای پشتیبان‌گیری محلی در پوشه سیستم
  document
    .getElementById("btn-local-dir-select")
    ?.addEventListener("click", selectBackupDirectory);

  document
    .getElementById("btn-local-dir-disconnect")
    ?.addEventListener("click", () => {
      if (confirm("اتصال پوشه محلی قطع شود؟")) {
        disconnectBackupDirectory();
      }
    });

  document
    .getElementById("btn-local-backup-now")
    ?.addEventListener("click", () => {
      performLocalFolderBackup({ trigger: "manual", showToast: true });
    });

  // رویداد تغییر بازه زمانی
  document
    .getElementById("local-backup-interval")
    ?.addEventListener("change", (e) => {
      const val = Number(e.target.value) || 0;
      const s = store.getSettings();
      store.saveSettings({
        ...s,
        localFolderBackup: {
          ...(s.localFolderBackup || {}),
          intervalMinutes: val,
        },
      });
      showBackupToast(
        val === 0
          ? "بک‌آپ خودکار زمان‌بندی‌شده غیرفعال شد"
          : `بازه زمانی بک‌آپ خودکار روی هر ${val} دقیقه تنظیم شد`,
      );
    });

  // رویداد فعال‌سازی بک‌آپ با Push
  document
    .getElementById("local-backup-on-push")
    ?.addEventListener("change", (e) => {
      const checked = Boolean(e.target.checked);
      const s = store.getSettings();
      store.saveSettings({
        ...s,
        localFolderBackup: {
          ...(s.localFolderBackup || {}),
          onPush: checked,
        },
      });
      showBackupToast(
        checked
          ? "بک‌آپ محلی هنگام هر Push فعال شد"
          : "بک‌آپ محلی هنگام Push غیرفعال شد",
      );
    });

  // رویداد تایید خودکار روز جدید
  document
    .getElementById("local-backup-auto-confirm-new-day")
    ?.addEventListener("change", (e) => {
      const checked = Boolean(e.target.checked);
      const s = store.getSettings();
      store.saveSettings({
        ...s,
        localFolderBackup: {
          ...(s.localFolderBackup || {}),
          autoConfirmNewDay: checked,
        },
      });
    });

  await refreshStatus();
  await refreshLocalFolderUI();
  initLocalBackupInterval();
}
