import { store } from "./store.js";
import { autoSaveInvoices, performLocalFolderBackup } from "./backup.js";
import { startPushTask } from "./progress-indicator.js";
import { uploadToBackend } from "./backendSync.js";

const API = "https://api.github.com";

function triggerLocalBackupOnPush() {
  try {
    const s = store.getSettings();
    if (s.localFolderBackup?.onPush !== false) {
      performLocalFolderBackup({ trigger: "push", showToast: true });
    }
  } catch (e) {
    console.warn("خطا در همگام‌سازی بک‌آپ محلی هنگام push:", e);
  }
}

export function getBackupRepoConfig() {
  const s = store.getSettings();
  const b = s.backupRepo || {};
  let repo = b.repo ? b.repo.trim() : "";
  // اگر مقدار خالی یا برابر با ریپوی عمومی یا با هر فرمتی از factor_backup بود، به Factor_backup استاندارد شود
  if (!repo || repo === "online-factor" || repo.toLowerCase() === "factor_backup") {
    repo = "Factor_backup";
  }
  return {
    owner: (b.owner && b.owner.trim()) || "Mohamadrezaheydarpourgithub",
    repo: repo,
    branch: (b.branch && b.branch.trim()) || "main",
    token: (b.token && b.token.trim()) || "",
    autoPush: b.autoPush !== false,
  };
}

export function getPublicRepoConfig() {
  const s = store.getSettings();
  const pub = s.publicRepo || {};
  const backup = getBackupRepoConfig();
  return {
    owner: (pub.owner && pub.owner.trim()) || "Mohamadrezaheydarpourgithub",
    repo: (pub.repo && pub.repo.trim()) || "online-factor",
    branch: (pub.branch && pub.branch.trim()) || "main",
    token: (pub.token && pub.token.trim()) || backup.token || "",
    enabled: pub.enabled ?? true,
  };
}

function ghToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}

/* ---------- push خودکار به سرور بک‌اند MongoDB و ریپوی بک‌آپ ---------- */
export function autoPushGitHub(title = "پشتیبان‌گیری خودکار") {
  // ۱. آپلود مستقیم به سرور Express و پایگاه‌داده MongoDB
  uploadToBackend(title).catch(() => {});
  // ۲. ارسال به گیت‌هاب در صورت وجود تنظیمات
  syncAllStorages({ title, showToast: false }).catch(() => {});
}

/* ---------- push خودکار به سرور بک‌اند MongoDB و ریپوی پابلیک ---------- */
export function autoPushPublicRepo(title = "همگام‌سازی عمومی") {
  uploadToBackend(title).catch(() => {});
  syncAllStorages({ title, showToast: false }).catch(() => {});
}

/* ---------- همگام‌سازی یکپارچه تمام حافظه‌ها (سرور MongoDB + لوکال + گیت‌هاب) ---------- */
let isSyncing = false;
let syncDebounceTimer = null;

