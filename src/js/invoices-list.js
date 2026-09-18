import { store, faNum, toJalali, fromJalali } from "./store.js";

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
    filtered = invoices.filter(inv => 
      inv.invoiceNumber.toString().includes(query) ||
      (inv.customerName && inv.customerName.includes(query)) ||
      (inv.customerPhone && inv.customerPhone.includes(query))
    );
  }
  
  // محاسبه آمار
  const totalRevenue = filtered.reduce((sum, inv) => sum + inv.total, 0);
  const totalCount = filtered.length;
  
  // محاسبه میانگین روزانه
  const uniqueDays = new Set(filtered.map(inv => {
    // inv.date فرمت شمسی "1404/01/15" دارد
    return inv.date;
  }));
  const avgDaily = uniqueDays.size > 0 ? Math.round(totalRevenue / uniqueDays.size) : 0;
  
  // نمایش آمار
  document.getElementById("invoices-total-revenue").textContent = faNum(totalRevenue) + " تومان";
  document.getElementById("invoices-total-count").textContent = faNum(totalCount) + " فاکتور";
  document.getElementById("invoices-avg-daily").textContent = faNum(avgDaily) + " تومان";
  
  if (!filtered.length) {
    container.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  
  emptyEl.classList.add("hidden");
  
  container.innerHTML = filtered.map(inv => {
    // inv.date فرمت شمسی "1404/01/15" دارد
    const jDateParts = inv.date.split('/').map(Number);
    const jDate = {
      year: jDateParts[0],
      month: jDateParts[1],
      day: jDateParts[2],
      full: inv.date
    };
    // برای نمایش ساعت، اگر زمان ذخیره شده باشد از آن استفاده کن، در غیر این صورت زمان پیش‌فرض بگذار
    let jTime = "00:00";
    if (inv.time) {
      jTime = inv.time;
    } else {
      // سعی کن زمان را از تاریخ بسازی (اگر تاریخ معتبر باشد)
      try {
        const [iy, im, id] = inv.date.split('/').map(Number);
        const gDate = fromJalali(iy, im, id);
        if (!isNaN(gDate.getTime())) {
          jTime = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(gDate);
        }
      } catch (e) {
        jTime = "00:00";
      }
    }
    
    return `
      <div class="bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 transition fade-in">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 text-sm font-bold grid place-items-center">#${faNum(inv.invoiceNumber)}</span>
            <div>
              <p class="text-sm font-bold text-slate-700">${inv.customerName || "مشتری بدون نام"}</p>
              <p class="text-xs text-slate-400">${inv.customerPhone || ""}</p>
            </div>
          </div>
          <div class="text-left">
            <p class="text-xs text-slate-400">${jDate.full} - ${jTime}</p>
            <p class="text-sm font-extrabold text-brand-700 mt-1">${faNum(inv.total)} تومان</p>
          </div>
        </div>
        
        <!-- اقلام فاکتور -->
        <div class="border-t border-slate-100 pt-3 mt-2">
          <div class="space-y-1.5">
            ${inv.items.map(item => `
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-600 truncate max-w-[60%]">${item.title} ${item.meta ? `<span class="text-slate-400">(${item.meta})</span>` : ""}</span>
                <span class="text-slate-500">${faNum(item.qty)} × ${faNum(item.price)} = <b class="text-brand-700">${faNum(item.price * item.qty)}</b></span>
              </div>
            `).join("")}
          </div>
          ${inv.discount > 0 ? `
            <div class="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100">
              <span class="text-rose-500">تخفیف</span>
              <span class="text-rose-600 font-bold">-${faNum(inv.discount)} تومان</span>
            </div>
          ` : ""}
        </div>
        
        <!-- دکمه‌ها -->
        <div class="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
          <button data-view-invoice="${inv.id}" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold">👁️ مشاهده</button>
          <button data-print-invoice="${inv.id}" class="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-bold">🖨️ چاپ</button>
        </div>
      </div>
    `;
  }).join("");
  
  // افزودن ایونت‌ها
  setTimeout(() => {
    document.querySelectorAll("[data-view-invoice]").forEach(btn => {
      btn.addEventListener("click", () => {
        const invId = btn.dataset.viewInvoice;
        viewInvoice(invId);
      });
    });
    
    document.querySelectorAll("[data-print-invoice]").forEach(btn => {
      btn.addEventListener("click", () => {
        const invId = btn.dataset.printInvoice;
        printInvoice(invId);
      });
    });
  }, 0);
}

function viewInvoice(invId) {
  const invoice = store.getInvoices().find(inv => inv.id === invId);
  if (!invoice) return;
  
  alert(`فاکتور شماره ${invoice.invoiceNumber}\nمشتری: ${invoice.customerName || "بدون نام"}\nمبلغ کل: ${faNum(invoice.total)} تومان`);
}

function printInvoice(invId) {
  const invoice = store.getInvoices().find(inv => inv.id === invId);
  if (!invoice) return;
  
  // اینجا می‌توانید منطق چاپ را پیاده‌سازی کنید
  alert(`چاپ فاکتور شماره ${invoice.invoiceNumber}`);
}
