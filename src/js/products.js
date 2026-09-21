import { store, faNum, uid, toEnDigits } from "./store.js";
import { addItemToInvoice } from "./invoice.js";
import { autoSaveInvoices } from "./backup.js";
import {
  autoPushGitHub,
  autoPushPublicRepo,
  syncAllStorages,
} from "./github.js";
import { createPricePreviewHTML } from "./price-helper.js";
import { compressImage } from "./image-utils.js";

let editingId = null;
let tempImage = "";
let tempVariants = [];
let tempColors = [];
let productQuillInstance = null;
let selectedCategoryId = "all"; // فیلتر دسته‌بندی فعال

const el = {
  grid: document.getElementById("products-grid"),
  empty: document.getElementById("products-empty"),
  chips: document.getElementById("product-category-chips"),
  modal: document.getElementById("product-modal"),
  title: document.getElementById("product-modal-title"),
  category: document.getElementById("p-category"),
  name: document.getElementById("p-name"),
  price: document.getElementById("p-price"),
  pricePreview: document.getElementById("p-price-preview"),
  quantity: document.getElementById("p-quantity"),
  specialOffer: document.getElementById("p-special-offer"),
  image: document.getElementById("p-image"),
  preview: document.getElementById("p-preview"),
  variants: document.getElementById("variants-list"),
  colorsList: document.getElementById("product-colors-list"),
  search: document.getElementById("product-search"),

  // مودال دسته‌ها
  catModal: document.getElementById("product-categories-modal"),
  catList: document.getElementById("pcat-list-container"),
  catNameInput: document.getElementById("pcat-name-input"),
  catIconInput: document.getElementById("pcat-icon-input"),
  catEditId: document.getElementById("pcat-edit-id"),
  btnCancelEditCat: document.getElementById("btn-cancel-edit-pcat"),
};

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2200);
}

/* ============================================================
   چیپ‌های فیلتر دسته‌بندی
============================================================ */
export function renderCategoryChips() {
  if (!el.chips) return;
  const categories = store.getProductCategories();
  const allProducts = store.getProducts();

  const chipsData = [
    { id: "all", name: "همه محصولات", icon: "🌐", count: allProducts.length },
    ...categories.map((c) => ({
      ...c,
      count: allProducts.filter((p) => p.categoryId === c.id).length,
    })),
  ];

  el.chips.innerHTML = chipsData
    .map((c) => {
      const active = selectedCategoryId === c.id;
      return `
      <button data-chip-cat="${c.id}"
        class="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition shadow-sm min-h-[38px] ${
          active
            ? "bg-brand-600 text-white shadow"
            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
        }">
        <span>${c.icon || "📦"}</span>
        <span>${c.name}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-full font-bold ${
          active
            ? "bg-white/20 text-white"
            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
        }">${faNum(c.count)}</span>
      </button>`;
    })
    .join("");

  el.chips.querySelectorAll("[data-chip-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCategoryId = btn.dataset.chipCat;
      renderCategoryChips();
      renderProducts(el.search?.value.trim() || "");
    });
  });
}

