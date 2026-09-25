import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/online_factor_db";

  try {
    mongoose.set("strictQuery", false);

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`🍃 اتصال به پایگاه‌داده MongoDB برقرار شد: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ خطا در اتصال به MongoDB: ${error.message}`);
    console.warn("⚠️  لطفاً مطمئن شوید سرویس MongoDB در حال اجراست یا مقدار MONGODB_URI در فایل .env صحیح است.");
    // در محیط توسعه برای اینکه سرور کرش کامل نکند، خطا را بازمی‌گردانیم
    return null;
  }
}

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  ارتباط با دیتابیس MongoDB قطع شد. تلاش برای اتصال مجدد...");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ ارتباط با دیتابیس MongoDB مجدداً برقرار گردید.");
});
