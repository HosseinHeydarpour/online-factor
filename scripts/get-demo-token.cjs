#!/usr/bin/env node
// ============================================================
// اسکریپت تولید توکن دمو اختصاصی با تاریخ انقضای امضاشده (غیرقابل ریست)
// استفاده:
//   node scripts/get-demo-token.cjs [url] [مدت]
// مثال‌ها:
//   node scripts/get-demo-token.cjs "http://localhost:3000/" 2d    # ۲ روز (پیش‌فرض)
//   node scripts/get-demo-token.cjs "http://localhost:3000/" 10s   # ۱۰ ثانیه (برای تست)
//   node scripts/get-demo-token.cjs "http://localhost:3000/" 12h   # ۱۲ ساعت
// ============================================================

const SALT = "online-factor-demo-salt-2025";

// تبدیل ورودی مدت زمان به میلی‌ثانیه
function parseDuration(input = "2d") {
  const match = String(input).trim().match(/^(\d+(?:\.\d+)?)\s*([smhd]?)$/i);
  if (!match) return 2 * 24 * 60 * 60 * 1000;
  const num = parseFloat(match[1]);
  const unit = (match[2] || "d").toLowerCase();
  switch (unit) {
    case "s":
      return Math.round(num * 1000);
    case "m":
      return Math.round(num * 60 * 1000);
    case "h":
      return Math.round(num * 60 * 60 * 1000);
    case "d":
    default:
      return Math.round(num * 24 * 60 * 60 * 1000);
  }
}

// هش امضای تاریخ انقضا (Unsigned 32-bit hex)
function hashExpiry(expBase36) {
  let h = 5381;
  const s = String(expBase36) + SALT;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  let h2 = 52711;
  for (let i = s.length - 1; i >= 0; i--)
    h2 = ((h2 << 5) + h2 + s.charCodeAt(i)) >>> 0;
  return ((h ^ h2) >>> 0).toString(16).padStart(8, "0");
}

function createToken(durationMs) {
  const now = Date.now();
  const expMs = now + durationMs;
  const expBase36 = expMs.toString(36);
  const sig = hashExpiry(expBase36);
  return {
    token: `${expBase36}-${sig}`,
    expMs,
    expDate: new Date(expMs),
  };
}

const baseUrl = process.argv[2] || "http://localhost:3000/";
const durationArg = process.argv[3] || "2d";
const durationMs = parseDuration(durationArg);

const { token, expDate } = createToken(durationMs);

let fullUrl;
try {
  const u = new URL(baseUrl);
  u.searchParams.set("demo", token);
  fullUrl = u.toString();
} catch {
  fullUrl = `${baseUrl}?demo=${token}`;
}

const faDate = expDate.toLocaleString("fa-IR", {
  dateStyle: "full",
  timeStyle: "medium",
});

console.log("\n🔑 لینک دمو اختصاصی تولید شد (با انقضای قطعی و ضدریست):");
console.log("─".repeat(60));
console.log(`⏱️  مدت اعتبار:   ${durationArg}`);
console.log(`🔐 توکن امضاشده: ${token}`);
console.log(`⏰ موعد انقضا:   ${faDate}`);
console.log(`🔗 لینک مشتری:   ${fullUrl}`);
console.log("─".repeat(60));
console.log("🛡️  ویژگی ضدریست:");
console.log("   تاریخ انقضا در خود توکن رمزنگاری و امضا شده است.");
console.log("   پس از این تاریخ، این لینک برای همیشه می‌سوزد و حتی با");
console.log("   پاک کردن کش یا باز کردن در مرورگر دیگر، قابل استفاده نیست.\n");
