import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "" },
    content: { type: String, default: "" },
    category: { type: String, default: "عمومی" },
    pin: { type: Boolean, default: false },
    date: { type: String, default: "" },
    time: { type: String, default: "" },
    status: {
      type: String,
      enum: ["published", "draft"],
      default: "published",
    },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model(
  "Announcement",
  announcementSchema
);
