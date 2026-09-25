import mongoose from "mongoose";

const productCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "📦" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ProductCategory = mongoose.model(
  "ProductCategory",
  productCategorySchema
);
