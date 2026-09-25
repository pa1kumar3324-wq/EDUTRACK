# EduTrack

A Volunteer Learning Management System (VLMS) built for NGOs that teach underprivileged children, where different volunteers teach the same child on different weekends.

**The problem it solves:** continuity. Every volunteer opens EduTrack and immediately sees what a child learned last time, what's recommended next, and what needs revision — without tracking down the previous volunteer.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components + Server Actions/API Routes) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Animation | Framer Motion |
| Database & Auth | Supabase (PostgreSQL + Row Level Security + Supabase Auth) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| State | Zustand (client UI state), Server Components for data |
| Notifications | Sonner (toasts) |
| Export | papaparse (CSV), exceljs (Excel), jspdf-autotable (PDF) |
| AI assistant | Tsareena — client-side, bring-your-own-key Gemini integration (`@google/genai`) |
| Hosting | Vercel |

---

## Architecture

```
app/
  (auth)/login/, forgot-password/, set-password/    Public + invite-flow auth pages
  (dashboard)/             Everything behind auth, wrapped by a Sidebar + Topbar shell
    dashboard/              Volunteer home — "Your Students" cards
    students/[id]/          Student profile: progress bar, timeline, journey charts, weak areas,
                             homework, effort summary
    students/[id]/update/   Progress update form
    admin/                  Admin-only: students, volunteers, learning circles, verification,
                             attendance, roadmap, coverage, reports
    effort-leaderboard/     Effort Leaderboard — open to volunteers and admins alike
  api/                      Route handlers — students, volunteers, assignments, progress,
                             roadmap, attendance, learning-circles, debriefs, search, export,
                             effort-leaderboard, profile, auth callback
  loading.tsx, error.tsx, global-error.tsx, not-found.tsx   Route-level loading/error boundaries
  icon.tsx, apple-icon.tsx  Favicon generated at build time via next/og
components/
  ui/                       shadcn/ui primitives (button, card, dialog, alert-dialog, table, tabs, ...)
  shared/                   Cross-cutting UI: StatusBadge, LevelBadge, EmptyState, PageHeader,
                             AnimatedNumber, ConfirmDialog, LevelPicker, StatusPicker,
                             EffortLeaderboardPanel, skeletons
  layout/                   Sidebar, Topbar (incl. GlobalSearch), MobileNav, ThemeProvider
  dashboard/                StatCard, StudentCard, RecentActivity, AttendancePieChart
  student/                  StudentProfileTabs, ProgressTimeline, JourneyChart
  admin/                    StudentsTable, VolunteersTable, RoadmapBuilder, AnalyticsCharts,
                             ExportPanel, AttendanceMarker, CoverageBoard, EditProgressDialog,
                             Learning Circle management + verification queue
  progress/                 ProgressForm (the "Update Progress" form), ScaleSelect chip fields,
                             EffortScorePicker (1-10 effort rating)
  ai/                       Tsareena — the client-side AI assistant (see below)
lib/
  supabase/                 Browser client, server client, session-refresh helper
  repositories/             One file per table — all data access goes through these (repository
                             pattern), incl. effortRepository (leaderboard aggregation)
  validations/              Zod schemas shared by forms and API routes
  utils/                    roadmapEngine.ts (next-lesson recommendation), suggestionEngine.ts
                             (deterministic suggestion text)
  types/                    Database row types + derived view-model types
  auth.ts                   requireUser() / requireAdmin() server-side guards
  rateLimit.ts              In-memory, IP+route-keyed rate limiter
hooks/                      useStudents, useProgress, useDebounce, useMediaQuery
store/                      Zustand stores for lightweight client UI state
proxy.ts                    Session-refresh middleware (Next.js 16's renamed middleware.ts)
supabase/
  schema.sql                Canonical schema for fresh installs: tables, enums, views, RLS
                             policies, triggers — always up to date with every migration below
  migrations/                Incremental migrations, for upgrading an existing project:
                              001 attendance · 002 roadmap starting positions · 003 progress
                              roadmap topic IDs · 004 structured session observations · 005
                              volunteer privilege-escalation guard · 006 volunteer profile
                              fields · 007 volunteers SELECT scope fix · 008 Learning Circles
                              & debrief verification · 009 progress edit trail · 010 volunteer
                              deactivation & purge enforcement · 011 Weekly Effort Score +
                              leaderboard
  tests/                    Manual RLS verification scripts — run in the Supabase SQL editor
                             against a real project before relying on a security-sensitive change
  seed_roadmap.sql          Optional standalone roadmap seed (SQL-only alternative to scripts/seed.ts)
scripts/
  seed.ts                    Seeds 10 volunteers (real Supabase Auth users), 25 students, assignments,
                              a full roadmap, and progress history
```

