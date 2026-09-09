import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { VolunteersTable } from "@/components/admin/VolunteersTable";

export default async function AdminPeopleVolunteersPage() {
  const supabase = await createClient();

  const [volunteers, assignments] = await Promise.all([
    volunteerRepository.list(supabase),
    supabase.from("assignments").select("volunteer_id"),
  ]);

  const studentCounts: Record<string, number> = {};

  const assignmentRows = (assignments.data ?? []) as {
    volunteer_id: string;
  }[];

  for (const row of assignmentRows) {
    studentCounts[row.volunteer_id] =
      (studentCounts[row.volunteer_id] ?? 0) + 1;
  }

  return (
    <VolunteersTable
      initialVolunteers={volunteers}
      studentCounts={studentCounts}
    />
  );
}
