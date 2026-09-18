import { store, faNum, toJalali, fromJalali, todayFa } from "./store.js";
import { buildPrintHTML, fitToSinglePage } from "./invoice.js";

function isValidJalaliDate(dateStr) {
  return typeof dateStr === "string" && /^\d{4}\/\d{2}\/\d{2}$/.test(dateStr);
}

export function initInvoicesList() {
  const searchInput = document.getElementById("invoice-search");

  // بارگذاری اولیه
  renderInvoicesList();

  // ایونت جستجو
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderInvoicesList(searchInput.value.trim());
    });
  }
}

function renderInvoicesList(query = "") {
  const invoices = store.getInvoices();
  const container = document.getElementById("invoices-list");
  const emptyEl = document.getElementById("invoices-empty");

  // فیلتر بر اساس جستجو
  let filtered = invoices;
  if (query) {
    filtered = invoices.filter(
      (inv) =>
        inv.number.toString().includes(query) ||
        (inv.customer?.name && inv.customer.name.includes(query)) ||
        (inv.customer?.phone && inv.customer.phone.includes(query)),
    );
  }

  // محاسبه آمار
  const totalRevenue = filtered.reduce((sum, inv) => sum + inv.total, 0);
  const totalCount = filtered.length;

  // محاسبه میانگین روزانه
  const uniqueDays = new Set(
    filtered.map((inv) => {
      // inv.date فرمت شمسی "1404/01/15" دارد
      return inv.date;
    }),
  );
  const avgDaily =
    uniqueDays.size > 0 ? Math.round(totalRevenue / uniqueDays.size) : 0;

  // نمایش آمار
  document.getElementById("invoices-total-revenue").textContent =
    faNum(totalRevenue) + " تومان";
  document.getElementById("invoices-total-count").textContent =
    faNum(totalCount) + " فاکتور";
  document.getElementById("invoices-avg-daily").textContent =
    faNum(avgDaily) + " تومان";

  if (!filtered.length) {
    container.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  container.innerHTML = filtered
    .map((inv) => {
      const jDateFull = isValidJalaliDate(inv.date)
        ? inv.date
        : toJalali().full;
      // برای نمایش ساعت، اگر زمان ذخیره شده باشد از آن استفاده کن
      let jTime = "00:00";
      if (inv.time) {
        jTime = inv.time;
      }

      // استخراج نام و شماره تلفن مشتری
      const customerName = inv.customer?.name || "مشتری بدون نام";
      const customerPhone = inv.customer?.phone || "";

      return `
      <div class="bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 transition fade-in">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 text-sm font-bold grid place-items-center">#${faNum(inv.number)}</span>
            <div>
              <p class="text-sm font-bold text-slate-700">${customerName}</p>
              <p class="text-xs text-slate-400">${customerPhone}</p>
            </div>
          </div>
          <div class="text-left">
            <p class="text-xs text-slate-400">${jDateFull} - ${jTime}</p>
         <p class="text-sm font-extrabold text-brand-700 mt-1">${faNum(inv.total)} تومان <span class="text-[10px] font-bold text-slate-400">· ${inv.payment || "نقدی"}</span></p>
          </div>
        </div>
        
        <!-- اقلام فاکتور -->
        <div class="border-t border-slate-100 pt-3 mt-2">
          <div class="space-y-1.5">
            ${inv.items
              .map(
                (item) => `
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600 truncate max-w-[60%]">${item.title} ${item.meta ? `<span class="text-slate-400">(${item.meta})</span>` : ""}</span>
                <span class="text-slate-500">${faNum(item.qty)} × ${faNum(item.price)} = <b class="text-brand-700">${faNum(item.price * item.qty)}</b></span>
              </div>
            `,
              )
              .join("")}
          </div>
          ${
            inv.discount > 0
              ? `
            <div class="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100">
              <span class="text-rose-500">تخفیف</span>
              <span class="text-rose-600 font-bold">-${faNum(inv.discount)} تومان</span>
            </div>
          `
              : ""
          }
        </div>
        
        <!-- دکمه‌ها -->
        <div class="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
          <button onclick="window.viewInvoice('${inv.number}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold">👁️ مشاهده</button>
          <button onclick="window.printInvoice('${inv.number}')" class="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-bold">🖨️ چاپ</button>
        </div>
      </div>
    `;
    })
    .join("");
}

// قرار دادن توابع در window برای دسترسی از طریق onclick
let currentViewInvoiceNumber = null;

// ایونت‌های صفحه مشاهده فاکتور - باید بعد از رندر شدن DOM اجرا شوند
window.initInvoiceDetailEvents = function () {
  // دکمه بازگشت به لیست فاکتورها
  const btnBack = document.getElementById("btn-back-to-invoices");
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      if (typeof setView === "function") {
        setView("invoices");
      }
    });
  }

  // دکمه چاپ از صفحه مشاهده
  const btnPrintDetail = document.getElementById("btn-print-from-detail");
  if (btnPrintDetail) {
    btnPrintDetail.addEventListener("click", () => {
      if (currentViewInvoiceNumber) {
        window.printInvoice(currentViewInvoiceNumber);
      }
    });
  }
};

