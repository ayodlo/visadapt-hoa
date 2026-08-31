# Portal HOA Demo Deliverables

## Goal

Polish the Portal HOA admin experience and prepare the application for demos with prospective HOA clients.

Primary priorities:

- Admin usability
- Professional visual consistency
- Demo readiness
- Scalability for communities with hundreds or thousands of residents
- Preserving existing working functionality
- Avoiding unnecessary scope expansion

---

# 1. Branding

## Requirements

- Replace all user-facing references to `Community HQ` with `Portal HOA`.
- Search the entire application for instances of the old brand name.
- Update references in:
  - Page titles
  - Navigation
  - Login screens
  - Headers
  - Metadata
  - Labels
  - Empty states
  - Buttons
  - User-facing messages
  - Any other visible application text

## Out of Scope

Do not create:

- A new logo
- A new color palette
- A new design system
- A full branding package

Those can be handled later.

---

# 2. Login Page Cleanup

## Requirements

- Remove the `Demo Accounts` section from the login experience.
- The existing demo accounts are no longer functional and should not be presented to users.
- Remove or hide any other obviously nonfunctional demo controls that could confuse users during a demo.
- Preserve the existing login functionality.

---

# 3. Form Input Font Size

## Requirements

Ensure all form controls have a minimum font size of `1rem` / `16px`.

Review all:

- `input`
- `select`
- `textarea`
- Search inputs
- Autocomplete inputs
- Date inputs
- Number inputs
- Other editable form controls

Avoid Tailwind classes such as `text-sm` on form controls when they result in a font size below `1rem`.

Example target:

    font-size: 1rem;

## Reason

Mobile browsers, particularly iOS Safari, may automatically zoom into form controls when their font size is below 16px.

The form should remain at the user's existing zoom level when a field receives focus.

---

# 4. Remove Emojis From Admin UI

## Requirements

- Remove emojis from the admin experience.
- Replace emojis with proper icons where an icon provides useful context.
- Reuse the application's existing icon library whenever possible.
- Maintain a consistent icon style throughout the application.

Preferred options:

- Existing Heroicons
- Existing application SVG icons
- Existing icon components

Do not introduce decorative emojis into new admin UI.

## Goal

Create a cleaner, more professional, and more elegant admin experience.

---

# 5. Dashboard Historical Metrics

## Requirements

Enhance dashboard metric cards with historical or trend information where useful.

Prioritize the `Unpaid Balances` metric first.

An admin or board member should be able to understand whether unpaid balances have:

- Increased
- Decreased
- Remained stable

over a recent historical period.

A reasonable initial period is approximately the previous three months.

## UI Options

Use an appropriate visualization such as:

- Line chart
- Bar chart
- Sparkline
- Trend percentage
- Up/down trend indicator

The visualization should make the historical direction obvious without overwhelming the dashboard.

## Important

Do not invent historical data.

Before implementation:

1. Inspect the existing database/data model.
2. Determine whether historical values already exist.
3. Determine whether historical values can be derived from existing invoice/payment records.
4. Determine whether additional queries are required.
5. If additional database fields or backend changes are required, document the missing requirements before changing the architecture.

Do not add fake historical values solely to make the dashboard appear complete.

---

# 6. Standardize Dashboard Empty States

## Requirements

Standardize the appearance of dashboard sections that contain no data.

Use the current `Recent Announcements` empty state as the primary visual reference.

Avoid having different empty states using inconsistent:

- Border colors
- Text colors
- Background colors
- Messaging styles
- Icons
- Layouts
- Spacing

## Goal

All empty dashboard sections should feel like part of the same design system.

Sections should remain visible when empty and clearly communicate that no data currently exists.

Example concepts:

- No recent announcements
- No issues require attention
- No unpaid balances
- No recent activity

Do not completely hide important dashboard sections simply because they currently contain no data.

---

# 7. Standardize Dashboard Card Heights

## Requirements

Cards positioned within the same dashboard row should use equal heights where practical.

Example:

