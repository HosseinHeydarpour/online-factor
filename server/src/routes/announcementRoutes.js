import express from "express";
import { Announcement } from "../models/Announcement.js";

const router = express.Router();

// GET /api/announcements - لیست اخبار و اعلانات
router.get("/", async (req, res) => {
  try {
    const list = await Announcement.find().sort({ pin: -1, createdAt: -1 });
    res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/announcements - ایجاد یا بروزرسانی اعلان
router.post("/", async (req, res) => {
  try {
    const ann = req.body;
    if (!ann.id) {
      ann.id = "ann-" + Date.now().toString(36);
    }

    const saved = await Announcement.findOneAndUpdate(
      { id: ann.id },
      { $set: ann },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "اعلان با موفقیت ذخیره شد.", data: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/announcements/:id - حذف اعلان
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Announcement.findOneAndDelete({ id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ success: false, error: "اعلان یافت نشد." });
    }
    res.json({ success: true, message: "اعلان با موفقیت حذف شد." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