**Why a repository pattern?** Every Supabase query lives in `lib/repositories/*`. Pages and API routes call `studentRepository.list(...)`, never `supabase.from("students")` directly. This keeps query logic in one place, makes it easy to swap the data layer later, and keeps components thin.

**Where the "continuity" logic lives:**
- `supabase/schema.sql` — the `students_needing_revision` view flags a student if their last two logged statuses in a subject were both 🔴, or if there's been no update in 14+ days. The `latest_progress` view resolves each student's most recent session in one query.
- `lib/utils/roadmapEngine.ts` — given a student's roadmap and history, decides whether to recommend revising the last topic (if it went badly) or the next topic in sequence.
- `lib/utils/suggestionEngine.ts` — turns that into the human-readable "Suggested Next Lesson" text. Fully deterministic, zero network dependency — there is no server-side AI call anywhere in this path anymore (see the Tsareena section below for where AI moved to).

---

## Getting started (local development)

### 1. Prerequisites
- Node.js 18.18+ and npm
- A free [Supabase](https://supabase.com) project

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Supabase
1. Create a new Supabase project.
2. Open the SQL Editor and run `supabase/schema.sql` once. This creates all tables, enums, views, RLS policies, and triggers, fully up to date with every migration below — so fresh installs get every feature automatically.
   - **Upgrading an existing project?** Don't re-run `schema.sql` (it isn't idempotent). Instead run each new file under `supabase/migrations/` once, in order, against your project's current state — see the Architecture section above for what each one adds.
3. From **Project Settings → API**, copy your Project URL, anon key, and service role key.

### 4. Configure environment variables
```bash
cp .env.example .env.local
```
Fill in:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # only used server-side, by scripts/seed.ts and the invite API route
NEXT_PUBLIC_SITE_URL=http://localhost:3000         # canonical URL of this deployment — see below
```
`SUPABASE_SERVICE_ROLE_KEY` must **never** be exposed to the client — it's only read in `scripts/seed.ts` and in the `/api/volunteers` invite route, both of which run server-side.

`NEXT_PUBLIC_SITE_URL` is the app's canonical public URL. The volunteer-invite email link is built from this — **not** from the incoming request's host — so it always points at the real app instead of whatever host a particular request happened to arrive on. Locally it defaults to `http://localhost:3000` if left unset; **in production (Vercel) it is required** — see the Deployment section below.

### 5. Seed sample data (optional but recommended)
```bash
npm run seed -- --confirm-seed
```
This creates 10 volunteers (1 admin, real Supabase Auth accounts), 25 students, assignments, a full Grade 1–10 English/Math roadmap, and several weeks of realistic progress history — enough for every dashboard, chart, and empty state to look real immediately. It refuses to run without `--confirm-seed`, and refuses to run at all against a project that already has any volunteers in it — it's only meant for an empty scratch project.

All seeded accounts share one password, randomly generated fresh for that run and printed once at the end — save it from the script's output. The admin account is `admin@edutrack.dev`.

### 6. Run the dev server
```bash
npm run dev
```
Visit `http://localhost:3000` — you'll be redirected to `/login`.

### 7. Type-check and lint (optional, recommended before committing)
```bash
npm run typecheck
npm run lint
npm run format
```

---

## Adding volunteers after seeding

Admins invite volunteers from **Admin → Volunteers → Invite volunteer**. This calls Supabase Auth's `inviteUserByEmail`, which sends an invitation email. Clicking the link in that email:

1. Verifies the invite with Supabase and signs the browser in (handled by `app/api/auth/callback/route.ts` — see note below).
2. Redirects to `/set-password`, where the volunteer chooses their password (`supabase.auth.updateUser({ password })`). No password is ever stored in the app's own database.
3. Redirects to their dashboard. From then on they sign in normally via `/login` with `signInWithPassword`.

A database trigger (`handle_new_auth_user`) automatically creates their `volunteers` profile row on signup.

**Note on the callback route:** Supabase's invite emails authenticate via `?token_hash=...&type=invite` (verified with `supabase.auth.verifyOtp()`), which is a different contract from the `?code=...` PKCE flow used elsewhere. `app/api/auth/callback/route.ts` handles both shapes for exactly this reason — if it only handled `?code=`, invited volunteers would fall through to `/login` with no session and no password to enter. No extra Supabase Redirect URL configuration is needed for this — it's the same `/api/auth/callback` URL already listed below, just parsed correctly on arrival. If an invite link ever misbehaves, hover it in the received email and check the query string — it should look like `.../api/auth/callback?token_hash=...&type=invite&next=%2Fset-password`.

---