/* ============================================================
   کارت‌های محصولات با تگ دسته‌بندی
============================================================ */
export function renderProducts(filter = "") {
  let list = store.getProducts();

  if (selectedCategoryId !== "all") {
    list = list.filter((p) => p.categoryId === selectedCategoryId);
  }

  if (filter) {
    list = list.filter((p) => (p.name || "").includes(filter));
  }

  el.empty?.classList.toggle("hidden", list.length > 0);
  el.grid.innerHTML = list
    .map((p) => {
      const category = store.getProductCategory(p.categoryId);
      const baseInStock = (p.quantity ?? 0) > 0;
      return `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden fade-in flex flex-col">
      <!-- تصویر -->
      <div class="h-32 sm:h-36 bg-slate-100 dark:bg-slate-700 grid place-items-center relative overflow-hidden shrink-0">
        ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover" />` : `<span class="text-4xl">📦</span>`}
        
        <!-- بج دسته بندی -->
        ${
          category
            ? `<span class="absolute top-2 right-2 text-[10px] font-bold bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-full shadow backdrop-blur flex items-center gap-1">
                 <span>${category.icon || "📦"}</span>
                 <span>${category.name}</span>
               </span>`
            : ""
        }

        ${
          p.isSpecialOffer
            ? `<span class="absolute top-2 left-2 text-[10px] font-black bg-gradient-to-r from-rose-500 to-amber-500 text-white px-2 py-0.5 rounded-full shadow animate-pulse">🔥 ویژه</span>`
            : p.variants?.length
              ? `<span class="absolute top-2 left-2 text-[10px] font-bold bg-brand-600 text-white px-2 py-0.5 rounded-full shadow">${faNum(p.variants.length)} واریانت</span>`
              : ""
        }
      </div>
      <!-- بدنه -->
      <div class="p-3 space-y-2 flex-1 flex flex-col">
        <h3 class="font-bold text-sm truncate" title="${p.name}">${p.name}</h3>
        <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>قیمت پایه: <b class="text-brand-700 dark:text-brand-400">${faNum(p.price)}</b> تومان</span>
          ${
            baseInStock
              ? `<span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">موجودی: ${faNum(p.quantity)}</span>`
              : `<span class="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-900/40 px-2 py-0.5 rounded-full">ناموجود</span>`
          }
        </div>
        ${
          p.colors?.length
            ? `<div class="flex items-center gap-1.5 pt-0.5">
                 <span class="text-[10px] text-slate-400">رنگ‌ها:</span>
                 <div class="flex items-center gap-1 flex-wrap">
                   ${p.colors
                     .map(
                       (c) =>
                         `<span class="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-500 shrink-0" style="background-color: ${c.hex}" title="${c.name}"></span>`,
                     )
                     .join("")}
                 </div>
               </div>`
            : ""
        }
        ${
          p.variants?.length
            ? `<div class="flex flex-wrap gap-1">
                ${p.variants
                  .map((v) => {
                    const vInStock = (v.quantity ?? 0) > 0;
                    return `
                  <button data-add-variant="${p.id}" data-variant-id="${v.id}"
                    class="text-[10px] ${
                      vInStock
                        ? "bg-brand-50 dark:bg-slate-700 text-brand-700 dark:text-brand-400 border-brand-100 dark:border-slate-600 hover:bg-brand-100 dark:hover:bg-slate-600"
                        : "bg-rose-50 dark:bg-rose-900/30 text-rose-500 border-rose-200 dark:border-rose-900/40"
                    } border px-2 py-1 rounded-full transition flex items-center gap-1">
                    <span>${v.name} · ${faNum(v.price)}</span>
                    <span class="text-[9px] opacity-75">(${vInStock ? `${faNum(v.quantity)} عدد` : "ناموجود"})</span>
                  </button>`;
                  })
                  .join("")}
               </div>`
            : ""
        }
        <!-- دکمه‌ها -->
        <div class="flex gap-2 pt-1.5 mt-auto">
          <button data-add-product="${p.id}" class="flex-1 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl font-bold shadow-sm transition flex items-center justify-center gap-1.5 min-h-[38px]">
            <span>➕</span>
            <span>افزودن به فاکتور</span>
          </button>
          <button data-edit="${p.id}" title="ویرایش محصول" class="text-xs sm:text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3.5 py-2.5 rounded-xl font-bold transition min-h-[38px] flex items-center justify-center">✏️</button>
          <button data-delete="${p.id}" title="حذف محصول" class="text-xs sm:text-sm bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3.5 py-2.5 rounded-xl font-bold transition min-h-[38px] flex items-center justify-center">🗑️</button>
        </div>
      </div>
    </div>`;
    })
    .join("");
}

/* ============================================================
   مودال انتخاب واریانت
============================================================ */
function openVariantPicker(product, preselectId = null, onConfirm = null) {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 z-[60] modal-backdrop grid place-items-center p-4";
  overlay.innerHTML = `
    <div class="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 fade-in">
      <h3 class="font-extrabold text-sm mb-1">✅ انتخاب واریانت محصول</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate">${product.name}</p>
      <div class="space-y-2 max-h-64 overflow-auto pl-1">
        <button data-pick=""
          class="w-full flex items-center justify-between gap-2 text-xs border ${
            !preselectId
              ? "border-brand-500 ring-1 ring-brand-500"
              : "border-slate-200 dark:border-slate-600"
          } rounded-xl px-3 py-2.5 hover:border-brand-500 font-bold bg-slate-50 dark:bg-slate-700/50">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="truncate">بدون واریانت (قیمت پایه)</span>
            <span class="text-[10px] shrink-0 ${(product.quantity ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}">
              (${ (product.quantity ?? 0) > 0 ? `موجودی: ${faNum(product.quantity)}` : "ناموجود" })
            </span>
          </div>
          <span class="text-brand-700 dark:text-brand-400 shrink-0 font-mono">${faNum(product.price)} تومان</span>
        </button>
        ${(product.variants || [])
          .map((v) => {
            const vInStock = (v.quantity ?? 0) > 0;
            return `
          <button data-pick="${v.id}"
            class="w-full flex items-center justify-between gap-2 text-xs border ${
              preselectId === v.id
                ? "border-brand-500 ring-1 ring-brand-500"
                : "border-slate-200 dark:border-slate-600"
            } rounded-xl px-3 py-2.5 hover:border-brand-500 font-bold bg-slate-50 dark:bg-slate-700/50">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="truncate">${v.name}</span>
              <span class="text-[10px] shrink-0 ${vInStock ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}">
                (${ vInStock ? `موجودی: ${faNum(v.quantity)}` : "ناموجود" })
              </span>
            </div>
            <span class="text-brand-700 dark:text-brand-400 shrink-0 font-mono">${faNum(v.price)} تومان</span>
          </button>`;
          })
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

export function addProductToInvoice(product, preselectVariantId = null) {
  if (!product) return;

  const confirmAdd = (variantId) => {
    // بررسی موجودی محصول
    const baseQty = product.quantity ?? 0;
    
    if (variantId) {
      const v = product.variants.find((x) => x.id === variantId);
      if (v) {
        const variantQty = v.quantity ?? 0;
        if (variantQty <= 0) {
          toast(`❌ موجودی واریانت «${v.name}» تمام شده است`);
          return;
        }
        addItemToInvoice({
          title: product.name,
          price: v.price,
          meta: `واریانت: ${v.name}`,
          productId: product.id,
          variantId: v.id,
        });
        toast(`«${v.name}» به فاکتور اضافه شد 🧾`);
        return;
      }
    }
    
    // بررسی موجودی پایه
    if (baseQty <= 0) {
      toast(`❌ موجودی محصول «${product.name}» تمام شده است`);
      return;
    }
    
    addItemToInvoice({ 
      title: product.name, 
      price: product.price,
      productId: product.id,
      variantId: null,
    });
    toast("به فاکتور اضافه شد 🧾");
  };

  if (product.variants?.length) {
    openVariantPicker(product, preselectVariantId, confirmAdd);
  } else {
    confirmAdd(null);
  }
}

/* ---------- فرم واریانت‌ها ---------- */
function renderVariantsForm() {
  el.variants.innerHTML = tempVariants.length
    ? tempVariants
        .map(
          (v, i) => `
      <div class="bg-slate-50 dark:bg-slate-700/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 space-y-1">
        <div class="flex gap-2 items-center">
          <input data-vname="${i}" value="${v.name}" placeholder="عنوان واریانت (مثلاً ۶۴ گیگ)"
            class="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500" />
          <input data-vprice="${i}" type="number" min="0" value="${v.price || ""}" placeholder="قیمت"
            class="w-28 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500 text-left font-mono" />
          <input data-vqty="${i}" type="number" min="0" value="${v.quantity !== undefined && v.quantity !== null ? v.quantity : 1}" placeholder="موجودی"
            class="w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500 text-left font-mono" />
          <button type="button" data-vdel="${i}" class="text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-600 w-7 h-7 rounded-lg font-bold">✕</button>
        </div>
        <div data-vpreview="${i}">
          ${createPricePreviewHTML(v.price)}
        </div>
      </div>`,
        )
        .join("")
    : `<p class="text-[11px] text-slate-400">واریانتی ثبت نشده است.</p>`;
}

function updateMainPricePreview() {
  if (el.pricePreview) {
    el.pricePreview.innerHTML = createPricePreviewHTML(el.price.value);
  }
}

function fillCategorySelect(selectedId = "") {
  if (!el.category) return;
  const categories = store.getProductCategories();
  el.category.innerHTML = `
    <option value="">بدون دسته‌بندی</option>
    ${categories
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${c.icon || "📦"} ${c.name}</option>`,
      )
      .join("")}
  `;
  if (typeof window !== "undefined" && typeof window.enhanceAllSelects === "function") {
    window.enhanceAllSelects(el.category.parentElement);
  }
}

function initProductQuillEditor() {
  if (productQuillInstance || typeof window === "undefined" || !window.Quill) return;
  const container = document.getElementById("product-editor-container");
  if (!container) return;

  productQuillInstance = new window.Quill(container, {
    theme: "snow",
    placeholder: "توضیحات تکمیلی، مشخصات فنی، اقلام همراه یا نکات محصول را اینجا بنویسید…",
    modules: {
      toolbar: [
        [{ header: [false, 1, 2, 3] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link", "blockquote", "clean"],
      ],
    },
  });

  if (productQuillInstance.root) {
    productQuillInstance.root.setAttribute("dir", "rtl");
    productQuillInstance.format("direction", "rtl");
    productQuillInstance.format("align", "right");
  }
}

function renderProductColorsForm() {
  const container = document.getElementById("product-colors-list");
  if (!container) return;

  if (!tempColors.length) {
    container.innerHTML = `<span class="text-[11px] text-slate-400">هنوز رنگی انتخاب نشده است.</span>`;
    return;
  }

  container.innerHTML = tempColors
    .map((c, i) => {
      const isLight =
        (c.hex || "").toLowerCase() === "#ffffff" ||
        (c.hex || "").toLowerCase() === "#fff";
      return `
      <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full px-2.5 py-1 text-xs shadow-sm">
        <span class="w-3 h-3 rounded-full shrink-0 ${isLight ? "border border-slate-300 dark:border-slate-500" : ""}" style="background-color: ${c.hex}"></span>
        <span class="font-bold text-slate-700 dark:text-slate-200">${c.name}</span>
        <button type="button" data-color-del="${i}" class="text-slate-400 hover:text-rose-500 font-bold mr-0.5 text-sm leading-none" title="حذف این رنگ">✕</button>
      </div>`;
    })
    .join("");
}

function addProductColor(name, hex) {
  const cleanName = (name || "").trim();
  const cleanHex = (hex || "#000000").trim();
  if (!cleanName) {
    alert("لطفاً نام رنگ را وارد کنید (مثلاً مشکی، سفید، نقره‌ای).");
    return;
  }
  if (
    tempColors.some(
      (c) =>
        c.name === cleanName &&
        c.hex.toLowerCase() === cleanHex.toLowerCase(),
    )
  ) {
    return;
  }
  tempColors.push({ name: cleanName, hex: cleanHex });
  renderProductColorsForm();
  const nameInput = document.getElementById("p-color-name");
  if (nameInput) nameInput.value = "";
}

function openModal(product = null) {
  initProductQuillEditor();
  editingId = product?.id ?? null;
  tempImage = product?.image ?? "";
  tempVariants = product ? product.variants.map((v) => ({ ...v })) : [];
  tempColors = product?.colors ? product.colors.map((c) => ({ ...c })) : [];

  el.title.textContent = product ? "ویرایش محصول" : "محصول جدید";
  el.name.value = product?.name ?? "";
  el.price.value = product?.price ?? "";
  if (el.quantity) {
    el.quantity.value = product
      ? product.quantity !== undefined && product.quantity !== null
        ? product.quantity
        : 1
      : 1;
  }

  const specialOfferEl = document.getElementById("p-special-offer");
  if (specialOfferEl) {
    specialOfferEl.checked = Boolean(product?.isSpecialOffer);
  }

  el.preview.src = tempImage;
  el.preview.classList.toggle("hidden", !tempImage);
  el.image.value = "";

  const colorNameInput = document.getElementById("p-color-name");
  if (colorNameInput) colorNameInput.value = "";
  renderProductColorsForm();

  if (productQuillInstance) {
    productQuillInstance.root.innerHTML = product?.description || "";
  }

  fillCategorySelect(product?.categoryId || "");
  updateMainPricePreview();
  renderVariantsForm();
  el.modal.classList.remove("hidden");
}

function closeModal() {
  el.modal?.classList.add("hidden");
}

/* ============================================================
   مدیریت مودال دسته‌بندی‌ها + سینک آنی گیت‌هاب
============================================================ */
function renderCategoriesListModal() {
  if (!el.catList) return;
  const categories = store.getProductCategories();
  const allProducts = store.getProducts();

  if (!categories.length) {
    el.catList.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">دسته‌ای تعریف نشده است.</p>`;
    return;
  }

  el.catList.innerHTML = categories
    .map((c) => {
      const count = allProducts.filter((p) => p.categoryId === c.id).length;
      return `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-base">${c.icon || "📦"}</span>
          <span class="font-bold text-slate-800 dark:text-slate-100 truncate">${c.name}</span>
          <span class="text-[10px] text-slate-400">(${faNum(count)} کالا)</span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button data-pcat-edit="${c.id}" class="text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 p-1.5 rounded-lg">✏️</button>
          <button data-pcat-del="${c.id}" class="text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-600 p-1.5 rounded-lg">🗑️</button>
        </div>
      </div>`;
    })
    .join("");
}

