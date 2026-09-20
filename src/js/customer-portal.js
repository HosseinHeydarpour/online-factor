import { store, faNum } from "./store.js";

let expandedCats = new Set();
let portalCategories = [];
let portalProducts = [];
let portalProductCategories = [];
let portalAnnouncements = [];
let selectedCustomerCatId = "all";

const STORAGE_KEY_READ_NEWS = "cp_read_announcements";

/* ============================================================
   مدیریت وضعیت اعلان‌های خوانده‌شده در پورتال مشتری
   ============================================================ */

/**
 * دریافت آرایه آیدی‌های خوانده‌شده از LocalStorage
 */
export function getReadAnnouncementIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_READ_NEWS) || "[]");
  } catch (e) {
    return [];
  }
}

/**
 * ثبت یک اعلان به عنوان خوانده‌شده
 */
export function markAnnouncementAsRead(announcementId) {
  if (!announcementId) return;
  const readIds = getReadAnnouncementIds();
  if (!readIds.includes(announcementId)) {
    readIds.push(announcementId);
    localStorage.setItem(STORAGE_KEY_READ_NEWS, JSON.stringify(readIds));
  }
  // به‌روزرسانی آنی شمارنده تب
  updateCustomerNewsBadge();
}

/**
 * پاک‌سازی آیدی‌های اعلانات حذف‌شده از LocalStorage
 */
export function pruneReadAnnouncementIds(announcements = []) {
  if (!announcements.length) return;
  const readIds = getReadAnnouncementIds();
  const validIds = new Set(announcements.map((a) => a.id));
  const cleanedIds = readIds.filter((id) => validIds.has(id));

  if (cleanedIds.length !== readIds.length) {
    localStorage.setItem(STORAGE_KEY_READ_NEWS, JSON.stringify(cleanedIds));
  }
}

/**
 * محاسبه تعداد اعلانات منتشرشده و خوانده‌نشده
 */
export function getUnreadNewsCount(announcements = []) {
  const readIds = getReadAnnouncementIds();
  const list = announcements.length ? announcements : portalAnnouncements;
  const published = list.filter((a) => a.status === "published");
  const unread = published.filter((a) => !readIds.includes(a.id));
  return unread.length;
}

/**
 * رندر و به‌روزرسانی بج قرمز در تب اخبار (data-cp-tab="news")
 */
