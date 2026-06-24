-- CreateEnum
CREATE TYPE "DuesStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateTable
CREATE TABLE "dues_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "DuesStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dues_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dues_records" ADD CONSTRAINT "dues_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
