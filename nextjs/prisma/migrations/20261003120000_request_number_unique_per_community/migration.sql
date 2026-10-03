-- Request numbers restart at 0001 in every community, so they can only be unique
-- within one. The global index made a second community's submissions collide with
-- the first's. The new constraint is strictly weaker, so existing rows satisfy it.

-- DropIndex
DROP INDEX "maintenance_requests_requestNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_communityId_requestNumber_key" ON "maintenance_requests"("communityId", "requestNumber");
