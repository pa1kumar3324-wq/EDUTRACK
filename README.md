# EduTrack

A Volunteer Learning Management System (VLMS) built for NGOs that teach underprivileged children, where different volunteers teach the same child on different weekends.

**The problem it solves:** continuity. Every volunteer opens EduTrack and immediately sees what a child learned last time, what's recommended next, and what needs revision — without tracking down the previous volunteer.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Components + Server Actions/API Routes) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| Animation | Framer Motion |
| Database & Auth | Supabase (PostgreSQL + Row Level Security + Supabase Auth) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| State | Zustand (client UI state), Server Components for data |
| Notifications | Sonner (toasts) |
| Export | papaparse (CSV), xlsx (Excel), jspdf-autotable (PDF) |
| Hosting | Vercel |

---

## Architecture

```
app/
  (auth)/login/            Public login page
  (dashboard)/             Everything behind auth, wrapped by a Sidebar + Topbar shell
    dashboard/              Volunteer home — "Your Students" cards, no search needed
    students/[id]/          Student profile: timeline, journey charts, weak areas, homework
    students/[id]/update/   Progress update form
    admin/                  Admin-only: overview analytics, students, volunteers, attendance, roadmap, reports
  api/                      Route handlers (students, volunteers, assignments, progress, roadmap, attendance, export, auth callback)
components/
  ui/                       shadcn/ui primitives (button, card, dialog, table, tabs, select, checkbox, ...)
  shared/                   Cross-cutting UI: StatusBadge, LevelBadge, EmptyState, PageHeader, skeletons
  layout/                   Sidebar, Topbar, ThemeProvider
  dashboard/                StatCard, StudentCard, RecentActivity, AttendancePieChart
  student/                  ProgressTimeline, JourneyChart
  admin/                    StudentsTable, VolunteersTable, RoadmapBuilder, AnalyticsCharts, ExportPanel, AttendanceMarker
  progress/                 ProgressForm (the "Update Progress" form)
lib/
  supabase/                 Browser client, server client, middleware session refresh
  repositories/             One file per table — all data access goes through these (repository pattern)
  validations/               Zod schemas shared by forms and API routes
  utils/                    roadmapEngine.ts (next-lesson recommendation), suggestionEngine.ts (AI suggestion)
  types/                    Database row types + derived view-model types
  auth.ts                   requireUser() / requireAdmin() server-side guards
hooks/                      useStudents, useProgress, useAnalytics, useDebounce
store/                      Zustand store for lightweight client UI state
supabase/
  schema.sql                 Full schema: tables, enums, views, RLS policies, triggers (incl. attendance)
  migrations/001_attendance.sql  Adds just the attendance table — for projects that already ran schema.sql
  seed_roadmap.sql           Optional standalone roadmap seed (SQL-only alternative to scripts/seed.ts)
scripts/
  seed.ts                    Seeds 10 volunteers (real Supabase Auth users), 25 students, assignments,
                              a full roadmap, and progress history
```

**Why a repository pattern?** Every Supabase query lives in `lib/repositories/*`. Pages and API routes call `studentRepository.list(...)`, never `supabase.from("students")` directly. This keeps query logic in one place, makes it easy to swap the data layer later, and keeps components thin.

