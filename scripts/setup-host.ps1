# ─────────────────────────────────────────────────────────────
#  دائمی کردن سایت روی همین کامپیوتر.
#  باید با دسترسی ادمین اجرا شود (Run as administrator).
#
#  چهار کار می‌کند:
#    ۱. ساعت سیستم را درست و همگام‌سازی خودکارش را روشن می‌کند
#    ۲. cloudflared را به‌عنوان سرویس ویندوز نصب می‌کند
#    ۳. سایت را در Task Scheduler می‌گذارد تا با روشن شدن ویندوز بالا بیاید
#    ۴. خواب رفتن کامپیوتر را خاموش می‌کند
#
#  بعد از ری‌استارت، بدون ورود کاربر هم سایت خودش بالا می‌آید.
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
$serveCmd    = Join-Path $projectRoot "scripts\serve.cmd"
$cloudflared = Join-Path $env:USERPROFILE "cloudflared\cloudflared.exe"

# پنجره‌ی ادمین جداست و اگر وسط کار بسته شود هیچ ردی نمی‌ماند.
# ترنسکریپت یعنی همه‌چیز در یک فایل ثبت می‌شود و قابل بررسی است.
$logDir = Join-Path $projectRoot "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force $logDir | Out-Null }
Start-Transcript -Path (Join-Path $logDir "setup-host.log") -Append | Out-Null

# اگر ادمین نباشد ادامه دادن بی‌فایده است و فقط خطاهای گیج‌کننده می‌دهد.
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "این اسکریپت باید با Run as administrator اجرا شود." -ForegroundColor Red
  Stop-Transcript | Out-Null
  Read-Host "برای بستن Enter بزن"
  exit 1
}

Write-Host "پوشه‌ی پروژه: $projectRoot"
Write-Host "ادمین: بله"
Write-Host ""

# ── ۱. ساعت ──────────────────────────────────────────────────
Write-Host "=== ۱. ساعت سیستم ===" -ForegroundColor Cyan

# منطقه‌ی زمانی روی Syria (UTC+3) بود، نه ایران (UTC+3:30). آن نیم‌ساعت
# اختلاف مستقیم به UTC منتقل می‌شد و برنامه‌ها با UTC کار می‌کنند.
try {
  Set-TimeZone -Id "Iran Standard Time"
  Write-Host "  منطقه‌ی زمانی -> Iran Standard Time"
} catch {
  Write-Host "  خطا در منطقه‌ی زمانی: $_" -ForegroundColor Red
}

# بدون Automatic، ساعت یک بار درست می‌شود و دوباره دریفت می‌کند.
# سرویس اینجا Disabled بود؛ وقتی Disabled باشد Set-Service گاهی رد می‌شود،
# پس مستقیم هم در رجیستری ست می‌کنیم (Start=2 یعنی Automatic).
try {
  Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time" -Name Start -Value 2 -ErrorAction Stop
  Write-Host "  رجیستری W32Time -> Automatic"
} catch {
  Write-Host "  خطای رجیستری: $_" -ForegroundColor Red
}
try {
  Set-Service W32Time -StartupType Automatic -ErrorAction Stop
} catch {
  Write-Host "  هشدار Set-Service: $_" -ForegroundColor Yellow
}
try {
  Start-Service W32Time -ErrorAction Stop
  Write-Host "  سرویس W32Time روشن شد"
} catch {
  Write-Host "  خطا در روشن کردن W32Time: $_" -ForegroundColor Red
}

# سرور زمان مایکروسافت گاهی از ایران در دسترس نیست؛ منابع جایگزین.
w32tm /config /manualpeerlist:"pool.ntp.org,0x9 time.google.com,0x9" /syncfromflags:manual /update | Out-Null
Restart-Service W32Time -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
w32tm /resync /force | Out-Null
Write-Host ("  ساعت الان (UTC): " + (Get-Date).ToUniversalTime().ToString("HH:mm:ss"))
Write-Host ""

# ── ۲. سرویس cloudflared ─────────────────────────────────────
Write-Host "=== ۲. سرویس cloudflared ===" -ForegroundColor Cyan

if (-not (Get-Service Cloudflared -ErrorAction SilentlyContinue)) {
  & $cloudflared service install
  Start-Sleep -Seconds 3
}

# `service install` مسیر اجرا را بدون هیچ آرگومانی ثبت می‌کند — سرویس بالا
# می‌آید ولی هیچ تانلی اجرا نمی‌کند و کلادفلر می‌گوید «اتصال فعالی ندارد».
# پس آرگومان‌ها را صریح می‌نویسیم. مسیر config هم صریح داده می‌شود چون
# SYSTEM پروفایل کاربر را ندارد و config.yml را خودش پیدا نمی‌کند.
$configPath = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
$binPath = '"{0}" --config "{1}" --no-autoupdate tunnel run kadoshahr' -f $cloudflared, $configPath

$r = sc.exe config Cloudflared binPath= $binPath start= auto
if ($LASTEXITCODE -eq 0) {
  Write-Host "  مسیر اجرا اصلاح شد:"
  Write-Host "    $binPath"
} else {
  Write-Host "  خطا در اصلاح مسیر اجرا: $r" -ForegroundColor Red
}

