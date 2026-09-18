const KEYS = {
  PRODUCTS: "cafe_products",
  INVOICES: "cafe_invoices",
  COUNTER: "cafe_invoice_counter",
  SHOP: "cafe_shop_info",
};

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const store = {
  // ---------- محصولات ----------
  getProducts() {
    return read(KEYS.PRODUCTS, []);
  },
  getProduct(id) {
    return this.getProducts().find((p) => p.id === id);
  },
  saveProduct(product) {
    const list = this.getProducts();
    const idx = list.findIndex((p) => p.id === product.id);
    if (idx >= 0) list[idx] = product;
    else list.unshift(product);
    write(KEYS.PRODUCTS, list);
    return product;
  },
  deleteProduct(id) {
    write(
      KEYS.PRODUCTS,
      this.getProducts().filter((p) => p.id !== id),
    );
  },

  // ---------- فاکتورها ----------
  nextInvoiceNumber() {
    const n = read(KEYS.COUNTER, 1000) + 1;
    write(KEYS.COUNTER, n);
    return n;
  },
  saveInvoice(invoice) {
    const list = read(KEYS.INVOICES, []);
    list.unshift(invoice);
    write(KEYS.INVOICES, list);
    return invoice;
  },
  getInvoices() {
    return read(KEYS.INVOICES, []);
  },

  // ---------- اطلاعات کسب‌وکار ----------
  getShopInfo() {
    return read(KEYS.SHOP, {
      name: "کافی‌نت آنلاین",
      slogan: "ارائه‌دهنده خدمات اینترنتی و ثبت‌نام‌های دولتی",
      phone: "",
      address: "",
      logo: "",
    });
  },
  saveShopInfo(info) {
    write(KEYS.SHOP, info);
    return info;
  },
  
  // ---------- گزارش‌گیری ----------
  getReportData(startDate, endDate) {
    const invoices = this.getInvoices();
    
    // اگر تاریخ شروع و پایان داده نشده باشد، از امروز استفاده کن
    let start, end;
    if (startDate && endDate) {
      const [sy, sm, sd] = startDate.split('/').map(Number);
      const [ey, em, ed] = endDate.split('/').map(Number);
      start = fromJalali(sy, sm, sd).getTime();
      end = fromJalali(ey, em, ed).setHours(23, 59, 59, 999);
    } else {
      const today = toJalali();
      const [ty, tm, td] = today.full.split('/').map(Number);
      start = fromJalali(ty, tm, td).getTime();
      end = fromJalali(ty, tm, td).setHours(23, 59, 59, 999);
    }
    
    const filtered = invoices.filter(inv => {
      // inv.date فرمت "1404/01/15" دارد - باید به میلادی تبدیل شود
      const [iy, im, id] = inv.date.split('/').map(Number);
      const invDate = fromJalali(iy, im, id).getTime();
      return invDate >= start && invDate <= end;
    });
    
    // درآمد روزانه
    const dailyIncome = {};
    filtered.forEach(inv => {
      // inv.date خودش تاریخ شمسی است
      const dateKey = inv.date;
      dailyIncome[dateKey] = (dailyIncome[dateKey] || 0) + inv.total;
    });
    
    // درآمد ماهانه
    const monthlyIncome = {};
    filtered.forEach(inv => {
      const [year, month] = inv.date.split('/');
      const monthKey = `${year}/${month}`;
      monthlyIncome[monthKey] = (monthlyIncome[monthKey] || 0) + inv.total;
    });
    
    // خدمات پرفروش
    const serviceCount = {};
    filtered.forEach(inv => {
      inv.items.forEach(item => {
        const key = item.title;
        if (!serviceCount[key]) {
          serviceCount[key] = { count: 0, revenue: 0 };
        }
        serviceCount[key].count += item.qty;
        serviceCount[key].revenue += item.price * item.qty;
      });
    });
    
    const topServices = Object.entries(serviceCount)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    return {
      totalRevenue: filtered.reduce((sum, inv) => sum + inv.total, 0),
      totalInvoices: filtered.length,
      dailyIncome,
      monthlyIncome,
      topServices,
      invoices: filtered,
    };
  },
};

// ---------- ابزارهای عمومی ----------
export const faNum = (n) =>
  new Intl.NumberFormat("fa-IR").format(Number(n) || 0);
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// تبدیل تاریخ میلادی به شمسی
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186 ? days % 31 : (days - 186) % 30));
  return [jy, jm, jd];
}

export function toJalali(date = new Date()) {
  const [y, m, d] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { year: y, month: m, day: d, full: `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}` };
}

export function fromJalali(jy, jm, jd) {
  const jalaliToGregorian = (jy, jm, jd) => {
    let gy = jy <= 979 ? 621 : 1600;
    jy -= jy <= 979 ? 0 : 979;
    let days = 365 * jy + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let gd = days + 1;
    const sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let a = 0; a < 13; a++) {
      const v = sal_a[a];
      if (gd <= v) break;
      gd -= v;
      if (a === 2 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) gd--;
    }
    return [gy, a, gd];
  };
  return new Date(...jalaliToGregorian(jy, jm, jd));
}

export const todayFa = () =>
  new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(new Date());
  
export const nowTimeFa = () =>
  new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

// ---------- تبدیل عدد به حروف فارسی ----------
export function numberToWordsFa(num) {
  num = Math.floor(Number(num) || 0);
  if (num === 0) return "صفر";

  const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const teens = [
    "ده",
    "یازده",
    "دوازده",
    "سیزده",
    "چهارده",
    "پانزده",
    "شانزده",
    "هفده",
    "هجده",
    "نوزده",
  ];
  const tens = [
    "",
    "",
    "بیست",
    "سی",
    "چهل",
    "پنجاه",
    "شصت",
    "هفتاد",
    "هشتاد",
    "نود",
  ];
  const hundreds = [
    "",
    "یکصد",
    "دویست",
    "سیصد",
    "چهارصد",
    "پانصد",
    "ششصد",
    "هفتصد",
    "هشتصد",
    "نهصد",
  ];
  const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

  function threeDigits(n) {
    const parts = [];
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const o = n % 10;
    if (h) parts.push(hundreds[h]);
    if (t === 1) parts.push(teens[o]);
    else {
      if (t) parts.push(tens[t]);
      if (o) parts.push(ones[o]);
    }
    return parts.join(" و ");
  }

  const chunks = [];
  let scaleIdx = 0;
  let n = num;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk !== 0) {
      const w =
        threeDigits(chunk) + (scales[scaleIdx] ? " " + scales[scaleIdx] : "");
      chunks.unshift(w);
    }
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return chunks.join(" و ");
}