function resetCategoryForm() {
  if (el.catEditId) el.catEditId.value = "";
  if (el.catNameInput) el.catNameInput.value = "";
  if (el.catIconInput) el.catIconInput.value = "📦";
  el.btnCancelEditCat?.classList.add("hidden");
}

function openCategoriesModal() {
  resetCategoryForm();
  renderCategoriesListModal();
  el.catModal?.classList.remove("hidden");
}

function closeCategoriesModal() {
  el.catModal?.classList.add("hidden");
  resetCategoryForm();
}

function initCategoryModalEvents() {
  document
    .getElementById("btn-manage-product-categories")
    ?.addEventListener("click", openCategoriesModal);
  document
    .getElementById("btn-close-pcat-modal")
    ?.addEventListener("click", closeCategoriesModal);
  el.catModal?.addEventListener("click", (e) => {
    if (e.target === el.catModal) closeCategoriesModal();
  });

  el.btnCancelEditCat?.addEventListener("click", resetCategoryForm);

  // ذخیره دسته جدید یا ویرایش شده
  document.getElementById("btn-save-pcat")?.addEventListener("click", () => {
    const name = el.catNameInput?.value.trim();
    const icon = el.catIconInput?.value.trim() || "📦";
    const editId = el.catEditId?.value;

    if (!name) return alert("نام دسته‌بندی الزامی است.");

    store.saveProductCategory({ id: editId || null, name, icon });
    resetCategoryForm();
    renderCategoriesListModal();
    renderCategoryChips();
    renderProducts(el.search?.value.trim() || "");

    // 🚀 همگام‌سازی آنی محلی + گیت‌هاب خصوصی و پابلیک
    const catTitle = editId ? `ویرایش دسته‌بندی «${name}»` : `افزودن دسته‌بندی «${name}»`;
    syncAllStorages({ title: catTitle, showToast: true });
    toast("✅ دسته‌بندی ذخیره شد 📦");
  });

  // کلیک روی ویرایش یا حذف دسته
  el.catList?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-pcat-edit]");
    const delBtn = e.target.closest("[data-pcat-del]");

    if (editBtn) {
      const id = editBtn.dataset.pcatEdit;
      const cat = store.getProductCategory(id);
      if (cat) {
        el.catEditId.value = cat.id;
        el.catNameInput.value = cat.name;
        el.catIconInput.value = cat.icon || "📦";
        el.btnCancelEditCat?.classList.remove("hidden");
        el.catNameInput.focus();
      }
    }

    if (delBtn) {
      const id = delBtn.dataset.pcatDel;
      if (
        confirm(
          "این دسته‌بندی حذف شود؟ (محصولات متعلق به این دسته حذف نمی‌شوند و به دسته عمومی منتقل می‌شوند)",
        )
      ) {
        const catToDel = store.getProductCategory(id);
        const catName = catToDel?.name ? ` «${catToDel.name}»` : "";
        store.deleteProductCategory(id);
        if (selectedCategoryId === id) selectedCategoryId = "all";
        renderCategoriesListModal();
        renderCategoryChips();
        renderProducts(el.search?.value.trim() || "");

        // 🚀 همگام‌سازی آنی پس از حذف
        await syncAllStorages({ title: `حذف دسته‌بندی${catName}`, showToast: true });
        toast("دسته‌بندی حذف شد 🗑️");
      }
    }
  });
}

