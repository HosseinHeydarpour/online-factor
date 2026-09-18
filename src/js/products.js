import { store, faNum, uid } from './store.js';
import { addItemToInvoice } from './invoice.js';

let editingId = null;
let tempImage = '';
let tempVariants = [];

const el = {
  grid: document.getElementById('products-grid'),
  empty: document.getElementById('products-empty'),
  modal: document.getElementById('product-modal'),
  title: document.getElementById('product-modal-title'),
  name: document.getElementById('p-name'),
  price: document.getElementById('p-price'),
  image: document.getElementById('p-image'),
  preview: document.getElementById('p-preview'),
  variants: document.getElementById('variants-list'),
  search: document.getElementById('product-search'),
};

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2200);
}

// ---------- رندر کارت محصولات ----------
export function renderProducts(filter = '') {
  const list = store.getProducts().filter((p) => p.name.includes(filter));

  el.empty.classList.toggle('hidden', list.length > 0);

  el.grid.innerHTML = list
    .map(
      (p) => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden fade-in">
      <div class="h-36 bg-slate-100 grid place-items-center">
        ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover" />` : `<span class="text-4xl">📦</span>`}
      </div>
      <div class="p-3 space-y-2">
        <h3 class="font-bold text-sm truncate">${p.name}</h3>
        <p class="text-xs text-slate-500">قیمت پایه: <b class="text-brand-700">${faNum(p.price)}</b> تومان</p>

        ${
          p.variants?.length
            ? `<div class="flex flex-wrap gap-1">
                ${p.variants
                  .map(
                    (v) => `<button data-add-variant="${p.id}" data-variant-id="${v.id}"
                      class="text-[10px] bg-brand-50 text-brand-700 border border-brand-100 px-2 py-1 rounded-full hover:bg-brand-100">
                      ${v.name} · ${faNum(v.price)}
                    </button>`
                  )
                  .join('')}
               </div>`
            : ''
        }

        <div class="flex gap-1.5 pt-1">
          <button data-add-product="${p.id}" class="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg font-bold">+ فاکتور</button>
          <button data-edit="${p.id}" class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-bold">✏️</button>
          <button data-delete="${p.id}" class="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold">🗑️</button>
        </div>
      </div>
    </div>`
    )
    .join('');
}

// ---------- مودال ----------
function renderVariantsForm() {
  el.variants.innerHTML = tempVariants.length
    ? tempVariants
        .map(
          (v, i) => `
      <div class="flex gap-2 items-center">
        <input data-vname="${i}" value="${v.name}" placeholder="عنوان واریانت (مثلاً ۶۴ گیگ)"
          class="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500" />
        <input data-vprice="${i}" type="number" min="0" value="${v.price}" placeholder="قیمت"
          class="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand-500" />
        <button data-vdel="${i}" class="text-rose-500 hover:bg-rose-50 w-7 h-7 rounded-lg">✕</button>
      </div>`
        )
        .join('')
    : `<p class="text-[11px] text-slate-400">واریانتی ثبت نشده است.</p>`;
}

function openModal(product = null) {
  editingId = product?.id ?? null;
  tempImage = product?.image ?? '';
  tempVariants = product ? product.variants.map((v) => ({ ...v })) : [];

  el.title.textContent = product ? 'ویرایش محصول' : 'محصول جدید';
  el.name.value = product?.name ?? '';
  el.price.value = product?.price ?? '';
  el.preview.src = tempImage;
  el.preview.classList.toggle('hidden', !tempImage);
  el.image.value = '';

  renderVariantsForm();
  el.modal.classList.remove('hidden');
}

function closeModal() {
  el.modal.classList.add('hidden');
}

export function initProductEvents() {
  document.getElementById('btn-add-product').addEventListener('click', () => openModal());
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-product').addEventListener('click', closeModal);
  el.modal.addEventListener('click', (e) => e.target === el.modal && closeModal());

  // آپلود عکس → base64
  el.image.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      tempImage = reader.result;
      el.preview.src = tempImage;
      el.preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  // واریانت‌ها
  document.getElementById('btn-add-variant').addEventListener('click', () => {
    tempVariants.push({ id: uid(), name: '', price: 0 });
    renderVariantsForm();
  });

  el.variants.addEventListener('input', (e) => {
    const ni = e.target.dataset.vname;
    const pi = e.target.dataset.vprice;
    if (ni !== undefined) tempVariants[ni].name = e.target.value;
    if (pi !== undefined) tempVariants[pi].price = Number(e.target.value) || 0;
  });

  el.variants.addEventListener('click', (e) => {
    const di = e.target.dataset.vdel;
    if (di !== undefined) {
      tempVariants.splice(di, 1);
      renderVariantsForm();
    }
  });

  // ذخیره محصول
  document.getElementById('btn-save-product').addEventListener('click', () => {
    const name = el.name.value.trim();
    const price = Number(el.price.value) || 0;
    if (!name || price <= 0) return alert('نام و قیمت محصول الزامی است.');

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
    toast(editingId ? 'محصول ویرایش شد ✅' : 'محصول اضافه شد ✅');
  });

  // کلیک‌های روی گرید محصولات
  el.grid.addEventListener('click', (e) => {
    const edit = e.target.dataset.edit;
    const del = e.target.dataset.delete;
    const add = e.target.dataset.addProduct;
    const addV = e.target.dataset.addVariant;

    if (edit) openModal(store.getProduct(edit));

    if (del && confirm('این محصول حذف شود؟')) {
      store.deleteProduct(del);
      renderProducts();
      toast('محصول حذف شد 🗑️');
    }

    if (add) {
      const p = store.getProduct(add);
      addItemToInvoice({ title: p.name, price: p.price });
      toast('به فاکتور اضافه شد 🧾');
    }

    if (addV) {
      const p = store.getProduct(addV);
      const v = p.variants.find((x) => x.id === e.target.dataset.variantId);
      addItemToInvoice({ title: p.name, price: v.price, meta: `واریانت: ${v.name}` });
      toast('به فاکتور اضافه شد 🧾');
    }
  });

  el.search.addEventListener('input', () => renderProducts(el.search.value.trim()));
}