# ⚠️ Restart-Service اینجا بی‌نهایت منتظر می‌ماند: پروسه‌ی قدیمیِ سرویس که
# بدون آرگومان اجرا شده بود به سیگنال توقف جواب نمی‌دهد. پس با مهلت صبر
# می‌کنیم و اگر نایستاد، پروسه را می‌کشیم.
Write-Host "  در حال توقف سرویس..."
sc.exe stop Cloudflared | Out-Null

$deadline = (Get-Date).AddSeconds(15)
while ((Get-Service Cloudflared -ErrorAction SilentlyContinue).Status -ne 'Stopped' -and (Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 1
}

if ((Get-Service Cloudflared -ErrorAction SilentlyContinue).Status -ne 'Stopped') {
  Write-Host "  سرویس نایستاد؛ پروسه کشته می‌شود"
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
}

# هر نمونه‌ی دستیِ باقی‌مانده هم باید برود، وگرنه دو تانل هم‌زمان اجرا
# می‌شود و تشخیص اینکه کدام کار می‌کند سخت می‌شود.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Start-Service Cloudflared -ErrorAction SilentlyContinue
Start-Sleep -Seconds 6
$cf = Get-Service Cloudflared -ErrorAction SilentlyContinue
Write-Host ("  وضعیت سرویس: " + $(if ($cf) { $cf.Status } else { "؟" }))
Write-Host ""

# ── ۳. تسک سایت ──────────────────────────────────────────────
Write-Host "=== ۳. تسک اجرای سایت ===" -ForegroundColor Cyan
$taskName = "Kadoshahr Site"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "  تسک قبلی حذف شد"
}

# اگر نمونه‌ای دستی روی پورت ۳۰۰۰ در حال اجرا باشد، تسک نمی‌تواند bind کند
# و بی‌سروصدا می‌میرد. فقط همان پروسه‌ی صاحب پورت کشته می‌شود، نه هر node.
$holder = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($holder) {
  $holder | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    Write-Host "  آزاد کردن پورت 3000 (PID $_)"
    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 3
}

$action  = New-ScheduledTaskAction -Execute $serveCmd -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtStartup

# SYSTEM یعنی بدون ورود کاربر هم اجرا می‌شود — اگر برق برود و کامپیوتر
# خودش بالا بیاید، سایت منتظر لاگین کسی نمی‌ماند.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# ExecutionTimeLimit صفر یعنی بی‌نهایت؛ پیش‌فرض ۳ روزه تسک را می‌کشد.
# RestartInterval یعنی اگر پروسه مرد، یک دقیقه بعد دوباره بلند شود.
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 999 `
  -MultipleInstances IgnoreNew -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings `
  -Description "فروشگاه کادوشهر - سرور Next.js که کلادفلر تانل به آن وصل می‌شود" | Out-Null

Start-ScheduledTask -TaskName $taskName
Write-Host "  تسک ساخته و اجرا شد"
Write-Host ""

# ── ۴. جلوگیری از خواب ───────────────────────────────────────
Write-Host "=== ۴. تنظیم برق ===" -ForegroundColor Cyan
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 15
Write-Host "  خواب و هایبرنیت خاموش شد"
Write-Host "  (مانیتور بعد از ۱۵ دقیقه خاموش می‌شود — روی سایت اثری ندارد)"
Write-Host ""

# ── بررسی واقعی ──────────────────────────────────────────────
# «Running» بودن سرویس هیچ چیزی را ثابت نمی‌کند — یک بار سرویس بالا بود
# ولی چون آرگومان نداشت هیچ تانلی اجرا نمی‌کرد. پس نتیجه را می‌سنجیم.
Write-Host "=== بررسی ===" -ForegroundColor Cyan
Write-Host "  ۳۰ ثانیه صبر تا سرور و تانل جا بیفتند..."
Start-Sleep -Seconds 30

$port = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
Write-Host ("  پورت 3000: " + $(if ($port) { "در حال گوش دادن ✔" } else { "کسی گوش نمی‌دهد ✖" }))

$info = & $cloudflared tunnel info kadoshahr 2>&1 | Out-String
if ($info -match "does not have any active connection") {
  Write-Host "  تانل: هیچ اتصال فعالی ندارد ✖" -ForegroundColor Red
} else {
  Write-Host "  تانل: متصل ✔"
}
Write-Host ""

# ── خلاصه ────────────────────────────────────────────────────
Write-Host "=== نتیجه ===" -ForegroundColor Cyan
$svc  = Get-Service cloudflared -ErrorAction SilentlyContinue
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$w32  = Get-Service W32Time -ErrorAction SilentlyContinue
Write-Host ("  cloudflared : " + $(if ($svc)  { $svc.Status }  else { "نصب نشد" }))
Write-Host ("  تسک سایت    : " + $(if ($task) { $task.State } else { "ساخته نشد" }))
Write-Host ("  W32Time     : " + $(if ($w32)  { "$($w32.Status) / $($w32.StartType)" } else { "؟" }))
Write-Host ("  منطقه زمانی : " + (Get-TimeZone).Id)
Write-Host ("  UTC سیستم   : " + (Get-Date).ToUniversalTime().ToString("HH:mm:ss"))
Write-Host ""

Stop-Transcript | Out-Null

Write-Host "تمام شد." -ForegroundColor Green
Write-Host "این پنجره را ببند و به Claude بگو تا تست نهایی را بگیرد."
Write-Host ""
Read-Host "برای بستن Enter بزن"
