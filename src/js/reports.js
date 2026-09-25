import { store, faNum, toJalali, fromJalali } from "./store.js";

let chartInstance = null;

export function initReports() {
  const today = toJalali();
  const currentYear = today.year;
  const currentMonth = String(today.month).padStart(2, "0");

  // تنظیم تاریخ پیش‌فرض
  document.getElementById("report-start-date").value =
    `${currentYear}/${currentMonth}/01`;
  document.getElementById("report-end-date").value =
    `${currentYear}/${currentMonth}/${String(today.day).padStart(2, "0")}`;

  // فعال‌سازی تقویم فارسی فقط در صورت وجود کتابخانه
  if (window.$ && $.fn && $.fn.persianDatepicker) {
    $("#report-start-date, #report-end-date").persianDatepicker({
      format: "YYYY/MM/DD",
      initialValue: false,
      autoClose: true,
      calendar: {
        locale: "fa",
      },
    });
  }

  // ✅ استفاده از onclick برای جلوگیری از اتصال چندباره ایونت‌ها
  document.getElementById("btn-apply-report").onclick = applyReport;
  document.getElementById("btn-today-report").onclick = () =>
    setReportPeriod("today");
  document.getElementById("btn-month-report").onclick = () =>
    setReportPeriod("month");
  document.getElementById("btn-year-report").onclick = () =>
    setReportPeriod("year");

  // بارگذاری اولیه گزارش امروز
  applyReport();
}

function setReportPeriod(period) {
  const today = toJalali();
  let start, end;

  if (period === "today") {
    start = end = today.full;
  } else if (period === "month") {
    start = `${today.year}/${String(today.month).padStart(2, "0")}/01`;
    end = today.full;
  } else if (period === "year") {
    start = `${today.year}/01/01`;
    end = today.full;
  }

  document.getElementById("report-start-date").value = start;
  document.getElementById("report-end-date").value = end;

  applyReport();
}

function applyReport() {
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;

  const data = store.getReportData(startDate, endDate);

  // نمایش خلاصه گزارش
  document.getElementById("report-total-revenue").textContent =
    faNum(data.totalRevenue) + " تومان";
  document.getElementById("report-total-invoices").textContent =
    faNum(data.totalInvoices) + " فاکتور";

  // نمایش خدمات پرفروش
  renderTopServices(data.topServices);

  // رسم چارت درآمد روزانه
  renderDailyChart(data.dailyIncome);

  // رسم چارت درآمد ماهانه
  renderMonthlyChart(data.monthlyIncome);
}

function renderTopServices(services) {
  const container = document.getElementById("top-services-list");

  if (!services.length) {
    container.innerHTML =
      '<p class="text-center text-slate-400 text-sm py-4">داده‌ای موجود نیست</p>';
    return;
  }

  container.innerHTML = services
    .map(
      (s, i) => `
    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <span class="w-6 h-6 shrink-0 rounded-full bg-brand-100 text-brand-700 text-xs font-bold grid place-items-center">${faNum(i + 1)}</span>
        <span class="text-sm font-bold truncate sm:whitespace-normal sm:overflow-visible" title="${s.name}">${s.name}</span>
      </div>
      <div class="text-left shrink-0 mr-3">
        <p class="text-xs font-extrabold text-brand-700">${faNum(s.revenue)} تومان</p>
        <p class="text-[10px] text-slate-400">${faNum(s.count)} فروش</p>
      </div>
    </div>
  `,
    )
    .join("");
}

function renderDailyChart(dailyData) {
  const container = document.getElementById("daily-chart-container");
  const canvasId = "daily-chart";

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (container) {
    container.innerHTML = `<canvas id="${canvasId}"></canvas>`;
  }

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = Object.keys(dailyData).sort();
  const values = labels.map((l) => dailyData[l]);

  if (labels.length === 0) {
    container.innerHTML =
      '<p class="text-center text-slate-400 text-sm py-8">داده‌ای برای نمایش وجود ندارد</p>';
    return;
  }

  if (typeof Chart === "undefined") {
    container.innerHTML =
      '<p class="text-center text-slate-400 text-sm py-8">کتابخانه نمودار لود نشده است. لطفاً فایل Chart.js را اضافه کنید.</p>';
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "درآمد روزانه (تومان)",
          data: values,
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14, 165, 233, 0.1)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (ctx) => faNum(ctx.raw) + " تومان",
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => faNum(val),
          },
        },
      },
    },
  });
}

function renderMonthlyChart(monthlyData) {
  const container = document.getElementById("monthly-chart-container");
  const canvasId = "monthly-chart";

  if (window.monthlyChartInstance) {
    window.monthlyChartInstance.destroy();
    window.monthlyChartInstance = null;
  }

  if (container) {
    container.innerHTML = `<canvas id="${canvasId}"></canvas>`;
  }

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = Object.keys(monthlyData).sort();
  const values = labels.map((l) => monthlyData[l]);

  if (labels.length === 0) {
    container.innerHTML =
      '<p class="text-center text-slate-400 text-sm py-8">داده‌ای برای نمایش وجود ندارد</p>';
    return;
  }

  if (typeof Chart === "undefined") {
    container.innerHTML =
      '<p class="text-center text-slate-400 text-sm py-8">کتابخانه نمودار لود نشده است. لطفاً فایل Chart.js را اضافه کنید.</p>';
    return;
  }

  window.monthlyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "درآمد ماهانه (تومان)",
          data: values,
          backgroundColor: "#0284c7",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (ctx) => faNum(ctx.raw) + " تومان",
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => faNum(val),
          },
        },
      },
    },
  });
}

// ✅ این خط باعث می‌شود app.js بتواند initReports را صدا بزند
window.initReports = initReports;
