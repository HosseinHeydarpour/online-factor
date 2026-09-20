import { faNum, numberToWordsFa, toEnDigits } from "./store.js";

/**
 * استخراج داده‌های فرمت‌شده و تبدیل به حروف
 */
export function getPricePreviewData(rawVal) {
  const cleanStr = toEnDigits(String(rawVal ?? "")).replace(/\D/g, "");
  const num = Number(cleanStr);
  if (!cleanStr || isNaN(num) || num <= 0) {
    return { num: 0, formatted: "", formattedNumber: "", words: "", active: false };
  }
  return {
    num,
    formattedNumber: faNum(num),
    formatted: faNum(num) + " تومان",
    words: numberToWordsFa(num) + " تومان",
    active: true,
  };
}

/**
 * ساخت HTML باکس جداکننده قیمت و تبدیل به حروف با طراحی شکیل، مدرن و وضوح کامل در دارک‌مود
 */
export function createPricePreviewHTML(rawVal) {
  const data = getPricePreviewData(rawVal);
  if (!data.active) return "";
  return `
    <div class="fade-in mt-2 p-2.5 sm:p-3 bg-gradient-to-br from-sky-50/90 via-sky-50/40 to-blue-50/70 dark:from-slate-800 dark:via-slate-800/95 dark:to-slate-900 border border-sky-200/90 dark:border-sky-500/30 rounded-xl text-xs space-y-2.5 shadow-sm transition-all duration-200">
      <!-- ردیف جداکننده ارقام -->
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-1.5 text-slate-600 dark:text-slate-200 font-medium text-[11px]">
          <span class="inline-block w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]"></span>
          <span class="font-bold">جداکننده ارقام:</span>
        </div>
        <div class="inline-flex items-center gap-1.5 bg-white/95 dark:bg-slate-950/90 px-3 py-1 rounded-lg border border-sky-200 dark:border-sky-500/40 shadow-xs">
          <span class="font-mono text-sm sm:text-base font-extrabold tracking-wider text-sky-700 dark:text-sky-300 select-all">${data.formattedNumber}</span>
          <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">تومان</span>
        </div>
      </div>
      <!-- ردیف تبدیل به حروف -->
      <div class="pt-2 border-t border-sky-100 dark:border-slate-700/80 flex items-start gap-2">
        <span class="shrink-0 text-[10px] font-extrabold bg-sky-100/90 dark:bg-sky-950/90 text-sky-700 dark:text-sky-300 border border-sky-200/90 dark:border-sky-800/80 px-2 py-0.5 rounded-md mt-0.5">
          به حروف:
        </span>
        <span class="font-bold text-slate-800 dark:text-emerald-300 text-xs sm:text-[13px] leading-relaxed select-all">
          ${data.words}
        </span>
      </div>
    </div>
  `;
}

/**
 * بایند کردن زنده پیش‌نمایش به هر اینپوت
 */
export function bindPricePreview(inputEl, containerEl = null) {
  if (!inputEl) return;
  let preview = containerEl;
  if (!preview) {
    const next = inputEl.nextElementSibling;
    if (next && next.classList.contains("price-preview-box")) {
      preview = next;
    } else {
      preview = document.createElement("div");
      preview.className = "price-preview-box";
      inputEl.parentNode.insertBefore(preview, inputEl.nextSibling);
    }
  }

  const update = () => {
    preview.innerHTML = createPricePreviewHTML(inputEl.value);
  };

  inputEl.addEventListener("input", update);
  inputEl.addEventListener("change", update);
  update();

  return { update };
}
