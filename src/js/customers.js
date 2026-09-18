import { store, faNum, toJalali } from "./store.js";

const el = {
  list: null,
  empty: null,
  search: null,
  total: null,
};

export function initCustomers() {
  el.list = document.getElementById("customers-list");
  el.empty = document.getElementById("customers-empty");
  el.search = document.getElementById("customer-search");
  el.total = document.getElementById("customers-total-count");

  if (el.search && !el.search.dataset.bound) {
    el.search.dataset.bound = "1";
    el.search.addEventListener("input", () => {
      renderCustomers(el.search.value.trim());
    });
  }

  const exportBtn = document.getElementById("btn-export-customers");
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = "1";
    exportBtn.addEventListener("click", exportCustomersExcel);
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
      (c.phone || "").toLowerCase().includes(q),
  );

  if (el.total) el.total.textContent = faNum(customers.length) + " نفر";

  if (!filtered.length) {
    el.list.innerHTML = "";
    el.empty?.classList.remove("hidden");
    return;
  }
  el.empty?.classList.add("hidden");

  // آمار از روی فاکتورها
  const invoices = store.getInvoices();
  const countByPhone = {};
  const lastByPhone = {};
  invoices.forEach((inv) => {
    const ph = inv.customer?.phone || "";
    if (!ph) return;
    countByPhone[ph] = (countByPhone[ph] || 0) + 1;
    if (!lastByPhone[ph] || (inv.date && inv.date > lastByPhone[ph].date)) {
      lastByPhone[ph] = inv;
    }
  });

  // ✅ نمایش لیستی (ردیفی) به‌جای کارتی
  el.list.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 shadow-sm">
      ${filtered
        .map((c) => {
          const count = countByPhone[c.phone] || 0;
          const last = lastByPhone[c.phone];
          const lastDate = last ? last.date : "—";
          const initial = (c.name || "؟").charAt(0);
          return `
          <div class="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-extrabold grid place-items-center shrink-0">${initial}</div>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-sm truncate">${c.name || "بدون نام"}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${c.phone || "بدون شماره"}</p>
            </div>
            <div class="text-left shrink-0 hidden md:block">
              <p class="text-[11px] text-slate-400">آخرین: <span class="font-bold text-slate-600 dark:text-slate-300">${lastDate}</span></p>
              <p class="text-xs font-bold text-brand-700 dark:text-brand-400 mt-0.5">${faNum(count)} فاکتور</p>
            </div>
            <span class="md:hidden text-[10px] font-bold text-brand-700 dark:text-brand-400 shrink-0">${faNum(count)} فاکتور</span>
            <div class="flex items-center gap-1.5 shrink-0">
              <button data-use-customer="${c.id}" title="افزودن به فاکتور" class="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 sm:px-3 py-2 rounded-lg font-bold">➕ فاکتور</button>
              <button data-edit-customer="${c.id}" title="ویرایش" class="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 py-2 rounded-lg font-bold">✏️</button>
              <button data-delete-customer="${c.id}" title="حذف" class="text-xs bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 px-2.5 py-2 rounded-lg font-bold">🗑️</button>
            </div>
          </div>`;
        })
        .join("")}
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
    });
  });

  el.list.querySelectorAll("[data-delete-customer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("این مشتری از لیست حذف شود؟ (فاکتورهای او باقی می‌مانند)"))
        return;
      store.deleteCustomer(btn.dataset.deleteCustomer);
      renderCustomers(el.search?.value.trim() || "");
      toast("مشتری حذف شد 🗑️");
    });
  });
}

/* ---------- خروجی اکسل ---------- */
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
    if (!lastByPhone[ph] || (inv.date && inv.date > lastByPhone[ph].date)) {
      lastByPhone[ph] = inv;
    }
  });

  const rows = customers.map((c, i) => ({
    ردیف: i + 1,
    "نام مشتری": c.name || "",
    "شماره تماس": c.phone || "",
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
      { wch: 25 },
      { wch: 15 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مشتریان");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } else {
    // فال‌بک: CSV با BOM (اکسل با فارسی درست باز می‌کند)
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
