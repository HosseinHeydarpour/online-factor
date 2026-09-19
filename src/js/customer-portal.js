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

  initPortalTabs();
  initBankCards();
}

/* ============================================================
   🏦 کارت‌های بانکی — دیزاین کارت واقعی + اسلایدر لمسی
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

/* 💳 کارت‌های بانکی هاردکدشده — fallback وقتی localStorage خالی است */
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
  "linear-gradient(135deg,#312e81 0%,#4338ca 55%,#6366f1 100%)",
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
        <!-- ردیف ۱: بانک + چیپ -->
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

        <!-- ردیف ۲: شماره کارت (کلیک = کپی) -->
        <button type="button" data-copy="${card}" data-label="شماره کارت"
          class="cp-copy-btn w-full text-right px-2 py-1 rounded-xl hover:bg-white/10 active:bg-white/20 transition ${off(card)}">
          <p class="text-[10px] sm:text-xs opacity-75 font-bold mb-0.5">شماره کارت 📋</p>
          <p class="font-mono text-[17px] sm:text-2xl md:text-3xl font-extrabold tracking-[0.06em] sm:tracking-[0.1em] text-center sm:text-right" dir="ltr">${fmtCard(card)}</p>
        </button>

        <!-- ردیف ۳: شماره شبا (کلیک = کپی) -->
        <button type="button" data-copy="${sheba}" data-label="شماره شبا"
          class="cp-copy-btn w-full text-right px-2 py-0.5 rounded-xl hover:bg-white/10 active:bg-white/20 transition ${off(sheba)}">
          <p class="text-[10px] sm:text-xs opacity-75 font-bold mb-0.5">شماره شبا 📋</p>
          <p class="font-mono text-[11px] sm:text-sm md:text-base font-bold tracking-[0.03em] sm:tracking-[0.06em] truncate" dir="ltr">${fmtSheba(sheba)}</p>
        </button>

        <!-- ردیف ۴: دارنده کارت -->
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
    // ❌ capture اینجا نباید باشد — کلیک دکمه کپی را می‌دزدد
    paint(0, false);
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (locked === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      // ✅ capture فقط وقتی درگ افقی واقعاً شروع شد
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
   🔀 تب‌های پورتال
   ============================================================ */
function initPortalTabs() {
  const tabs = document.querySelectorAll("[data-cp-tab]");
  if (!tabs.length) return;

  const panels = {
    rates: document.getElementById("cp-panel-rates"),
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
    if (key === "cards" && cardSlider) {
      requestAnimationFrame(() => cardSlider.goTo(cardSlider.index, false));
    }
  };

  tabs.forEach((btn) => btn.addEventListener("click", () => setActive(btn)));
}
