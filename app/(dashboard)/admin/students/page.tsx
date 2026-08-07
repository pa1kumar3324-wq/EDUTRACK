import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { StudentsTable } from "@/components/admin/StudentsTable";

export default async function AdminStudentsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const volunteers = await volunteerRepository.list(supabase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Students" description="Add, edit, remove, and assign students to volunteers." />
      <StudentsTable volunteers={volunteers} />
    </div>
  );
}
