import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 1000 },
  },
  { timestamps: true }
);

/**
 * دریافت شماره بعدی به صورت اتمیک و بدون تداخل
 */
counterSchema.statics.getNextSequence = async function (key, startSeq = 1000) {
  const record = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // اگر تازه ساخته شده و مقدار کمتر از شروع بود
  if (record.seq < startSeq) {
    record.seq = startSeq;
    await record.save();
  }

  return record.seq;
};

export const Counter = mongoose.model("Counter", counterSchema);
