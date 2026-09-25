# 🍃 راهنمای کامل راه‌اندازی بک‌اند با Express و MongoDB

این پروژه اکنون به یک **بک‌اند اختصاصی و استاندارد بر پایه Node.js، Express و دیتابیس MongoDB** مجهز شده است تا دیگر نیازی به ذخیره‌سازی فایل‌ها روی گیت‌هاب نداشته باشید و تمام فاکتورها، نرخ‌نامه، محصولات و مشتریان در یک پایگاه‌داده امن ذخیره شوند.

---

## ۱. ساختار پوشه‌ها و فایل‌های سرور

```text
server/
├── .env.example              # نمونه فایل متغیرهای محیطی
├── .env                      # فایل پیکربندی فعال (پورت، آدرس مونگو، کلید JWT)
├── package.json              # وابستگی‌های سرور (Express, Mongoose, ...)
└── src/
    ├── server.js             # نقطه ورود اصلی وب‌سرور Express
    ├── config/
    │   └── db.js             # اتصال هوشمند به دیتابیس MongoDB
    ├── models/               # مدل‌های Mongoose
    │   ├── Invoice.js         # فاکتورها
    │   ├── Proforma.js        # پیش‌فاکتورها
    │   ├── Product.js         # محصولات فیزیکی و تنوع‌ها
    │   ├── ProductCategory.js # دسته‌بندی‌های محصولات
    │   ├── ServiceCategory.js # خدمات و نرخ‌نامه
    │   ├── Customer.js        # مشتریان و شماره تماس
    │   ├── ShopInfo.js        # اطلاعات فروشگاه و حساب‌های بانکی
    │   ├── Announcement.js    # اخبار و اعلانات
    │   ├── Counter.js         # شماره‌انداز خودکار و بدون تداخل فاکتور
    │   └── Admin.js           # کاربر مدیر با هش Bcrypt
    ├── middleware/
    │   └── auth.js            # بررسی امنیت و توکن JWT
    ├── routes/               # روت‌های RESTful API
    │   ├── authRoutes.js
    │   ├── invoiceRoutes.js
    │   ├── proformaRoutes.js
    │   ├── productRoutes.js
    │   ├── serviceRoutes.js
    │   ├── customerRoutes.js
    │   ├── shopRoutes.js
    │   ├── announcementRoutes.js
    │   └── syncRoutes.js
    └── scripts/
        └── seed.js           # اسکریپت انتقال داده‌های JSON قبلی به MongoDB
```

---

## ۲. راه‌اندازی سریع روی سیستم لوکال

### مرحله ۱ — تنظیم اتصال به دیتابیس MongoDB
در فایل `server/.env` آدرس دیتابیس مونگودی‌بی را وارد کنید:
* **لوکال:** `mongodb://127.0.0.1:27017/online_factor_db`
* **یا مونگو اطلس (رایگان در فضای ابری):** `mongodb+srv://<user>:<password>@cluster0.mongodb.net/online_factor_db`

### مرحله ۲ — انتقال داده‌های اولیه به دیتابیس (اختیاری)
اگر می‌خواهید نرخ‌نامه و محصولات پیش‌فرض به دیتابیس منتقل شوند:
```bash
npm run server:seed
```

### مرحله ۳ — اجرای سرور
```bash
# در حالت توسعه (با راه‌اندازی مجدد خودکار در زمان تغییر کد):
npm run server:dev

# یا اجرای عادی:
npm run server
```

سرور روی آدرس زیر فعال می‌شود:
* **API آدرس:** `http://localhost:5000/api`
* **بررسی سلامت:** `http://localhost:5000/api/health`

---

## ۳. لیست مسیرهای اصلی API (RESTful Endpoints)

| ماژول | متد و مسیر | کاربرد |
|---|---|---|
| **احراز هویت** | `POST /api/auth/login` | ورود مدیر و دریافت توکن JWT |
| | `GET /api/auth/me` | دریافت اطلاعات مدیر لاگین‌شده |
| | `POST /api/auth/change-password` | تغییر رمز عبور مدیر |
| **فاکتورها** | `GET /api/invoices` | لیست فاکتورها (با جستجوی شماره، مشتری و اقلام) |
| | `GET /api/invoices/next-number` | دریافت شماره فاکتور بعدی |
| | `POST /api/invoices` | صدور یا ویرایش فاکتور |
| | `DELETE /api/invoices/:number` | حذف فاکتور |
| **پیش‌فاکتورها** | `GET /api/proformas` | لیست پیش‌فاکتورها |
| | `POST /api/proformas` | ثبت پیش‌فاکتور جدید |
| | `DELETE /api/proformas/:number` | حذف پیش‌فاکتور |
| **محصولات** | `GET /api/products` | دریافت لیست محصولات فروشگاه |
| | `POST /api/products` | ثبت/ویرایش محصول |
| | `DELETE /api/products/:id` | حذف محصول |
| | `GET /api/products/categories` | لیست دسته‌بندی‌های محصولات |
| **نرخ‌نامه** | `GET /api/services` | لیست خدمات و نرخ‌های مصوب |
| | `POST /api/services/category` | افزودن/ویرایش دسته‌بندی نرخ‌نامه |
| | `DELETE /api/services/category/:id` | حذف دسته نرخ‌نامه |
| **مشتریان** | `GET /api/customers` | لیست مشتریان و سوابق تماس |
| | `POST /api/customers` | ذخیره مشتری جدید |
| | `DELETE /api/customers/:id` | حذف مشتری |
| **کسب‌وکار** | `GET /api/shop` | مشخصات کافی‌نت، لوگو و کارت‌های بانکی |
| | `POST /api/shop` | ذخیره اطلاعات و کارت‌ها |
| **همگام‌سازی** | `POST /api/sync/import` | انتقال کل داده‌های JSON به دیتابیس در ۱ درخواست |
| | `GET /api/sync/export` | دریافت فایل پشتیبان کامل از دیتابیس مونگو |

---

## ۴. استقرار (Deploy) روی سرور مجازی (Ubuntu VPS)

برای راه‌اندازی این سیستم روی سرور لینوکس ابری یا سرور مجازی:

۱. **نصب Node.js و MongoDB روی سرور:**
```bash
sudo apt update && sudo apt install -y nodejs npm mongodb
```

۲. **انتقال کدها و نصب پکیج‌ها:**
```bash
cd /var/www/online-factor/server
npm install --production
```

۳. **مدیریت فرآیند با PM2 (اجرای دائم و بدون قطعی در پس‌زمینه):**
```bash
sudo npm install -g pm2
pm2 start src/server.js --name "online-factor"
pm2 save
pm2 startup
```

۴. **پیکربندی Nginx (با SSL رایگان):**
```nginx
server {
    server_name your-domain.ir;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
سپس گواهی SSL رایگان را دریافت کنید:
```bash
sudo certbot --nginx -d your-domain.ir
```
