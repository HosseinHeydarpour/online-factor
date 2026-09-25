import jwt from "jsonwebtoken";
import { Admin } from "../models/Admin.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "توکن احراز هویت ارائه نشده یا معتبر نیست.",
      });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "super_secret_jwt_key_cafe_factor_2026_change_in_production";

    const decoded = jwt.verify(token, secret);
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: "حساب کاربری مدیر یافت نشد یا دسترسی مسدود شده است.",
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.",
      });
    }
    return res.status(401).json({
      success: false,
      error: "توکن نامعتبر است.",
    });
  }
}
