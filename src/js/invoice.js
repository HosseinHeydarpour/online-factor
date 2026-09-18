import {
  store,
  faNum,
  todayFa,
  nowTimeFa,
  numberToWordsFa,
  toJalali,
} from "./store.js";
import { autoSaveInvoices } from "./backup.js";
import { autoPushGitHub } from "./github.js";

import {
  openCustomerDetails,
  setCustomerDetailsFormValues,
  hasCustomerExtras,
} from "./customers.js";

const EMPTY_CUSTOMER = {
  name: "",
  phone: "",
  nationalCode: "",
  birthCertNo: "",
  address: "",
  gender: "",
  age: "",
  notes: "",
};

const state = {
  items: [],
  discount: 0,
  customer: { ...EMPTY_CUSTOMER },
  payment: "نقدی",
  number: null,
};

const el = {
  list: document.getElementById("invoice-items"),
  subtotal: document.getElementById("sum-subtotal"),
  discount: document.getElementById("sum-discount"),
  total: document.getElementById("sum-total"),
  discountInput: document.getElementById("invoice-discount"),
  custName: document.getElementById("cust-name"),
  custPhone: document.getElementById("cust-phone"),
  printArea: document.getElementById("print-area"),
};

export function addItemToInvoice({ title, price, meta = "" }) {
  if (!state.number) state.number = store.nextInvoiceNumber();
  const found = state.items.find((i) => i.title === title && i.price === price);
  if (found) found.qty += 1;
  else
    state.items.push({
      rowId: crypto.randomUUID(),
      title,
      price,
      qty: 1,
      meta,
    });
  render();
}

export function clearInvoice() {
  state.items = [];
  state.discount = 0;
  state.number = null;
  state.payment = "نقدی";
  state.customer = { ...EMPTY_CUSTOMER }; // ✅
  el.custName.value = ""; // ✅
  el.custPhone.value = ""; // ✅
  setCustomerDetailsFormValues(state.customer); // ✅ سینک دیالوگ
  updateDetailsBadge(); // ✅
  const defaultRadio = document.querySelector(
    'input[name="payment-method"][value="نقدی"]',
  );
  if (defaultRadio) defaultRadio.checked = true;
  el.discountInput.value = 0;
  render();
}
function totals() {
  const subtotal = state.items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.min(state.discount || 0, subtotal);
  return { subtotal, discount, total: subtotal - discount };
}
function updateDetailsBadge() {
  const badge = document.getElementById("customer-details-badge");
  if (badge)
    badge.classList.toggle("hidden", !hasCustomerExtras(state.customer));
}
function render() {
  const t = totals();
  el.list.innerHTML = state.items.length
    ? state.items
        .map(
          (
            i,
          ) => `<div class="border border-slate-200 rounded-xl p-2.5 text-xs fade-in">
            <div class="flex justify-between gap-2">
              <div class="min-w-0">
                <p class="font-bold truncate">${i.title}</p>
                ${i.meta ? `<p class="text-slate-400 mt-0.5">${i.meta}</p>` : ""}
                <p class="text-slate-500 mt-0.5">${faNum(i.price)} تومان</p>
              </div>
              <button data-del="${i.rowId}" class="text-rose-400 hover:text-rose-600 shrink-0">✕</button>
            </div>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-1">
                <button data-dec="${i.rowId}" class="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 font-bold">−</button>
                <span class="w-8 text-center font-bold">${faNum(i.qty)}</span>
                <button data-inc="${i.rowId}" class="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 font-bold">+</button>
              </div>
              <b class="text-brand-700">${faNum(i.price * i.qty)} تومان</b>
            </div>
          </div>`,
        )
        .join("")
    : `<p class="text-center text-slate-400 text-xs py-8">هنوز آیتمی به فاکتور اضافه نشده.<br>از لیست خدمات یا محصولات، آیتم انتخاب کنید.</p>`;

  el.subtotal.textContent = faNum(t.subtotal) + " تومان";
  el.discount.textContent = faNum(t.discount) + " تومان";
  el.total.textContent = faNum(t.total) + " تومان";
  const mobileTotal = document.getElementById("mobile-sum-total");
  if (mobileTotal) mobileTotal.textContent = faNum(t.total) + " تومان";
}

