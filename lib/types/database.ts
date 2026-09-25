// ============================================================================
// Hand-authored types mirroring supabase/schema.sql.
// If you change the schema, run `supabase gen types typescript` and replace
// this file with the generated output for full drift-safety.
//
// NOTE: entity shapes below are declared with `type`, not `interface`.
// @supabase/postgrest-js constrains each table's `Row`/`Insert`/`Update` to
// `Record<string, unknown>`. TypeScript interfaces do not carry an implicit
// string index signature, so an `interface`-typed Row does not satisfy that
// constraint and silently collapses query results to `never` throughout the
// app (selects, inserts, updates, and any code that destructures the
// result). Type aliases with the same object shape do satisfy it. Keep these
// as `type` for that reason — don't switch back to `interface`.
// ============================================================================

export type UserRole = "admin" | "volunteer";
export type ProficiencyLevel = "beginner" | "developing" | "proficient" | "advanced";
export type UnderstandingStatus = "independent" | "needs_help" | "not_understood";
export type Subject = "english" | "math";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

/**
 * Lifecycle of a class debrief (a `progress` row).
 *
 * - `verified` — recorded. Counts toward `latest_progress`,
 *   `students_needing_revision`, and roadmap continuity. This is the
 *   DEFAULT: a volunteer who belongs to no Learning Circle, and every row
 *   written before migration 008, is verified on insert with no admin in
 *   the loop, exactly as before this feature existed.
 * - `pending` — filed by a Learning Circle member, awaiting that circle's
 *   lead admin. Visible on the student timeline (so the volunteer can see
 *   their own submission) but counted nowhere.
 * - `rejected` — sent back by the lead admin. Retained for audit; never
 *   counted.
 */
export type DebriefVerificationStatus = "pending" | "verified" | "rejected";

export type Volunteer = {
  id: string;
  /** Official/legal name — for formal records (attendance exports, admin). Prefer `preferred_name` (via displayName()) elsewhere. */
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  /** Everyday display identity. Falls back to `name` when null — see displayName() in lib/utils.ts. */
  preferred_name: string | null;
  /** For birthday functionality only — never derive/display age from this. */
  date_of_birth: string | null;
  bio: string | null;
  teaching_interests: string | null;
  fun_fact: string | null;
  created_at: string;
};

/**
 * The subset of a volunteer's fields that are safe to expose to any other
 * authenticated (non-admin) user. Deliberately excludes `phone` and
 * `date_of_birth` — migration 006 documents these as visible only to the
 * volunteer themself or an admin. `email`, `bio`, `teaching_interests`, and
 * `fun_fact` are intentionally team-visible per the volunteer profile
 * page's design. Use this projection instead of the full `Volunteer` row
 * anywhere a non-admin/non-self viewer can see the result.
 */
export type PublicVolunteer = Pick<
  Volunteer,
  | "id"
  | "name"
  | "preferred_name"
  | "email"
  | "avatar_url"
  | "role"
  | "is_active"
  | "bio"
  | "teaching_interests"
  | "fun_fact"
  | "created_at"
>;

export const PUBLIC_VOLUNTEER_COLUMNS =
  "id, name, preferred_name, email, avatar_url, role, is_active, bio, teaching_interests, fun_fact, created_at";