export function updateCustomerNewsBadge(announcements) {
  const badge = document.getElementById("cp-news-tab-badge");
  if (!badge) return;

  const list =
    announcements ||
    (portalAnnouncements.length
      ? portalAnnouncements
      : store.getAnnouncements
        ? store.getAnnouncements()
        : []);
  const count = getUnreadNewsCount(list);

  if (count > 0) {
    badge.textContent = count > 99 ? "+۹۹" : count.toLocaleString("fa-IR");
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

/* ============================================================
   بارگذاری داینامیک دیتا (آفلاین محلی + فایل‌های آنلاین گیت‌هاب)
   ============================================================ */
async function loadPortalData() {
  portalCategories = store.getServices();
  portalProducts = store.getProducts();
  portalProductCategories = store.getProductCategories();
  portalAnnouncements = store.getAnnouncements();

  try {
    const [resServices, resProducts, resCats, resAnnouncements] =
      await Promise.allSettled([
        fetch("./data/services.json", { cache: "no-store" }),
        fetch("./data/products.json", { cache: "no-store" }),
        fetch("./data/product-categories.json", { cache: "no-store" }),
        fetch("./data/announcements.json", { cache: "no-store" }),
      ]);

    if (resServices.status === "fulfilled" && resServices.value.ok) {
      const data = await resServices.value.json();
      if (Array.isArray(data) && data.length) {
        const localServices = store.getServices() || [];
        if (!localServices.length) {
          portalCategories = data;
        } else {
          const servMap = new Map();
          data.forEach((s) => {
            if (s && s.id) servMap.set(s.id, s);
          });
          localServices.forEach((s) => {
            if (s && s.id) {
              const remote = servMap.get(s.id);
              servMap.set(s.id, remote ? { ...remote, ...s } : s);
            }
          });
          portalCategories = Array.from(servMap.values());
        }
      }
    }

    if (resProducts.status === "fulfilled" && resProducts.value.ok) {
      const remoteProds = await resProducts.value.json();
      if (Array.isArray(remoteProds)) {
        const localProds = store.getProducts() || [];
        const mergedMap = new Map();

        // ۱. ابتدا داده‌های واکشی‌شده از فایل استاتیک/گیت‌هاب اضافه می‌شوند
        remoteProds.forEach((p) => {
          if (p && p.id) mergedMap.set(p.id, p);
        });

        // ۲. سپس داده‌های محلی (محصولات جدید یا ویرایش‌شده در ادمین) تلفیق می‌شوند
        localProds.forEach((p) => {
          if (p && p.id) {
            const existing = mergedMap.get(p.id);
            mergedMap.set(p.id, existing ? { ...existing, ...p } : p);
          }
        });

        portalProducts = Array.from(mergedMap.values());

        // اگر لوکال استورج خالی بود، کش شود
        if (!localProds.length && portalProducts.length) {
          store.setProducts(portalProducts);
        }
      }
    }

    if (resCats.status === "fulfilled" && resCats.value.ok) {
      const remoteCats = await resCats.value.json();
      if (Array.isArray(remoteCats)) {
        const localCats = store.getProductCategories() || [];
        const catMap = new Map();

        remoteCats.forEach((c) => {
          if (c && c.id) catMap.set(c.id, c);
        });

        localCats.forEach((c) => {
          if (c && c.id) {
            const existing = catMap.get(c.id);
            catMap.set(c.id, existing ? { ...existing, ...c } : c);
          }
        });

        portalProductCategories = Array.from(catMap.values());

        if (!localCats.length && portalProductCategories.length) {
          store.setProductCategories(portalProductCategories);
        }
      }
    }

    if (resAnnouncements.status === "fulfilled" && resAnnouncements.value.ok) {
      const remoteAnn = await resAnnouncements.value.json();
      if (Array.isArray(remoteAnn)) {
        const localAnn = store.getAnnouncements() || [];
        const annMap = new Map();

        remoteAnn.forEach((a) => {
          if (a && a.id) annMap.set(a.id, a);
        });

        localAnn.forEach((a) => {
          if (a && a.id) {
            const existing = annMap.get(a.id);
            annMap.set(a.id, existing ? { ...existing, ...a } : a);
          }
        });

        portalAnnouncements = Array.from(annMap.values());
      }
    }
  } catch (_) {}
}

/* ============================================================
   رندر بخش اخبار و اعلانات در پورتال مشتری
   ============================================================ */
export function renderCustomerNews(searchQuery = "") {
  const container = document.getElementById("cp-news-list");
  const emptyEl = document.getElementById("cp-news-empty");
  if (!container) return;

  const q = searchQuery.trim().toLowerCase();
  let published = portalAnnouncements.filter((a) => a.status === "published");

  if (q) {
    published = published.filter(
      (a) =>
        (a.title || "").toLowerCase().includes(q) ||
        (a.summary || "").toLowerCase().includes(q),
    );
  }

  const readIds = getReadAnnouncementIds();

  if (published.length === 0) {
    container.innerHTML = "";
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");

  container.innerHTML = published
    .map((item) => {
      const isRead = readIds.includes(item.id);
      return `
      <div 
        data-news-id="${item.id}"
        class="cp-news-card cursor-pointer bg-white dark:bg-slate-800 p-4 rounded-2xl border ${
          isRead
            ? "border-slate-200 dark:border-slate-700"
            : "border-brand-300 dark:border-brand-500/50 shadow-sm ring-1 ring-brand-500/20"
        } hover:shadow-md transition space-y-2 relative"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            ${
              !isRead
                ? `<span class="unread-dot w-2 h-2 rounded-full bg-brand-500 shrink-0" title="خوانده نشده"></span>`
                : ""
            }
            <h4 class="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 truncate">
              ${item.pin ? "📌 " : ""}${item.title}
            </h4>
          </div>
          <span class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg shrink-0">
            ${item.category || "عمومی"}
          </span>
        </div>

        <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
          ${item.summary || "برای مشاهده جزئیات کلیک کنید..."}
        </p>

        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50 dark:border-slate-700/50">
          <span>📅 ${item.date || ""} ${item.time ? `ساعت ${item.time}` : ""}</span>
          <span class="text-brand-600 dark:text-brand-400 font-bold hover:underline">مشاهده کامل متن ←</span>
        </div>
      </div>
    `;
    })
    .join("");

  // اتصال رویداد کلیک جهت باز کردن مودال و خوانده‌شدن
  attachNewsCardEvents(published);
}

/**
 * اتصال ایونت باز کردن مودال و خوانده‌شدن خبر
 */
function attachNewsCardEvents(announcements) {
  const cards = document.querySelectorAll(".cp-news-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const newsId = card.getAttribute("data-news-id");
      const newsItem = announcements.find((n) => n.id === newsId);
      if (!newsItem) return;

      // ۱. باز کردن مودال نمایش متن خبر
      openCustomerNewsModal(newsItem);

      // ۲. ثبت به عنوان خوانده‌شده و به‌روزرسانی کارت و بج
      markAnnouncementAsRead(newsId);
      const dot = card.querySelector(".unread-dot");
      if (dot) dot.remove();
      card.classList.remove(
        "border-brand-300",
        "dark:border-brand-500/50",
        "shadow-sm",
        "ring-1",
        "ring-brand-500/20",
      );
      card.classList.add("border-slate-200", "dark:border-slate-700");
    });
  });
}

/**
 * تابع باز کردن مودال نمایش متن کامل خبر
 */
export function openCustomerNewsModal(newsItem) {
  const modal = document.getElementById("cp-news-modal");
  const titleEl = document.getElementById("cp-modal-news-title");
  const metaEl = document.getElementById("cp-modal-news-meta");
  const contentEl = document.getElementById("cp-modal-news-content");

  if (!modal) return;

  if (titleEl)
    titleEl.textContent = (newsItem.pin ? "📌 " : "") + newsItem.title;

  if (metaEl) {
    metaEl.innerHTML = `
      ${
        newsItem.pin
          ? `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
               📌 سنجاق‌شده
             </span>`
          : ""
      }
      <span class="text-[11px] font-bold bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-2.5 py-1 rounded-lg">
        ${newsItem.category || "عمومی"}
      </span>
      <span class="text-[11px] text-slate-400 font-mono">
        📅 ${newsItem.date || ""} ${newsItem.time ? `ساعت ${newsItem.time}` : ""}
      </span>
    `;
  }

  if (contentEl) {
    contentEl.innerHTML =
      newsItem.content && newsItem.content !== "<p><br></p>"
        ? newsItem.content
        : `<p>${newsItem.summary || "متنی برای این خبر درج نشده است."}</p>`;
  }

  modal.classList.remove("hidden");
}

