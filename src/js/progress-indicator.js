/**
 * ماژول مدیریت و نمایش نشانگر دایره‌ای درصد پیشرفت عملیات‌های پوش گیت‌هاب
 * پشتیبانی از چند عملیات همزمان، انیمیشن روان، و تفکیک نام عملیات
 */

let taskCounter = 0;
const activeTasks = new Map();

function toPersianDigits(n) {
  const f = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/[0-9]/g, (d) => f[Number(d)]);
}

/**
 * دریافت یا ایجاد کانتینر شناور نشانگر پیشرفت در پایین صفحه
 */
function getProgressContainer() {
  let container = document.getElementById("push-progress-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "push-progress-container";
    container.className =
      "fixed bottom-4 left-4 z-[9999] flex flex-col-reverse gap-2.5 max-w-xs sm:max-w-sm w-[calc(100vw-2rem)] sm:w-80 pointer-events-none transition-all";
    document.body.appendChild(container);
  }
  return container;
}

/**
 * رندر کارت یک تسک بر اساس وضعیت و درصد فعلی
 */
function renderTaskCard(task) {
  let card = document.getElementById(`push-task-${task.id}`);
  const container = getProgressContainer();

  if (!card) {
    card = document.createElement("div");
    card.id = `push-task-${task.id}`;
    card.className =
      "pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-700/90 shadow-2xl rounded-2xl p-3 flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0 text-right";
    container.appendChild(card);
    // انیمیشن ورود نرم
    requestAnimationFrame(() => {
      card.classList.remove("translate-y-2", "opacity-0");
      card.classList.add("translate-y-0", "opacity-100");
    });
  }

  const p = Math.min(100, Math.max(0, Math.round(task.percent)));
  const offset = 100 - p;

  let strokeColor = "text-brand-600 dark:text-brand-400";
  let centerContent = `<span class="font-mono text-[10px] font-black">${toPersianDigits(p)}٪</span>`;

  if (task.status === "success") {
    strokeColor = "text-emerald-500 dark:text-emerald-400";
    centerContent = `<span class="text-emerald-600 dark:text-emerald-400 text-xs font-black">✓</span>`;
  } else if (task.status === "error") {
    strokeColor = "text-rose-500 dark:text-rose-400";
    centerContent = `<span class="text-rose-600 dark:text-rose-400 text-xs font-black">✕</span>`;
  }

  card.innerHTML = `
    <!-- بخش رینگ دایره‌ای درصد پیشرفت -->
    <div class="relative w-11 h-11 shrink-0 grid place-items-center">
      <svg class="w-11 h-11 transform -rotate-90" viewBox="0 0 36 36">
        <!-- دایره پس‌زمینه -->
        <path
          class="text-slate-100 dark:text-slate-800"
          stroke-width="3.2"
          stroke="currentColor"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <!-- رینگ متحرک پیشرفت -->
        <path
          class="${strokeColor} transition-all duration-300 ease-out"
          stroke-width="3.2"
          stroke-dasharray="100, 100"
          stroke-dashoffset="${offset}"
          stroke-linecap="round"
          stroke="currentColor"
          fill="none"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        ${centerContent}
      </div>
    </div>

    <!-- متون وضعیت و عنوان عملیات -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-1 mb-0.5">
        <h4 class="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate" title="${task.title}">
          ${task.title}
        </h4>
        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
          task.status === "success"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300"
            : task.status === "error"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300"
              : "bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-brand-300 animate-pulse"
        }">
          ${task.status === "success" ? "تکمیل" : task.status === "error" ? "خطا" : "پوش"}
        </span>
      </div>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
        ${task.subtitle || "در حال همگام‌سازی با گیت‌هاب..."}
      </p>
    </div>
  `;
}

/**
 * حذف یک تسک از صفحه با انیمیشن خروج نرم
 */
function removeTaskCard(id) {
  const card = document.getElementById(`push-task-${id}`);
  if (card) {
    card.classList.remove("translate-y-0", "opacity-100");
    card.classList.add("-translate-y-2", "opacity-0");
    setTimeout(() => {
      card.remove();
      activeTasks.delete(id);
      const container = document.getElementById("push-progress-container");
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  } else {
    activeTasks.delete(id);
  }
}

/**
 * ثبت و آغاز یک وظیفه پوش جدید
 * @param {string} title - نام عملیات (مثلاً «ساخت محصول»، «ایجاد فاکتور»، «حذف دسته‌بندی»)
 * @param {string} initialSubtitle - پیام زیرین اولیه
 * @returns {object} شیء کنترل پیشرفت با متدهای update, complete, fail
 */
export function startPushTask(title = "همگام‌سازی گیت‌هاب", initialSubtitle = "در حال آماده‌سازی...") {
  taskCounter++;
  const id = `task-${Date.now()}-${taskCounter}`;

  const task = {
    id,
    title,
    subtitle: initialSubtitle,
    percent: 5,
    status: "running",
    startTime: Date.now(),
  };

  activeTasks.set(id, task);
  renderTaskCard(task);

  return {
    id,
    /**
     * به‌روزرسانی درصد و زیرعنوان عملیات
     */
    update(percent, subtitle) {
      const current = activeTasks.get(id);
      if (!current || current.status !== "running") return;
      current.percent = Math.min(99, Math.max(current.percent, percent));
      if (subtitle) current.subtitle = subtitle;
      renderTaskCard(current);
    },

    /**
     * پایان موفقیت‌آمیز عملیات
     */
    complete(msg = "با موفقیت همگام شد ✅") {
      const current = activeTasks.get(id);
      if (!current) return;
      current.status = "success";
      current.percent = 100;
      current.subtitle = msg;
      renderTaskCard(current);

      // پس از ۲.۵ ثانیه کارت را برمی‌دارد
      setTimeout(() => {
        removeTaskCard(id);
      }, 2500);
    },

    /**
     * شکست عملیات و نمایش خطا
     */
    fail(errorMsg = "خطا در همگام‌سازی") {
      const current = activeTasks.get(id);
      if (!current) return;
      current.status = "error";
      current.subtitle = errorMsg;
      renderTaskCard(current);

      // نمایش خطا تا ۴ ثانیه
      setTimeout(() => {
        removeTaskCard(id);
      }, 4000);
    },
  };
}

// دسترسی سراسری برای ماژول‌ها و تست
if (typeof window !== "undefined") {
  window.startPushTask = startPushTask;
}
