import { RATE_CATEGORIES } from "../data/rates.js";
import { store, faNum, todayFa } from "./store.js";
import { addItemToInvoice, initInvoiceEvents } from "./invoice.js";
import {
  renderProducts,
  initProductEvents,
  addProductToInvoice,
} from "./products.js";
import { initInvoicesList } from "./invoices-list.js";
import { initAuth } from "./auth.js";
import { initBackup, autoSaveInvoices } from "./backup.js";
import { initGitHubUI, autoPushGitHub } from "./github.js";
import { initReports } from "./reports.js"; // ✅ اضافه شد
import { initCustomers, renderCustomers } from "./customers.js";
import { initCustomerPortal } from "./customer-portal.js";

const el = {
  tabs: document.querySelectorAll(".view-tab"),
  views: {
    invoice: document.getElementById("view-invoice"),
    products: document.getElementById("view-products"),
    reports: document.getElementById("view-reports"),
    invoices: document.getElementById("view-invoices"),
    "invoice-detail": document.getElementById("view-invoice-detail"),
    settings: document.getElementById("view-settings"),
    customers: document.getElementById("view-customers"),
  },
  srcTabs: document.querySelectorAll(".src-tab"),
  search: document.getElementById("search-input"),
  items: document.getElementById("items-list"),
};

let currentView = "invoice";
let currentSource = "services"; // services | products
let expandedCategories = new Set(); // دسته‌بندی‌های باز شده

// ---------- ناوبری بین ویوها ----------
function setView(view) {
  currentView = view;

  Object.entries(el.views).forEach(([k, v]) =>
    v.classList.toggle("hidden", k !== view),
  );

  // ✅ فقط یک کلاس active — استایل‌ها در CSS با پشتیبانی دارک‌مود تعریف شده‌اند
  el.tabs.forEach((t) => {
    t.classList.toggle("active", t.dataset.view === view);
  });

  // مدیریت نمایش تب «مشاهده فاکتور» (فقط hidden شدن، بدون دستکاری رنگ)
  const detailTab = document.getElementById("tab-invoice-detail");
  if (view === "invoice-detail") {
    detailTab?.classList.remove("hidden");
  } else if (view !== "invoices" && view !== "invoice-detail") {
    detailTab?.classList.add("hidden");
  }

  if (view === "products") renderProducts();
  if (view === "reports") initReports();
  if (view === "invoices") initInvoicesList();
  if (view === "customers") renderCustomers();
}

window.setView = setView;

el.tabs.forEach((t) =>
  t.addEventListener("click", () => setView(t.dataset.view)),
);

// ---------- تغییر منبع (خدمات / محصولات) ----------
function setSource(src) {
  currentSource = src;
  expandedCategories.clear();
  el.srcTabs.forEach((b) => {
    const active = b.dataset.src === src;
    b.className = `src-tab px-4 py-1.5 rounded-full text-xs font-bold ${
      active ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"
    }`;
  });
  renderItems();
}

el.srcTabs.forEach((b) =>
  b.addEventListener("click", () => setSource(b.dataset.src)),
);

// ---------- سرچ سریع (ایندکس ساده برای سرعت) ----------
function getAllServices() {
  return RATE_CATEGORIES.flatMap((c) =>
    c.items.map((i) => ({ ...i, catId: c.id, catTitle: c.title })),
  );
}

function searchServices(q) {
  const all = getAllServices();
  if (!q) return RATE_CATEGORIES; // برگرداندن کل دسته‌بندی‌ها وقتی سرچ خالی است

  const query = q.trim();

  // پیدا کردن دسته‌بندی‌هایی که عنوانشان با جستجو مطابقت دارد
  return RATE_CATEGORIES.filter((c) => c.title.includes(query));
}