function initNewsModalCloseHandlers() {
  const modal = document.getElementById("cp-news-modal");
  const btnClose = document.getElementById("btn-close-cp-news-modal");
  const btnDismiss = document.getElementById("btn-dismiss-cp-news-modal");

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnDismiss) btnDismiss.onclick = closeModal;

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }
}

/* ============================================================
   رندر چیپ‌ها و گرید محصولات در پورتال مشتری
   ============================================================ */

/**
 * بررسی موجود بودن محصول جهت نمایش به مشتری
 * اگر محصول هیچ واریانتی ندارد: باید موجودی پایه > 0 باشد
 * اگر محصول واریانت دارد: باید موجودی پایه > 0 باشد یا حداقل یکی از واریانت‌ها موجودی > 0 داشته باشد
 * اگر فیلد موجودی تعریف نشده باشد (محصولات قدیمی)، به صورت پیش‌فرض ۱ (موجود) در نظر گرفته می‌شود
 */
function isProductAvailableForCustomer(p) {
  if (!p) return false;

  const rawQty = p.quantity;
  const hasBaseQty =
    rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== "";
  const baseQty = hasBaseQty ? Math.max(0, parseInt(rawQty, 10) || 0) : 1;

  if (Array.isArray(p.variants) && p.variants.length > 0) {
    const hasVariantStock = p.variants.some((v) => {
      const vRaw = v.quantity;
      const vHasQty =
        vRaw !== undefined && vRaw !== null && String(vRaw).trim() !== "";
      const vQty = vHasQty ? Math.max(0, parseInt(vRaw, 10) || 0) : 1;
      return vQty > 0;
    });
    return baseQty > 0 || hasVariantStock;
  }
  return baseQty > 0;
}

/**
 * باز کردن مودال مشخصات و توضیحات کامل محصول در پورتال مشتری
 */
export function openCustomerProductModal(product) {
  const modal = document.getElementById("cp-product-modal");
  if (!modal || !product) return;

  const category = portalProductCategories.find(
    (c) => c.id === product.categoryId,
  );

  // دسته‌بندی
  const catEl = document.getElementById("cp-modal-prod-category");
  if (catEl) {
    catEl.textContent = category
      ? `${category.icon || "📦"} ${category.name}`
      : "📦 دسته‌بندی عمومی";
  }

  // بج فروش ویژه
  const specialBadge = document.getElementById("cp-modal-prod-special-badge");
  if (specialBadge) {
    specialBadge.classList.toggle("hidden", !product.isSpecialOffer);
  }

  // نام محصول
  const nameEl = document.getElementById("cp-modal-prod-name");
  if (nameEl) nameEl.textContent = product.name;

  // تصویر
  const imgEl = document.getElementById("cp-modal-prod-image");
  const placeholderEl = document.getElementById("cp-modal-prod-placeholder");
  if (product.image) {
    if (imgEl) {
      imgEl.src = product.image;
      imgEl.classList.remove("hidden");
    }
    if (placeholderEl) placeholderEl.classList.add("hidden");
  } else {
    if (imgEl) imgEl.classList.add("hidden");
    if (placeholderEl) placeholderEl.classList.remove("hidden");
  }

  // قیمت
  const priceEl = document.getElementById("cp-modal-prod-price");
  if (priceEl) priceEl.textContent = faNum(product.price);

  // وضعیت انبار
  const stockEl = document.getElementById("cp-modal-prod-stock");
  if (stockEl) {
    const qty = product.quantity ?? 0;
    if (qty > 0) {
      stockEl.innerHTML = `<span class="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 px-3 py-1 rounded-full">
        <span>✅</span>
        <span>موجود در انبار (${faNum(qty)} عدد)</span>
      </span>`;
    } else {
      stockEl.innerHTML = `<span class="inline-flex items-center gap-1 text-xs font-extrabold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 px-3 py-1 rounded-full">
        <span>❌</span>
        <span>در حال حاضر ناموجود</span>
      </span>`;
    }
  }

  // رنگ‌های کالا
  const colorsSection = document.getElementById("cp-modal-prod-colors-section");
  const colorsList = document.getElementById("cp-modal-prod-colors-list");
  if (colorsSection && colorsList) {
    if (Array.isArray(product.colors) && product.colors.length > 0) {
      colorsSection.classList.remove("hidden");
      colorsList.innerHTML = product.colors
        .map((c) => {
          const isLight =
            (c.hex || "").toLowerCase() === "#ffffff" ||
            (c.hex || "").toLowerCase() === "#fff";
          return `
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-full px-2.5 py-1 text-xs shadow-sm">
            <span class="w-3.5 h-3.5 rounded-full shrink-0 ${isLight ? "border border-slate-300 dark:border-slate-500" : ""}" style="background-color: ${c.hex}"></span>
            <span class="font-bold text-slate-700 dark:text-slate-200">${c.name}</span>
          </div>`;
        })
        .join("");
    } else {
      colorsSection.classList.add("hidden");
      colorsList.innerHTML = "";
    }
  }

  // واریانت‌ها
  const variantsSection = document.getElementById(
    "cp-modal-prod-variants-section",
  );
  const variantsList = document.getElementById("cp-modal-prod-variants-list");
  if (variantsSection && variantsList) {
    const activeVariants = (product.variants || []).filter((v) => {
      const vRaw = v.quantity;
      const vHasQty =
        vRaw !== undefined && vRaw !== null && String(vRaw).trim() !== "";
      const vQty = vHasQty ? Math.max(0, parseInt(vRaw, 10) || 0) : 1;
      return vQty > 0;
    });

    if (activeVariants.length > 0) {
      variantsSection.classList.remove("hidden");
      variantsList.innerHTML = activeVariants
        .map(
          (v) => `
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs">
            <span class="font-bold text-slate-800 dark:text-slate-200">${v.name}</span>
            <span class="text-brand-600 dark:text-brand-400 font-mono font-bold">${faNum(v.price)} ت</span>
            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">(${faNum(v.quantity)} عدد)</span>
          </div>`,
        )
        .join("");
    } else {
      variantsSection.classList.add("hidden");
      variantsList.innerHTML = "";
    }
  }

  // توضیحات ریچ‌تکست
  const descEl = document.getElementById("cp-modal-prod-description");
  if (descEl) {
    const rawDesc = (product.description || "").trim();
    if (rawDesc && rawDesc !== "<p><br></p>") {
      descEl.innerHTML = rawDesc;
    } else {
      descEl.innerHTML = `<p class="text-xs text-slate-400 italic">توضیحات تکمیلی برای این محصول ثبت نشده است.</p>`;
    }
  }

  initProductModalCloseHandlers();
  modal.classList.remove("hidden");
}

