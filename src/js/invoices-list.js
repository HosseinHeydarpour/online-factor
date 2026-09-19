import {
  store,
  faNum,
  toJalali,
  fromJalali,
  todayFa,
  toEnDigits,
} from "./store.js";
import { buildPrintHTML, fitToSinglePage } from "./invoice.js";

function isValidJalaliDate(dateStr) {
  return typeof dateStr === "string" && /^\d{4}\/\d{2}\/\d{2}$/.test(dateStr);
}

// تنظیمات فیلتر با مقدار پیش‌فرض: امروز
const DEFAULT_INVOICE_FILTER = {
  period: "today", // 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  startDate: "",
  endDate: "",
  sortAmount: "none", // 'none' | 'amount-desc' | 'amount-asc'
  payment: "all",
};

let invoiceFilter = { ...DEFAULT_INVOICE_FILTER };

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
    // در تقویم شمسی شنبه آغاز هفته است (در JS روز یکشنبه 0 و شنبه 6 است)
    const dayOfWeek = (now.getDay() + 1) % 7; // شنبه = 0، یکشنبه = 1، ...
    const saturday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOfWeek,
    );
    return { start: toJalali(saturday).full, end: today.full };
  }

  if (period === "month") {
    const startOfMonth = `${today.year}/${String(today.month).padStart(2, "0")}/01`;
    return { start: startOfMonth, end: today.full };
  }

  if (period === "custom") {
    return {
      start: invoiceFilter.startDate
        ? toEnDigits(invoiceFilter.startDate).trim()
        : "",
      end: invoiceFilter.endDate
        ? toEnDigits(invoiceFilter.endDate).trim()
        : "",
    };
  }

  // حالت 'all'
  return { start: "", end: "" };
}

/* ---------- شمارش فیلترهای پیشرفته فعال برای بج دکمه ---------- */
function updateFilterBadge() {
  const badge = document.getElementById("invoice-filter-badge");
  if (!badge) return;

  let count = 0;
  if (invoiceFilter.sortAmount !== "none") count++;
  if (invoiceFilter.payment !== "all") count++;
  if (
    invoiceFilter.period === "custom" &&
    (invoiceFilter.startDate || invoiceFilter.endDate)
  )
    count++;

  badge.textContent = faNum(count);
  badge.classList.toggle("hidden", count === 0);
}

/* ---------- استایل دکمه‌های سریع دوره زمانی ---------- */
function updatePeriodButtonsUI() {
  document.querySelectorAll(".inv-period-btn").forEach((btn) => {
    const isSelected = btn.dataset.invPeriod === invoiceFilter.period;
    if (isSelected) {
      btn.className =
        "inv-period-btn shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brand-600 text-white shadow-sm transition";
    } else {
      btn.className =
        "inv-period-btn shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition";
    }
  });
}

