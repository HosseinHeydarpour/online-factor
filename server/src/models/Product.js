import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    quantity: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: String, default: "", index: true },
    price: { type: Number, required: true, default: 0 },
    quantity: { type: Number, default: 0 },
    image: { type: String, default: "" },
    barcode: { type: String, default: "" },
    description: { type: String, default: "" },
    variants: [productVariantSchema],
  },
  { timestamps: true }
);

export const Product = mongoose.model("Product", productSchema);