export type Student = {
  id: string;
  name: string;
  grade: number;
  english_level: ProficiencyLevel;
  math_level: ProficiencyLevel;
  photo_url: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Assignment = {
  id: string;
  student_id: string;
  volunteer_id: string;
  assigned_by: string | null;
  assigned_at: string;
};

export type LearningRoadmapEntry = {
  id: string;
  grade: number;
  subject: Subject;
  topic: string;
  description: string | null;
  order_index: number;
  created_at: string;
};

export type Progress = {
  id: string;
  student_id: string;
  volunteer_id: string;
  english_topic: string | null;
  english_status: UnderstandingStatus | null;
  /** learning_roadmap row this entry's english_topic was logged against, when known. Null for rows predating this column, or when no roadmap exists for the grade/subject. */
  english_roadmap_id: string | null;
  math_topic: string | null;
  math_status: UnderstandingStatus | null;
  /** learning_roadmap row this entry's math_topic was logged against, when known. Null for rows predating this column, or when no roadmap exists for the grade/subject. */
  math_roadmap_id: string | null;
  homework: string | null;
  notes: string | null;
  suggested_next_lesson: string | null;
  /**
   * Structured per-session observations (mood, participation, lesson
   * execution, teaching approach, outcome, session quality). Null for rows
   * predating supabase/migrations/004_session_observations.sql, and for any
   * row logged without filling in the structured section. See
   * lib/types/sessionObservations.ts for the shape; Postgres stores this as
   * a plain jsonb column and does not enforce the shape itself, so this
   * type plus the zod schema in lib/validations/sessionObservations.ts are
   * the only structural guarantees.
   */
  session_observations: import("./sessionObservations").SessionObservations | null;
  /**
   * Volunteer-given rating (1-10) of the student's EFFORT this session —
   * participation, persistence, willingness to try. NOT a measure of
   * English/Math correctness or academic ability. Null means "not rated",
   * never zero. See supabase/migrations/011_effort_score.sql and
   * lib/validations/progress.ts.
   */
  effort_score: number | null;
  session_date: string;
  /**
   * Whether this debrief has been recorded. Derived server-side by a
   * BEFORE INSERT trigger (see migration 008) — never accepted from the
   * client, and not part of the progress form's payload.
   */
  verification_status: DebriefVerificationStatus;
  /**
   * The Learning Circle that owned this debrief when it was filed, or null
   * if the author belonged to no circle. Snapshotted on insert and
   * immutable afterwards, so later membership changes never reassign an
   * in-flight debrief to a different verifier.
   */
  learning_circle_id: string | null;
  /** The lead admin who verified/rejected this. Null for auto-verified and pending rows. */
  verified_by: string | null;
  verified_at: string | null;
  /** Optional note the lead admin left when verifying or (more usefully) rejecting. */
  verification_notes: string | null;
  /**
   * Admin who last corrected this debrief's taught content (topic/status/
   * homework/notes), if any. Stamped server-side by trigger (migration
   * 009) — never client input. Null until the first edit.
   */
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
};

export type LatestProgress = Progress & {
  volunteer_name: string;
};

export type StudentNeedingRevision = {
  student_id: string;
  name: string;
  grade: number;
  last_activity: string;
  english_double_red: boolean;
  math_double_red: boolean;
  stale: boolean;
};

export type Attendance = {
  id: string;
  volunteer_id: string;
  session_date: string; // ISO date, e.g. "2026-08-08"
  status: AttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A leader-set STARTING BASELINE for a student's roadmap position, per
 * subject. It establishes where the student's roadmap begins — it is not a
 * permanent pin. Automatic recommendation (`recommendNextTopic`) still
 * drives the student forward from this point once progress is recorded; see
 * `resolveRoadmapPosition` in lib/utils/roadmapEngine.ts for the combined
 * resolution logic every roadmap consumer must use.
 * At most one row per (student_id, subject).
 */
export type StudentRoadmapPosition = {
  id: string;
  student_id: string;
  subject: Subject;
  roadmap_id: string;
  set_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentRoadmapPositionWithTopic = StudentRoadmapPosition & {
  learning_roadmap: LearningRoadmapEntry | null;
};

/**
 * A Learning Circle: a named group of existing volunteers led by one admin.
 * Debriefs filed by its members require that lead admin's verification
 * before they count. See supabase/migrations/008_learning_circles.sql.
 */
export type LearningCircle = {
  id: string;
  name: string;
  description: string | null;
  /** The only person who can verify this circle's debriefs. Always an active admin (DB-enforced). */
  lead_admin_id: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LearningCircleMember = {
  id: string;
  circle_id: string;
  volunteer_id: string;
  added_by: string | null;
  added_at: string;
};

/** A membership row joined to the volunteer it points at, for list UIs. */
export type LearningCircleMemberWithVolunteer = LearningCircleMember & {
  volunteers: PublicVolunteer | null;
};

/** A circle joined to its lead admin and its members — what the admin circles page renders. */
export type LearningCircleDetail = LearningCircle & {
  lead: PublicVolunteer | null;
  learning_circle_members: LearningCircleMemberWithVolunteer[];
};

/**
 * A pending debrief as shown in the verification queue: the progress row
 * plus the student it concerns, the volunteer who filed it, and its circle.
 */
export type PendingDebrief = Progress & {
  students: Pick<Student, "id" | "name" | "grade"> | null;
  volunteers: Pick<PublicVolunteer, "id" | "name" | "preferred_name" | "avatar_url"> | null;
  learning_circles: Pick<LearningCircle, "id" | "name" | "lead_admin_id"> | null;
};

/**
 * One row of the Weekly Effort Score leaderboard — mirrors either
 * `student_effort_leaderboard` (the "All Students" scope) or
 * `student_effort_leaderboard_by_circle` (a single Learning Circle's own
 * scope); see supabase/migrations/011_effort_score.sql. Both views share
 * this shape, but `average_effort_score`/`effort_score_count` mean
 * different things depending on which one produced the row: the student's
 * org-wide average (All Students) vs. their average from that ONE circle's
 * sessions only (a circle scope) — see effortRepository.leaderboard(). Only
 * students with at least one rated, verified session ever appear; a student
 * with zero rated sessions (in that scope) simply isn't in the result set.
 * `learning_circle_id`/`learning_circle_name` are null in the "All
 * Students" scope only when the student's most recently rated session was
 * logged by a volunteer who belongs to no Learning Circle; in a circle
 * scope they're always that circle (never null, since the row wouldn't
 * exist otherwise).
 */
export type EffortLeaderboardRow = {
  student_id: string;
  student_name: string;
  average_effort_score: number;
  effort_score_count: number;
  learning_circle_id: string | null;
  learning_circle_name: string | null;
};

export interface Database {
  public: {
    Tables: {
      volunteers: {
        Row: Volunteer;
        Insert: Partial<Volunteer> & { id: string; name: string; email: string };
        Update: Partial<Volunteer>;
        Relationships: [];
      };
      students: {
        Row: Student;
        Insert: Partial<Student> & { name: string; grade: number };
        Update: Partial<Student>;
        Relationships: [];
      };
      assignments: {
        Row: Assignment;
        Insert: Partial<Assignment> & { student_id: string; volunteer_id: string };
        Update: Partial<Assignment>;
        Relationships: [
          {
            foreignKeyName: "assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_volunteer_id_fkey";
            columns: ["volunteer_id"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_roadmap: {
        Row: LearningRoadmapEntry;
        Insert: Partial<LearningRoadmapEntry> & { grade: number; subject: Subject; topic: string; order_index: number };
        Update: Partial<LearningRoadmapEntry>;
        Relationships: [];
      };
      progress: {
        Row: Progress;
        Insert: Partial<Progress> & { student_id: string; volunteer_id: string };
        Update: Partial<Progress>;
        Relationships: [
          {
            foreignKeyName: "progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_volunteer_id_fkey";
            columns: ["volunteer_id"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_learning_circle_id_fkey";
            columns: ["learning_circle_id"];
            isOneToOne: false;
            referencedRelation: "learning_circles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_edited_by_fkey";
            columns: ["edited_by"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: Attendance;
        Insert: Partial<Attendance> & { volunteer_id: string; session_date: string };
        Update: Partial<Attendance>;
        Relationships: [
          {
            foreignKeyName: "attendance_volunteer_id_fkey";
            columns: ["volunteer_id"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_marked_by_fkey";
            columns: ["marked_by"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_circles: {
        Row: LearningCircle;
        Insert: Partial<LearningCircle> & { name: string; lead_admin_id: string };
        Update: Partial<LearningCircle>;
        Relationships: [
          {
            foreignKeyName: "learning_circles_lead_admin_id_fkey";
            columns: ["lead_admin_id"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_circles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_circle_members: {
        Row: LearningCircleMember;
        Insert: Partial<LearningCircleMember> & { circle_id: string; volunteer_id: string };
        Update: Partial<LearningCircleMember>;
        Relationships: [
          {
            foreignKeyName: "learning_circle_members_circle_id_fkey";
            columns: ["circle_id"];
            isOneToOne: false;
            referencedRelation: "learning_circles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_circle_members_volunteer_id_fkey";
            columns: ["volunteer_id"];
            isOneToOne: true;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
        ];
      };
      student_roadmap_positions: {
        Row: StudentRoadmapPosition;
        Insert: Partial<StudentRoadmapPosition> & {
          student_id: string;
          subject: Subject;
          roadmap_id: string;
        };
        Update: Partial<StudentRoadmapPosition>;
        Relationships: [
          {
            foreignKeyName: "student_roadmap_positions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_roadmap_positions_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "learning_roadmap";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_roadmap_positions_set_by_fkey";
            columns: ["set_by"];
            isOneToOne: false;
            referencedRelation: "volunteers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      latest_progress: { Row: LatestProgress; Relationships: [] };
      students_needing_revision: { Row: StudentNeedingRevision; Relationships: [] };
      student_effort_leaderboard: { Row: EffortLeaderboardRow; Relationships: [] };
      student_effort_leaderboard_by_circle: { Row: EffortLeaderboardRow; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      proficiency_level: ProficiencyLevel;
      understanding_status: UnderstandingStatus;
      subject: Subject;
      attendance_status: AttendanceStatus;
      debrief_verification_status: DebriefVerificationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

