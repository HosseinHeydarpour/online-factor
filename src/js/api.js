// ============================================================
// API Client — ارتباط با سرور Express و پایگاه‌داده MongoDB
// ============================================================

// آدرس پیش‌فرض بک‌اند (در صورت اجرای فرانت و بک روی یک پورت یا پورت 5000)
const DEFAULT_API_BASE =
  window.location.port === "3000"
    ? "http://localhost:5000/api"
    : `${window.location.origin}/api`;

const API_BASE_KEY = "cafe_api_base_url";
const API_TOKEN_KEY = "cafe_api_jwt_token";

export function getApiBaseUrl() {
  return localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE;
}

export function setApiBaseUrl(url) {
  if (url) localStorage.setItem(API_BASE_KEY, url.trim().replace(/\/+$/, ""));
  else localStorage.removeItem(API_BASE_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(API_TOKEN_KEY) || "";
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(API_TOKEN_KEY, token);
  else localStorage.removeItem(API_TOKEN_KEY);
}

/**
 * متد عمومی ارسال درخواست به API سرور Express
 */
async function request(endpoint, options = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        (data && data.error) || `خطای سرور با کد وضعیت ${res.status}`
      );
    }

    return data;
  } catch (err) {
    // خطای عدم اتصال به سرور یا شبکه
    console.warn(`[API] خطا در ارسال درخواست به ${url}:`, err.message);
    throw err;
  }
}

export const api = {
  // ۱. بررسی آنلاین بودن سرور
  async checkHealth() {
    try {
      const data = await request("/health");
      return data && data.status === "ok";
    } catch {
      return false;
    }
  },

  // ۲. احراز هویت
  auth: {
    async login(username, password) {
      const res = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (res && res.token) {
        setAuthToken(res.token);
      }
      return res;
    },
    async getMe() {
      return request("/auth/me");
    },
    async changePassword(currentPassword, newPassword) {
      return request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    logout() {
      setAuthToken("");
    },
  },

  // ۳. فاکتورها
  invoices: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const res = await request(`/invoices${query ? "?" + query : ""}`);
      return (res && res.data) || [];
    },
    async getNextNumber() {
      const res = await request("/invoices/next-number");
      return res && res.nextNumber;
    },
    async getByNumber(num) {
      const res = await request(`/invoices/${num}`);
      return res && res.data;
    },
    async save(invoiceData) {
      const res = await request("/invoices", {
        method: "POST",
        body: JSON.stringify(invoiceData),
      });
      return res && res.data;
    },
    async delete(number) {
      return request(`/invoices/${number}`, { method: "DELETE" });
    },
  },

  // ۴. پیش‌فاکتورها
  proformas: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const res = await request(`/proformas${query ? "?" + query : ""}`);
      return (res && res.data) || [];
    },
    async getNextNumber() {
      const res = await request("/proformas/next-number");
      return res && res.nextNumber;
    },
    async getByNumber(num) {
      const res = await request(`/proformas/${num}`);
      return res && res.data;
    },
    async save(proformaData) {
      const res = await request("/proformas", {
        method: "POST",
        body: JSON.stringify(proformaData),
      });
      return res && res.data;
    },
    async delete(number) {
      return request(`/proformas/${number}`, { method: "DELETE" });
    },
  },

  // ۵. محصولات و دسته‌بندی‌ها
  products: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const res = await request(`/products${query ? "?" + query : ""}`);
      return (res && res.data) || [];
    },
    async save(productData) {
      const res = await request("/products", {
        method: "POST",
        body: JSON.stringify(productData),
      });
      return res && res.data;
    },
    async delete(id) {
      return request(`/products/${id}`, { method: "DELETE" });
    },
    async getCategories() {
      const res = await request("/products/categories");
      return (res && res.data) || [];
    },
    async saveCategory(catData) {
      const res = await request("/products/categories", {
        method: "POST",
        body: JSON.stringify(catData),
      });
      return res && res.data;
    },
    async deleteCategory(id) {
      return request(`/products/categories/${id}`, { method: "DELETE" });
    },
  },

  // ۶. نرخ‌نامه و خدمات
  services: {
    async getAll() {
      const res = await request("/services");
      return (res && res.data) || [];
    },
    async saveCategory(catData) {
      const res = await request("/services/category", {
        method: "POST",
        body: JSON.stringify(catData),
      });
      return res && res.data;
    },
    async deleteCategory(id) {
      return request(`/services/category/${id}`, { method: "DELETE" });
    },
  },

  // ۷. مشتریان
  customers: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      const res = await request(`/customers${query ? "?" + query : ""}`);
      return (res && res.data) || [];
    },
    async save(customerData) {
      const res = await request("/customers", {
        method: "POST",
        body: JSON.stringify(customerData),
      });
      return res && res.data;
    },
    async delete(id) {
      return request(`/customers/${id}`, { method: "DELETE" });
    },
  },

  // ۸. اطلاعات کسب‌وکار و حساب‌های بانکی
  shop: {
    async get() {
      const res = await request("/shop");
      return (res && res.data) || {};
    },
    async save(shopData) {
      const res = await request("/shop", {
        method: "POST",
        body: JSON.stringify(shopData),
      });
      return res && res.data;
    },
  },

  // ۹. اعلانات
  announcements: {
    async getAll() {
      const res = await request("/announcements");
      return (res && res.data) || [];
    },
    async save(annData) {
      const res = await request("/announcements", {
        method: "POST",
        body: JSON.stringify(annData),
      });
      return res && res.data;
    },
    async delete(id) {
      return request(`/announcements/${id}`, { method: "DELETE" });
    },
  },

  // ۱۰. همگام‌سازی و پشتیبان‌گیری
  sync: {
    async importAll(bundleData) {
      return request("/sync/import", {
        method: "POST",
        body: JSON.stringify(bundleData),
      });
    },
    async exportAll() {
      return request("/sync/export");
    },
  },
};