/* ============================================================
   ساخت HTML فاکتور — چیدمان افقی (Landscape A4)
   ============================================================ */
export async function buildPrintHTML(number, invoiceData = null) {
  const shop = store.getShopInfo();

  // اگر invoiceData داده شده، از آن استفاده کن، در غیر این صورت از state فعلی
  const items = invoiceData ? invoiceData.items : state.items;
  const customer = invoiceData ? invoiceData.customer : state.customer;
  const discount = invoiceData ? invoiceData.discount : state.discount;
  const total = invoiceData ? invoiceData.total : totals().total;
  const subtotal = invoiceData ? invoiceData.subtotal : totals().subtotal;

  let qr = "";
  try {
    if (window.QRCode) {
      qr = await window.QRCode.toDataURL(
        `INV:${number}|TOTAL:${total}|DATE:${new Date().toISOString().slice(0, 10)}|CUST:${customer.name || "-"}`,
        { width: 120, margin: 1, color: { dark: "#0c4a6e", light: "#ffffff" } },
      );
    }
  } catch (e) {
    console.error("QR error:", e);
  }

  const rows = items
    .map(
      (
        i,
        idx,
      ) => `<tr style="background:${idx % 2 === 0 ? "#f8fafc" : "#ffffff"};border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 8px;text-align:center;font-size:12px;font-weight:700;color:#475569;">${faNum(idx + 1)}</td>
      <td style="padding:10px 14px;text-align:right;">
        <div style="font-size:12.5px;font-weight:700;color:#0f172a;line-height:1.8;">${i.title}</div>
        ${i.meta ? `<div style="font-size:10px;color:#64748b;margin-top:3px;line-height:1.6;">${i.meta}</div>` : ""}
      </td>
      <td style="padding:10px 8px;text-align:center;font-size:12.5px;font-weight:700;">${faNum(i.qty)}</td>
      <td style="padding:10px 10px;text-align:center;font-size:12px;color:#475569;">${faNum(i.price)}</td>
      <td style="padding:10px 10px;text-align:center;font-size:12.5px;font-weight:800;color:#0369a1;">${faNum(i.price * i.qty)}</td>
    </tr>`,
    )
    .join("");

  // تاریخ و ساعت - اگر invoiceData داده شده از آن استفاده کن
  const dateStr = invoiceData
    ? `${invoiceData.date} - ${invoiceData.time}`
    : `${todayFa()} - ${nowTimeFa()}`;
  // ✅ اضافه شد — برای فاکتورهای قدیمی که payment ندارند، پیش‌فرض نقدی
  const payment = invoiceData ? invoiceData.payment || "نقدی" : state.payment;

  return `
<div dir="rtl" style="font-family:'Vazirmatn',Tahoma,sans-serif;color:#0f172a;background:#ffffff;width:100%;">
  <!-- نوار رنگی بالا -->
  <div style="height:7px;background:linear-gradient(90deg,#0ea5e9,#0284c7,#0369a1);border-radius:0 0 8px 8px;"></div>

  <!-- ===== هدر ===== -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 30px 16px;border-bottom:2px solid #0ea5e9;">
    <div style="display:flex;align-items:center;gap:16px;">
      ${
        shop.logo
          ? `<img src="${shop.logo}" style="width:66px;height:66px;object-fit:contain;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;padding:3px;" />`
          : `<div style="width:66px;height:66px;border-radius:14px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;">ک</div>`
      }
      <div>
        <div style="font-size:23px;font-weight:900;color:#0c4a6e;line-height:1.5;">${shop.name || "کافی‌نت آنلاین"}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px;line-height:1.7;">${shop.slogan || "ارائه‌دهنده خدمات اینترنتی و ثبت‌نام‌های دولتی"}</div>
        ${
          shop.phone || shop.address
            ? `
        <div style="font-size:10.5px;color:#475569;margin-top:5px;line-height:1.7;">
          ${shop.phone ? `تلفن: ${shop.phone}` : ""}${shop.phone && shop.address ? " &nbsp;|&nbsp; " : ""}${shop.address ? `آدرس: ${shop.address}` : ""}
        </div>`
            : ""
        }
      </div>
    </div>
    <div style="text-align:center;">
      <div style="background:linear-gradient(135deg,#0284c7,#0c4a6e);color:#fff;border-radius:12px;padding:9px 26px;box-shadow:0 4px 10px rgba(2,132,199,.25);">
        <div style="font-size:9.5px;opacity:.9;">شماره فاکتور</div>
        <div style="font-size:21px;font-weight:900;letter-spacing:.5px;margin-top:1px;">${faNum(number)}</div>
      </div>
      <div style="font-size:10.5px;color:#64748b;margin-top:9px;line-height:1.9;">
        تاریخ صدور: ${dateStr}
      </div>
    </div>
  </div>

  <!-- ===== اطلاعات مشتری ===== -->
  <div style="display:flex;gap:16px;padding:16px 30px 0;">
    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:10.5px;color:#64748b;font-weight:600;">تحویل‌گیرنده:</span>
      <span style="font-size:13px;font-weight:800;">${customer.name || "—"}</span>
    </div>
    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:10.5px;color:#64748b;font-weight:600;">شماره تماس:</span>
      <span style="font-size:13px;font-weight:800;">${customer.phone || "—"}</span>
    </div>
    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:10.5px;color:#64748b;font-weight:600;">نوع پرداخت:</span>
      <span style="font-size:13px;font-weight:800;">${payment}</span>
    </div>
  </div>

  <!-- ===== جدول اقلام ===== -->
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
   <thead>
  <tr style="background:#0c4a6e;color:#ffffff;">
    <th style="padding:11px 8px;width:48px;font-size:11px;font-weight:800;text-align:center;">ردیف</th>
    <th style="padding:11px 14px;font-size:11px;font-weight:800;text-align:right;">شرح خدمت / کالا</th>
    <th style="padding:11px 8px;width:66px;font-size:11px;font-weight:800;text-align:center;">تعداد</th>
    <th style="padding:11px 10px;width:125px;font-size:11px;font-weight:800;text-align:center;">فی (تومان)</th>
    <th style="padding:11px 10px;width:135px;font-size:11px;font-weight:800;text-align:center;">جمع (تومان)</th>
  </tr>
</thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- ===== جمع‌ها + QR + مهر (در یک ردیف افقی) ===== -->
  <div style="display:flex;gap:24px;align-items:center;padding:18px 30px 0;">
    <!-- باکس جمع -->
    <div class="inv-block" style="width:360px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;border-radius:12px;padding:13px 18px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#475569;">
        <span>جمع اقلام:</span><b style="color:#0f172a;">${faNum(subtotal)} تومان</b>
      </div>
      ${
        discount > 0
          ? `
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#dc2626;">
        <span>تخفیف:</span><b>${faNum(discount)} تومان</b>
      </div>`
          : ""
      }
      <div style="border-top:1.5px solid #7dd3fc;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;">
        <span style="font-size:13px;font-weight:800;color:#0c4a6e;">مبلغ قابل پرداخت:</span>
        <b style="font-size:19px;font-weight:900;color:#0284c7;">${faNum(total)} <span style="font-size:10px;font-weight:600;">تومان</span></b>
      </div>
      <div style="margin-top:10px;background:#dbeafe;border-radius:8px;padding:7px 10px;font-size:10px;color:#1e40af;text-align:center;line-height:1.8;font-weight:600;">
        به حروف: ${numberToWordsFa(total)} تومان
      </div>
    </div>
    <div style="flex:1;"></div>
    <!-- QR -->
    ${
      qr
        ? `
    <div style="text-align:center;">
      <img src="${qr}" style="width:86px;height:86px;border:1px solid #e2e8f0;border-radius:8px;padding:3px;" />
      <div style="font-size:9px;color:#94a3b8;margin-top:5px;font-weight:600;">کد اصالت فاکتور</div>
    </div>`
        : ""
    }
    <!-- محل مهر -->
    <div style="width:100px;height:100px;border:2px dashed #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:9.5px;color:#94a3b8;font-weight:600;line-height:1.7;">
      محل مهر<br/>و امضا
    </div>
  </div>

  <!-- ===== پاورقی ===== -->
  <div style="text-align:center;font-size:10.5px;color:#64748b;padding:16px 30px 14px;line-height:1.9;">
    <b style="color:#0c4a6e;font-size:12px;">از خرید شما متشکریم 🌷</b><br/>
    این فاکتور به‌صورت الکترونیکی صادر شده و معتبر می‌باشد. کالاها و خدمات ارائه‌شده مشمول شرایط و ضوابط کافی‌نت هستند.
  </div>

  <!-- نوار رنگی پایین -->
  <div style="height:6px;background:linear-gradient(90deg,#0369a1,#0284c7,#0ea5e9);border-radius:8px 8px 0 0;"></div>
</div>`;
}

