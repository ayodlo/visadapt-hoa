# Dev Log

---

## 2026-09-03 (S3 CORS + lifecycle rule for staged uploads)

**Files changed:**
- `nextjs/lib/uploads.ts` — `stagedUploadKey` and `isStagedKeyFor` now lead with `_staging/`: keys are `_staging/communities/<communityId>/<scope>/<uuid>-<name>` instead of `communities/<communityId>/_staging/<scope>/...`.
- `nextjs/__tests__/lib/uploads.test.ts` — 4 assertions updated, 1 test added pinning the key to `/^_staging\//` (250 tests total).
- **Not in the repo:** the CORS policy and lifecycle rule were applied to the `communityhq-documents-test` bucket through the AWS console. Bucket configuration is not in version control — if the bucket is ever recreated, both must be reapplied.

**Decisions made:**
- **`_staging/` leads the key.** DEVLOG 2026-09-02 planned a rule on `communities/*/_staging/`, which cannot work: an S3 lifecycle `Filter.Prefix` is a literal string with no wildcard support, and S3 accepts such a prefix silently — the rule would have been created, looked correct in the console, and never matched anything. Leading with `_staging/` lets one rule cover every tenant. The community segment still follows it, so per-community bucket policies are unaffected.
- **Rejected the alternatives.** Tagging staged objects and using a tag filter would mean signing `x-amz-tagging` into the presigned PUT, having the browser send that exact header, adding it to CORS `AllowedHeaders`, and granting `s3:PutObjectTagging` — four more things to get wrong for the same outcome. One rule per community prefix hits the 1000-rule bucket cap and needs a new rule per tenant.
- **The app's IAM user stays object-scoped.** `dev-visadapt-hoa` gets `AccessDenied` on `s3:GetLifecycleConfiguration` and `s3:GetBucketVersioning`, which is correct — bucket configuration is an admin action, and the runtime key should not be able to change or read it. Applied via the console instead.
- **CORS is `PUT` + `content-type` only.** That is exactly what `MaintenanceRequestForm.tsx` sends; the client reads only `put.ok`, so `ExposeHeaders` stays empty. `GET` is not needed — attachments display through presigned URLs in `<img src>`/download links, which are not CORS requests.

**Next steps:**
1. **`AllowedOrigins` covers only `https://account.portalhoa.com` and `http://localhost:3000`.** Direct uploads will fail on every Vercel preview deployment until `https://*.vercel.app` is added, and on `localhost:3001` when Next shifts port because 3000 is taken.
2. **Bucket versioning status is unknown** — the app key cannot read it. If versioning is on, expiration only writes a delete marker and the staged bytes stay billable; the rule then needs `NoncurrentVersionExpiration`.
3. Carried over: the staff maintenance view still shows none of the rich intake data, and three upload paths still exist (server-relayed events, server-relayed violations, presigned maintenance).

**Gotchas:**
- **`PutBucketLifecycleConfiguration` replaces the entire configuration**, it does not append. Always `get-bucket-lifecycle-configuration` and merge before writing.
- **Expiry is not 24h.** S3 rounds to midnight UTC after the 1-day threshold, so a staged object created 2026-09-03 expires 2026-09-05 00:00 UTC — roughly 24-48h. Fine for abandoned uploads, but do not treat the window as exact.
- **A form open across the deploy loses its attachments.** Staged keys held in browser memory use the old layout, so `isStagedKeyFor` rejects them and `/api/maintenance` returns 400 "An attachment could not be verified. Please re-upload it." Correct behavior, clears on re-upload. No stored data is affected — nothing persists a `_staging/` key.
- **Do not verify a lifecycle rule by waiting for a deletion.** `HeadObject` returns `x-amz-expiration` with the scheduled date and rule id as soon as the rule matches, and needs only `s3:GetObject`.

**Verification:** `tsc --noEmit` clean; `eslint` clean on both touched files; 250 vitest tests passing (249 -> 250). CORS preflight confirmed live against the bucket — `OPTIONS` with `Access-Control-Request-Method: PUT` and `Access-Control-Request-Headers: content-type` returns 200 for both `http://localhost:3000` and `https://account.portalhoa.com`. `scripts/check-s3.ts` passes all four checks (bucket reachable, PutObject, presigned read, DeleteObject). Lifecycle rule confirmed by probe: a `_staging/` object returns `expiry-date="Sat, 05 Sep 2026 00:00:00 GMT", rule-id="expire-staged-uploads"`, while an existing `communities/.../violations/...` attachment returns no expiration header. Probe object deleted. Bucket held only 2 objects before this work, both violation attachments, and `_staging/` was empty — so no old-layout keys needed cleaning up.

---

## 2026-09-02 (Presigned direct-to-S3 uploads for maintenance attachments)

**Files changed:**
- `nextjs/lib/s3.ts` — added `getPresignedUploadUrl` (presigned PUT), `headS3Object`, `copyS3Object`.
- `nextjs/lib/uploads.ts` — `MAX_DIRECT_UPLOAD_BYTES` (25 MB), `validateDirectUpload`, upload scopes, `stagedUploadKey`, `isStagedKeyFor`, `maintenanceAttachmentKey`.
- `nextjs/app/api/uploads/presign/route.ts` (new) — issues one short-lived (5 min) upload URL per object.
- `nextjs/app/api/maintenance/route.ts` — accepts `attachmentKeys[]`, verifies each against S3, then promotes them out of staging.
- `nextjs/components/maintenance/MaintenanceRequestForm.tsx` — files upload on pick, with per-file status and retry; submit is blocked while any upload is unfinished.
- `nextjs/__tests__/lib/uploads.test.ts` — 10 new tests (249 total).

**Decisions made:**
- **Presigned PUT + `HeadObject`, not `createPresignedPost`.** The POST-policy form can have S3 enforce `content-length-range` directly, but it lives in `@aws-sdk/s3-presigned-post`, which is not installed — and new dependencies need approval. The stored object is verified server-side before any DB row is written, so size is still enforced; it is just enforced after the bytes land rather than during. Worth revisiting with that one package.
- **Uploads happen on pick, not on submit.** This is the whole point of the change: a storage failure now surfaces on the Attachments step, next to the file, with a Retry — the form cannot be submitted referencing a file that never stored.
- **Staged objects are copied out of `_staging/`, never left there.** A lifecycle rule that expires abandoned uploads would otherwise delete confirmed attachments.
- **The server chooses every key.** The client only echoes back keys the server issued, and `isStagedKeyFor` re-checks the community and scope prefix — a forged key is rejected before the request is created.

**Next steps:**
1. **Bucket CORS is required before this works in a browser** — see Gotchas for the policy.
2. Add an S3 lifecycle rule expiring `communities/*/_staging/` after ~1 day.
3. Events and violations still use the server-relayed multipart path (4 MB cap). Three upload paths now exist; worth consolidating.

**Gotchas:**
- **The browser PUT needs a bucket CORS policy** allowing `PUT` from the app origins, or the preflight fails and the upload never starts. Server-relayed uploads never needed this because the browser only ever talked to our own origin.
- **`browser.newContext()` in Playwright inherits the project's `storageState`**, so an "anonymous" request is silently authenticated — an early version of the auth test reported 200 and looked like an unauthenticated endpoint. Use `request.newContext()` and assert the cookie count is 0. Re-verified: both routes return 401 without a session.
- The presigned URL is generated by local crypto, so a valid-looking signed URL proves nothing about the bucket existing. Verified the host, key shape, and `X-Amz-Signature`; the actual PUT is still unverified locally because `.env.local` points at a bucket that does not exist.

**Verification:** `tsc` clean; `eslint` clean (same 2 pre-existing warnings); 249 vitest tests (239 → 249); `next build` succeeds; Playwright 35 passing with the 2 known pre-existing failures. Server-side checks verified live: disallowed type, oversized declaration, unknown scope and forged key all rejected 400, with **no request created**; a valid call returns a server-chosen key matching `communities/<id>/_staging/maintenance/<uuid>-<name>`; unauthenticated calls return 401.

---

## 2026-09-02 (Resident maintenance submission form — deliverable #15)

**Files changed:**
- `nextjs/lib/maintenance.ts` (new) — the vocabulary (18 categories, location types, urgency, ongoing status, property scope, entry permission, contact method), length caps, specific-location map, `needsAccessDetails`, `formatRequestNumber`, and both zod schemas. One definition feeds the Prisma enums, the form controls and the server validation.
- `nextjs/prisma/schema.prisma` + `migrations/20260902120000_expand_maintenance_requests/` — expanded `MaintenanceRequest` (requestNumber, category, locationType, specificLocation, residentUrgency, firstObservedAt, ongoingStatus, propertyScope, entryPermission, accessInstructions, petsOnProperty, preferredContactMethod, propertyId), added `MaintenanceAttachment`, added `SUBMITTED` to `RequestStatus`.
- `nextjs/app/api/maintenance/route.ts` — GET now scopes residents to their own requests; POST validates, verifies property ownership, and allocates a request number.
- `nextjs/app/api/maintenance/[id]/attachments/route.ts` (new) — GET/POST, same bucket as events and violations under a `maintenance/` prefix.
- `nextjs/components/maintenance/MaintenanceRequestForm.tsx` (new) — the 5-step form.
- `nextjs/app/dashboard/maintenance/page.tsx` — residents get the wizard, staff keep quick entry; adds `SUBMITTED` styling and the request number.
- `nextjs/__tests__/lib/maintenance.test.ts` (new, 21 tests) and `nextjs/e2e/maintenance-form.spec.ts` (new, 13 tests).
- `nextjs/e2e/maintenance.spec.ts` — resident test rewritten for the wizard.

**Decisions made:**
- **Two server schemas, not one loosened schema.** Residents must satisfy the full resident schema server-side; staff may also post the quick-entry shape (title/description/priority). Making the new fields optional would have meant resident required-fields were only enforced in the browser, which the requirements forbid. Inventing a `residentUrgency` for a staff-logged request would have been worse — fabricated data.
- **Server assigns tenancy.** `communityId` and `submittedById` come from the session and are absent from the schema entirely. A supplied `propertyId` is re-queried against the community *and* the owner before use — a foreign id returns 403 before anything is created (covered by a test).
- **Request numbers** are `MR-<year>-<seq>`, derived from a per-community per-year count, retried on the unique-index collision. The index is the real guarantee; the retry just converts a race into another attempt.
- **Attachments upload after the request is created**, so a storage failure never costs the resident the form they filled in; failed filenames are reported and the request still succeeds.
- **Access step is skipped entirely** unless the request concerns a private property (`MY_UNIT`/`SHARED`), and the progress indicator shows it struck through.
- Reused the existing `lib/uploads.ts` validation and `lib/s3.ts` rather than adding a third upload pattern (presigned direct-to-S3 was requested but needs bucket CORS — see Next steps).

**Next steps:**
1. **Admin side.** The intake now collects entry permission, pets, access instructions, urgency and attachments, but the staff maintenance view is still a status dropdown — none of it is visible during triage. The rich data has nowhere to be read.
2. **Presigned direct-to-S3 uploads**, which the requirements preferred, still need a bucket CORS policy. Until then attachments are capped at 4 MB by Vercel's request-body limit.
3. Prod needs `prisma migrate deploy` before this ships.
4. `MaintenanceRequest` and `Issue` remain two parallel resident-submission systems, both in the nav. Worth a product decision.

**Gotchas:**
- **`prisma migrate dev` cannot run here** — it is interactive, and the new unique index on `requestNumber` triggers a confirmation prompt. Generate with `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script` into a timestamped folder, then `prisma migrate deploy`. Verified the SQL contained zero `DROP`/`DELETE`/`TRUNCATE`.
- **Deriving zod enums with `.map()` widens them to `string`** and breaks assignability to the generated Prisma enum types. `lib/maintenance.ts` keeps the literal tuple via a mapped type (`ChoiceValues`) instead.
- **`getByRole('button', { name: 'Next' })` is ambiguous in dev** — Next.js injects an "Open Next.js Dev Tools" button whose name contains "Next". Use `exact: true`.
- Tightening `POST /api/maintenance` would have broken the staff quick-entry form, which posts `{title, description, priority}`. Checked first that no mobile client posts to this route — none does.
- The success screen only appears because the page no longer closes the form on submit; an earlier version called `setShowForm(false)` in `onSubmitted` and destroyed the request number before it could be read.

**Verification:** `tsc --noEmit` clean; `eslint` clean (same 2 pre-existing warnings); 239 vitest tests (218 → 239); `next build` succeeds; Playwright 35 passing with the 2 known pre-existing failures (`theme`, `users`). E2E covers required-field validation, conditional specific-location choices, step navigation and skipping, the emergency warning and its `aria-describedby`, state preservation across Back/Next, successful submission showing `MR-2026-####` and `SUBMITTED`, resident-only list scoping, rejection of out-of-vocabulary values, and the cross-property 403. Test data removed from the dev DB afterwards.

---

## 2026-09-01 (Optional event feature image — deliverable #10)

**Files changed:**
- `nextjs/prisma/schema.prisma` + `migrations/20260901025226_add_event_image/` — one additive nullable column: `Event.imageKey`. Applied to the Neon dev DB via `migrate dev`. **Not yet applied to prod** — needs `migrate deploy`.
- `nextjs/lib/uploads.ts` (new) — shared, pure upload rules: allowed MIME types, 5 MB cap, `validateImage`, `formatBytes`, `eventImageKey`. Imported by both the API route and the browser form so one definition governs both sides.
- `nextjs/lib/s3.ts` — added `getPresignedViewUrl`. The existing `getPresignedDownloadUrl` sets `Content-Disposition: attachment`, which makes an `<img>` fail, so inline display needed its own helper.
- `nextjs/app/api/events/[id]/image/route.ts` (new) — POST (multipart) and DELETE. Staff-only, community-scoped.
- `nextjs/app/api/events/route.ts` — GET strips `imageKey` and returns a presigned `imageUrl` instead.
- `nextjs/app/api/events/[id]/route.ts` — DELETE now removes the S3 object too, so deleting events can't orphan objects.
- `nextjs/app/dashboard/events/page.tsx` — optional file input with client-side validation, live preview, "Remove image", and a feature image on the card rendered only when one exists.
- `nextjs/.env.example` — documented what the AWS block is actually for.
- `nextjs/__tests__/lib/uploads.test.ts` (new) — 12 tests.

