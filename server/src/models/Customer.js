import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true, index: true },
    nationalCode: { type: String, default: "", trim: true },
    birthCertNo: { type: String, default: "", trim: true },
    address: { type: String, default: "" },
    gender: { type: String, default: "" },
    age: { type: String, default: "" },
    notes: { type: String, default: "" },
    lastSeen: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Customer = mongoose.model("Customer", customerSchema);
