import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { progressSchema } from "@/lib/validations/progress";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { studentRoadmapPositionRepository } from "@/lib/repositories/studentRoadmapPositionRepository";
import { resolveRoadmapPosition } from "@/lib/utils/roadmapEngine";
import { generateAiSuggestion } from "@/lib/utils/suggestionEngine";

/**
 * POST /api/progress
 * Validates + writes a progress entry, then computes the "Suggested Next
 * Lesson" using the same authoritative roadmap resolution logic as the rest
 * of the app (resolveRoadmapPosition — leader-set starting baseline plus
 * automatic recommendation), and optionally the Anthropic API.
 * RLS on the `progress` table enforces that a volunteer can only write for
 * students assigned to them; admins bypass that check.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const values = parsed.data;

  try {
    const student = await studentRepository.getById(supabase, values.student_id);
    const [roadmap, history] = await Promise.all([
      roadmapRepository.listByGrade(supabase, student.grade),
      progressRepository.listForStudent(supabase, values.student_id),
    ]);

    // Determine which subject to base the suggestion on: prefer the one
    // logged as the weakest this session, falling back to whichever was taught.
    const primarySubject: "english" | "math" =
      values.math_status === "not_understood" || values.math_status === "needs_help"
        ? "math"
        : "english";

    // Use the SAME authoritative resolution logic as every other roadmap
    // consumer (student profile, roadmap tracker) — a leader-set starting
    // baseline is a floor, not a permanent pin, so once progress has
    // advanced past it this naturally falls through to the automatic
    // engine's recommendation, exactly like resolveRoadmapPosition does
    // everywhere else.
    const baseline = await studentRoadmapPositionRepository.getForStudentSubject(
      supabase,
      values.student_id,
      primarySubject
    );
    const recommendation = resolveRoadmapPosition(
      primarySubject,
      student.grade,
      roadmap,
      history,
      baseline?.learning_roadmap ?? null
    );

    const status = primarySubject === "english" ? values.english_status : values.math_status;
    const topic = primarySubject === "english" ? values.english_topic : values.math_topic;

    const suggestedNextLesson =
      status && topic
        ? await generateAiSuggestion({
            studentName: student.name,
            subject: primarySubject,
            topic,
            status,
            notes: values.notes,
            nextRoadmapTopic: recommendation?.topic,
          })
        : recommendation
          ? `Next up: ${recommendation.topic}. ${recommendation.reason}`
          : undefined;

    const created = await progressRepository.create(supabase, {
      ...values,
      volunteer_id: user.id,
      suggested_next_lesson: suggestedNextLesson,
    });

    return NextResponse.json({ progress: created, suggestedNextLesson });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
