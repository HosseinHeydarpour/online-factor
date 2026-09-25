// ============================================================
// DEMO GUARD — online-factor
// سیستم محافظت دمو با تاریخ انقضای امضاشده (غیرقابل ریست)
// این فایل قبل از deploy با npm run build:demo مبهم‌سازی می‌شود
// ============================================================

// کلیدهای ذخیره‌سازی محلی با نام‌های گمراه‌کننده سیستمی
const _DK = "__app_meta_cache__";       // ذخیره متادیتای فعال دمو
const _POISON_KEY = "__sys_lic_sig__";   // مهر سنگ‌قبر انقضای دائم (جهت جلوگیری از ریست)
const _CLOCK_KEY = "__sys_clock_sync__"; // آخرین زمان دیده شده (ضد عقب کشیدن ساعت)

// نمک رمزنگاری توکن — در زمان obfuscation به بایت‌های پنهان تبدیل می‌شود
const _S = [
  0x6f, 0x6e, 0x6c, 0x69, 0x6e, 0x65, 0x2d, 0x66, 0x61, 0x63, 0x74, 0x6f, 0x72,
  0x2d, 0x64, 0x65, 0x6d, 0x6f, 0x2d, 0x73, 0x61, 0x6c, 0x74, 0x2d, 0x32, 0x30,
  0x32, 0x35,
]
  .map((c) => String.fromCharCode(c))
  .join("");

// هش djb2 ترکیبی برای امضای زمان انقضا (Unsigned 32-bit hex)
function _h(str) {
  let h = 5381;
  const s = String(str) + _S;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  let h2 = 52711;
  for (let i = s.length - 1; i >= 0; i--)
    h2 = ((h2 << 5) + h2 + s.charCodeAt(i)) >>> 0;
  return ((h ^ h2) >>> 0).toString(16).padStart(8, "0");
}

/**
 * اعتبارسنجی توکن امضاشده
 * فرمت: <expBase36>-<sigHex>
 * @returns {number|null} زمان انقضا به ms در صورت معتبر بودن، در غیر این صورت null
 */
function _verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const idx = token.indexOf("-");
  if (idx <= 0) return null;
  const expPart = token.slice(0, idx);
  const sigPart = token.slice(idx + 1);
  if (!expPart || !sigPart) return null;

  // بررسی صحت امضا
  if (_h(expPart) !== sigPart) return null;

  const expMs = parseInt(expPart, 36);
  if (!expMs || isNaN(expMs)) return null;

  return expMs;
}

