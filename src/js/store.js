import { RATE_CATEGORIES } from "../data/rates.js";

const KEYS = {
  PRODUCTS: "cafe_products",
  PRODUCT_CATEGORIES: "cafe_product_categories",
  ANNOUNCEMENTS: "cafe_announcements", // ✅ کلید ذخیره اخبار و اعلانات
  INVOICES: "cafe_invoices",
  COUNTER: "cafe_invoice_counter",
  SHOP: "cafe_shop_info",
  AUTH: "cafe_auth",
  SETTINGS: "cafe_settings",
  CUSTOMERS: "cafe_customers",
  CUSTOM_SERVICES: "cafe_custom_services",
};

// اعلان پیش‌فرض اولیه
const DEFAULT_ANNOUNCEMENTS = [
  {
    id: "ann-welcome",
    title: "به کافی‌نت آنلاین خوش آمدید",
    summary: "اطلاع‌رسانی آخرین خدمات، ثبت‌نام‌های دولتی و نرخ‌نامه مصوب.",
    content:
      "<p>مشتریان گرامی، کلیه خدمات اینترنتی، ثبت‌نام‌های دانشگاهی، خدمات قضایی و استعلام‌های دولتی در این مجموعه با تعرفه مصوب اتحادیه انجام می‌شود.</p>",
    category: "عمومی",
    pin: true,
    date: "1405/01/01",
    time: "10:00",
    status: "published",
  },
];

// دسته‌بندی‌های پیش‌فرض محصولات
const DEFAULT_PRODUCT_CATEGORIES = [
  { id: "pcat-storage", name: "ذخیره‌سازی اطلاعات", icon: "💾" },
  { id: "pcat-cables", name: "کابل و اتصالات", icon: "🔌" },
  { id: "pcat-stationery", name: "نوشت‌افزار و لوازم اداری", icon: "✏️" },
  { id: "pcat-accessories", name: "لوازم جانبی کامپیوتر", icon: "🖱️" },
];

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

// ---------- تبدیل ارقام فارسی/عربی به لاتین ----------
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const toEnDigits = (input) =>
  String(input).replace(/[۰-۹٠-٩]/g, (d) => {
    const i = FA_DIGITS.indexOf(d);
    return i > -1 ? i : AR_DIGITS.indexOf(d);
  });

