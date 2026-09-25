import mongoose from "mongoose";

const serviceItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    price: { type: Number, required: true, default: 0 },
    custom: { type: Boolean, default: false },
  },
  { _id: false }
);

const serviceCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    items: [serviceItemSchema],
    custom: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ServiceCategory = mongoose.model(
  "ServiceCategory",
  serviceCategorySchema
);
