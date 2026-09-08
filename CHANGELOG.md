# Sprint Changelog

Scope note up front: the previous CHANGELOG entry in this file described a sprint that, on
inspection, hadn't actually happened — `next build` failed outright, several claimed files and
features (`GlobalSearch` mounted in the Topbar, `RoadmapProgressTracker`, the coverage page)
didn't exist or weren't wired up, and at least one "fix" (an ambiguous PostgREST embed) turned
out to already be handled correctly everywhere it mattered. This entry replaces that one and
describes only what was actually built and verified in this session — every item below was run
through `npm run typecheck`, `npm run lint`, and a full `npm run build` at least once after being
written, and the build was actually executed, not assumed to pass.

## Fixed — build & security (do this first)

- **`next build` was failing.** Root cause: `next/font/google` (Inter, Lexend) fetches font
  files from `fonts.googleapis.com`/`fonts.gstatic.com` at build time, which isn't reachable in
  network-restricted CI/sandbox environments. Replaced with self-hosted fonts via
  `@fontsource/fraunces` (display) and `@fontsource/plus-jakarta-sans` (body) — the build no
  longer has an external network dependency at all, on top of shaving a render-blocking request
  off every real page load.
- **Live Supabase credentials were present in `.env` in the delivered project.** `.env` is
  correctly `.gitignore`'d, but the file itself still had a real project URL and anon/service-role
  keys in it. **Rotate both keys in the Supabase dashboard regardless of how this ships** — this
  can't be fixed from inside the repo.
