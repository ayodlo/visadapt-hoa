-- Data-only migration: CommunityHQ -> Portal HOA.
--
-- No schema objects change here. The demo community's name was INSERTed by
-- 20260715023900_add_communities, and an applied migration cannot be edited
-- without breaking Prisma's checksum, so the rename lands in a new migration.
--
-- Every statement is guarded so this is safe to run against a database that has
-- already been re-seeded, partially renamed, or never carried the old values at
-- all: each one matches only rows that still hold the CommunityHQ value.

-- 1. The seeded community's display name.
UPDATE "communities"
SET "name" = 'Portal HOA Demo',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'community_default_seed'
  AND "name" = 'CommunityHQ Demo';

-- 2. Demo account addresses (admin@communityhq.local -> admin@portalhoa.local).
--
-- "email" is UNIQUE, so a row is skipped when its renamed address is already
-- taken -- which happens if `prisma db seed` was run after the rename: the seed
-- upserts on email, so the new addresses get CREATED alongside the old rows
-- rather than renaming them. Without this guard that case would abort the
-- migration on a unique violation.
UPDATE "users" AS u
SET "email" = replace(u."email", '@communityhq.local', '@portalhoa.local'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE u."email" LIKE '%@communityhq.local'
  AND NOT EXISTS (
    SELECT 1
    FROM "users" AS x
    WHERE x."email" = replace(u."email", '@communityhq.local', '@portalhoa.local')
  );

-- 3. The seeded welcome announcement, which names the product in its title and
-- body. Scoped to the exact seeded title so no announcement written by a real
-- community is touched. Delete this statement if you would rather leave
-- existing announcement content exactly as residents first read it.
UPDATE "announcements"
SET "title" = replace("title", 'CommunityHQ', 'Portal HOA'),
    "body" = replace("body", 'CommunityHQ', 'Portal HOA'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "title" = 'Welcome to CommunityHQ!';
