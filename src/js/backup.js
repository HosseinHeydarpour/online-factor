import { store, toJalali } from "./store.js";

const DB_NAME = "cafe-fs-access";
const DB_STORE = "handles";
const HANDLE_KEY = "invoices-backup";

let fileHandle = null;

/* ---------- IndexedDB برای نگه‌داشتن handle فایل بین جلسات ---------- */
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

/* ---------- مجوز دسترسی ---------- */
async function ensurePermission(handle) {
  if (!handle) return false;
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  try {
    return (await handle.requestPermission(opts)) === "granted";
  } catch {
    return false;
  }
}

/* ---------- نوشتن کل فاکتورها و خدمات داخل فایل لوکال ---------- */
async function writeInvoicesToFile(handle) {
  const writable = await handle.createWritable();
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    invoices: store.getInvoices(),
    products: store.getProducts(),
    customers: store.getCustomers(),
    customServices: store.getCustomServices(), // ✅ ذخیره خدمات جدید
    shop: store.getShopInfo(),
  };
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

/* ---------- وضعیت UI ---------- */
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

/* ---------- اتصال فایل پشتیبان ---------- */
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
    await idbSet(HANDLE_KEY, handle);
    const ok = await ensurePermission(handle); // داخل کلیک کاربر → مجوز گرفته می‌شود
    if (ok) await writeInvoicesToFile(handle);
    await refreshStatus();
  } catch (err) {
    if (err.name !== "AbortError") console.warn("connect failed:", err);
  }
}

export async function disconnectBackupFile() {
  fileHandle = null;
  await idbDel(HANDLE_KEY);
  await refreshStatus();
}

/* ---------- ذخیره خودکار (لحظه ثبت هر فاکتور) ---------- */
export async function autoSaveInvoices() {
  try {
    if (!fileHandle) fileHandle = await idbGet(HANDLE_KEY);
    if (!fileHandle) return; // اتصال برقرار نشده
    const ok = await ensurePermission(fileHandle);
    if (!ok) {
      refreshStatus();
      return;
    }
    await writeInvoicesToFile(fileHandle);
  } catch (err) {
    console.warn("ذخیره خودکار روی فایل ناموفق بود:", err);
  }
}

/* ---------- اکسپورت (دانلود JSON) ---------- */
export function exportAllData() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    invoices: store.getInvoices(),
    products: store.getProducts(),
    customers: store.getCustomers(),
    customServices: store.getCustomServices(), // ✅ ذخیره خدمات جدید
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
/* ---------- ایمپورت (ادغام JSON قبلی) ---------- */
export function importInvoicesFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      const invoices = Array.isArray(parsed) ? parsed : parsed.invoices;
      const products = parsed.products;
      const customers = parsed.customers;
      const shop = parsed.shop;
      const customServices = parsed.customServices; // ✅ خدمات جدید

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

      // ادغام محصولات
      if (prdValid.length) {
        const currentPrd = store.getProducts();
        const prdIds = new Set(currentPrd.map((p) => p.id));
        store.setProducts([
          ...currentPrd,
          ...prdValid.filter((p) => !prdIds.has(p.id)),
        ]);
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

      // ✅ بازیابی و ادغام خدمات و دسته‌های جدید
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
          `فاکتور: ${addedInv.length} جدید از ${invValid.length}\n` +
          `محصول: ${prdValid.length}\n` +
          `مشتری: ${cstValid.length}\n` +
          `خدمات و دسته‌بندی‌های جدید نیز بازیابی شدند.`,
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
/* ---------- اتصال ایونت‌ها ---------- */
export async function initBackup() {
  fileHandle = await idbGet(HANDLE_KEY).catch(() => null);

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

  await refreshStatus();
}
