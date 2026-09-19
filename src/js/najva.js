import { store } from "./store.js";

export function getNajvaConfig() {
  const s = store.getSettings();
  return (
    s.najva || {
      scriptId: "",
      apiToken: "",
      enabled: false,
    }
  );
}

export function saveNajvaConfig(cfg) {
  store.saveSettings({ ...store.getSettings(), najva: cfg });
}

/**
 * تزریق اسکریپت رسمی نجوا فقط در پورتال مشتری
 */
export function initNajvaClient() {
  const cfg = getNajvaConfig();
  if (!cfg.enabled || !cfg.scriptId) return;

  if (document.getElementById("najva-sdk-script")) return;

  try {
    const now = new Date();
    const version =
      now.getFullYear().toString() +
      "0" +
      now.getMonth() +
      "0" +
      now.getDate() +
      "0" +
      now.getHours();

    // لینک استایل نجوا
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://static.najva.com/static/css/local-messaging.css?v=${version}`;
    document.head.appendChild(link);

    // اسکریپت JS نجوا
    const script = document.createElement("script");
    script.id = "najva-sdk-script";
    script.type = "text/javascript";
    script.async = true;
    script.src = `https://static.najva.com/static/js/scripts/${cfg.scriptId}.js?v=${version}`;
    document.head.appendChild(script);

    console.log("🔔 اسکریپت وب‌پوش نجوا بارگذاری شد.");
  } catch (err) {
    console.warn("خطا در بارگذاری نجوا:", err);
  }
}

/**
 * ارسال نوتیفیکیشن فوری از طریق وب‌سرویس نجوا هنگام انتشار خبر
 */
export async function sendNajvaPushNotification({ title, body, url }) {
  const cfg = getNajvaConfig();
  if (!cfg.apiToken || !cfg.scriptId) {
    return { ok: false, message: "توکن API یا شناسه نجوا تنظیم نشده است." };
  }

  const payload = {
    title: title.trim(),
    body: (body || "").trim() || "برای مشاهده جزئیات خبر کلیک کنید.",
    url:
      url ||
      window.location.origin + window.location.pathname + "?role=customer",
    icon: window.location.origin + "/icon-192.png",
  };

  try {
    const res = await fetch(
      "https://app.najva.com/notification/api/v1/notifications/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: cfg.apiToken.startsWith("Token ")
            ? cfg.apiToken
            : `Token ${cfg.apiToken}`,
          "X-API-KEY": cfg.scriptId,
        },
        body: JSON.stringify(payload),
      },
    );

    if (res.ok) {
      return { ok: true };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false, message: data.detail || `خطای HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