`Needs Attention` and `Recent Announcements` should align vertically and have matching heights when they appear beside each other.

## Requirements

- Preserve responsive behavior.
- Keep desktop/tablet rows visually aligned.
- Avoid unnecessary fixed heights when flex/grid stretching can solve the issue.
- Do not force equal heights when doing so would create broken layouts on smaller screens.
- Prefer layout-driven equal heights rather than arbitrary hardcoded pixel values.

---

# 8. Users / Residents Search

## Requirements

Add search functionality to user/resident management screens.

Support searching by at least:

- Resident name
- Resident email

Search should work with partial values.

Examples:

Searching:

    dev

could match:

    Devon Lewis

Searching:

    gmail

could match a resident whose email contains:

    @gmail.com

## Scalability

Design the experience for communities containing:

- Hundreds of residents
- Potentially thousands of residents

Avoid requiring admins to manually scroll through very large lists.

---

# 9. Users / Residents Filtering

## Requirements

Where useful, provide filtering functionality in addition to search.

Use existing resident/user fields where appropriate.

Potential filters may include existing concepts such as:

- Role
- Status
- Community

Only include filters that are supported by actual application data.

Do not invent unnecessary fields simply to increase the number of available filters.

## Goal

Make large resident lists easy for admins to navigate.

---

# 10. Event Image Upload

## Requirements

Allow admins to optionally upload an image when creating or editing an event.

Example use cases:

- Community party
- Fourth of July celebration
- Neighborhood event
- Community engagement event
- Holiday event
- Community meeting

## Behavior

- Image must be optional.
- Events without images must continue to work normally.
- Display the uploaded image when one exists.
- Do not show broken image placeholders when an event has no image.
- Preserve all existing event fields.

Existing fields currently include concepts such as:

- Title
- Location
- Description
- Start date
- End date

## Implementation

Reuse the application's existing file-storage/upload architecture if one exists.

Do not introduce a new storage provider without first reviewing the current architecture.

If file storage has not yet been implemented, identify the missing storage requirement before introducing a solution.

---

# 11. Issues

## Requirements

Verify that issues submitted by community members correctly appear within the admin Issues experience.

Existing search/filter functionality appears acceptable.

Do not redesign the Issues feature unless necessary to support the expected resident-to-admin workflow.

Verify:

- Resident submits issue.
- Issue is persisted.
- Admin can view issue.
- Admin can search/filter issues.
- Relevant resident information is associated with the issue.

---

# 12. Violation Resident Selection Bug

## Problem

Existing residents are not reliably selectable when creating a violation.

## Requirements

- Fix resident selection.
- Ensure residents are dynamically populated from actual application data.
- Do not use hardcoded resident values.
- Verify that existing residents appear as options.
- Verify the selected resident ID is correctly submitted with the violation.
- Verify the selected resident can be retrieved when viewing the violation.

---

# 13. Searchable Violation Resident Selector

## Requirements

Replace the basic resident dropdown with a searchable/autocomplete selector.

Expected interaction:

1. Admin focuses the resident field.
2. Admin begins typing a resident's name or other identifying information.
3. Matching residents appear.
4. Admin selects the appropriate resident.
5. The selected resident is clearly displayed.
6. The resident's ID is submitted with the form.

Search should support useful resident information such as:

- Name
- Email

If useful existing data is available, the result could also show another identifier such as a unit/address.

Do not invent new resident fields solely for the autocomplete.

## Scalability

The solution must remain usable with hundreds or thousands of residents.

Avoid requiring the admin to scroll through a massive `<select>` list.

## Accessibility

The autocomplete must support:

- Keyboard navigation
- Visible focus
- Screen reader labeling
- Selection via keyboard
- Clear indication of the selected option

---

# 14. Violation Attachments

## Requirements

Replace the existing `Coming Soon` attachment functionality.

Allow admins to attach evidence to a violation.

Support at least:

- Images
- Documents

Potential examples:

- Violation photo
- PDF
- Supporting document
- Written notice
- Evidence file

## Requirements

