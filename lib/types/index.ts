export * from "./database";

export interface StudentWithProgress {
  student: import("./database").Student;
  latestProgress: import("./database").LatestProgress | null;
  assignedVolunteers: import("./database").Volunteer[];
  status: "on-track" | "needs-revision" | "stale";
}

export interface DashboardStats {
  studentsAssigned: number;
  studentsUpdatedThisWeek: number;
  pendingUpdates: number;
  studentsNeedingRevision: number;
}

export interface AdminStats {
  totalStudents: number;
  totalVolunteers: number;
  studentsUpdatedToday: number;
  studentsNeedingRevision: number;
}

export interface WeeklyProgressPoint {
  week: string;
  updates: number;
}

export interface LevelDistributionPoint {
  level: string;
  count: number;
}

export interface WeakTopicPoint {
  topic: string;
  count: number;
}

export interface VolunteerActivityPoint {
  name: string;
  updates: number;
  studentsAssigned: number;
}

export interface CoverageEntry {
  student: { id: string; name: string; grade: number; photo_url: string | null };
  updated: boolean;
  volunteerName: string | null;
  updatedAt: string | null;
  assignedVolunteers: string[];
}

export interface CoverageSummary {
  weekendLabel: string;
  weekendStart: string;
  weekendEnd: string;
  weekOffset: number;
  totalStudents: number;
  updatedCount: number;
  missingCount: number;
  coveragePercent: number;
  entries: CoverageEntry[];
}

export interface SearchResultItem {
  type: "student" | "volunteer";
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

export interface RecentActivityItem {
  id: string;
  studentId: string;
  studentName: string;
  volunteerName: string;
  createdAt: string;
  summary: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: import("./database").UserRole;
  avatarUrl: string | null;
}
