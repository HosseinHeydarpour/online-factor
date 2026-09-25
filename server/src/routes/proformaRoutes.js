import express from "express";
import { Proforma } from "../models/Proforma.js";
import { Counter } from "../models/Counter.js";

const router = express.Router();

// GET /api/proformas - لیست پیش‌فاکتورها
router.get("/", async (req, res) => {
  try {
    const { q, limit = 500 } = req.query;
    const filter = {};

    if (q) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [
        { "customer.name": regex },
        { "customer.phone": regex },
        { "items.title": regex },
      ];
      if (!isNaN(Number(q))) {
        filter.$or.push({ number: Number(q) });
      }
    }

    const proformas = await Proforma.find(filter)
      .sort({ number: -1 })
      .limit(Number(limit));

    res.json({
      success: true,
      count: proformas.length,
      data: proformas,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/proformas/next-number - شماره پیش‌فاکتور بعدی
router.get("/next-number", async (req, res) => {
  try {
    const nextNum = await Counter.getNextSequence("proforma", 5000);
    res.json({ success: true, nextNumber: nextNum });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/proformas/:number - دریافت یک پیش‌فاکتور
router.get("/:number", async (req, res) => {
  try {
    const num = Number(req.params.number);
    const proforma = await Proforma.findOne({ number: num });
    if (!proforma) {
      return res.status(404).json({ success: false, error: "پیش‌فاکتور یافت نشد." });
    }
    res.json({ success: true, data: proforma });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/proformas - ثبت یا بروزرسانی پیش‌فاکتور
router.post("/", async (req, res) => {
  try {
    const pData = req.body;
    let number = Number(pData.number);

    if (!number || isNaN(number)) {
      number = await Counter.getNextSequence("proforma", 5000);
      pData.number = number;
    } else {
      const currentCounter = await Counter.findOne({ key: "proforma" });
      if (!currentCounter || number > currentCounter.seq) {
        await Counter.findOneAndUpdate(
          { key: "proforma" },
          { $set: { seq: number } },
          { upsert: true }
        );
      }
    }

    const proforma = await Proforma.findOneAndUpdate(
      { number },
      { $set: pData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: "پیش‌فاکتور با موفقیت ذخیره شد.",
      data: proforma,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/proformas/:number - حذف پیش‌فاکتور
router.delete("/:number", async (req, res) => {
  try {
    const num = Number(req.params.number);
    const deleted = await Proforma.findOneAndDelete({ number: num });
    if (!deleted) {
      return res.status(404).json({ success: false, error: "پیش‌فاکتور یافت نشد." });
    }
    res.json({
      success: true,
      message: `پیش‌فاکتور شماره ${num} با موفقیت حذف شد.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
