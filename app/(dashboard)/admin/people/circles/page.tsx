import { createClient } from "@/lib/supabase/server";
import { volunteerRepository } from "@/lib/repositories/volunteerRepository";
import { learningCircleRepository } from "@/lib/repositories/learningCircleRepository";
import { LearningCirclesPanel } from "@/components/admin/LearningCirclesPanel";

/**
 * Learning Circles tab of the People workspace.
 *
 * Uses listPublic() rather than list(): the volunteer rows flow into a
 * client component, and a circle roster has no need for phone numbers or
 * dates of birth (see H1 / PublicVolunteer).
 */
export default async function AdminLearningCirclesPage() {
  const supabase = await createClient();

  const [circles, volunteers] = await Promise.all([
    learningCircleRepository.list(supabase),
    volunteerRepository.listPublic(supabase),
  ]);

  // The lead must be an admin — enforced in the DB by
  // trg_learning_circle_lead_must_be_admin, mirrored here so the picker
  // can't offer an invalid choice in the first place.
  const admins = volunteers.filter((v) => v.role === "admin");

  return <LearningCirclesPanel initialCircles={circles} volunteers={volunteers} admins={admins} />;
}
