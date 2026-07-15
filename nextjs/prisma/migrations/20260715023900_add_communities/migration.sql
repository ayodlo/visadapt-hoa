-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_assignments_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add communityId nullable everywhere first; NOT NULL is enforced
-- below only after the backfill runs, so existing rows never violate it.
ALTER TABLE "announcements" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "architectural_requests" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "charges" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "documents" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "dues_records" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "events" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "issues" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "maintenance_requests" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "payments" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "polls" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "properties" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "users" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "vendors" ADD COLUMN     "communityId" TEXT;
ALTER TABLE "violations" ADD COLUMN     "communityId" TEXT;

-- Backfill: everything that existed before multi-tenancy belongs to one
-- default community.
INSERT INTO "communities" ("id", "name", "createdAt", "updatedAt")
VALUES ('community_default_seed', 'CommunityHQ Demo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "announcements" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "architectural_requests" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "charges" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "documents" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "dues_records" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "events" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "issues" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "maintenance_requests" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "payments" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "polls" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "properties" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "vendors" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;
UPDATE "violations" SET "communityId" = 'community_default_seed' WHERE "communityId" IS NULL;

-- users.communityId is the RESIDENT's fixed home community only; ADMIN and
-- BOARD_MEMBER use community_assignments instead (multi-community), and
-- SUPER_ADMIN needs neither (unrestricted access to every community).
UPDATE "users" SET "communityId" = 'community_default_seed' WHERE "role" = 'RESIDENT';

-- Give every existing ADMIN and BOARD_MEMBER an assignment to the default
-- community so nobody is locked out post-migration.
INSERT INTO "community_assignments" ("id", "userId", "communityId", "createdAt")
SELECT 'ca_' || "id", "id", 'community_default_seed', CURRENT_TIMESTAMP
FROM "users"
WHERE "role" IN ('ADMIN', 'BOARD_MEMBER');

-- AlterTable: now safe to enforce NOT NULL (audit_logs and users.communityId
-- stay nullable by design).
ALTER TABLE "announcements" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "architectural_requests" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "charges" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "dues_records" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "events" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "issues" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "maintenance_requests" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "polls" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "vendors" ALTER COLUMN "communityId" SET NOT NULL;
ALTER TABLE "violations" ALTER COLUMN "communityId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "community_assignments_userId_communityId_key" ON "community_assignments"("userId", "communityId");

-- CreateIndex
CREATE INDEX "announcements_communityId_idx" ON "announcements"("communityId");

-- CreateIndex
CREATE INDEX "architectural_requests_communityId_idx" ON "architectural_requests"("communityId");

-- CreateIndex
CREATE INDEX "audit_logs_communityId_idx" ON "audit_logs"("communityId");

-- CreateIndex
CREATE INDEX "charges_communityId_idx" ON "charges"("communityId");

-- CreateIndex
CREATE INDEX "documents_communityId_idx" ON "documents"("communityId");

-- CreateIndex
CREATE INDEX "dues_records_communityId_idx" ON "dues_records"("communityId");

-- CreateIndex
CREATE INDEX "events_communityId_idx" ON "events"("communityId");

-- CreateIndex
CREATE INDEX "issues_communityId_idx" ON "issues"("communityId");

-- CreateIndex
CREATE INDEX "maintenance_requests_communityId_idx" ON "maintenance_requests"("communityId");

-- CreateIndex
CREATE INDEX "payments_communityId_idx" ON "payments"("communityId");

-- CreateIndex
CREATE INDEX "polls_communityId_idx" ON "polls"("communityId");

-- CreateIndex
CREATE INDEX "properties_communityId_idx" ON "properties"("communityId");

-- CreateIndex
CREATE INDEX "vendors_communityId_idx" ON "vendors"("communityId");

-- CreateIndex
CREATE INDEX "violations_communityId_idx" ON "violations"("communityId");

-- AddForeignKey
ALTER TABLE "community_assignments" ADD CONSTRAINT "community_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_assignments" ADD CONSTRAINT "community_assignments_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_assignments" ADD CONSTRAINT "community_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_records" ADD CONSTRAINT "dues_records_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architectural_requests" ADD CONSTRAINT "architectural_requests_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
