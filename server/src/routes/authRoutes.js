import express from "express";
import jwt from "jsonwebtoken";
import { Admin } from "../models/Admin.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function generateToken(admin) {
  const secret = process.env.JWT_SECRET || "super_secret_jwt_key_cafe_factor_2026_change_in_production";
  const expiresIn = process.env.JWT_EXPIRES_IN || "30d";
  return jwt.sign({ id: admin._id, username: admin.username }, secret, {
    expiresIn,
  });
}

/**
 * ایجاد یا اطمینان از وجود کاربر مدیر پیش‌فرض
 */
export async function ensureDefaultAdmin() {
  try {
    const count = await Admin.countDocuments();
    if (count === 0) {
      const defaultUser = process.env.DEFAULT_ADMIN_USER || "admin";
      const defaultPass = process.env.DEFAULT_ADMIN_PASS || "1234";

      const admin = new Admin({
        username: defaultUser,
        password: defaultPass,
        displayName: "مدیر اصلی",
      });
      await admin.save();
      console.log(`👤 کاربر مدیر اولیه با نام کاربری «${defaultUser}» و رمز عبور پیش‌فرض ایجاد شد.`);
    }
  } catch (err) {
    console.error("خطا در ایجاد مدیر پیش‌فرض:", err.message);
  }
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "نام کاربری و رمز عبور الزامی است.",
      });
    }

    const admin = await Admin.findOne({ username: username.trim().toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: "نام کاربری یا رمز عبور اشتباه است.",
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "نام کاربری یا رمز عبور اشتباه است.",
      });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin);

    res.json({
      success: true,
      message: "ورود موفقیت‌آمیز بود.",
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        displayName: admin.displayName,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.admin,
  });
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "وارد کردن رمز عبور فعلی و جدید الزامی است.",
      });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({
        success: false,
        error: "رمز عبور جدید باید حداقل ۴ کاراکتر باشد.",
      });
    }

    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "رمز عبور فعلی نادرست است.",
      });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: "رمز عبور با موفقیت تغییر یافت.",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
