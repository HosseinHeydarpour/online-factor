import { store } from "./store.js";

const API = "https://api.github.com";

// تنظیمات ریپوی بک‌آپ (خصوصی)
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

// تنظیمات ریپوی پابلیک (سایت مشتری)
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

export function saveBackupRepoConfig(cfg) {
  store.saveSettings({ ...store.getSettings(), backupRepo: cfg });
}

export function savePublicRepoConfig(cfg) {
  store.saveSettings({ ...store.getSettings(), publicRepo: cfg });
}

// برای سازگاری با کدهای قدیمی
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

// base64 با پشتیبانی از کاراکترهای یونیکد (فارسی)
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

/* ---------- فایل‌های پشتیبان ریپوی پرایوت (شامل فایل مجزای دیتای جدید) ---------- */
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
      path: "backup/customers.json",
      content: JSON.stringify(store.getCustomers(), null, 2),
    },
    {
      path: "backup/shop-info.json",
      content: JSON.stringify(store.getShopInfo(), null, 2),
    },
    {
      // ✅ فایل دیتای جدید خدمات به صورت مجزا
      path: "backup/custom-services.json",
      content: JSON.stringify(store.getCustomServices(), null, 2),
    },
    {
      // ✅ کل دیتای ادغام‌شده خدمات
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
      path: "data/shop-info.json",
      content: JSON.stringify(store.getShopInfo(), null, 2),
    },
    {
      // ✅ فایل دیتای جدید خدمات در ریپوی پابلیک
      path: "data/custom-services.json",
      content: JSON.stringify(store.getCustomServices(), null, 2),
    },
    {
      // ✅ کل دیتای ادغام‌شده در ریپوی پابلیک
      path: "data/services.json",
      content: JSON.stringify(store.getServices(), null, 2),
    },
    {
      path: "data/meta.json",
      content: JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          productCount: store.getProducts().length,
        },
        null,
        2,
      ),
    },
  ];
}
/* ---------- push کامل با یک کامیت (Git Data API) به ریپوی خصوصی ---------- */
export async function pushBackupToGitHub({ silent = false } = {}) {
  const cfg = getGitHubConfig();
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    if (!silent)
      alert("ابتدا تنظیمات گیت‌هاب (مالک / ریپو / توکن) را کامل کن.");
    return { ok: false };
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

    const message = `🤖 بک‌آپ خودکار: ${store.getInvoices().length} فاکتور — ${new Date().toLocaleString("fa-IR")}`;
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

/* ---------- push خودکار با debounce ---------- */
let pushTimer = null;
export function autoPushGitHub() {
  const cfg = getBackupRepoConfig();
  if (!cfg.autoPush || !cfg.token || !cfg.owner || !cfg.repo) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushBackupToGitHub({ silent: true }), 1500);
}

/* ---------- push به ریپوی پابلیک (سایت مشتری - امن و فاقد اطلاعات خصوصی) ---------- */
export async function pushToPublicRepo({ silent = false } = {}) {
  const cfg = getPublicRepoConfig();

  if (!cfg.owner || !cfg.repo || !cfg.token) {
    if (!silent) {
      alert("ابتدا تنظیمات ریپوی پابلیک (مالک / ریپو / توکن) را کامل کنید.");
    }
    return { ok: false, message: "تنظیمات ریپوی پابلیک ناقص است" };
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
    // فقط فایل‌های عمومی جمع‌آوری می‌شوند
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

      // دریافت لیست فایل‌های موجود برای پاک کردن فایل‌های حساس قبلی
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

    // ۱) ایجاد blob فایل‌های عمومی
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

    // ۲) حذف خودکار فایل‌های حساس (customers و invoices) اگر قبلاً در ریپوی پابلیک پوش شده باشند
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
          sha: null, // این شناسه در گیت فایل را از درخت کامیت حذف می‌کند
        });
      }
    }

    // ۳) ایجاد درخت گیت جدید
    const tree = await gh(`/repos/${cfg.owner}/${cfg.repo}/git/trees`, cfg, {
      method: "POST",
      body: JSON.stringify(
        baseTree
          ? { base_tree: baseTree, tree: treeItems }
          : { tree: treeItems },
      ),
    });

    // ۴) ساخت کامیت عمومی
    const message = `📤 بروزرسانی اطلاعات و محصولات (عمومی) — ${new Date().toLocaleString("fa-IR")}`;
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

    // ۵) آپدیت رفرنس شاخه
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
    if (!silent) alert("اطلاعات عمومی با موفقیت روی ریپوی پابلیک push شد ✅");
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

/* ---------- تست اتصال ریپوی بک‌آپ ---------- */
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

/* ---------- تست اتصال ریپوی پابلیک ---------- */
export async function testPublicGitHubConnection() {
  const cfg = getPublicRepoConfig();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    alert("ابتدا مالک، ریپو و توکن ریپوی پابلیک را وارد کنید.");
    return false;
  }
  try {
    const repo = await gh(`/repos/${cfg.owner}/${cfg.repo}`, cfg);
    const repoStatus = repo.private
      ? "خصوصی (Private) ⚠️ توجه: اگر ریپو خصوصی باشد مشتری بدون لاگین به آن دسترسی نخواهد داشت!"
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

// base64 → متن یونیکد‌امن (فارسی)
function fromBase64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* ---------- بازیابی (Pull) از گیت‌هاب ---------- */
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
    const shop = await readJson("backup/shop-info.json");
    const customers = await readJson("backup/customers.json");

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

    if (!invoices && !products && !shop) {
      return alert("هیچ فایل پشتیبانی در پوشه backup/ مخزن پیدا نشد!");
    }

    const invCount = Array.isArray(invoices) ? invoices.length : 0;
    const prdCount = Array.isArray(products) ? products.length : 0;
    const cstCount = Array.isArray(customers) ? customers.length : 0;

    if (
      !confirm(
        `📥 بازیابی از گیت‌هاب:\n` +
          `${invCount} فاکتور، ${prdCount} محصول و ${cstCount} مشتری در مخزن یافت شد.\n\n` +
          `حالت بازیابی: ${replace ? "⚠️ جایگزینی کامل" : "➕ ادغام بدون تکراری"}\n` +
          `ادامه می‌دهید؟`,
      )
    )
      return;

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

    if (shop && typeof shop === "object") {
      store.saveShopInfo({ ...store.getShopInfo(), ...shop });
    }

    const maxNum = store
      .getInvoices()
      .reduce((m, i) => Math.max(m, i.number || 0), 0);
    if (maxNum > store.getCounter()) store.setCounter(maxNum);

    alert("✅ بازیابی با موفقیت انجام شد. برنامه تازه‌سازی می‌شود…");
    location.reload();
  } catch (err) {
    alert("بازیابی از گیت‌هاب ناموفق بود ❌\n" + err.message);
  }
}

/* ---------- UI تنظیمات گیت‌هاب ---------- */
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
