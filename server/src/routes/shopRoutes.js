import express from "express";
import { ShopInfo } from "../models/ShopInfo.js";

const router = express.Router();

// GET /api/shop - دریافت اطلاعات کسب‌وکار و کارت‌های بانکی
router.get("/", async (req, res) => {
  try {
    let shop = await ShopInfo.findOne();
    if (!shop) {
      shop = new ShopInfo();
      await shop.save();
    }
    res.json({ success: true, data: shop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/shop - ذخیره یا بروزرسانی اطلاعات کسب‌وکار و کارت‌های بانکی
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    let shop = await ShopInfo.findOne();

    if (!shop) {
      shop = new ShopInfo(data);
    } else {
      Object.assign(shop, data);
    }

    await shop.save();
    res.json({ success: true, message: "تنظیمات کسب‌وکار با موفقیت ذخیره شد.", data: shop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
