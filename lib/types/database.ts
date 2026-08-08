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

export type Volunteer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
};

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
  math_topic: string | null;
  math_status: UnderstandingStatus | null;
  homework: string | null;
  notes: string | null;
  suggested_next_lesson: string | null;
  session_date: string;
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
    };
    Views: {
      latest_progress: { Row: LatestProgress; Relationships: [] };
      students_needing_revision: { Row: StudentNeedingRevision; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      proficiency_level: ProficiencyLevel;
      understanding_status: UnderstandingStatus;
      subject: Subject;
      attendance_status: AttendanceStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

