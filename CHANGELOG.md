# Changelog

All notable changes to this project are documented in this file.

## [1.4.0]

### Added
- **Multi-select session observation chips.** Every structured field in the progress form
  (mood, energy, attention, teaching approach, activity type, biggest success/challenge, etc.)
  now accepts multiple selections instead of one — a session that mixed `guided_practice` and
  `questioning`, for example, can record both. Types, Zod validation, field components, and
  Tsareena's prompt formatter were all updated to treat each observation as `T[]` instead of `T`.
  No database migration was required — `session_observations` is stored as a single JSONB column.
- **Admin access to progress logging.** The RLS policy and `POST /api/progress` already allowed
  admins to log progress for any student; the admin students table was missing the UI entry point.
  "View Progress" / "Log Progress" links were added to each student card in
  `components/admin/StudentsTable.tsx`, mirroring the volunteer dashboard.

## [1.3.0]

### Added
- **Roadmap progress bar on the student profile.** A compact bar sits below the profile header
  showing how far the student has moved through the English and Math roadmaps, sharing the same
  position math as the Roadmap tab's tracker. Clicking it jumps to the Timeline tab. A subject
  with no roadmap defined for its grade renders as a hatched "not set up" segment rather than 0%.
- **Admin debrief editing.** Admins can correct an existing debrief's taught content — topic,
  understanding status, homework, notes — via `PATCH /api/progress/[id]`
  (`components/admin/EditProgressDialog.tsx`). Re-runs the roadmap validation against the merged
  result of the existing row plus the patch. Deliberately excludes `verification_status`,
  `learning_circle_id`, `verified_by`, `verified_at`, and `session_observations` — fixing a
  clerical error shouldn't re-trigger verification or rewrite rich session detail. New audit
  columns `progress.edited_by` / `progress.edited_at` (migration `009_progress_edit_trail.sql`)
  are stamped server-side by a trigger from `auth.uid()`/`now()`, never accepted from the client.

## [1.2.0]

### Added
- **Learning Circles & debrief verification.** A Learning Circle is a named group of volunteers
  led by one admin. Debriefs filed by a circle's members are held as `pending` until the circle's
  lead admin verifies them; only verified debriefs are reflected in `latest_progress`,
  `students_needing_revision`, roadmap continuity, reports, and exports.
  - `progress.verification_status` defaults to `verified`, so every pre-existing row and every
    volunteer outside a circle keeps the original zero-friction flow. Verification is strictly
    opt-in, per volunteer, by adding them to a circle.
  - Schema: `supabase/migrations/008_learning_circles.sql` adds the `learning_circles` and
    `learning_circle_members` tables, a `debrief_verification_status` enum, and the related
    columns on `progress`. RLS mirrors `assignments` — any authenticated user can read circles
    and membership; only admins write.
  - The rules are enforced in triggers, not just the API layer, since `progress` is directly
    writable by any authenticated volunteer for their assigned students: `trg_stamp_progress_verification`
    derives status and owning circle on insert; `trg_guard_debrief_verification` restricts status
    changes to the circle's own lead and stamps the audit columns; `trg_learning_circle_lead_must_be_admin`
    keeps a circle's lead an active admin.
  - Invariants: a volunteer belongs to at most one circle, and `learning_circle_id` is snapshotted
    at insert and immutable — later membership changes never reassign an in-flight debrief.
  - New API: `GET|POST /api/learning-circles`, `GET|PATCH|DELETE /api/learning-circles/[id]`,
    `PUT /api/learning-circles/[id]/members`, `GET /api/debriefs/pending`,
    `POST /api/debriefs/[id]/verify`.
  - New UI: a Learning Circles management tab under People, a Verification queue (my-circles /
    all-circles), dimmed hollow-node markers for pending entries on the student timeline, and an
    amber "Sent for verification" state on the progress form for circle members.
  - `analyticsRepository` splits learning-state metrics (weak topics, roadmap continuity — verified
    only) from activity/coverage metrics (did the volunteer show up and write it up — anything not
    rejected, pending included).

### Fixed
- Adding `verified_by` gave `progress` a second foreign key into `volunteers`, which makes a bare
  `volunteers(...)` PostgREST embed ambiguous. The three affected queries
  (`progressRepository.listForStudent`, `progressRepository.recent`, `app/api/export/route.ts`)
  now qualify the embed by constraint name.

## [1.1.0] — Security & dependency hardening

### Fixed
- **`volunteers` table was readable by anyone, unauthenticated.** The `volunteers_select_all`
  policy used a bare `using (true)` with no `to` clause. Fixed in `supabase/schema.sql` and via
  migration `007_volunteers_select_authenticated_only.sql`, matching every sibling table's
  `auth.role() = 'authenticated'` check, with a new scope test in `supabase/tests/`.
