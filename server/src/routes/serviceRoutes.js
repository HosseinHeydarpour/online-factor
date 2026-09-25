import express from "express";
import { ServiceCategory } from "../models/ServiceCategory.js";

const router = express.Router();

// GET /api/services - دریافت کلیه دسته‌بندی‌ها و خدمات نرخ‌نامه
router.get("/", async (req, res) => {
  try {
    const categories = await ServiceCategory.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/services/category - ثبت یا بروزرسانی دسته‌بندی خدمات همراه با آیتم‌ها
router.post("/category", async (req, res) => {
  try {
    const cat = req.body;
    if (!cat.id) {
      cat.id = "cat-" + Date.now().toString(36);
    }

    const saved = await ServiceCategory.findOneAndUpdate(
      { id: cat.id },
      { $set: cat },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "دسته‌بندی خدمات با موفقیت ذخیره شد.", data: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/services/category/:id - حذف یک دسته‌بندی کامل
router.delete("/category/:id", async (req, res) => {
  try {
    const deleted = await ServiceCategory.findOneAndDelete({ id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: "دسته‌بندی یافت نشد." });
    }
    res.json({ success: true, message: "دسته‌بندی با موفقیت حذف شد." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