export async function syncAllStorages({ title = "همگام‌سازی داده‌ها", showToast = false, _task = null } = {}) {
  try {
    autoSaveInvoices();
  } catch (_) {}

  // ذخیره در سرور بک‌اند MongoDB
  const backendPromise = uploadToBackend(title, { showIndicator: !_task });

  const backupCfg = getBackupRepoConfig();
  const pubCfg = getPublicRepoConfig();

  const hasBackup = Boolean(backupCfg.owner && backupCfg.repo && backupCfg.token);
  const hasPublic = Boolean(pubCfg.owner && pubCfg.repo && pubCfg.token);

  if (!hasBackup && !hasPublic) {
    const backendRes = await backendPromise;
    if (backendRes && backendRes.ok) {
      if (showToast) ghToast("✅ اطلاعات با موفقیت در پایگاه‌داده MongoDB ذخیره شد 🍃");
      return { ok: true, message: "ذخیره در سرور انجام شد" };
    }
    if (showToast) {
      ghToast("💾 اطلاعات در حافظه محلی ذخیره شد.");
    }
    return { ok: true, message: "ذخیره لوکال انجام شد" };
  }

  const task = _task || startPushTask(title, "در حال بررسی اتصال به گیت‌هاب...");

  if (isSyncing) {
    task.update(10, "در صف همگام‌سازی...");
    clearTimeout(syncDebounceTimer);
    return new Promise((resolve) => {
      syncDebounceTimer = setTimeout(async () => {
        resolve(await syncAllStorages({ title, showToast, _task: task }));
      }, 1000);
    });
  }

  isSyncing = true;
  try {
    const isSameRepo =
      hasBackup &&
      hasPublic &&
      backupCfg.owner.trim().toLowerCase() === pubCfg.owner.trim().toLowerCase() &&
      backupCfg.repo.trim().toLowerCase() === pubCfg.repo.trim().toLowerCase() &&
      (backupCfg.branch || "main").trim() === (pubCfg.branch || "main").trim();

    if (isSameRepo) {
      const res = await pushCombinedToGitHub(backupCfg, { silent: true, task });
      if (typeof window.updatePublicStatusUI === "function") window.updatePublicStatusUI();
      if (typeof window.updateGitHubStatusUI === "function") window.updateGitHubStatusUI();

      if (res.ok) {
        task.complete("با موفقیت روی گیت‌هاب ذخیره شد ✅");
        if (showToast) {
          ghToast("✅ همگام‌سازی گیت‌هاب (عمومی و خصوصی) انجام شد ☁️");
        }
      } else {
        if (res.blockedByGuard) {
          task.fail("سد ضد تخریب: پوش لغو شد");
        } else {
          task.fail(res.message || "خطا در همگام‌سازی");
        }
        if (showToast) {
          ghToast(`❌ خطا در همگام‌سازی گیت‌هاب: ${res.message || ""}`);
        }
      }
      return res;
    } else {
      let backupRes = { ok: false };
      let publicRes = { ok: false };

      if (hasBackup) {
        backupRes = await pushBackupToGitHub({ silent: true, task });
      }
      if (hasPublic) {
        publicRes = await pushToPublicRepo({ silent: true, task });
      }

      if (typeof window.updatePublicStatusUI === "function") window.updatePublicStatusUI();
      if (typeof window.updateGitHubStatusUI === "function") window.updateGitHubStatusUI();

      const allOk = (hasBackup ? backupRes.ok : true) && (hasPublic ? publicRes.ok : true);
      if (allOk) {
        task.complete("با موفقیت روی گیت‌هاب ذخیره شد ✅");
        if (showToast) {
          ghToast("✅ همگام‌سازی ریپوی عمومی و خصوصی انجام شد ☁️");
        }
      } else {
        task.fail("خطا در همگام‌سازی گیت‌هاب");
        if (showToast) {
          ghToast("❌ خطا در همگام‌سازی با گیت‌هاب");
        }
      }
      return { ok: backupRes.ok || publicRes.ok };
    }
  } catch (err) {
    console.error("خطا در syncAllStorages:", err);
    task.fail(err.message || "خطا در همگام‌سازی");
    if (showToast) ghToast(`❌ خطا در همگام‌سازی: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}

export function saveBackupRepoConfig(cfg) {
  store.saveSettings({ ...store.getSettings(), backupRepo: cfg });
}

export function savePublicRepoConfig(cfg) {
  store.saveSettings({ ...store.getSettings(), publicRepo: cfg });
}

export function getGitHubConfig() {
  return getBackupRepoConfig();
}
export function saveGitHubConfig(cfg) {
  saveBackupRepoConfig(cfg);
}

function headers(cfg) {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function toBase64(str) {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  } catch (_) {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

export function fromBase64(b64) {
  if (!b64) return "";
  const bin = atob(String(b64).replace(/\s/g, ""));
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function gh(path, cfg, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(cfg), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

/* ---------- دریافت امن فایل‌های JSON از گیت‌هاب (پشتیبانی از فایل‌های بزرگتر از ۱ مگابایت با Blobs API) ---------- */
export async function fetchGitHubJson(cfg, path) {
  if (!cfg || !cfg.owner || !cfg.repo) return null;
  const branch = encodeURIComponent(cfg.branch || "main");

  // ۱. تلاش از طریق API contents
  try {
    const res = await gh(
      `/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${branch}`,
      cfg,
    );
    // اگر فایل کمتر از ۱ مگابایت باشد، content مستقیماً وجود دارد
    if (res && res.content) {
      return JSON.parse(fromBase64(res.content));
    }
    // اگر فایل بزرگتر از ۱ مگابایت باشد (مانند products.json)، فیلد content خالی است ولی sha وجود دارد
    if (res && res.sha) {
      const blob = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/blobs/${res.sha}`,
        cfg,
      );
      if (blob && blob.content) {
        return JSON.parse(fromBase64(blob.content));
      }
    }
    // در صورت وجود download_url
    if (res && res.download_url) {
      const rawRes = await fetch(res.download_url, {
        headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
      });
      if (rawRes.ok) {
        return await rawRes.json();
      }
    }
  } catch (_) {}

  // ۲. تلاش مستقیم از آدرس raw.githubusercontent.com با هدر توکن
  try {
    const rawUrl = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch || "main"}/${path}?_=${Date.now()}`;
    const rawRes = await fetch(rawUrl, {
      cache: "no-store",
      headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
    });
    if (rawRes.ok) {
      return await rawRes.json();
    }
  } catch (_) {}

  return null;
}

/* ---------- بررسی وجود داده‌های محصولات در مخزن عمومی یا بک‌آپ ---------- */
export async function checkRemotePublicData(cfg) {
  if (!cfg || !cfg.owner || !cfg.repo) {
    return {
      hasData: false,
      productCount: 0,
      categoryCount: 0,
      products: [],
      categories: [],
    };
  }

  let productCount = 0;
  let categoryCount = 0;
  let remoteProducts = [];
  let remoteCategories = [];

  // ۱. بررسی فایل اصلی بک‌آپ محصولات (backup/products.json)
  try {
    const dataB = await fetchGitHubJson(cfg, "backup/products.json");
    if (Array.isArray(dataB) && dataB.length > 0) {
      productCount = dataB.length;
      remoteProducts = dataB;
    }
  } catch (_) {}

  // ۲. بررسی فایل عمومی محصولات (data/products.json) — اگر کامل‌تر بود جایگزین کن
  try {
    const data = await fetchGitHubJson(cfg, "data/products.json");
    if (Array.isArray(data) && data.length > productCount) {
      productCount = data.length;
      remoteProducts = data;
    }
  } catch (_) {}

  // ۳. بررسی دسته‌بندی‌ها (ابتدا backup سپس data)
  try {
    const catB = await fetchGitHubJson(cfg, "backup/product-categories.json");
    if (Array.isArray(catB) && catB.length > 0) {
      categoryCount = catB.length;
      remoteCategories = catB;
    }
  } catch (_) {}

  if (categoryCount === 0) {
    try {
      const dataCat = await fetchGitHubJson(cfg, "data/product-categories.json");
      if (Array.isArray(dataCat) && dataCat.length > 0) {
        categoryCount = dataCat.length;
        remoteCategories = dataCat;
      }
    } catch (_) {}
  }

  return {
    hasData: productCount > 0 || categoryCount > 0,
    productCount,
    categoryCount,
    products: remoteProducts,
    categories: remoteCategories,
  };
}

/* ---------- فایل‌های پشتیبان ریپوی پرایوت ---------- */
function collectBackupFiles() {
  return [
    {
      path: "backup/invoices.json",
      content: JSON.stringify(store.getInvoices(), null, 2),
    },
    {
      path: "backup/proformas.json",
      content: JSON.stringify(store.getProformas(), null, 2),
    },
    {
      path: "backup/announcements.json",
      content: JSON.stringify(store.getAnnouncements(), null, 2),
    },
    {
      path: "backup/products.json",
      content: JSON.stringify(store.getProducts(), null, 2),
    },
    {
      // ✅ دسته‌بندی محصولات در ریپوی خصوصی
      path: "backup/product-categories.json",
      content: JSON.stringify(store.getProductCategories(), null, 2),
    },
    {
      path: "backup/customers.json",
      content: JSON.stringify(store.getCustomers(), null, 2),
    },
    {
      path: "backup/shop-info.json",
      content: JSON.stringify(store.getShopInfo(), null, 2),
    },
    {
      path: "backup/custom-services.json",
      content: JSON.stringify(store.getCustomServices(), null, 2),
    },
    {
      path: "backup/services.json",
      content: JSON.stringify(store.getServices(), null, 2),
    },
    {
      path: "backup/meta.json",
      content: JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          invoiceCount: store.getInvoices().length,
          proformaCount: store.getProformas().length,
          productCount: store.getProducts().length,
          productCategoryCount: store.getProductCategories().length,
          customerCount: store.getCustomers().length,
        },
        null,
        2,
      ),
    },
  ];
}

/* ---------- فایل‌های عمومی ریپوی پابلیک (سایت مشتری) ---------- */
function collectPublicFiles() {
  return [
    {
      path: "data/products.json",
      content: JSON.stringify(store.getProducts(), null, 2),
    },
    {
      path: "data/announcements.json",
      content: JSON.stringify(store.getAnnouncements(), null, 2),
    },
    {
      // ✅ دسته‌بندی محصولات در ریپوی عمومی مشتری
      path: "data/product-categories.json",
      content: JSON.stringify(store.getProductCategories(), null, 2),
    },
    {
      path: "data/shop-info.json",
      content: JSON.stringify(store.getShopInfo(), null, 2),
    },
    {
      path: "data/custom-services.json",
      content: JSON.stringify(store.getCustomServices(), null, 2),
    },
    {
      path: "data/services.json",
      content: JSON.stringify(store.getServices(), null, 2),
    },
    {
      path: "data/meta.json",
      content: JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          productCount: store.getProducts().length,
          productCategoryCount: store.getProductCategories().length,
        },
        null,
        2,
      ),
    },
  ];
}

/* ---------- همگام‌سازی کامل یکپارچه برای زمانی که هر دو ریپو یکسان هستند ---------- */
export async function pushCombinedToGitHub(cfg, { silent = false, task = null, title = "همگام‌سازی عمومی و پشتیبان" } = {}) {
  const currentTask = task || startPushTask(title, "بررسی اطلاعات اتصال به گیت‌هاب...");

  if (!cfg.owner || !cfg.repo || !cfg.token) {
    currentTask.fail("تنظیمات گیت‌هاب ناقص است");
    if (!silent) alert("ابتدا تنظیمات گیت‌هاب (مالک / ریپو / توکن) را کامل کنید.");
    return { ok: false, message: "تنظیمات گیت‌هاب ناقص است" };
  }

  const invs = store.getInvoices();
  const pfs = store.getProformas();
  const custs = store.getCustomers();
  const prods = store.getProducts();

  currentTask.update(12, "بررسی سد ضد تخریب داده‌ها...");
  // 🛡️ سد امنیتی ضد تخریب: اگر محصولات لوکال خالی باشد اما در ریپو دیتا وجود داشته باشد
  if (prods.length === 0) {
    const remoteData = await checkRemotePublicData(cfg);
    if (remoteData.hasData) {
      currentTask.fail("سد ضد تخریب: پوش لغو شد");
      if (!silent) {
        const shouldRestore = confirm(
          "⛔ عملیات متوقف شد (سد امنیتی ضد تخریب)!\n\n" +
            `حافظه این مرورگر فاقد اطلاعات محصول است، در حالی که در مخزن گیت‌هاب ${remoteData.productCount} محصول وجود دارد.\n` +
            "ارسال لغو شد تا دیتای سرور و سایت مشتری با اطلاعات خالی جایگزین نشود.\n\n" +
            "📥 آیا مایلید اطلاعات محصولات موجود در مخزن هم‌اکنون در این سیستم بازیابی شوند؟",
        );
        if (shouldRestore) {
          if (remoteData.products && remoteData.products.length > 0) {
            store.setProducts(remoteData.products);
          }
          if (remoteData.categories && remoteData.categories.length > 0) {
            store.setProductCategories(remoteData.categories);
          }
          if (typeof window.renderProducts === "function") window.renderProducts();
          if (typeof window.renderCategoryChips === "function") window.renderCategoryChips();
          alert("✅ اطلاعات محصولات با موفقیت از مخزن بازیابی شد.");
        }
      } else {
        ghToast("⚠️ سد ضد تخریب: دیتای محلی خالی است؛ پوش لغو شد تا اطلاعات مخزن پاک نشود");
      }
      return {
        ok: false,
        blockedByGuard: true,
        message: "داده‌های محصولات در حافظه محلی خالی است در حالی که مخزن حاوی اطلاعات است؛ پوش لغو شد.",
      };
    }
  }

  if (invs.length === 0 && pfs.length === 0 && custs.length === 0 && prods.length === 0) {
    currentTask.fail("داده‌های محلی خالی است");
    if (!silent) {
      alert(
        "⛔ عملیات متوقف شد (سد امنیتی ضد تخریب)!\n\n" +
          "حافظه این مرورگر در حال حاضر خالی است.\n" +
          "اگر قصد بازیابی دارید، روی «⬇️ بازیابی از گیت‌هاب» بزنید.",
      );
    }
    return { ok: false, message: "داده‌های محلی خالی است؛ عملیات لغو شد." };
  }

  try {
    currentTask.update(22, "آماده‌سازی فایل‌های داده...");
    const backupFiles = collectBackupFiles();
    const publicFiles = collectPublicFiles();
    const files = [...backupFiles, ...publicFiles];
    const branch = cfg.branch || "main";

    let latestSha = null;
    let baseTree = null;
    let existingPaths = new Set();

    currentTask.update(30, "واکشی شاخه اصلی...");
    try {
      const ref = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      latestSha = ref.object.sha;
      const lastCommit = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
        cfg,
      );
      baseTree = lastCommit.tree.sha;

      try {
        const treeData = await gh(
          `/repos/${cfg.owner}/${cfg.repo}/git/trees/${baseTree}?recursive=1`,
          cfg,
        );
        if (Array.isArray(treeData?.tree)) {
          existingPaths = new Set(treeData.tree.map((t) => t.path));
        }
      } catch {}
    } catch {
      await gh(`/repos/${cfg.owner}/${cfg.repo}/contents/data/init.json`, cfg, {
        method: "PUT",
        body: JSON.stringify({
          message: "🌱 راه‌اندازی پوشه دیتا",
          content: toBase64(
            JSON.stringify(
              { initializedAt: new Date().toISOString() },
              null,
              2,
            ),
          ),
          branch,
        }),
      });

      const ref = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      latestSha = ref.object.sha;
      const lastCommit = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
        cfg,
      );
      baseTree = lastCommit.tree.sha;
    }

    currentTask.update(35, "ارسال فایل‌های داده...");
    const treeItems = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const p = Math.round(35 + ((i + 1) / files.length) * 45);
      currentTask.update(p, `ارسال داده‌ها (${i + 1} از ${files.length})...`);
      const blob = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/blobs`, cfg, {
        method: "POST",
        body: JSON.stringify({
          content: toBase64(f.content),
          encoding: "base64",
        }),
      });
      treeItems.push({
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    const privateFilesToDelete = [
      "data/customers.json",
      "data/invoices.json",
      "data/proformas.json",
    ];

    for (const privPath of privateFilesToDelete) {
      if (existingPaths.has(privPath)) {
        treeItems.push({
          path: privPath,
          mode: "100644",
          type: "blob",
          sha: null,
        });
      }
    }

    currentTask.update(82, "ایجاد ساختار درختی (Tree)...");
    const tree = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg, {
      method: "POST",
      body: JSON.stringify(
        baseTree
          ? { base_tree: baseTree, tree: treeItems }
          : { tree: treeItems },
      ),
    });

    currentTask.update(89, "ثبت کامیت در ریپازیتوری...");
    const message = `🤖 همگام‌سازی کامل محصولات و پشتیبان (عمومی و خصوصی) — ${new Date().toLocaleString("fa-IR")}`;
    const commit = await gh(
      `/repos/${cfg.owner}/${cfg.repo}/git/commits`,
      cfg,
      {
        method: "POST",
        body: JSON.stringify(
          latestSha
            ? { message, tree: tree.sha, parents: [latestSha] }
            : { message, tree: tree.sha },
        ),
      },
    );

    currentTask.update(95, "نهایی‌سازی شاخه در گیت‌هاب...");
    if (latestSha) {
      await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${branch}`,
        cfg,
        {
          method: "PATCH",
          body: JSON.stringify({ sha: commit.sha, force: true }),
        },
      );
    } else {
      await gh(`/repos/${cfg.owner}/${cfg.repo}/git/refs`, cfg, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
      });
    }

    const now = Date.now();
    store.saveSettings({
      ...store.getSettings(),
      lastPush: { at: now, ok: true },
      lastPublicPush: { at: now, ok: true },
    });
    triggerLocalBackupOnPush();
    if (!task) currentTask.complete("با موفقیت روی گیت‌هاب ذخیره شد ✅");
    if (!silent) alert("پشتیبان و دیتای عمومی با موفقیت روی گیت‌هاب push شد ✅");
    return { ok: true, sha: commit.sha };
  } catch (err) {
    currentTask.fail(err.message);
    const now = Date.now();
    store.saveSettings({
      ...store.getSettings(),
      lastPush: { at: now, ok: false, error: err.message },
      lastPublicPush: { at: now, ok: false, error: err.message },
    });
    if (!silent) alert("همگام‌سازی گیت‌هاب ناموفق بود ❌\n" + err.message);
    return { ok: false, message: err.message };
  }
}

export async function pushBackupToGitHub({
  silent = false,
  task = null,
  title = "پشتیبان‌گیری در گیت‌هاب",
} = {}) {
  const currentTask = task || startPushTask(title, "بررسی اطلاعات اتصال به گیت‌هاب...");
  const cfg = getGitHubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    currentTask.fail("تنظیمات گیت‌هاب ناقص است");
    if (!silent)
      alert("ابتدا تنظیمات گیت‌هاب (مالک / ریپو / توکن) را کامل کنید.");
    return { ok: false };
  }

  const invs = store.getInvoices();
  const pfs = store.getProformas();
  const custs = store.getCustomers();
  const prods = store.getProducts();
  const customSrv = store.getCustomServices();

  currentTask.update(12, "بررسی سد ضد تخریب داده‌ها...");
  // 🛡️ سد امنیتی ضد تخریب: اگر محصولات لوکال خالی باشد اما در ریپو دیتای محصولات وجود داشته باشد
  if (prods.length === 0) {
    const remoteData = await checkRemotePublicData(cfg);
    if (remoteData.hasData) {
      currentTask.fail("سد ضد تخریب: پوش لغو شد");
      if (!silent) {
        const shouldRestore = confirm(
          "⛔ عملیات متوقف شد (سد امنیتی ضد تخریب بک‌آپ)!\n\n" +
            `حافظه این مرورگر فاقد اطلاعات محصول است، در حالی که در مخزن گیت‌هاب ${remoteData.productCount} محصول وجود دارد.\n` +
            "ارسال بک‌آپ لغو شد تا اطلاعات محصولات پاک نشود.\n\n" +
            "📥 آیا مایلید اطلاعات موجود در مخزن هم‌اکنون بازیابی شوند؟",
        );
        if (shouldRestore) {
          if (remoteData.products && remoteData.products.length > 0) {
            store.setProducts(remoteData.products);
          }
          if (remoteData.categories && remoteData.categories.length > 0) {
            store.setProductCategories(remoteData.categories);
          }
          if (typeof window.renderProducts === "function") window.renderProducts();
          if (typeof window.renderCategoryChips === "function") window.renderCategoryChips();
          alert("✅ محصولات با موفقیت بازیابی شدند.");
        }
      } else {
        ghToast("⚠️ سد ضد تخریب: دیتای محلی خالی است؛ پوش لغو شد تا دیتای سرور با خالی جایگزین نشود");
      }
      return {
        ok: false,
        blockedByGuard: true,
        message: "داده‌های محصولات در حافظه محلی خالی است در حالی که مخزن حاوی اطلاعات است؛ پوش لغو شد.",
      };
    }
  }

  if (invs.length === 0 && pfs.length === 0 && custs.length === 0 && prods.length === 0) {
    currentTask.fail("داده‌های محلی خالی است");
    if (!silent) {
      alert(
        "⛔ عملیات متوقف شد (سد امنیتی ضد تخریب)!\n\n" +
          "حافظه این مرورگر در حال حاضر خالی است.\n" +
          "اگر قصد بازیابی دارید، روی «⬇️ بازیابی از گیت‌هاب» بزنید.",
      );
    }
    return { ok: false, message: "داده‌های محلی خالی است؛ عملیات لغو شد." };
  }

  if (!silent) {
    const srvCount =
      (customSrv?.newCategories?.length || 0) +
      Object.keys(customSrv?.categoryOverrides || {}).length;

    const confirmMsg =
      "☁️ تأیید ارسال پشتیبان به گیت‌هاب:\n\n" +
      `آیا مطمئن هستید که می‌خواهید نسخه فعلی سیستم روی مخزن «${cfg.repo}» ذخیره شود؟\n\n` +
      `📊 اطلاعات:\n` +
      `• فاکتورها: ${invs.length} عدد\n` +
      `• پیش‌فاکتورها: ${pfs.length} عدد\n` +
      `• مشتریان: ${custs.length} نفر\n` +
      `• محصولات: ${prods.length} مورد\n` +
      `• دسته‌های محصولات: ${store.getProductCategories().length} مورد\n` +
      `• خدمات سفارشی: ${srvCount} مورد\n\n` +
      "برای تأیید، OK را بزنید.";

    if (!confirm(confirmMsg)) {
      currentTask.fail("عملیات لغو شد");
      return { ok: false, message: "لغو توسط کاربر" };
    }
  }

  try {
    currentTask.update(22, "آماده‌سازی فایل‌های پشتیبان...");
    const files = collectBackupFiles();
    const branch = cfg.branch || "main";

    let latestSha = null;
    let baseTree = null;
    currentTask.update(30, "واکشی شاخه اصلی...");
    try {
      const ref = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      latestSha = ref.object.sha;
      const lastCommit = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
        cfg,
      );
      baseTree = lastCommit.tree.sha;
    } catch {
      await gh(
        `/repos/${cfg.owner}/${cfg.repo}/contents/backup/init.json`,
        cfg,
        {
          method: "PUT",
          body: JSON.stringify({
            message: "🌱 راه‌اندازی پوشه بک‌آپ",
            content: toBase64(
              JSON.stringify(
                { initializedAt: new Date().toISOString() },
                null,
                2,
              ),
            ),
            branch,
          }),
        },
      );
      const ref = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      latestSha = ref.object.sha;
      const lastCommit = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
        cfg,
      );
      baseTree = lastCommit.tree.sha;
    }

    currentTask.update(35, "ارسال فایل‌های پشتیبان...");
    const treeItems = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const p = Math.round(35 + ((i + 1) / files.length) * 45);
      currentTask.update(p, `ارسال پشتیبان (${i + 1} از ${files.length})...`);
      const blob = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/blobs`, cfg, {
        method: "POST",
        body: JSON.stringify({
          content: toBase64(f.content),
          encoding: "base64",
        }),
      });
      treeItems.push({
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    // دریافت مجدد آخرین وضعیت شاخه جهت جلوگیری از تداخل و بازنویسی کامیت‌های کد
    try {
      const freshRef = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      if (freshRef?.object?.sha) {
        latestSha = freshRef.object.sha;
        const freshCommit = await gh(
          `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
          cfg,
        );
        if (freshCommit?.tree?.sha) {
          baseTree = freshCommit.tree.sha;
        }
      }
    } catch {}

    currentTask.update(82, "ایجاد ساختار درختی (Tree)...");
    const tree = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg, {
      method: "POST",
      body: JSON.stringify(
        baseTree
          ? { base_tree: baseTree, tree: treeItems }
          : { tree: treeItems },
      ),
    });

    currentTask.update(89, "ثبت کامیت در ریپازیتوری...");
    const message = `🤖 بک‌آپ خودکار: ${store.getInvoices().length} فاکتور، ${store.getProductCategories().length} دسته محصول — ${new Date().toLocaleString("fa-IR")}`;
    const commit = await gh(
      `/repos/${cfg.owner}/${cfg.repo}/git/commits`,
      cfg,
      {
        method: "POST",
        body: JSON.stringify(
          latestSha
            ? { message, tree: tree.sha, parents: [latestSha] }
            : { message, tree: tree.sha },
        ),
      },
    );

    currentTask.update(95, "نهایی‌سازی شاخه در گیت‌هاب...");
    if (latestSha) {
      await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${branch}`,
        cfg,
        {
          method: "PATCH",
          body: JSON.stringify({ sha: commit.sha, force: true }),
        },
      );
    } else {
      await gh(`/repos/${cfg.owner}/${cfg.repo}/git/refs`, cfg, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
      });
    }

    store.saveSettings({
      ...store.getSettings(),
      lastPush: { at: Date.now(), ok: true },
    });
    triggerLocalBackupOnPush();
    if (!task) currentTask.complete("پشتیبان‌گیری با موفقیت انجام شد ✅");
    if (!silent) alert("پشتیبان با موفقیت روی گیت‌هاب push شد ✅");
    return { ok: true, sha: commit.sha };
  } catch (err) {
    currentTask.fail(err.message);
    store.saveSettings({
      ...store.getSettings(),
      lastPush: { at: Date.now(), ok: false, error: err.message },
    });
    if (!silent) alert("push به گیت‌هاب ناموفق بود ❌\n" + err.message);
    return { ok: false, message: err.message };
  }
}

export async function pushToPublicRepo({
  silent = false,
  task = null,
  title = "ارسال به پورتال مشتری",
} = {}) {
  const currentTask = task || startPushTask(title, "بررسی اطلاعات پورتال مشتری...");
  const cfg = getPublicRepoConfig();

  if (!cfg.owner || !cfg.repo || !cfg.token) {
    currentTask.fail("تنظیمات ریپوی پابلیک ناقص است");
    if (!silent) {
      alert("ابتدا تنظیمات ریپوی پابلیک (مالک / ریپو / توکن) را کامل کنید.");
    }
    return { ok: false, message: "تنظیمات ریپوی پابلیک ناقص است" };
  }

  const prods = store.getProducts();

  currentTask.update(12, "بررسی سد ضد تخریب...");
  // 🛡️ سد امنیتی ضد تخریب ریپوی پابلیک: اگر لوکال خالی باشد و در ریپوی پابلیک دیتا باشد
  if (prods.length === 0) {
    const remoteData = await checkRemotePublicData(cfg);
    if (remoteData.hasData) {
      currentTask.fail("سد ضد تخریب: پوش لغو شد");
      if (!silent) {
        const shouldRestore = confirm(
          "⛔ عملیات متوقف شد (سد امنیتی ضد تخریب ریپوی پابلیک)!\n\n" +
            `حافظه این مرورگر فاقد اطلاعات محصول است، در حالی که در ریپوی پابلیک ${remoteData.productCount} محصول وجود دارد.\n` +
            "جهت محافظت از دیتای سایت مشتری و جلوگیری از جایگزین شدن دیتای خالی، ارسال لغو شد.\n\n" +
            "📥 آیا مایلید اطلاعات محصولات موجود در مخزن هم‌اکنون در این سیستم بازیابی شوند؟",
        );
        if (shouldRestore) {
          if (remoteData.products && remoteData.products.length > 0) {
            store.setProducts(remoteData.products);
          }
          if (remoteData.categories && remoteData.categories.length > 0) {
            store.setProductCategories(remoteData.categories);
          }
          if (typeof window.renderProducts === "function") window.renderProducts();
          if (typeof window.renderCategoryChips === "function") window.renderCategoryChips();
          alert("✅ اطلاعات محصولات با موفقیت از ریپوی پابلیک دریافت و ذخیره شد.");
        }
      } else {
        ghToast("⚠️ سد ضد تخریب: دیتای محلی خالی است؛ پوش پابلیک لغو شد تا دیتای سرور پاک نشود");
      }
      return {
        ok: false,
        blockedByGuard: true,
        message: "داده‌های محلی خالی است در حالی که مخزن پابلیک حاوی اطلاعات است؛ پوش لغو شد.",
      };
    } else {
      currentTask.fail("هیچ محصولی یافت نشد");
      if (!silent) {
        alert(
          "⚠️ هیچ محصولی در حافظه محلی برای ارسال وجود ندارد.\n\n" +
            "ابتدا در سیستم محصول تعریف کنید، سپس اقدام به ارسال نمایید.",
        );
      }
      return { ok: false, message: "هیچ محصولی در حافظه محلی یافت نشد." };
    }
  }

  if (!silent) {
    const ok = confirm(
      "🌐 تأیید ارسال اطلاعات به ریپوی پابلیک (سایت مشتری):\n\n" +
        "آیا مایلید اطلاعات محصولات، دسته‌بندی‌ها و خدمات روی سایت مشتری به‌روزرسانی شوند؟",
    );
    if (!ok) {
      currentTask.fail("عملیات لغو شد");
      return { ok: false, message: "لغو توسط کاربر" };
    }
  }

  if (!cfg.enabled && !cfg.repo) {
    if (!silent) {
      cfg.enabled = true;
      savePublicRepoConfig(cfg);
      const pubEnabledEl = document.getElementById("pub-gh-enabled");
      if (pubEnabledEl) pubEnabledEl.checked = true;
    } else {
      currentTask.fail("ریپوی پابلیک فعال نیست");
      return { ok: false, message: "ریپوی پابلیک فعال نیست" };
    }
  }

  try {
    currentTask.update(22, "آماده‌سازی فایل‌های عمومی...");
    const files = collectPublicFiles();
    const branch = cfg.branch || "main";

    let latestSha = null;
    let baseTree = null;
    let existingPaths = new Set();

    currentTask.update(30, "واکشی شاخه اصلی...");
    try {
      const ref = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      latestSha = ref.object.sha;
      const lastCommit = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
        cfg,
      );
      baseTree = lastCommit.tree.sha;

      try {
        const treeData = await gh(
          `/repos/${cfg.owner}/${cfg.repo}/git/trees/${baseTree}?recursive=1`,
          cfg,
        );
        if (Array.isArray(treeData?.tree)) {
          existingPaths = new Set(treeData.tree.map((t) => t.path));
        }
      } catch {}
    } catch {
      await gh(`/repos/${cfg.owner}/${cfg.repo}/contents/data/init.json`, cfg, {
        method: "PUT",
        body: JSON.stringify({
          message: "🌱 راه‌اندازی پوشه دیتا",
          content: toBase64(
            JSON.stringify(
              { initializedAt: new Date().toISOString() },
              null,
              2,
            ),
          ),
          branch,
        }),
      });

      const ref = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      latestSha = ref.object.sha;
      const lastCommit = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
        cfg,
      );
      baseTree = lastCommit.tree.sha;
    }

    currentTask.update(35, "ارسال داده‌های عمومی...");
    const treeItems = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const p = Math.round(35 + ((i + 1) / files.length) * 45);
      currentTask.update(p, `ارسال داده‌های عمومی (${i + 1} از ${files.length})...`);
      const blob = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/blobs`, cfg, {
        method: "POST",
        body: JSON.stringify({
          content: toBase64(f.content),
          encoding: "base64",
        }),
      });
      treeItems.push({
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    const privateFilesToDelete = [
      "data/customers.json",
      "data/invoices.json",
      "data/proformas.json",
      "backup/customers.json",
      "backup/invoices.json",
      "backup/proformas.json",
    ];

    for (const privPath of privateFilesToDelete) {
      if (existingPaths.has(privPath)) {
        treeItems.push({
          path: privPath,
          mode: "100644",
          type: "blob",
          sha: null,
        });
      }
    }

    // دریافت مجدد آخرین وضعیت شاخه جهت جلوگیری از تداخل و بازنویسی کامیت‌های کد
    try {
      const freshRef = await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
        cfg,
      );
      if (freshRef?.object?.sha) {
        latestSha = freshRef.object.sha;
        const freshCommit = await gh(
          `/repos/${cfg.owner}/${cfg.repo}/git/commits/${latestSha}`,
          cfg,
        );
        if (freshCommit?.tree?.sha) {
          baseTree = freshCommit.tree.sha;
        }
      }
    } catch {}

    currentTask.update(82, "ایجاد ساختار درختی (Tree)...");
    const tree = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg, {
      method: "POST",
      body: JSON.stringify(
        baseTree
          ? { base_tree: baseTree, tree: treeItems }
          : { tree: treeItems },
      ),
    });

    currentTask.update(89, "ثبت کامیت در ریپازیتوری...");
    const message = `📤 بروزرسانی محصولات و دسته‌بندی‌ها (عمومی) — ${new Date().toLocaleString("fa-IR")}`;
    const commit = await gh(
      `/repos/${cfg.owner}/${cfg.repo}/git/commits`,
      cfg,
      {
        method: "POST",
        body: JSON.stringify(
          latestSha
            ? { message, tree: tree.sha, parents: [latestSha] }
            : { message, tree: tree.sha },
        ),
      },
    );

    currentTask.update(95, "نهایی‌سازی شاخه عمومی...");
    if (latestSha) {
      await gh(
        `/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${branch}`,
        cfg,
        {
          method: "PATCH",
          body: JSON.stringify({ sha: commit.sha, force: true }),
        },
      );
    } else {
      await gh(`/repos/${cfg.owner}/${cfg.repo}/git/refs`, cfg, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
      });
    }

    store.saveSettings({
      ...store.getSettings(),
      lastPublicPush: { at: Date.now(), ok: true },
    });
    triggerLocalBackupOnPush();
    if (!task) currentTask.complete("پورتال مشتری با موفقیت به‌روزرسانی شد ✅");
    if (!silent) alert("اطلاعات با موفقیت روی ریپوی پابلیک push شد ✅");
    return { ok: true, sha: commit.sha };
  } catch (err) {
    currentTask.fail(err.message);
    store.saveSettings({
      ...store.getSettings(),
      lastPublicPush: { at: Date.now(), ok: false, error: err.message },
    });
    if (!silent) alert("push به ریپوی پابلیک ناموفق بود ❌\n" + err.message);
    return { ok: false, message: err.message };
  }
}

export async function testGitHubConnection() {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo)
    return alert("ابتدا مالک، ریپو و توکن ریپوی بک‌آپ را وارد کنید.");
  try {
    const repo = await gh(`/repos/${cfg.owner}/${cfg.repo}`, cfg);
    alert(
      `اتصال به ریپوی بک‌آپ موفق بود ✅\nریپو: ${repo.full_name}\nنوع: ${repo.private ? "خصوصی (Private)" : "عمومی (Public)"}\nشاخه پیش‌فرض: ${repo.default_branch}`,
    );
    return true;
  } catch (err) {
    alert("اتصال ناموفق ❌\n" + err.message);
    return false;
  }
}

export async function testPublicGitHubConnection() {
  const cfg = getPublicRepoConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    alert("ابتدا مالک، ریپو و توکن ریپوی پابلیک را وارد کنید.");
    return false;
  }
  try {
    const repo = await gh(`/repos/${cfg.owner}/${cfg.repo}`, cfg);
    const repoStatus = repo.private
      ? "خصوصی (Private) ⚠️"
      : "عمومی (Public) ✅";
    alert(
      `اتصال به ریپوی پابلیک موفق بود ✅\n` +
        `نام کامل ریپو: ${repo.full_name}\n` +
        `وضعیت دسترسی: ${repoStatus}\n` +
        `شاخه پیش‌فرض: ${repo.default_branch}`,
    );
    return true;
  } catch (err) {
    alert("اتصال به ریپوی پابلیک ناموفق بود ❌\n" + err.message);
    return false;
  }
}

export async function restoreFromGitHub({ replace = false } = {}) {
  const cfg = getGitHubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    return alert("ابتدا تنظیمات گیت‌هاب (مالک / ریپو / توکن) را کامل کن.");
  }

  try {
    const branch = encodeURIComponent(cfg.branch || "main");

    const readJson = async (path, repoCfg = cfg) => {
      try {
        return await fetchGitHubJson(repoCfg, path);
      } catch (err) {
        console.warn(`خطا در خواندن ${path}:`, err);
        return null;
      }
    };

    const invoices = await readJson("backup/invoices.json");
    const proformas = await readJson("backup/proformas.json");
    let products = await readJson("backup/products.json");
    let productCategories = await readJson("backup/product-categories.json"); // ✅ خواندن دسته‌های محصول از بک‌آپ
    let announcements = await readJson("backup/announcements.json"); // ✅ خواندن اخبار و اعلانات
    const shop = await readJson("backup/shop-info.json");
    const customers = await readJson("backup/customers.json");
    const customServices = await readJson("backup/custom-services.json");
    const services = await readJson("backup/services.json");

    // اگر در پوشه backup فایل محصولات یا دسته‌بندی‌ها نبود، از data/ بخوان
    if (!products || (Array.isArray(products) && products.length === 0)) {
      products = await readJson("data/products.json");
    }
    if (!productCategories || (Array.isArray(productCategories) && productCategories.length === 0)) {
      productCategories = await readJson("data/product-categories.json");
    }
    if (!announcements || (Array.isArray(announcements) && announcements.length === 0)) {
      announcements = await readJson("data/announcements.json");
    }

    // همچنین جهت اطمینان از بازیابی حداکثری، ریپوی عمومی را نیز بررسی و ادغام کن
    const pubCfg = getPublicRepoConfig();
    if (
      pubCfg.owner &&
      pubCfg.repo &&
      (pubCfg.repo.toLowerCase() !== cfg.repo.toLowerCase() ||
        pubCfg.owner.toLowerCase() !== cfg.owner.toLowerCase())
    ) {
      try {
        const pubProducts = await readJson("data/products.json", pubCfg);
        if (Array.isArray(pubProducts) && pubProducts.length > 0) {
          if (!Array.isArray(products) || products.length === 0) {
            products = pubProducts;
          } else {
            // ادغام امن بدون حذف: اگر محصولی در عمومی هست که در بک‌آپ نیست، اضافه شود
            const currentIds = new Set(products.map((p) => p.id));
            const missing = pubProducts.filter(
              (p) => p && p.id && !currentIds.has(p.id),
            );
            if (missing.length > 0) {
              products = [...products, ...missing];
            }
          }
        }
      } catch (_) {}

      try {
        if (
          !productCategories ||
          (Array.isArray(productCategories) && productCategories.length === 0)
        ) {
          const pubCats = await readJson("data/product-categories.json", pubCfg);
          if (Array.isArray(pubCats) && pubCats.length > 0) {
            productCategories = pubCats;
          }
        }
      } catch (_) {}
    }

    if (!invoices && !proformas && !products && !shop && !customServices && !services && !announcements) {
      return alert("هیچ فایل پشتیبانی در پوشه backup/ یا data/ مخزن پیدا نشد!");
    }

    const invCount = Array.isArray(invoices) ? invoices.length : 0;
    const pfCount = Array.isArray(proformas) ? proformas.length : 0;
    const prdCount = Array.isArray(products) ? products.length : 0;
    const pCatCount = Array.isArray(productCategories)
      ? productCategories.length
      : 0;
    const cstCount = Array.isArray(customers) ? customers.length : 0;
    const annCount = Array.isArray(announcements) ? announcements.length : 0;
    const srvCount =
      (customServices?.newCategories?.length || 0) +
      Object.keys(customServices?.categoryOverrides || {}).length;

    if (
      !confirm(
        `📥 بازیابی از گیت‌هاب:\n` +
          `• ${invCount} فاکتور\n` +
          `• ${pfCount} پیش‌فاکتور\n` +
          `• ${prdCount} محصول در ${pCatCount} دسته‌بندی\n` +
          `• ${cstCount} مشتری\n` +
          `• ${annCount} اعلان و خبر\n` +
          `• ${srvCount} دسته‌بندی و خدمات سفارشی\n\n` +
          `حالت بازیابی: ${replace ? "⚠️ جایگزینی کامل" : "➕ ادغام بدون تکراری"}\n` +
          `ادامه می‌دهید؟`,
      )
    )
      return;

    // بازیابی دسته‌بندی محصولات
    if (Array.isArray(productCategories)) {
      if (replace) {
        store.setProductCategories(productCategories);
      } else {
        const current = store.getProductCategories();
        const ids = new Set(current.map((c) => c.id));
        const added = productCategories.filter(
          (c) => c && c.id && !ids.has(c.id),
        );
        store.setProductCategories([...current, ...added]);
      }
    }

    // بازیابی اخبار و اعلانات
    if (Array.isArray(announcements)) {
      if (replace) {
        store.setAnnouncements(announcements);
      } else {
        const current = store.getAnnouncements();
        const ids = new Set(current.map((a) => a.id));
        const added = announcements.filter((a) => a && a.id && !ids.has(a.id));
        store.setAnnouncements([...current, ...added]);
      }
    }

    // بازیابی خدمات جدید و سفارشی
    if (customServices && typeof customServices === "object") {
      if (replace) {
        store.saveCustomServices(customServices);
      } else {
        const current = store.getCustomServices();
        const currentNewCatIds = new Set(
          (current.newCategories || []).map((c) => c.id),
        );
        const addedNewCats = (customServices.newCategories || []).filter(
          (c) => c && !currentNewCatIds.has(c.id),
        );
        const mergedNewCategories = [
          ...(current.newCategories || []),
          ...addedNewCats,
        ];
        const mergedOverrides = {
          ...(current.categoryOverrides || {}),
          ...(customServices.categoryOverrides || {}),
        };
        store.saveCustomServices({
          newCategories: mergedNewCategories,
          categoryOverrides: mergedOverrides,
        });
      }
    }

    // بازیابی مشتریان
    if (Array.isArray(customers)) {
      if (replace) {
        store.saveCustomers(customers);
      } else {
        const current = store.getCustomers();
        const phones = new Set(current.map((c) => c.phone).filter(Boolean));
        const added = customers.filter(
          (c) => c && (!c.phone || !phones.has(c.phone)),
        );
        store.saveCustomers([...current, ...added]);
      }
    }

    // بازیابی فاکتورها
    if (Array.isArray(invoices)) {
      if (replace) {
        store.setInvoices(invoices);
      } else {
        const current = store.getInvoices();
        const existing = new Set(current.map((i) => i.number));
        const added = invoices.filter((i) => i && !existing.has(i.number));
        store.setInvoices(
          [...current, ...added].sort((a, b) => b.number - a.number),
        );
      }
    }

    // بازیابی پیش‌فاکتورها
    if (Array.isArray(proformas)) {
      if (replace) {
        store.setProformas(proformas);
      } else {
        const current = store.getProformas();
        const existing = new Set(current.map((p) => p.number));
        const added = proformas.filter((p) => p && !existing.has(p.number));
        store.setProformas(
          [...current, ...added].sort((a, b) => b.number - a.number),
        );
      }
    }

    // بازیابی محصولات
    if (Array.isArray(products)) {
      if (replace) {
        store.setProducts(products);
      } else {
        const current = store.getProducts();
        const ids = new Set(current.map((p) => p.id));
        store.setProducts([
          ...current,
          ...products.filter((p) => p && !ids.has(p.id)),
        ]);
      }
    }

    // اطلاعات فروشگاه
    if (shop && typeof shop === "object") {
      store.saveShopInfo({ ...store.getShopInfo(), ...shop });
    }

    const maxNum = store
      .getInvoices()
      .reduce((m, i) => Math.max(m, i.number || 0), 0);
    if (maxNum > store.getCounter()) store.setCounter(maxNum);

    const maxPfNum = store
      .getProformas()
      .reduce((m, p) => Math.max(m, p.number || 0), 0);
    if (maxPfNum > store.getProformaCounter()) store.setProformaCounter(maxPfNum);

    alert("✅ بازیابی اطلاعات با موفقیت انجام شد. برنامه تازه می‌شود…");
    const u = new URL(window.location.href);
    u.searchParams.set("_reload", Date.now().toString());
    window.location.replace(u.toString());
  } catch (err) {
    alert("بازیابی از گیت‌هاب ناموفق بود ❌\n" + err.message);
  }
}

export function initGitHubUI() {
  const $ = (id) => document.getElementById(id);
  if (!$("gh-owner")) return;

  const backupCfg = getBackupRepoConfig();
  $("gh-owner").value = backupCfg.owner || "";
  $("gh-repo").value = backupCfg.repo || "";
  $("gh-branch").value = backupCfg.branch || "main";
  $("gh-token").value = backupCfg.token || "";
  $("gh-autopush").checked = backupCfg.autoPush !== false;

  const publicCfg = getPublicRepoConfig();
  const pubOwnerEl = $("pub-gh-owner");
  const pubRepoEl = $("pub-gh-repo");
  const pubBranchEl = $("pub-gh-branch");
  const pubTokenEl = $("pub-gh-token");
  const pubEnabledEl = $("pub-gh-enabled");

  if (pubOwnerEl) pubOwnerEl.value = publicCfg.owner || "";
  if (pubRepoEl) pubRepoEl.value = publicCfg.repo || "";
  if (pubBranchEl) pubBranchEl.value = publicCfg.branch || "main";
  if (pubTokenEl) pubTokenEl.value = publicCfg.token || "";
  if (pubEnabledEl) pubEnabledEl.checked = publicCfg.enabled === true;

  const updateStatus = () => {
    const s = store.getSettings().lastPush;
    const el = $("gh-status");
    if (!el) return;
    if (!s) {
      el.textContent = "هنوز هیچ پشتیبانی push نشده است.";
      el.className = "text-xs text-slate-400";
      return;
    }
    el.textContent = s.ok
      ? `✅ آخرین push موفق: ${new Date(s.at).toLocaleString("fa-IR")}`
      : `❌ آخرین push ناموفق: ${s.error || "خطای ناشناخته"}`;
    el.className = s.ok
      ? "text-xs text-emerald-500 dark:text-emerald-400 font-bold"
      : "text-xs text-rose-500 dark:text-rose-400 font-bold";
  };

  const updatePublicStatus = () => {
    const s = store.getSettings().lastPublicPush;
    const el = $("pub-gh-status");
    if (!el) return;
    if (!s) {
      el.textContent = "هنوز هیچ دیتایی به ریپوی پابلیک push نشده است.";
      el.className = "text-xs text-slate-400";
      return;
    }
    el.textContent = s.ok
      ? `✅ آخرین push موفق: ${new Date(s.at).toLocaleString("fa-IR")}`
      : `❌ آخرین push ناموفق: ${s.error || "خطای ناشناخته"}`;
    el.className = s.ok
      ? "text-xs text-emerald-500 dark:text-emerald-400 font-bold"
      : "text-xs text-rose-500 dark:text-rose-400 font-bold";
  };

  window.updatePublicStatusUI = updatePublicStatus;
  window.updateGitHubStatusUI = updateStatus;

  const readBackupFormConfig = () => ({
    owner: $("gh-owner").value.trim(),
    repo: $("gh-repo").value.trim(),
    branch: $("gh-branch").value.trim() || "main",
    token: $("gh-token").value.trim(),
    autoPush: $("gh-autopush").checked,
  });

  const readPublicFormConfig = () => ({
    owner: pubOwnerEl ? pubOwnerEl.value.trim() : "",
    repo: pubRepoEl ? pubRepoEl.value.trim() : "",
    branch: pubBranchEl ? pubBranchEl.value.trim() || "main" : "main",
    token: pubTokenEl ? pubTokenEl.value.trim() : "",
    enabled: pubEnabledEl ? pubEnabledEl.checked : false,
  });

  $("btn-gh-save").addEventListener("click", () => {
    saveBackupRepoConfig(readBackupFormConfig());
    updateStatus();
    alert("تنظیمات گیت‌هاب (بک‌آپ) ذخیره شد ✅");
  });

  $("btn-gh-test").addEventListener("click", async () => {
    saveBackupRepoConfig(readBackupFormConfig());
    await testGitHubConnection();
  });

  $("btn-gh-push").addEventListener("click", async () => {
    saveBackupRepoConfig(readBackupFormConfig());
    await pushBackupToGitHub({ title: "پشتیبان‌گیری دستی در گیت‌هاب" });
    updateStatus();
  });

  $("btn-gh-restore").addEventListener("click", async () => {
    saveBackupRepoConfig(readBackupFormConfig());
    await restoreFromGitHub({ replace: $("gh-restore-replace").checked });
  });

  const btnPubSave = $("btn-pub-gh-save");
  const btnPubTest = $("btn-pub-gh-test");
  const btnPubPush = $("btn-pub-gh-push");

  if (btnPubSave) {
    btnPubSave.addEventListener("click", () => {
      savePublicRepoConfig(readPublicFormConfig());
      updatePublicStatus();
      alert("تنظیمات ریپوی پابلیک ذخیره شد ✅");
    });
  }

  if (btnPubTest) {
    btnPubTest.addEventListener("click", async () => {
      savePublicRepoConfig(readPublicFormConfig());
      await testPublicGitHubConnection();
      updatePublicStatus();
    });
  }

  if (btnPubPush) {
    btnPubPush.addEventListener("click", async () => {
      const cfg = readPublicFormConfig();
      savePublicRepoConfig(cfg);
      await pushToPublicRepo({ title: "همگام‌سازی دستی پورتال مشتری" });
      updatePublicStatus();
    });
  }

  updateStatus();
  updatePublicStatus();
}
