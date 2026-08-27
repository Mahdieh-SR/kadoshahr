-- جدول درگاه ساختگی.
-- تصمیم «پرداخت موفق/ناموفق» سمت سرور اینجا ثبت می‌شود تا تایید پرداخت
-- دقیقاً مثل حالت واقعی باشد و به پارامتر برگشتی از مرورگر اعتماد نشود.
CREATE TABLE IF NOT EXISTS "MockPayment" (
    "authority" TEXT NOT NULL,
    "amount"    INTEGER NOT NULL,
    "approved"  BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockPayment_pkey" PRIMARY KEY ("authority")
);
