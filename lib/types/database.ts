// ============================================================================
// Hand-authored types mirroring supabase/schema.sql.
// If you change the schema, run `supabase gen types typescript` and replace
// this file with the generated output for full drift-safety.
// ============================================================================

export type UserRole = "admin" | "volunteer";
export type ProficiencyLevel = "beginner" | "developing" | "proficient" | "advanced";
export type UnderstandingStatus = "independent" | "needs_help" | "not_understood";
export type Subject = "english" | "math";

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Student {
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
}

export interface Assignment {
  id: string;
  student_id: string;
  volunteer_id: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface LearningRoadmapEntry {
  id: string;
  grade: number;
  subject: Subject;
  topic: string;
  description: string | null;
  order_index: number;
  created_at: string;
}

export interface Progress {
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
}

export interface LatestProgress extends Progress {
  volunteer_name: string;
}

export interface StudentNeedingRevision {
  student_id: string;
  name: string;
  grade: number;
  last_activity: string;
  english_double_red: boolean;
  math_double_red: boolean;
  stale: boolean;
}

// Database generic shape consumed by the Supabase client factory.
export interface Database {
  public: {
    Tables: {
      volunteers: { Row: Volunteer; Insert: Partial<Volunteer> & { id: string; name: string; email: string }; Update: Partial<Volunteer> };
      students: { Row: Student; Insert: Partial<Student> & { name: string; grade: number }; Update: Partial<Student> };
      assignments: { Row: Assignment; Insert: Partial<Assignment> & { student_id: string; volunteer_id: string }; Update: Partial<Assignment> };
      learning_roadmap: { Row: LearningRoadmapEntry; Insert: Partial<LearningRoadmapEntry> & { grade: number; subject: Subject; topic: string; order_index: number }; Update: Partial<LearningRoadmapEntry> };
      progress: { Row: Progress; Insert: Partial<Progress> & { student_id: string; volunteer_id: string }; Update: Partial<Progress> };
    };
    Views: {
      latest_progress: { Row: LatestProgress };
      students_needing_revision: { Row: StudentNeedingRevision };
    };
  };
}
