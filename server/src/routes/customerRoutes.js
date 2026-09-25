import express from "express";
import { Customer } from "../models/Customer.js";

const router = express.Router();

// GET /api/customers - لیست مشتریان
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};

    if (q) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [
        { name: regex },
        { phone: regex },
        { nationalCode: regex },
      ];
    }

    const customers = await Customer.find(filter).sort({ updatedAt: -1 });
    res.json({ success: true, count: customers.length, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/customers - افزودن یا ویرایش مشتری
router.post("/", async (req, res) => {
  try {
    const customer = req.body;
    if (!customer.id) {
      customer.id = "cust-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    const saved = await Customer.findOneAndUpdate(
      { id: customer.id },
      { $set: customer },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "اطلاعات مشتری با موفقیت ذخیره شد.", data: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/customers/:id - حذف مشتری
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Customer.findOneAndDelete({ id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: "مشتری یافت نشد." });
    }
    res.json({ success: true, message: "مشتری با موفقیت حذف شد." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
