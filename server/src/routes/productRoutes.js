import express from "express";
import { Product } from "../models/Product.js";
import { ProductCategory } from "../models/ProductCategory.js";

const router = express.Router();

// GET /api/products - لیست همه محصولات
router.get("/", async (req, res) => {
  try {
    const { categoryId, q } = req.query;
    const filter = {};

    if (categoryId) filter.categoryId = categoryId;
    if (q) filter.name = new RegExp(q.trim(), "i");

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/products - ذخیره یا بروزرسانی محصول
router.post("/", async (req, res) => {
  try {
    const product = req.body;
    if (!product.id) {
      product.id = "prd-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    const saved = await Product.findOneAndUpdate(
      { id: product.id },
      { $set: product },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "محصول با موفقیت ذخیره شد.", data: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/products/:id - حذف محصول
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: "محصول یافت نشد." });
    }
    res.json({ success: true, message: "محصول با موفقیت حذف شد." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/categories - دسته‌بندی‌های محصولات
router.get("/categories", async (req, res) => {
  try {
    const categories = await ProductCategory.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/products/categories - ذخیره یا بروزرسانی دسته‌بندی
router.post("/categories", async (req, res) => {
  try {
    const cat = req.body;
    if (!cat.id) {
      cat.id = "pcat-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    const saved = await ProductCategory.findOneAndUpdate(
      { id: cat.id },
      { $set: cat },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "دسته‌بندی با موفقیت ذخیره شد.", data: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/products/categories/:id - حذف دسته‌بندی محصول
router.delete("/categories/:id", async (req, res) => {
  try {
    const catId = req.params.id;
    await ProductCategory.findOneAndDelete({ id: catId });
    // حذف وابستگی دسته‌بندی از محصولات
    await Product.updateMany({ categoryId: catId }, { $set: { categoryId: "" } });

    res.json({ success: true, message: "دسته‌بندی و وابستگی‌ها با موفقیت حذف شدند." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
