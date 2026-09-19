import { faNum, numberToWordsFa, toEnDigits } from "./store.js";

/**
 * استخراج داده‌های فرمت‌شده و تبدیل به حروف
 */
export function getPricePreviewData(rawVal) {
  const cleanStr = toEnDigits(String(rawVal ?? "")).replace(/\D/g, "");
  const num = Number(cleanStr);
  if (!cleanStr || isNaN(num) || num <= 0) {
    return { num: 0, formatted: "", words: "", active: false };
  }
  return {
    num,
    formatted: faNum(num) + " تومان",
    words: numberToWordsFa(num) + " تومان",
    active: true,
  };
}

/**
 * ساخت HTML باکس زیر فیلد با طراحی شکیل، دارک‌مود و انیمیشن Fade-In
 */
export function createPricePreviewHTML(rawVal) {
  const data = getPricePreviewData(rawVal);
  if (!data.active) return "";
  return `
    <div class="fade-in mt-1.5 p-2.5 bg-brand-50/90 dark:bg-slate-700/80 border border-brand-200 dark:border-slate-600 rounded-xl text-xs space-y-1 shadow-sm">
      <div class="flex items-center justify-between font-bold text-brand-800 dark:text-brand-300">
        <span class="text-[10px] text-slate-500 dark:text-slate-400 font-normal">جداکننده ارقام:</span>
        <span class="font-mono text-sm tracking-wide text-brand-700 dark:text-brand-400">${data.formatted}</span>
      </div>
      <div class="text-[11px] text-slate-700 dark:text-slate-200 pt-1 border-t border-brand-100 dark:border-slate-600/70 flex items-start gap-1">
        <span class="shrink-0 text-slate-400 text-[10px]">به حروف:</span>
        <span class="font-extrabold text-brand-900 dark:text-brand-200 leading-5">${data.words}</span>
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
