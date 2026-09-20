import {
  store,
  faNum,
  todayFa,
  nowTimeFa,
  numberToWordsFa,
  toJalali,
  toEnDigits,
} from "./store.js";
import { autoSaveInvoices } from "./backup.js";
import { autoPushGitHub } from "./github.js";
import {
  openCustomerDetails,
  setCustomerDetailsFormValues,
  hasCustomerExtras,
  openCustomerChoiceDialog,
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
  date: "", // تاریخ فاکتور
  time: "", // ساعت فاکتور
};

const el = {
  list: document.getElementById("invoice-items"),
  subtotal: document.getElementById("sum-subtotal"),
  discount: document.getElementById("sum-discount"),
  total: document.getElementById("sum-total"),
  discountInput: document.getElementById("invoice-discount"),
  custName: document.getElementById("cust-name"),
  custPhone: document.getElementById("cust-phone"),
  customDate: document.getElementById("invoice-custom-date"),
  customTime: document.getElementById("invoice-custom-time"),
  printArea: document.getElementById("print-area"),
};
// تابع نرمال‌سازی تاریخ به صورت استاندارد 1405/06/28
export function normalizeJalaliDate(str) {
  if (!str) return toJalali().full;
  const clean = toEnDigits(str).replace(/[-._]/g, "/").trim();
  const parts = clean.split("/").map((p) => p.trim());
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, "0");
    const d = parts[2].padStart(2, "0");
    if (y.length === 4) {
      return `${y}/${m}/${d}`;
    }
  }
  return clean;
}

/* ============================================================
   راه‌اندازی دیالوگ انتخاب ساعت (TimePicker)
============================================================ */
let selectedHour = "12";
let selectedMinute = "00";

function initTimePicker() {
  const modal = document.getElementById("time-picker-modal");
  const timeInput = document.getElementById("invoice-custom-time");
  if (!modal || !timeInput || modal.dataset.bound) return;
  modal.dataset.bound = "1";

  const hoursList = document.getElementById("tp-hours-list");
  const minutesList = document.getElementById("tp-minutes-list");
  const prevH = document.getElementById("tp-preview-hour");
  const prevM = document.getElementById("tp-preview-minute");

  const btnClose = document.getElementById("btn-close-time-picker");
  const btnCancel = document.getElementById("btn-tp-cancel");
  const btnConfirm = document.getElementById("btn-tp-confirm");
  const btnNow = document.getElementById("btn-tp-now");

  // ساخت لیست ساعت‌ها (00 تا 23)
  let hHtml = "";
  for (let i = 0; i < 24; i++) {
    const val = String(i).padStart(2, "0");
    hHtml += `<div data-tp-h="${val}" class="cursor-pointer py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-slate-600 transition font-mono">${val}</div>`;
  }
  hoursList.innerHTML = hHtml;

  // ساخت لیست دقیقه‌ها (00 تا 59)
  let mHtml = "";
  for (let i = 0; i < 60; i += 1) {
    const val = String(i).padStart(2, "0");
    mHtml += `<div data-tp-m="${val}" class="cursor-pointer py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-slate-600 transition font-mono">${val}</div>`;
  }
  minutesList.innerHTML = mHtml;

  function updateActiveStyles() {
    if (prevH) prevH.textContent = selectedHour;
    if (prevM) prevM.textContent = selectedMinute;

    hoursList.querySelectorAll("[data-tp-h]").forEach((item) => {
      const isSel = item.dataset.tpH === selectedHour;
      item.className = isSel
        ? "cursor-pointer py-1 rounded-lg bg-brand-600 text-white font-bold font-mono shadow-sm"
        : "cursor-pointer py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-slate-600 font-mono text-slate-700 dark:text-slate-200";
      if (isSel) item.scrollIntoView({ block: "nearest" });
    });

    minutesList.querySelectorAll("[data-tp-m]").forEach((item) => {
      const isSel = item.dataset.tpM === selectedMinute;
      item.className = isSel
        ? "cursor-pointer py-1 rounded-lg bg-brand-600 text-white font-bold font-mono shadow-sm"
        : "cursor-pointer py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-slate-600 font-mono text-slate-700 dark:text-slate-200";
      if (isSel) item.scrollIntoView({ block: "nearest" });
    });
  }

  function openPicker() {
    const curVal = timeInput.value.trim();
    if (curVal.includes(":")) {
      const parts = toEnDigits(curVal).split(":");
      selectedHour = String(Number(parts[0]) || 0).padStart(2, "0");
      selectedMinute = String(Number(parts[1]) || 0).padStart(2, "0");
    } else {
      const now = new Date();
      selectedHour = String(now.getHours()).padStart(2, "0");
      selectedMinute = String(now.getMinutes()).padStart(2, "0");
    }
    updateActiveStyles();
    modal.classList.remove("hidden");
  }

  function closePicker() {
    modal.classList.add("hidden");
  }

  timeInput.addEventListener("click", openPicker);
  btnClose?.addEventListener("click", closePicker);
  btnCancel?.addEventListener("click", closePicker);
  modal.addEventListener("click", (e) => e.target === modal && closePicker());

  hoursList.addEventListener("click", (e) => {
    const target = e.target.closest("[data-tp-h]");
    if (!target) return;
    selectedHour = target.dataset.tpH;
    updateActiveStyles();
  });

  minutesList.addEventListener("click", (e) => {
    const target = e.target.closest("[data-tp-m]");
    if (!target) return;
    selectedMinute = target.dataset.tpM;
    updateActiveStyles();
  });

  btnNow?.addEventListener("click", () => {
    const now = new Date();
    selectedHour = String(now.getHours()).padStart(2, "0");
    selectedMinute = String(now.getMinutes()).padStart(2, "0");
    updateActiveStyles();
  });

  btnConfirm?.addEventListener("click", () => {
    const finalTime = `${selectedHour}:${selectedMinute}`;
    timeInput.value = finalTime;
    state.time = finalTime;
    closePicker();
  });
}
export function addItemToInvoice({ title, price, meta = "", productId = null, variantId = null }) {
  if (!state.number) state.number = store.nextInvoiceNumber();
  const found = state.items.find((i) => i.title === title && i.price === price && i.variantId === variantId);
  if (found) {
    found.qty += 1;
  } else {
    state.items.push({
      rowId: crypto.randomUUID(),
      title,
      price,
      qty: 1,
      meta,
      productId,
      variantId,
    });
  }
  render();
}

