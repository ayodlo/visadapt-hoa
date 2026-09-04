-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "fileUrl" DROP NOT NULL;
