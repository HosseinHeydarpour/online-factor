import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import { connectDB } from "../config/db.js";
import { Product } from "../models/Product.js";
import { ProductCategory } from "../models/ProductCategory.js";
import { ServiceCategory } from "../models/ServiceCategory.js";
import { ShopInfo } from "../models/ShopInfo.js";
import { Announcement } from "../models/Announcement.js";
import { ensureDefaultAdmin } from "../routes/authRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function readJsonFile(filePath, defaultVal = []) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`خطا در خواندن فایل ${filePath}:`, err.message);
  }
  return defaultVal;
}

export async function seedInitialData() {
  await connectDB();
  await ensureDefaultAdmin();

  const dataDir = path.resolve(__dirname, "../../../data");
  console.log(`📂 بررسی و انتقال دیتای اولیه از مسیر: ${dataDir}`);

  // ۱. اطلاعات فروشگاه
  const shopCount = await ShopInfo.countDocuments();
  if (shopCount === 0) {
    const shopJson = readJsonFile(path.join(dataDir, "shop-info.json"), {});
    const shop = new ShopInfo(shopJson);
    await shop.save();
    console.log("   ✅ اطلاعات کسب‌وکار و حساب‌های بانکی وارد دیتابیس شد.");
  }

  // ۲. محصولات
  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    const prdJson = readJsonFile(path.join(dataDir, "products.json"), []);
    if (prdJson.length > 0) {
      await Product.insertMany(prdJson);
      console.log(`   ✅ تعداد ${prdJson.length} محصول فیزیکی وارد دیتابیس شد.`);
    }
  }

  // ۳. دسته‌بندی محصولات
  const pcatCount = await ProductCategory.countDocuments();
  if (pcatCount === 0) {
    const pcatJson = readJsonFile(path.join(dataDir, "product-categories.json"), []);
    if (pcatJson.length > 0) {
      await ProductCategory.insertMany(pcatJson);
      console.log(`   ✅ تعداد ${pcatJson.length} دسته‌بندی محصول وارد دیتابیس شد.`);
    }
  }

  // ۴. نرخ‌نامه و خدمات
  const srvCount = await ServiceCategory.countDocuments();
  if (srvCount === 0) {
    const srvJson = readJsonFile(path.join(dataDir, "services.json"), []);
    if (srvJson.length > 0) {
      await ServiceCategory.insertMany(srvJson);
      console.log(`   ✅ تعداد ${srvJson.length} دسته‌بندی نرخ‌نامه و خدمات وارد دیتابیس شد.`);
    }
  }

  // ۵. اعلانات
  const annCount = await Announcement.countDocuments();
  if (annCount === 0) {
    const annJson = readJsonFile(path.join(dataDir, "announcements.json"), []);
    if (annJson.length > 0) {
      await Announcement.insertMany(annJson);
      console.log(`   ✅ تعداد ${annJson.length} اعلان اولیه وارد دیتابیس شد.`);
    }
  }

  console.log("\n🎉 همگام‌سازی و بارگذاری داده‌های اولیه به پایان رسید.\n");
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedInitialData();
}