let editingInvoice = null;
let editingProforma = null;

export function isInvoiceEditing() {
  return Boolean(editingInvoice || editingProforma);
}

export function isProformaEditing() {
  return Boolean(editingProforma);
}

export function updateEditModeUI(isEditing) {
  const asideTitle = document.getElementById("invoice-aside-title");
  const editBadge = document.getElementById("invoice-edit-badge");
  const btnCancel = document.getElementById("btn-cancel-edit");
  const btnSave = document.getElementById("btn-save");
  const btnSaveProforma = document.getElementById("btn-save-proforma");

  if (isEditing && editingProforma) {
    if (asideTitle) asideTitle.textContent = "✏️ ویرایش پیش‌فاکتور";
    if (editBadge) {
      editBadge.textContent = `پیش‌فاکتور #${faNum(editingProforma.number)}`;
      editBadge.className =
        "text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      editBadge.classList.remove("hidden");
    }
    if (btnCancel) btnCancel.classList.remove("hidden");
    if (btnSave) {
      btnSave.innerHTML = `<span>✅</span><span>تایید و صدور فاکتور نهایی</span>`;
      btnSave.classList.remove("bg-amber-600", "hover:bg-amber-700");
      btnSave.classList.add("bg-emerald-600", "hover:bg-emerald-700");
    }
    if (btnSaveProforma) {
      btnSaveProforma.innerHTML = `<span>📑</span><span>بروزرسانی پیش‌فاکتور</span>`;
      btnSaveProforma.classList.remove("hidden");
    }
  } else if (isEditing && editingInvoice) {
    if (asideTitle) asideTitle.textContent = "✏️ ویرایش فاکتور";
    if (editBadge) {
      editBadge.textContent = `#${faNum(editingInvoice.number)}`;
      editBadge.className =
        "text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300";
      editBadge.classList.remove("hidden");
    }
    if (btnCancel) btnCancel.classList.remove("hidden");
    if (btnSave) {
      btnSave.innerHTML = `<span>💾</span><span>بروزرسانی فاکتور #${faNum(editingInvoice.number)}</span>`;
      btnSave.classList.remove("bg-emerald-600", "hover:bg-emerald-700");
      btnSave.classList.add("bg-amber-600", "hover:bg-amber-700");
    }
    if (btnSaveProforma) {
      btnSaveProforma.classList.add("hidden");
    }
  } else {
    if (asideTitle) asideTitle.textContent = "🧾 فاکتور جاری";
    if (editBadge) editBadge.classList.add("hidden");
    if (btnCancel) btnCancel.classList.add("hidden");
    if (btnSave) {
      btnSave.innerHTML = `<span>💾</span><span>ثبت فاکتور</span>`;
      btnSave.classList.remove("bg-amber-600", "hover:bg-amber-700");
      btnSave.classList.add("bg-emerald-600", "hover:bg-emerald-700");
    }
    if (btnSaveProforma) {
      btnSaveProforma.classList.remove("hidden");
      btnSaveProforma.innerHTML = `<span>📑</span><span>ثبت پیش‌فاکتور</span>`;
    }
  }
}