function renderItems() {
  const q = el.search.value.trim();

  if (currentSource === "services") {
    let categories = searchServices(q);

    el.items.innerHTML = categories.length
      ? categories
          .map((c) => {
            const isExpanded = expandedCategories.has(c.id);
            return `
        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden fade-in">
          <!-- سر‌دسته خدمات -->
          <div data-cat-id="${c.id}" class="cat-header flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition ${isExpanded ? "bg-brand-50" : ""}">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-lg">${isExpanded ? "🔽" : "▶️"}</span>
              <p class="text-sm font-bold truncate">${c.title}</p>
            </div>
            <span class="text-xs text-slate-400 shrink-0">${faNum(c.items.length)} خدمت</span>
          </div>
          <!-- زیرمجموعه‌ها -->
          <div class="cat-items space-y-2 p-3 ${isExpanded ? "" : "hidden"}">
            ${c.items
              .map(
                (s) => `
              <div class="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between gap-3 hover:border-brand-400 transition">
                <div class="min-w-0">
                  <p class="text-sm font-bold truncate text-slate-700">${s.title}</p>
                </div>
                <div class="shrink-0 text-left">
                  <p class="text-xs font-extrabold text-brand-700">${faNum(s.price)} تومان</p>
                  <button data-add-service="${s.id}" class="mt-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-bold">+ فاکتور</button>
                </div>
              </div>`,
              )
              .join("")}
          </div>
        </div>`;
          })
          .join("")
      : `<p class="text-center text-slate-400 text-sm py-10">موردی یافت نشد.</p>`;

    // افزودن ایونت برای کلیک روی سر‌دسته‌ها
    setTimeout(() => {
      document.querySelectorAll(".cat-header").forEach((header) => {
        header.addEventListener("click", () => {
          const catId = header.dataset.catId;
          if (expandedCategories.has(catId)) {
            expandedCategories.delete(catId);
          } else {
            expandedCategories.add(catId);
          }
          renderItems();
        });
      });
    }, 0);

    return;
  }

  // منبع: محصولات فیزیکی
  const products = store.getProducts().filter((p) => !q || p.name.includes(q));

  el.items.innerHTML = products.length
    ? products
        .map(
          (p) => `
      <div class="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:border-brand-500 transition fade-in">
        <div class="w-14 h-14 rounded-xl bg-slate-100 grid place-items-center overflow-hidden shrink-0">
          ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover" />` : "📦"}
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold truncate">${p.name}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${faNum(p.price)} تومان</p>
          ${p.variants?.length ? `<p class="text-[10px] text-slate-400">${p.variants.map((v) => v.name).join(" | ")}</p>` : ""}
        </div>
        <div class="shrink-0 flex flex-col gap-1">
          <button data-add-product="${p.id}" class="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-bold">+ فاکتور</button>
          ${
            p.variants?.length
              ? p.variants
                  .map(
                    (v) =>
                      `<button data-add-product="${p.id}" data-variant-id="${v.id}" class="text-[10px] bg-brand-50 text-brand-700 px-2 py-1 rounded-lg border border-brand-100 hover:bg-brand-100">${v.name} · ${faNum(v.price)}</button>`,
                  )
                  .join("")
              : ""
          }
        </div>
      </div>`,
        )
        .join("")
    : `<p class="text-center text-slate-400 text-sm py-10">محصولی ثبت نشده است. از تب «محصولات فیزیکی» محصول اضافه کنید.</p>`;
}

// debounce ساده برای سرچ
let searchTimer;
el.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderItems, 120);
});

// کلیک برای افزودن به فاکتور
el.items.addEventListener("click", (e) => {
  const sId = e.target.dataset.addService;
  const pId = e.target.dataset.addProduct;
  const vId = e.target.dataset.variantId;

  if (sId) {
    const s = getAllServices().find((x) => x.id === sId);
    addItemToInvoice({ title: s.title, price: s.price, meta: s.catTitle });
    toast("به فاکتور اضافه شد 🧾");
  }

  if (pId) {
    addProductToInvoice(store.getProduct(pId), vId || null);
  }
});

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2000);
}

// ---------- لوگوی نوبار ----------

// ---------- لوگوی نوبار ----------
function updateNavLogo() {
  const box = document.getElementById("nav-logo");
  if (!box) return;
  const shop = store.getShopInfo();
  if (shop.logo) {
    box.innerHTML = `<img src="${shop.logo}" class="w-full h-full object-contain" alt="لوگو" />`;
    box.classList.remove("bg-brand-600", "text-white");
    box.classList.add("bg-white", "dark:bg-slate-700", "p-1");
  } else {
    box.innerHTML = "ک";
    box.classList.add("bg-brand-600", "text-white");
    box.classList.remove("bg-white", "dark:bg-slate-700", "p-1");
  }
}

// ---------- تنظیمات کسب‌وکار ----------
function initSettings() {
  const shop = store.getShopInfo();
  document.getElementById("shop-name").value = shop.name || "";
  document.getElementById("shop-slogan").value = shop.slogan || "";
  document.getElementById("shop-phone").value = shop.phone || "";
  document.getElementById("shop-address").value = shop.address || "";

  const logoPreview = document.getElementById("logo-preview");
  const logoPlaceholder = document.getElementById("logo-placeholder");
  if (shop.logo) {
    logoPreview.innerHTML = `<img src="${shop.logo}" class="w-full h-full object-contain" />`;
  }

  let tempLogo = shop.logo || "";

  document.getElementById("shop-logo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      tempLogo = reader.result;
      logoPreview.innerHTML = `<img src="${tempLogo}" class="w-full h-full object-contain" />`;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("btn-remove-logo").addEventListener("click", () => {
    tempLogo = "";
    logoPreview.innerHTML = '<span id="logo-placeholder">🖼️</span>';
    document.getElementById("shop-logo").value = "";
  });

  document.getElementById("btn-save-shop").addEventListener("click", () => {
    const info = {
      name:
        document.getElementById("shop-name").value.trim() || "کافی‌نت آنلاین",
      slogan: document.getElementById("shop-slogan").value.trim(),
      phone: document.getElementById("shop-phone").value.trim(),
      address: document.getElementById("shop-address").value.trim(),
      logo: tempLogo,
    };
    store.saveShopInfo(info);
    updateNavLogo(); // ✅ لوگوی نوبار هم فوراً عوض شود

    autoSaveInvoices(); // ✅ بک‌آپ روی فایل محلی متصل‌شده
    autoPushGitHub(); // ✅ push خودکار به گیت‌هاب
    const toast = document.getElementById("toast");
    toast.textContent = "✅ تنظیمات ذخیره شد + بک‌آپ گرفته شد";
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2200);
  });

  // ---------- حالت توسعه و ریست کامل ----------
  const devToggle = document.getElementById("dev-mode-toggle");
  const dangerZone = document.getElementById("danger-zone");

  // نمایش/مخفی‌کردن منطقه خطر بر اساس حالت توسعه
  const applyDevMode = (on) => {
    dangerZone.classList.toggle("hidden", !on);
  };

  // بارگذاری وضعیت ذخیره‌شده
  const settings = store.getSettings();
  devToggle.checked = !!settings.devMode;
  applyDevMode(devToggle.checked);

  // تغییر سوییچ توسعه
  devToggle.addEventListener("change", () => {
    store.saveSettings({ ...store.getSettings(), devMode: devToggle.checked });
    applyDevMode(devToggle.checked);
  });

  // دکمه ریست کامل با تأییدیه دومرحله‌ای
  document.getElementById("btn-reset-all").addEventListener("click", () => {
    if (
      !confirm(
        "⚠️ مطمئن هستید؟\nتمامی فاکتورها، محصولات، تنظیمات کسب‌وکار و شمارنده‌ها حذف خواهند شد!",
      )
    )
      return;

    if (
      !confirm(
        "❌ تأیید نهایی:\nاین عملیات غیرقابل بازگشت است.\nبرای حذف کامل اطلاعات، OK را بزنید.",
      )
    )
      return;

    store.resetAll();
    alert("✅ تمامی اطلاعات حذف شد. برنامه به حالت اولیه برمی‌گردد.");
    location.reload();
  });

  // ---------- تغییر رمز عبور ----------
  document.getElementById("btn-change-pass").addEventListener("click", () => {
    const cur = document.getElementById("pass-current").value;
    const nw = document.getElementById("pass-new").value;
    const cf = document.getElementById("pass-confirm").value;

    if (nw.length < 4) return alert("رمز جدید باید حداقل ۴ کاراکتر باشد.");
    if (nw !== cf) return alert("تکرار رمز با رمز جدید یکسان نیست.");
    if (!store.changePassword(cur, nw)) return alert("رمز فعلی اشتباه است.");

    document.getElementById("pass-current").value = "";
    document.getElementById("pass-new").value = "";
    document.getElementById("pass-confirm").value = "";
    alert("✅ رمز عبور با موفقیت تغییر کرد.");
  });
}

// ---------- init ----------
// ---------- تشخیص نقش از آدرس ----------
// ?role=customer  → پورتال مشتری (فقط نرخ‌نامه)
// ?role=admin یا بدون پارامتر → مدیریت کامل
const APP_ROLE = (
  new URLSearchParams(window.location.search).get("role") ||
  (window.location.hash === "#customer" ? "customer" : "admin")
).toLowerCase();

if (APP_ROLE === "customer") {
  initCustomerPortal();
} else {
  document.getElementById("today-date").textContent = todayFa();
  updateNavLogo(); // ✅ بارگذاری لوگو در نوبار هنگام شروع برنامه
  initAuth();
  initInvoiceEvents();
  initProductEvents();
  initSettings();
  updateNavLogo(); // ✅ بارگذاری لوگو در نوبار هنگام شروع
  initBackup();
  initGitHubUI();
  initCustomers();
  window.initInvoiceDetailEvents();
  setView("invoice");
  setSource("services");
}