function initProductModalCloseHandlers() {
  const modal = document.getElementById("cp-product-modal");
  const btnClose = document.getElementById("btn-close-cp-product-modal");
  const btnDismiss = document.getElementById("btn-dismiss-cp-product-modal");

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  if (btnClose) btnClose.onclick = closeModal;
  if (btnDismiss) btnDismiss.onclick = closeModal;

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  const handleEsc = (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
      closeModal();
    }
  };
  window.removeEventListener("keydown", handleEsc);
  window.addEventListener("keydown", handleEsc);
}

function renderCustomerProductChips() {
  const container = document.getElementById("cp-product-chips");
  if (!container) return;

  const availableProducts = portalProducts.filter(
    isProductAvailableForCustomer,
  );
  const specialOfferCount = availableProducts.filter(
    (p) => Boolean(p.isSpecialOffer),
  ).length;

  const chips = [
    {
      id: "all",
      name: "همه کالاها",
      icon: "🌐",
      count: availableProducts.length,
    },
    {
      id: "special_offer",
      name: "فروش ویژه",
      icon: "🔥",
      count: specialOfferCount,
      isSpecial: true,
    },
    ...portalProductCategories.map((c) => ({
      ...c,
      count: availableProducts.filter((p) => p.categoryId === c.id).length,
    })),
  ];

  container.innerHTML = chips
    .map((c) => {
      const active = selectedCustomerCatId === c.id;
      let btnClass = "";
      if (c.isSpecial) {
        btnClass = active
          ? "bg-gradient-to-r from-rose-500 to-amber-500 text-white font-extrabold shadow-md ring-2 ring-rose-300 dark:ring-rose-900"
          : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-bold";
      } else {
        btnClass = active
          ? "bg-brand-600 text-white font-bold"
          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold";
      }

      return `
      <button data-cp-cat="${c.id}"
        class="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition shadow-sm ${btnClass}">
        <span>${c.icon || "📦"}</span>
        <span>${c.name}</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${
          active
            ? "bg-white/20 text-white"
            : c.isSpecial
              ? "bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 font-black"
              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
        }">${faNum(c.count)}</span>
      </button>`;
    })
    .join("");

  container.querySelectorAll("[data-cp-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCustomerCatId = btn.dataset.cpCat;
      renderCustomerProductChips();
      renderCustomerProducts(
        document.getElementById("cp-product-search")?.value || "",
      );
    });
  });
}

