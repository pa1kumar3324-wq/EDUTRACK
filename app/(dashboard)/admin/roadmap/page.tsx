import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoadmapBuilder } from "@/components/admin/RoadmapBuilder";

export default async function AdminRoadmapPage() {
  await requireAdmin();
  const supabase = await createClient();
  const entries = await roadmapRepository.listAll(supabase);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Learning Roadmap"
        description="Define the ordered sequence of topics per grade — EduTrack recommends the next lesson automatically."
      />
      <RoadmapBuilder initialEntries={entries} />
    </div>
  );
}
