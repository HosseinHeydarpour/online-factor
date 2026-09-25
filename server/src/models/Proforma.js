import mongoose from "mongoose";

const proformaItemSchema = new mongoose.Schema(
  {
    id: { type: String },
    title: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    qty: { type: Number, required: true, default: 1 },
    total: { type: Number, required: true, default: 0 },
    meta: { type: String, default: "" },
    variant: { type: String, default: "" },
  },
  { _id: false }
);

const proformaCustomerSchema = new mongoose.Schema(
  {
    id: { type: String },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    nationalCode: { type: String, default: "" },
    birthCertNo: { type: String, default: "" },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const proformaSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    time: {
      type: String,
      default: "",
    },
    customer: proformaCustomerSchema,
    items: [proformaItemSchema],
    subtotal: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    validUntil: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "converted", "cancelled"],
      default: "pending",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const Proforma = mongoose.model("Proforma", proformaSchema);