function renderCustomerProducts(q = "") {
  const listEl = document.getElementById("cp-products-list");
  const emptyEl = document.getElementById("cp-products-empty");
  if (!listEl) return;

  const query = q.trim().toLowerCase();
  let list = portalProducts.filter(isProductAvailableForCustomer);

  if (selectedCustomerCatId === "special_offer") {
    list = list.filter((p) => Boolean(p.isSpecialOffer));
  } else if (selectedCustomerCatId !== "all") {
    list = list.filter((p) => p.categoryId === selectedCustomerCatId);
  }

  if (query) {
    list = list.filter((p) => (p.name || "").toLowerCase().includes(query));
  }

  emptyEl?.classList.toggle("hidden", list.length > 0);

  if (!list.length) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = list
    .map((p) => {
      const category = portalProductCategories.find(
        (c) => c.id === p.categoryId,
      );
      const activeVariants = (p.variants || []).filter((v) => {
        const vRaw = v.quantity;
        const vHasQty =
          vRaw !== undefined && vRaw !== null && String(vRaw).trim() !== "";
        const vQty = vHasQty ? Math.max(0, parseInt(vRaw, 10) || 0) : 1;
        return vQty > 0;
      });

      return `
      <div data-cp-card="${p.id}" class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden fade-in flex flex-col hover:shadow-md transition cursor-pointer group">
        <div class="h-36 sm:h-40 bg-slate-100 dark:bg-slate-700/70 grid place-items-center relative overflow-hidden shrink-0">
          ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />` : `<span class="text-4xl group-hover:scale-110 transition duration-300">📦</span>`}
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
              ? `<span class="absolute top-2 left-2 text-[10px] font-black bg-gradient-to-r from-rose-500 to-amber-500 text-white px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse">
                   <span>🔥</span>
                   <span>فروش ویژه</span>
                 </span>`
              : ""
          }
        </div>
        <div class="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition" title="${p.name}">${p.name}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              قیمت: <b class="text-brand-700 dark:text-brand-400 text-sm font-mono">${faNum(p.price)}</b> تومان
            </p>
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
            activeVariants.length
              ? `<div class="pt-1.5 border-t border-slate-100 dark:border-slate-700">
                  <p class="text-[10px] font-bold text-slate-400 mb-1">مدل‌ها و واریانت‌ها:</p>
                  <div class="flex flex-wrap gap-1">
                    ${activeVariants
                      .slice(0, 3)
                      .map(
                        (v) => `
                      <span class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full font-bold">
                        ${v.name} · ${faNum(v.price)} ت
                      </span>`,
                      )
                      .join("")}
                    ${activeVariants.length > 3 ? `<span class="text-[10px] text-slate-400 font-bold self-center">+${faNum(activeVariants.length - 3)} دیگر</span>` : ""}
                  </div>
                 </div>`
              : ""
          }
          <button
            type="button"
            data-cp-detail-btn="${p.id}"
            class="w-full mt-2 text-xs bg-brand-50 dark:bg-slate-700 hover:bg-brand-100 dark:hover:bg-slate-600 text-brand-700 dark:text-brand-300 font-bold py-1.5 px-3 rounded-xl border border-brand-200 dark:border-slate-600 transition flex items-center justify-center gap-1.5"
          >
            <span>🔍</span>
            <span>مشاهده مشخصات و توضیحات</span>
          </button>
        </div>
      </div>`;
    })
    .join("");

  // اتصال ایونت کلیک روی کارت و دکمه برای باز شدن مودال محصول
  listEl.querySelectorAll("[data-cp-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const prodId = card.dataset.cpCard;
      const product = portalProducts.find((x) => x.id === prodId);
      if (product) openCustomerProductModal(product);
    });
  });
}

/* ============================================================
   راه‌اندازی کلی پورتال مشتری
   ============================================================ */
export function initCustomerPortal() {
  document.querySelector(".app-root")?.classList.add("hidden");
  document.getElementById("login-overlay")?.classList.add("hidden");

  const portal = document.getElementById("customer-portal");
  if (!portal) return;
  portal.classList.remove("hidden");

  const shop = store.getShopInfo();
  const nameEl = document.getElementById("cp-name");
  const sloganEl = document.getElementById("cp-slogan");
  const logoEl = document.getElementById("cp-logo");
  const contactEl = document.getElementById("cp-contact");

  if (nameEl) nameEl.textContent = shop.name || "کافی‌نت آنلاین";
  if (sloganEl) sloganEl.textContent = shop.slogan || "نرخ‌نامه و ویترین خدمات";
  if (logoEl && shop.logo) {
    logoEl.innerHTML = `<img src="${shop.logo}" class="w-full h-full object-contain" />`;
    logoEl.classList.remove("bg-brand-600", "text-white");
    logoEl.classList.add("bg-transparent");
  }
  if (contactEl) {
    const line = [shop.phone, shop.address].filter(Boolean).join("  |  ");
    contactEl.textContent = line;
    contactEl.classList.toggle("hidden", !line);
  }

  document.getElementById("cp-theme")?.addEventListener("click", () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      html.classList.contains("dark") ? "dark" : "light",
    );
  });

  const search = document.getElementById("cp-search");
  const list = document.getElementById("cp-list");
  const countEl = document.getElementById("cp-count");

  const renderServices = (q = "") => {
    const query = q.trim().toLowerCase();
    const cats = [];
    const sourceCategories = portalCategories.length
      ? portalCategories
      : store.getServices();

    for (const c of sourceCategories) {
      const catMatch = c.title.toLowerCase().includes(query);
      const items = query
        ? catMatch
          ? c.items
          : c.items.filter((i) => i.title.toLowerCase().includes(query))
        : c.items;
      if (!query || catMatch || items.length) cats.push({ ...c, items });
    }

    const totalServices = cats.reduce((s, c) => s + c.items.length, 0);
    if (countEl)
      countEl.textContent = query
        ? `${faNum(totalServices)} خدمت یافت شد`
        : `${faNum(totalServices)} خدمت در ${faNum(cats.length)} دسته‌بندی`;

    if (!cats.length) {
      list.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 text-sm">موردی یافت نشد.</div>`;
      return;
    }

    const isExpanded = (id) => (query ? true : expandedCats.has(id));

    list.innerHTML = cats
      .map(
        (c) => `
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden fade-in">
        <button data-cat="${c.id}"
          class="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
          <span class="flex items-center gap-2 min-w-0">
            <span class="text-sm">${isExpanded(c.id) ? "🔽" : "▶️"}</span>
            <span class="font-extrabold text-sm text-slate-700 dark:text-slate-100 truncate">${c.title}</span>
          </span>
          <span class="text-[10px] text-slate-400 shrink-0">${faNum(c.items.length)} خدمت</span>
        </button>
        <div class="${isExpanded(c.id) ? "" : "hidden"} divide-y divide-slate-100 dark:divide-slate-700">
          ${c.items
            .map(
              (i) => `
            <div class="flex items-center justify-between gap-3 px-4 py-2.5">
              <span class="text-sm text-slate-700 dark:text-slate-200 leading-6">${i.title}</span>
              <span class="text-sm font-extrabold text-brand-700 dark:text-brand-400 whitespace-nowrap">${faNum(i.price)} تومان</span>
            </div>`,
            )
            .join("")}
        </div>
      </div>`,
      )
      .join("");

    list.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cat;
        if (expandedCats.has(id)) expandedCats.delete(id);
        else expandedCats.add(id);
        renderServices(search?.value || "");
      });
    });
  };

  document.getElementById("cp-expand-all")?.addEventListener("click", () => {
    portalCategories.forEach((c) => expandedCats.add(c.id));
    renderServices(search?.value || "");
  });

  document.getElementById("cp-collapse-all")?.addEventListener("click", () => {
    expandedCats.clear();
    renderServices(search?.value || "");
  });

  search?.addEventListener("input", () => renderServices(search.value));

  const prodSearch = document.getElementById("cp-product-search");
  prodSearch?.addEventListener("input", () =>
    renderCustomerProducts(prodSearch.value),
  );

  const newsSearch = document.getElementById("cp-news-search");
  newsSearch?.addEventListener("input", () =>
    renderCustomerNews(newsSearch.value),
  );

  // هندلرهای بستن مودال خبر
  initNewsModalCloseHandlers();

  // بارگذاری داده‌ها و رندر اولیه
  loadPortalData().then(() => {
    renderServices();
    renderCustomerProductChips();
    renderCustomerProducts();
    // پاک‌سازی اعلان‌های قدیمی حذف‌شده از استوریج
    pruneReadAnnouncementIds(portalAnnouncements);
    renderCustomerNews();
    updateCustomerNewsBadge();
  });

  function syncWithLocalProducts() {
    const localProds = store.getProducts() || [];
    const localCats = store.getProductCategories() || [];

    if (localProds.length) {
      const prodMap = new Map();
      portalProducts.forEach((p) => {
        if (p && p.id) prodMap.set(p.id, p);
      });
      localProds.forEach((p) => {
        if (p && p.id) {
          const existing = prodMap.get(p.id);
          prodMap.set(p.id, existing ? { ...existing, ...p } : p);
        }
      });
      portalProducts = Array.from(prodMap.values());
    }

    if (localCats.length) {
      const catMap = new Map();
      portalProductCategories.forEach((c) => {
        if (c && c.id) catMap.set(c.id, c);
      });
      localCats.forEach((c) => {
        if (c && c.id) {
          const existing = catMap.get(c.id);
          catMap.set(c.id, existing ? { ...existing, ...c } : c);
        }
      });
      portalProductCategories = Array.from(catMap.values());
    }
  }

  // شنود تغییرات زنده استوریج در صورت ویرایش اخبار یا کالاها
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY_READ_NEWS) {
      updateCustomerNewsBadge();
      renderCustomerNews(
        document.getElementById("cp-news-search")?.value || "",
      );
    }
    if (e.key === "cafe_products" || e.key === "cafe_product_categories") {
      syncWithLocalProducts();
      renderCustomerProductChips();
      renderCustomerProducts(
        document.getElementById("cp-product-search")?.value || "",
      );
    }
    if (e.key === "cafe_announcements") {
      portalAnnouncements = store.getAnnouncements();
      renderCustomerNews(
        document.getElementById("cp-news-search")?.value || "",
      );
      updateCustomerNewsBadge();
    }
  });

  initPortalTabs();
  initBankCards();
}

