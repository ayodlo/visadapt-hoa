-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'HVAC', 'ROOFING', 'LANDSCAPING', 'IRRIGATION', 'STRUCTURAL', 'DOORS_WINDOWS', 'FENCING', 'COMMON_AREA', 'POOL_SPA', 'LIGHTING', 'TRASH_RECYCLING', 'PEST_CONTROL', 'SECURITY_ACCESS', 'SNOW_ICE', 'CLEANING_JANITORIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceLocationType" AS ENUM ('INTERIOR', 'EXTERIOR', 'COMMON_AREA', 'BOTH', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "MaintenanceOngoing" AS ENUM ('YES', 'NO', 'INTERMITTENTLY', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "MaintenanceUrgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "MaintenancePropertyScope" AS ENUM ('MY_UNIT', 'HOA_COMMON', 'SHARED', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "MaintenanceEntryPermission" AS ENUM ('YES', 'NO', 'CONTACT_FIRST');

-- CreateEnum
CREATE TYPE "MaintenanceContactMethod" AS ENUM ('EMAIL', 'PHONE', 'TEXT');

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'SUBMITTED';

-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN     "accessInstructions" TEXT,
ADD COLUMN     "category" "MaintenanceCategory",
ADD COLUMN     "entryPermission" "MaintenanceEntryPermission",
ADD COLUMN     "firstObservedAt" TIMESTAMP(3),
ADD COLUMN     "locationType" "MaintenanceLocationType",
ADD COLUMN     "ongoingStatus" "MaintenanceOngoing",
ADD COLUMN     "petsOnProperty" BOOLEAN,
ADD COLUMN     "preferredContactMethod" "MaintenanceContactMethod",
ADD COLUMN     "propertyId" TEXT,
ADD COLUMN     "propertyScope" "MaintenancePropertyScope",
ADD COLUMN     "requestNumber" TEXT,
ADD COLUMN     "residentUrgency" "MaintenanceUrgency",
ADD COLUMN     "specificLocation" TEXT;

-- CreateTable
CREATE TABLE "maintenance_attachments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_attachments_requestId_idx" ON "maintenance_attachments"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_requestNumber_key" ON "maintenance_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "maintenance_requests_submittedById_idx" ON "maintenance_requests"("submittedById");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

