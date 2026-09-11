-- قیمت‌گذاری دلاری
--
-- گیفت‌کارت‌ها به دلار خرید می‌شوند، پس قیمت تومانی‌شان باید با نرخ روز حساب شود.
-- روش: قیمت دلاری روی خود نسخه ذخیره می‌شود و هر بار که نرخ عوض شد، ستون
-- «price» (تومان) دوباره حساب و نوشته می‌شود. بقیه‌ی سایت همچنان فقط «price»
-- را می‌خواند و هیچ تغییری لازم ندارد.

-- تنظیمات قیمت‌گذاری — عمداً فقط یک سطر دارد
CREATE TABLE "PricingSettings" (
    "id"            INTEGER NOT NULL DEFAULT 1,
    -- نرخ هر دلار به تومان. صفر یعنی هنوز تنظیم نشده.
    "usdRate"       INTEGER NOT NULL DEFAULT 0,
    -- درصد سود/کارمزد که روی نرخ اعمال می‌شود
    "marginPercent" INTEGER NOT NULL DEFAULT 0,
    -- قیمت نهایی به بالا تا مضربی از این عدد رند می‌شود
    "roundTo"       INTEGER NOT NULL DEFAULT 1000,
    -- نرخی که سرویس بیرونی پیشنهاد داده؛ تا وقتی مدیر تایید نکند اعمال نمی‌شود
    "suggestedRate" INTEGER,
    "suggestedAt"   TIMESTAMP(3),
    "suggestedFrom" TEXT,
    -- آخرین باری که قیمت محصولات واقعاً بازنویسی شد
    "appliedAt"     TIMESTAMP(3),
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PricingSettings_single_row" CHECK ("id" = 1)
);

INSERT INTO "PricingSettings" ("id", "usdRate", "marginPercent", "roundTo", "updatedAt")
VALUES (1, 0, 0, 1000, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- قیمت دلاری روی هر نسخه.
-- به «سِنت» ذخیره می‌شود تا عدد اعشاری نداشته باشیم: ۵۰۰ یعنی ۵ دلار.
ALTER TABLE "ProductVariant"
  ADD COLUMN "priceUsd"     INTEGER,
  ADD COLUMN "compareAtUsd" INTEGER,
  -- true یعنی قیمت تومانی این نسخه از روی نرخ دلار حساب می‌شود و دستی نیست
  ADD COLUMN "usdPriced"    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ProductVariant_usdPriced_idx" ON "ProductVariant"("usdPriced");
