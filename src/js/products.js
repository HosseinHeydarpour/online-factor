import { store, faNum, uid } from "./store.js";
import { addItemToInvoice } from "./invoice.js";
import { autoSaveInvoices } from "./backup.js"; // 💾 بک‌آپ محلی
import { autoPushGitHub } from "./github.js"; // ☁️ بک‌آپ گیت‌هاب
import { autoPushPublicRepo } from "./github.js"; // ☁️ بک‌آپ گیت‌هاب

let editingId = null;
let tempImage = "";
let tempVariants = [];

const el = {
  grid: document.getElementById("products-grid"),
  empty: document.getElementById("products-empty"),
  modal: document.getElementById("product-modal"),
  title: document.getElementById("product-modal-title"),
  name: document.getElementById("p-name"),
  price: document.getElementById("p-price"),
  image: document.getElementById("p-image"),
  preview: document.getElementById("p-preview"),
  variants: document.getElementById("variants-list"),
  search: document.getElementById("product-search"),
};

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2200);
}

/* ============================================================
   کارت محصول — نسخه بهبودیافته
   (دارک‌مود کامل + بج تعداد واریانت + چیدمان هم‌قد + دکمه‌های title‌دار)
============================================================ */
export function renderProducts(filter = "") {
  const list = store.getProducts().filter((p) => p.name.includes(filter));
  el.empty.classList.toggle("hidden", list.length > 0);
  el.grid.innerHTML = list
    .map(
      (p) => `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden fade-in flex flex-col">
      <!-- تصویر -->
      <div class="h-32 sm:h-36 bg-slate-100 dark:bg-slate-700 grid place-items-center relative overflow-hidden shrink-0">
        ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover" />` : `<span class="text-4xl">📦</span>`}
        ${
          p.variants?.length
            ? `<span class="absolute top-2 left-2 text-[10px] font-bold bg-brand-600 text-white px-2 py-0.5 rounded-full shadow">${faNum(p.variants.length)} واریانت</span>`
            : ""
        }
      </div>
      <!-- بدنه -->
      <div class="p-3 space-y-2 flex-1 flex flex-col">
        <h3 class="font-bold text-sm truncate" title="${p.name}">${p.name}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          قیمت پایه: <b class="text-brand-700 dark:text-brand-400">${faNum(p.price)}</b> تومان
        </p>
        ${
          p.variants?.length
            ? `<div class="flex flex-wrap gap-1">
                ${p.variants
                  .map(
                    (v) => `
                  <button data-add-variant="${p.id}" data-variant-id="${v.id}"
                    class="text-[10px] bg-brand-50 dark:bg-slate-700 text-brand-700 dark:text-brand-400 border border-brand-100 dark:border-slate-600 px-2 py-1 rounded-full hover:bg-brand-100 dark:hover:bg-slate-600 transition">
                    ${v.name} · ${faNum(v.price)}
                  </button>`,
                  )
                  .join("")}
               </div>`
            : ""
        }
        <!-- دکمه‌ها -->
        <div class="flex gap-1.5 pt-1 mt-auto">
          <button data-add-product="${p.id}" class="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold">+ فاکتور</button>
          <button data-edit="${p.id}" title="ویرایش" class="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-2 rounded-lg font-bold">✏️</button>
          <button data-delete="${p.id}" title="حذف" class="text-xs bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3 py-2 rounded-lg font-bold">🗑️</button>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

/* ============================================================
   مودال پرسش واریانت — «کدوم مورد مورد تاییده؟»
============================================================ */
function openVariantPicker(product, preselectId = null, onConfirm = null) {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-[60] modal-backdrop grid place-items-center p-4";
  overlay.innerHTML = `
    <div class="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 fade-in">
      <h3 class="font-extrabold text-sm mb-1">✅ کدوم مورد مورد تاییده؟</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate">${product.name}</p>
      <div class="space-y-2 max-h-64 overflow-auto pl-1">
        <button data-pick=""
          class="w-full flex items-center justify-between gap-2 text-xs border ${
            !preselectId
              ? "border-brand-500 ring-1 ring-brand-500"
              : "border-slate-200 dark:border-slate-600"
          } rounded-xl px-3 py-2.5 hover:border-brand-500 font-bold bg-slate-50 dark:bg-slate-700/50">
          <span>بدون واریانت (قیمت پایه)</span>
          <span class="text-brand-700 dark:text-brand-400 shrink-0">${faNum(product.price)} تومان</span>
        </button>
        ${(product.variants || [])
          .map(
            (v) => `
          <button data-pick="${v.id}"
            class="w-full flex items-center justify-between gap-2 text-xs border ${
              preselectId === v.id
                ? "border-brand-500 ring-1 ring-brand-500"
                : "border-slate-200 dark:border-slate-600"
            } rounded-xl px-3 py-2.5 hover:border-brand-500 font-bold bg-slate-50 dark:bg-slate-700/50">
            <span>${v.name}</span>
            <span class="text-brand-700 dark:text-brand-400 shrink-0">${faNum(v.price)} تومان</span>
          </button>`,
          )
          .join("")}
      </div>
      <button data-pick-cancel
        class="w-full mt-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl py-2 text-xs font-bold">
        انصراف
      </button>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) return close();
    if (e.target.closest("[data-pick-cancel]")) return close();
    const pickBtn = e.target.closest("[data-pick]");
    if (pickBtn) {
      const variantId = pickBtn.dataset.pick || null;
      close();
      onConfirm?.(variantId);
    }
  });
}

/* ============================================================
   افزودن محصول به فاکتور — اگر واریانت داشت، اول می‌پرسد
============================================================ */
export function addProductToInvoice(product, preselectVariantId = null) {
  if (!product) return;

  const confirmAdd = (variantId) => {
    if (variantId) {
      const v = product.variants.find((x) => x.id === variantId);
      if (v) {
        addItemToInvoice({
          title: product.name,
          price: v.price,
          meta: `واریانت: ${v.name}`,
        });
        toast(`«${v.name}» به فاکتور اضافه شد 🧾`);
        return;
      }
    }
    addItemToInvoice({ title: product.name, price: product.price });
    toast("به فاکتور اضافه شد 🧾");
  };

  if (product.variants?.length) {
    openVariantPicker(product, preselectVariantId, confirmAdd);
  } else {
    confirmAdd(null);
  }
}

/* ---------- فرم واریانت‌ها داخل مودال محصول ---------- */
function renderVariantsForm() {
  el.variants.innerHTML = tempVariants.length
    ? tempVariants
        .map(
          (v, i) => `
      <div class="flex gap-2 items-center">
        <input data-vname="${i}" value="${v.name}" placeholder="عنوان واریانت (مثلاً ۶۴ گیگ)"
          class="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500" />
        <input data-vprice="${i}" type="number" min="0" value="${v.price}" placeholder="قیمت"
          class="w-28 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500" />
        <button data-vdel="${i}" class="text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-700 w-7 h-7 rounded-lg">✕</button>
      </div>`,
        )
        .join("")
    : `<p class="text-[11px] text-slate-400">واریانتی ثبت نشده است.</p>`;
}

function openModal(product = null) {
  editingId = product?.id ?? null;
  tempImage = product?.image ?? "";
  tempVariants = product ? product.variants.map((v) => ({ ...v })) : [];
  el.title.textContent = product ? "ویرایش محصول" : "محصول جدید";
  el.name.value = product?.name ?? "";
  el.price.value = product?.price ?? "";
  el.preview.src = tempImage;
  el.preview.classList.toggle("hidden", !tempImage);
  el.image.value = "";
  renderVariantsForm();
  el.modal.classList.remove("hidden");
}

function closeModal() {
  el.modal.classList.add("hidden");
}

/* ---------- ایونت‌ها ---------- */
export function initProductEvents() {
  document
    .getElementById("btn-add-product")
    .addEventListener("click", () => openModal());
  document
    .getElementById("btn-close-modal")
    .addEventListener("click", closeModal);
  document
    .getElementById("btn-cancel-product")
    .addEventListener("click", closeModal);
  el.modal.addEventListener(
    "click",
    (e) => e.target === el.modal && closeModal(),
  );

  // آپلود عکس → base64
  el.image.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      tempImage = reader.result;
      el.preview.src = tempImage;
      el.preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });

  // واریانت‌ها
  document.getElementById("btn-add-variant").addEventListener("click", () => {
    tempVariants.push({ id: uid(), name: "", price: 0 });
    renderVariantsForm();
  });
  el.variants.addEventListener("input", (e) => {
    const ni = e.target.dataset.vname;
    const pi = e.target.dataset.vprice;
    if (ni !== undefined) tempVariants[ni].name = e.target.value;
    if (pi !== undefined) tempVariants[pi].price = Number(e.target.value) || 0;
  });
  el.variants.addEventListener("click", (e) => {
    const di = e.target.dataset.vdel;
    if (di !== undefined) {
      tempVariants.splice(di, 1);
      renderVariantsForm();
    }
  });

  // ---------- ذخیره محصول + بک‌آپ کامل ----------
  document.getElementById("btn-save-product").addEventListener("click", () => {
    const name = el.name.value.trim();
    const price = Number(el.price.value) || 0;
    if (!name || price <= 0) return alert("نام و قیمت محصول الزامی است.");
    const variants = tempVariants.filter((v) => v.name.trim());
    store.saveProduct({
      id: editingId ?? uid(),
      name,
      price,
      image: tempImage,
      variants,
    });
    closeModal();
    renderProducts();
    toast(editingId ? "محصول ویرایش شد ✅" : "محصول اضافه شد ✅");

    // ✅ بک‌آپ خودکار
    autoSaveInvoices(); // 💾 فایل محلی
    autoPushGitHub(); // ☁️ ریپوی خصوصی
    autoPushPublicRepo(); // 🌐 ریپوی پابلیک (جدید)
  });

  // ---------- کلیک‌های روی گرید محصولات ----------
  el.grid.addEventListener("click", (e) => {
    const edit = e.target.dataset.edit;
    const del = e.target.dataset.delete;
    const add = e.target.dataset.addProduct;
    const addV = e.target.dataset.addVariant;

    if (edit) openModal(store.getProduct(edit));

    if (del && confirm("این محصول حذف شود؟")) {
      store.deleteProduct(del);
      renderProducts();
      toast("محصول حذف شد 🗑️");
      // ✅ بک‌آپ بعد از حذف
      autoSaveInvoices();
      autoPushGitHub();
      autoPushPublicRepo(); // 🌐 ریپوی پابلیک (جدید)
    }

    // ✅ افزودن به فاکتور — اگر واریانت داشت، مودال پرسش باز می‌شود
    if (add) addProductToInvoice(store.getProduct(add));
    if (addV)
      addProductToInvoice(store.getProduct(addV), e.target.dataset.variantId);
  });

  el.search.addEventListener("input", () =>
    renderProducts(el.search.value.trim()),
  );
}
