import { store, faNum, toJalali } from "./store.js";
import { autoSaveInvoices } from "./backup.js";
import { autoPushGitHub } from "./github.js";

const el = { list: null, empty: null, search: null, total: null };

// 💾 سینک بک‌آپ بعد از هر تغییر مشتریان
function syncBackup() {
  autoSaveInvoices();
  autoPushGitHub();
}

/* ========== دیالوگ اطلاعات تکمیلی ========== */
const detailsEl = {
  modal: null,
  national: null,
  birthcert: null,
  gender: null,
  age: null,
  address: null,
  notes: null,
};
let detailsOnSave = null;

function initDetailsModal() {
  detailsEl.modal = document.getElementById("customer-details-modal");
  detailsEl.national = document.getElementById("cd-national");
  detailsEl.birthcert = document.getElementById("cd-birthcert");
  detailsEl.gender = document.getElementById("cd-gender");
  detailsEl.age = document.getElementById("cd-age");
  detailsEl.address = document.getElementById("cd-address");
  detailsEl.notes = document.getElementById("cd-notes");
  if (!detailsEl.modal || detailsEl.modal.dataset.bound) return;
  detailsEl.modal.dataset.bound = "1";
  document
    .getElementById("btn-close-customer-details")
    .addEventListener("click", closeCustomerDetails);
  detailsEl.modal.addEventListener(
    "click",
    (e) => e.target === detailsEl.modal && closeCustomerDetails(),
  );
  document
    .getElementById("btn-save-customer-details")
    .addEventListener("click", () => {
      const data = readDetailsForm();
      detailsOnSave?.(data);
      closeCustomerDetails();
    });
  document
    .getElementById("btn-clear-customer-details")
    .addEventListener("click", () => setCustomerDetailsFormValues({}));
}

function readDetailsForm() {
  return {
    nationalCode: detailsEl.national?.value.trim() || "",
    birthCertNo: detailsEl.birthcert?.value.trim() || "",
    gender: detailsEl.gender?.value || "",
    age: detailsEl.age?.value.trim() || "",
    address: detailsEl.address?.value.trim() || "",
    notes: detailsEl.notes?.value.trim() || "",
  };
}

export function setCustomerDetailsFormValues(c = {}) {
  if (!detailsEl.modal) initDetailsModal();
  if (detailsEl.national) detailsEl.national.value = c.nationalCode || "";
  if (detailsEl.birthcert) detailsEl.birthcert.value = c.birthCertNo || "";
  if (detailsEl.gender) detailsEl.gender.value = c.gender || "";
  if (detailsEl.age) detailsEl.age.value = c.age || "";
  if (detailsEl.address) detailsEl.address.value = c.address || "";
  if (detailsEl.notes) detailsEl.notes.value = c.notes || "";
}

export function openCustomerDetails(customer = {}, onSave = null) {
  if (!detailsEl.modal) initDetailsModal();
  detailsOnSave = onSave;
  setCustomerDetailsFormValues(customer);
  detailsEl.modal.classList.remove("hidden");
}

function closeCustomerDetails() {
  detailsEl.modal?.classList.add("hidden");
  detailsOnSave = null;
}

export function hasCustomerExtras(c = {}) {
  return !!(
    c.nationalCode ||
    c.birthCertNo ||
    c.address ||
    c.gender ||
    c.age ||
    c.notes
  );
}

/* ========== مودال مشتری جدید (بدون فاکتور) ========== */
const formEl = {
  modal: null,
  name: null,
  phone: null,
  national: null,
  birthcert: null,
  gender: null,
  age: null,
  address: null,
  notes: null,
};

function initCustomerForm() {
  formEl.modal = document.getElementById("customer-form-modal");
  if (!formEl.modal || formEl.modal.dataset.bound) return;
  formEl.modal.dataset.bound = "1";
  formEl.name = document.getElementById("cf-name");
  formEl.phone = document.getElementById("cf-phone");
  formEl.national = document.getElementById("cf-national");
  formEl.birthcert = document.getElementById("cf-birthcert");
  formEl.gender = document.getElementById("cf-gender");
  formEl.age = document.getElementById("cf-age");
  formEl.address = document.getElementById("cf-address");
  formEl.notes = document.getElementById("cf-notes");
  document
    .getElementById("btn-close-customer-form")
    .addEventListener("click", closeCustomerForm);
  document
    .getElementById("btn-cancel-customer-form")
    .addEventListener("click", closeCustomerForm);
  formEl.modal.addEventListener(
    "click",
    (e) => e.target === formEl.modal && closeCustomerForm(),
  );
  document
    .getElementById("btn-save-customer-form")
    .addEventListener("click", saveCustomerFromForm);
}

function clearCustomerForm() {
  ["name", "phone", "national", "birthcert", "age", "address", "notes"].forEach(
    (k) => formEl[k] && (formEl[k].value = ""),
  );
  if (formEl.gender) formEl.gender.value = "";
}

export function openCustomerForm() {
  if (!formEl.modal) initCustomerForm();
  clearCustomerForm();
  formEl.modal.classList.remove("hidden");
  setTimeout(() => formEl.name?.focus(), 60);
}

