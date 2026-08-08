import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceMarker } from "@/components/admin/AttendanceMarker";

export default async function AdminAttendancePage() {
  await requireAdmin();
  const supabase = await createClient();
  const volunteers = await volunteerRepository.list(supabase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attendance"
        description="Mark who showed up for each session. Volunteers can see their own record on their dashboard."
      />
      <AttendanceMarker volunteers={volunteers} />
    </div>
  );
}
