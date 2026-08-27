-- آدرس پستی برای ارسال سفارش‌ها.
-- روی User به‌عنوان آدرس پیش‌فرض، و روی Order به‌عنوان کپی لحظه‌ی خرید.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "province"   TEXT,
  ADD COLUMN IF NOT EXISTS "city"       TEXT,
  ADD COLUMN IF NOT EXISTS "address"    TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "province"   TEXT,
  ADD COLUMN IF NOT EXISTS "city"       TEXT,
  ADD COLUMN IF NOT EXISTS "address"    TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
