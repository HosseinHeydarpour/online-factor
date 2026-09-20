/**
 * NiceSelect - کامپوننت مدرن و بسیار سبک دراپ‌داون
 * با پشتیبانی کامل از RTL، دارک‌مود، جستجوی زنده و دسترسی‌پذیری
 */

export class NiceSelect {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      searchable: options.searchable ?? (element.options.length > 5),
      searchPlaceholder: options.searchPlaceholder ?? "جستجو در گزینه‌ها...",
      noResultsText: options.noResultsText ?? "موردی یافت نشد",
      ...options,
    };

    if (this.element._niceSelect) {
      this.element._niceSelect.destroy();
    }
    this.element._niceSelect = this;

    this.isOpen = false;
    this.init();
  }

  init() {
    this.createElements();
    this.bindEvents();
    this.syncFromSelect();
  }

  createElements() {
    // مخفی کردن سلکت اصلی
    this.element.style.display = "none";
    this.element.setAttribute("tabindex", "-1");
    this.element.setAttribute("aria-hidden", "true");

    // محفظه والد NiceSelect
    this.wrapper = document.createElement("div");
    this.wrapper.className = "nice-select-custom relative inline-block w-full text-right";
    if (this.element.className) {
      // استخراج کلاس‌های عرضی یا فلکس از المان اصلی
      if (this.element.classList.contains("w-full")) this.wrapper.classList.add("w-full");
    }

    // دکمه تریگر اصلی (نمایش گزینه انتخاب‌شده)
    this.trigger = document.createElement("button");
    this.trigger.type = "button";
    this.trigger.className =
      "nice-select-trigger flex items-center justify-between gap-2 w-full px-3 py-2 text-xs sm:text-sm font-medium " +
      "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 " +
      "border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm " +
      "hover:border-brand-400 dark:hover:border-brand-500 " +
      "focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition duration-150 select-none";

    this.currentText = document.createElement("span");
    this.currentText.className = "truncate flex items-center gap-1.5 min-w-0";

    // آیکون فلش (Chevron)
    this.chevron = document.createElement("span");
    this.chevron.className = "nice-select-arrow transition-transform duration-200 text-slate-400 flex-shrink-0 text-[10px]";
    this.chevron.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>`;

    this.trigger.appendChild(this.currentText);
    this.trigger.appendChild(this.chevron);

    // منوی دراپ‌داون
    this.dropdown = document.createElement("div");
    this.dropdown.className =
      "nice-select-dropdown hidden absolute right-0 left-0 top-full mt-1.5 z-[100] " +
      "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl " +
      "p-1.5 overflow-hidden text-xs sm:text-sm transition-all duration-150 scale-95 opacity-0";

    // باکس جستجو در صورت نیاز
    if (this.options.searchable) {
      this.searchContainer = document.createElement("div");
      this.searchContainer.className = "p-1.5 border-b border-slate-100 dark:border-slate-700/60 mb-1";

      this.searchInput = document.createElement("input");
      this.searchInput.type = "text";
      this.searchInput.placeholder = this.options.searchPlaceholder;
      this.searchInput.className =
        "w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 " +
        "border border-slate-200 dark:border-slate-700 rounded-lg " +
        "text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none " +
        "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition";

      this.searchContainer.appendChild(this.searchInput);
      this.dropdown.appendChild(this.searchContainer);
    }

    // لیست گزینه‌ها
    this.optionsList = document.createElement("div");
    this.optionsList.className = "nice-select-options max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar";
    this.dropdown.appendChild(this.optionsList);

    // پیام یافت نشدن نتیجه
    this.noResults = document.createElement("div");
    this.noResults.className = "hidden px-3 py-3 text-center text-xs text-slate-400";
    this.noResults.textContent = this.options.noResultsText;
    this.dropdown.appendChild(this.noResults);

    this.wrapper.appendChild(this.trigger);
    this.wrapper.appendChild(this.dropdown);

    this.element.parentNode.insertBefore(this.wrapper, this.element.nextSibling);
    this.renderOptions();
  }

  renderOptions() {
    this.optionsList.innerHTML = "";
    const options = Array.from(this.element.options);

    options.forEach((opt, idx) => {
      const item = document.createElement("div");
      item.className =
        "nice-select-option px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 " +
        "text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-slate-700/60 " +
        "hover:text-brand-600 dark:hover:text-brand-400 transition duration-100 select-none";

      if (opt.disabled) {
        item.classList.add("opacity-40", "cursor-not-allowed", "pointer-events-none");
      }

      if (opt.selected) {
        item.classList.add("bg-brand-50/80", "dark:bg-slate-700", "text-brand-600", "dark:text-brand-400", "font-bold");
      }

      const labelSpan = document.createElement("span");
      labelSpan.className = "truncate flex items-center gap-1.5";
      labelSpan.textContent = opt.text;

      item.appendChild(labelSpan);

      if (opt.selected) {
        const checkIcon = document.createElement("span");
        checkIcon.className = "text-brand-600 dark:text-brand-400 flex-shrink-0 text-xs";
        checkIcon.innerHTML = "✓";
        item.appendChild(checkIcon);
      }

      item.dataset.value = opt.value;
      item.dataset.index = idx;

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectOption(opt.value);
      });

      this.optionsList.appendChild(item);
    });
  }

  selectOption(val) {
    if (this.element.value !== val) {
      this.element.value = val;
      this.element.dispatchEvent(new Event("input", { bubbles: true }));
      this.element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    this.syncFromSelect();
    this.close();
  }

  syncFromSelect() {
    const selected = this.element.selectedOptions[0] || this.element.options[0];
    if (selected) {
      this.currentText.textContent = selected.text;
    } else {
      this.currentText.textContent = "انتخاب کنید...";
    }
    this.renderOptions();
  }

  bindEvents() {
    this.trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.filterOptions(e.target.value.trim());
      });
      this.searchInput.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    // بستن با کلیک خارج از کامپوننت
    this.onDocClick = (e) => {
      if (!this.wrapper.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener("click", this.onDocClick);

    // کیبورد
    this.wrapper.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
      }
    });

    // شنود تغییرات در خود سلکت اصلی در صورتی که با کد تغییر کرده باشد
    this.onSelectChange = () => {
      this.syncFromSelect();
    };
    this.element.addEventListener("change", this.onSelectChange);

    // شنود خودکار تغییرات در گزینه‌های سلکت با MutationObserver
    if (typeof MutationObserver !== "undefined") {
      this.observer = new MutationObserver(() => {
        this.update();
      });
      this.observer.observe(this.element, {
        childList: true,
        subtree: true,
      });
    }
  }

  filterOptions(query) {
    const items = Array.from(this.optionsList.querySelectorAll(".nice-select-option"));
    let visibleCount = 0;
    const q = query.toLowerCase();

    items.forEach((item) => {
      const txt = item.textContent.toLowerCase();
      const match = txt.includes(q);
      item.classList.toggle("hidden", !match);
      if (match) visibleCount++;
    });

    this.noResults.classList.toggle("hidden", visibleCount > 0);
  }

  open() {
    if (this.isOpen) return;

    // بستن تمام سلکت‌های دیگر
    document.querySelectorAll(".nice-select-dropdown").forEach((el) => {
      if (el !== this.dropdown) {
        el.classList.add("hidden", "scale-95", "opacity-0");
      }
    });

    this.dropdown.classList.remove("hidden");
    requestAnimationFrame(() => {
      this.dropdown.classList.remove("scale-95", "opacity-0");
      this.dropdown.classList.add("scale-100", "opacity-100");
    });

    this.chevron.classList.add("rotate-180");
    this.isOpen = true;

    if (this.searchInput) {
      this.searchInput.value = "";
      this.filterOptions("");
      setTimeout(() => this.searchInput.focus(), 50);
    }
  }

  close() {
    if (!this.isOpen) return;
    this.dropdown.classList.remove("scale-100", "opacity-100");
    this.dropdown.classList.add("scale-95", "opacity-0");
    this.chevron.classList.remove("rotate-180");
    setTimeout(() => {
      if (!this.isOpen) this.dropdown.classList.add("hidden");
    }, 150);
    this.isOpen = false;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  update() {
    const shouldBeSearchable = this.element.options.length > 5;
    if (shouldBeSearchable && !this.searchContainer) {
      this.searchContainer = document.createElement("div");
      this.searchContainer.className = "p-1.5 border-b border-slate-100 dark:border-slate-700/60 mb-1";

      this.searchInput = document.createElement("input");
      this.searchInput.type = "text";
      this.searchInput.placeholder = this.options.searchPlaceholder;
      this.searchInput.className =
        "w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 " +
        "border border-slate-200 dark:border-slate-700 rounded-lg " +
        "text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none " +
        "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition";

      this.searchInput.addEventListener("input", (e) => {
        this.filterOptions(e.target.value.trim());
      });
      this.searchInput.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      this.searchContainer.appendChild(this.searchInput);
      this.dropdown.insertBefore(this.searchContainer, this.optionsList);
    } else if (!shouldBeSearchable && this.searchContainer) {
      this.searchContainer.remove();
      this.searchContainer = null;
      this.searchInput = null;
    }

    this.syncFromSelect();
  }

  destroy() {
    this.observer?.disconnect();
    document.removeEventListener("click", this.onDocClick);
    this.element.removeEventListener("change", this.onSelectChange);
    this.wrapper?.remove();
    this.element.style.display = "";
    this.element.removeAttribute("tabindex");
    this.element.removeAttribute("aria-hidden");
    delete this.element._niceSelect;
  }
}

/**
 * فعال‌سازی نایس‌سلکت روی یک المان select
 */
export function initNiceSelect(selectElement, options = {}) {
  if (!selectElement || selectElement.tagName !== "SELECT") return null;
  return new NiceSelect(selectElement, options);
}

/**
 * ارتقای کلیه عناصر select درون کانتینر مشخص یا کل سند
 */
export function enhanceAllSelects(container = document) {
  if (!container) return;
  const selects = container.querySelectorAll("select:not(.no-nice-select)");
  selects.forEach((sel) => {
    // اگر قبلاً نایس‌سلکت داشت، به‌روزرسانی کن، در غیر این صورت مقداردهی اولیه کن
    if (sel._niceSelect) {
      sel._niceSelect.update();
    } else {
      initNiceSelect(sel);
    }
  });
}

// ثبت سراسری برای فراخوانی راحت در هر ماژول
if (typeof window !== "undefined") {
  window.NiceSelect = NiceSelect;
  window.initNiceSelect = initNiceSelect;
  window.enhanceAllSelects = enhanceAllSelects;
}