/* ============================================================
   جاگذاری خودکار فاکتور در یک صفحه (Auto-Fit)
   روش: transform:scale (پشتیبانی کامل در چاپ همه مرورگرها)
   + پوشش ارتفاع ثابت (#invoice-fit) برای جلوگیری از شکست صفحه
   صفحه A4 افقی منهای حاشیه‌ها ≈ 1047×733 پیکسل
   ============================================================ */
const PAGE = {
  widthPx: 1047, // عرض قابل چاپ A4 landscape
  heightPx: 715, // ارتفاع قابل چاپ (با حاشیه اطمینان)
  minZoom: 0.55, // حداقل کوچک‌نمایی مجاز
};

// اندازه‌گیری مخفیانه ارتفاع sheet با عرض واقعی صفحه چاپ
export function measureSheet(sheet, widthPx = PAGE.widthPx) {
  const printArea = document.getElementById("print-area");
  if (!printArea) return 0;
  printArea.style.cssText =
    "display:block;position:absolute;left:-10000px;top:0;" +
    "width:" +
    widthPx +
    "px;visibility:hidden;";
  const h = sheet.scrollHeight;
  printArea.style.cssText = "";
  return h;
}

export async function fitToSinglePage() {
  const printArea = document.getElementById("print-area");
  const fit = printArea.querySelector("#invoice-fit");
  const sheet = printArea.querySelector("#invoice-sheet");
  if (!fit || !sheet) return;

  // ۱) ریست کامل
  fit.style.height = "";
  fit.style.overflow = "";
  sheet.style.transform = "";
  sheet.style.transformOrigin = "";
  sheet.style.width = "100%";

  const PAGE = {
    widthPx: 1047,
    heightPx: 715,
    minZoom: 0.55,
  };

  // ۲) اندازه‌گیری ارتفاع محتوا در عرض استاندارد
  const contentH = measureSheet(sheet, PAGE.widthPx);
  if (contentH <= PAGE.heightPx) return; // خودش در یک صفحه جا می‌شود

  // ۳) محاسبه ضریب کوچک‌نمایی
  let z = Math.floor((PAGE.heightPx / contentH) * 100) / 100;
  if (z < PAGE.minZoom) {
    z = PAGE.minZoom;
    console.warn(
      "اقلام خیلی زیاد است؛ حتی با حداقل ضریب ممکن است یک صفحه نشود.",
    );
  }

  // ۴) بزرگ‌کردن عرض sheet تا بعد از scale دقیقاً تمام عرض صفحه را پر کند
  sheet.style.width = 100 / z + "%";
  // در چیدمان راست‌به‌چپ، مبدأ مقیاس باید گوشه بالا-راست باشد
  sheet.style.transformOrigin = "top right";
  sheet.style.transform = "scale(" + z + ")";

  // ۵) اندازه‌گیری ارتفاع چیدمان جدید (در عرض بزرگ‌تر) و تنظیم ارتفاع پوشش
  const h2 = measureSheet(sheet, PAGE.widthPx);
  fit.style.overflow = "hidden";
  fit.style.height = Math.ceil(h2 * z) + 4 + "px";

  console.log(
    `📄 contentH:${contentH}px → scale:${z} → fitH:${fit.style.height}`,
  );
}