## Deployment (Vercel)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Import Project** and select the repo.
3. Add the environment variables from `.env.local` in **Project Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (never expose this last one as a `NEXT_PUBLIC_*` variable). There is no Gemini-related env var — Tsareena's Gemini key is entered per-volunteer in the browser, never configured server-side.
   - **`NEXT_PUBLIC_SITE_URL` — required for Production.** Set it to your production URL, e.g. `NEXT_PUBLIC_SITE_URL=https://edutrack.vercel.app`. Without this, `POST /api/volunteers` (inviting a volunteer) will return a clear `500` error rather than silently sending an invite email that points at localhost or an unintended host. If you also want to invite volunteers from Preview deployments, set it there too (pointed at whichever URL you want those invite links to use).
4. In Supabase, go to **Authentication → URL Configuration** and set:
   - **Site URL**: the same value as `NEXT_PUBLIC_SITE_URL` above (e.g. `https://edutrack.vercel.app`)
   - **Redirect URLs**: add `https://edutrack.vercel.app/api/auth/callback` (and the same for any other URL you set `NEXT_PUBLIC_SITE_URL` to, e.g. a Preview URL)
5. Deploy. Vercel will run `next build` automatically.
6. Run `supabase/schema.sql` against your production Supabase project if you haven't already (it's the same script — safe to run once per project).

### Post-deploy checklist
- [ ] Confirm `students_needing_revision` and `latest_progress` views exist (`select * from latest_progress limit 1;` in the SQL editor)
- [ ] Invite your first real admin from the Supabase dashboard, or seed with `npm run seed -- --confirm-seed` against production (only do this on a fresh project — it creates real auth users, and the script itself refuses to run against a project that already has volunteers)
- [ ] Verify RLS is enabled on every table (`schema.sql` does this, but double-check under **Authentication → Policies**)
- [ ] Set up Supabase's daily backups (Free tier: manual export; Pro tier: automatic)

---

## Roles & permissions

| Action | Volunteer | Admin |
|---|---|---|
| View own assigned students | ✅ | ✅ (all students) |
| View any student's full history | ✅ (read-only context) | ✅ |
| Log a progress update | ✅ (only for assigned students) | ✅ (any student) |
| Edit an already-logged debrief | ❌ | ✅ |
| Add / edit / remove students | ❌ | ✅ |
| Assign volunteers to students | ❌ | ✅ |
| Manage the learning roadmap | ❌ | ✅ |
| View analytics & export reports | ❌ | ✅ |
| Invite volunteers / change roles | ❌ | ✅ |
| Mark volunteer attendance | ❌ | ✅ |
| View own attendance history | ✅ (read-only) | ✅ (all volunteers) |
| Create/manage Learning Circles | ❌ | ✅ |
| Verify/reject a circle's debriefs | ✅, if the circle's lead | ✅, if the circle's lead |
| Rate a student's effort (1-10) when logging progress | ✅ (only for assigned students) | ✅ (any student) |
| View the Effort Leaderboard | ✅ | ✅ |
| Download the Effort Leaderboard | ❌ | ✅ |

A volunteer who isn't in a Learning Circle behaves exactly as the table above says. Being placed in
a circle adds exactly one restriction: their debriefs sit as `pending` until their circle's lead
admin verifies them (see below) — it doesn't change what they themselves can see or do.

## Volunteer attendance

Leaders (admins) mark attendance from **Admin → Attendance**: pick a session date, then tap Present / Late / Absent / Excused per volunteer, or use "Mark all present" for a quick pass. Each save is an upsert keyed on `(volunteer_id, session_date)`, so re-marking the same day just updates the existing record instead of creating duplicates.

Volunteers see their own present/late/absent/excused breakdown as a donut chart on their dashboard (`components/dashboard/AttendancePieChart.tsx`) — computed from `attendanceRepository.summaryForVolunteer`.

Admins can export the full attendance log (CSV, Excel, or PDF) from **Admin → Reports & Alerts**, alongside the existing students and progress exports.

This is enforced in two layers: Postgres Row Level Security policies (the source of truth — see `supabase/schema.sql`) and `requireAdmin()` guards in Server Components / API routes (a fast-fail UX layer, not a security boundary on its own).

---

## Learning Circles & debrief verification

A **Learning Circle** is a named group of volunteers led by one admin. It's opt-in: a volunteer who
isn't in a circle keeps the original zero-friction flow, where their debrief is recorded the
instant they submit it. Putting a volunteer in a circle means their debriefs are held as `pending`
until the circle's lead admin verifies (or rejects) them — only a **verified** debrief counts
toward `latest_progress`, the "needs revision" flag, roadmap continuity, reports, and exports.

- **Admin → People → Learning Circles**: create circles, assign a lead, manage rosters. A
  volunteer can only belong to one circle at a time.