/* ---------- اینیشیالایز مدال فیلتر پیشرفته ---------- */
function initAdvancedFilterModal() {
  const modal = document.getElementById("invoice-filter-modal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  const btnOpen = document.getElementById("btn-invoice-advanced-filter");
  const btnClose = document.getElementById("btn-close-invoice-filter");
  const btnApply = document.getElementById("btn-apply-invoice-filter");
  const btnReset = document.getElementById("btn-reset-invoice-filter");

  const sortEl = document.getElementById("if-sort-amount");
  const dateFromEl = document.getElementById("if-date-from");
  const dateToEl = document.getElementById("if-date-to");
  const paymentEl = document.getElementById("if-payment");

  // فعال‌سازی تقویم فارسی برای اینپوت‌های تاریخ مدال در صورت لود بودن کتابخانه
  if (window.$ && $.fn && $.fn.persianDatepicker) {
    $("#if-date-from, #if-date-to").persianDatepicker({
      format: "YYYY/MM/DD",
      initialValue: false,
      autoClose: true,
      calendar: { locale: "fa" },
    });
  }

  const openModal = () => {
    if (sortEl) sortEl.value = invoiceFilter.sortAmount;
    if (dateFromEl) dateFromEl.value = invoiceFilter.startDate;
    if (dateToEl) dateToEl.value = invoiceFilter.endDate;
    if (paymentEl) paymentEl.value = invoiceFilter.payment;
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

    invoiceFilter.sortAmount = sortEl ? sortEl.value : "none";
    invoiceFilter.payment = paymentEl ? paymentEl.value : "all";
    invoiceFilter.startDate = sDate;
    invoiceFilter.endDate = eDate;

    // اگر تاریخ مشخصی دستی وارد شد، دوره به کاستوم تبدیل شود
    if (sDate || eDate) {
      invoiceFilter.period = "custom";
    }

    closeModal();
    updateFilterBadge();
    updatePeriodButtonsUI();
    renderInvoicesList(
      document.getElementById("invoice-search")?.value.trim() || "",
    );
  });

  btnReset?.addEventListener("click", () => {
    invoiceFilter = { ...DEFAULT_INVOICE_FILTER, period: "all" };
    if (sortEl) sortEl.value = "none";
    if (dateFromEl) dateFromEl.value = "";
    if (dateToEl) dateToEl.value = "";
    if (paymentEl) paymentEl.value = "all";

    closeModal();
    updateFilterBadge();
    updatePeriodButtonsUI();
    renderInvoicesList(
      document.getElementById("invoice-search")?.value.trim() || "",
    );
  });
}

/* ---------- راه‌اندازی صفحه و لیسنرها ---------- */
export function initInvoicesList() {
  const searchInput = document.getElementById("invoice-search");

  // راه‌اندازی دکمه‌های دوره‌های زمانی سریع
  document.querySelectorAll(".inv-period-btn").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      invoiceFilter.period = btn.dataset.invPeriod;
      invoiceFilter.startDate = "";
      invoiceFilter.endDate = "";
      updatePeriodButtonsUI();
      updateFilterBadge();
      renderInvoicesList(searchInput?.value.trim() || "");
    });
  });

  initAdvancedFilterModal();
  updatePeriodButtonsUI();
  updateFilterBadge();

  // رندر اولیه جدول با فیلتر پیش‌فرض «امروز»
  renderInvoicesList(searchInput?.value.trim() || "");

  // رویداد جستجوی زنده
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "1";
    searchInput.addEventListener("input", () => {
      renderInvoicesList(searchInput.value.trim());
    });
  }
}

/* ---------- دریافت لیست فیلتر و سورت شده فاکتورها ---------- */
function getFilteredInvoices(query = "") {
  const invoices = store.getInvoices();
  const q = (query || "").toLowerCase();
  const { start, end } = getDateRangeForPeriod(invoiceFilter.period);

  let filtered = invoices.filter((inv) => {
    // جستجو بر اساس شماره، نام، یا تلفن
    if (q) {
      const matchNum = inv.number.toString().includes(q);
      const matchName = (inv.customer?.name || "").toLowerCase().includes(q);
      const matchPhone = (inv.customer?.phone || "").includes(q);
      if (!matchNum && !matchName && !matchPhone) return false;
    }

    // فیلتر تاریخ
    const invDate = toEnDigits(inv.date || "").trim();
    if (start && invDate < start) return false;
    if (end && invDate > end) return false;

    // فیلتر روش پرداخت
    if (invoiceFilter.payment !== "all") {
      const pMethod = inv.payment || "نقدی";
      if (pMethod !== invoiceFilter.payment) return false;
    }

    return true;
  });

  // مرتب‌سازی بر اساس مبلغ
  if (invoiceFilter.sortAmount === "amount-desc") {
    filtered.sort((a, b) => (b.total || 0) - (a.total || 0));
  } else if (invoiceFilter.sortAmount === "amount-asc") {
    filtered.sort((a, b) => (a.total || 0) - (b.total || 0));
  } else {
    // مرتب‌سازی پیش‌فرض بر اساس شماره فاکتور (جدیدترین به قدیمی‌ترین)
    filtered.sort((a, b) => (b.number || 0) - (a.number || 0));
  }

  return filtered;
}

