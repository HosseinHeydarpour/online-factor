@echo off
chcp 65001 >nul
title کافی‌نت آنلاین | اجرای محلی و نصب اپلیکیشن
echo ======================================================================
echo    سیستم صدور فاکتور کافی‌نت آنلاین (نسخه قابل نصب PWA)
echo ======================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] نرم‌افزار Node.js روی سیستم شما نصب نیست!
    echo لطفاً ابتدا Node.js را از نشانی https://nodejs.org دانلود و نصب کنید.
    echo سپس مجدداً این فایل را اجرا نمایید.
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [۱/۳] در حال نصب وابستگی‌های برنامه (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [خطا] در نصب پکیج‌ها خطایی رخ داد.
        pause
        exit /b 1
    )
)

if not exist assets\css\tailwind.css (
    echo [۲/۳] در حال بیلد دارایی‌ها و آماده‌سازی سیستم (npm run build)...
    call npm run build
    if %errorlevel% neq 0 (
        echo [خطا] در بیلد پروژه خطایی رخ داد.
        pause
        exit /b 1
    )
)

echo [۳/۳] در حال راه‌اندازی سرور محلی...
echo.
echo ======================================================================
echo  آدرس سامانه: http://localhost:3000
echo  برای نصب برنامه در ویندوز: روی دکمه «نصب اپ» یا آیکون نصب در نوار آدرس کلیک کنید.
echo ======================================================================
echo.

start "" "http://localhost:3000"

call npm start
pause
