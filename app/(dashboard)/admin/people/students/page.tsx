import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { StudentsTable } from "@/components/admin/StudentsTable";

export default async function AdminPeopleStudentsPage() {
  const supabase = await createClient();
  const volunteers = await volunteerRepository.list(supabase);

  return <StudentsTable volunteers={volunteers} />;
}