- Upload the actual file.
- Store the file securely.
- Associate the file with the correct violation.
- Allow authorized users to access the attachment.
- Preserve the existing ability to send a violation notice to the resident.
- Handle upload errors gracefully.
- Do not submit a broken attachment reference if uploading fails.

## Security

Use the application's existing authenticated file-storage approach if available.

Do not create a separate storage architecture without reviewing the current implementation first.

---

# 15. Maintenance Request Improvements

## Requirements

Expand maintenance requests beyond only:

- Title
- Description

Add enough structured information to help determine who should handle the request.

Potential fields/categories mentioned in the feedback include:

- Interior
- Exterior
- Plumbing
- Electrical

## Goal

Give residents enough guidance to submit useful maintenance requests.

Make it easier for admins to understand the request and route the work to the appropriate person or vendor.

## Important

Do not create a large or overly complicated maintenance taxonomy without confirming that it is needed.

Start with a simple, extensible structure.

Reuse existing data models where practical.

---

# 16. Poll Admin Experience

## Current Problem

Admins and board members are currently treated similarly to residents when viewing polls.

The admin experience should focus more heavily on engagement data rather than encouraging admins to participate as ordinary residents.

## Requirements

Provide useful poll engagement information for admins.

Include where supported:

- Total votes
- Total eligible residents
- Participation percentage
- Residents who voted
- Residents who have not voted

If existing data supports it, also consider:

- Residents who participate frequently
- Residents who rarely participate
- Residents who participate in every poll
- Residents who participate in no polls
- Participation trends across multiple polls

## Important

Do not invent engagement metrics that cannot be derived from existing data.

Inspect the current poll/vote schema before implementing advanced analytics.

Do not add unnecessary analytics tables or fields without verifying they are needed.

---

# 17. Payments — Resident-Specific Amounts

## Requirements

Allow admins to assign specific amounts owed to specific residents.

Do not assume every resident has the same HOA amount or assessment.

Example:

    Resident A: $250
    Resident B: $300
    Resident C: $425

The application must support differences between residents.

## Admin Experience

Admins should be able to:

- Select a resident
- Assign an amount owed
- View the resident's amount owed
- Update the amount where appropriate
- Determine whether the balance has been paid
- View outstanding balances

Preserve existing payment functionality.

## Data Requirements

Before implementation:

1. Review the existing payment schema.
2. Determine how payments are currently associated with residents.
3. Determine whether assessments/balances already exist separately from completed payments.
4. Avoid overloading an unrelated field if a proper balance/assessment model is required.
5. Document significant schema changes before implementing them.

---

# 18. Document File Upload

## Requirements

Implement actual file upload functionality for Documents.

Preserve current metadata such as:

- Title
- Category
- Description
- Other existing document metadata

Add support for:

- File selection
- Upload
- Secure storage
- Retrieval
- Viewing and/or downloading

## Access

Documents should be available to authorized residents.

The product also needs a mechanism for certain documents to potentially be publicly accessible.

Do not make all documents public by default.

Public/private access should be intentional.

If a document visibility field already exists, reuse it.

If no visibility mechanism exists, document the requirement before changing the schema.

## Security

Review the existing:

- Authentication
- Authorization
- Storage
- Database schema

before implementing public document access.

Residents should not gain access to documents they are not authorized to view.

---

# 19. Community Editing

## Requirements

Existing communities should be editable.

At minimum, admins should be able to modify existing fields such as:

- Community name

If additional editable fields already exist, expose them appropriately.

Potential existing fields may include:

- Name
- Description
- Other community metadata

Do not invent additional community fields without reviewing the current schema.

---

# 20. Community Management

## Requirements

Add standard management actions for communities.

Support where appropriate:

- Create
- View
- Edit
- Delete

Deletion should use an appropriate confirmation step to prevent accidental deletion.

Do not allow destructive actions to happen from a single accidental click.

Preserve current authorization rules.

---

# 21. Community Search and Filtering

## Requirements

Add search/filter functionality to the Communities screen.