// ---------- هش ساده رمز عبور (سمت کلاینت) ----------
export function hashPassword(str) {
  let h1 = 5381;
  for (let i = 0; i < str.length; i++)
    h1 = ((h1 << 5) + h1 + str.charCodeAt(i)) >>> 0;
  let h2 = 52711;
  for (let i = str.length - 1; i >= 0; i--)
    h2 = ((h2 << 5) + h2 + str.charCodeAt(i)) >>> 0;
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const SESSION_KEY = "cafe_session";

export const store = {
  // ---------- اخبار و اعلانات ----------
  getAnnouncements() {
    const list = read(KEYS.ANNOUNCEMENTS, DEFAULT_ANNOUNCEMENTS);
    // همیشه اخبار پین‌شده در ابتدا و بر اساس تاریخ/زمان مرتب شوند
    return list.sort((a, b) => {
      if (a.pin === b.pin)
        return (b.date + b.time).localeCompare(a.date + a.time);
      return a.pin ? -1 : 1;
    });
  },
  getAnnouncement(id) {
    return this.getAnnouncements().find((a) => a.id === id);
  },
  saveAnnouncement(ann) {
    const list = this.getAnnouncements();
    const id = ann.id || "ann-" + uid();
    const item = {
      id,
      title: (ann.title || "").trim(),
      summary: (ann.summary || "").trim(),
      content: ann.content || "",
      category: (ann.category || "عمومی").trim(),
      pin: Boolean(ann.pin),
      date: ann.date || toJalali().full,
      time: ann.time || nowTimeFa(),
      status: ann.status || "published",
    };
    const idx = list.findIndex((a) => a.id === id);
    if (idx >= 0) list[idx] = item;
    else list.unshift(item);
    write(KEYS.ANNOUNCEMENTS, list);
    return item;
  },
  deleteAnnouncement(id) {
    const list = this.getAnnouncements().filter((a) => a.id !== id);
    write(KEYS.ANNOUNCEMENTS, list);
    return list;
  },
  setAnnouncements(list) {
    write(KEYS.ANNOUNCEMENTS, list);
    return list;
  },

  // ---------- دسته‌بندی محصولات فیزیکی ----------
  getProductCategories() {
    return read(KEYS.PRODUCT_CATEGORIES, DEFAULT_PRODUCT_CATEGORIES);
  },
  getProductCategory(id) {
    return this.getProductCategories().find((c) => c.id === id);
  },
  saveProductCategory(category) {
    const list = this.getProductCategories();
    const id = category.id || "pcat-" + uid();
    const item = {
      id,
      name: (category.name || "").trim(),
      icon: (category.icon || "📦").trim(),
    };
    const idx = list.findIndex((c) => c.id === id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    write(KEYS.PRODUCT_CATEGORIES, list);
    return item;
  },
  deleteProductCategory(id) {
    const list = this.getProductCategories().filter((c) => c.id !== id);
    write(KEYS.PRODUCT_CATEGORIES, list);
    const products = this.getProducts().map((p) =>
      p.categoryId === id ? { ...p, categoryId: "" } : p,
    );
    this.setProducts(products);
  },
  setProductCategories(list) {
    write(KEYS.PRODUCT_CATEGORIES, list);
    return list;
  },

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
    const item = {
      ...product,
      categoryId: product.categoryId || "",
    };
    if (idx >= 0) list[idx] = item;
    else list.unshift(item);
    write(KEYS.PRODUCTS, list);
    return item;
  },
  deleteProduct(id) {
    write(
      KEYS.PRODUCTS,
      this.getProducts().filter((p) => p.id !== id),
    );
  },

  // ---------- مدیریت دیتای جدید به صورت مجزا ----------
  getCustomServices() {
    return read(KEYS.CUSTOM_SERVICES, {
      newCategories: [],
      categoryOverrides: {},
    });
  },

  saveCustomServices(data) {
    write(KEYS.CUSTOM_SERVICES, data);
    return data;
  },

  getServices() {
    const base = JSON.parse(JSON.stringify(RATE_CATEGORIES));
    const custom = this.getCustomServices();
    const overrides = custom.categoryOverrides || {};

    const updatedBase = base.map((cat) => {
      if (overrides[cat.id]) {
        return {
          ...cat,
          title: overrides[cat.id].title || cat.title,
          items: overrides[cat.id].items || cat.items,
        };
      }
      return cat;
    });

    const newCats = (custom.newCategories || []).map((c) => ({
      ...c,
      custom: true,
    }));
    return [...newCats, ...updatedBase];
  },

  saveNewCategory(title, items) {
    const custom = this.getCustomServices();
    const newCat = {
      id: "cat-" + uid(),
      title: title.trim(),
      items: items.map((it) => ({
        id: it.id || "srv-" + uid(),
        title: it.title.trim(),
        price: Number(it.price) || 0,
        custom: true,
      })),
      custom: true,
    };
    custom.newCategories.unshift(newCat);
    this.saveCustomServices(custom);
    return newCat;
  },

  updateCategoryItems(catId, updatedTitle, items) {
    const custom = this.getCustomServices();

    const newCatIdx = (custom.newCategories || []).findIndex(
      (c) => c.id === catId,
    );
    if (newCatIdx >= 0) {
      custom.newCategories[newCatIdx].title = updatedTitle.trim();
      custom.newCategories[newCatIdx].items = items.map((it) => ({
        id: it.id || "srv-" + uid(),
        title: it.title.trim(),
        price: Number(it.price) || 0,
        custom: true,
      }));
      this.saveCustomServices(custom);
      return custom.newCategories[newCatIdx];
    }

    if (!custom.categoryOverrides) custom.categoryOverrides = {};
    custom.categoryOverrides[catId] = {
      title: updatedTitle.trim(),
      items: items.map((it) => ({
        id: it.id || "srv-" + uid(),
        title: it.title.trim(),
        price: Number(it.price) || 0,
      })),
    };
    this.saveCustomServices(custom);
    return custom.categoryOverrides[catId];
  },

  deleteServiceItem(catId, itemId) {
    const list = this.getServices();
    const cat = list.find((c) => c.id === catId);
    if (!cat) return;
    const remainingItems = cat.items.filter((i) => i.id !== itemId);
    this.updateCategoryItems(catId, cat.title, remainingItems);
  },

  deleteCategory(catId) {
    const custom = this.getCustomServices();
    if (custom.newCategories) {
      custom.newCategories = custom.newCategories.filter((c) => c.id !== catId);
    }
    if (custom.categoryOverrides && custom.categoryOverrides[catId]) {
      delete custom.categoryOverrides[catId];
    }
    this.saveCustomServices(custom);
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

  // ---------- مشتریان ----------
  getCustomers() {
    return read(KEYS.CUSTOMERS, []);
  },
  saveCustomer(customer) {
    const list = this.getCustomers();
    const phone = (customer.phone || "").trim();
    const name = (customer.name || "").trim();

    let idx = -1;
    if (customer.id) idx = list.findIndex((c) => c.id === customer.id);
    if (idx < 0 && phone && name)
      idx = list.findIndex((c) => c.phone === phone && c.name === name);
    if (idx < 0 && phone && !name)
      idx = list.findIndex((c) => c.phone === phone);
    if (idx < 0 && !phone && name)
      idx = list.findIndex((c) => !c.phone && c.name === name);

    const existing = idx >= 0 ? list[idx] : {};
    const FIELDS = [
      "name",
      "phone",
      "nationalCode",
      "birthCertNo",
      "address",
      "gender",
      "age",
      "notes",
    ];
    const record = {
      id: existing.id || customer.id || uid(),
      lastSeen: toJalali().full,
    };
    FIELDS.forEach((f) => {
      record[f] =
        f in customer ? String(customer[f] ?? "").trim() : existing[f] || "";
    });

    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    write(KEYS.CUSTOMERS, list);
    return record;
  },
  saveCustomers(list) {
    write(KEYS.CUSTOMERS, list);
    return list;
  },
  deleteCustomer(id) {
    write(
      KEYS.CUSTOMERS,
      this.getCustomers().filter((c) => c.id !== id),
    );
  },

  setInvoices(list) {
    write(KEYS.INVOICES, list);
    return list;
  },
  setProducts(list) {
    write(KEYS.PRODUCTS, list);
    return list;
  },
  getCounter() {
    return read(KEYS.COUNTER, 1000);
  },
  setCounter(n) {
    write(KEYS.COUNTER, n);
    return n;
  },

  // ---------- اطلاعات کسب‌وکار ----------
  getShopInfo() {
    return read(KEYS.SHOP, {
      name: "کافی‌نت آنلاین",
      slogan: "ارائه‌دهنده خدمات اینترنتی و ثبت‌نام‌های دولتی",
      phone: "",
      address: "",
      logo: "",
      bankAccounts: [],
    });
  },
  saveShopInfo(info) {
    write(KEYS.SHOP, info);
    return info;
  },

  // ---------- احراز هویت ----------
  getAuth() {
    return read(KEYS.AUTH, { user: "admin", passHash: hashPassword("1234") });
  },
  saveAuth(auth) {
    write(KEYS.AUTH, auth);
    return auth;
  },
  login(user, pass) {
    const auth = this.getAuth();
    return user.trim() === auth.user && hashPassword(pass) === auth.passHash;
  },
  changePassword(current, next) {
    const auth = this.getAuth();
    if (hashPassword(current) !== auth.passHash) return false;
    this.saveAuth({ ...auth, passHash: hashPassword(next) });
    return true;
  },
  setSession(remember) {
    const val = JSON.stringify({ ts: Date.now() });
    if (remember) localStorage.setItem(SESSION_KEY, val);
    else sessionStorage.setItem(SESSION_KEY, val);
  },
  isLoggedIn() {
    return !!(
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    );
  },
  logout() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },

  // ---------- تنظیمات عمومی ----------
  getSettings() {
    return read(KEYS.SETTINGS, { devMode: false });
  },
  saveSettings(settings) {
    write(KEYS.SETTINGS, settings);
    return settings;
  },

  // ---------- ریست کامل ----------
  resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },

  // ---------- گزارش‌گیری ----------
  getReportData(startDate, endDate) {
    const invoices = this.getInvoices();

    let start, end;
    if (startDate && endDate) {
      const [sy, sm, sd] = toEnDigits(startDate).split("/").map(Number);
      const [ey, em, ed] = toEnDigits(endDate).split("/").map(Number);
      start = fromJalali(sy, sm, sd).getTime();
      end = fromJalali(ey, em, ed).setHours(23, 59, 59, 999);
    } else {
      const today = toJalali();
      const [ty, tm, td] = today.full.split("/").map(Number);
      start = fromJalali(ty, tm, td).getTime();
      end = fromJalali(ty, tm, td).setHours(23, 59, 59, 999);
    }

    const filtered = invoices.filter((inv) => {
      const dateStr = toEnDigits(inv.date || "").trim();
      if (!/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return false;

      const [iy, im, id] = dateStr.split("/").map(Number);
      const invDate = fromJalali(iy, im, id).getTime();
      return invDate >= start && invDate <= end;
    });

    const dailyIncome = {};
    filtered.forEach((inv) => {
      dailyIncome[inv.date] = (dailyIncome[inv.date] || 0) + inv.total;
    });

    const monthlyIncome = {};
    filtered.forEach((inv) => {
      const [year, month] = inv.date.split("/");
      const monthKey = `${year}/${month}`;
      monthlyIncome[monthKey] = (monthlyIncome[monthKey] || 0) + inv.total;
    });

    const serviceCount = {};
    filtered.forEach((inv) => {
      inv.items.forEach((item) => {
        const key = item.title;
        if (!serviceCount[key]) serviceCount[key] = { count: 0, revenue: 0 };
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

function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm =
    days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

export function toJalali(date = new Date()) {
  const [y, m, d] = gregorianToJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return {
    year: y,
    month: m,
    day: d,
    full: `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`,
  };
}

export function fromJalali(jy, jm, jd) {
  const jalaliToGregorian = (jy, jm, jd) => {
    let gy = jy <= 979 ? 621 : 1600;
    jy -= jy <= 979 ? 0 : 979;
    let days =
      365 * jy +
      Math.floor(jy / 33) * 8 +
      Math.floor(((jy % 33) + 3) / 4) +
      78 +
      jd +
      (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
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
    let a = 0;
    for (a = 0; a < 13; a++) {
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
