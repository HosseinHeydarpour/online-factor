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
};

// ---------- ابزارهای عمومی ----------
export const faNum = (n) =>
  new Intl.NumberFormat("fa-IR").format(Number(n) || 0);
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
