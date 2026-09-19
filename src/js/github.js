import { store } from "./store.js";
import { autoSaveInvoices } from "./backup.js";

const API = "https://api.github.com";

export function getBackupRepoConfig() {
  const s = store.getSettings();
  return (
    s.backupRepo || {
      owner: "",
      repo: "",
      branch: "main",
      token: "",
      autoPush: true,
    }
  );
}

export function getPublicRepoConfig() {
  const s = store.getSettings();
  return (
    s.publicRepo || {
      owner: "",
      repo: "",
      branch: "main",
      token: "",
      enabled: false,
    }
  );
}

/* ---------- push خودکار به ریپوی پابلیک با debounce ---------- */
let publicPushTimer = null;
export function autoPushPublicRepo() {
  const cfg = getPublicRepoConfig();
  if (!cfg.enabled || !cfg.token || !cfg.owner || !cfg.repo) return;
  clearTimeout(publicPushTimer);
  publicPushTimer = setTimeout(async () => {
    await pushToPublicRepo({ silent: true });
    if (typeof window.updatePublicStatusUI === "function") {
      window.updatePublicStatusUI();
    }
  }, 1500);
}

/* ---------- همگام‌سازی یکپارچه تمام حافظه‌ها (لوکال + گیت‌هاب خصوصی و عمومی) ---------- */
export function syncAllStorages() {
  autoSaveInvoices();
  autoPushGitHub();
  autoPushPublicRepo();
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
  return btoa(unescape(encodeURIComponent(str)));
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

/* ---------- فایل‌های پشتیبان ریپوی پرایوت ---------- */
function collectBackupFiles() {
  return [
    {
      path: "backup/invoices.json",
      content: JSON.stringify(store.getInvoices(), null, 2),
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
          productCount: store.getProducts().length,
          productCategoryCount: store.getProductCategories().length,
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

export async function pushBackupToGitHub({ silent = false } = {}) {
  const cfg = getGitHubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    if (!silent)
      alert("ابتدا تنظیمات گیت‌هاب (مالک / ریپو / توکن) را کامل کنید.");
    return { ok: false };
  }

  const invs = store.getInvoices();
  const custs = store.getCustomers();
  const prods = store.getProducts();
  const customSrv = store.getCustomServices();

  if (invs.length === 0 && custs.length === 0 && prods.length === 0) {
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
      `• مشتریان: ${custs.length} نفر\n` +
      `• محصولات: ${prods.length} مورد\n` +
      `• دسته‌های محصولات: ${store.getProductCategories().length} مورد\n` +
      `• خدمات سفارشی: ${srvCount} مورد\n\n` +
      "برای تأیید، OK را بزنید.";

    if (!confirm(confirmMsg)) return { ok: false, message: "لغو توسط کاربر" };
  }

  try {
    const files = collectBackupFiles();
    const branch = cfg.branch || "main";

    let latestSha = null;
    let baseTree = null;
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

    const treeItems = [];
    for (const f of files) {
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

    const tree = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg, {
      method: "POST",
      body: JSON.stringify(
        baseTree
          ? { base_tree: baseTree, tree: treeItems }
          : { tree: treeItems },
      ),
    });

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
    if (!silent) alert("پشتیبان با موفقیت روی گیت‌هاب push شد ✅");
    return { ok: true, sha: commit.sha };
  } catch (err) {
    store.saveSettings({
      ...store.getSettings(),
      lastPush: { at: Date.now(), ok: false, error: err.message },
    });
    if (!silent) alert("push به گیت‌هاب ناموفق بود ❌\n" + err.message);
    return { ok: false, message: err.message };
  }
}

let pushTimer = null;
export function autoPushGitHub() {
  const cfg = getBackupRepoConfig();
  if (!cfg.autoPush || !cfg.token || !cfg.owner || !cfg.repo) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushBackupToGitHub({ silent: true }), 1500);
}

export async function pushToPublicRepo({ silent = false } = {}) {
  const cfg = getPublicRepoConfig();

  if (!cfg.owner || !cfg.repo || !cfg.token) {
    if (!silent) {
      alert("ابتدا تنظیمات ریپوی پابلیک (مالک / ریپو / توکن) را کامل کنید.");
    }
    return { ok: false, message: "تنظیمات ریپوی پابلیک ناقص است" };
  }

  if (!silent) {
    const ok = confirm(
      "🌐 تأیید ارسال اطلاعات به ریپوی پابلیک (سایت مشتری):\n\n" +
        "آیا مایلید اطلاعات محصولات، دسته‌بندی‌ها و خدمات روی سایت مشتری به‌روزرسانی شوند؟",
    );
    if (!ok) return { ok: false, message: "لغو توسط کاربر" };
  }

  if (!cfg.enabled) {
    if (!silent) {
      cfg.enabled = true;
      savePublicRepoConfig(cfg);
      const pubEnabledEl = document.getElementById("pub-gh-enabled");
      if (pubEnabledEl) pubEnabledEl.checked = true;
    } else {
      return { ok: false, message: "ریپوی پابلیک فعال نیست" };
    }
  }

  try {
    const files = collectPublicFiles();
    const branch = cfg.branch || "main";

    let latestSha = null;
    let baseTree = null;
    let existingPaths = new Set();

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

    const treeItems = [];
    for (const f of files) {
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
      "backup/customers.json",
      "backup/invoices.json",
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

    const tree = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg, {
      method: "POST",
      body: JSON.stringify(
        baseTree
          ? { base_tree: baseTree, tree: treeItems }
          : { tree: treeItems },
      ),
    });

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
    if (!silent) alert("اطلاعات با موفقیت روی ریپوی پابلیک push شد ✅");
    return { ok: true, sha: commit.sha };
  } catch (err) {
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

function fromBase64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function restoreFromGitHub({ replace = false } = {}) {
  const cfg = getGitHubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    return alert("ابتدا تنظیمات گیت‌هاب (مالک / ریپو / توکن) را کامل کن.");
  }

  try {
    const branch = encodeURIComponent(cfg.branch || "main");

    const readJson = async (path) => {
      try {
        const res = await gh(
          `/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${branch}`,
          cfg,
        );
        return JSON.parse(fromBase64(res.content));
      } catch {
        return null;
      }
    };

    const invoices = await readJson("backup/invoices.json");
    const products = await readJson("backup/products.json");
    const productCategories = await readJson("backup/product-categories.json"); // ✅ خواندن دسته‌های محصول از بک‌آپ
    const shop = await readJson("backup/shop-info.json");
    const customers = await readJson("backup/customers.json");
    const customServices = await readJson("backup/custom-services.json");
    const services = await readJson("backup/services.json");

    if (!invoices && !products && !shop && !customServices && !services) {
      return alert("هیچ فایل پشتیبانی در پوشه backup/ مخزن پیدا نشد!");
    }

    const invCount = Array.isArray(invoices) ? invoices.length : 0;
    const prdCount = Array.isArray(products) ? products.length : 0;
    const pCatCount = Array.isArray(productCategories)
      ? productCategories.length
      : 0;
    const cstCount = Array.isArray(customers) ? customers.length : 0;
    const srvCount =
      (customServices?.newCategories?.length || 0) +
      Object.keys(customServices?.categoryOverrides || {}).length;

    if (
      !confirm(
        `📥 بازیابی از گیت‌هاب:\n` +
          `• ${invCount} فاکتور\n` +
          `• ${prdCount} محصول در ${pCatCount} دسته‌بندی\n` +
          `• ${cstCount} مشتری\n` +
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

    alert("✅ بازیابی اطلاعات با موفقیت انجام شد. برنامه تازه می‌شود…");
    location.reload();
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
    await pushBackupToGitHub();
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
      await pushToPublicRepo();
      updatePublicStatus();
    });
  }

  updateStatus();
  updatePublicStatus();
}
