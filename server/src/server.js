import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./config/db.js";
import authRoutes, { ensureDefaultAdmin } from "./routes/authRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import proformaRoutes from "./routes/proformaRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// بارگذاری فایل .env از مسیر پوشه server
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 5000;

// ۱. تنظیمات امنیتی و بهینه‌سازی
app.use(
  helmet({
    contentSecurityPolicy: false, // جلوگیری از تداخل با اسکریپت‌های درون‌خطی فرانت
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(cors({ origin: "*" })); // امکان دسترسی از کلاینت‌های مختلف
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ۲. روت بررسی سلامت سرور و دیتابیس
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: "Online Factor Backend (Express + MongoDB)",
  });
});

// ۳. رجیستر کردن مسیرهای API
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/proformas", proformaRoutes);
app.use("/api/products", productRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/sync", syncRoutes);

// ۴. سرو کردن فایل‌های استاتیک برنامه فرانت‌اند (اختیاری جهت اجرای یکپارچه فرانت و بک روی یک پورت)
const clientBuildPath = path.resolve(__dirname, "../../");
app.use(express.static(clientBuildPath));

// روت ۴۰۴ برای API
app.use("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: "مسیر API مورد نظر یافت نشد." });
});

// هدایت سایر مسیرها به index.html (جهت کارکرد کامل PWA و روتینگ فرانت)
app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

// ۵. مدیریت عمومی خطاهای سرور
app.use((err, req, res, next) => {
  console.error("❌ خطای سرور:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "خطای داخلی در پردازش درخواست سرور رخ داد.",
  });
});

// ۶. اتصال به دیتابیس و راه‌اندازی وب‌سرور
async function startServer() {
  await connectDB();
  await ensureDefaultAdmin();

  app.listen(PORT, () => {
    console.log(`\n🚀 سرور بک‌اند Express با موفقیت روی پورت ${PORT} آماده به کار است:`);
    console.log(`   🔗 آدرس محلی: http://localhost:${PORT}`);
    console.log(`   🩺 بررسی سلامت: http://localhost:${PORT}/api/health\n`);
  });
}

startServer();
