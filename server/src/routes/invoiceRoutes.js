import express from "express";
import { Invoice } from "../models/Invoice.js";
import { Counter } from "../models/Counter.js";
import { Customer } from "../models/Customer.js";

const router = express.Router();

// GET /api/invoices - دریافت لیست فاکتورها با جستجو
router.get("/", async (req, res) => {
  try {
    const { q, startDate, endDate, limit = 500 } = req.query;
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

    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const invoices = await Invoice.find(filter)
      .sort({ number: -1 })
      .limit(Number(limit));

    res.json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/invoices/next-number - شماره فاکتور بعدی
router.get("/next-number", async (req, res) => {
  try {
    const nextNum = await Counter.getNextSequence("invoice", 1000);
    res.json({ success: true, nextNumber: nextNum });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/invoices/:number - دریافت یک فاکتور
router.get("/:number", async (req, res) => {
  try {
    const num = Number(req.params.number);
    const invoice = await Invoice.findOne({ number: num });
    if (!invoice) {
      return res.status(404).json({ success: false, error: "فاکتور یافت نشد." });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/invoices - ثبت یا ویرایش فاکتور
router.post("/", async (req, res) => {
  try {
    const invoiceData = req.body;

    if (!invoiceData) {
      return res.status(400).json({ success: false, error: "اطلاعات فاکتور ارسال نشده است." });
    }

    // اگر شماره فاکتور ارسال نشده بود، شماره بعدی را تخصیص می‌دهیم
    let number = Number(invoiceData.number);
    if (!number || isNaN(number)) {
      number = await Counter.getNextSequence("invoice", 1000);
      invoiceData.number = number;
    } else {
      // بروزرسانی شمارنده به حداکثر شماره ثبت‌شده
      const currentCounter = await Counter.findOne({ key: "invoice" });
      if (!currentCounter || number > currentCounter.seq) {
        await Counter.findOneAndUpdate(
          { key: "invoice" },
          { $set: { seq: number } },
          { upsert: true }
        );
      }
    }

    // ذخیره یا بروزرسانی در دیتابیس
    const invoice = await Invoice.findOneAndUpdate(
      { number },
      { $set: invoiceData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // همگام‌سازی خودکار سوابق مشتری در صورت وجود شماره تماس
    if (invoiceData.customer && invoiceData.customer.phone) {
      const phone = invoiceData.customer.phone.trim();
      if (phone) {
        await Customer.findOneAndUpdate(
          { phone },
          {
            $set: {
              name: invoiceData.customer.name || "",
              phone,
              nationalCode: invoiceData.customer.nationalCode || "",
              address: invoiceData.customer.address || "",
              lastSeen: invoiceData.date || "",
            },
          },
          { upsert: true }
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: "فاکتور با موفقیت ذخیره شد.",
      data: invoice,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/invoices/:number - حذف فاکتور
router.delete("/:number", async (req, res) => {
  try {
    const num = Number(req.params.number);
    const deleted = await Invoice.findOneAndDelete({ number: num });
    if (!deleted) {
      return res.status(404).json({ success: false, error: "فاکتور یافت نشد." });
    }
    res.json({
      success: true,
      message: `فاکتور شماره ${num} با موفقیت حذف شد.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