function closeCustomerForm() {
  formEl.modal?.classList.add("hidden");
}

function saveCustomerFromForm() {
  const name = formEl.name?.value.trim() || "";
  const phone = formEl.phone?.value.trim() || "";
  if (!name && !phone) return alert("حداقل نام یا شماره تماس را وارد کنید.");
  if (phone) {
    const dup = store.getCustomers().find((c) => c.phone === phone);
    if (
      dup &&
      !confirm(
        `مشتری با شماره ${phone} قبلاً ثبت شده (${dup.name || "بدون نام"}).\nاطلاعات همان مشتری به‌روزرسانی شود؟`,
      )
    )
      return;
  }
  store.saveCustomer({
    name,
    phone,
    nationalCode: formEl.national?.value.trim() || "",
    birthCertNo: formEl.birthcert?.value.trim() || "",
    gender: formEl.gender?.value || "",
    age: formEl.age?.value.trim() || "",
    address: formEl.address?.value.trim() || "",
    notes: formEl.notes?.value.trim() || "",
  });
  closeCustomerForm();
  renderCustomers(el.search?.value.trim() || "");
  toast("مشتری ذخیره شد ✅");
  syncBackup();
}

/* ========== تب مشتریان ========== */
export function initCustomers() {
  el.list = document.getElementById("customers-list");
  el.empty = document.getElementById("customers-empty");
  el.search = document.getElementById("customer-search");
  el.total = document.getElementById("customers-total-count");
  initDetailsModal();
  initCustomerForm();
  if (el.search && !el.search.dataset.bound) {
    el.search.dataset.bound = "1";
    el.search.addEventListener("input", () =>
      renderCustomers(el.search.value.trim()),
    );
  }
  const exportBtn = document.getElementById("btn-export-customers");
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = "1";
    exportBtn.addEventListener("click", exportCustomersExcel);
  }
  const addBtn = document.getElementById("btn-add-customer");
  if (addBtn && !addBtn.dataset.bound) {
    addBtn.dataset.bound = "1";
    addBtn.addEventListener("click", openCustomerForm);
  }
  renderCustomers();
}

