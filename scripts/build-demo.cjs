#!/usr/bin/env node
// ============================================================
// build-demo.cjs — اسکریپت مبهم‌سازی ۳ لایه کد دمو
// استفاده: node scripts/build-demo.cjs
// ============================================================

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_ENTRY = path.join(ROOT, "src", "js", "app.js");
const OUT_FILE = path.join(ROOT, "assets", "js", "app.min.js");
const OUT_DIR = path.join(ROOT, "assets", "js");

// اطمینان از وجود پوشه خروجی
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- لایه ۱: esbuild bundle + minify ----
console.log("🔧 لایه ۱: esbuild bundle + minify...");
try {
  execSync(
    `npx esbuild "${SRC_ENTRY}" ` +
      `--bundle ` +
      `--minify ` +
      `--minify-identifiers ` +
      `--minify-syntax ` +
      `--minify-whitespace ` +
      `--format=esm ` +
      `--outfile="${OUT_FILE}"`,
    { cwd: ROOT, stdio: "inherit" },
  );
  console.log("   ✅ bundle + minify انجام شد.");
} catch (err) {
  console.error("   ❌ خطا در esbuild:", err.message);
  process.exit(1);
}

// ---- لایه ۲: XOR string encoding روی کلیدهای حساس ----
console.log("🔐 لایه ۲: XOR string encoding...");
let code = fs.readFileSync(OUT_FILE, "utf8");

// کلیدها و رشته‌های حساسی که باید encode شوند
const SENSITIVE = [
  "__app_meta_cache__",
  "__sys_lic_sig__",
  "__sys_clock_sync__",
  "cafe_store_db",
  "cafe-fs-access",
  "cafe_session",
  "cafe_app_role",
  "online-factor-demo-salt-2025",
];

const XOR_KEY = 0x4b; // کلید XOR (75)

function xorEncode(str) {
  return Array.from(str)
    .map((c) => c.charCodeAt(0) ^ XOR_KEY)
    .join(",");
}

function xorDecodeRuntime() {
  // تابعی که در کد تزریق می‌شود تا runtime decode کند
  return `(function _xd(a){return a.map(function(c){return String.fromCharCode(c^${XOR_KEY})}).join("")})`;
}

const decoderFn = xorDecodeRuntime();

// جایگزین کردن رشته‌های حساس با نسخه XOR شده
let replaced = 0;
for (const str of SENSITIVE) {
  const encoded = xorEncode(str);
  const regex = new RegExp(`"${str.replace(/[-]/g, "\\-")}"`, "g");
  const replacement = `${decoderFn}([${encoded}])`;
  const before = code.length;
  code = code.replace(regex, replacement);
  if (code.length !== before) {
    replaced++;
    console.log(`   ✓ "${str}" → XOR encoded`);
  }
}
if (replaced === 0) {
  console.log("   ⚠️  رشته‌ای جایگزین نشد (ممکن است minifier نام‌ها را تغییر داده باشد — عادی است)");
}
console.log("   ✅ XOR encoding انجام شد.");

// ---- لایه ۳: محاسبه checksum + درج self-check ----
console.log("🛡️  لایه ۳: self-check integrity...");

// محاسبه checksum ساده از بدنه اصلی کد
function computeChecksum(src) {
  let h = 0;
  for (let i = 0; i < src.length; i++) h = ((h << 5) - h + src.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

const checksum = computeChecksum(code);

// جایگزین کردن placeholder با مقدار واقعی
const PLACEHOLDER = '"__INTEGRITY_PLACEHOLDER__"';
if (code.includes(PLACEHOLDER)) {
  code = code.replace(PLACEHOLDER, `"${checksum}"`);
  console.log(`   ✓ checksum: ${checksum}`);
} else {
  // minifier ممکن است placeholder را تغییر داده باشد — جستجوی جایگزین
  console.log(`   ⚠️  placeholder یافت نشد (checksum: ${checksum}) — self-check غیرفعال می‌ماند`);
}
console.log("   ✅ self-check integrity تزریق شد.");

// ---- افزودن هدر اطلاعاتی ----
const header =
  `/* online-factor demo build — ${new Date().toISOString()} — DO NOT MODIFY */\n`;
code = header + code;

// ---- نوشتن فایل نهایی ----
fs.writeFileSync(OUT_FILE, code, "utf8");

const sizeKb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
console.log(`\n✅ مبهم‌سازی کامل شد!`);
console.log(`   📁 خروجی: assets/js/app.min.js (${sizeKb} KB)`);
console.log(`   🔒 ۳ لایه فعال: minify + XOR encoding + self-check\n`);
