-- کد تخفیف

CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE "DiscountCode" (
    "id"                TEXT NOT NULL,
    "code"              TEXT NOT NULL,
    "type"              "DiscountType" NOT NULL,
    "value"             INTEGER NOT NULL,
    "minOrderAmount"    INTEGER NOT NULL DEFAULT 0,
    "maxDiscountAmount" INTEGER NOT NULL DEFAULT 0,
    "usageLimit"        INTEGER NOT NULL DEFAULT 0,
    "usedCount"         INTEGER NOT NULL DEFAULT 0,
    "perUserLimit"      INTEGER NOT NULL DEFAULT 1,
    "startsAt"          TIMESTAMP(3),
    "expiresAt"         TIMESTAMP(3),
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "description"       TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");
CREATE INDEX "DiscountCode_isActive_expiresAt_idx" ON "DiscountCode"("isActive", "expiresAt");

CREATE TABLE "DiscountRedemption" (
    "id"        TEXT NOT NULL,
    "amount"    INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codeId"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "orderId"   TEXT NOT NULL,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountRedemption_orderId_key" ON "DiscountRedemption"("orderId");
CREATE INDEX "DiscountRedemption_codeId_userId_idx" ON "DiscountRedemption"("codeId", "userId");

-- فیلدهای تخفیف روی سفارش
ALTER TABLE "Order"
  ADD COLUMN "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountCode"   TEXT,
  ADD COLUMN "discountCodeId" TEXT;

-- سفارش‌های قبلی تخفیفی نداشتند، پس جمع جزء با مبلغ کل برابر است
UPDATE "Order" SET "subtotalAmount" = "totalAmount";

ALTER TABLE "DiscountRedemption"
  ADD CONSTRAINT "DiscountRedemption_codeId_fkey"
    FOREIGN KEY ("codeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DiscountRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DiscountRedemption_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_discountCodeId_fkey"
    FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
