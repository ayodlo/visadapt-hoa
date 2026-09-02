-- CreateTable
CREATE TABLE "violation_attachments" (
    "id" TEXT NOT NULL,
    "violationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violation_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "violation_attachments_violationId_idx" ON "violation_attachments"("violationId");

-- AddForeignKey
ALTER TABLE "violation_attachments" ADD CONSTRAINT "violation_attachments_violationId_fkey" FOREIGN KEY ("violationId") REFERENCES "violations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violation_attachments" ADD CONSTRAINT "violation_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
