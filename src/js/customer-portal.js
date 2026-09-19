import { RATE_CATEGORIES } from "../data/rates.js";
import { store, faNum } from "./store.js";

let expandedCats = new Set();

export function initCustomerPortal() {
  // مخفی‌کردن کامل رابط مدیریت
  document.querySelector(".app-root")?.classList.add("hidden");
  document.getElementById("login-overlay")?.classList.add("hidden");

  const portal = document.getElementById("customer-portal");
  if (!portal) return;
  portal.classList.remove("hidden");

  // ----- اطلاعات کسب‌وکار در هدر -----
  const shop = store.getShopInfo();
  const nameEl = document.getElementById("cp-name");
  const sloganEl = document.getElementById("cp-slogan");
  const logoEl = document.getElementById("cp-logo");
  const contactEl = document.getElementById("cp-contact");

  if (nameEl) nameEl.textContent = shop.name || "کافی‌نت آنلاین";
  if (sloganEl) sloganEl.textContent = shop.slogan || "نرخ‌نامه خدمات";
  if (logoEl && shop.logo)
    logoEl.innerHTML = `<img src="${shop.logo}" class="w-full h-full object-contain" />`;
  if (contactEl) {
    const line = [shop.phone, shop.address].filter(Boolean).join("  |  ");
    contactEl.textContent = line;
    contactEl.classList.toggle("hidden", !line);
  }

  // ----- دکمه حالت تاریک -----
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

  /* ---------- رندر آکاردئونی ---------- */
  const render = (q = "") => {
    const query = q.trim().toLowerCase();
    const cats = [];
    for (const c of RATE_CATEGORIES) {
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
        : `${faNum(totalServices)} خدمت در ${faNum(cats.length)} دسته‌بندی — برای مشاهده قیمت‌ها، دسته را باز کنید`;

    if (!cats.length) {
      list.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400 text-sm">موردی یافت نشد.</div>`;
      return;
    }

    // هنگام جستجو همه دسته‌های نتیجه باز شوند، وگرنه فقط انتخاب‌شده‌ها
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
        render(search?.value || "");
      });
    });
  };

  // ----- باز/بستن همه -----
  document.getElementById("cp-expand-all")?.addEventListener("click", () => {
    RATE_CATEGORIES.forEach((c) => expandedCats.add(c.id));
    render(search?.value || "");
  });
  document.getElementById("cp-collapse-all")?.addEventListener("click", () => {
    expandedCats.clear();
    render(search?.value || "");
  });

  search?.addEventListener("input", () => render(search.value));
  render();
}
