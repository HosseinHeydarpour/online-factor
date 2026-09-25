import express from "express";
import { Invoice } from "../models/Invoice.js";
import { Proforma } from "../models/Proforma.js";
import { Product } from "../models/Product.js";
import { ProductCategory } from "../models/ProductCategory.js";
import { ServiceCategory } from "../models/ServiceCategory.js";
import { Customer } from "../models/Customer.js";
import { ShopInfo } from "../models/ShopInfo.js";
import { Announcement } from "../models/Announcement.js";
import { Counter } from "../models/Counter.js";

const router = express.Router();

// POST /api/sync/import - وارد کردن کلیه داده‌ها به دیتابیس MongoDB
router.post("/import", async (req, res) => {
  try {
    const payload = req.body;
    const stats = {
      invoices: 0,
      proformas: 0,
      products: 0,
      productCategories: 0,
      services: 0,
      customers: 0,
      announcements: 0,
      shop: false,
    };

    // ۱. فاکتورها
    if (Array.isArray(payload.invoices)) {
      for (const inv of payload.invoices) {
        if (inv && inv.number) {
          await Invoice.findOneAndUpdate(
            { number: Number(inv.number) },
            { $set: inv },
            { upsert: true }
          );
          stats.invoices++;
        }
      }
      // تنظیم حداکثر شماره فاکتور
      const maxInv = await Invoice.findOne().sort({ number: -1 });
      if (maxInv && maxInv.number) {
        await Counter.findOneAndUpdate(
          { key: "invoice" },
          { $max: { seq: maxInv.number } },
          { upsert: true }
        );
      }
    }

    // ۲. پیش‌فاکتورها
    if (Array.isArray(payload.proformas)) {
      for (const p of payload.proformas) {
        if (p && p.number) {
          await Proforma.findOneAndUpdate(
            { number: Number(p.number) },
            { $set: p },
            { upsert: true }
          );
          stats.proformas++;
        }
      }
      const maxProf = await Proforma.findOne().sort({ number: -1 });
      if (maxProf && maxProf.number) {
        await Counter.findOneAndUpdate(
          { key: "proforma" },
          { $max: { seq: maxProf.number } },
          { upsert: true }
        );
      }
    }

    // ۳. محصولات
    if (Array.isArray(payload.products)) {
      for (const prd of payload.products) {
        if (prd && prd.id) {
          await Product.findOneAndUpdate(
            { id: prd.id },
            { $set: prd },
            { upsert: true }
          );
          stats.products++;
        }
      }
    }

    // ۴. دسته‌بندی محصولات
    if (Array.isArray(payload.productCategories)) {
      for (const cat of payload.productCategories) {
        if (cat && cat.id) {
          await ProductCategory.findOneAndUpdate(
            { id: cat.id },
            { $set: cat },
            { upsert: true }
          );
          stats.productCategories++;
        }
      }
    }

    // ۵. مشتریان
    if (Array.isArray(payload.customers)) {
      for (const cust of payload.customers) {
        if (cust && cust.id) {
          await Customer.findOneAndUpdate(
            { id: cust.id },
            { $set: cust },
            { upsert: true }
          );
          stats.customers++;
        }
      }
    }

    // ۶. نرخ‌نامه و خدمات
    if (Array.isArray(payload.services)) {
      for (const s of payload.services) {
        if (s && s.id) {
          await ServiceCategory.findOneAndUpdate(
            { id: s.id },
            { $set: s },
            { upsert: true }
          );
          stats.services++;
        }
      }
    }

    // ۷. اعلانات
    if (Array.isArray(payload.announcements)) {
      for (const a of payload.announcements) {
        if (a && a.id) {
          await Announcement.findOneAndUpdate(
            { id: a.id },
            { $set: a },
            { upsert: true }
          );
          stats.announcements++;
        }
      }
    }

    // ۸. اطلاعات کسب‌وکار
    if (payload.shopInfo && typeof payload.shopInfo === "object") {
      let shop = await ShopInfo.findOne();
      if (!shop) shop = new ShopInfo(payload.shopInfo);
      else Object.assign(shop, payload.shopInfo);
      await shop.save();
      stats.shop = true;
    }

    res.json({
      success: true,
      message: "کلیه اطلاعات با موفقیت وارد دیتابیس MongoDB شدند.",
      stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/sync/export - دریافت بسته کامل پشتیبان از دیتابیس MongoDB
router.get("/export", async (req, res) => {
  try {
    const [
      invoices,
      proformas,
      products,
      productCategories,
      services,
      customers,
      announcements,
      shopInfo,
    ] = await Promise.all([
      Invoice.find().sort({ number: 1 }),
      Proforma.find().sort({ number: 1 }),
      Product.find(),
      ProductCategory.find().sort({ order: 1 }),
      ServiceCategory.find().sort({ order: 1 }),
      Customer.find(),
      Announcement.find().sort({ createdAt: -1 }),
      ShopInfo.findOne(),
    ]);

    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      data: {
        invoices,
        proformas,
        products,
        productCategories,
        services,
        customers,
        announcements,
        shopInfo: shopInfo || {},
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
