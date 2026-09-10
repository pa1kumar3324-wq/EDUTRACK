import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { StudentsTable } from "@/components/admin/StudentsTable";
import { displayName } from "@/lib/utils";
import type { Volunteer } from "@/lib/types/database";

export default async function AdminPeopleStudentsPage() {
  const supabase = await createClient();

  const [volunteers, { data }] = await Promise.all([
    volunteerRepository.list(supabase),
    supabase
      .from("assignments")
      .select("student_id, volunteers!assignments_volunteer_id_fkey(*)"),
  ]);

  const assignmentRows = (data ?? []) as {
    student_id: string;
    volunteers: Volunteer | null;
  }[];

  const assignedVolunteerNames: Record<string, string[]> = {};
  for (const row of assignmentRows) {
    if (!row.volunteers) continue;
    const names = (assignedVolunteerNames[row.student_id] ??= []);
    names.push(displayName(row.volunteers));
  }

  return <StudentsTable volunteers={volunteers} assignedVolunteerNames={assignedVolunteerNames} />;
}
