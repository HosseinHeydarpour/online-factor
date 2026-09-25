import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    bank: { type: String, default: "" },
    holder: { type: String, default: "" },
    card: { type: String, default: "" },
    sheba: { type: String, default: "" },
  },
  { _id: false }
);

const shopInfoSchema = new mongoose.Schema(
  {
    name: { type: String, default: "کافی‌نت آنلاین" },
    slogan: {
      type: String,
      default: "ارائه‌دهنده خدمات اینترنتی و ثبت‌نام‌های دولتی",
    },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    logo: { type: String, default: "" },
    bankAccounts: [bankAccountSchema],
  },
  { timestamps: true }
);

export const ShopInfo = mongoose.model("ShopInfo", shopInfoSchema);
