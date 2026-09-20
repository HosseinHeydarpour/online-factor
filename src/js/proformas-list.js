import {
  store,
  faNum,
  toJalali,
  fromJalali,
  todayFa,
  toEnDigits,
} from "./store.js";
import { buildPrintHTML, fitToSinglePage } from "./invoice.js";
import { autoSaveInvoices } from "./backup.js";
import { autoPushGitHub } from "./github.js";

function isValidJalaliDate(dateStr) {
  return typeof dateStr === "string" && /^\d{4}\/\d{2}\/\d{2}$/.test(dateStr);
}

// تنظیمات فیلتر با مقدار پیش‌فرض: امروز
const DEFAULT_PROFORMA_FILTER = {
  period: "today", // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  startDate: "",
  endDate: "",
  sortAmount: "none", // 'none' | 'amount-desc' | 'amount-asc'
  payment: "all",
};

let proformaFilter = { ...DEFAULT_PROFORMA_FILTER };

// دسترسی سراسری برای تغییر دوره زمانی
window.setProformaFilterPeriod = function (period) {
  proformaFilter.period = period;
  proformaFilter.startDate = "";
  proformaFilter.endDate = "";
  updateProformaPeriodButtonsUI();
  updateProformaFilterBadge();
  renderProformasList(
    document.getElementById("proforma-search")?.value.trim() || "",
  );
};

/* ---------- محاسبه بازه تاریخ شمسی دوره‌ها ---------- */
function getDateRangeForPeriod(period) {
  const now = new Date();
  const today = toJalali(now);

  if (period === "today") {
    return { start: today.full, end: today.full };
  }

  if (period === "yesterday") {
    const yesterday = toJalali(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return { start: yesterday.full, end: yesterday.full };
  }

  if (period === "week") {
    const dayOfWeek = (now.getDay() + 1) % 7; // شنبه = 0
    const saturday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOfWeek,
    );
    return { start: toJalali(saturday).full, end: today.full };
  }

  if (period === "month") {
    const ym = today.full.split("/").slice(0, 2).join("/");
    return { start: `${ym}/01`, end: today.full };
  }

  if (period === "all") {
    return { start: "", end: "" };
  }

  if (period === "custom") {
    return {
      start: proformaFilter.startDate || "",
      end: proformaFilter.endDate || "",
    };
  }

  return { start: "", end: "" };
}

/* ---------- شمارش فیلترهای پیشرفته فعال برای بج دکمه ---------- */
function updateProformaFilterBadge() {
  const badge = document.getElementById("proforma-filter-badge");
  if (!badge) return;

  let count = 0;
  if (proformaFilter.sortAmount !== "none") count++;
  if (proformaFilter.payment !== "all") count++;
  if (
    proformaFilter.period === "custom" &&
    (proformaFilter.startDate || proformaFilter.endDate)
  )
    count++;

  badge.textContent = faNum(count);
  badge.classList.toggle("hidden", count === 0);
}

/* ---------- استایل دکمه‌های دوره زمانی ---------- */
function updateProformaPeriodButtonsUI() {
  document.querySelectorAll(".pf-period-btn").forEach((btn) => {
    const active = btn.dataset.pfPeriod === proformaFilter.period;
    if (active) {
      btn.className =
        "pf-period-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-600 text-white shadow-sm transition min-h-[38px]";
    } else {
      btn.className =
        "pf-period-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition min-h-[38px]";
    }
  });
}