/* ============================================================
   کارت‌های بانکی
   ============================================================ */
const BANK_THEMES = {
  ملت: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 45%,#f97316 100%)",
  رسالت: "linear-gradient(135deg,#064e3b 0%,#059669 55%,#10b981 100%)",
  ملی: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#38bdf8 100%)",
  صادرات: "linear-gradient(135deg,#0c4a6e 0%,#0369a1 55%,#0ea5e9 100%)",
  سپه: "linear-gradient(135deg,#1e293b 0%,#334155 55%,#94a3b8 100%)",
  پاسارگاد: "linear-gradient(135deg,#713f12 0%,#ca8a04 55%,#facc15 100%)",
  سامان: "linear-gradient(135deg,#134e4a 0%,#0d9488 55%,#2dd4bf 100%)",
  تجارت: "linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#818cf8 100%)",
  شهر: "linear-gradient(135deg,#3b0764 0%,#7e22ce 55%,#c084fc 100%)",
  کشاورزی: "linear-gradient(135deg,#14532d 0%,#16a34a 55%,#4ade80 100%)",
  پارسیان: "linear-gradient(135deg,#450a0a 0%,#b91c1c 55%,#ef4444 100%)",
  مسکن: "linear-gradient(135deg,#1c1917 0%,#57534e 55%,#a8a29e 100%)",
  رفاه: "linear-gradient(135deg,#1e1b4b 0%,#4338ca 55%,#6366f1 100%)",
  دی: "linear-gradient(135deg,#0f172a 0%,#1d4ed8 55%,#60a5fa 100%)",
  آینده: "linear-gradient(135deg,#082f49 0%,#0284c7 55%,#7dd3fc 100%)",
  اقتصاد: "linear-gradient(135deg,#422006 0%,#a16207 55%,#eab308 100%)",
  مهر: "linear-gradient(135deg,#831843 0%,#db2777 55%,#f472b6 100%)",
};

const DEFAULT_BANK_ACCOUNTS = [
  {
    bank: "ملت",
    holder: "محمدرضا حیدرپور",
    card: "6104337530294733",
    sheba: "IR330120020000004057947818",
  },
  {
    bank: "رسالت",
    holder: "محمدرضا حیدرپور",
    card: "5041721059413485",
    sheba: "IR680700001000116313889001",
  },
];
const FALLBACK_THEMES = [
  "linear-gradient(135deg,#0f172a 0%,#334155 55%,#64748b 100%)",
  "linear-gradient(135deg,#134e4a 0%,#0f766e 55%,#14b8a6 100%)",
  "linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#6366f1 100%)",
  "linear-gradient(135deg,#7c2d12 0%,#c2410c 55%,#fb923c 100%)",
];

