// src/js/image-utils.js
// ماژول بهینه‌سازی، تغییر اندازه و فشرده‌سازی خودکار تصاویر در سمت کلاینت

/**
 * فشرده‌سازی و تغییر سایز هوشمند تصویر با Canvas
 * @param {File|Blob|string} source - فایل یا رشته data:image/...
 * @param {Object} options - تنظیمات تغییر اندازه و کیفیت
 * @returns {Promise<string>} رشته Base64 بهینه‌شده
 */
export async function compressImage(source, options = {}) {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.75,
    preferredMime = "image/webp",
  } = options;

  if (!source) return "";

  // ۱. تبدیل منبع به dataURL در صورت دریافت File یا Blob
  let dataUrl = "";
  if (typeof source === "string") {
    dataUrl = source;
  } else if (source instanceof Blob || (typeof File !== "undefined" && source instanceof File)) {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(source);
    });
  } else {
    return "";
  }

  // اگر فرمت SVG یا نامعتبر بود، بدون دستکاری برگردانده شود
  if (dataUrl.startsWith("data:image/svg+xml")) {
    return dataUrl;
  }

  // ۲. بارگذاری تصویر در آبجکت Image
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        let { width, height } = img;

        // محاسبه ابعاد جدید با حفظ نسبت تصویر
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // اگر تصویر از قبل کوچک و حجم آن هم اندک است (< 60KB) دست نزنیم
        if (
          width === img.width &&
          height === img.height &&
          dataUrl.length < 60 * 1024
        ) {
          resolve(dataUrl);
          return;
        }

        // ۳. رسم روی Canvas و فشرده‌سازی
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // فعال‌سازی هموارسازی کیفیت بالا
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // تلاش برای خروجی با فرمت WebP
        let compressed = canvas.toDataURL(preferredMime, quality);

        // اگر مرورگر WebP پشتیبانی نکرد یا خروجی ناموفق بود، با JPEG فشرده کنیم
        if (!compressed || !compressed.startsWith("data:image/webp")) {
          compressed = canvas.toDataURL("image/jpeg", quality);
        }

        // اگر نسخه فشرده به هر دلیلی بزرگتر از نسخه اصلی بود، نسخه اصلی سبک‌تر است
        if (compressed && compressed.length < dataUrl.length) {
          resolve(compressed);
        } else {
          resolve(dataUrl);
        }
      } catch (err) {
        console.warn("[ImageCompressor] فشرده‌سازی با خطا مواجه شد، استفاده از تصویر اولیه:", err);
        resolve(dataUrl);
      }
    };

    img.onerror = (err) => {
      console.warn("[ImageCompressor] خطا در بارگذاری تصویر:", err);
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}
