import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { VolunteersTable } from "@/components/admin/VolunteersTable";

export default async function AdminVolunteersPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [volunteers, assignments] = await Promise.all([
    volunteerRepository.list(supabase),
    supabase.from("assignments").select("volunteer_id"),
  ]);

  const studentCounts: Record<string, number> = {};
  for (const row of assignments.data ?? []) {
    studentCounts[row.volunteer_id] = (studentCounts[row.volunteer_id] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Volunteers" description="Invite volunteers, manage roles, and see their student load." />
      <VolunteersTable initialVolunteers={volunteers} studentCounts={studentCounts} />
    </div>
  );
}