export function loadInvoiceForEdit(inv) {
  if (!inv) return;

  editingInvoice = {
    ...inv,
    items: JSON.parse(JSON.stringify(inv.items || [])),
  };
  editingProforma = null;

  state.number = inv.number;
  state.items = JSON.parse(JSON.stringify(inv.items || []));
  state.discount = inv.discount || 0;
  state.customer = { ...EMPTY_CUSTOMER, ...(inv.customer || {}) };
  state.payment = inv.payment || "نقدی";
  state.date = inv.date || toJalali().full;
  state.time = inv.time || nowTimeFa();

  if (el.custName) el.custName.value = state.customer.name || "";
  if (el.custPhone) el.custPhone.value = state.customer.phone || "";
  if (el.discountInput) el.discountInput.value = state.discount;
  if (el.customDate) el.customDate.value = state.date;
  if (el.customTime) el.customTime.value = state.time;

  setCustomerDetailsFormValues(state.customer);
  updateDetailsBadge();

  const radio = document.querySelector(
    `input[name="payment-method"][value="${state.payment}"]`,
  );
  if (radio) radio.checked = true;

  updateEditModeUI(true);
  render();

  custToast(`✏️ فاکتور شماره ${faNum(inv.number)} جهت ویرایش باز شد`);

  document.getElementById("invoice-aside")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function loadProformaForEdit(pf) {
  if (!pf) return;

  editingInvoice = null;
  editingProforma = {
    ...pf,
    items: JSON.parse(JSON.stringify(pf.items || [])),
  };

  state.number = pf.number;
  state.items = JSON.parse(JSON.stringify(pf.items || []));
  state.discount = pf.discount || 0;
  state.customer = { ...EMPTY_CUSTOMER, ...(pf.customer || {}) };
  state.payment = pf.payment || "نقدی";
  state.date = pf.date || toJalali().full;
  state.time = pf.time || nowTimeFa();

  if (el.custName) el.custName.value = state.customer.name || "";
  if (el.custPhone) el.custPhone.value = state.customer.phone || "";
  if (el.discountInput) el.discountInput.value = state.discount;
  if (el.customDate) el.customDate.value = state.date;
  if (el.customTime) el.customTime.value = state.time;

  setCustomerDetailsFormValues(state.customer);
  updateDetailsBadge();

  const radio = document.querySelector(
    `input[name="payment-method"][value="${state.payment}"]`,
  );
  if (radio) radio.checked = true;

  updateEditModeUI(true);
  render();

  custToast(`✏️ پیش‌فاکتور شماره ${faNum(pf.number)} جهت ویرایش باز شد`);

  document.getElementById("invoice-aside")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function clearInvoice() {
  editingInvoice = null;
  editingProforma = null;
  updateEditModeUI(false);

  state.items = [];
  state.discount = 0;
  state.number = null;
  state.payment = "نقدی";
  state.customer = { ...EMPTY_CUSTOMER };

  // ریست تاریخ و زمان به الان
  const today = toJalali();
  state.date = today.full;
  state.time = nowTimeFa();
  if (el.customDate) el.customDate.value = state.date;
  if (el.customTime) el.customTime.value = state.time;

  el.custName.value = "";
  el.custPhone.value = "";
  setCustomerDetailsFormValues(state.customer);
  updateDetailsBadge();
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

function render() {
  const t = totals();
  el.list.innerHTML = state.items.length
    ? state.items
        .map(
          (
            i,
          ) => `<div class="border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs fade-in bg-white dark:bg-slate-800/80">
            <div class="flex justify-between gap-2">
              <div class="min-w-0">
                <p class="font-bold truncate text-sm text-slate-800 dark:text-slate-100">${i.title}</p>
                ${i.meta ? `<p class="text-slate-400 mt-0.5 text-xs">${i.meta}</p>` : ""}
                <p class="text-slate-500 dark:text-slate-400 mt-0.5">${faNum(i.price)} تومان</p>
              </div>
              <button data-del="${i.rowId}" title="حذف ردیف" class="w-7 h-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 flex items-center justify-center font-bold text-sm shrink-0 transition">✕</button>
            </div>
            <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <div class="flex items-center gap-1.5">
                <button data-dec="${i.rowId}" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-extrabold text-sm flex items-center justify-center transition">−</button>
                <span class="w-8 text-center font-extrabold text-sm text-slate-800 dark:text-slate-100">${faNum(i.qty)}</span>
                <button data-inc="${i.rowId}" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-extrabold text-sm flex items-center justify-center transition">+</button>
              </div>
              <b class="text-brand-700 dark:text-brand-400 text-sm font-extrabold">${faNum(i.price * i.qty)} تومان</b>
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
export async function buildPrintHTML(number, invoiceData = null, isProforma = false) {
  const shop = store.getShopInfo();
  const isPf = isProforma || Boolean(invoiceData?.isProforma);

  // اگر invoiceData داده شده، از آن استفاده کن، در غیر این صورت از state فعلی
  const items = invoiceData ? invoiceData.items : state.items;
  const customer = invoiceData ? invoiceData.customer : state.customer;
  const discount = invoiceData ? invoiceData.discount : state.discount;
  const total = invoiceData ? invoiceData.total : totals().total;
  const subtotal = invoiceData ? invoiceData.subtotal : totals().subtotal;

  // محاسبه تاریخ و ساعت چاپی (از ورودی فاکتور یا زمان حال)
  const dateVal = invoiceData
    ? invoiceData.date
    : el.customDate?.value
      ? normalizeJalaliDate(el.customDate.value)
      : state.date || toJalali().full;
  const timeVal = invoiceData
    ? invoiceData.time
    : el.customTime?.value
      ? toEnDigits(el.customTime.value).trim()
      : state.time || nowTimeFa();
  const dateStr = `${dateVal} - ${timeVal}`;

  let qr = "";
  try {
    if (window.QRCode) {
      qr = await window.QRCode.toDataURL(
        `TYPE:${isPf ? "PROFORMA" : "INV"}:${number}|TOTAL:${total}|DATE:${dateVal}|CUST:${customer.name || "-"}`,
        { width: 120, margin: 1, color: { dark: isPf ? "#b45309" : "#0c4a6e", light: "#ffffff" } },
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

  const payment = invoiceData ? invoiceData.payment || "نقدی" : state.payment;

  return `
<div dir="rtl" style="font-family:'Vazirmatn',Tahoma,sans-serif;color:#0f172a;background:#ffffff;width:100%;">
  <!-- نوار رنگی بالا -->
  <div style="height:7px;background:${isPf ? "linear-gradient(90deg,#f59e0b,#d97706,#b45309)" : "linear-gradient(90deg,#0ea5e9,#0284c7,#0369a1)"};border-radius:0 0 8px 8px;"></div>

  <!-- ===== هدر ===== -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:18px 30px 16px;border-bottom:2px solid ${isPf ? "#f59e0b" : "#0ea5e9"};">
    <div style="display:flex;align-items:center;gap:16px;">
      ${
        shop.logo
          ? `<img src="${shop.logo}" style="width:66px;height:66px;object-fit:contain;border-radius:12px;" />`
          : `<div style="width:66px;height:66px;border-radius:14px;background:${isPf ? "linear-gradient(135deg,#f59e0b,#b45309)" : "linear-gradient(135deg,#0ea5e9,#0369a1)"};color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;">ک</div>`
      }
      
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-size:23px;font-weight:900;color:#0c4a6e;line-height:1.5;">${shop.name || "کافی‌نت آنلاین"}</div>
          ${isPf ? `<span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;">پیش‌فاکتور</span>` : ""}
        </div>
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
      <div style="background:${isPf ? "linear-gradient(135deg,#d97706,#b45309)" : "linear-gradient(135deg,#0284c7,#0c4a6e)"};color:#fff;border-radius:12px;padding:9px 26px;box-shadow:0 4px 10px rgba(2,132,199,.25);">
        <div style="font-size:9.5px;opacity:.9;">${isPf ? "شماره پیش‌فاکتور" : "شماره فاکتور"}</div>
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
  <tr style="background:${isPf ? "#78350f" : "#0c4a6e"};color:#ffffff;">
    <th style="padding:11px 8px;width:48px;font-size:11px;font-weight:800;text-align:center;">ردیف</th>
    <th style="padding:11px 14px;font-size:11px;font-weight:800;text-align:right;">شرح خدمت / کالا</th>
    <th style="padding:11px 8px;width:66px;font-size:11px;font-weight:800;text-align:center;">تعداد</th>
    <th style="padding:11px 10px;width:125px;font-size:11px;font-weight:800;text-align:center;">فی (تومان)</th>
    <th style="padding:11px 10px;width:135px;font-size:11px;font-weight:800;text-align:center;">جمع (تومان)</th>
  </tr>
 </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- ===== جمع‌ها + QR + مهر ===== -->
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
      <div style="font-size:9px;color:#94a3b8;margin-top:5px;font-weight:600;">کد اصالت سند</div>
    </div>`
        : ""
    }
    <!-- محل مهر -->
    <div style="width:100px;height:100px;border:2px dashed #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:9.5px;color:#94a3b8;font-weight:600;line-height:1.7;">
      ${isPf ? "محل مهر و امضا<br/>پیش‌فاکتور" : "محل مهر<br/>و امضا"}
    </div>
  </div>

  <!-- ===== پاورقی ===== -->
  <div style="text-align:center;font-size:10.5px;color:#64748b;padding:16px 30px 14px;line-height:1.9;">
    ${
      isPf
        ? `<b style="color:#b45309;font-size:12px;">پیش‌فاکتور فروش (غیر قطعی) 📑</b><br/>این سند صرفاً پیش‌فاکتور استعلام قیمت بوده و قبل از ثبت نهایی فاقد بار مالیاتی یا تعهد قطعی تحویل کالا/خدمات می‌باشد.`
        : `<b style="color:#0c4a6e;font-size:12px;">از خرید شما متشکریم 🌷</b><br/>این فاکتور به‌صورت الکترونیکی صادر شده و معتبر می‌باشد. کالاها و خدمات ارائه‌شده مشمول شرایط و ضوابط کافی‌نت هستند.`
    }
  </div>

  <!-- نوار رنگی پایین -->
  <div style="height:6px;background:${isPf ? "linear-gradient(90deg,#b45309,#d97706,#f59e0b)" : "linear-gradient(90deg,#0369a1,#0284c7,#0ea5e9)"};border-radius:8px 8px 0 0;"></div>
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

  const t = totals();
  const rawDate = el.customDate ? el.customDate.value : "";
  const rawTime = el.customTime ? el.customTime.value : "";

  const jalaliDate = normalizeJalaliDate(rawDate || state.date);
  const jalaliTime = rawTime
    ? toEnDigits(rawTime).trim()
    : state.time || "12:00";

  // ========== سناریو ۰: تبدیل پیش‌فاکتور به فاکتور نهایی فروش ==========
  if (editingProforma) {
    const oldPfNumber = editingProforma.number;

    // بررسی موجودی کالاها
    for (const item of state.items) {
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
              `⚠️ موجودی کالا «${item.title}» برای صدور قطعی کافی نیست!\nموجودی فعلی انبار: ${faNum(currentStock)} عدد\nتعداد در فاکتور: ${faNum(item.qty)} عدد`,
            );
            return;
          }
        }
      }
    }

    // کسر از انبار
    state.items.forEach((item) => {
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

    const newInvoiceNumber = store.nextInvoiceNumber();
    const invoice = {
      number: newInvoiceNumber,
      date: jalaliDate,
      time: jalaliTime,
      payment: state.payment,
      customer: { ...state.customer },
      items: [...state.items],
      ...t,
    };

    if (
      (state.customer.name || "").trim() ||
      (state.customer.phone || "").trim()
    ) {
      store.saveCustomer({ ...state.customer });
    }

    store.saveInvoice(invoice);
    store.deleteProforma(oldPfNumber);
    autoSaveInvoices();
    autoPushGitHub(
      `تبدیل پیش‌فاکتور #${faNum(oldPfNumber)} به فاکتور فروش #${faNum(newInvoiceNumber)}`,
    );

    alert(
      `پیش‌فاکتور شماره ${faNum(oldPfNumber)} با موفقیت به فاکتور فروش شماره ${faNum(newInvoiceNumber)} تبدیل و صادر شد ✅`,
    );

    clearInvoice();

    if (typeof window.updateProformaBadge === "function") {
      window.updateProformaBadge();
    }
    if (typeof window.renderProformasList === "function") {
      window.renderProformasList();
    }
    if (typeof window.renderInvoicesList === "function") {
      window.renderInvoicesList();
    }
    if (typeof window.setView === "function") {
      window.setView("invoices");
    }
    return;
  }

  // ========== سناریو ۱: ویرایش فاکتور موجود ==========
  if (editingInvoice) {
    const targetNumber = editingInvoice.number;
    const oldItems = editingInvoice.items || [];
    const newItems = state.items || [];

    // ۱) تطبیق هوشمند موجودی برای اقلام فیزیکی اضافه/تغییریافته
    newItems.forEach((newItem) => {
      if (newItem.productId) {
        const oldItem = oldItems.find(
          (o) =>
            o.productId === newItem.productId &&
            (o.variantId || null) === (newItem.variantId || null),
        );
        const oldQty = oldItem ? oldItem.qty : 0;
        const diff = newItem.qty - oldQty; // مثبت: کسر از انبار، منفی: بازگشت به انبار

        if (diff !== 0) {
          const product = store.getProduct(newItem.productId);
          if (product) {
            let updated = false;
            if (newItem.variantId && product.variants?.length) {
              const vIdx = product.variants.findIndex(
                (v) => v.id === newItem.variantId,
              );
              if (vIdx >= 0) {
                const currentQty = product.variants[vIdx].quantity ?? 0;
                product.variants[vIdx].quantity = Math.max(0, currentQty - diff);
                updated = true;
              }
            } else if (!newItem.variantId) {
              const currentQty = product.quantity ?? 0;
              product.quantity = Math.max(0, currentQty - diff);
              updated = true;
            }
            if (updated) store.saveProduct(product);
          }
        }
      }
    });

    // ۲) بازگشت موجودی برای اقلامی که در ویرایش از فاکتور حذف شده‌اند
    oldItems.forEach((oldItem) => {
      if (oldItem.productId) {
        const stillExists = newItems.some(
          (n) =>
            n.productId === oldItem.productId &&
            (n.variantId || null) === (oldItem.variantId || null),
        );
        if (!stillExists) {
          const product = store.getProduct(oldItem.productId);
          if (product) {
            let updated = false;
            if (oldItem.variantId && product.variants?.length) {
              const vIdx = product.variants.findIndex(
                (v) => v.id === oldItem.variantId,
              );
              if (vIdx >= 0) {
                product.variants[vIdx].quantity =
                  (product.variants[vIdx].quantity ?? 0) + oldItem.qty;
                updated = true;
              }
            } else if (!oldItem.variantId) {
              product.quantity = (product.quantity ?? 0) + oldItem.qty;
              updated = true;
            }
            if (updated) store.saveProduct(product);
          }
        }
      }
    });

    const updatedInvoice = {
      number: targetNumber,
      date: jalaliDate,
      time: jalaliTime,
      payment: state.payment,
      customer: { ...state.customer },
      items: [...state.items],
      ...t,
    };

    if (
      (state.customer.name || "").trim() ||
      (state.customer.phone || "").trim()
    ) {
      store.saveCustomer({ ...state.customer });
    }

    // ذخیره فاکتور ویرایش‌شده (جایگزینی در دیتابیس با همان شماره)
    store.saveInvoice(updatedInvoice);
    autoSaveInvoices();
    autoPushGitHub(`ویرایش فاکتور شماره ${faNum(targetNumber)}`);

    alert(
      `فاکتور شماره ${faNum(targetNumber)} با موفقیت ویرایش و بروزرسانی شد ✅`,
    );

    clearInvoice();

    if (typeof window.renderInvoicesList === "function") {
      window.renderInvoicesList();
    }
    if (typeof window.setView === "function") {
      window.setView("invoices");
    }
    return;
  }

  // ========== سناریو ۲: ایجاد فاکتور جدید ==========
  if (!state.number) state.number = store.nextInvoiceNumber();

  // کسر موجودی محصولات و واریانت‌ها قبل از ذخیره فاکتور جدید
  state.items.forEach((item) => {
    if (item.productId) {
      const product = store.getProduct(item.productId);
      if (product) {
        let updated = false;

        if (item.variantId && product.variants?.length) {
          const variantIdx = product.variants.findIndex(
            (v) => v.id === item.variantId,
          );
          if (variantIdx >= 0) {
            const currentQty = product.variants[variantIdx].quantity ?? 0;
            product.variants[variantIdx].quantity = Math.max(
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

        if (updated) {
          store.saveProduct(product);
        }
      }
    }
  });

  const invoice = {
    number: state.number,
    date: jalaliDate,
    time: jalaliTime,
    payment: state.payment,
    customer: { ...state.customer },
    items: [...state.items],
    ...t,
  };

  if (
    (state.customer.name || "").trim() ||
    (state.customer.phone || "").trim()
  ) {
    store.saveCustomer({ ...state.customer });
  }

  // ذخیره در دیتابیس
  store.saveInvoice(invoice);
  autoSaveInvoices();
  autoPushGitHub(`ایجاد فاکتور شماره ${faNum(invoice.number)}`);

  // اگر تاریخ فاکتور امروز نیست، فیلتر لیست را خودکار روی «همه» می‌گذاریم تا فاکتور مخفی نماند
  const todayStr = toJalali().full;
  if (jalaliDate !== todayStr) {
    if (typeof window.setInvoiceFilterPeriod === "function") {
      window.setInvoiceFilterPeriod("all");
    }
  }

  // تازه‌سازی آنی جدول فاکتورها
  if (typeof window.renderInvoicesList === "function") {
    window.renderInvoicesList();
  }

  alert(
    `فاکتور شماره ${faNum(invoice.number)} با تاریخ ${jalaliDate} و ساعت ${jalaliTime} ثبت شد ✅`,
  );
  clearInvoice();
}

export function saveProforma() {
  if (!state.items.length) {
    alert("پیش‌فاکتور خالی است! لطفاً ابتدا اقلامی به فاکتور اضافه کنید.");
    return;
  }

  const t = totals();
  const rawDate = el.customDate ? el.customDate.value : "";
  const rawTime = el.customTime ? el.customTime.value : "";

  const jalaliDate = normalizeJalaliDate(rawDate || state.date);
  const jalaliTime = rawTime
    ? toEnDigits(rawTime).trim()
    : state.time || "12:00";

  let proformaNumber;
  if (editingProforma) {
    proformaNumber = editingProforma.number;
  } else {
    proformaNumber = store.nextProformaNumber();
  }

  const proforma = {
    number: proformaNumber,
    date: jalaliDate,
    time: jalaliTime,
    payment: state.payment,
    customer: { ...state.customer },
    items: [...state.items],
    isProforma: true,
    status: "pending",
    ...t,
  };

  if (
    (state.customer.name || "").trim() ||
    (state.customer.phone || "").trim()
  ) {
    store.saveCustomer({ ...state.customer });
  }

  store.saveProforma(proforma);
  autoSaveInvoices();
  autoPushGitHub(
    editingProforma
      ? `ویرایش پیش‌فاکتور شماره ${faNum(proformaNumber)}`
      : `ایجاد پیش‌فاکتور شماره ${faNum(proformaNumber)}`,
  );

  alert(
    `پیش‌فاکتور شماره ${faNum(proformaNumber)} با تاریخ ${jalaliDate} و ساعت ${jalaliTime} ثبت شد ✅`,
  );

  clearInvoice();

  if (typeof window.updateProformaBadge === "function") {
    window.updateProformaBadge();
  }
  if (typeof window.renderProformasList === "function") {
    window.renderProformasList();
  }
  if (typeof window.setView === "function") {
    window.setView("proformas");
  }
}
function updateDetailsBadge() {
  const badge = document.getElementById("customer-details-badge");
  if (badge)
    badge.classList.toggle("hidden", !hasCustomerExtras(state.customer));
}

function custToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2200);
}

function loadCustomerIntoInvoice(c) {
  state.customer = { ...EMPTY_CUSTOMER, ...c };
  el.custName.value = c.name || "";
  el.custPhone.value = c.phone || "";
  setCustomerDetailsFormValues(state.customer);
  updateDetailsBadge();
  custToast(`📇 مشتری بارگذاری شد: ${c.name || c.phone}`);
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
  document
    .getElementById("btn-save-proforma")
    ?.addEventListener("click", saveProforma);
  document.getElementById("btn-clear-invoice").addEventListener("click", () => {
    if (confirm("فاکتور پاک شود؟")) clearInvoice();
  });
  document.getElementById("btn-cancel-edit")?.addEventListener("click", () => {
    const isPf = Boolean(editingProforma);
    if (
      confirm(
        `آیا از انصراف از ویرایش ${isPf ? "پیش‌فاکتور" : "فاکتور"} اطمینان دارید؟ تغییرات ذخیره نخواهند شد.`,
      )
    ) {
      clearInvoice();
      if (typeof setView === "function") {
        setView(isPf ? "proformas" : "invoices");
      }
    }
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
  // ✅ دکمه دیالوگ اطلاعات تکمیلی
  document
    .getElementById("btn-open-customer-details")
    ?.addEventListener("click", () => {
      openCustomerDetails(state.customer, (data) => {
        state.customer = { ...state.customer, ...data };
        updateDetailsBadge();
      });
    });

  // ✅ سینک شدن فیلدهای تکمیلی وقتی مشتری از تب مشتریان انتخاب می‌شود
  window.addEventListener("customer-selected", (e) => {
    const c = e.detail || {};
    state.customer = { ...EMPTY_CUSTOMER, ...c };
    el.custName.value = c.name || "";
    el.custPhone.value = c.phone || "";
    setCustomerDetailsFormValues(state.customer);
    updateDetailsBadge();
  });

  // ✅ جستجوی زنده شماره + مدیریت شماره مشترک با نام متفاوت
  if (!el.custPhone.dataset.lookupBound) {
    el.custPhone.dataset.lookupBound = "1";
    let lookupTimer = null;
    let lastChoiceKey = "";
    el.custPhone.addEventListener("input", () => {
      clearTimeout(lookupTimer);
      lookupTimer = setTimeout(() => {
        const raw = toEnDigits(el.custPhone.value).replace(/\s/g, "");
        if (raw.length < 5) return;
        const matches = store
          .getCustomers()
          .filter((c) => c.phone && c.phone === raw);
        if (!matches.length) return;

        const typedName = el.custName.value.trim();

        // نام دقیقاً匹配 یکی از مشتریان → بارگذاری بی‌صدا
        if (typedName) {
          const exact = matches.find((c) => (c.name || "") === typedName);
          if (exact) return loadCustomerIntoInvoice(exact);
        } else if (matches.length === 1) {
          return loadCustomerIntoInvoice(matches[0]);
        }

        // نام متفاوت یا چند مشتری → دیالوگ انتخاب
        const key = raw + "|" + typedName;
        if (key === lastChoiceKey) return;
        if (document.getElementById("customer-choice-overlay")) return;
        lastChoiceKey = key;

        openCustomerChoiceDialog(matches, typedName, (picked) => {
          lastChoiceKey = "";
          if (picked) {
            loadCustomerIntoInvoice(picked);
          } else {
            // ➕ مشتری جدید با همین شماره
            state.customer = {
              ...EMPTY_CUSTOMER,
              name: el.custName.value.trim(),
              phone: raw,
            };
            setCustomerDetailsFormValues(state.customer);
            updateDetailsBadge();
            custToast(
              "➕ مشتری جدید با همین شماره هنگام ثبت فاکتور ساخته می‌شود",
            );
          }
        });
      }, 350);
    });
  }

  // مقداردهی اولیه تاریخ و زمان به زمان حال
  const initToday = toJalali();
  state.date = initToday.full;
  state.time = nowTimeFa();
  if (el.customDate && !el.customDate.value) el.customDate.value = state.date;
  if (el.customTime && !el.customTime.value) el.customTime.value = state.time;

  // فعال‌سازی تقویم بازشونده فارسی
  if (window.$ && $.fn && $.fn.persianDatepicker) {
    $("#invoice-custom-date").persianDatepicker({
      format: "YYYY/MM/DD",
      initialValue: false,
      autoClose: true,
      calendar: { locale: "fa" },
      onSelect: function () {
        if (el.customDate) {
          state.date = normalizeJalaliDate(el.customDate.value);
        }
      },
    });
  }

  // دکمه بازنشانی سریع به زمان جاری (الان)
  document
    .getElementById("btn-reset-invoice-datetime")
    ?.addEventListener("click", () => {
      const cur = toJalali();
      state.date = cur.full;
      state.time = nowTimeFa();
      if (el.customDate) el.customDate.value = state.date;
      if (el.customTime) el.customTime.value = state.time;
      custToast("📅 تاریخ و زمان فاکتور به الان بازنشانی شد");
    });

  el.customDate?.addEventListener("input", () => {
    state.date = el.customDate.value;
  });
  el.customTime?.addEventListener("input", () => {
    state.time = el.customTime.value;
  });

  initTimePicker();

  render();
}

window.loadInvoiceForEdit = loadInvoiceForEdit;
window.loadProformaForEdit = loadProformaForEdit;
window.saveProforma = saveProforma;