**Where the "continuity" logic lives:**
- `supabase/schema.sql` — the `students_needing_revision` view flags a student if their last two logged statuses in a subject were both 🔴, or if there's been no update in 14+ days. The `latest_progress` view resolves each student's most recent session in one query.
- `lib/utils/roadmapEngine.ts` — given a student's roadmap and history, decides whether to recommend revising the last topic (if it went badly) or the next topic in sequence.
- `lib/utils/suggestionEngine.ts` — turns that into the human-readable "Suggested Next Lesson" text, optionally calling the Anthropic API for a richer, personalized suggestion if `ANTHROPIC_API_KEY` is set (falls back to a rule-based sentence if not).

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
2. Open the SQL Editor and run `supabase/schema.sql` once. This creates all tables, enums, views, RLS policies, and triggers — including `attendance`, so fresh installs get the attendance feature automatically.
   - **Upgrading an existing project?** Don't re-run `schema.sql` (it isn't idempotent). Instead run `supabase/migrations/001_attendance.sql` once — it only adds the new `attendance` table, index, trigger, and RLS policies.
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
ANTHROPIC_API_KEY=                                 # optional — enables richer AI-generated lesson suggestions
```
`SUPABASE_SERVICE_ROLE_KEY` must **never** be exposed to the client — it's only read in `scripts/seed.ts` and in the `/api/volunteers` invite route, both of which run server-side.

### 5. Seed sample data (optional but recommended)
```bash
npm run seed
```
This creates 10 volunteers (1 admin, real Supabase Auth accounts), 25 students, assignments, a full Grade 1–10 English/Math roadmap, and several weeks of realistic progress history — enough for every dashboard, chart, and empty state to look real immediately.

All seeded accounts share the password `EduTrack123!`. The admin account is `admin@edutrack.dev`.

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

Admins invite volunteers from **Admin → Volunteers → Invite volunteer**. This calls Supabase Auth's `inviteUserByEmail`, which sends a magic-link email; the volunteer sets their password on first login. A database trigger (`handle_new_auth_user`) automatically creates their `volunteers` profile row on signup.

---

## Deployment (Vercel)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Import Project** and select the repo.
3. Add the same environment variables from `.env.local` in **Project Settings → Environment Variables** (Production + Preview). Do **not** expose `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_*` variable.
4. In Supabase, go to **Authentication → URL Configuration** and set:
   - **Site URL**: your Vercel production URL (e.g. `https://edutrack.vercel.app`)
   - **Redirect URLs**: add `https://edutrack.vercel.app/api/auth/callback` (and the same for any preview URLs you use)
5. Deploy. Vercel will run `next build` automatically.
6. Run `supabase/schema.sql` against your production Supabase project if you haven't already (it's the same script — safe to run once per project).

### Post-deploy checklist
- [ ] Confirm `students_needing_revision` and `latest_progress` views exist (`select * from latest_progress limit 1;` in the SQL editor)
- [ ] Invite your first real admin from the Supabase dashboard, or seed with `npm run seed` against production (only do this on a fresh project — it creates real auth users)
- [ ] Verify RLS is enabled on all six tables (`schema.sql` does this, but double-check under **Authentication → Policies**)
- [ ] Set up Supabase's daily backups (Free tier: manual export; Pro tier: automatic)

---

## Roles & permissions

| Action | Volunteer | Admin |
|---|---|---|
| View own assigned students | ✅ | ✅ (all students) |
| View any student's full history | ✅ (read-only context) | ✅ |
| Log a progress update | ✅ (only for assigned students) | ✅ (any student) |
| Add / edit / remove students | ❌ | ✅ |
| Assign volunteers to students | ❌ | ✅ |
| Manage the learning roadmap | ❌ | ✅ |
| View analytics & export reports | ❌ | ✅ |
| Invite volunteers / change roles | ❌ | ✅ |
| Mark volunteer attendance | ❌ | ✅ |
| View own attendance history | ✅ (read-only) | ✅ (all volunteers) |

## Volunteer attendance

Leaders (admins) mark attendance from **Admin → Attendance**: pick a session date, then tap Present / Late / Absent / Excused per volunteer, or use "Mark all present" for a quick pass. Each save is an upsert keyed on `(volunteer_id, session_date)`, so re-marking the same day just updates the existing record instead of creating duplicates.

Volunteers see their own present/late/absent/excused breakdown as a donut chart on their dashboard (`components/dashboard/AttendancePieChart.tsx`) — computed from `attendanceRepository.summaryForVolunteer`.

Admins can export the full attendance log (CSV, Excel, or PDF) from **Admin → Reports & Alerts**, alongside the existing students and progress exports.

This is enforced in two layers: Postgres Row Level Security policies (the source of truth — see `supabase/schema.sql`) and `requireAdmin()` guards in Server Components / API routes (a fast-fail UX layer, not a security boundary on its own).

---

## Notes on the AI "Suggested Next Lesson" feature

After every progress submission, `lib/utils/suggestionEngine.ts` generates a one-line suggestion for the next volunteer. It works in two modes:
- **With `ANTHROPIC_API_KEY` set**: calls the Anthropic API for a suggestion tailored to what was taught, how it went, and the next roadmap topic.
- **Without it**: falls back to a deterministic, rule-based sentence built from the roadmap engine's recommendation — so the feature always works, even with zero external dependencies.

---

## License

Built for internal NGO use. Adapt freely.
