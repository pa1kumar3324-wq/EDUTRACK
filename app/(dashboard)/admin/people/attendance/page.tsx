import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { AttendanceMarker } from "@/components/admin/AttendanceMarker";

export default async function AdminPeopleAttendancePage() {
  const supabase = await createClient();
  const volunteers = await volunteerRepository.list(supabase);

  return <AttendanceMarker volunteers={volunteers} />;
}