/* ---------- رندر جدول فاکتورها ---------- */
export function renderInvoicesList(query = "") {
  const container = document.getElementById("invoices-list");
  const emptyEl = document.getElementById("invoices-empty");
  if (!container) return;

  const filtered = getFilteredInvoices(query);

  // محاسبه آمار فیلترشده
  const totalRevenue = filtered.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalCount = filtered.length;

  const uniqueDays = new Set(filtered.map((inv) => inv.date).filter(Boolean));
  const avgDaily =
    uniqueDays.size > 0 ? Math.round(totalRevenue / uniqueDays.size) : 0;

  // به‌روزرسانی کارت‌های آمار بالای صفحه
  const revEl = document.getElementById("invoices-total-revenue");
  const countEl = document.getElementById("invoices-total-count");
  const avgEl = document.getElementById("invoices-avg-daily");

  if (revEl) revEl.textContent = faNum(totalRevenue) + " تومان";
  if (countEl) countEl.textContent = faNum(totalCount) + " فاکتور";
  if (avgEl) avgEl.textContent = faNum(avgDaily) + " تومان";

  if (!filtered.length) {
    container.innerHTML = "";
    emptyEl?.classList.remove("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");

  // ساخت جدول مدرن و ریسپانسیو مشابه تب مشتریان با پشتیبانی کامل از دارک‌مود
  container.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden fade-in">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-xs">
              <th class="py-3 px-3 text-center font-bold">#</th>
              <th class="py-3 px-3 text-right font-bold">شماره فاکتور</th>
              <th class="py-3 px-3 text-right font-bold">تاریخ و ساعت</th>
              <th class="py-3 px-3 text-right font-bold">مشتری</th>
              <th class="py-3 px-3 text-right font-bold">اقلام فاکتور</th>
              <th class="py-3 px-3 text-center font-bold">روش پرداخت</th>
              <th class="py-3 px-3 text-left font-bold">مبلغ نهایی (تومان)</th>
              <th class="py-3 px-3 text-center font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
            ${filtered
              .map((inv, idx) => {
                const jDateFull = isValidJalaliDate(inv.date)
                  ? inv.date
                  : toJalali().full;
                const jTime = inv.time || "—";
                const customerName = inv.customer?.name || "بدون نام";
                const customerPhone = inv.customer?.phone || "";

                // خلاصه اقلام
                const itemsCount = inv.items?.length || 0;
                const totalQty = (inv.items || []).reduce(
                  (s, it) => s + (it.qty || 1),
                  0,
                );
                const firstItemTitle = inv.items?.[0]?.title || "بدون شرح";
                const moreItemsCount =
                  itemsCount > 1
                    ? ` (+${faNum(itemsCount - 1)} مورد دیگر)`
                    : "";
                const allTitles = (inv.items || [])
                  .map((it) => it.title)
                  .join(" ، ");

                // روش پرداخت
                const payment = inv.payment || "نقدی";
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
                    <span class="font-extrabold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2.5 py-1 rounded-lg text-xs">#${faNum(inv.number)}</span>
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
                      ${faNum(inv.total)}
                    </div>
                    ${
                      inv.discount > 0
                        ? `<div class="text-[10px] font-bold text-rose-500">تخفیف: ${faNum(inv.discount)}</div>`
                        : ""
                    }
                  </td>
                  <td class="py-3 px-3">
                    <div class="flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <button onclick="window.viewInvoice('${inv.number}')" title="مشاهده جزئیات" class="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg font-bold transition">👁️ مشاهده</button>
                      <button onclick="window.printInvoice('${inv.number}')" title="چاپ فاکتور" class="text-xs bg-brand-600 hover:bg-brand-700 text-white px-2.5 py-1.5 rounded-lg font-bold shadow-sm transition">🖨️ چاپ</button>
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

// قرار دادن توابع در window برای دسترسی مستقیم onclick
let currentViewInvoiceNumber = null;

window.initInvoiceDetailEvents = function () {
  const btnBack = document.getElementById("btn-back-to-invoices");
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      if (typeof setView === "function") {
        setView("invoices");
      }
    });
  }

  const btnPrintDetail = document.getElementById("btn-print-from-detail");
  if (btnPrintDetail) {
    btnPrintDetail.addEventListener("click", () => {
      if (currentViewInvoiceNumber) {
        window.printInvoice(currentViewInvoiceNumber);
      }
    });
  }
};

window.viewInvoice = function (invNumber) {
  const numericNumber = Number(invNumber);
  const invoice = store
    .getInvoices()
    .find((inv) => inv.number === numericNumber);
  if (!invoice) return;

  currentViewInvoiceNumber = numericNumber;

  let itemsHtml = invoice.items
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
  const customerName = invoice.customer?.name || "بدون نام";
  const customerPhone = invoice.customer?.phone || "-";
  const jDateFull = isValidJalaliDate(invoice.date)
    ? invoice.date
    : toJalali().full;
  const jTime = invoice.time || "00:00";

  const detailHtml = `
    <div class="p-6">
      <!-- سربرگ فاکتور -->
      <div class="flex items-center justify-between pb-4 border-b-2 border-brand-100 dark:border-slate-700 mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl ${shop.logo ? "bg-white dark:bg-slate-700 p-1" : "bg-brand-600 text-white"} grid place-items-center text-lg font-bold shadow overflow-hidden">${logoHtml}</div>
          <div>
            <h2 class="font-extrabold text-lg text-slate-700 dark:text-slate-200">${shop.name || "کافی‌نت آنلاین"}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">${shop.slogan || "سیستم صدور فاکتور و نرخ‌نامه خدمات"}</p>
          </div>
        </div>
        <div class="text-left">
          <p class="text-xs text-slate-400">شماره فاکتور</p>
          <p class="text-lg font-extrabold text-brand-700 dark:text-brand-400">#${faNum(invoice.number)}</p>
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
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${invoice.payment || "نقدی"}</p>
        </div>
      </div>
      
      <!-- جدول اقلام -->
      <div class="overflow-x-auto mb-6">
        <table class="w-full">
          <thead>
            <tr class="bg-brand-50 dark:bg-slate-700 border-y border-brand-100 dark:border-slate-600">
              <th class="py-3 px-4 text-xs font-bold text-brand-700 dark:text-brand-400 text-right">تعداد</th>
              <th class="py-3 px-4 text-xs font-bold text-brand-700 dark:text-brand-400 text-right">شرح خدمت / محصول</th>
              <th class="py-3 px-4 text-xs font-bold text-brand-700 dark:text-brand-400 text-left">قیمت واحد</th>
              <th class="py-3 px-4 text-xs font-bold text-brand-700 dark:text-brand-400 text-left">قیمت کل</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>
      
      <!-- جمع‌بندی -->
      <div class="flex justify-end">
        <div class="w-full max-w-sm space-y-2">
          <div class="flex justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>جمع اقلام</span>
            <span>${faNum(invoice.total + (invoice.discount || 0))} تومان</span>
          </div>
          ${
            invoice.discount > 0
              ? `
          <div class="flex justify-between text-sm text-rose-500">
            <span>تخفیف</span>
            <span>-${faNum(invoice.discount)} تومان</span>
          </div>
          `
              : ""
          }
          <div class="flex justify-between text-base font-extrabold text-brand-700 dark:text-brand-400 border-t-2 border-brand-100 dark:border-slate-600 pt-2">
            <span>مبلغ قابل پرداخت</span>
            <span>${faNum(invoice.total)} تومان</span>
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

window.printInvoice = async function (invNumber) {
  const numericNumber = Number(invNumber);
  const invoice = store
    .getInvoices()
    .find((inv) => inv.number === numericNumber);
  if (!invoice) return;

  const html = await buildPrintHTML(invoice.number, invoice);
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

window.initInvoicesList = initInvoicesList;
window.renderInvoicesList = renderInvoicesList;