- **`npm audit`**: bumped `@faker-js/faker` (dev-only) and `jspdf`/`jspdf-autotable` (resolves a
  `dompurify` XSS advisory in the PDF-export chain). The `jspdf-autotable` v5 API changed from a
  `doc.autoTable(...)` prototype method to a standalone `autoTable(doc, options)` function —
  updated `ExportPanel.tsx` accordingly and smoke-tested PDF generation in Node to confirm the
  export still produces a valid file. `postcss`/`sharp` need a Next.js major-version bump to
  fully resolve and were left alone, since that's a bigger, separate migration. `xlsx`: SheetJS's
  current guidance is to install from their own CDN rather than the stale npm registry package;
  that install is blocked by this environment's network allowlist, so it's left as an accepted
  risk (the only route using it is server-side, admin-gated, and writes app-generated data rather
  than parsing untrusted input) — run `npm install xlsx@https://cdn.sheetjs.com/xlsx-<latest>/xlsx-<latest>.tgz`
  (check https://docs.sheetjs.com for the current version) somewhere with outbound network access,
  then re-run `npm audit`.
- Aligned `eslint-config-next` to the same version line as `next`.
- The hardcoded Gemini model ID (`gemini-3.6-flash`) was stale; updated to `gemini-3.8-flash`
  (current GA stable Flash model, verified via a live search rather than assumed from memory) with
  a comment on where to check next time it needs updating.

## Added

- **Weekend Coverage dashboard** (`/admin/coverage`) — answers "which students got a progress
  update this weekend?" A donut-style coverage %, updated/missing counts, and two lists (who was
  covered, who wasn't), with prev/next weekend navigation via a `?weekend=YYYY-MM-DD` query param.
  Backed by a new `analyticsRepository.weekendCoverage()` method and a `WeekendCoverage` type.
  Added to the admin nav automatically (it reads from `lib/navigation.ts`, which both `Sidebar`
  and `MobileNav` already consume).
- **Global search mounted.** `GlobalSearch.tsx` and `/api/search` already existed in the codebase
  and were well-built — role-aware (volunteers only ever see their own assigned students), 
  debounced, keyboard-navigable — but nothing rendered the component anywhere. It's now mounted in
  `Topbar`, which is always present regardless of screen size, so ⌘K/Ctrl+K and the search box
  work from every page, including on mobile.
- **Themed confirm dialogs.** Added a Radix-based `AlertDialog` primitive
  (`components/ui/alert-dialog.tsx`) and a reusable `ConfirmDialog` wrapper with a proper pending
  state on the confirm button. Replaced all three native `confirm()` calls
  (`StudentsTable`, `VolunteersTable`, `RoadmapBuilder`) — those don't render inside an iframe/
  embedded context reliably and don't match the rest of the UI.
- **Mobile card layouts** for `StudentsTable` and `VolunteersTable` — a stacked card list below
  `md:`, the full table above it, rather than a table that requires horizontal scrolling on a
  phone.
- **Drag-and-drop roadmap reordering.** `RoadmapBuilder` now uses `framer-motion`'s
  `Reorder.Group`/`Reorder.Item` with a drag handle; reordering updates locally first, then PATCHes
  only the entries whose `order_index` actually changed.
- **Tactile pickers replacing plain dropdowns** for two of the highest-traffic choices in the app:
  `LevelPicker` (segmented control with a sliding highlight, via `framer-motion`'s `layoutId`) for
  English/Math level in `StudentFormDialog`, and `StatusPicker` (three-way tactile buttons) for
  the 🟢/🟡/🔴 "how did the lesson land" choice in `ProgressForm` — this drives the
  needs-revision flag and the suggested-next-lesson engine, so it's worth more than a dropdown.
- **Route-level resilience**, all previously missing: `app/loading.tsx` and
  `app/(dashboard)/loading.tsx` (a skeleton matching the real layout, not a blank flash),
  `app/error.tsx` (styled, with a "try again"/"back to dashboard" recovery path),
  `app/global-error.tsx` (deliberately dependency-free — no theme provider, no custom fonts — in
  case whatever broke the root layout is one of those), and `app/not-found.tsx`.
- **Favicon and PWA basics**: `app/icon.tsx` / `app/apple-icon.tsx`, generated at build time via
  `next/og` (no external asset fetch needed), plus `public/manifest.json`.
- **Visual design system refresh**: full 50–900 color scales for two new anchor hues (forest
  green / terracotta-clay) replacing the generic indigo-on-white palette, a genuinely distinct
  dark mode (not an inverted light mode), self-hosted Fraunces + Plus Jakarta Sans typography,
  new radii/shadow/animation tokens. Applied so far to: stat cards (now animated count-up via a
  shared `AnimatedNumber` component, with a small hover lift), the two picker components above,
  the coverage board, and globally via CSS variables everywhere else (cards, buttons, badges,
  charts, etc. all pick up the new palette automatically since they're token-driven).

## Explicitly out of scope this pass — flagging rather than silently skipping

- **Full bespoke visual redesign of every screen.** The design tokens (color, type, radius,
  shadow, motion) are in place globally, and the highest-traffic interactive surfaces (progress
  form, students/volunteers tables, roadmap builder, stat cards) got hands-on redesign work. The
  student profile page, the admin analytics charts' internal styling, and the auth pages inherit
  the new tokens automatically and look coherent, but haven't had an individual bespoke pass —
  worth a follow-up if more distinctive visual moments are wanted there specifically.
- `postcss`/`sharp` audit findings — need a Next.js major-version bump; bundling that with this
  pass risked destabilizing a build that was previously broken for an unrelated reason.
- `xlsx` — see the accepted-risk note above; needs a network-unrestricted environment to fix
  properly.

## Reviewed, found already correct (no change needed)

- **The "ambiguous PostgREST embed" bug described in the previous, aspirational changelog
  entry.** `assignments` genuinely does have two foreign keys into `volunteers`
  (`volunteer_id` and `assigned_by`), but every existing query already disambiguates correctly
  with `volunteers!assignments_volunteer_id_fkey(...)`. No fix was needed; the earlier claim
  didn't hold up under inspection.
- **"No mobile nav fallback."** Also claimed by the previous entry, also not true —
  `components/layout/MobileNav.tsx` already exists and is rendered from `Topbar` on every screen
  size.

## Files touched

**New:**
- `app/(dashboard)/admin/coverage/page.tsx`, `app/(dashboard)/loading.tsx`
- `app/loading.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`
- `app/icon.tsx`, `app/apple-icon.tsx`, `public/manifest.json`
- `components/admin/CoverageBoard.tsx`
- `components/shared/AnimatedNumber.tsx`, `ConfirmDialog.tsx`, `LevelPicker.tsx`, `StatusPicker.tsx`
- `components/ui/alert-dialog.tsx`

**Edited:**
- `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts` — fonts, color system, tokens
- `lib/repositories/analyticsRepository.ts` (added `weekendCoverage`)
- `lib/types/index.ts` (added `WeekendCoverage`, `WeekendCoverageStudent`)
- `lib/navigation.ts` (Coverage nav item)
- `lib/utils/suggestionEngine.ts` (Gemini model ID)
- `components/layout/Topbar.tsx` (mounted `GlobalSearch`)
- `components/admin/StudentsTable.tsx`, `VolunteersTable.tsx`, `RoadmapBuilder.tsx` (confirm
  dialogs, mobile card layouts, drag-and-drop)
- `components/admin/StudentFormDialog.tsx` (`LevelPicker`)
- `components/progress/ProgressForm.tsx` (`StatusPicker`)
- `components/dashboard/StatCard.tsx` (animated count-up)
- `components/admin/ExportPanel.tsx` (jspdf-autotable v5 API)
- `package.json` (dependency bumps: `@fontsource/*`, `@radix-ui/react-alert-dialog`, `jspdf`,
  `jspdf-autotable`, `@faker-js/faker`, `eslint-config-next`)