This should support admins who may manage many communities.

At minimum, support searching by:

- Community name

Only add additional filters when supported by meaningful existing community data.

Search should support partial matches.

---

# 22. Architectural Requests

## Status

DO NOT EXPAND THIS FEATURE YET.

The feedback raised a product-level question about whether residents should submit architectural requests directly through Portal HOA.

The concern is that architectural requests may require a more formal process outside of the application.

## Requirements

- Preserve currently working functionality.
- Do not invest in additional architectural-request functionality.
- Do not redesign the workflow.
- Do not add new submission features.
- Flag this feature as requiring a product decision before further implementation.

---

# General Engineering Requirements

## Scope

Only make changes required by the deliverables above.

Do not perform unrelated:

- Refactors
- Architecture changes
- Dependency upgrades
- Design changes
- Database changes
- Folder reorganizations
- Naming changes
- Formatting changes across unrelated files

unless required to implement a deliverable.

Keep the implementation focused.

---

# Existing Architecture

Before implementing each feature:

1. Inspect the current implementation.
2. Understand the existing data flow.
3. Reuse existing components where practical.
4. Reuse existing design patterns.
5. Reuse existing APIs.
6. Reuse existing database models.
7. Reuse existing storage solutions.
8. Reuse existing authentication logic.
9. Reuse existing authorization logic.
10. Follow existing project conventions.

Do not create duplicate systems when an existing solution can be extended.

---

# Dependencies

Do not install new dependencies without a clear need.

Before adding a package:

1. Determine whether the feature can be implemented with existing dependencies.
2. Determine whether the browser/platform already provides the required functionality.
3. Explain why the new dependency is necessary.
4. Prefer small, maintained packages when a dependency is unavoidable.

Do not replace existing libraries simply because another library is preferred.

---

# Data Integrity

Do not invent:

- Database fields
- API responses
- Historical data
- Residents
- Payments
- Poll analytics
- File URLs
- Community records
- Fake backend responses

If required data does not currently exist:

1. Identify the missing requirement.
2. Determine the smallest appropriate schema/API change.
3. Document the required change.
4. Avoid creating fake frontend behavior that implies the feature works when the backend does not support it.

---

# Accessibility

Maintain or improve accessibility throughout implementation.

Target WCAG 2.1 AA where practical.

Requirements include:

- Proper `<label>` and form-control associations
- Keyboard-accessible controls
- Visible focus states
- Semantic HTML
- Appropriate ARIA attributes
- Accessible error messaging
- Minimum 16px form-control font size
- Accessible autocomplete/search interactions
- Accessible modal/dialog behavior
- Accessible file upload controls
- Accessible validation messages
- Appropriate button names
- Decorative icons hidden from assistive technology where appropriate

Do not use ARIA as a replacement for semantic HTML when native HTML provides the required semantics.

---

# Responsive Design

All new functionality must remain usable on:

- Desktop
- Tablet
- Mobile

Verify:

- Forms do not overflow.
- Tables remain usable.
- Search controls remain accessible.
- Cards stack appropriately.
- Dialogs fit within the viewport.
- Text remains readable.
- Form inputs do not trigger unwanted mobile zoom.
- Autocomplete results are usable on small screens.

Avoid introducing layouts that only work on large screens.

---

# Search / Filter Behavior

Where search is introduced:

- Support partial matches.
- Search should be case-insensitive unless existing behavior intentionally differs.
- Avoid unnecessary page reloads.
- Preserve existing URL/query behavior where applicable.
- Avoid filtering data incorrectly due to null/undefined fields.
- Handle empty search terms correctly.
- Do not mutate source arrays while sorting/filtering React state.

Where large datasets exist, consider whether filtering belongs on the server rather than loading all records into the browser.

Do not prematurely introduce complex server-side search if current dataset sizes do not require it.

---

# File Upload Behavior

For features requiring file uploads:

- Validate allowed file types.
- Validate reasonable file-size limits.
- Handle failed uploads.
- Show useful error feedback.
- Associate uploaded files with the correct record.
- Avoid exposing private storage URLs publicly unless intended.
- Reuse the existing storage provider when one exists.
- Do not store raw file contents directly in the database unless the existing architecture intentionally does so.

Features requiring file upload include:

- Event images
- Violation attachments
- Documents

---

# Loading / Error States

Any new asynchronous functionality should include appropriate:

- Loading states
- Empty states
- Error states
- Success feedback where useful

Do not leave controls appearing functional while an operation is processing if duplicate submissions could occur.

---

# Testing

After implementation, run the project's existing verification commands.

Use the package manager already configured by the repository.

Do not change package managers.

Where these scripts exist, run:

    pnpm lint
    pnpm test
    pnpm build

Also run any existing:

- TypeScript/typecheck command
- Unit tests
- Integration tests
- End-to-end tests
- Playwright tests

If the project uses another package manager, use the equivalent existing commands.

Do not modify tests simply to make failing behavior pass unless the existing test is incorrect because of an intentional requirement change.

---

# Final Verification

Before considering the work complete:

- Review the complete Git diff.
- Confirm there are no unrelated changes.
- Confirm existing features still work.
- Confirm the application builds successfully.
- Confirm there are no obvious console errors.
- Confirm forms work using keyboard navigation.
- Confirm responsive layouts still work.
- Confirm new search functionality supports partial matches.
- Confirm empty states are visually consistent.
- Confirm cards in the same dashboard row align appropriately.
- Confirm residents can be selected when creating violations.
- Confirm file uploads handle missing/invalid files gracefully.
- Confirm payment values can differ between residents.
- Confirm no fake/mock data was added to simulate production functionality.
- Confirm no existing authorization rules were bypassed.
- Confirm all user-facing references to Community HQ have been removed.

---

# Recommended Implementation Order

## Phase 1 — Demo Polish

Complete these first because they should improve the demo experience without requiring significant backend changes.

1. Replace Community HQ branding with Portal HOA.
2. Remove Demo Accounts from login.
3. Fix form-control font sizes.
4. Remove emojis.
5. Standardize dashboard empty states.
6. Standardize dashboard card heights.
7. Add user/resident search.
8. Add user/resident filtering where appropriate.

---

# Phase 2 — Admin UX

Complete after the initial demo-polish work.

1. Fix violation resident selection.
2. Implement searchable/autocomplete resident selector.
3. Add optional event images.
4. Add community editing.
5. Add community management actions.
6. Add community search/filtering.
7. Improve maintenance request fields.
8. Verify resident issue submission/admin issue workflow.

---

# Phase 3 — File / Data Features

These features may require backend, database, or storage work.

Review existing architecture before implementation.

1. Violation attachments
2. Document uploads
3. Resident-specific payment amounts
4. Poll engagement analytics
5. Dashboard historical metrics

---

# Deferred Feature

Do not expand the following feature until a product decision has been made:

- Architectural Requests

The current architectural-request functionality should be preserved, but additional development should be paused.

---

# Claude Code Working Instructions

When implementing these deliverables:

1. Work through one deliverable or closely related group of deliverables at a time.
2. Inspect the relevant existing code before making changes.
3. Do not assume how a feature works without reading the implementation.
4. Keep changes narrowly scoped.
5. Avoid unrelated refactors.
6. Do not install new dependencies unless necessary.
7. Do not create fake data to make incomplete features appear functional.
8. Preserve existing working functionality.
9. Follow existing TypeScript types and project patterns.
10. Avoid using `any`.
11. Maintain accessibility.
12. Maintain responsive behavior.
13. Run appropriate tests after each meaningful feature group.
14. Review the Git diff before declaring work complete.
15. Report anything that cannot be completed because of missing backend, schema, API, storage, or product requirements.

If a requested feature conflicts with the existing architecture or requires a significant architectural change, stop and explain:

- What currently exists
- Why the requested feature cannot cleanly use it
- What change would be required
- The smallest safe implementation option

Do not silently redesign the architecture.