- **Verification queue**: a lead sees their own circle's pending debriefs by default, with an
  "all circles" view for oversight. Verifying or rejecting a debrief is restricted, at the
  database level, to that circle's own lead — not just gated in the UI.
- On the student timeline, a pending debrief shows as a dimmed, hollow-node entry so the filing
  volunteer can see it exists without it reading as part of the settled record. A verified debrief
  from a non-circle volunteer shows no verification badge at all, so programs that never create a
  circle see no visual change.
- The distinction also splits how analytics are computed: "what do we believe about this student"
  metrics (weak topics, roadmap continuity) count verified debriefs only; "did the volunteer show
  up and write it up" metrics (dashboard stats, weekend coverage) count anything not rejected,
  pending included — a lead's review latency shouldn't count against the volunteer.

## Weekly Effort Score & leaderboard

Every progress submission asks the volunteer to rate the student's **effort** for that session —
participation, persistence, attention, willingness to try — on a simple 1-10 scale. It is
deliberately **not** a measure of English/Math correctness, intelligence, or academic ability; the
form says so directly next to the picker, and the score never touches roadmap position, levels, or
the "needs revision" flag.

- **Logging it**: `components/progress/EffortScorePicker.tsx` is a keyboard-accessible 1-10 chip
  row on the "Update Progress" form, required for every new submission. Historical sessions logged
  before this feature simply have `effort_score = NULL` — shown everywhere as "not yet rated,"
  never as a score of zero.
- **The leaderboard** (`/effort-leaderboard`, open to volunteers and admins alike — the same access
  `progress_select_all` already grants to a student's progress history): ranks students by average
  effort score, then by number of rated sessions, never by academic status. Switch between
  **All Students** and any one **Learning Circle**. A student needs at least one rated, *verified*
  session to appear at all — nobody shows up reading 0/10.
  - Because a Learning Circle in this app is a group of *volunteers* (not students — see below), a
    student's circle for leaderboard purposes is the circle that logged their most recently rated
    session. See the header comment in `supabase/migrations/011_effort_score.sql` for the full
    reasoning.
- **Student profile**: a small "⭐ Effort" line (average + number of rated sessions) sits below the
  existing English/Math progress cards — clearly secondary to, and never replacing, the academic
  progress view.
- **Export**: admins can download the leaderboard as CSV, Excel, or PDF (`Rank`, `Student Name`,
  `Learning Circle`, `Average Effort Score`, `Sessions Rated`) via the same `/api/export`
  infrastructure (papaparse / exceljs / jspdf-autotable) every other export already uses — no new
  library, and the export is scoped to whatever circle (or "All Students") is currently selected.
- **Performance**: the average/count per student is computed once, server-side, by three Postgres
  views (`student_effort_summary`, `student_effort_circle`, `student_effort_leaderboard`) rather
  than the app fetching every student's progress history and reducing it in JS.

## Weekend coverage & global search

- **Admin → Coverage** (`/admin/coverage`) answers "which students got a progress update this
  weekend?" — a coverage percentage, updated/missing student lists, and prev/next weekend
  navigation.
- **Global search** (⌘K / Ctrl+K, or the search box in the top bar) is role-aware: volunteers only
  ever see their own assigned students in results.

---

## Notes on the AI "Suggested Next Lesson" feature

After every progress submission, `lib/utils/suggestionEngine.ts` generates a one-line, deterministic, rule-based suggestion built from the roadmap engine's recommendation. It has no external dependency and no server-side AI call — it always works, for every volunteer, with zero setup.

## Notes on Tsareena (the AI assistant)

EduTrack also ships an optional, personality-driven assistant called **Tsareena** (`components/ai/*`). Unlike the old server-side suggestion engine, Tsareena is a **client-side, bring-your-own-key** assistant:
- Each volunteer optionally connects their own personal Gemini API key from inside the assistant's settings panel.
- That key lives only in the browser (React state, optionally `sessionStorage` for the current tab session) and is **never** sent to EduTrack's backend, stored in Supabase, or logged anywhere.
- Gemini requests go directly from the volunteer's browser to Google's API using `@google/genai` — EduTrack's server is never in that request path.
- The student's name, ID, Supabase UID, email, phone, or any other identifier is **never** included in any Gemini-bound request — see `components/ai/TsareenaContext.ts` for the allow-listed context builder and `components/ai/TsareenaPrompt.ts` for the system prompt that enforces this.
- Without a connected key, Tsareena still shows her personality (launcher, greeting, occasional comments) and clearly explains that her "advanced brain" needs a Gemini key — everything else in EduTrack works completely normally either way.

---

## License

Built for internal NGO use. Adapt freely.
