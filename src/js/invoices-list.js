import { store, faNum, toJalali, fromJalali, todayFa } from "./store.js";
import { buildPrintHTML, fitToSinglePage } from "./invoice.js";

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
      inv.number.toString().includes(query) ||
      (inv.customer?.name && inv.customer.name.includes(query)) ||
      (inv.customer?.phone && inv.customer.phone.includes(query))
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
    let jDateFull = inv.date || toJalali().full;
    // اطمینان از فرمت صحیح تاریخ
    if (!jDateFull.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
      // اگر فرمت درست نیست، از تاریخ امروز استفاده کن
      jDateFull = toJalali().full;
    }
    
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
          <button onclick="window.viewInvoice('${inv.number}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold">👁️ مشاهده</button>
          <button onclick="window.printInvoice('${inv.number}')" class="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-bold">🖨️ چاپ</button>
        </div>
      </div>
    `;
  }).join("");
}

// قرار دادن توابع در window برای دسترسی از طریق onclick
window.viewInvoice = function(invNumber) {
  // تبدیل شماره فاکتور به عدد (چون از HTML می‌آید)
  const numericNumber = Number(invNumber);
  const invoice = store.getInvoices().find(inv => inv.number === numericNumber);
  
  console.log("GOH");
  if (!invoice) {
    console.log("Invoice not found! Received Number:", invNumber, "Type:", typeof invNumber);
    return;
  }
  
  console.log(invoice);
  let itemsHtml = invoice.items.map(item => 
    `• ${item.title} ${item.meta ? `(${item.meta})` : ''}: ${faNum(item.qty)} × ${faNum(item.price)} = ${faNum(item.price * item.qty)} تومان`
  ).join('\n');
  
  let message = `فاکتور شماره ${faNum(invoice.number)}\n`;
  message += `مشتری: ${invoice.customer?.name || "بدون نام"}\n`;
  message += `تاریخ: ${invoice.date} - ساعت: ${invoice.time}\n`;
  message += `تلفن: ${invoice.customer?.phone || "-"}\n\n`;
  message += `اقلام:\n${itemsHtml}\n\n`;
  if (invoice.discount > 0) {
    message += `تخفیف: ${faNum(invoice.discount)} تومان\n`;
  }
  message += `جمع کل: ${faNum(invoice.total)} تومان`;
  
  console.log("CLICKED!");
  alert(message);
};

window.printInvoice = async function(invNumber) {
  const numericNumber = Number(invNumber);
  const invoice = store.getInvoices().find(inv => inv.number === numericNumber);
  if (!invoice) return;
  
  // استفاده از تابع buildPrintHTML برای ساخت HTML چاپ
  const html = await buildPrintHTML(invoice.number, invoice);
  
  // قرار دادن HTML در ناحیه چاپ
  const printArea = document.getElementById("print-area");
  printArea.innerHTML = `<div id="invoice-fit"><div id="invoice-sheet">${html}</div></div>`;
  
  // اعمال استایل‌های لازم برای چاپ
  setTimeout(() => {
    if (typeof fitToSinglePage === 'function') {
      fitToSinglePage();
    }
    window.print();
  }, 300);
};

