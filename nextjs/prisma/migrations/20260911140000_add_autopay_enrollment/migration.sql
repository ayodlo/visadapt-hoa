-- CreateTable
CREATE TABLE "autopay_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "methodType" TEXT NOT NULL,
    "methodBrand" TEXT,
    "methodLast4" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastFailureCode" TEXT,
    "lastFailureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopay_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "autopay_enrollments_userId_key" ON "autopay_enrollments"("userId");

-- CreateIndex
CREATE INDEX "autopay_enrollments_communityId_idx" ON "autopay_enrollments"("communityId");

-- AddForeignKey
ALTER TABLE "autopay_enrollments" ADD CONSTRAINT "autopay_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autopay_enrollments" ADD CONSTRAINT "autopay_enrollments_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