// // اجرای ایونت‌ها بعد از لود شدن صفحه
// window.initInvoiceDetailEvents();

window.viewInvoice = function (invNumber) {
  // تبدیل شماره فاکتور به عدد (چون از HTML می‌آید)
  const numericNumber = Number(invNumber);
  const invoice = store
    .getInvoices()
    .find((inv) => inv.number === numericNumber);

  console.log("GOH");
  if (!invoice) {
    console.log(
      "Invoice not found! Received Number:",
      invNumber,
      "Type:",
      typeof invNumber,
    );
    return;
  }

  console.log(invoice);
  currentViewInvoiceNumber = numericNumber;

  // ساخت HTML جزئیات فاکتور
  let itemsHtml = invoice.items
    .map(
      (item) => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="py-3 px-4 text-sm text-slate-700">${faNum(item.qty)}</td>
      <td class="py-3 px-4 text-sm text-slate-700">${item.title} ${item.meta ? `<span class="text-slate-400 text-xs">(${item.meta})</span>` : ""}</td>
      <td class="py-3 px-4 text-sm text-slate-500 text-left">${faNum(item.price)} تومان</td>
      <td class="py-3 px-4 text-sm font-bold text-brand-700 text-left">${faNum(item.price * item.qty)} تومان</td>
    </tr>
  `,
    )
    .join("");

  const customerName = invoice.customer?.name || "بدون نام";
  const customerPhone = invoice.customer?.phone || "-";
  const jDateFull = isValidJalaliDate(invoice.date)
    ? invoice.date
    : toJalali().full;
  const jTime = invoice.time || "00:00";

  const detailHtml = `
    <div class="p-6">
      <!-- سربرگ فاکتور -->
      <div class="flex items-center justify-between pb-4 border-b-2 border-brand-100 mb-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-brand-600 text-white grid place-items-center text-lg font-bold shadow">
            ک
          </div>
          <div>
            <h2 class="font-extrabold text-lg text-slate-700">کافی‌نت آنلاین</h2>
            <p class="text-xs text-slate-500">سیستم صدور فاکتور و نرخ‌نامه خدمات</p>
          </div>
        </div>
        <div class="text-left">
          <p class="text-xs text-slate-400">شماره فاکتور</p>
          <p class="text-lg font-extrabold text-brand-700">#${faNum(invoice.number)}</p>
        </div>
      </div>
      
      <!-- اطلاعات مشتری و تاریخ -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 bg-slate-50 p-4 rounded-xl">
        <div>
          <p class="text-xs text-slate-400 mb-1">نام مشتری</p>
          <p class="text-sm font-bold text-slate-700">${customerName}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">تلفن تماس</p>
          <p class="text-sm font-bold text-slate-700">${customerPhone}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">تاریخ صدور</p>
          <p class="text-sm font-bold text-slate-700">${jDateFull}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">ساعت صدور</p>
          <p class="text-sm font-bold text-slate-700">${jTime}</p>
        </div>
        <div>
          <p class="text-xs text-slate-400 mb-1">روش پرداخت</p>
          <p class="text-sm font-bold text-slate-700">${invoice.payment || "نقدی"}</p>
        </div>
      </div>
      
      <!-- جدول اقلام -->
      <div class="overflow-x-auto mb-6">
        <table class="w-full">
          <thead>
            <tr class="bg-brand-50 border-y border-brand-100">
              <th class="py-3 px-4 text-xs font-bold text-brand-700 text-right">تعداد</th>
              <th class="py-3 px-4 text-xs font-bold text-brand-700 text-right">شرح خدمت / محصول</th>
              <th class="py-3 px-4 text-xs font-bold text-brand-700 text-left">قیمت واحد</th>
              <th class="py-3 px-4 text-xs font-bold text-brand-700 text-left">قیمت کل</th>
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
          <div class="flex justify-between text-sm text-slate-500">
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
          <div class="flex justify-between text-base font-extrabold text-brand-700 border-t-2 border-brand-100 pt-2">
            <span>مبلغ قابل پرداخت</span>
            <span>${faNum(invoice.total)} تومان</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("invoice-detail-content").innerHTML = detailHtml;

  // تغییر ویو به مشاهده فاکتور
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

  // استفاده از تابع buildPrintHTML برای ساخت HTML چاپ
  const html = await buildPrintHTML(invoice.number, invoice);

  // قرار دادن HTML در ناحیه چاپ
  const printArea = document.getElementById("print-area");
  printArea.innerHTML = `<div id="invoice-fit"><div id="invoice-sheet">${html}</div></div>`;

  // اعمال استایل‌های لازم برای چاپ
  setTimeout(() => {
    if (typeof fitToSinglePage === "function") {
      fitToSinglePage();
    }
    window.print();
  }, 300);
};