export function renderCustomers(query = "") {
  if (!el.list) return;
  const customers = store.getCustomers();
  const q = (query || "").toLowerCase();
  const filtered = customers.filter(
    (c) =>
      !q ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.nationalCode || "").toLowerCase().includes(q),
  );
  if (el.total) el.total.textContent = faNum(customers.length) + " نفر";
  if (!filtered.length) {
    el.list.innerHTML = "";
    el.empty?.classList.remove("hidden");
    return;
  }
  el.empty?.classList.add("hidden");

  const invoices = store.getInvoices();
  const countByPhone = {};
  const lastByPhone = {};
  invoices.forEach((inv) => {
    const ph = inv.customer?.phone || "";
    if (!ph) return;
    countByPhone[ph] = (countByPhone[ph] || 0) + 1;
    if (!lastByPhone[ph] || (inv.date && inv.date > lastByPhone[ph].date))
      lastByPhone[ph] = inv;
  });

  el.list.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-xs">
              <th class="py-3 px-3 text-right font-bold">مشتری</th>
              <th class="py-3 px-3 text-right font-bold">شماره تماس</th>
              <th class="py-3 px-3 text-right font-bold">کد ملی</th>
              <th class="py-3 px-3 text-right font-bold">جنسیت / سن</th>
              <th class="py-3 px-3 text-right font-bold">آدرس</th>
              <th class="py-3 px-3 text-right font-bold">توضیحات</th>
              <th class="py-3 px-3 text-center font-bold">فاکتورها</th>
              <th class="py-3 px-3 text-right font-bold">آخرین فاکتور</th>
              <th class="py-3 px-3 text-center font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
            ${filtered
              .map((c, idx) => {
                const count = countByPhone[c.phone] || 0;
                const lastDate = lastByPhone[c.phone]
                  ? lastByPhone[c.phone].date
                  : "—";
                const initial = (c.name || "؟").charAt(0);
                const genderAge = [
                  c.gender || "",
                  c.age ? `${faNum(c.age)} سال` : "",
                ]
                  .filter(Boolean)
                  .join(" / ");
                return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                  <td class="py-3 px-3">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold grid place-items-center shrink-0">${faNum(idx + 1)}</span>
                     
                      <span class="font-bold text-slate-800 dark:text-slate-100 truncate">${c.name || "بدون نام"}</span>
                    </div>
                  </td>
                  <td class="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">${c.phone || "—"}</td>
                  <td class="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">${c.nationalCode || "—"}</td>
                  <td class="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">${genderAge || "—"}</td>
                  <td class="py-3 px-3 max-w-[200px]"><span class="block truncate text-slate-500 dark:text-slate-400" title="${c.address || ""}">${c.address || "—"}</span></td>
                  <td class="py-3 px-3 max-w-[180px]"><span class="block truncate text-slate-500 dark:text-slate-400" title="${c.notes || ""}">${c.notes || "—"}</span></td>
                  <td class="py-3 px-3 text-center font-bold text-brand-700 dark:text-brand-400">${faNum(count)}</td>
                  <td class="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">${lastDate}</td>
                  <td class="py-3 px-3">
                    <div class="flex items-center justify-center gap-1.5">
                      <button data-use-customer="${c.id}" title="افزودن به فاکتور" class="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-2 rounded-lg font-bold">➕</button>
                      <button data-details-customer="${c.id}" title="اطلاعات تکمیلی" class="text-xs bg-brand-50 dark:bg-slate-700 hover:bg-brand-100 dark:hover:bg-slate-600 text-brand-700 dark:text-brand-400 px-2.5 py-2 rounded-lg font-bold">📋</button>
                      <button data-edit-customer="${c.id}" title="ویرایش نام/شماره" class="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 py-2 rounded-lg font-bold">✏️</button>
                      <button data-delete-customer="${c.id}" title="حذف" class="text-xs bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 px-2.5 py-2 rounded-lg font-bold">🗑️</button>
                    </div>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>

          
        </table>
      </div>
    </div>`;

  el.list.querySelectorAll("[data-use-customer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = store
        .getCustomers()
        .find((x) => x.id === btn.dataset.useCustomer);
      if (!c) return;
      const nameEl = document.getElementById("cust-name");
      const phoneEl = document.getElementById("cust-phone");
      if (nameEl) nameEl.value = c.name || "";
      if (phoneEl) phoneEl.value = c.phone || "";
      window.dispatchEvent(new CustomEvent("customer-selected", { detail: c }));
      if (typeof setView === "function") setView("invoice");
      toast(`${c.name || "مشتری"} به فاکتور اضافه شد 🧾`);
    });
  });

  el.list.querySelectorAll("[data-details-customer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = store
        .getCustomers()
        .find((x) => x.id === btn.dataset.detailsCustomer);
      if (!c) return;
      openCustomerDetails(c, (data) => {
        store.saveCustomer({ ...c, ...data });
        renderCustomers(el.search?.value.trim() || "");
        toast("اطلاعات تکمیلی مشتری ذخیره شد ✅");
        syncBackup();
      });
    });
  });

  el.list.querySelectorAll("[data-edit-customer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = store
        .getCustomers()
        .find((x) => x.id === btn.dataset.editCustomer);
      if (!c) return;
      const name = prompt("نام مشتری:", c.name);
      if (name === null) return;
      const phone = prompt("شماره تماس:", c.phone);
      if (phone === null) return;
      if (!name.trim() && !phone.trim()) return;
      store.saveCustomer({ ...c, name: name.trim(), phone: phone.trim() });
      renderCustomers(el.search?.value.trim() || "");
      toast("مشتری ویرایش شد ✅");
      syncBackup();
    });
  });

  el.list.querySelectorAll("[data-delete-customer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("این مشتری از لیست حذف شود؟ (فاکتورهای او باقی می‌مانند)"))
        return;
      store.deleteCustomer(btn.dataset.deleteCustomer);
      renderCustomers(el.search?.value.trim() || "");
      toast("مشتری حذف شد 🗑️");
      syncBackup(); // ✅ بک‌آپ بلافاصله بعد از حذف
    });
  });
}

/* ========== خروجی اکسل ========== */
export function exportCustomersExcel() {
  const customers = store.getCustomers();
  if (!customers.length) return alert("مشتری‌ای برای خروجی وجود ندارد!");
  const invoices = store.getInvoices();
  const countByPhone = {};
  const sumByPhone = {};
  const lastByPhone = {};
  invoices.forEach((inv) => {
    const ph = inv.customer?.phone || "";
    if (!ph) return;
    countByPhone[ph] = (countByPhone[ph] || 0) + 1;
    sumByPhone[ph] = (sumByPhone[ph] || 0) + inv.total;
    if (!lastByPhone[ph] || (inv.date && inv.date > lastByPhone[ph].date))
      lastByPhone[ph] = inv;
  });
  const rows = customers.map((c, i) => ({
    ردیف: i + 1,
    "نام مشتری": c.name || "",
    "شماره تماس": c.phone || "",
    "کد ملی": c.nationalCode || "",
    "شماره شناسنامه": c.birthCertNo || "",
    جنسیت: c.gender || "",
    سن: c.age || "",
    آدرس: c.address || "",
    توضیحات: c.notes || "",
    "تعداد فاکتورها": countByPhone[c.phone] || 0,
    "مجموع خرید (تومان)": sumByPhone[c.phone] || 0,
    "تاریخ آخرین فاکتور": lastByPhone[c.phone]?.date || "",
    "آخرین مشاهده": c.lastSeen || "",
  }));
  const fileName = `customers-${toJalali().full.replaceAll("/", "-")}`;
  if (window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 8 },
      { wch: 6 },
      { wch: 30 },
      { wch: 30 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مشتریان");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } else {
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  toast("خروجی اکسل دانلود شد ⬇️");
}

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2200);
}