/* ============================================================
   اتصال ایونت‌های اصلی ماژول
============================================================ */
export function initProductEvents() {
  initCategoryModalEvents();
  renderCategoryChips();

  document
    .getElementById("btn-add-product")
    ?.addEventListener("click", () => openModal());
  document
    .getElementById("btn-close-modal")
    ?.addEventListener("click", closeModal);
  document
    .getElementById("btn-cancel-product")
    ?.addEventListener("click", closeModal);
  el.modal?.addEventListener(
    "click",
    (e) => e.target === el.modal && closeModal(),
  );

  el.price?.addEventListener("input", updateMainPricePreview);

  el.image?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      tempImage = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.75,
      });
      el.preview.src = tempImage;
      el.preview.classList.remove("hidden");
    } catch (err) {
      console.warn("خطا در بهینه‌سازی تصویر محصول:", err);
    }
  });

  document.getElementById("btn-add-variant")?.addEventListener("click", () => {
    tempVariants.push({ id: uid(), name: "", price: 0, quantity: 1 });
    renderVariantsForm();
  });

  el.variants?.addEventListener("input", (e) => {
    const ni = e.target.dataset.vname;
    const pi = e.target.dataset.vprice;
    const qi = e.target.dataset.vqty;
    if (ni !== undefined) tempVariants[Number(ni)].name = e.target.value;
    if (pi !== undefined) {
      const idx = Number(pi);
      tempVariants[idx].price = Number(toEnDigits(e.target.value)) || 0;
      const previewBox = el.variants.querySelector(`[data-vpreview="${idx}"]`);
      if (previewBox) {
        previewBox.innerHTML = createPricePreviewHTML(e.target.value);
      }
    }
    if (qi !== undefined) {
      const idx = Number(qi);
      const parsed = parseInt(toEnDigits(e.target.value), 10);
      tempVariants[idx].quantity = isNaN(parsed) ? 1 : Math.max(0, parsed);
    }
  });

  el.variants?.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-vdel]");
    if (delBtn) {
      const di = Number(delBtn.dataset.vdel);
      tempVariants.splice(di, 1);
      renderVariantsForm();
    }
  });

  // ذخیره محصول
  document.getElementById("btn-save-product")?.addEventListener("click", async () => {
    const name = el.name.value.trim();
    const price = Number(toEnDigits(el.price.value)) || 0;
    const categoryId = el.category?.value || "";

    let quantity = 1;
    if (el.quantity) {
      const qVal = el.quantity.value.trim();
      if (qVal !== "") {
        const parsed = parseInt(toEnDigits(qVal), 10);
        quantity = isNaN(parsed) ? 1 : Math.max(0, parsed);
      }
    }

    if (!name || price <= 0) return alert("نام و قیمت محصول الزامی است.");
    const variants = tempVariants
      .filter((v) => v.name.trim())
      .map((v) => {
        let vQty = 1;
        if (
          v.quantity !== undefined &&
          v.quantity !== null &&
          String(v.quantity).trim() !== ""
        ) {
          const parsed = parseInt(toEnDigits(String(v.quantity)), 10);
          vQty = isNaN(parsed) ? 1 : Math.max(0, parsed);
        }
        return {
          ...v,
          price: Number(toEnDigits(String(v.price))) || 0,
          quantity: vQty,
        };
      });

    const specialOfferEl = document.getElementById("p-special-offer");
    const isSpecialOffer = specialOfferEl ? specialOfferEl.checked : false;

    let description = "";
    if (productQuillInstance) {
      description = productQuillInstance.root.innerHTML.trim();
      if (description === "<p><br></p>") description = "";
    }

    store.saveProduct({
      id: editingId ?? uid(),
      name,
      categoryId,
      price,
      quantity,
      image: tempImage,
      variants,
      colors: tempColors,
      description,
      isSpecialOffer,
    });

    closeModal();
    renderCategoryChips();
    renderProducts(el.search?.value.trim() || "");
    toast(editingId ? "محصول ویرایش شد ✅" : "محصول اضافه شد ✅");

    const prodTitle = editingId ? `ویرایش محصول «${name}»` : `ساخت محصول «${name}»`;
    await syncAllStorages({ title: prodTitle, showToast: true });
  });

  // رویدادهای رنگ محصول
  document.getElementById("btn-add-color")?.addEventListener("click", () => {
    const nameInput = document.getElementById("p-color-name");
    const picker = document.getElementById("p-color-picker");
    const name = nameInput?.value.trim();
    const hex = picker?.value || "#111827";
    addProductColor(name, hex);
  });

  document.getElementById("p-color-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nameInput = document.getElementById("p-color-name");
      const picker = document.getElementById("p-color-picker");
      addProductColor(nameInput?.value.trim(), picker?.value || "#111827");
    }
  });

  // پالت رنگ‌های پرکاربرد و دکمه حذف رنگ
  document.getElementById("product-modal")?.addEventListener("click", (e) => {
    const presetBtn = e.target.closest("[data-preset-color]");
    if (presetBtn) {
      const color = presetBtn.dataset.presetColor;
      const name = presetBtn.dataset.presetName;
      addProductColor(name, color);
      const picker = document.getElementById("p-color-picker");
      if (picker) picker.value = color;
      return;
    }

    const delColorBtn = e.target.closest("[data-color-del]");
    if (delColorBtn) {
      const idx = Number(delColorBtn.dataset.colorDel);
      if (!isNaN(idx)) {
        tempColors.splice(idx, 1);
        renderProductColorsForm();
      }
      return;
    }
  });

  // کلیک‌های گرید محصولات
  el.grid?.addEventListener("click", async (e) => {
    const edit = e.target.dataset.edit;
    const del = e.target.dataset.delete;
    const add = e.target.dataset.addProduct;
    const addV = e.target.dataset.addVariant;

    if (edit) openModal(store.getProduct(edit));

    if (del && confirm("این محصول حذف شود؟")) {
      const pToDel = store.getProduct(del);
      const prodName = pToDel?.name ? ` «${pToDel.name}»` : "";
      store.deleteProduct(del);
      renderCategoryChips();
      renderProducts(el.search?.value.trim() || "");
      toast("محصول حذف شد 🗑️");
      await syncAllStorages({ title: `حذف محصول${prodName}`, showToast: true });
    }

    if (add) addProductToInvoice(store.getProduct(add));
    if (addV)
      addProductToInvoice(store.getProduct(addV), e.target.dataset.variantId);
  });

  el.search?.addEventListener("input", () =>
    renderProducts(el.search.value.trim()),
  );
}

if (typeof window !== "undefined") {
  window.renderProducts = renderProducts;
  window.renderCategoryChips = renderCategoryChips;
}
