@echo off
REM ─────────────────────────────────────────────────────────────
REM  اجرای سایت در حالت پروداکشن روی همین کامپیوتر.
REM  کلادفلر تانل به همین پورت وصل می‌شود.
REM
REM  چرا APP_BASE_URL اینجا ست می‌شود و نه در .env؟
REM  چون .env را حالت توسعه هم می‌خواند؛ اگر آنجا دامنه‌ی واقعی را
REM  بگذاریم، لینک‌های sitemap و بازگشت از درگاه در npm run dev هم به
REM  kadoshahr.ir می‌روند. این متغیر زمان اجرا خوانده می‌شود
REM  (src/lib/base-url.ts) پس بیلد مجدد لازم ندارد.
REM ─────────────────────────────────────────────────────────────

REM لاگ قبل از هر کار دیگری باز می‌شود. این اسکریپت را Task Scheduler هم
REM زیر حساب SYSTEM اجرا می‌کند و آنجا هیچ پنجره‌ای نیست؛ یک بار بی‌سروصدا
REM شکست خورد و چون لاگ بعد از `cd` نوشته می‌شد، هیچ ردی نماند.
set "LOGDIR=%~dp0..\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "LOG=%LOGDIR%\site.log"

echo. >> "%LOG%"
echo ===== شروع: %DATE% %TIME% ===== >> "%LOG%"
echo   کاربر: %USERNAME%  ^|  دامنه: %USERDOMAIN% >> "%LOG%"
echo   مسیر اسکریپت: %~dp0 >> "%LOG%"

cd /d "%~dp0.."
if errorlevel 1 (
  echo   ✖ ورود به پوشه‌ی پروژه شکست خورد >> "%LOG%"
  exit /b 1
)
echo   پوشه‌ی کاری: %CD% >> "%LOG%"

REM node از طریق nvm نصب است و مسیرش یک symlink به داخل پروفایل کاربر
REM است. زیر حساب SYSTEM ممکن است در PATH نباشد، پس صریح پیدایش می‌کنیم.
set "NODE_EXE="
for %%N in (node.exe) do if not "%%~$PATH:N"=="" set "NODE_EXE=%%~$PATH:N"
if not defined NODE_EXE if exist "C:\nvm4w\nodejs\node.exe" set "NODE_EXE=C:\nvm4w\nodejs\node.exe"
if not defined NODE_EXE (
  echo   ✖ node.exe پیدا نشد - نه در PATH و نه در C:\nvm4w\nodejs >> "%LOG%"
  exit /b 1
)
echo   node: %NODE_EXE% >> "%LOG%"

if not exist ".next\standalone\server.js" (
  echo   ✖ .next\standalone\server.js نیست - اول npm run build بزن >> "%LOG%"
  exit /b 1
)

set APP_BASE_URL=https://kadoshahr.ir
set PORT=3000
set HOSTNAME=127.0.0.1

REM 127.0.0.1 و نه 0.0.0.0 — سرور فقط باید از طریق تانل دیده شود،
REM نه مستقیم از شبکه‌ی محلی.

echo   در حال اجرا... >> "%LOG%"
"%NODE_EXE%" .next\standalone\server.js >> "%LOG%" 2>&1

echo   ===== پایان با کد %ERRORLEVEL%: %DATE% %TIME% ===== >> "%LOG%"
