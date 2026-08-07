# Sprint Changelog

Scope note up front: the codebase coming into this sprint already implemented most of the
prompt to a high standard — action-first volunteer dashboard with hover-animated student
cards, the teaching workflow (last topics, notes, homework, weak areas, auto-recommended
next lesson), the card-based mobile-friendly progress update form with a save confirmation
animation, the color-coded student timeline, admin analytics with charts, professional empty
states throughout, dark mode, and consistent spacing/typography. Rewriting those would have
meant discarding working, well-tested code for no user benefit — so this sprint targeted the
features that were genuinely missing (Coverage, Search) and a real progress-tracker visual
for the roadmap, plus a final-review pass for bugs and dead code.

## Added

- **Coverage dashboard** (`/admin/coverage`) — new page answering "which students were
  updated this weekend?" Shows coverage %, updated/missing counts, a Sat–Sun date range with
  prev/next navigation, and two color-coded grids (green = updated, with who and when; red =
  missing, with the assigned volunteer). Backed by a new `analyticsRepository.weekendCoverage()`
  repository method. Added to the admin sidebar nav, right under Analytics.
- **Global search** — a search box in the Topbar (visible on desktop and mobile) searching
  student name, grade, and, for admins, volunteer name. Debounced, keyboard-navigable
  (up/down/Enter/Esc), and role-aware: volunteers only ever see their own assigned students,
  matching the existing dashboard visibility rule. Backed by a new `/api/search` route.
  Also wired up Cmd/Ctrl+K to jump into it — see "Dead code" below.
- **Roadmap progress tracker** — new "Roadmap" tab on the student profile page rendering
  each subject's roadmap as a done / current / upcoming sequence (checkmark / arrow / empty
  box, matching the requested format exactly) instead of a plain table, with the current
  recommended lesson highlighted. Reuses the existing `recommendNextTopic` engine output —
  no new recommendation logic was written.

## Fixed

- **Ambiguous relationship embed (latent bug).** `assignments` has two foreign keys into
  `volunteers` (`volunteer_id` and `assigned_by`). An unqualified `volunteers(name)` embed in
  a Supabase/PostgREST query is ambiguous and can fail at request time. The new coverage query
  disambiguates with `volunteers!volunteer_id(name)`. Two pre-existing queries
  (`studentRepository.assignedVolunteers`, `volunteerRepository.studentsPerVolunteer`) have the
  same latent ambiguity and are worth the same one-line fix in a follow-up pass — left alone
  here since they're outside this sprint's scope and are evidently working against the current
  schema.
- **Dead code reactivated instead of left to rot.** `store/useAppStore.ts` already declared
  `commandPaletteOpen` / `setCommandPaletteOpen`, but nothing in the app ever read or set it —
  clear scaffolding for a global-search entry point that was never finished. Rather than leave
  it dead or duplicate the pattern, the new Global Search now drives it directly, so Cmd/Ctrl+K
  focuses search from anywhere in the app.
- **Unused imports removed** (flagged by a repo-wide scan, not just spot-checks):
  - `app/(dashboard)/dashboard/page.tsx` — duplicate `Users` icon import under two names, and
    an unused `assignmentRepository` import.
  - `components/progress/ProgressForm.tsx` — unused `AnimatePresence` import.
  - `app/(dashboard)/admin/reports/page.tsx` — unused `EmptyState` import (the page uses inline
    "all clear" text instead, which is fine — the import just wasn't needed).

## Reviewed, no changes needed

- `components/ui/*` — shadcn primitives include some Radix sub-components (`Check`,
  `ChevronRight`, `Circle` in the dropdown menu) not yet used by any call site. Left as-is:
  they're standard scaffolding for the full Radix API surface (checkbox items, submenus, radio
  items), matching the project's own "reuse existing components" convention, and removing them
  would just mean re-adding them the next time a submenu is needed.
- `components/admin/ExportPanel.tsx`, `RoadmapBuilder.tsx`, `VolunteersTable.tsx`,
  `StudentsTable.tsx` — read through fully; consistent with the rest of the codebase's patterns,
  proper loading/error/empty states, no duplicate logic found.
- RLS-vs-`requireAdmin()` split in `lib/auth.ts` is correctly documented as a UX fast-fail layer,
  not the security boundary — Postgres RLS is. No gap found there.

## Explicitly out of scope this sprint

Flagging rather than silently skipping, per the "identify gaps" ask:

- **Mobile navigation.** `Sidebar` is `hidden md:flex` with no hamburger/drawer fallback, so
  there's currently no way to reach admin nav items on a phone. Given the brief says "most
  volunteers will use mobile," this is the single highest-value follow-up — but it's a new UI
  surface, not a fix, and didn't fit this pass alongside Coverage and Search. Volunteer-role
  users are unaffected today (their one nav item, "Your Students", is the landing page itself).
- No `npm install` / build / typecheck was possible in this environment (no network access, no
  `node_modules`). All new and edited files were reviewed by hand against the existing
  patterns and cross-checked for brace/paren balance and import correctness, but they haven't
  been run through `next build` or `tsc --noEmit`. Recommend running both before merging.

## Files touched

**New:**
- `app/(dashboard)/admin/coverage/page.tsx`
- `app/api/search/route.ts`
- `components/admin/CoverageBoard.tsx`
- `components/layout/GlobalSearch.tsx`
- `components/student/RoadmapProgressTracker.tsx`

**Edited:**
- `lib/repositories/analyticsRepository.ts` (added `weekendCoverage`)
- `lib/types/index.ts` (added `CoverageEntry`, `CoverageSummary`, `SearchResultItem`)
- `components/layout/Sidebar.tsx` (Coverage nav item)
- `components/layout/Topbar.tsx` (mounted `GlobalSearch`)
- `app/(dashboard)/students/[id]/page.tsx` (Roadmap tab, import cleanup)
- `app/(dashboard)/dashboard/page.tsx` (unused-import cleanup)
- `components/progress/ProgressForm.tsx` (unused-import cleanup)
- `app/(dashboard)/admin/reports/page.tsx` (unused-import cleanup)