- **Upgraded Next.js 15 → 16**, resolving critical advisories in `next` plus the bundled
  `sharp`/`postcss` dependencies. This was a major-version migration, not a patch bump — see
  "Next.js 16 migration" below.
- **Replaced `xlsx` with `exceljs`** for the Excel export path (`app/api/export/route.ts`) to close
  a prototype-pollution/ReDoS advisory with no available patched release on the npm registry.
- **Volunteer PII (phone, date of birth) was reachable by any authenticated non-admin user**
  through three paths, all narrowed to a `PublicVolunteer` projection: `GET /api/volunteers`,
  the nested `volunteers!assignments_volunteer_id_fkey(...)` select in
  `assignmentRepository.listForStudent`, and the volunteer profile page, which now only passes
  the full row to the client when the viewer is the volunteer themself or an admin.
- Stale Tsareena model ID (`gemini-3.6-flash`) updated to the current GA Gemini Flash model.
- Raw error messages no longer leak to clients on 500s — only `ApiError` messages are forwarded;
  anything else logs server-side and returns a generic message.
- `GET /api/students/[id]` now distinguishes "not found" from other Supabase errors instead of
  turning every failure into a 404 with the raw error text.
- Added security headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) in `next.config.mjs`, scoped to allow the Supabase project domain, the
  Gemini API domain (Tsareena's direct browser calls), and dicebear avatars.
- Added a lightweight in-memory, IP+route-keyed rate limiter (`lib/rateLimit.ts`) on login,
  forgot-password, `/api/export`, and `/api/search`. Single-instance only — swap for a shared
  store (Upstash Redis, Vercel KV) before deploying to more than one region/instance.
- `scripts/seed.ts` no longer uses a hardcoded password; it requires an explicit `--confirm-seed`
  flag, refuses to run against a project that already has volunteers, and prints a freshly
  generated password once per run.
- `AssignVolunteersDialog.handleSave()` used `Promise.all`, which doesn't reject on HTTP error
  responses, so a partial failure was silently swallowed. Rewritten with `Promise.allSettled` and
  per-item error reporting.
- Removed the orphaned empty `app/api/analytics` directory and the unused `hooks/useAnalytics.ts`.

### Next.js 16 migration
- Renamed `middleware.ts` → `proxy.ts` (Next 16's convention) and its exported function.
- Migrated `next lint` (removed in v16) to the ESLint CLI via the official codemod, regenerating
  `eslint.config.mjs`. Two React Compiler-readiness rules bundled with the new config
  (`react-hooks/set-state-in-effect`, `react-hooks/incompatible-library`) flag the standard
  "fetch data in an Effect" and `react-hook-form` `watch()` patterns used throughout the app;
  they're disabled with a comment, since adopting the Compiler is a separate migration.
  Genuinely fixable issues the upgrade surfaced were fixed outright: `useMediaQuery` rewritten
  with `useSyncExternalStore`, a non-simple dependency array in `useStudents`, and config files
  updated to ESM-only imports.

## [1.0.0] — Initial hardened release

### Added
- **Weekend Coverage dashboard** (`/admin/coverage`) — which students got a progress update this
  weekend, as a coverage percentage plus covered/missing lists, with weekend navigation.
- **Global search** (`GlobalSearch.tsx`, `/api/search`) mounted in `Topbar` — role-aware
  (volunteers only see their own assigned students), debounced, keyboard-navigable via ⌘K/Ctrl+K.
- **Themed confirm dialogs** (`components/ui/alert-dialog.tsx`, `ConfirmDialog.tsx`) replacing
  native `confirm()` calls across the students, volunteers, and roadmap admin tables.
- **Mobile card layouts** for the students and volunteers admin tables, alongside the existing
  desktop table view.
- **Drag-and-drop roadmap reordering** in `RoadmapBuilder`, via `framer-motion`'s `Reorder`.
- **Tactile pickers** replacing plain dropdowns for the two highest-traffic choices: a segmented
  `LevelPicker` for English/Math level, and a three-way `StatusPicker` for how a lesson landed.
- **Route-level resilience**: loading skeletons, a styled error boundary with a recovery path, a
  dependency-free global error boundary, and a not-found page.
- **Favicon and PWA basics** generated at build time via `next/og`, plus a web manifest.
- **Design system refresh**: full color scales for two anchor hues (forest green / terracotta
  clay), a genuinely distinct dark mode, self-hosted Fraunces + Plus Jakarta Sans typography via
  `@fontsource` (removing the build-time dependency on Google Fonts), and new radius/shadow/
  animation tokens applied across cards, buttons, badges, and charts.

### Fixed
- Self-hosted fonts instead of `next/font/google`, removing an external network dependency from
  the production build and shaving a render-blocking request off every page load.