/* ---------- مدال فیلتر پیشرفته پیش‌فاکتورها ---------- */
function initProformaAdvancedFilterModal() {
  const modal = document.getElementById("proforma-filter-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  const btnOpen = document.getElementById("btn-proforma-advanced-filter");
  const btnClose = document.getElementById("btn-close-proforma-filter");
  const btnApply = document.getElementById("btn-apply-proforma-filter");
  const btnReset = document.getElementById("btn-reset-proforma-filter");

  const sortEl = document.getElementById("pf-sort-amount");
  const dateFromEl = document.getElementById("pf-date-from");
  const dateToEl = document.getElementById("pf-date-to");
  const paymentEl = document.getElementById("pf-payment");

  // فعال‌سازی تقویم فارسی
  if (window.$ && $.fn && $.fn.persianDatepicker) {
    $("#pf-date-from, #pf-date-to").persianDatepicker({
      format: "YYYY/MM/DD",
      initialValue: false,
      autoClose: true,
      calendar: { locale: "fa" },
    });
  }

  const openModal = () => {
    if (sortEl) sortEl.value = proformaFilter.sortAmount;
    if (dateFromEl) dateFromEl.value = proformaFilter.startDate;
    if (dateToEl) dateToEl.value = proformaFilter.endDate;
    if (paymentEl) paymentEl.value = proformaFilter.payment;
    modal.classList.remove("hidden");
  };

  const closeModal = () => {
    modal.classList.add("hidden");
  };

  btnOpen?.addEventListener("click", openModal);
  btnClose?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => e.target === modal && closeModal());

  btnApply?.addEventListener("click", () => {
    const sDate = dateFromEl ? dateFromEl.value.trim() : "";
    const eDate = dateToEl ? dateToEl.value.trim() : "";

    proformaFilter.sortAmount = sortEl ? sortEl.value : "none";
    proformaFilter.payment = paymentEl ? paymentEl.value : "all";
    proformaFilter.startDate = sDate;
    proformaFilter.endDate = eDate;

    if (sDate || eDate) {
      proformaFilter.period = "custom";
    }

    closeModal();
    updateProformaFilterBadge();
    updateProformaPeriodButtonsUI();
    renderProformasList(
      document.getElementById("proforma-search")?.value.trim() || "",
    );
  });

  btnReset?.addEventListener("click", () => {
    proformaFilter = { ...DEFAULT_PROFORMA_FILTER, period: "all" };
    if (sortEl) sortEl.value = "none";
    if (dateFromEl) dateFromEl.value = "";
    if (dateToEl) dateToEl.value = "";
    if (paymentEl) paymentEl.value = "all";

    closeModal();
    updateProformaFilterBadge();
    updateProformaPeriodButtonsUI();
    renderProformasList(
      document.getElementById("proforma-search")?.value.trim() || "",
    );
  });
}

/* ---------- راه‌اندازی صفحه پیش‌فاکتورها ---------- */
export function initProformasList() {
  const searchInput = document.getElementById("proforma-search");

  document.querySelectorAll(".pf-period-btn").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      proformaFilter.period = btn.dataset.pfPeriod;
      proformaFilter.startDate = "";
      proformaFilter.endDate = "";
      updateProformaPeriodButtonsUI();
      updateProformaFilterBadge();
      renderProformasList(searchInput?.value.trim() || "");
    });
  });

  initProformaAdvancedFilterModal();
  updateProformaPeriodButtonsUI();
  updateProformaFilterBadge();
  updateProformaBadge();

  renderProformasList(searchInput?.value.trim() || "");

  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "1";
    searchInput.addEventListener("input", () => {
      renderProformasList(searchInput.value.trim());
    });
  }
}

/* ---------- دریافت لیست فیلتر و سورت شده پیش‌فاکتورها ---------- */
function getFilteredProformas(query = "") {
  const proformas = store.getProformas();
  const q = (query || "").toLowerCase();
  const { start, end } = getDateRangeForPeriod(proformaFilter.period);

  let filtered = proformas.filter((pf) => {
    if (q) {
      const matchNum = pf.number.toString().includes(q);
      const matchName = (pf.customer?.name || "").toLowerCase().includes(q);
      const matchPhone = (pf.customer?.phone || "").includes(q);
      if (!matchNum && !matchName && !matchPhone) return false;
    }

    const pfDate = toEnDigits(pf.date || "")
      .replace(/[-._]/g, "/")
      .trim();
    if (start && pfDate < start) return false;
    if (end && pfDate > end) return false;

    if (proformaFilter.payment !== "all") {
      const pMethod = pf.payment || "نقدی";
      if (pMethod !== proformaFilter.payment) return false;
    }

    return true;
  });

  if (proformaFilter.sortAmount === "amount-desc") {
    filtered.sort((a, b) => (b.total || 0) - (a.total || 0));
  } else if (proformaFilter.sortAmount === "amount-asc") {
    filtered.sort((a, b) => (a.total || 0) - (b.total || 0));
  } else {
    filtered.sort((a, b) => (b.number || 0) - (a.number || 0));
  }

  return filtered;
}