// خواندن وضعیت کوکی برای جلوگیری از ریست
function _getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function _setCookie(name, val, days = 365) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(val)};expires=${d.toUTCString()};path=/;SameSite=Strict`;
  } catch {}
}

// بررسی سوخته بودن این توکن مشخص (Token Burn Blacklist)
function _isTokenBurned(expMs) {
  if (!expMs) return false;
  const key = `burn_${expMs.toString(36)}`;
  try {
    if (localStorage.getItem(key) === "1") return true;
  } catch {}
  const c = _getCookie(key);
  if (c === "1") return true;
  return false;
}

// ثبت این توکن در لیست سیاه دائمی توکن‌های سوخته
function _markTokenBurned(expMs) {
  if (!expMs) return;
  const key = `burn_${expMs.toString(36)}`;
  try { localStorage.setItem(key, "1"); } catch {}
  _setCookie(key, "1", 730);
}

// بررسی عقب کشیدن ساعت سیستم
function _checkClockTampering(now) {
  try {
    const lastStr = localStorage.getItem(_CLOCK_KEY) || _getCookie(_CLOCK_KEY);
    if (lastStr) {
      const lastSeen = parseInt(lastStr, 36);
      // اگر ساعت سیستم بیش از ۲ دقیقه عقب برده شده باشد
      if (!isNaN(lastSeen) && now < lastSeen - 120000) {
        return true; // ساعت دستکاری شده
      }
    }
    // بروزرسانی آخرین زمان مجاز
    const nowB36 = now.toString(36);
    localStorage.setItem(_CLOCK_KEY, nowB36);
    _setCookie(_CLOCK_KEY, nowB36, 30);
  } catch {}
  return false;
}

// ---- پاک‌سازی امن کلیه اطلاعات کاربر ----
async function _purgeAll(expMs = Date.now()) {
  // ثبت توکن در لیست سیاه توکن‌های سوخته
  _markTokenBurned(expMs);

  // sessionStorage
  try { sessionStorage.clear(); } catch {}

  // localStorage — پاک کردن همه دیتای کسب‌وکار بدون پاک کردن لیست سیاه
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach((k) => {
      if (!k.startsWith("burn_") && k !== _CLOCK_KEY) {
        try { localStorage.removeItem(k); } catch {}
      }
    });
  } catch {}

  // IndexedDB — پاک کردن دیتابیس‌های اصلی برنامه
  const dbs = ["cafe_store_db", "cafe-fs-access"];
  for (const name of dbs) {
    try {
      await new Promise((res) => {
        const r = indexedDB.deleteDatabase(name);
        r.onsuccess = res;
        r.onerror = res;
        r.onblocked = res;
      });
    } catch {}
  }
}

// ---- مسدودسازی دسترسی به ابزارهای تحلیل (DevTools) ----
function _blockDevTools(e) {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key === "U") ||
    (e.metaKey && e.altKey && ["I", "J", "C"].includes(e.key.toUpperCase()))
  ) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}

// ---- نمایش صفحه انقضا ----
let _liveInterval = null;

function _showExpiredScreen() {
  if (_liveInterval) {
    clearInterval(_liveInterval);
    _liveInterval = null;
  }
  const banner = document.getElementById("demo-banner");
  if (banner) banner.style.display = "none";
  document.body.style.paddingTop = "0px";

  const el = document.getElementById("demo-expired-overlay");
  if (el) {
    el.style.display = "flex";
  }
  // بستن تمام ورودی‌ها و تعاملات
  document.body.style.overflow = "hidden";
  document.body.style.pointerEvents = "none";
  if (el) el.style.pointerEvents = "all";
  document.addEventListener("keydown", _blockDevTools, true);
  document.addEventListener("contextmenu", (e) => e.preventDefault(), true);
}

// فرمت‌کننده زمان هوشمند
function _formatRemain(remainMs) {
  const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  if (remainMs <= 0) return "پایان یافته";

  const sec = Math.ceil(remainMs / 1000);
  if (sec < 60) {
    return `${fa(sec)} ثانیه`;
  }

  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) {
    return remSec > 0 ? `${fa(min)} دقیقه و ${fa(remSec)} ثانیه` : `${fa(min)} دقیقه`;
  }

  const hours = Math.floor(min / 60);
  const remMin = min % 60;
  if (hours < 24) {
    return remMin > 0 ? `${fa(hours)} ساعت و ${fa(remMin)} دقیقه` : `${fa(hours)} ساعت`;
  }

  const days = Math.ceil(hours / 24);
  return `${fa(days)} روز`;
}

// ---- نمایش نوار دمو با تایمر زنده شمارش معکوس ----
function _showDemoBanner(expMs) {
  const banner = document.getElementById("demo-banner");
  const countdown = document.getElementById("demo-countdown");
  if (!banner) return;

  const update = async () => {
    const now = Date.now();
    // بررسی دستکاری ساعت
    if (_checkClockTampering(now)) {
      if (_liveInterval) clearInterval(_liveInterval);
      await _purgeAll(expMs);
      _showExpiredScreen();
      return;
    }

    const remainMs = expMs - now;
    if (remainMs <= 0) {
      if (_liveInterval) clearInterval(_liveInterval);
      await _purgeAll(expMs);
      _showExpiredScreen();
      return;
    }
    if (countdown) {
      countdown.textContent = _formatRemain(remainMs);
    }
  };

  banner.style.display = "flex";
  document.body.style.paddingTop = "42px";
  update();

  if (_liveInterval) clearInterval(_liveInterval);
  _liveInterval = setInterval(update, 1000);
}

// ---- بررسی یکپارچگی (self-check layer 3) ----
const _INTEGRITY_CHECK = "__INTEGRITY_PLACEHOLDER__";

function _checkIntegrity() {
  if (_INTEGRITY_CHECK === "__INTEGRITY_PLACEHOLDER__") return true;
  try {
    let h = 0;
    const fn = initDemoGuard.toString();
    for (let i = 0; i < fn.length; i++)
      h = ((h << 5) - h + fn.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16) === _INTEGRITY_CHECK;
  } catch {
    return false;
  }
}

// ---- نقطه ورود اصلی ----
/**
 * بررسی وضعیت دمو و اعمال محدودیت‌ها
 * @returns {Promise<false|true|"expired">}
 *   false   → دمو فعال نیست (اجرای عادی)
 *   true    → دمو فعال و معتبر
 *   "expired" → منقضی شده (UI قفل شد)
 */
export async function initDemoGuard() {
  // لایه ۳: self-check یکپارچگی کد
  if (!_checkIntegrity()) {
    await _purgeAll();
    _showExpiredScreen();
    return "expired";
  }

  const now = Date.now();

  // ۱. بررسی دستکاری ساعت سیستم (Anti Clock Tamper)
  if (_checkClockTampering(now)) {
    await _purgeAll();
    _showExpiredScreen();
    return "expired";
  }

  // ۲. بررسی پارامتر توکن در URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get("demo");

  if (urlToken) {
    const verifiedExpMs = _verifyToken(urlToken);
    if (verifiedExpMs !== null) {
      // الف: بررسی اینکه آیا تاریخ این توکن همین حالا گذشته یا سوخته است؟
      if (now >= verifiedExpMs || _isTokenBurned(verifiedExpMs)) {
        // توکن منقضی یا سوخته است — اجازه شروع مجدد به هیچ وجه داده نمی‌شود!
        await _purgeAll(verifiedExpMs);
        _showExpiredScreen();
        return "expired";
      }

      // ب: توکن معتبر و زمان‌دار است — ذخیره زمان انقضا در سیستم
      const record = {
        exp: verifiedExpMs,
        sig: _h(verifiedExpMs.toString(36)),
      };
      try {
        localStorage.setItem(_DK, btoa(JSON.stringify(record)));
      } catch {}

      // فعال‌سازی مسدودساز کلیدهای DevTools
      document.addEventListener("keydown", _blockDevTools, true);
      document.addEventListener("contextmenu", (e) => e.preventDefault(), true);

      // تمیز کردن URL بدون رفرش
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete("demo");
        history.replaceState(null, "", u.toString());
      } catch {}
    }
  }

  // ۳. بررسی وضعیت دمو ذخیره‌شده در سیستم
  let expMs = null;
  const raw = localStorage.getItem(_DK);
  if (raw) {
    try {
      const parsed = JSON.parse(atob(raw));
      if (parsed && parsed.exp && parsed.sig) {
        if (_h(parsed.exp.toString(36)) === parsed.sig) {
          expMs = parsed.exp;
        }
      }
    } catch {}
  }

  // اگر وضعیت دمو ذخیره‌شده‌ای وجود ندارد → حالت عادی (غیر دمو)
  if (!expMs) {
    return false;
  }

  // ۴. بررسی انقضای زمانی دمو
  if (now >= expMs || _isTokenBurned(expMs)) {
    // دوره دمو پایان یافته است
    await _purgeAll(expMs);
    _showExpiredScreen();
    return "expired";
  }

  // دمو معتبر است — فعال‌سازی نوار و تایمر زنده
  document.addEventListener("keydown", _blockDevTools, true);
  document.addEventListener("contextmenu", (e) => e.preventDefault(), true);
  _showDemoBanner(expMs);
  return true;
}