let shopName = "کافی‌نت آنلاین";
let cardSlider = null;

function themeFor(bank, i) {
  const key = Object.keys(BANK_THEMES).find((k) => (bank || "").includes(k));
  return key ? BANK_THEMES[key] : FALLBACK_THEMES[i % FALLBACK_THEMES.length];
}

function fmtCard(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d ? d.replace(/(.{4})/g, "$1 ").trim() : "—";
}

function fmtSheba(v) {
  const s = String(v || "")
    .replace(/\s/g, "")
    .toUpperCase();
  return s ? s.replace(/(.{4})/g, "$1 ").trim() : "—";
}

async function copyText(value) {
  const text = String(value || "")
    .replace(/\s/g, "")
    .trim();
  if (!text || text === "—") return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let toastTimer = null;
function cpToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className =
    "fixed bottom-24 lg:bottom-5 right-4 lg:right-5 z-[80] bg-slate-800 text-white text-sm px-5 py-3 rounded-xl shadow-lg fade-in";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
}

function cardTemplate(b, i) {
  const bank = (b.bank || "").trim() || "بانک";
  const holder = (b.holder || "").trim() || "—";
  const card = (b.card || "").trim();
  const sheba = (b.sheba || "").trim();
  const bg = themeFor(bank, i);
  const off = (v) => (v ? "" : "pointer-events-none opacity-40");

  return `
  <div class="shrink-0 w-full px-1" dir="rtl">
    <div class="cp-bank-card text-white flex flex-col justify-between" style="background:${bg};">
      <div class="absolute -top-12 -left-10 w-44 h-44 rounded-full bg-white/15 blur-2xl pointer-events-none"></div>
      <div class="absolute -bottom-20 -right-10 w-56 h-56 rounded-full bg-black/25 blur-3xl pointer-events-none"></div>
      <div class="absolute inset-0 opacity-[.08] pointer-events-none" style="background-image:repeating-linear-gradient(115deg,#fff 0 1px,transparent 1px 14px);"></div>

      <div class="relative h-full flex flex-col justify-between p-4 sm:p-6 gap-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[10px] sm:text-xs opacity-75 font-bold">بانک</p>
            <p class="text-base sm:text-2xl font-black truncate">${bank}</p>
          </div>
          <div class="shrink-0 flex items-center gap-1.5">
            <span class="text-[9px] sm:text-[10px] font-black opacity-80 tracking-widest">شتاب</span>
            <span class="relative w-9 h-6 sm:w-11 sm:h-8 rounded-md overflow-hidden shadow-inner bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500">
              <span class="absolute inset-y-0 left-1/3 w-px bg-amber-700/40"></span>
              <span class="absolute inset-y-0 left-2/3 w-px bg-amber-700/40"></span>
              <span class="absolute inset-x-0 top-1/2 h-px bg-amber-700/40"></span>
            </span>
          </div>
        </div>

        <button type="button" data-copy="${card}" data-label="شماره کارت"
          class="cp-copy-btn w-full text-right px-2 py-1 rounded-xl hover:bg-white/10 active:bg-white/20 transition ${off(card)}">
          <p class="text-[10px] sm:text-xs opacity-75 font-bold mb-0.5">شماره کارت 📋</p>
          <p class="font-mono text-[17px] sm:text-2xl md:text-3xl font-extrabold tracking-[0.06em] sm:tracking-[0.1em] text-center sm:text-right" dir="ltr">${fmtCard(card)}</p>
        </button>

        <button type="button" data-copy="${sheba}" data-label="شماره شبا"
          class="cp-copy-btn w-full text-right px-2 py-0.5 rounded-xl hover:bg-white/10 active:bg-white/20 transition ${off(sheba)}">
          <p class="text-[10px] sm:text-xs opacity-75 font-bold mb-0.5">شماره شبا 📋</p>
          <p class="font-mono text-[11px] sm:text-sm md:text-base font-bold tracking-[0.03em] sm:tracking-[0.06em] truncate" dir="ltr">${fmtSheba(sheba)}</p>
        </button>

        <div class="flex items-end justify-between gap-2 px-2 border-t border-white/20 pt-2">
          <div class="min-w-0">
            <p class="text-[10px] sm:text-xs opacity-75 font-bold">به نام</p>
            <p class="text-xs sm:text-base font-extrabold truncate">${holder}</p>
          </div>
          <span class="shrink-0 text-[9px] sm:text-xs font-bold opacity-75 truncate max-w-[50%]">${shopName}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function initBankCards() {
  const viewport = document.getElementById("cp-cards-viewport");
  const track = document.getElementById("cp-cards-track");
  const dots = document.getElementById("cp-cards-dots");
  const empty = document.getElementById("cp-cards-empty");
  const btnPrev = document.getElementById("cp-card-prev");
  const btnNext = document.getElementById("cp-card-next");
  if (!viewport || !track || !dots) return;

  shopName = store.getShopInfo()?.name || "کافی‌نت آنلاین";

  const savedAccounts = store.getShopInfo()?.bankAccounts || [];
  const accounts = (
    savedAccounts.length ? savedAccounts : DEFAULT_BANK_ACCOUNTS
  ).filter((b) => (b?.card || "").trim() || (b?.sheba || "").trim());
  const total = accounts.length;

  if (!total) {
    track.innerHTML = "";
    dots.innerHTML = "";
    empty?.classList.remove("hidden");
    btnPrev?.classList.add("hidden");
    btnNext?.classList.add("hidden");
    return;
  }
  empty?.classList.add("hidden");

  track.innerHTML = accounts.map((b, i) => cardTemplate(b, i)).join("");
  dots.innerHTML = accounts
    .map(
      (_, i) =>
        `<button type="button" data-dot="${i}" aria-label="کارت ${i + 1}"
           class="cp-dot h-2 rounded-full ${i === 0 ? "w-6 bg-brand-600" : "w-2 bg-slate-300 dark:bg-slate-600"}"></button>`,
    )
    .join("");

  if (total < 2) {
    btnPrev?.classList.add("hidden");
    btnNext?.classList.add("hidden");
  } else {
    btnPrev?.classList.remove("hidden");
    btnNext?.classList.remove("hidden");
  }

  let index = 0;
  let deltaX = 0;
  let dragging = false;
  let locked = null;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;

  const paint = (offsetPx = 0, animate = true) => {
    track.style.transition = animate
      ? "transform .32s cubic-bezier(.22,.61,.36,1)"
      : "none";
    track.style.transform = `translateX(calc(${-index * 100}% + ${offsetPx}px))`;
  };

  const syncDots = () => {
    dots.querySelectorAll("[data-dot]").forEach((d) => {
      const on = Number(d.dataset.dot) === index;
      d.className = `cp-dot h-2 rounded-full ${on ? "w-6 bg-brand-600" : "w-2 bg-slate-300 dark:bg-slate-600"}`;
    });
  };

  const goTo = (i, animate = true) => {
    index = ((i % total) + total) % total;
    deltaX = 0;
    paint(0, animate);
    syncDots();
  };

  viewport.addEventListener("pointerdown", (e) => {
    if (total < 2) return;
    dragging = true;
    locked = null;
    startX = e.clientX;
    startY = e.clientY;
    deltaX = 0;
    paint(0, false);
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (locked === "x") {
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }
    if (locked !== "x") return;
    e.preventDefault?.();
    suppressClick = Math.abs(dx) > 8;
    const w = viewport.clientWidth || 1;
    const edge = (index === 0 && dx > 0) || (index === total - 1 && dx < 0);
    deltaX = edge ? dx * 0.35 : dx * 0.95;
    paint(deltaX, false);
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    const w = viewport.clientWidth || 1;
    const threshold = Math.max(45, w * 0.18);
    if (deltaX <= -threshold) goTo(index + 1);
    else if (deltaX >= threshold) goTo(index - 1);
    else goTo(index);
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("pointerleave", endDrag);

  viewport.addEventListener(
    "click",
    async (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
        return;
      }
      const btn = e.target.closest("[data-copy]");
      if (!btn) return;
      const ok = await copyText(btn.dataset.copy);
      cpToast(
        ok ? `✅ ${btn.dataset.label} کپی شد` : "❌ کپی نشد — دستی انتخاب کنید",
      );
    },
    true,
  );

  btnNext?.addEventListener("click", () => goTo(index + 1));
  btnPrev?.addEventListener("click", () => goTo(index - 1));

  dots.addEventListener("click", (e) => {
    const d = e.target.closest("[data-dot]");
    if (d) goTo(Number(d.dataset.dot));
  });

  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goTo(index + 1);
    if (e.key === "ArrowLeft") goTo(index - 1);
  });
  window.addEventListener("resize", () => paint(0, false));

  paint(0, false);
  syncDots();
  cardSlider = {
    goTo,
    get index() {
      return index;
    },
    total,
  };
}

/* ============================================================
   ناوبری بین تب‌های چهارگانه پورتال مشتری
   ============================================================ */
function initPortalTabs() {
  const tabs = document.querySelectorAll("[data-cp-tab]");
  if (!tabs.length) return;

  const panels = {
    rates: document.getElementById("cp-panel-rates"),
    products: document.getElementById("cp-panel-products"),
    news: document.getElementById("cp-panel-news"),
    cards: document.getElementById("cp-panel-cards"),
  };

  const setActive = (btn) => {
    const on = (b) => b === btn;
    tabs.forEach((b) => {
      b.classList.toggle("bg-brand-600", on(b));
      b.classList.toggle("text-white", on(b));
      b.classList.toggle("text-slate-600", !on(b));
      b.classList.toggle("dark:text-slate-300", !on(b));
    });
    const key = btn.dataset.cpTab;
    Object.entries(panels).forEach(([k, el]) =>
      el?.classList.toggle("hidden", k !== key),
    );
    if (key === "products") {
      const localProds = store.getProducts() || [];
      if (localProds.length) {
        const prodMap = new Map();
        portalProducts.forEach((p) => {
          if (p && p.id) prodMap.set(p.id, p);
        });
        localProds.forEach((p) => {
          if (p && p.id) {
            const existing = prodMap.get(p.id);
            prodMap.set(p.id, existing ? { ...existing, ...p } : p);
          }
        });
        portalProducts = Array.from(prodMap.values());
      }
      renderCustomerProductChips();
      renderCustomerProducts(
        document.getElementById("cp-product-search")?.value || "",
      );
    }
    if (key === "cards" && cardSlider) {
      requestAnimationFrame(() => cardSlider.goTo(cardSlider.index, false));
    }
  };

  tabs.forEach((btn) => btn.addEventListener("click", () => setActive(btn)));
}
