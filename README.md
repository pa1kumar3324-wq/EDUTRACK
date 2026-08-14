# EduTrack

**Volunteer Learning Management System for NGO tutoring programs — continuity tracking across rotating volunteers.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20App-blue?style=for-the-badge&logo=vercel)](https://edutrack-six-omega.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

[🔗 **Live app:** https://edutrack-six-omega.vercel.app](https://edutrack-six-omega.vercel.app)

---

## The Problem

In volunteer-driven tutoring programs for underprivileged children, the same student is taught by different volunteers each week. Without centralized continuity tracking, every session starts cold: the volunteer has no idea what was covered last time, where the student struggled, or what should come next. Lessons repeat, gaps go unnoticed, and momentum is lost. EduTrack solves this — every volunteer immediately sees the full teaching history, automatically receives the next recommended lesson based on progress, and can override that recommendation when a child needs a different pace.

---

## Key Features

**Core continuity engine:**
- 📖 **Automatic lesson recommendations** — given a student's roadmap and session history, the app recommends either revising the previous topic (if marked ❌ or ⚠️) or advancing to the next one.
- 🎯 **Leader-assignable roadmap starting point** — admins can set a student's starting baseline per subject, allowing fine-grained control over pacing without breaking the automatic progression engine.
- 📝 **Session logging** — volunteers update progress in two subjects (English & Math) with status (Independent / Needs Help / Not Understood), homework, and notes. Every entry is append-only and timestamped.

**Volunteer & admin dashboards:**
- 🏠 **Volunteer home** — displays only your assigned students, with immediate next-lesson suggestions and revision flags (no noisy search).
- 📊 **Admin analytics** — program-wide stats: total students/volunteers, weekly activity trends, proficiency level distribution per subject, weak topics across the cohort, volunteer engagement, and students needing revision.
- 📋 **Student profiles** — detailed view of one student's journey: full progress timeline, visual learning progression charts, weak topics, and assigned volunteers (read-only context for all volunteers, edit access for admins and assigned teachers).

**Role-based authorization:**
- 👤 **Volunteers** — view all students and roadmaps for context; log progress only for assigned students.
- 🔐 **Admins** — full CRUD on students, volunteers, assignments, roadmap, and attendance; export reports.
- Enforced at the database layer via Supabase RLS policies (not just UI guards).

**Reporting & export:**
- 📥 **Multi-format exports** — CSV, Excel, or PDF for students list, progress history, and attendance registers.
- 📅 **Attendance register** — admin-marked volunteer attendance (Present / Late / Absent / Excused), intelligently exported: only dates with at least one record appear as columns, so missing cells mean "no session that day" rather than creating a sparse, confusing calendar grid.
- 📈 **Weekly/monthly dashboards** — activity heatmaps, level distribution, weak topic rankings, recent session logs.

**Volunteer coordination:**
- ✉️ **Invite flow** — admins send email invites to new volunteers; clicking the link triggers a password setup flow (powered by Supabase Auth).
- 👁️ **Attendance tracking** — volunteers see their own attendance history as a donut chart; admins manage attendance from a dedicated admin panel.

**Intelligent suggestions (optional AI integration):**
- 💡 **Next-lesson suggestions** — after logging progress, volunteers receive a concrete, actionable text suggestion for the next session (e.g., "Spend 15 minutes revising fractions before introducing decimals"). Powered by Anthropic's Claude API if configured, otherwise falls back to rule-based heuristics—no external dependencies required.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 15.5 (App Router, Server Components, Server Actions) |
| **Language** | TypeScript 5.6 |
| **Styling** | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| **Database & Auth** | Supabase (PostgreSQL + Row Level Security + Supabase Auth) |
| **UI Components** | Radix UI, Lucide icons, Framer Motion (animations) |
| **Forms** | React Hook Form + Zod (validation) |
| **Charts** | Recharts |
| **Data Export** | PapaParse (CSV), XLSX (Excel), jsPDF + jsPDF-autotable (PDF) |
| **Client State** | Zustand |
| **Data Fetching** | Server Components, API Routes, Supabase browser/server clients |
| **Hosting** | Vercel |

---

## Architecture Highlights

**Repository pattern for data access**  
Every Supabase query lives in `lib/repositories/*` — one file per table. Pages and API routes never call `supabase.from("table")` directly; they go through `studentRepository.list()`, `progressRepository.listForStudent()`, etc. This centralizes query logic, makes testing and refactoring simpler, and keeps components thin. It's particularly valuable here because the continuity engine reads across multiple tables and views (`progress`, `latest_progress`, `students_needing_revision`) — centralizing that logic means the recommendation engine and UI always use the same snapshot.

**Database-layer authorization (Supabase RLS)**  
Authorization is not enforced only at the API/UI layer. Instead, every `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the core tables (`students`, `progress`, `assignments`, `learning_roadmap`, `attendance`) is guarded by Supabase RLS policies keyed off `auth.uid()` and a user role check. Volunteers can only insert progress for students assigned to them; admins bypass restrictions entirely. The database is the source of truth; the API layer is a fast-fail UX layer. This means the database alone is secure even if the application layer has gaps.

**Roadmap recommendation engine with leader-controlled baselines**  
`lib/utils/roadmapEngine.ts` implements the core decision logic: given a student's curriculum (ordered by grade/subject), their progress history, and an optional leader-set baseline, it recommends the next lesson. The tricky part is reconciling baselines with automatic progression: if a baseline is set, the student starts there, but as soon as they log progress, the engine advances them forward based on what they actually learned — the baseline is a _starting point_, not a pin. This required careful handling in the resolver function, which distinguishes between "baseline" (leader-set, not yet surpassed) and "automatic" (computed from history) positions. The app renders these differently so teachers understand which source drove the recommendation.

**Intelligent attendance export (sparse calendar logic)**  
Volunteer attendance is critical for reporting, but the naive export approach — create a column for every calendar day in a date range — produces a 90% blank grid. Instead, `app/api/export/route.ts` queries which dates actually have at least one attendance record, and only creates columns for those dates. A missing cell means "no session that day" (the default), not "absent." This keeps exports human-readable and prevents misleading gaps.

---

## Project Structure

```
app/                          Next.js App Router
├── (auth)/
│   └── login/                Public login & set-password routes
├── (dashboard)/              Auth-gated layout (sidebar + topbar)
│   ├── dashboard/            Volunteer home ("Your Students")
│   ├── students/[id]/        Student profile, charts, progress history
│   ├── students/[id]/update/ Progress update form
│   └── admin/                Admin panel (analytics, students, volunteers, attendance, roadmap, reports)
└── api/                       Route handlers (auth callback, export, suggestions, CRUD endpoints)

components/                    Reusable React components
├── ui/                        shadcn/ui primitives (button, card, dialog, table, etc.)
├── layout/                    Sidebar, Topbar, ThemeProvider
├── dashboard/                 StatCard, StudentCard, RecentActivity, AttendancePieChart
├── student/                   ProgressTimeline, RoadmapProgressTracker, RoadmapPositionControl
├── admin/                     VolunteersTable, StudentsTable, RoadmapBuilder, AnalyticsCharts, ExportPanel
├── charts/                    StudentJourneyChart (Recharts)
├── progress/                  ProgressForm component
└── shared/                    StatusBadge, LevelBadge, PageHeader, EmptyState, skeletons

lib/                          Business logic, utilities, data access
├── repositories/              Data layer (studentRepository, progressRepository, etc.)
├── supabase/                  Supabase client setup (browser, server, middleware)
├── utils/                     roadmapEngine.ts (recommendation logic), suggestionEngine.ts (AI suggestions)
├── types/                     TypeScript types (database rows, view models)
├── validations/               Zod schemas (shared by forms and API validation)
├── auth.ts                    requireUser(), requireAdmin() server-side guards
└── navigation.ts              Role-based nav structure

supabase/                      Database schema & migrations
├── schema.sql                 Full schema: tables, enums, views, RLS policies, triggers
├── migrations/                Incremental schema updates (e.g., 001_attendance.sql)
└── seed_roadmap.sql           Optional seed data for roadmap alone

scripts/
└── seed.ts                    Populates sample volunteers, students, roadmap, and progress history

store/                         Client state management
└── useAppStore.ts             Zustand store for lightweight UI state

middleware.ts                  Supabase session refresh middleware
```

---

## Getting Started (Local Development)

### Prerequisites
- **Node.js 18.18+** and npm
- A free [Supabase](https://supabase.com) project

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a new Supabase project.
2. Open the **SQL Editor** and run `supabase/schema.sql` once. This creates all tables, enums, views, RLS policies, and triggers — including the attendance feature.
   - **Upgrading an existing project?** Don't re-run `schema.sql` (it isn't idempotent). Instead run `supabase/migrations/001_attendance.sql` once — it only adds new attendance tables and policies.
3. From **Project Settings → API**, copy your **Project URL**, **Anon Key**, and **Service Role Key**.

### 3. Configure environment variables
```bash
cp .env.example .env.local
```

Fill in the variables from your Supabase project:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # Server-side only; never expose to client

# Canonical public URL of this deployment.
# Local dev defaults to http://localhost:3000 if left unset.
# Required in production (Vercel) for invite email links.
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: enable AI-powered lesson suggestions via the Anthropic API
ANTHROPIC_API_KEY=
```

⚠️ **`SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser** — it's only used server-side in `scripts/seed.ts` and the `/api/volunteers` invite route.

### 4. Seed sample data (optional, recommended)
```bash
npm run seed
```

Creates 10 volunteers (1 admin, real Supabase Auth accounts), 25 students, full Grade 1–10 English/Math roadmap, and realistic progress history. All seeded accounts use password `EduTrack123!`; admin is `admin@edutrack.dev`.

### 5. Run the dev server
```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

### 6. Type-check and lint (optional)
```bash
npm run typecheck
npm run lint
npm run format
```

---

## Deployment (Vercel)

1. Push this repository to GitHub.
2. In Vercel, **Import Project** and connect the repo.
3. Add environment variables in **Project Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `ANTHROPIC_API_KEY`.
   - **`NEXT_PUBLIC_SITE_URL` (required for Production)** — set to your production URL, e.g., `https://edutrack.vercel.app`. This ensures invite email links point to the correct domain.
4. In Supabase, configure **Authentication → URL Configuration**:
   - **Site URL**: same as `NEXT_PUBLIC_SITE_URL`
   - **Redirect URLs**: add `https://edutrack.vercel.app/api/auth/callback`
5. Deploy. Vercel runs `next build` automatically.
6. Run `supabase/schema.sql` against your production Supabase project (safe to run once per project).

### Post-deploy checklist
- [ ] Verify the `latest_progress` and `students_needing_revision` views exist (run in Supabase SQL Editor: `select * from latest_progress limit 1;`)
- [ ] Invite your first admin volunteer, or seed with `npm run seed` against production (on a fresh project only)
- [ ] Confirm RLS is enabled on all tables under **Authentication → Policies**
- [ ] Set up Supabase backups (Pro tier: automatic; Free tier: manual export)

---

## Volunteer Invites & Onboarding

1. **Admin invites a volunteer** from **Admin → Volunteers → Invite Volunteer**. The app calls `supabase.auth.admin.inviteUserByEmail()`.
2. **Volunteer receives an email** with a link containing `?token_hash=...&type=invite`.
3. **Clicking the link** verifies the invite with Supabase (`supabase.auth.verifyOtp()`) and signs the browser in.
4. **Redirects to `/set-password`**, where the volunteer chooses a password (stored in Supabase Auth, not the app's database).
5. **Redirects to dashboard** — from then on, they sign in normally via `/login`.

A database trigger automatically creates the volunteer's profile row in `volunteers` on signup.

---

## Volunteer Attendance

- **Marking attendance** (admin): **Admin → Attendance** — pick a session date and mark each volunteer Present / Late / Absent / Excused.
- **Viewing attendance** (volunteer): volunteers see their own P/L/A/E breakdown as a donut chart on their dashboard.
- **Exporting attendance** (admin): **Admin → Reports & Alerts** — export CSV, Excel, or PDF for a date range. The register intelligently includes only dates with at least one record (sparse calendar logic).

Enforced via Supabase RLS policies and `requireAdmin()` guards.

---

## Roles & Permissions

| Action | Volunteer | Admin |
|--------|-----------|-------|
| View assigned students | ✅ | ✅ (all students) |
| View student full history | ✅ (read-only) | ✅ |
| Log a progress update | ✅ (assigned only) | ✅ (any student) |
| Manage students (add/edit/remove) | ❌ | ✅ |
| Assign volunteers to students | ❌ | ✅ |
| Manage learning roadmap | ❌ | ✅ |
| View analytics & export reports | ❌ | ✅ |
| Invite volunteers / manage roles | ❌ | ✅ |
| Mark volunteer attendance | ❌ | ✅ |
| View own attendance | ✅ (read-only) | ✅ (all volunteers) |

---

## AI-Powered Lesson Suggestions (Optional)

After every progress submission, `lib/utils/suggestionEngine.ts` generates an actionable text suggestion for the next session:

- **With `ANTHROPIC_API_KEY` set**: calls Claude to generate a tailored suggestion based on what was taught, how it went, and the next roadmap topic.
- **Without it**: falls back to a deterministic, rule-based suggestion — so the feature works out of the box with zero external dependencies.

This keeps the feature composable: the app never _requires_ an API key; it gracefully degrades.

---

## Development

### Commands
- `npm run dev` — Start Next.js dev server (http://localhost:3000)
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm run format` — Format code with Prettier
- `npm run typecheck` — Type-check without emitting
- `npm run seed` — Seed sample data

### Key files to understand
- **`supabase/schema.sql`** — Database schema, RLS policies, views, and triggers. The source of truth for authorization and continuity logic.
- **`lib/repositories/*`** — All data access (SELECT/INSERT/UPDATE/DELETE). One file per table.
- **`lib/utils/roadmapEngine.ts`** — Core recommendation engine.
- **`app/(dashboard)/students/[id]/page.tsx`** — Student profile; shows how recommendation and baseline logic comes together in the UI.
- **`app/api/export/route.ts`** — Export logic; interesting for sparse calendar handling and role-based filtering.

---

<!-- TODO: add a dashboard screenshot or short walkthrough GIF here -->

---

## Contributing

This is a live project serving real volunteer tutoring programs. Before opening an issue or PR:
1. Test against the deployed app at https://edutrack-six-omega.vercel.app if possible.
2. Reference the schema and repository files when proposing data layer changes.
3. Ensure RLS policies remain the source of truth for authorization.

---

## Acknowledgments

Built for volunteer-driven NGO tutoring programs where continuity and teacher coordination make the difference in student outcomes.

---

**Questions?** Open an issue or reach out via GitHub.
