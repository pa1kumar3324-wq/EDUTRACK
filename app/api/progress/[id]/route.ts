import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api/requireAuth";
import { apiError, ApiError } from "@/lib/api/errors";
import { progressEditSchema } from "@/lib/validations/progress";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { validateTopicAgainstRoadmap } from "@/lib/utils/roadmapEngine";

/**
 * PATCH /api/progress/[id] — admin only.
 * Body: any subset of { english_topic, english_status, english_roadmap_id,
 *                        math_topic, math_status, math_roadmap_id,
 *                        homework, notes }
 *
 * A correction to a debrief that already exists — not a new submission.
 * `progress_admin_write` (RLS) already lets any admin UPDATE any progress
 * row; this route adds the validation a raw PATCH would skip and the audit
 * trail a raw PATCH couldn't forge (edited_by/edited_at are stamped by
 * trg_stamp_progress_edit from auth.uid()/now(), not from this request).
 *
 * Deliberately does NOT touch verification_status, learning_circle_id,
 * verified_by, or verified_at — fixing a typo in a verified debrief doesn't
 * send it back through its Learning Circle lead. Use
 * POST /api/debriefs/[id]/verify for that.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminApi();
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const parsed = progressEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const values = parsed.data;

    const existing = await progressRepository.getById(supabase, id);
    if (!existing) throw new ApiError(404, "Debrief not found");

    // Merge onto the existing row before validating, since the "at least
    // one subject" invariant and roadmap-topic check both need the
    // RESULTING record, not just the fields this particular edit touched.
    const mergedEnglishTopic = values.english_topic !== undefined ? values.english_topic : existing.english_topic ?? "";
    const mergedMathTopic = values.math_topic !== undefined ? values.math_topic : existing.math_topic ?? "";

    if (!mergedEnglishTopic?.trim() && !mergedMathTopic?.trim()) {
      return NextResponse.json(
        { error: "A debrief needs at least one subject — clear both topics by deleting the entry instead." },
        { status: 400 }
      );
    }

    const student = await studentRepository.getById(supabase, existing.student_id);
    const roadmap = await roadmapRepository.listByGrade(supabase, student.grade);

    // Same server-side roadmap-topic gate as creation (see
    // app/api/progress/route.ts) — a free-typed topic that doesn't match
    // the grade's roadmap is rejected here too, not just on first entry.
    const patch: Record<string, unknown> = {};

    if (values.english_topic !== undefined || values.english_roadmap_id !== undefined) {
      const englishValidation = validateTopicAgainstRoadmap(
        "english",
        student.grade,
        mergedEnglishTopic,
        values.english_roadmap_id !== undefined ? values.english_roadmap_id : existing.english_roadmap_id,
        roadmap
      );
      if (englishValidation.error) {
        return NextResponse.json({ error: englishValidation.error }, { status: 400 });
      }
      if (values.english_topic !== undefined) patch.english_topic = values.english_topic || null;
      patch.english_roadmap_id = englishValidation.roadmapEntryId;
    }
    if (values.english_status !== undefined) patch.english_status = values.english_status;

    if (values.math_topic !== undefined || values.math_roadmap_id !== undefined) {
      const mathValidation = validateTopicAgainstRoadmap(
        "math",
        student.grade,
        mergedMathTopic,
        values.math_roadmap_id !== undefined ? values.math_roadmap_id : existing.math_roadmap_id,
        roadmap
      );
      if (mathValidation.error) {
        return NextResponse.json({ error: mathValidation.error }, { status: 400 });
      }
      if (values.math_topic !== undefined) patch.math_topic = values.math_topic || null;
      patch.math_roadmap_id = mathValidation.roadmapEntryId;
    }
    if (values.math_status !== undefined) patch.math_status = values.math_status;

    if (values.homework !== undefined) patch.homework = values.homework || null;
    if (values.notes !== undefined) patch.notes = values.notes || null;

    const updated = await progressRepository.update(supabase, id, patch);
    return NextResponse.json({ progress: updated });
  } catch (error) {
    return apiError(error);
  }
}
