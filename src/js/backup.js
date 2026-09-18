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

/* ---------- نوشتن کل فاکتورها داخل فایل ---------- */
async function writeInvoicesToFile(handle) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(store.getInvoices(), null, 2));
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
export function exportInvoices() {
  const list = store.getInvoices();
  if (!list.length) return alert("فاکتوری برای خروجی وجود ندارد!");
  const blob = new Blob([JSON.stringify(list, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoices-${toJalali().full.replaceAll("/", "-")}.json`;
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
      const arr = Array.isArray(parsed) ? parsed : parsed.invoices;
      if (!Array.isArray(arr)) throw new Error("bad format");

      const valid = arr.filter(
        (inv) =>
          inv &&
          typeof inv.number === "number" &&
          Array.isArray(inv.items) &&
          typeof inv.total === "number",
      );

      const current = store.getInvoices();
      const existing = new Set(current.map((i) => i.number));
      const added = valid.filter((i) => !existing.has(i.number));
      const merged = [...current, ...added].sort((a, b) => b.number - a.number);

      store.setInvoices(merged);
      alert(
        `✅ ایمپورت انجام شد:\n${added.length} فاکتور جدید اضافه شد.\n${valid.length - added.length} فاکتور تکراری نادیده گرفته شد.`,
      );
      autoSaveInvoices();
      if (window.initInvoicesList) window.initInvoicesList();
    } catch {
      alert("❌ فایل انتخاب‌شده یک JSON معتبر فاکتورها نیست!");
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
    ?.addEventListener("click", exportInvoices);

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