/* ---------- رندر جدول پیش‌فاکتورها ---------- */
export function renderProformasList(query = "") {
  const container = document.getElementById("proformas-list");
  const emptyEl = document.getElementById("proformas-empty");
  if (!container) return;

  const filtered = getFilteredProformas(query);

  const totalRevenue = filtered.reduce((sum, pf) => sum + (pf.total || 0), 0);
  const totalCount = filtered.length;

  const uniqueDays = new Set(filtered.map((pf) => pf.date).filter(Boolean));
  const avgDaily =
    uniqueDays.size > 0 ? Math.round(totalRevenue / uniqueDays.size) : 0;

  const revEl = document.getElementById("proformas-total-revenue");
  const countEl = document.getElementById("proformas-total-count");
  const avgEl = document.getElementById("proformas-avg-daily");

  if (revEl) revEl.textContent = faNum(totalRevenue) + " تومان";
  if (countEl) countEl.textContent = faNum(totalCount) + " پیش‌فاکتور";
  if (avgEl) avgEl.textContent = faNum(avgDaily) + " تومان";

  updateProformaBadge();

  if (!filtered.length) {
    container.innerHTML = "";
    emptyEl?.classList.remove("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");

  container.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden fade-in">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-xs">
              <th class="py-3 px-3 text-center font-bold">#</th>
              <th class="py-3 px-3 text-right font-bold">شماره پیش‌فاکتور</th>
              <th class="py-3 px-3 text-right font-bold">تاریخ و ساعت</th>
              <th class="py-3 px-3 text-right font-bold">مشتری</th>
              <th class="py-3 px-3 text-right font-bold">اقلام پیش‌فاکتور</th>
              <th class="py-3 px-3 text-center font-bold">روش پرداخت</th>
              <th class="py-3 px-3 text-left font-bold">مبلغ نهایی (تومان)</th>
              <th class="py-3 px-3 text-center font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
            ${filtered
              .map((pf, idx) => {
                const jDateFull = isValidJalaliDate(pf.date)
                  ? pf.date
                  : toJalali().full;
                const jTime = pf.time || "—";
                const customerName = pf.customer?.name || "بدون نام";
                const customerPhone = pf.customer?.phone || "";

                const itemsCount = pf.items?.length || 0;
                const totalQty = (pf.items || []).reduce(
                  (s, it) => s + (it.qty || 1),
                  0,
                );
                const firstItemTitle = pf.items?.[0]?.title || "بدون شرح";
                const moreItemsCount =
                  itemsCount > 1
                    ? ` (+${faNum(itemsCount - 1)} مورد دیگر)`
                    : "";
                const allTitles = (pf.items || [])
                  .map((it) => it.title)
                  .join(" ، ");

                const payment = pf.payment || "نقدی";
                let payBadgeClass =
                  "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200";
                if (payment === "نقدی")
                  payBadgeClass =
                    "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
                if (payment === "کارت‌خوان")
                  payBadgeClass =
                    "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
                if (payment === "کارت به کارت")
                  payBadgeClass =
                    "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";

                return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
                  <td class="py-3 px-3 text-center">
                    <span class="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] font-bold inline-grid place-items-center">${faNum(idx + 1)}</span>
                  </td>
                  <td class="py-3 px-3 whitespace-nowrap">
                    <span class="font-extrabold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg text-xs">#${faNum(pf.number)}</span>
                  </td>
                  <td class="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    <div class="font-bold text-xs">${jDateFull}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${jTime}</div>
                  </td>
                  <td class="py-3 px-3">
                    <div class="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[140px]">${customerName}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5">${customerPhone || "—"}</div>
                  </td>
                  <td class="py-3 px-3 max-w-[220px]">
                    <div class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title="${allTitles}">
                      ${firstItemTitle}${moreItemsCount}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5">
                      ${faNum(totalQty)} عدد (${faNum(itemsCount)} سطر)
                    </div>
                  </td>
                  <td class="py-3 px-3 text-center whitespace-nowrap">
                    <span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${payBadgeClass}">
                      ${payment}
                    </span>
                  </td>
                  <td class="py-3 px-3 text-left whitespace-nowrap">
                    <div class="font-extrabold text-sm text-brand-700 dark:text-brand-400">
                      ${faNum(pf.total)}
                    </div>
                    ${
                      pf.discount > 0
                        ? `<div class="text-[10px] font-bold text-rose-500">تخفیف: ${faNum(pf.discount)}</div>`
                        : ""
                    }
                  </td>
                  <td class="py-3 px-3">
                    <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <!-- تایید و صدور فاکتور نهایی -->
                      <button onclick="window.confirmAndConvertProforma('${pf.number}')" title="تایید فروش و صدور فاکتور نهایی" class="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm transition flex items-center gap-1 min-h-[36px]">
                        <span>✅</span>
                        <span class="hidden md:inline">تایید و صدور</span>
                      </button>
                      <!-- مشاهده جزئیات -->
                      <button onclick="window.viewProforma('${pf.number}')" title="مشاهده جزئیات پیش‌فاکتور" class="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition flex items-center gap-1 min-h-[36px]">
                        <span>👁️</span>
                        <span class="hidden md:inline">مشاهده</span>
                      </button>
                      <!-- ویرایش -->
                      <button onclick="window.editProforma('${pf.number}')" title="ویرایش پیش‌فاکتور" class="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm transition flex items-center gap-1 min-h-[36px]">
                        <span>✏️</span>
                        <span class="hidden md:inline">ویرایش</span>
                      </button>
                      <!-- چاپ -->
                      <button onclick="window.printProforma('${pf.number}')" title="چاپ پیش‌فاکتور" class="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-sm transition flex items-center gap-1 min-h-[36px]">
                        <span>🖨️</span>
                        <span class="hidden md:inline">چاپ</span>
                      </button>
                      <!-- حذف -->
                      <button onclick="window.deleteProforma('${pf.number}')" title="حذف پیش‌فاکتور" class="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold shadow-sm transition flex items-center gap-1 min-h-[36px]">
                        <span>🗑️</span>
                        <span class="hidden md:inline">حذف</span>
                      </button>
                    </div>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- به‌روزرسانی بج تب پیش‌فاکتورها ---------- */
export function updateProformaBadge() {
  const badge = document.getElementById("proforma-tab-badge");
  if (!badge) return;
  const count = store.getProformas().length;
  badge.textContent = faNum(count);
  badge.classList.toggle("hidden", count === 0);
}

/* ============================================================
   عملیات‌های پیش‌فاکتور (تایید، مشاهده، چاپ، ویرایش، حذف)
============================================================ */

window.confirmAndConvertProforma = function (pfNumber) {
  const numericNumber = Number(pfNumber);
  const pf = store.getProforma(numericNumber);
  if (!pf) {
    alert("پیش‌فاکتور مورد نظر یافت نشد!");
    return;
  }

  const confirmMsg = `آیا از تایید فروش و صدور فاکتور قطعی برای پیش‌فاکتور شماره ${faNum(numericNumber)} اطمینان دارید؟\n(در صورت تایید، موجودی کالاهای فیزیکی از انبار کسر خواهد شد)`;
  if (!confirm(confirmMsg)) return;

  // ۱) بررسی موجودی کالاهای فیزیکی
  const items = pf.items || [];
  for (const item of items) {
    if (item.productId) {
      const product = store.getProduct(item.productId);
      if (product) {
        let currentStock = product.quantity ?? 0;
        if (item.variantId && product.variants?.length) {
          const v = product.variants.find((v) => v.id === item.variantId);
          if (v) currentStock = v.quantity ?? 0;
        }
        if (currentStock < item.qty) {
          alert(
            `⚠️ موجودی کالا «${item.title}» کافی نیست!\nموجودی فعلی در انبار: ${faNum(currentStock)} عدد\nتعداد در پیش‌فاکتور: ${faNum(item.qty)} عدد`,
          );
          return;
        }
      }
    }
  }

  // ۲) کسر موجودی از انبار
  items.forEach((item) => {
    if (item.productId) {
      const product = store.getProduct(item.productId);
      if (product) {
        let updated = false;
        if (item.variantId && product.variants?.length) {
          const vIdx = product.variants.findIndex(
            (v) => v.id === item.variantId,
          );
          if (vIdx >= 0) {
            const currentQty = product.variants[vIdx].quantity ?? 0;
            product.variants[vIdx].quantity = Math.max(
              0,
              currentQty - item.qty,
            );
            updated = true;
          }
        } else if (!item.variantId) {
          const currentQty = product.quantity ?? 0;
          product.quantity = Math.max(0, currentQty - item.qty);
          updated = true;
        }
        if (updated) store.saveProduct(product);
      }
    }
  });

  // ۳) صدور شماره فاکتور فروش رسمی و ثبت
  const newInvoiceNumber = store.nextInvoiceNumber();
  const today = toJalali();
  const invoice = {
    number: newInvoiceNumber,
    date: today.full,
    time: pf.time || "12:00",
    payment: pf.payment || "نقدی",
    customer: { ...(pf.customer || {}) },
    items: [...items],
    subtotal: pf.subtotal || 0,
    discount: pf.discount || 0,
    total: pf.total || 0,
    convertedFromProforma: numericNumber,
  };

  store.saveInvoice(invoice);

  // ۴) حذف پیش‌فاکتور تبدیل‌شده
  store.deleteProforma(numericNumber);

  autoSaveInvoices();
  autoPushGitHub(
    `تبدیل پیش‌فاکتور #${faNum(numericNumber)} به فاکتور فروش #${faNum(newInvoiceNumber)}`,
  );

  alert(
    `✅ پیش‌فاکتور شماره ${faNum(numericNumber)} با موفقیت به فاکتور فروش شماره ${faNum(newInvoiceNumber)} تبدیل شد.`,
  );

  updateProformaBadge();
  renderProformasList(
    document.getElementById("proforma-search")?.value.trim() || "",
  );
  if (typeof window.renderInvoicesList === "function") {
    window.renderInvoicesList();
  }

  // پیشنهاد مشاهده یا چاپ فاکتور قطعی
  if (
    confirm(
      `فاکتور شماره ${faNum(newInvoiceNumber)} صادر گردید.\nآیا مایلید فاکتور نهایی صادر شده را مشاهده نمایید؟`,
    )
  ) {
    if (typeof window.viewInvoice === "function") {
      window.viewInvoice(newInvoiceNumber);
    }
  }
};

window.viewProforma = function (pfNumber) {
  const numericNumber = Number(pfNumber);
  const pf = store.getProforma(numericNumber);
  if (!pf) return;

  window.lastDetailSource = "proformas";
  window.currentViewInvoiceNumber = numericNumber;

  let itemsHtml = (pf.items || [])
    .map(
      (item) => `
    <tr class="border-b border-slate-100 dark:border-slate-700 last:border-0">
      <td class="py-3 px-4 text-sm text-slate-700 dark:text-slate-200">${faNum(item.qty)}</td>
      <td class="py-3 px-4 text-sm text-slate-700 dark:text-slate-200">${item.title} ${item.meta ? `<span class="text-slate-400 text-xs">(${item.meta})</span>` : ""}</td>
      <td class="py-3 px-4 text-sm text-slate-500 dark:text-slate-400 text-left">${faNum(item.price)} تومان</td>
      <td class="py-3 px-4 text-sm font-bold text-brand-700 dark:text-brand-400 text-left">${faNum(item.price * item.qty)} تومان</td>
    </tr>
  `,
    )
    .join("");

  const shop = store.getShopInfo();
  const logoHtml = shop.logo
    ? `<img src="${shop.logo}" class="w-full h-full object-contain" />`
    : "ک";
  const customerName = pf.customer?.name || "بدون نام";
  const customerPhone = pf.customer?.phone || "-";
  const jDateFull = isValidJalaliDate(pf.date) ? pf.date : toJalali().full;
  const jTime = pf.time || "00:00";

  const detailHtml = `
    <div class="p-6">
      <!-- بنر وضعیت پیش‌فاکتور -->
      <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-bold">
          <span>📑</span>
          <span>این سند یک <b>پیش‌فاکتور فروش (غیر قطعی)</b> است و هنوز از موجودی انبار کسر نشده است.</span>
        </div>
        <button onclick="window.confirmAndConvertProforma('${pf.number}')" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5">
          <span>✅</span>
          <span>تایید و صدور فاکتور قطعی</span>
        </button>
      </div>

      <!-- سربرگ پیش‌فاکتور -->
      <div class="flex items-center justify-between pb-4 border-b-2 border-amber-100 dark:border-slate-700 mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl ${shop.logo ? "bg-white dark:bg-slate-700 p-1" : "bg-amber-600 text-white"} grid place-items-center text-lg font-bold shadow overflow-hidden">${logoHtml}</div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-extrabold text-lg text-slate-700 dark:text-slate-200">${shop.name || "کافی‌نت آنلاین"}</h2>
              <span class="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded">پیش‌فاکتور</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">${shop.slogan || "سیستم صدور فاکتور و نرخ‌نامه خدمات"}</p>
          </div>
        </div>
        <div class="text-left">
          <p class="text-xs text-slate-400">شماره پیش‌فاکتور</p>
          <p class="text-lg font-extrabold text-amber-700 dark:text-amber-400">#${faNum(pf.number)}</p>
        </div>
      </div>
      
      <!-- اطلاعات مشتری و تاریخ -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl">
        <div>
          <p class="text-xs text-slate-400 mb-1">نام مشتری</p>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${customerName}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">تلفن تماس</p>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${customerPhone}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">تاریخ صدور</p>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${jDateFull}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">ساعت صدور</p>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${jTime}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">روش پرداخت</p>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${pf.payment || "نقدی"}</p>
        </div>
      </div>
      
      <!-- جدول اقلام -->
      <div class="overflow-x-auto mb-6">
        <table class="w-full">
          <thead>
            <tr class="bg-amber-50 dark:bg-slate-700 border-y border-amber-100 dark:border-slate-600">
              <th class="py-3 px-4 text-xs font-bold text-amber-800 dark:text-amber-300 text-right">تعداد</th>
              <th class="py-3 px-4 text-xs font-bold text-amber-800 dark:text-amber-300 text-right">شرح خدمت / محصول</th>
              <th class="py-3 px-4 text-xs font-bold text-amber-800 dark:text-amber-300 text-left">قیمت واحد</th>
              <th class="py-3 px-4 text-xs font-bold text-amber-800 dark:text-amber-300 text-left">قیمت کل</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
      
      <!-- جمع‌بندی -->
      <div class="flex justify-between items-center flex-wrap gap-4 pt-2">
        <div class="flex items-center gap-2">
          <button onclick="window.confirmAndConvertProforma('${pf.number}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
            <span>✅</span>
            <span>تایید و صدور فاکتور قطعی</span>
          </button>
          <button onclick="window.editProforma('${pf.number}')" class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
            <span>✏️</span>
            <span>ویرایش</span>
          </button>
          <button onclick="window.printProforma('${pf.number}')" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
            <span>🖨️</span>
            <span>چاپ</span>
          </button>
          <button onclick="window.deleteProforma('${pf.number}')" class="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
            <span>🗑️</span>
            <span>حذف</span>
          </button>
        </div>

        <div class="w-full max-w-sm space-y-2">
          <div class="flex justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>جمع اقلام</span>
            <span>${faNum((pf.total || 0) + (pf.discount || 0))} تومان</span>
          </div>
          ${
            pf.discount > 0
              ? `
          <div class="flex justify-between text-sm text-rose-500">
            <span>تخفیف</span>
            <span>-${faNum(pf.discount)} تومان</span>
          </div>
          `
              : ""
          }
          <div class="flex justify-between text-base font-extrabold text-amber-700 dark:text-amber-400 border-t-2 border-amber-100 dark:border-slate-600 pt-2">
            <span>مبلغ قابل پرداخت</span>
            <span>${faNum(pf.total)} تومان</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const detailContainer = document.getElementById("invoice-detail-content");
  if (detailContainer) detailContainer.innerHTML = detailHtml;

  if (typeof setView === "function") {
    setView("invoice-detail");
  }
};

window.printProforma = async function (pfNumber) {
  const numericNumber = Number(pfNumber);
  const pf = store.getProforma(numericNumber);
  if (!pf) return;

  const html = await buildPrintHTML(pf.number, pf, true);
  const printArea = document.getElementById("print-area");
  if (!printArea) return;

  printArea.innerHTML = `<div id="invoice-fit"><div id="invoice-sheet">${html}</div></div>`;

  setTimeout(() => {
    if (typeof fitToSinglePage === "function") {
      fitToSinglePage();
    }
    window.print();
  }, 300);
};

window.editProforma = function (pfNumber) {
  const numericNumber = Number(pfNumber);
  const pf = store.getProforma(numericNumber);
  if (!pf) {
    alert("پیش‌فاکتور مورد نظر یافت نشد!");
    return;
  }

  if (typeof window.loadProformaForEdit === "function") {
    window.loadProformaForEdit(pf);
  }
  if (typeof setView === "function") {
    setView("invoice");
  }
};

window.deleteProforma = function (pfNumber) {
  const numericNumber = Number(pfNumber);
  const pf = store.getProforma(numericNumber);
  if (!pf) {
    alert("پیش‌فاکتور مورد نظر یافت نشد!");
    return;
  }

  const confirmMsg = `آیا از حذف پیش‌فاکتور شماره ${faNum(numericNumber)} اطمینان دارید؟`;
  if (!confirm(confirmMsg)) return;

  store.deleteProforma(numericNumber);
  autoSaveInvoices();
  autoPushGitHub(`حذف پیش‌فاکتور شماره ${faNum(numericNumber)}`);

  updateProformaBadge();

  if (typeof setView === "function") {
    setView("proformas");
  }

  renderProformasList(
    document.getElementById("proforma-search")?.value.trim() || "",
  );

  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = `🗑️ پیش‌فاکتور شماره ${faNum(numericNumber)} با موفقیت حذف شد`;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
  }
};