**Decisions made:**
- **Reused `lib/s3.ts` rather than adding a storage provider**, per the deliverable. Worth knowing: that module was **dead code** — nothing imported it. Documents only ever stored an admin-pasted `fileUrl` string; no upload pipeline existed. This is the first real writer.
- **Image upload is a second request, not part of `POST /api/events`.** Keeps the JSON create contract intact for the mobile client (`mobile/src/api/events.ts` reads this endpoint) and lets an image be attached to an existing event later.
- **Bucket stays private; the client gets a 1-hour presigned URL.** `imageKey` never leaves the server. Consistent with how documents were designed to work, and avoids a public-read bucket policy.
- Upload to S3 happens *before* the DB write, so a storage failure can't leave an event pointing at an object that was never stored. Replacing an image deletes the old object best-effort.
- Keys are `communities/<communityId>/events/<eventId>/<uuid>.<ext>` — tenant-prefixed for bucket policies/lifecycle rules, UUID-suffixed so a replacement never collides with what it replaces.
- Used a plain `<img>`, not `next/image`: sources are presigned URLs on a private bucket that change every hour, which defeats the optimizer's caching and would need `remotePatterns` for a host that varies per deployment.

**Next steps:**
1. **`AWS_S3_BUCKET` in `.env.local` names a bucket that does not exist** — verified directly: credentials authenticate (the error is `NoSuchBucket`, not an auth failure) but the bucket is absent. Create it (or point the var at a real one) and the upload path works end to end; until then the UI correctly reports "Could not store the image."
2. Run `prisma migrate deploy` against prod before deploying, and confirm `AWS_*` is set in Vercel — flagged as unconfirmed since the 07-28 handoff.
3. `lib/uploads.ts` is deliberately generic: violation attachments (#14) and real document uploads (#18) can reuse `validateImage` and the key-naming pattern.

**Gotchas:**
- **The S3 round trip has never actually succeeded** — no real bucket exists, so `uploadToS3` is exercised only through its failure path. The graceful-failure behaviour *is* verified; the success path is not. Test it the moment a bucket exists.
- Presigning is local signing, not a network call, so mapping keys → URLs in the events list adds no latency and works even against a non-existent bucket — it just yields a URL that 404s. Signing failures degrade to `imageUrl: null` rather than failing the whole list.
- Two Playwright selector traps hit while verifying, both worth knowing: Next injects `<div role="alert" id="__next-route-announcer__">` into every page, so `getByRole('alert')` is never unique — scope to the element's own id. And the new events search box placeholder contains "title", so `getByPlaceholder('Title')` now matches two inputs — scope to `form`.

**Verification:** `tsc --noEmit` clean; `eslint` clean (same 2 pre-existing warnings); 185 vitest tests pass (173 → 185); `npm run build` succeeds. Browser-verified against the dev DB: events with no image render **no `<img>` at all** (0 elements, no placeholder frame); a PDF is rejected client-side with "Choose a JPEG, PNG, WebP, or GIF image."; a 6 MB file is rejected with "Image must be 5.0 MB or smaller (that one is 6.0 MB)."; a valid image shows a preview; and on submit against the missing bucket the event is still created, the error is surfaced, and `imageKey` stays `null` — no broken reference stored. Full Playwright suite: 24 pass, same 3 pre-existing failures. Test event removed from the dev DB afterwards.

---

## 2026-08-31 (List search / filter / sort across /dashboard — deliverables #8, #9, #21)

**Files changed:**
- `nextjs/lib/list-controls.ts` (new) — generic engine. A list describes its columns once as `ListField<T>[]` (`key`, `label`, `type`, `value`, optional `text`, `filterable`, `sortable`); `searchRows` / `filterRows` / `sortRows` / `distinctValues` / `applyListControls` all derive from that one description, so adding a column makes it searchable, filterable, and sortable at once. Pure and Prisma-free.
- `nextjs/hooks/useListControls.ts` (new) — first file in a new `hooks/` directory. Holds search/filter/sort state and memoises the visible rows.
- `nextjs/components/ui/ListToolbar.tsx` (new) — search + per-column filter selects + (for card lists) a sort dropdown and direction toggle, a Clear button, and an "N of M" count. Reuses the existing `SearchInput` and `FilterSelect`.
- `nextjs/components/ui/SortableTh.tsx` (new) — clickable column header with `aria-sort`; exports `PlainTh` for non-sortable columns.
- Wired into all six `/dashboard` list views: `users`, `communities`, `dues` (sortable headers) and `maintenance`, `events`, `polls` (sort dropdown, since they render cards not tables).
- `nextjs/__tests__/lib/list-controls.test.ts` (new) — 25 tests.
- `nextjs/app/api/documents/route.ts` — GET now accepts `sort` (whitelist: `title`, `category`, `fileName`, `createdAt`) and `dir`; defaults unchanged at `createdAt desc`. Search widened to cover `fileName` alongside title and description.
- `nextjs/components/documents/DocumentList.tsx` — new opt-in `showSort` prop adding a sort dropdown + direction toggle; changing sort resets to page 1.
- `nextjs/app/admin/documents/page.tsx` — passes `showSort`.

**Decisions made:**
- **Client-side.** Every one of these screens already fetches its whole collection in one request, so filtering in the browser keeps typing instant and adds no round trips. The `ListField` descriptors are the natural thing to translate into query params if a collection ever outgrows one response.
- **Filter = exact match on distinct values present in the data**, options built from the *unfiltered* rows so a filter never hides its own alternatives. Filters, search, and sort combine (filter → search → sort).
- **Filters were applied to low-cardinality columns only** (Role, Status, Priority, Submitted by, Label, Resident, State, Location, Created by). Name/Email/Title-style columns are covered by search instead — a dropdown of 26 distinct emails helps nobody. Every column is still sortable and searchable.
- Blank values sort last in *both* directions, so a descending sort doesn't open with a wall of empty cells.
- `sortRows` copies before sorting — never mutates React state arrays.
- An unknown filter key drops every row rather than silently passing them through, so a typo'd key fails loudly.

**Next steps:**
- `/dashboard/announcements` and `/dashboard/documents` are only redirects to `/admin/*` or `/resident/*` equivalents. `/admin/{announcements,issues,violations,architectural-requests,payments}` already have bespoke search/filter and were left alone — retrofitting them onto the shared toolbar is optional cleanup, not a gap.
- Resident and board document views deliberately still have no sort (see `showSort` below); flip the prop if that parity is wanted.
- If literal "filter by *every* column" is wanted, flip `filterable: true` on the remaining fields — the engine already supports it.

**Gotchas:**
- **`e2e/users.spec.ts:30` now finds 2 comboboxes, not 1.** It asserts a board member sees zero `combobox` roles. It was *already* failing on 1 (the multi-tenancy `CommunitySwitcher`); the new read-only Role *filter* is the second. The test's intent — no role-*editing* selects for board members — still holds, since those remain gated behind `isAdmin`. The selector is simply too broad and should target the editing selects by accessible name. Left failing rather than rewritten.
- `/dashboard/communities` is SUPER_ADMIN-only (`layout.tsx` redirects everyone else to `/dashboard/users`), so verifying it needs the `superadmin@communityhq.local` account, not the ADMIN demo user.
- The dev DB has **0 dues records**, so `/dashboard/dues` shows its "No dues records yet" state and no toolbar — the toolbar deliberately sits inside the non-empty branch. Not a bug; don't chase it.
- Filter option labels are just "All", not "All <column>" — pluralising arbitrary headers produces "All statuss".
- **`/admin/documents` already had search + a category filter**; they live in the shared `DocumentList`, not in `app/admin/documents/page.tsx`, so grepping the page file alone reports "no controls" and is wrong. Only sort was genuinely missing.
- The documents list is **server-paginated (12/page)**, so its sorting had to go in the API — client-side `useListControls` would only have sorted the visible page. That is why documents uses a different mechanism from the six `/dashboard` lists.
- `DocumentList` is shared by admin, board, and resident. Sort is behind an opt-in `showSort` prop (default false) so only `/admin/documents` changed; verified the resident view still renders no Sort control.

**Verification:** `tsc --noEmit` clean; `eslint` clean (same 2 pre-existing warnings in `dashboard/users/[id]/page.tsx`); 173 vitest tests pass (148 → 173); `next build` succeeds. Browser-verified per page: search narrows, filters combine with search, Clear restores the full set, and column sort flips `aria-sort` with the row order exactly reversed. Full Playwright suite: 24 pass, the same 3 pre-existing failures as on `main` (`dues`, `theme`, `users`) — confirmed unchanged by stashing this work and re-running.

---

## 2026-08-31 (Dashboard historical trend charts — deliverable #5)

**Files changed:**
- `nextjs/lib/metrics-shared.ts` (new) — types, constants, and pure helpers (`truncate`, `nextBucket`, `bucketRange`, `bucketLabel`, `zeroFill`, `runningTotal`, `periodChange`, `resolveRange`, formatters). Split out from `lib/metrics.ts` for the same reason `lib/roles.ts` is split from `lib/auth.ts`: client components cannot import anything that pulls in Prisma.
- `nextjs/lib/metrics.ts` (new) — query layer. `getTimeseries(communityId, metric, granularity, from, to)` over Postgres `date_trunc` via `$queryRaw`.
- `nextjs/app/api/admin/metrics/timeseries/route.ts` (new) — staff-only, community-scoped, Zod-validated; mirrors `app/api/admin/reports/payments/route.ts`.
- `nextjs/components/dashboard/{MetricChartCard,TrendChart,MetricTable,RangeSelector}.tsx` (new) — card shell with line/bar/table toggles, W|M|Q|Y granularity, CSV export, and a help toggle; `TrendChart.tsx` is the only file importing `recharts`.
- `nextjs/app/admin/dashboard/page.tsx` — new "Trends" section with four cards; reads `searchParams.range` (Next 16: `searchParams` is a Promise) and server-renders the first paint.
- `nextjs/app/globals.css` — added `--chart-series`/`--chart-series-fill`/`--chart-grid`/`--chart-axis`, chosen per theme rather than inherited.
- `nextjs/e2e/setup/auth.setup.ts` — **fixed**: still clicked the demo-account buttons that commit 4053da9 removed from the login page, which broke the setup project and therefore every e2e test. Now fills credentials directly, matching what 4053da9 did to `auth.spec.ts`.
- `nextjs/package.json` + root `package-lock.json` — added `recharts@3.10.1`.
- `nextjs/__tests__/lib/metrics-shared.test.ts` (new) — 35 tests.

**Decisions made:**
- **Recharts 3.10.1** over Chart.js/uPlot/hand-rolled SVG. It is the heaviest (7.45 MB unpacked; pulls @reduxjs/toolkit, react-redux, immer, d3 via victory-vendor) but SVG-based, so it inherits the CSS-variable dark theme; both canvas options would need JS theme plumbing and a re-render on every toggle. Pure JS, so the npm/cli#4828 native-binding trap does not apply. Contained behind `TrendChart.tsx` so swapping it touches one file.
- **Charges are bucketed on `dueDate`, never `createdAt`.** `prisma/seed.ts` never sets `createdAt`, so every seeded charge carries the seed-run timestamp and would collapse into one bucket.
- **Unpaid balance is derived, not stored:** `Σ charges due ≤ T − Σ payments paid ≤ T`. No schema change. Verified against the dev DB: the final bucket is 585000, exactly matching the StatCard's `Σ(PENDING+OVERDUE)`.
- Hero number is the latest value for the cumulative balance but the **range total** for per-period flows — the newest bucket is a partial period, so flows would headline `$0.00`.
- Granularity is parameterized into `date_trunc($1, col)`, plus a whitelist guard; table fragments come from a closed set, never input.

**Next steps:**
- Extend the same cards to the board dashboard (resident has no equivalent metrics).
- Optional 3rd card set: "Issues by Category" — `lib/dashboard.ts` already returns `issuesByCategory`, no new query needed.
- Consider `Charge.paidAt` + `Payment.chargeId` for exact charge-level history (see Gotchas). Not done here: backfilling existing rows would mean inventing timestamps.

**Gotchas:**
- **The seeded ledger goes negative for early months, and it is not a bug.** `prisma/seed.ts` stamps `paidAt = dueDate − 2 days`, so the payment settling March dues (due 3/1) lands in the *February* bucket. Cumulatively that is a real credit balance. Confirmed by bucket dump: payments run 2026-02..2026-07, charges 2026-03..2026-07. If the demo should show a monotonically rising balance, change the seed so `paidAt` falls *after* `dueDate` — do not "fix" the ledger math.
- **`next dev` served stale CSS for hours.** The dashboard's dark chart tokens silently fell back to light values; the served `[data-theme="dark"]` rule was missing them entirely while the `:root` ones from the *same* editing session were present. The dev server (PID started 1:16 PM) never picked up a later `globals.css` edit — likely OneDrive breaking file watching. Playwright's `reuseExistingServer: true` hides this. **Restart the dev server before trusting any CSS-level verification**, and probe `getComputedStyle` rather than eyeballing a screenshot.
- `prisma generate` can fail with `EPERM ... query_engine-windows.dll.node` when a node process holds the DLL. `next build` alone works if the client is already generated.
- Three e2e specs fail on `main` **independent of this work** — verified by stashing and re-running: `dues.spec.ts` (create dues record), `theme.spec.ts` (toggle persists across reload), `users.spec.ts` (board member roster expects 0 comboboxes, but the CommunitySwitcher is one). 24 pass.

**Verification:** `tsc --noEmit` clean; `eslint` clean (2 pre-existing warnings in `dashboard/users/[id]/page.tsx`); 148 vitest tests pass (113 → 148); `next build` succeeds; Playwright run of the admin dashboard shows no console errors, and a `getComputedStyle` probe confirms the series/grid tokens resolve per theme (dark `#60a5fa`/`#263757`, light `#2563eb`/`#e5e7eb`).

---

## 2026-07-28 (Production database provisioned; Resend domain still unverified)

**Files changed:** none — this session was operational only (running scripts against remote databases), no code edits.

**Decisions made:**
- Created a **new, separate Neon project** for production rather than reusing the existing dev project's branch labeled "production" — that label was misleading, it's just Neon's default branch name, and its endpoint (`ep-fancy-dew-aff252a0`) matched dev's `.env.local` exactly, confirming it was the same database (full of demo/seed/Playwright test data). The genuinely new prod project has endpoint `ep-weathered-leaf-afn90pdb`.
- Declined Neon Auth (a dashboard upsell prompt) — app already has a complete custom JWT/bcrypt auth system deeply wired through ~55 routes and the mobile Bearer-auth flow; adopting it would mean re-architecting user identity for no gain.
- Ran all 4 existing migrations (`0_init` → `add_communities`) against the new prod DB via `prisma migrate deploy` — schema only, zero seed data.
- Created SUPER_ADMIN `devonlewis808@gmail.com` on both dev and the new prod DB (same password both places, user's choice).
- Created a second SUPER_ADMIN `justin@justhodges.com` on both dev and prod, via `npm run create-super-admin`.
- User then set the new `DATABASE_URL` (and presumably other prod env vars) in Vercel directly and redeployed — confirmed working by logging into the live site as SUPER_ADMIN.

**Next steps:**
1. **Unresolved this session:** password-reset emails are failing with a Resend 403 (`from: noreply@notifications.portalhoa.com`). Almost certainly the `notifications.portalhoa.com` sending domain isn't verified in Resend yet (needs SPF/DKIM DNS records added at wherever `portalhoa.com` DNS lives). Was waiting on the user to check Resend's Domains tab when the session ended — pick this up first next time.
2. Confirm all prod Vercel env vars are actually set, not just `DATABASE_URL` — `JWT_SECRET` (should be unique, not reused from dev), `RESEND_API_KEY`, `EMAIL_FROM`, `AWS_*`, `NEXT_PUBLIC_APP_URL`. Login/dashboard working confirms DB+JWT are fine; Resend is confirmed broken; AWS/S3 unconfirmed either way.
3. Consider rotating the new prod Neon DB password (`npg_n7jt4ElsUqAw`) — it was pasted in plaintext into this chat session while wiring it into Vercel.
4. Still-open from the 07-15 handoff, untouched this session: clean up "Playwright Test HOA*" demo data on the **dev** DB, confirm CI green, mobile device smoke test, `eas init` for push notifications, Stripe payments, mobile board-role user-management screens.

**Gotchas:**
- **A Neon branch named "production" is not proof of a separate database** — Neon auto-names a new project's default branch "production" regardless of what it's actually used for. Always diff the actual connection-string host/endpoint ID, not the branch label, before trusting "this is prod."
- `create-super-admin` (and any other `tsx`/prisma script run directly, not through `next dev`) does **not** read `.env.local` automatically — `DATABASE_URL` must be exported/prefixed explicitly on every invocation, or it silently targets whatever's already in the shell env.
- `app/api/auth/forgot-password/route.ts` intentionally swallows email-send errors (`.catch(() => {})`) so the API response never reveals whether an account exists (security-by-design) — this also means the UI shows "success" even when Resend fails outright. Resend's own dashboard **Logs** tab is the actual source of truth for delivery failures, not the app's response.

---

## 2026-07-15 (Session handoff — multi-tenancy shipped, next steps)

**State at close:** All 4 multi-tenancy phases (schema → route scoping → web UI → mobile UI) committed, pushed, and deployed. Vercel deploy confirmed green after the optionalDependencies fix (see the two fix entries below). nextjs: tsc clean, 113 vitest tests green. mobile: tsc clean, 243 jest tests green, expo lint clean (one pre-existing useMemo warning).

**Next steps (user):**
1. Verify the deployed app runs against a migrated database — the multi-tenancy migration was only applied to the Neon dev DB. If Vercel's DATABASE_URL points elsewhere, run `npx prisma migrate deploy` against that DB first. Quick check: log into the deployed site; if the dashboard loads, the schema is there.
2. Smoke-test deployed web flows as superadmin@communityhq.local: switcher in sidebar, /dashboard/communities, switching isolates data, resident login still works. Note: the dev DB contains leftover "Playwright Test HOA*" communities + a test resident from automated verification — harmless, delete manually if unwanted (no community-delete UI exists; use Prisma Studio).
3. Confirm GitHub Actions (ci.yml + mobile-ci.yml) is green post-push — Vercel green only covers the deploy build, and the lockfile changed this session.
4. Mobile smoke test on iPhone via Expo Go: `npx expo start` in mobile/, scan QR. Check More → Communities (switching), More → Users → New (multi-community picker as SUPER_ADMIN), More → Users → [resident] → Properties add/remove. No simulator/device verification has happened yet — only jest/tsc/lint.
5. `eas init` against a real Expo account so push notifications work on physical devices (known gap, fails silently until then).

**Next steps (next Claude session):**
- If mobile smoke test (step 4) surfaces issues, that's the likely first task.
- Backlog, roughly in order of prior discussion: board-role user-management screens on mobile (pre-existing parity gap, now more visible since community assignment/properties live there); Resend email wiring; real S3 document upload; Stripe payments; store submission per mobile/STORE_SUBMISSION.md.
- Remember: @tailwindcss/oxide-linux-x64-gnu is pinned exact (4.3.1) in nextjs/package.json optionalDependencies — bump it in lockstep with any Tailwind upgrade or Vercel builds break. Same pattern (direct optionalDependency, NOT a build-time npm install) for any future missing-native-binding failure on Vercel.
- No uncommitted work, no pending decisions, no half-finished code.

---

## 2026-07-15 (fix v2: Vercel deploy — the build-time npm install approach backfired)

**Files changed:**
- `nextjs/scripts/fix-native-deps.js` — DELETED (the fix from the previous entry, reverted after one failed deploy).
- `nextjs/package.json` — `build` script reverted to plain `prisma generate && next build`; added `optionalDependencies: { "@tailwindcss/oxide-linux-x64-gnu": "4.3.1" }`.
- `package-lock.json` — regenerated with npm 11.6.1 (the version CI pins). Diff verified: only the new binding entry plus `dev` → `devOptional` flag flips on packages now reachable through both trees; zero packages removed.

**What happened:** The build-time `npm install <binding> --no-save` from the previous fix ran fine but logged `added 1 package, and removed 349 packages` — Vercel's build environment puts npm in production mode, so any mid-build `npm install` prunes every devDependency, which deleted `@tailwindcss/postcss` and failed the build one step later. The same trick survives in GitHub Actions only because Actions doesn't set production mode.

**Decision:** Switched to the standard npm/cli#4828 workaround — declare the platform binding as a *direct* `optionalDependency` (npm only drops *transitive* optional deps inside workspaces, never direct ones), so Vercel's own install step brings it in and no npm invocation happens at build time. os/cpu gating in the binding's own package.json means Windows/macOS installs skip it automatically. Lockfile change approved by the user before making it.

**Gotchas:**
- The binding version is pinned exact (`4.3.1`, no caret) because it must identically match `@tailwindcss/oxide`'s version to load — **when Tailwind is upgraded, this pin must be bumped in the same change** or the Vercel build regresses.
- The CI rolldown workaround in `.github/workflows/ci.yml` still uses the mid-build `npm install` approach. It works there (no production mode) and was left untouched, but if it ever breaks the same optionalDependencies pattern is the fix.

**Verification:** `tsc` + vitest (113) green on nextjs; full mobile jest suite (243) green after the root reinstall. Real confirmation still requires the next Vercel deploy on Linux.

---

## 2026-07-15 (fix: Vercel deploy failure — @tailwindcss/oxide native binding)

**Files changed:**
- `nextjs/scripts/fix-native-deps.js` (new) — no-ops on any platform other than Linux x64; otherwise checks whether `@tailwindcss/oxide-linux-x64-gnu` actually resolves and, if not, explicitly `npm install`s it at the exact version declared by `@tailwindcss/oxide`.
- `nextjs/package.json` — `build` script now runs this before `prisma generate && next build`.

**Decisions made:**
- Same root cause already documented for rolldown in `.github/workflows/ci.yml` (npm/cli#4828 — npm workspaces on Linux silently drop a valid, correctly platform-gated optional dependency), just a different native binding. It only surfaced now because CI never runs a real `next build` (only tests/lint/tsc), so the Tailwind v4 native binding gap was invisible until an actual Vercel deploy hit it. Applied the same fix pattern (explicit reinstall of the missing platform binary) rather than something novel.

**Gotchas:**
- The build log also showed a warning: `Both outputFileTracingRoot and turbopack.root are set, but they must have the same value` — Vercel auto-injects `outputFileTracingRoot` for monorepo builds, which conflicts with the `turbopack.root` pinned in `next.config.ts` (that pin exists to fix a *different*, dev-server-only module resolution bug — see Phase 3's DEVLOG entry). Left untouched: it's a warning, not the failure, and touching it risks reintroducing the dev-only bug it was added to fix. Worth watching if a real resolution error shows up on Vercel later.

**Verification:** Script confirmed to no-op cleanly on Windows (dev machine). Full effect can only be confirmed by the next real Vercel build on Linux — not yet observed, since this session doesn't push to remote on its own.

---

## 2026-07-15 (Multi-tenancy Phase 4 — Mobile UI parity: switcher, assignments, properties)

**Files changed:**
- `nextjs/lib/community.ts` — `getActiveCommunityId` now also accepts the active community via an `X-Active-Community` request header (cookie still wins if both are present). Required plumbing: the mobile app authenticates with a Bearer token and never sends cookies, so the web switcher's cookie-based design had no way to work over Bearer auth at all until this.
- `mobile/src/types/auth.ts` — `SessionUser.communityId` added (hand-mirrored from `nextjs/lib/auth.ts`, per the file's existing convention).
- `mobile/src/api/client.ts` — `setActiveCommunityId()` + `X-Active-Community` header injection, mirroring the existing `setAuthToken`/Bearer-header pattern.
- `mobile/src/auth/AuthContext.tsx` — bootstraps and persists the active community (secure storage key `communityhq_active_community`, mirroring the token key) on login and cold-start restore; exposes `activeCommunityId`, `communities`, `switchCommunity()`.
- `mobile/app/_layout.tsx` — root `<Stack>` now keyed by `activeCommunityId`, forcing a full remount of every screen on a community switch.
- `mobile/src/screens/shared/CommunitiesScreen.tsx` (new) — list + switch, SUPER_ADMIN-only creation; thin route wrappers at `app/(admin)/more/communities/` and `app/(board)/more/communities/`, added to both "more" menus.
- `mobile/src/components/CommunityMultiSelect.tsx` (new) — checkable list reused by the user create/edit screens.
- `mobile/app/(admin)/more/users/new.tsx` — SUPER_ADMIN creating an ADMIN/BOARD_MEMBER now sees the multi-select.
- `mobile/app/(admin)/more/users/[id].tsx` — rewritten to fetch via a new `getUser(id)` detail endpoint instead of `listUsers().find()`; shows community info for residents, editable (SUPER_ADMIN) or read-only (everyone else) assignments for staff, and a Properties list/add/remove section for residents.
- `mobile/src/api/community.ts`, `mobile/src/api/properties.ts` (new) — thin wrappers over the Phase 3 web API routes, reused as-is.

**Decisions made:**
- Applied the Phase 3 lesson proactively rather than rediscovering it: most mobile screens fetch their own data once via `useApi` on mount, so switching communities needs a full remount (keying the root `<Stack>` by `activeCommunityId`), not just a local state update — the RN equivalent of the web fix's full page reload.
- Kept the mobile Properties/community-assignment UI on the existing admin `users/[id]` screen only, matching the original plan's exact scope — board members have no user-management screen on mobile at all (a pre-existing web/mobile parity gap, out of scope for this retrofit).

**Gotchas:**
- Found a real bug via `expo lint` before it shipped: the `useEffect` loading properties on the user detail screen called `setState` after an `await` inside the effect body — same legitimate pattern as `useApi.ts`'s `load()`, needing the same `eslint-disable-next-line react-hooks/set-state-in-effect` treatment (the codebase's own established precedent, not a new exception).
- Rewriting `[id].tsx` to use a new `getUser()` endpoint instead of `listUsers().find()` broke the existing `EditUser.test.tsx`/`NewUser.test.tsx` mocks (they mocked `listUsers`, and `NewUser` gained a `useAuth()` call the test never mocked, so it threw with no `AuthProvider`) — updated both test files accordingly rather than skipping them.

**Verification:** `tsc --noEmit` clean on both `nextjs/` and `mobile/`; full mobile jest suite (54 suites, 243 tests, up from 236) passing; `expo lint` clean except one pre-existing `useMemo` dependency warning in `AuthContext.tsx` that predates this session (confirmed via `git show HEAD:...` against the prior commit). This completes all 4 phases of the multi-tenancy retrofit (schema → route scoping → web UI → mobile UI).

---

## 2026-07-15 (Multi-tenancy Phase 3 — Web UI: switcher, communities, assignments, properties)

**Files changed:**
- `nextjs/components/CommunitySwitcher.tsx` (new) — client dropdown for staff roles, fetches `/api/community/mine`, posts to `/api/community/select` on change, then does a full `window.location.reload()`. Wired into `Sidebar.tsx` and `MobileNav.tsx`.
- `nextjs/app/api/admin/communities/route.ts` (new) — GET (list all + `_count` of users/assignments/properties) and POST (create), SUPER_ADMIN only.
- `nextjs/app/dashboard/communities/{layout,page}.tsx` (new) — SUPER_ADMIN-only list + create page, mirroring the existing `/dashboard/users` structure. Added to `lib/nav.ts` for SUPER_ADMIN.
- `nextjs/app/api/users/[id]/communities/route.ts` (new) — PUT, SUPER_ADMIN only, replaces the full `CommunityAssignment` set for an ADMIN/BOARD_MEMBER user (transaction: delete all + recreate).
- `nextjs/app/api/users/route.ts` — POST now accepts optional `communityIds[]`, honored only for SUPER_ADMIN assigning a new ADMIN/BOARD_MEMBER to more than one community (defaults to the creator's active community otherwise). GET now scopes the roster to the active community and includes each user's `communityAssignments`.
- `nextjs/app/api/users/[id]/route.ts` — added GET (single-user detail, reused by the new detail page).
- `nextjs/app/dashboard/users/[id]/page.tsx` (new) — user detail view: community assignment (multi-select checkboxes for SUPER_ADMIN, read-only list otherwise) for staff users; a Properties section (list/add/remove) for residents.
- `nextjs/app/api/properties/route.ts` + `[id]/route.ts` (new) — admin/board-managed property CRUD, scoped to the active community and verifying the target resident belongs to it.
- `nextjs/app/dashboard/users/page.tsx` — added a "Manage" link per row to the new detail page; SUPER_ADMIN creating an ADMIN/BOARD_MEMBER now sees a multi-select for initial community assignment.

**Decisions made:**
- Kept community *creation* to list+create only (no rename/delete) per the approved plan — smallest UI that satisfies "SUPER_ADMIN gets a page to create/manage communities."
- Multi-community assignment editing is SUPER_ADMIN-only, matching the user's original requirement ("As SUPER_ADMINs, engineers will be able to assign more than one community to an admin"); a regular ADMIN creating staff always assigns to their own active community, no picker shown.

**Gotchas:**
- **Real bug found via browser verification:** `CommunitySwitcher` originally called `router.refresh()` after switching. That only re-renders Server Components — most dashboard pages (`/dashboard/users`, `/dashboard/communities`, etc.) are client components that fetch their own data once via `useEffect` on mount, so switching communities left them showing the *previous* community's data (confirmed live: 26 stale rows shown after switching to a brand-new, empty community) until a manual reload. Fixed by using `window.location.reload()` instead — the standard pattern for a tenant/org switch in client-heavy dashboards.
- This session's sandbox had a pre-existing, unrelated environment issue blocking `next dev`: Turbopack's `turbopack.root` is deliberately pinned to `nextjs/` (see the comment in `next.config.ts`, committed separately, to fix an earlier `Cannot find module 'zod'` bug), which means it refuses to resolve packages that only exist in the monorepo root `node_modules` (e.g. `scheduler`, `source-map-js`, `picocolors` — transitive deps of `react-dom`/`postcss` that npm hoisted to the root instead of `nextjs/node_modules`). Confirmed this is a genuine Turbopack-on-Windows rough edge (`resolveAlias` with absolute Windows paths errors with "windows imports are not implemented yet"). Worked around it locally (not committed — gitignored `node_modules` only) by merge-copying the root `node_modules` into `nextjs/node_modules`. If `next dev` throws `Module not found` for a package you can `ls` at the repo root, this is why — no next.config.ts change needed, just re-sync `nextjs/node_modules`.

**Verification:** `tsc --noEmit` clean, full vitest suite (113 tests) passing. Live end-to-end browser verification via an ad-hoc Playwright script (not committed): logged in as SUPER_ADMIN, created a new community, switched into it, confirmed the (fixed) reload correctly shows 0 users for the new community, created a resident, confirmed the user detail page shows the right community, added a property and confirmed it appears. Zero cross-tenant data leakage observed between the demo community and the newly created one.

**Next steps:** Phase 4 — mobile UI parity (community switcher for admin/board tab navigators, community multi-select on user create/edit screens, properties section on resident detail), deferred as its own pass per the original plan.

---

## 2026-07-15 (Multi-tenancy Phase 2 — Authorization layer + full route/page scoping)

**Files changed:**
- `nextjs/lib/community.ts` (new) — `getActiveCommunityId`, `listAccessibleCommunities`, `canAccessCommunity`, `setActiveCommunityCookie`. Residents resolve via their fixed `session.communityId`; ADMIN/BOARD_MEMBER/SUPER_ADMIN via an `active_community` httpOnly cookie, re-validated per request and falling back to their first accessible community.
- `nextjs/app/api/community/{mine,select}/route.ts` (new) — list-accessible-communities + set-active-community endpoints backing the (Phase 3) switcher.
- `nextjs/lib/auth.ts` — `SessionUser.communityId` added; login route includes it in the JWT.
- Public self-registration disabled (`/api/auth/register` now a static 403; `/register` page replaced with a "contact your admin" message) — new accounts must be assigned to a community by an admin, so open signup no longer makes sense under multi-tenancy.
- The full mechanical scoping pass: every tenant-scoped route (announcements, events, issues, documents, dues, maintenance, violations, architectural-requests, polls, payments, vendors, users — ~55 route files) now resolves the active community and either filters list/create queries by it or 404s on a cross-community id. `lib/dashboard.ts`'s three dashboard functions and their three page.tsx callers (which call the lib functions directly as server components, bypassing the API routes) got the same fix.

**Decisions made:**
- Users create/update kept minimal in this phase (assign the creator's active community only) — the multi-select assignment UI and its backing logic were deliberately deferred to Phase 3, since this phase's job was isolation, not new features.
- Routes already scoped via `residentId: session.id` (issues/me, violations/me, violations/[id]/respond, etc.) were deliberately left alone — a resident only ever belongs to one community, so that scoping is already fully isolated; adding `communityId` there would be redundant.

**Gotchas:**
- Found and fixed **two real pre-existing cross-tenant leaks** that predated this session entirely, unrelated to any of this work: the admin/board dashboard's "recent announcements" queries had zero community scoping, and `app/resident/documents/[id]/page.tsx` (a server-rendered page that queries Prisma directly rather than through an API route) fetched a document by id with no scoping check at all — any resident could view another community's document via URL. Found via a dedicated read-only audit sub-agent sweep after the manual pass, specifically to catch exactly this class of miss.
- Also found and fixed narrower leaks introduced by the retrofit itself before commit: several `admin/reports/*` aggregate endpoints (violations, architectural-requests, payments, issues) and a few staff-facing detail routes (`architectural-requests/[id]`, `board/architectural-requests/[id]`) had no `communityId` filter/check at all.

**Verification:** `tsc --noEmit` clean, full vitest suite (113 tests) passing after the entire pass. A dedicated read-only Explore-agent audit re-swept the whole `app/api` tree plus `lib/dashboard.ts` and server-rendered pages afterward specifically looking for anything still unscoped — found the one page.tsx leak noted above, nothing else.

---

## 2026-07-15 (Multi-tenancy Phase 1 — Community schema + migration)

**Files changed:**
- `nextjs/prisma/schema.prisma` — new `Community` and `CommunityAssignment` models; `communityId` added to `User` (nullable — RESIDENT's fixed home community only), and required + indexed on `Property`, `Vendor`, `Announcement`, `Event`, `Issue`, `Document`, `Poll`, `ArchitecturalRequest`, `Violation`, `Charge`, `Payment`, `DuesRecord`, `MaintenanceRequest`; nullable on `AuditLog`.
- `nextjs/prisma/migrations/20260715023900_add_communities/migration.sql` — generated via `--create-only` then hand-edited: columns added nullable first, backfilled into a new "CommunityHQ Demo" community (including `CommunityAssignment` rows for every existing ADMIN/BOARD_MEMBER), *then* `NOT NULL` enforced — the standard safe pattern for a required-column backfill.
- `nextjs/prisma/seed.ts` — creates the community first; residents get `communityId` directly; admins/board members get `CommunityAssignment` rows instead; every tenant-scoped `create`/`createMany` call across the file (announcements, vendors, properties, charges, payments, documents, issues, architectural requests, violations) now includes `communityId`.

**Decisions made (from the approved plan, `idempotent-hugging-plum.md`):**
- BOARD_MEMBER uses the same multi-community `CommunityAssignment` mechanism as ADMIN, not the RESIDENT's fixed `User.communityId` — confirmed with the user before planning.
- Comment/activity/child tables (`IssueComment`, `ViolationAppeal`, `PollVote`, etc.) deliberately did **not** get their own `communityId` — they're scoped transitively through their parent row, avoiding redundant denormalization on ~10 more tables.
- This is Phase 1 of 4 (schema → auth/route scoping → web UI → mobile UI), each with its own checkpoint before proceeding, matching how the mobile app itself was built phase by phase.

**Next steps:**
- Phase 2: `lib/community.ts` (`getActiveCommunityId`, `requireCommunityContext`, `listAccessibleCommunities`), `SessionUser.communityId` + JWT changes, and the mechanical pass scoping every tenant-touching route. `tsc --noEmit` already identifies the exact 11 route files with a `create` call now missing `communityId` (`admin/announcements`, `admin/vendors`, `admin/violations`, `architectural-requests`, `documents`, `dues`, `events`, `issues`, `maintenance`, `payments/me/pay`, `polls`) — a precise, compiler-verified checklist for that phase, though the full pass (list/detail/update routes too) is larger than just these 11 creates.
- Phase 3: web UI (switcher, `/dashboard/communities`, user-community assignment, admin-managed property CRUD).
- Phase 4: mobile UI, mirroring Phase 3.

**Gotchas:**
- None new. Migration workflow (export `DATABASE_URL`, `--create-only`, hand-edit the SQL, `migrate dev` to apply) matches the pattern already used for the `push_tokens` migration earlier this project.

**Verification:** Migration applied cleanly against the Neon dev DB. Verified directly via Prisma queries (not just "it didn't error"): all 19 pre-existing RESIDENT users got `communityId` set, all 2 ADMIN + 5 BOARD_MEMBER users got a `CommunityAssignment` row (7 total, matching exactly), SUPER_ADMIN untouched as designed. The `ALTER COLUMN ... SET NOT NULL` statements succeeding is itself proof zero rows were missed by the backfill (they would have hard-failed otherwise). `seed.ts` typechecks clean on its own. Full existing vitest suite (113 tests) still passes — schema-only change, no route logic touched yet in this phase.

## 2026-07-14 (Mobile unit tests — full screen coverage, all remaining screens)

**Files changed:**
- `mobile/__tests__/screens/*.test.tsx` (9 new) — the remaining shared screens: `AnnouncementDetailScreen`, `EventsListScreen`, `EventDetailScreen`, `DocumentsListScreen`, `DocumentDetailScreen`, `PollsListScreen`, `PollDetailScreen` (including the vote → percentage-reveal flow and the 409-conflict "already voted" path), `ProfileScreen`, `ViolationManageScreen` (shared by board+admin violation detail).
- `mobile/__tests__/screens/resident/*.test.tsx` (11 new) — Dashboard, IssuesList, IssueDetail, NewIssue, Payments, Pay (form → processing → receipt), ArchRequestsList, ArchRequestDetail (including the `Alert.alert` withdraw-confirmation flow), NewArchRequest, ViolationsList, ViolationDetail (response + appeal forms).
- `mobile/__tests__/screens/board/*.test.tsx` (4 new) — Dashboard, RequestsList (status filter re-fetching), RequestDetail (decision form), ViolationsList (escalated/appeals filter toggle). Board's violation *detail* screen is a 2-line wrapper around the already-tested shared `ViolationManageScreen`, so it didn't get its own file.
- `mobile/__tests__/screens/admin/*.test.tsx` + `admin/reports/*.test.tsx` (15 new) — Dashboard, IssuesList, IssueDetail (including its odd "PATCH with an empty body to read current state" pattern, and that saving triggers a second read via `reload()`), ViolationsList, NewViolation (resident search/picker), VendorsList, NewVendor, UsersList, EditUser (SUPER_ADMIN lockout, self-delete prevention, delete confirmation), NewUser, ReportsMenu, and all 4 report screens (Issues/Payments/ArchRequests/Violations).
- Total: **39 new screen test files, 192 new tests** (84 → 236 mobile tests overall).

**Decisions made:**
- This was a "test everything" pass per explicit user request, not a scoped batch — every screen in `mobile/app/` and `mobile/src/screens/shared/` now has at least one test file, except pure 1-2 line re-export wrappers (e.g. `(admin)/more/announcements/index.tsx` just re-exports `AnnouncementsListScreen`) and role-specific violation-detail wrappers that just parameterize the shared `ViolationManageScreen` with a different `statusChoices` list — testing the underlying shared component once covers those.
- Kept each screen's test depth roughly proportional to its actual logic: simple list screens got loading/error/empty/navigate coverage; screens with real business logic (form validation, multi-step flows, confirmation dialogs, role-based lockouts) got dedicated tests for each branch.
- `Alert.alert` (used for withdraw/delete confirmations) is tested by spying on it and synchronously invoking the matching button's `onPress` from the mock implementation, rather than trying to render a real native alert.

**Next steps:**
- Coverage is now broad; deepening any individual screen's edge cases is optional, not a gap.
- No E2E tooling (Maestro) for mobile still — the standing gap, unrelated to this pass.
- `eas init` remains the standalone blocker for real push delivery/builds.

**Gotchas:**
- **Real, recurring bug across ~6 different files this session, root-caused once and reused:** batching multiple `fireEvent.changeText`/`fireEvent.press` calls inside a *single* `act(async () => {...})` block reliably produces `"You seem to have overlapping act() calls"` and silently drops state updates — e.g. a second `fireEvent.changeText` call's value never lands, so a later assertion reads stale state, or a validation branch that should fire never does (observed exactly this in `NewIssue`, `Pay`, `NewViolation` during this batch). Fix: **one `fireEvent` call per `act()` block**, always. Sequential separate `await act(...)` calls work reliably; a single one wrapping multiple `fireEvent` calls does not.
- **Self-inflicted, real, and already documented in the previous entry, but it recurred mid-session** (from re-running `cd nextjs && npm ci` on the real checkout while spot-checking something unrelated) — same fix: `npm ci` from the repo root, then `node_modules/.bin/prisma generate` in `nextjs/`.
- `FormField` has no `testID` or `placeholder` for several fields (e.g. name fields, password fields on `ProfileScreen`/`NewUser`) — when two same-valued inputs exist simultaneously (two empty strings, for instance), locate them via `getAllByDisplayValue('')` (or `getAllByPlaceholderText`) and index by render order, documented inline in each test file, rather than guessing a query that happens to be unique.

**Verification:** `npm exec -w mobile -- jest` — 53 suites, 236 tests, all passing. `tsc --noEmit` and `expo lint` both clean on `mobile/`. Re-confirmed `nextjs/` unaffected: 113/113 vitest tests still passing.

## 2026-07-14 (Mobile unit tests — component + screen rendering batch)

**Files changed:**
- `mobile/__tests__/components/*.test.tsx` (new, 8 files) — `Button` (label, onPress, disabled blocks press, loading hides label), `FormField` (label, value, onChangeText, forwards arbitrary `TextInputProps`), `StatusBadge` (title-cases the label, applies the correct tone color — asserted via the rendered `Text`'s style, not just presence), `ChipSelect` (renders all options, `onChange` fires with the pressed value including re-pressing the active one), `EmptyState` (default vs. custom icon, message), `ErrorView` (default vs. custom message, retry button only rendered/wired when `onRetry` is passed), `ListRow` (title/subtitle/right-content conditionals, chevron only when `onPress` exists, press handling), `Card` (renders children, `onPress` only wired when provided).
- `mobile/__tests__/screens/AnnouncementsListScreen.test.tsx` (new) — the first full-screen integration test: empty state, error state with a working retry (re-fetches), unread-marker + priority-badge rendering, and navigation (`router.push` with the right path) on row press. Chosen as "a representative screen" since it exercises `useApi` + 5 shared components + `expo-router` together, and is reused by both `(resident)` and `(board)`.

**Decisions made:**
- Skipped `ListCard`, `LoadingView`, and `ScreenContainer` — pure style/layout wrappers with no conditional logic of their own; a render-only test there would just restate the JSX, not verify behavior.
- For the screen test, mocked `@/api/announcements` (jest auto-mock) and `expo-router`'s `router` directly rather than mocking `useApi` itself — exercises the real hook + real components together, only stubbing the actual network/navigation boundary.

**Next steps:**
- No screens/components remain entirely untested in the sense of "zero coverage of any kind," but only one screen (`AnnouncementsListScreen`) has a full integration test — the other resident/board/admin screens (issues, payments, violations, etc.) are still uncovered at the screen level. Natural next batch if more mobile test coverage is wanted.
- Still no E2E tooling (Maestro) for mobile.

**Gotchas:**
- **Self-inflicted, real, and worth remembering:** running `npm ci` inside `nextjs/` directly on this actual repo (not an isolated copy) — done repeatedly today while diagnosing the CI failures — silently wiped `mobile/`'s hoisted dependencies (`expo-notifications`, `jest-expo`, all of it) from the shared root `node_modules`, because npm detects the ancestor workspace root even when invoked from within a member subdirectory and reconciles the *whole* root `node_modules` against only the member's own dependency needs (confirmed: root `node_modules` dropped from ~1300 packages to ~290, and every mobile-only package was gone). This is the same underlying npm behavior that causes the `npm/cli#4828` bug fixed earlier today, just manifesting differently. **Fix/recovery: run `npm ci` from the repo root**, then `node_modules/.bin/prisma generate` inside `nextjs/` (the root install regenerates `@prisma/client` fresh, and it needs the schema re-pointed at). **Going forward: never run `npm ci` directly inside `nextjs/` on the real checkout** — use the root install (already true for local mobile dev; for CI, `ci.yml`'s `working-directory: nextjs` + `npm ci` is fine specifically *because* the runner is single-purpose and ephemeral, so there's no sibling `mobile/` install to destroy).
- `@testing-library/react-native`'s `render()` is also `async` (same as `renderHook`, discovered in the previous test batch) — must `await render(...)` everywhere, including inside `it()` blocks that don't otherwise look async-sensitive.
- A `fireEvent.press` that triggers an async state update in a hook (e.g. `useApi`'s `refresh()`) needs to be wrapped in `await act(async () => { fireEvent.press(...) })`, not called bare — otherwise React logs "The current testing environment is not configured to support act(...)" even though the test still passes (the assertion happens to land after the update settles by luck of the microtask queue, not because it was properly awaited).

**Verification:** `npm exec -w mobile -- jest` — 14 suites, 84 tests, all passing (up from 51). `tsc --noEmit` and `expo lint` both clean on `mobile/`. Re-confirmed `nextjs/` unaffected: 113/113 vitest tests still passing after recovering from the node_modules incident above.

## 2026-07-14 (Fix, part 2: CI still failing after the lockfile fix)

**Files changed:**
- `.github/workflows/ci.yml` — removed `cache: npm`/`cache-dependency-path` from the `actions/setup-node@v4` step.

**Decisions made:**
- The lockfile regeneration below (part 1) fixed the `npm ci` integrity failure, but pushing it (`16c8455`) surfaced a **second, different** failure on the real GitHub Actions runner: `npm test` crashed with `Cannot find native binding` / `Cannot find module '@rolldown/binding-linux-x64-gnu'`, even though the lockfile entry for that exact package is present and correctly formed (`os: ["linux"], cpu: ["x64"]` — verified directly). This is npm's own documented bug (npm/cli#4828, quoted verbatim in the error message rolldown's native loader prints): a restored `~/.npm` cache — via `actions/setup-node@v4`'s built-in caching, which was carrying over stale cache state from all the previously-failing runs since July 5 — causes `npm ci` to silently skip installing a valid optional platform dependency. This reproduces the "works in a fresh environment (my Docker container had an empty cache), fails on the real cached CI runner" pattern exactly.
- Fix is to stop caching npm's download cache for this job entirely, rather than trying to bust/version the cache key — simplest and most robust against this specific bug recurring. User chose to scope the fix to `ci.yml` only (the workflow that's actually broken) rather than also touching `e2e.yml`/`mobile-ci.yml`, which have the same caching setup but haven't demonstrated the bug.

**Next steps:**
- Watch the next CI run to confirm both fixes together (lockfile regen + no npm cache) actually go green — still not yet confirmed via a real passing run as of this entry.
- If `e2e.yml` or `mobile-ci.yml` ever hit this same "Cannot find native binding" class of error, apply the identical fix (drop `cache: npm` from their `actions/setup-node@v4` steps).

**Gotchas:**
- The generic GitHub check-run annotation API only ever reports "Process completed with exit code 1" — no actual error text. Full step output requires the job-logs endpoint, which 403s ("Must have admin rights to Repository") even for a public repo without an authenticated token with repo access. Real diagnosis for this second failure only became possible once the user pasted the actual `npm test` output copied from the Actions UI. Installing `gh` CLI + `gh auth login` would remove this blind spot going forward.

**Verification:** Not yet — this fix is unverified against a real CI run at the time of this entry (see Next steps). Diagnosis (lockfile entry correctness, cache-restore theory) was verified by direct inspection of `package-lock.json`, not just inference.

**Correction (see part 3 below): the caching theory in this entry was wrong.** Pushing the no-cache fix (`6ee58dc`) hit the *identical* error on the next run. The real cause and working fix are in the next entry — this one is left as-is rather than rewritten, since the reproduction process (and getting a plausible-but-wrong theory disproven by an actual CI run) is itself worth keeping visible.

## 2026-07-14 (Fix, part 3: the actual root cause — npm workspaces + rolldown on Linux)

**Files changed:**
- `.github/workflows/ci.yml` — restored `cache: npm` (part 2's removal didn't fix anything, so no reason to keep paying the speed cost); added a step after `npm ci` that explicitly reinstalls `@rolldown/binding-linux-x64-gnu` at whatever version `rolldown` itself resolved to (read dynamically via `node -p`, not hardcoded).

**Decisions made:**
- Root-caused for real this time, via direct reproduction rather than theory: copied the **full repo** (not just `nextjs/`, which is what part 1's Docker reproduction had done, accidentally sidestepping the real trigger) into a `node:24-bookworm` container and ran the exact CI steps. This reproduced the failure deterministically. Systematically ruled out alternatives in the same container: removing the npm cache didn't help; running from the repo root with `npm ci -w nextjs` didn't help; `npm install` instead of `npm ci` didn't help. Every variant failed identically, *as long as the ancestor root `package.json`'s `"workspaces": ["nextjs", "mobile"]` was present* — a standalone copy of `nextjs/` (no ancestor workspace) never reproduces it, on the same OS/npm/Node version.
- Confirmed directly (not inferred) that `npm ci` was leaving `node_modules/@rolldown/` with **zero** linux-gnu binding present at all after a "successful" install — this is npm's own documented optional-dependency bug (npm/cli#4828): when a package (here, `rolldown`, Vite's bundler binding, shipping 15 OS/CPU platform variants) is installed inside an npm workspace, npm's resolver can silently fail to link the correct platform variant, even though the lockfile entry for it is completely correct.
- Fix: rather than restructuring the workspace (bigger, riskier change) or switching install commands (tested, doesn't help), added a targeted extra step that explicitly (re)installs the missing package by name once npm's own resolution has already dropped it. Reads the required version off the already-installed `rolldown` package rather than hardcoding a version number, so it keeps working automatically as `rolldown` gets bumped by future dependency updates.
- This only affects Linux (the bug needs multiple same-family optional variants competing, which Windows's single `win32-x64-msvc` variant never triggers) — confirmed this is why local Windows dev was never affected, and why `nextjs/` isn't being pulled out of the workspace: the workaround is CI-only.

**Next steps:**
- Watch this push's CI run — this is the fix that was actually verified end-to-end in a full-repo container reproduction (unlike parts 1 and 2's theories).
- If `e2e.yml` is ever changed to run `vitest` (it currently only runs Playwright against a built Next.js server, which doesn't touch Vite/rolldown at all — confirmed not affected), apply the same workaround step there.

**Gotchas:**
- Don't trust a "the fix works" conclusion from a partial reproduction — part 1's Docker container test *excluded* the parent directory (copied only `nextjs/` in isolation) and passed, which looked like confirmation but was actually testing a different, non-representative scenario. The tell should have been that a real fix ought to also be reproducible as a *failure* first; only reproducing the passing case proves nothing. Copy the **whole repo structure** (or whatever the real CI checkout actually contains) when reproducing a CI-only failure, not just the directory the failing step happens to `cd` into.

**Verification:** Reproduced the exact failure in a `node:24-bookworm` container using a full-repo copy (matching CI's actual checkout), confirmed `node_modules/@rolldown/` had no linux binding after `npm ci`, then confirmed the explicit-reinstall workaround brings `npm test` back to 113/113 passing in that same container.

## 2026-07-14 (Fix: CI "Unit tests & lint" failing since ~July 5)

**Files changed:**
- `nextjs/package-lock.json` — regenerated. No dependency changes; the diff is purely optional, platform-gated transitive entries (added `@emnapi/core`/`@emnapi/runtime` — needed by Tailwind's oxide engine and Vite's rolldown binding on Linux; a few `fsevents`/`@aws-sdk`/`@smithy` sub-entries shuffled).

**Decisions made:**
- Diagnosed via GitHub's REST API (workflow runs + check-run annotations) that the `CI` workflow's "Unit tests & lint" job had failed on **every** push since at least 2026-07-05 (`08547cd`) — i.e. this predates the entire mobile app / push notifications / mobile test work from this week. Not a regression from recent sessions.
- Confirmed root cause by reproducing the exact CI environment (Node 24, npm 11.6.1, Ubuntu/Debian) in a local Docker container (`node:24-bookworm`) rather than guessing from the (unauthenticated-API-limited) annotation text, which only said generic "Process completed with exit code 1." `npm ci` failed there with `Missing: @emnapi/core@1.11.1 from lock file` — the committed `nextjs/package-lock.json` (last touched at `880c656`, before the Phase 0 monorepo conversion) had drifted out of sync with what `nextjs/package.json`'s dependency tree resolves to on Linux. A from-scratch `npm install` in the same container regenerated a lockfile that passed `npm ci` + all 113 tests there, and was then re-verified to still pass `npm ci` + tests on Windows too (this lockfile has to serve both, since local dev is Windows and CI is Linux).
- Left `ci.yml`/`e2e.yml` untouched — the fix is entirely in the lockfile, not the workflow.

**Next steps:**
- Watch the next CI run on `main` to confirm this actually goes green (only verified locally + in a matching container, not via an actual GitHub Actions run yet).
- `E2E tests` shows "skipped" on every run — that's by design (`if: vars.E2E_ENABLED == 'true'` in `e2e.yml`), not a failure. Needs repo secrets (`DATABASE_URL`, `JWT_SECRET`, AWS keys, `RESEND_API_KEY`, `EMAIL_FROM`) and the `E2E_ENABLED` repo variable set to `true` — both are GitHub repo-admin actions, not something fixable from a working tree.

**Gotchas:**
- If this resurfaces after a future local `npm install` inside `nextjs/` (e.g. adding a package), regenerate on Linux (or via this same Docker approach) rather than trusting a Windows-generated lockfile — Tailwind v4's oxide engine and Vite's rolldown binding both ship platform-specific optional deps (including wasm32-wasi fallbacks needing `@emnapi/*`) that a Windows install won't necessarily record identically to what Linux CI needs.

**Verification:** Reproduced the failure and the fix in a `node:24-bookworm` container matching CI's Node version and OS family: `npm ci` + `npm test` (113/113) both clean against the regenerated lockfile. Re-verified `npm ci` + `npm test` (113/113) + `tsc --noEmit` + `npm run lint` all clean on Windows with the same regenerated lockfile.

## 2026-07-14 (Mobile unit tests — useApi hook)

**Files changed:**
- `mobile/__tests__/hooks/useApi.test.ts` (new) — 7 tests covering the shared fetch/loading/error/pull-to-refresh hook: initial fetch-on-mount stays `loading` until the fetcher resolves, `ApiError` messages surface verbatim while non-`ApiError` failures fall back to a generic message, `refresh()` toggles `refreshing` (not `loading`) and updates data, `reload()` clears a previous error, re-fetches when the `fetcher` identity changes (the documented `useCallback`-at-the-call-site contract), and `setData` applies a direct optimistic update without re-fetching.

**Decisions made:**
- Used a small local `deferred<T>()` helper (a manually-resolvable promise) to assert *intermediate* states — e.g. `loading === true` while a fetch is still in flight, and `refreshing === true` mid-refresh — rather than only asserting eventual settled state. Instant `mockResolvedValue`/`mockRejectedValue` mocks can't produce an observable in-flight window.

**Next steps:**
- Component/screen rendering tests still the next natural batch (deferred twice now, by original scoping choice).
- `eas init` remains the standalone blocker for real push delivery/builds, unrelated to test coverage.

**Gotchas:**
- **Self-inflicted, now fixed:** an `act(() => {...})` call without `await` (easy to miss since `act()` always returns a `Promise` regardless of whether the callback is sync or async) left a dangling async scope that leaked into subsequent tests in the same file, surfacing as `result.current` reading `null` in *later, unrelated* tests — a confusing action-at-a-distance failure mode worth remembering: if a `result.current` in an RTL hook test is unexpectedly `null`, check every `act(...)` call in that file (including earlier tests) for a missing `await` before assuming the hook itself is broken.
- Passing a destructured, unannotated parameter (`({ fetcher }) => ...`) as `renderHook`'s first argument fails to typecheck when combined with `initialProps`, because `renderHook`'s type signature uses `NoInfer<Props>` on the options parameter specifically to force `Props` inference from the callback alone — an unannotated destructured parameter has nothing to infer from and collapses to `unknown`. Fix: annotate the callback parameter's type explicitly (`({ fetcher }: { fetcher: () => Promise<T> }) => ...`).

**Verification:** `npm exec -w mobile -- jest` — 5 suites, 51 tests, all passing (up from 44). `tsc --noEmit` and `expo lint` both clean on `mobile/`.

## 2026-07-14 (Mobile unit test infrastructure — first batch)

**Files changed:**
- `mobile/package.json` — added `jest-expo`, `jest`, `@testing-library/react-native`, `@types/jest` as devDependencies (via `expo install --dev`, so versions are SDK-57-compatible); added `test`/`test:watch` scripts; added a `jest` config block (`preset: "jest-expo"`, the standard `transformIgnorePatterns` for RN/Expo modules, plus a `moduleNameMapper` — see Gotchas).
- `mobile/tsconfig.json` — added `"types": ["jest"]` so `describe`/`it`/`expect` typecheck.
- `mobile/__tests__/utils/format.test.ts`, `__tests__/utils/tones.test.ts` (new) — pure-function tests for `utils/format.ts`/`utils/tones.ts`.
- `mobile/__tests__/api/client.test.ts` (new) — tests `apiFetch`'s header attachment, 401→unauthorized-handler flow, and error-message fallback, with `globalThis.fetch` mocked.
- `mobile/__tests__/auth/AuthContext.test.tsx` (new) — tests login/logout, cold-start session restore (success and non-auth-error paths), and the 401→auto-logout wiring, with `secureStorage`, `api/client`, and `notifications/registerPushToken` all mocked.
- `.github/workflows/mobile-ci.yml` — renamed the job to "Typecheck, lint & test" and added a `jest` step.

**Decisions made:**
- User chose to scope this first batch to pure logic + the auth/API core (no component/screen rendering tests yet) — highest value, lowest setup risk, given jest-expo's native rendering path was untested territory in this repo.
- Followed the exact setup Expo's own docs recommend for SDK 57 (`jest-expo` preset, `@testing-library/react-native`), rather than an older pattern like `@testing-library/react-hooks` — confirmed by fetching the live versioned docs per `mobile/AGENTS.md`'s instruction.
- Test location mirrors the nextjs convention (a top-level `__tests__/` tree shaped like `src/`), not co-located `*.test.ts` files, for consistency across the monorepo.

**Next steps:**
- Component/screen rendering tests (Button, FormField, StatusBadge, a representative screen) were explicitly deferred to a later batch.
- `useApi.ts` (the shared fetch/loading/pull-to-refresh hook) has no tests yet — natural next target given it backs most list/detail screens.
- No E2E test tooling (Maestro, per the original mobile plan) set up yet — still just unit tests.

**Gotchas:**
- **Real dual-React-instance bug, now fixed.** npm workspaces hoisting produced *three* separate `react` installs across the repo: `mobile/node_modules/react@19.2.3` (react-native's exact pin), `nextjs/node_modules/react@19.2.4` (nextjs's exact pin), and a *third*, freshly-hoisted `node_modules/react@19.2.7` at the repo root (satisfying some dependency's broader `^19` range — nothing pins that version anywhere directly). `jest-expo`'s `react-test-renderer` (also at root, version 19.2.3 — matching mobile's pin, confirmed via `jest-expo`'s own `package.json` dependency) still resolved its internal `require('react')` against the root copy (19.2.7) via plain Node resolution, while mobile's own components resolved `react` from the nested `mobile/node_modules/react` (19.2.3). Two live React module instances in one test run means two separate hook-dispatcher singletons — symptom was `TypeError: Cannot read properties of undefined (reading 'useState')` inside any component under test, with no other explanation in the stack trace. Fixed with a `moduleNameMapper` in `mobile/package.json`'s `jest` config forcing `react`/`react-dom` (and subpaths) to always resolve to `<rootDir>/node_modules/react(-dom)` (the mobile-local, react-native-compatible copies). If this resurfaces after a dependency bump, check `node -e "console.log(require('./node_modules/react/package.json').version)"` at root vs. `mobile/node_modules/react` before assuming it's a new bug.
- **`@testing-library/react-native@14.0.1`'s `renderHook` is `async`** (returns a `Promise<{ result, rerender, unmount }>`), unlike the classic `@testing-library/react-hooks` API most training data assumes. Forgetting to `await` it doesn't throw — it silently returns a `Promise` object, and every property access off the (non-awaited) result reads as `undefined`, which looked at first like a broken render rather than a missing `await`. Confirmed by reading `node_modules/@testing-library/react-native/dist/render-hook.js` directly rather than guessing from docs.
- Auto-mocking a module that imports `expo-notifications` (via `jest.mock('@/notifications/registerPushToken')` with no factory) still evaluates the real module once to derive the mock shape, which prints `expo-notifications`'s "removed from Expo Go" warning to the console during the test run. Harmless, but silenced by giving `jest.mock` an explicit factory (`() => ({ registerPushToken: jest.fn() })`) instead of relying on auto-mock.

**Verification:** `npm exec -w mobile -- jest` — 4 suites, 44 tests, all passing. `tsc --noEmit` and `expo lint` both clean on `mobile/`. Confirmed the new CI step name/command locally matches what `mobile-ci.yml` now runs.

## 2026-07-14 (Phase 6 — push notifications)

**Files changed:**
- `nextjs/prisma/schema.prisma` — new `PushToken` model (`userId`, unique `token`, optional `platform`, `lastSeenAt`), relation on `User`; migration `20260714124010_add_push_tokens` applied to the Neon dev DB.
- `nextjs/lib/push.ts` (new) — `buildPushMessages`/`parseInvalidTokens` (pure, unit-tested) plus `sendPushToUsers` orchestrator. Sends via a raw `fetch` to Expo's push API (`https://exp.host/--/api/v2/push/send`) rather than adding the `expo-server-sdk` dependency — it's a plain HTTPS/JSON endpoint, so no package was needed. Swallows all errors internally so a push failure never breaks the calling route's response; auto-deletes tokens that come back `DeviceNotRegistered`.
- `nextjs/app/api/push-tokens/route.ts` (new) — `POST` only, session-gated (cookie or Bearer), upserts by the unique token so re-login as a different user on the same device reassigns it. No DELETE route — stale tokens self-prune via the cleanup above.
- Trigger call sites added (additive, no response-shape changes) in `app/api/admin/announcements/route.ts` (POST), `app/api/issues/[id]/comments/route.ts` (POST, resident→assigned staff), `app/api/admin/issues/[id]/comments/route.ts` (POST, staff public comment→resident), `app/api/admin/violations/[id]/route.ts` (PATCH, notice sent→resident), `app/api/admin/violations/[id]/appeal/route.ts` (PATCH, appeal decided→resident), `app/api/board/architectural-requests/[id]/route.ts` + `app/api/admin/architectural-requests/[id]/route.ts` (PATCH, decision→resident).
- `nextjs/__tests__/lib/push.test.ts` (new) — 7 unit tests for the pure message-building/cleanup-parsing logic.
- `mobile/package.json` — added `expo-notifications`, `expo-device` (via `expo install`, so versions are SDK-57-compatible).
- `mobile/app.json` — added `expo-notifications` to `plugins`.
- `mobile/src/notifications/registerPushToken.ts` (new) — `Device.isDevice` guard, permission request, `getExpoPushTokenAsync({ projectId })`, POSTs to `/api/push-tokens`. Wrapped in try/catch that only logs in dev — this call is expected to throw until a real EAS project ID exists (see Gotchas).
- `mobile/src/auth/AuthContext.tsx` — calls `registerPushToken()` (fire-and-forget) after login and after a cold-start session restore.
- `mobile/app/_layout.tsx` — `Notifications.setNotificationHandler` (foreground banners) and `addNotificationResponseReceivedListener` with a small `resolveNotificationRoute(type, id, role)` switch that deep-links a tapped notification to the right screen per role.
- `nextjs/app/privacy/page.tsx` — updated to disclose push token collection (was previously stated as "not collected") and the new notification-sending purpose; bumped "Last updated" date.
- `mobile/STORE_SUBMISSION.md` — replaced the old "push deferred" note with what's actually implemented, and flagged the EAS project ID gap as now blocking push delivery too, not just builds.

**Decisions made:**
- Chose which 4 events trigger notifications with the user up front: new announcements, issue comments, violation notices, architectural request decisions (not every possible event — e.g. no push on issue status changes without a comment, no push on poll creation).
- Raw `fetch` to Expo's push endpoint instead of adding `expo-server-sdk` as a new nextjs dependency — kept the backend dependency footprint unchanged for something this simple.
- Recipients for announcements reuse the exact audience→role mapping already used by the resident-facing `GET /api/announcements` route, rather than inventing new targeting logic.
- No token-removal endpoint in v1 — relying entirely on the `DeviceNotRegistered` auto-cleanup, confirmed working against the real Expo API during verification (see below).
- Committed Phases 0-5 (previously fully uncommitted since the prior session) before starting Phase 6, per user's choice, so this phase has a clean baseline.

**Next steps:**
- Real on-device push delivery is blocked on running `eas init` against a real Expo account (writes `extra.eas.projectId` into `app.json`) — everything server-side is built and tested, but `getExpoPushTokenAsync()` can't mint a token without it. See `mobile/STORE_SUBMISSION.md` step 5.
- No mobile unit tests yet at all (pre-existing gap, unrelated to this phase).
- Once a real EAS project exists, re-verify push delivery on a physical device/simulator — everything tested this session used a fake `ExponentPushToken[...]` string.

**Gotchas:**
- None new. The Turbopack `root` fix and npm-workspace `npx` caveats from earlier phases continue to apply unchanged.

**Verification:** `tsc --noEmit` + full vitest suite (113 tests, up from 106) clean on `nextjs/`. `tsc --noEmit` + `expo lint` clean on `mobile/`. Applied the migration to the Neon dev DB and confirmed the `push_tokens` table. Started the real dev server and, using the demo resident/admin/board accounts, registered two fake push tokens via `POST /api/push-tokens`, then live-triggered all 6 call sites (announcement create, resident issue comment, admin issue comment, violation notice, appeal decision, both board and admin architectural-request decisions) — every route still returned its normal success status. Notably, Expo's real push API rejected the fake tokens and our `DeviceNotRegistered` cleanup logic actually deleted both rows afterward (confirmed via a direct DB query) — proof the full send/parse/cleanup pipeline works against the live Expo endpoint, not just a mock.

## 2026-07-13 (Session handoff — mobile app Phases 0-5 complete)

Full-day session building the React Native/Expo mobile app for CommunityHQ
end to end. Detailed per-phase entries are below this one (each dated
2026-07-13, newest first: Phase 5, Phase 4, Phase 3, Phase 2) — this entry is
a consolidated pointer, not a replacement for that detail.

**Files changed:** See each phase entry below for the full file list. Summary
by phase:
- **Phase 0** (monorepo + auth): root `package.json` npm workspace, Bearer-token
  auth added to `nextjs/lib/auth.ts`/`proxy.ts`/login+register routes, new
  `/api/resident/dashboard` route, CI path filters, `mobile-ci.yml`
- **Phase 1** (Expo scaffold): `mobile/` app created, Expo Router navigation
  shell, `AuthContext`/`secureStorage`, API client
- **Phase 2** (resident screens): full resident feature set — dashboard,
  issues, payments, announcements, events, arch requests, violations,
  documents, polls, profile
- **Phase 3** (board screens): board dashboard, architectural request review,
  violations review — with shared-screen extraction (`src/screens/shared/`)
  for the 5 screens identical across roles
- **Phase 4** (admin screens): admin dashboard, issues management, violations
  issuance, vendors, users CRUD, 4 reports — plus a new
  `POST /api/admin/vendors` backend route (user-approved)
- **Phase 5** (store prep): `eas.json`, placeholder bundle ID/icons, real
  privacy policy page at `/privacy`, `mobile/STORE_SUBMISSION.md` checklist

**Decisions made:** See phase entries — key ones: npm workspaces over
pnpm/Turborepo; extend existing cookie auth with Bearer tokens rather than a
parallel mobile auth system; push notifications deferred; shared screens
extracted only where genuinely identical across roles (not speculatively).

**Next steps:**
1. Optional: `/code-review` or `/security-review` pass over the full diff
   before committing (offered to user at end of session, not yet run)
2. Phase 6+: push notifications (unstarted, deferred by design)
3. Work through `mobile/STORE_SUBMISSION.md` (mostly external account setup)
4. No mobile unit tests yet (Jest + RNTL) — deferred per the original plan
   at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`

**Gotchas:** See phase entries for full detail — the two worth remembering
most:
- `npx <tool>` is unreliable inside `nextjs/` or `mobile/` now that the repo
  is an npm workspace (can silently resolve the wrong hoisted version, or
  fall through to an unrelated registry package). Always use
  `npm exec -w <workspace> -- <tool>` or a direct `node_modules/.bin/<tool>` path.
- If Turbopack ever again logs "inferred your workspace root, but it may not
  be correct" on `nextjs` dev server startup, the fix is already in place
  (`turbopack.root` in `nextjs/next.config.ts`) — if it recurs, something
  changed that config, not a new issue to re-diagnose from scratch.

**Verification:** Every phase was live-tested against the real Next.js API
and Neon dev database (not just typecheck/lint) via a running dev server +
Expo web + Playwright, using the app's real demo accounts. See phase entries
for the specific flows exercised (issue creation/comments, real simulated
payment, poll voting, board decision workflows, admin issue
assignment/violation issuance/vendor+user creation, all 4 admin reports).
`tsc --noEmit` and `expo lint` are clean on `mobile/` as of this entry;
`tsc --noEmit` + full vitest suite (106 tests) clean on `nextjs/`.

## 2026-07-13 (Phase 5 — app store submission prep)

**Files changed:**
- `mobile/app.json` — added placeholder `ios.bundleIdentifier`/`android.package` (`com.communityhq.app`, user-approved placeholder), `buildNumber`/`versionCode`
- `mobile/assets/*.png` — replaced Expo's default template icon/splash/adaptive-icon/favicon with a generated placeholder (blue `#2563eb` background, simple white house glyph), matching each file's exact pre-existing dimensions. `icon.png` specifically re-encoded without an alpha channel (Apple rejects the primary App Store icon if it has one, even fully opaque).
- `mobile/eas.json` (new) — `development`/`preview`/`production` build profiles with per-profile `EXPO_PUBLIC_API_URL` (placeholder `https://your-app.vercel.app` for preview/production, matching the existing `NEXT_PUBLIC_APP_URL` placeholder convention in `nextjs/.env.example`), `submit.production` profile
- `nextjs/app/privacy/page.tsx` (new) — real privacy policy content (not boilerplate) describing exactly what CommunityHQ's actual code collects: account info, property address, financial/payment records, issue/arch-request/violation content, announcement read receipts, poll votes, session tokens — and explicitly what it does NOT collect (camera, location, contacts, ad identifiers, analytics, push — none of these exist in the codebase). Placeholder contact email flagged for replacement before real publishing.
- `nextjs/proxy.ts` — added `/privacy` to `PUBLIC_PATHS` (a privacy policy can't be gated behind login — required for app store review and basic legal validity of the link)
- `mobile/STORE_SUBMISSION.md` (new) — checklist of what's done vs. what remains (mostly external: Apple Developer Program enrollment, Google Play Console registration, EAS account + `eas init` for a real project ID, backend deployment so the placeholder API URL becomes real, store privacy declarations, listing content/screenshots)

**Decisions made:**
- User approved placeholder values for all three open Phase 5 questions: bundle ID (`com.communityhq.app`), generated placeholder branding (rather than leaving Expo's default template icon or blocking on real design work), and eas.json scaffolding without walking through EAS account setup in detail.
- Privacy policy built as a real page in the Next.js app (`/privacy`) rather than a standalone markdown file — the web app is what will eventually get a real deployed URL, so this gives the policy a real, stable link the moment that deployment happens, instead of a separate hosting problem to solve later.
- No EAS project ID was fabricated in `app.json` — that field must come from a real `eas init` run against the user's own Expo account; a fake UUID there would silently break real builds later.

**Next steps:**
- Phase 6+: push notifications (still deferred, unstarted)
- Whenever the user is ready: work through `mobile/STORE_SUBMISSION.md` top to bottom
- Consider a `/code-review` or `/security-review` pass now that all 4 phases (0-5, minus push) of mobile app + backend changes are complete, before this branch gets committed

**Gotchas:**
- **Real PowerShell bug hit and fixed while generating icons**: `New-Object TypeName($arg1, $arg2)` constructor-call sugar (used successfully as a single top-level statement) silently breaks when nested inside a comma-separated array literal (`@(New-Object ..., New-Object ..., New-Object ...)`) — PowerShell's parser mis-binds the arguments in that context, producing "does not contain a method named 'op_Addition'" and similar cryptic errors on completely unrelated later lines (the actual bitmap Save() calls still "succeeded" with garbage/incomplete graphics). Root cause confirmed via minimal repro. Fix: always use explicit `-ArgumentList` with `New-Object`, never the parenthetical constructor-sugar syntax, especially inside array literals.
- Turbopack `root` fix from Phase 2 continues to hold — no root-inference warnings on this session's dev server run either.

**Verification:** Ran `tsc --noEmit` + `expo lint` clean on `mobile/`, `tsc --noEmit` + full vitest suite (106 tests) clean on `nextjs/`. Live-verified the privacy page specifically: started the dev server, confirmed `GET /privacy` returns `200` with no auth cookie (proving the `PUBLIC_PATHS` exemption actually works, not just that the route exists) and that the rendered HTML contains the real page content. Visually inspected the generated icon and Android adaptive-icon layers (foreground transparency, background solid color) to confirm they're not corrupted despite the PowerShell bug encountered mid-generation.

## 2026-07-13 (Phase 4 — admin feature screens)

**Files changed:**
- `nextjs/app/api/admin/vendors/route.ts` — **added `POST` handler** (Zod-validated name/contactName/email/phone/category/notes, `isAdmin()`-gated, audit-logged). Real gap: this route previously only had `GET`; confirmed by reading the file directly (an earlier broad exploration pass had incorrectly reported it as GET/POST already existing). User approved adding it over shipping list-only.
- `mobile/src/types/admin.ts`, `mobile/src/api/admin.ts` (new) — types/client for admin dashboard, issues (list+patch), vendors (list+create), violations (create), users (list/create/update/delete), and the 4 report endpoints
- `mobile/src/api/board.ts` — `listAdminViolations` extended to accept `search`/`type`/`page` (previously only `status`/`hasAppeal`/a no-op `limit`, since the server hardcodes page size to 20 regardless of any client-sent limit) — now shared by both board's and admin's violation list screens
- `mobile/src/screens/shared/ViolationManageScreen.tsx` (new) — extracted from board's violation detail screen; takes a `statusChoices` prop so board (curated subset: Under Review/Resolved/Closed) and admin (full 7-state lifecycle) can reuse the same detail/appeal-decision/status-update UI against the identical underlying `/api/admin/violations/*` endpoints
- `mobile/app/(admin)/_layout.tsx` — Tabs: Dashboard, Issues, Violations, More (was a placeholder single Stack)
- `mobile/app/(admin)/index.tsx` — real Dashboard (8 stat tiles, issues-by-status breakdown, recent activity feed, recent announcements)
- `mobile/app/(admin)/issues/*` — list (search + status filter) and manage screen (status/priority/assign-to-staff/assign-vendor via a single PATCH, since there's no dedicated GET-by-id route — detail is fetched via `PATCH` with an empty body, per the confirmed API behavior)
- `mobile/app/(admin)/violations/*` — list (search+status filter, reusing `listAdminViolations`), new (issue/draft a violation with a searchable resident picker, since no `/api/properties` or resident-search endpoint exists — client-filters the full `/api/users` roster), `[id]` (thin wrapper around the new shared `ViolationManageScreen`)
- `mobile/app/(admin)/more/*` — Vendors (list+create), Users (list+create+edit/delete, respecting the API's self-delete and SUPER_ADMIN constraints), Reports (menu + 4 read-only report screens), plus Announcements/Events/Documents/Polls/Profile re-exported from the Phase 3 shared screens

**Decisions made:**
- Added the missing `POST /api/admin/vendors` route rather than shipping vendors as list-only, per user's explicit choice — mirrors the existing `POST /api/users` pattern exactly (same file structure, `isAdmin()` gate, audit log).
- No `/api/properties` endpoint exists and `propertyId` is optional on violation creation — the mobile create-violation form only offers a resident picker, `propertyId` is never set from mobile. Flagged as a pre-existing API gap, not fixed (out of scope).
- Admin issue "detail" screen calls `PATCH .../[id]` with `{}` to read current state (confirmed this is valid and the only read path — no dedicated GET-by-id route exists for admin issues).

**Next steps:**
- Phase 5: EAS config, app store metadata, privacy policy + App Privacy/Data Safety declarations (per plan)
- Still no mobile unit tests (Jest + RNTL) — deferred per plan
- The 5 vendor entries in the dev database are each tripled (15 rows total, 3 near-identical copies of each vendor with different IDs) — pre-existing seed data duplication unrelated to this session's work, not fixed; noted here so it's not mistaken for a client bug later.

**Gotchas:**
- None new — Turbopack `root` fix from Phase 2 continues to hold; no root-inference warnings across two more dev-server restarts this session.

**Verification:** Live-tested as the demo admin account against the real API: reassigned a real issue (status Assigned→In Progress, resident-facing staff assignee changed to a different staff member, confirmed via UI after reload), created and issued a real violation (status went straight to `NOTICE_SENT` since "send immediately" was toggled, appeared correctly in the violations list), created a real vendor (appeared in the vendor list), created a real user (appeared in the roster), and confirmed all 4 report screens load real aggregated data with no errors (payments report correctly included the $1,250 payment made during Phase 2 testing). Also regression-tested resident and board logins post-Phase-4 — both still load cleanly with zero runtime errors.

## 2026-07-13 (Phase 3 — board feature screens)

**Files changed:**
- `mobile/src/screens/shared/*.tsx` (new) — extracted `AnnouncementsListScreen`, `AnnouncementDetailScreen`, `EventsListScreen`, `EventDetailScreen`, `DocumentsListScreen`, `DocumentDetailScreen`, `PollsListScreen`, `PollDetailScreen`, `ProfileScreen` out of `(resident)/more/**` — these were already 100% role-agnostic (server-side audience/role filtering does the work), so they're now reused as-is by `(board)/more/**` via thin one-line re-export route files. `(resident)/more/**` route files updated to re-export from the shared location instead of holding the implementation.
- `mobile/src/types/board.ts` (new) — `BoardDashboard`, `BoardArchRequestListItem`/`Page`, `BoardArchRequestDecisionInput`, `BoardViolationListItem`/`Page`, `ViolationStatusUpdateInput`, `AppealDecisionInput`
- `mobile/src/api/board.ts` (new) — `getBoardDashboard`, `listBoardArchRequests`/`getBoardArchRequest`/`decideBoardArchRequest` (hit `/api/board/architectural-requests*`), `listAdminViolations`/`getAdminViolation`/`updateAdminViolation`/`decideAppeal` (hit `/api/admin/violations*` — board has no separate violations API, see Decisions)
- `mobile/app/(board)/_layout.tsx` — Tabs: Dashboard, Requests, Violations, More (was a placeholder single Stack)
- `mobile/app/(board)/index.tsx` — real Dashboard (financial summary, decision queue, recent announcements)
- `mobile/app/(board)/requests/*`, `violations/*`, `more/*` (new) — architectural request review (list w/ status filter, detail w/ decision form: status/rule reference/decision reason/comment+internal toggle), violations review (escalated + appeals tabs, detail w/ status update and appeal decision forms), More menu (Announcements/Events/Documents/Polls/Profile/Logout — no Payments/Issues, not board-relevant)

**Decisions made:**
- Verified via a full second Explore pass (not assumed) that board has its OWN dedicated `/api/board/architectural-requests*` routes (strict `BOARD_MEMBER`-only gate), but **no** separate `/api/board/violations*` routes exist — board violation review reuses `/api/admin/violations*`, gated only by `role !== 'RESIDENT'` (so BOARD_MEMBER, ADMIN, SUPER_ADMIN all share it). Violation *creation* stays ADMIN-only. Mobile's `api/board.ts` reflects this asymmetry directly rather than pretending a uniform board API surface exists.
- Extracted the 5 shared screens rather than duplicating them — genuine zero-divergence DRY case (same API calls, same role-agnostic logic), not a premature abstraction.

**Next steps:**
- Phase 4: admin features (per plan at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`)
- Still no mobile unit tests (Jest + RNTL) — deferred per plan

**Gotchas:**
- None new this session — the Turbopack `root` fix from the Phase 2 entry held up cleanly (no root-inference warning on dev server restart).

**Verification:** Live-tested as the demo board account against the real API: dashboard loaded real financial/decision-queue data, approved a real architectural request (status Submitted → Approved, rule reference + decision reason persisted and displayed), approved a real violation appeal (confirmed the server's documented side effect — violation auto-transitioned Escalated → Resolved). Also regression-tested the resident role after the shared-screen extraction — dashboard, announcements, and profile all still render correctly through the new shared components.

## 2026-07-13 (Phase 2 — resident feature screens)

**Files changed:**
- `nextjs/next.config.ts` — added `turbopack: { root: path.join(__dirname) }`. **Real regression fix**, see Gotchas.
- `mobile/src/types/*.ts` (new) — hand-written types for issues, architectural requests, violations, payments, announcements, events, documents, polls, dashboard, matching exact API response shapes (verified against actual route.ts files, not guessed)
- `mobile/src/api/*.ts` (new) — one file per resource, thin typed wrappers around `apiFetch`
- `mobile/src/components/*.tsx` (new) — shared UI kit: `ScreenContainer`, `Card`, `ListCard`, `ListRow`, `StatusBadge`, `Button`, `FormField`, `ChipSelect`, `LoadingView`, `ErrorView`, `EmptyState`
- `mobile/src/hooks/useApi.ts` (new) — shared fetch/loading/error/pull-to-refresh hook for screens backed by one GET call
- `mobile/src/theme.ts`, `src/utils/format.ts`, `src/utils/tones.ts` (new) — shared colors, date/currency formatting, status→tone mapping
- `mobile/app/(resident)/_layout.tsx` — converted from a bare `Stack` to `Tabs` (Dashboard, Issues, Payments, More), each tab its own nested `Stack`
- `mobile/app/(resident)/index.tsx` — real Dashboard screen (was a placeholder)
- `mobile/app/(resident)/issues/*`, `payments/*`, `more/**` (new) — full resident screen set: issues (list/create/detail+comments), payments (ledger + pay flow with form→processing→receipt), announcements (list+read receipts/detail), events, architectural requests (list/create/detail+comments+withdraw/submit), violations (list/detail+respond/appeal), documents (search/detail/open via `Linking`), polls (list/detail+vote), profile (edit name + change password)
- `mobile/src/auth/AuthContext.tsx` — added `updateUser()` so the Profile screen can update cached user state locally (the profile PUT endpoint refreshes the web cookie but never returns a new bearer token)

**Decisions made:**
- No new picker/select dependency — built a lightweight `ChipSelect` component for enum inputs (category, priority, payment method, etc.) instead of adding `@react-native-picker/picker`
- `useApi(fetcher)` takes only a fetcher, not a separate deps array — callers with a changing dependency (route param, search text) wrap their fetcher in `useCallback(() => getX(id), [id])` themselves. Forced by a stricter `eslint-plugin-react-hooks` rule (React Compiler-aligned) that rejects non-literal dependency arrays passed into hooks — see Gotchas.
- Payments "pay" screen renders its default amount as a *derived* value (`amount || defaultFromBalance`) rather than seeding it via `useEffect` + `setState` — same lint rule family flags synchronous setState-in-effect as an anti-pattern, and the derived approach is simpler anyway.
- Events and Polls have no GET-by-id API route — their detail screens fetch the full list and find the item client-side. Documented as a pre-existing API gap, not fixed (out of scope for the mobile task).

**Next steps:**
- Phase 3: board features; Phase 4: admin features (per plan at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`)
- No mobile unit tests yet (Jest + RNTL) — still deferred to a later phase per the plan's testing strategy
- Visual polish item: the `+ New` header button on Issues/Architectural Requests list screens gets slightly clipped at 400px viewport width — not verified on an actual device/simulator yet

**Gotchas:**
- **Real regression, now fixed:** the Phase 0 root `package.json`/`package-lock.json` (npm workspaces) made Turbopack auto-infer the *repo root* as the Next.js workspace root instead of `nextjs/` itself (visible as a startup warning: "Next.js inferred your workspace root, but it may not be correct"). This broke module resolution for freshly-compiled route chunks against the wrong `node_modules` tree — concretely, `GET /api/events` 500'd with `Cannot find module 'zod'` even though `nextjs/node_modules/zod@4.4.3` was present and correct (a stray, incompatible `zod@3.25.76` had been hoisted to the *root* `node_modules` by an unrelated install). Fixed by pinning `turbopack: { root: path.join(__dirname) }` in `nextjs/next.config.ts`. If you see similar "Cannot find module" errors on routes that haven't been touched in weeks, suspect this class of issue again and check for a Turbopack root-inference warning at dev-server startup first.
- The Next.js Turbopack dev server crashed once mid-session with `RangeError: Map maximum size exceeded` inside its own `async_hooks` instrumentation, after a long run of many requests across several test scripts. Unrelated to any code in this repo — just restart the dev server if you see it. Not worth chasing further.
- `eslint-plugin-react-hooks` (installed fresh this session via `expo lint`'s auto-setup) enforces literal-array-only dependency lists and flags setState-in-effect much more aggressively than before — expect to hit this if you write a custom hook that forwards a caller-supplied deps array into `useCallback`/`useEffect`/`useMemo` internally. The fix is almost always "push the memoization to the call site," not suppressing the rule (one legitimate suppression exists in `useApi.ts` for the documented "fetch on mount" pattern, with a comment explaining why).
- All Phase 2 verification was done via Expo **web** (Playwright-driven, `--disable-web-security` in the *test browser only* to bypass CORS, which doesn't apply to real native `fetch`) against the live Next.js dev server and real demo-account data — created a real issue, posted a real comment, made a real simulated payment (ledger correctly dropped to $0 after), voted in a real poll (percentages computed correctly). Native iOS/Android behavior (beyond what was already covered in Phase 1's SecureStore fix) is still unverified in this sandboxed environment.

## 2026-07-13

**Files changed:**
- `package.json` (new, repo root) — npm workspaces (`["nextjs", "mobile"]`), converting the repo into a monorepo
- `nextjs/lib/auth.ts` — `getSession()` now falls back to an `Authorization: Bearer <token>` header when no cookie is present
- `nextjs/app/api/auth/login/route.ts`, `register/route.ts` — response body now includes `token` alongside `user` (cookie flow unchanged, additive)
- `nextjs/proxy.ts` — accepts Bearer header as alternative to cookie; returns `401` JSON for `/api/*` auth failures instead of redirecting (page routes still redirect to `/login`)
- `nextjs/app/api/resident/dashboard/route.ts` (new) — wraps existing `lib/dashboard.ts:getResidentDashboard()`, closing the gap where admin/board dashboards had HTTP routes but resident didn't
- `.github/workflows/ci.yml`, `e2e.yml` — added `paths:` filters (`nextjs/**`) so mobile-only pushes stop triggering these; both also switched their `npx tsc`/`npx prisma`/`npx playwright` steps to direct `node_modules/.bin/...` calls (see Gotchas)
- `.github/workflows/mobile-ci.yml` (new) — typecheck + lint for `mobile/`, using `npm exec -w mobile --` (not bare `npx`)
- `mobile/` (new) — Expo SDK 57 app scaffolded via `create-expo-app` + Expo Router, `expo-secure-store`, `expo-linking`, `react-native-safe-area-context`, `react-native-screens`; added `react-native-web`/`react-dom` as dev-only conveniences for headless testing
  - `app/_layout.tsx` — root nav, `Stack.Protected` guards routing to `(auth)`/`(resident)`/`(board)`/`(admin)` based on session + role
  - `app/(auth)/login.tsx`, `app/(resident|board|admin)/index.tsx` — login screen + placeholder role dashboards (real screens are Phase 2-4)
  - `src/auth/AuthContext.tsx`, `src/auth/secureStorage.ts` — session state + token persistence (SecureStore on native, localStorage on web)
  - `src/api/client.ts` — fetch wrapper attaching `Authorization: Bearer`, 401 → auto-logout
  - `src/types/auth.ts` — hand-written mirror of `nextjs/lib/auth.ts` `SessionUser`/`UserRole` (shared types package deferred, see Decisions)
  - `.env.example` — documents `EXPO_PUBLIC_API_URL`

**Decisions made:**
- Full mobile parity planned (resident + board + admin), built with Expo managed workflow + EAS, reusing the existing Next.js REST API against the same Neon DB rather than a separate backend
- Extended the existing cookie-based JWT auth with a Bearer-token variant instead of building a parallel mobile-only auth system
- Push notifications explicitly deferred to a later phase
- npm workspaces chosen over pnpm/Turborepo/Nx — npm is already the pinned tool project-wide
- Shared Zod schemas/types (`packages/shared`) deferred — hand-writing parallel TS types in `mobile/src/types/` until shape drift actually hurts
- Full plan recorded at `C:\Users\theek\.claude\plans\task-plan-the-development-rippling-whistle.md`

**Next steps:**
- Phase 2: resident feature screens (issues, arch requests, violations, payments, announcements, events, documents, polls, profile)
- Phase 3: board features; Phase 4: admin features
- Phase 5: EAS config, app store metadata, privacy policy + App Privacy/Data Safety declarations (required — app handles PII + financial data)
- Set up `mobile/` unit testing (Jest + React Native Testing Library) — none exists yet, only typecheck/lint are wired into CI so far

**Gotchas:**
- **`npx <tool>` inside a workspace member directory is unreliable in this repo now.** Confirmed two failure modes: (1) before a root install existed, `npx tsc` inside `nextjs/` silently ran an unrelated squatted npm package instead of the local compiler; (2) after a root install, it silently resolved to `mobile`'s hoisted TypeScript version (6.0.3) instead of `nextjs`'s pinned one (5.9.3) — no error either way. Always use `npm exec -w <workspace> -- <tool>` from the repo root, an `npm run` script, or a direct `node_modules/.bin/<tool>` path — never a bare `npx <tool>` from inside `nextjs/` or `mobile/`.
- `mobile/AGENTS.md`, `CLAUDE.md`, and `.claude/settings.json` are genuine official output of `create-expo-app@4.0.0` — confirmed by decompiling the real published CLI tarball, which has a documented `--no-agents-md` flag ("Skip generating AGENTS.md, CLAUDE.md, and .claude/settings.json") and a literal "Expo HAS CHANGED... read versioned docs" template string with the installed SDK version interpolated in. I initially misjudged these as a prompt injection and deleted them, then caught the mistake and restored the real regenerated content byte-for-byte. Combined with `nextjs/AGENTS.md` (separately confirmed legitimate against the real `next@16.2.9` tarball, which genuinely ships `node_modules/next/dist/docs/`): both Next.js and Expo now ship these files by default specifically to stop AI agents coding against stale training-data APIs. Lesson: verify an "this looks like an injection" hunch against the actual published registry tarball before acting on it, in either direction.
- `expo-secure-store` has no web implementation and throws at runtime on web (`getValueWithKeyAsync is not a function`) — `mobile/src/auth/secureStorage.ts` branches on `Platform.OS` (localStorage on web, SecureStore on native), matching Expo's own documented pattern. Native (iOS/Android simulator or device) auth flow has NOT been verified in this sandboxed environment — only verified via Expo web (with CORS disabled in the test browser only, not in product code, since native `fetch` isn't subject to CORS).
## 2026-06-24

**Files changed:**
- `server/prisma/schema.prisma` — renamed `name`→`firstName`+`lastName`, `password`→`passwordHash` on User; added Property, ResidentProfile, Vendor, AuditLog models
- `server/prisma/seed.ts` — full rewrite: 20 residents, 2 admins, 3 board members, 5 vendors, 10 properties, 2 sample announcements
- `server/prisma/migrations/20260624190500_split_user_name_add_models/` — new migration applying all schema changes
- `server/src/services/auditLog.ts` — new utility: `createAuditLog({ userId, action, entityType, entityId, metadata })`
- `server/src/schemas/auth.ts` — register/updateProfile schemas use `firstName`+`lastName` instead of `name`
- `server/src/controllers/authController.ts` — updated for `passwordHash`, `firstName`, `lastName`; `safeUser()` returns both name fields
- `server/src/controllers/announcementsController.ts` — `authorSelect` uses `firstName`+`lastName`
- `server/src/controllers/usersController.ts` — search by `firstName`, `lastName`, or `email`; selects include both name fields
- `server/src/controllers/maintenanceController.ts` — `submittedBySelect` uses `firstName`+`lastName`
- `server/src/controllers/eventsController.ts` — `createdBySelect` uses `firstName`+`lastName`
- `server/src/controllers/duesController.ts` — `userSelect` uses `firstName`+`lastName`
- `server/src/controllers/pollsController.ts` — `createdBy` select uses `firstName`+`lastName`
- `server/src/controllers/documentsController.ts` — `uploadedBySelect` uses `firstName`+`lastName`
- `server/src/controllers/dashboardController.ts` — all user selects use `firstName`+`lastName`
- `server/src/controllers/authController.test.ts` — `fakeUser` updated to `firstName`/`lastName`/`passwordHash`
- `server/src/controllers/usersController.test.ts` — `fakeUser` updated to `firstName`/`lastName`
- `client/src/types/index.ts` — `User` type uses `firstName`/`lastName`; `UserSummary` type added; `fullName()` and `dashboardPath()` helpers exported
- `client/src/components/ProtectedRoute.tsx` — accepts optional `allowedRoles`; wrong-role access redirects to user's own dashboard
- `client/src/routes/index.tsx` — added `/resident/dashboard`, `/admin/dashboard`, `/board/dashboard` routes with role guards; `/` redirects to `/resident/dashboard`; `/users` guarded to ADMIN only
- `client/src/pages/LoginPage.tsx` — demo account buttons (Resident / Admin / Board Member) pre-fill the form; post-login redirects to role-specific dashboard
- `client/src/pages/RegisterPage.tsx` — split into `firstName`+`lastName` fields; redirects to role dashboard after register
- `client/src/pages/ProfilePage.tsx` — split into `firstName`+`lastName` fields
- `client/src/layouts/AppLayout.tsx` — uses `fullName()`, nav Dashboard link points to role-specific path
- `client/src/pages/DashboardPage.tsx` — greeting uses `user.firstName`; announcement author uses `fullName()`
- `client/src/pages/UsersPage.tsx` — `ManagedUser` has `firstName`+`lastName`; displays via `fullName()`
- `README.md` — added Authentication section: demo credentials, JWT flow, role redirect table

**Decisions made:**
- `password` stays as the request body field name in Zod schemas; only the DB column is `passwordHash`
- `fullName(user)` helper centralizes first+last concatenation — use it everywhere a display name is needed
- `dashboardPath(role)` centralizes the role→route mapping (in `client/src/types/index.ts`)
- Demo buttons on login pre-fill form instead of auto-submitting — user still clicks Sign in
- Wrong-role dashboard access redirects to the user's own dashboard (not a 403 error page)
- `/` redirects to `/resident/dashboard`; ProtectedRoute with `allowedRoles` then redirects to the correct one per role
- Used `prisma migrate reset --skip-seed` then `prisma migrate dev` to cleanly apply schema changes without data-loss conflicts

**Next steps:**
- Wire `createAuditLog` into auth events (login, register, password change)
- Build API routes + UI for Property and ResidentProfile (currently schema-only, no endpoints)
- Build API routes + UI for Vendor management
- Feature pages exist as stubs — flesh out: announcements CRUD, maintenance status updates, events, polls voting, dues management, document upload

**Gotchas:**
- `user.name` no longer exists anywhere — always use `fullName(user)` or `user.firstName`/`user.lastName`
- All 3 demo accounts: password is `password123`
- 42 server tests passing as of this session
- Migration `20260624190500_split_user_name_add_models` must be present — if DB is reset from scratch, all 8 migrations replay automatically
- The `/` route silently redirects — don't use it as a "home" link; use `dashboardPath(user.role)` instead