// ریست کامل بعد از پایان چاپ تا چاپ بعدی درست اندازه‌گیری شود
window.addEventListener("afterprint", () => {
  const fit = document.getElementById("invoice-fit");
  const sheet = document.getElementById("invoice-sheet");
  if (fit) {
    fit.style.height = "";
    fit.style.overflow = "";
  }
  if (sheet) {
    sheet.style.transform = "";
    sheet.style.transformOrigin = "";
    sheet.style.width = "100%";
  }
});

export async function printInvoice() {
  if (!state.items.length) return alert("فاکتور خالی است!");
  if (!state.number) state.number = store.nextInvoiceNumber();

  const html = await buildPrintHTML(state.number);

  // پوشش invoice-fit: ارتفاع ثابت برای تک‌صفحه‌ای ماندن
  // پوشش invoice-sheet: محتوای فاکتور برای اعمال scale
  el.printArea.innerHTML = `<div id="invoice-fit"><div id="invoice-sheet">${html}</div></div>`;

  // ✨ جاگذاری خودکار در یک صفحه
  fitToSinglePage();

  setTimeout(() => window.print(), 300);
}

export function saveInvoice() {
  if (!state.items.length) return alert("فاکتور خالی است!");
  if (!state.number) state.number = store.nextInvoiceNumber();

  const t = totals();

  // ✅ تاریخ شمسی استاندارد برای ذخیره
  const today = toJalali();
  const jalaliDate = today.full; // مثل: 1404/01/15
  const jalaliTime = nowTimeFa();

  const invoice = {
    number: state.number,
    date: jalaliDate,
    time: jalaliTime,
    payment: state.payment, // ✅ اضافه شد
    customer: { ...state.customer },
    items: [...state.items],
    ...t,
  };
  // ✅ ذخیره خودکار مشتری
  if (
    (state.customer.name || "").trim() ||
    (state.customer.phone || "").trim()
  ) {
    store.saveCustomer({
      name: state.customer.name,
      phone: state.customer.phone,
    });
  }

  store.saveInvoice(invoice);
  autoSaveInvoices(); // 💾 ذخیره خودکار روی فایل JSON متصل‌شده

  autoPushGitHub(); // ☁️ push خودکار به گیت‌هاب (با debounce)

  alert(`فاکتور شماره ${faNum(invoice.number)} ذخیره شد ✅`);
  clearInvoice();
}
export function initInvoiceEvents() {
  // بیمه احتیاطی: print-area باید فرزند مستقیم body باشد تا CSS چاپ درست کار کند
  if (el.printArea && el.printArea.parentElement !== document.body) {
    document.body.appendChild(el.printArea);
  }

  el.list.addEventListener("click", (e) => {
    const inc = e.target.dataset.inc,
      dec = e.target.dataset.dec,
      del = e.target.dataset.del;
    if (inc) state.items.find((i) => i.rowId === inc).qty++;
    if (dec) {
      const item = state.items.find((i) => i.rowId === dec);
      item.qty > 1
        ? item.qty--
        : (state.items = state.items.filter((i) => i !== item));
    }
    if (del) state.items = state.items.filter((i) => i.rowId !== del);
    render();
  });

  el.discountInput.addEventListener("input", () => {
    state.discount = Number(el.discountInput.value) || 0;
    render();
  });

  el.custName.addEventListener(
    "input",
    () => (state.customer.name = el.custName.value),
  );
  el.custPhone.addEventListener(
    "input",
    () => (state.customer.phone = el.custPhone.value),
  );
  document
    .getElementById("mobile-show-invoice")
    ?.addEventListener("click", () => {
      document
        .getElementById("invoice-aside")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  document.getElementById("btn-print").addEventListener("click", printInvoice);
  document.getElementById("btn-save").addEventListener("click", saveInvoice);
  document.getElementById("btn-clear-invoice").addEventListener("click", () => {
    if (confirm("فاکتور پاک شود؟")) clearInvoice();
  });

  document.querySelectorAll('input[name="payment-method"]').forEach((r) => {
    r.addEventListener("change", () => {
      if (r.checked) state.payment = r.value;
    });
  });

  // ✅ دکمه بازکردن دیالوگ اطلاعات تکمیلی
  document
    .getElementById("btn-open-customer-details")
    ?.addEventListener("click", () => {
      openCustomerDetails(state.customer, (data) => {
        state.customer = { ...state.customer, ...data };
        updateDetailsBadge();
      });
    });

  // ✅ وقتی مشتری از تب مشتریان انتخاب می‌شود، فیلدهای تکمیلی هم سینک شوند
  window.addEventListener("customer-selected", (e) => {
    const c = e.detail || {};
    state.customer = { ...EMPTY_CUSTOMER, ...c };
    el.custName.value = c.name || "";
    el.custPhone.value = c.phone || "";
    setCustomerDetailsFormValues(state.customer);
    updateDetailsBadge();
  });

  render();
}
