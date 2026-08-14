import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { progressSchema } from "@/lib/validations/progress";
import { progressRepository } from "@/lib/repositories/progressRepository";
import { roadmapRepository } from "@/lib/repositories/roadmapRepository";
import { studentRepository } from "@/lib/repositories/studentRepository";
import { studentRoadmapPositionRepository } from "@/lib/repositories/studentRoadmapPositionRepository";
import { resolveRoadmapPosition, validateTopicAgainstRoadmap } from "@/lib/utils/roadmapEngine";
import { generateAiSuggestion } from "@/lib/utils/suggestionEngine";

/**
 * POST /api/progress
 * Validates + writes a progress entry, then computes a "Suggested Next
 * Lesson" independently for EACH subject that was actually recorded this
 * session, using the same authoritative roadmap resolution logic as the
 * rest of the app (resolveRoadmapPosition — leader-set starting baseline
 * plus automatic recommendation) to decide WHAT to teach, and optionally
 * the Gemini API to decide HOW to phrase the teaching advice.
 *
 * Math and English are resolved and suggested completely independently —
 * one subject's roadmap position/topic/status is never passed into the
 * other's Gemini call — and a Gemini failure on one subject falls back to
 * the deterministic heuristic for that subject only (generateAiSuggestion
 * already guarantees this internally; see lib/utils/suggestionEngine.ts).
 *
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

    // Server-side gate: never trust the client alone (the UI's Select can be
    // bypassed with a raw API call). If a roadmap exists for this grade/
    // subject, the submitted topic must exactly match one of its entries —
    // this is what makes the old silent "falls back to topic #1" failure
    // mode structurally impossible going forward. If no roadmap exists yet,
    // free text is allowed through, same as the form's fallback.
    const englishValidation = validateTopicAgainstRoadmap(
      "english",
      student.grade,
      values.english_topic,
      values.english_roadmap_id,
      roadmap
    );
    if (englishValidation.error) {
      return NextResponse.json({ error: englishValidation.error }, { status: 400 });
    }
    const mathValidation = validateTopicAgainstRoadmap(
      "math",
      student.grade,
      values.math_topic,
      values.math_roadmap_id,
      roadmap
    );
    if (mathValidation.error) {
      return NextResponse.json({ error: mathValidation.error }, { status: 400 });
    }

    // Resolve + suggest for each subject independently. A subject is only
    // processed at all if it was actually recorded this session (has both a
    // topic and a status) — we never generate an unnecessary AI request for
    // a subject that wasn't taught.
    async function suggestForSubject(subject: "english" | "math"): Promise<string | undefined> {
      const status = subject === "english" ? values.english_status : values.math_status;
      const topic = subject === "english" ? values.english_topic : values.math_topic;
      if (!status || !topic) return undefined;

      // Use the SAME authoritative resolution logic as every other roadmap
      // consumer (student profile, roadmap tracker) — a leader-set starting
      // baseline is a floor, not a permanent pin, so once progress has
      // advanced past it this naturally falls through to the automatic
      // engine's recommendation, exactly like resolveRoadmapPosition does
      // everywhere else. Each subject resolves against its OWN baseline and
      // history only.
      const baseline = await studentRoadmapPositionRepository.getForStudentSubject(
        supabase,
        values.student_id,
        subject
      );
      const recommendation = resolveRoadmapPosition(
        subject,
        student.grade,
        roadmap,
        history,
        baseline?.learning_roadmap ?? null
      );

      // Gemini only ever receives this subject's own topic/status/roadmap
      // decision — never the other subject's context.
      return generateAiSuggestion({
        studentName: student.name,
        grade: student.grade,
        subject,
        topic,
        status,
        notes: values.notes,
        nextRoadmapTopic: recommendation?.topic,
        isRevision: recommendation?.isRevision,
      });
    }

    // Run both subjects' Gemini requests concurrently — they're fully
    // independent, and generateAiSuggestion already isolates failures (a
    // Gemini error on one subject falls back to the heuristic for that
    // subject only, it never rejects), so Promise.all is safe here.
    const [mathSuggestion, englishSuggestion] = await Promise.all([
      suggestForSubject("math"),
      suggestForSubject("english"),
    ]);

    // The `progress` table only has a single `suggested_next_lesson` column
    // (see supabase/schema.sql) — preserve it as-is rather than adding a
    // migration for this. When both subjects are present it stores both,
    // labeled, so nothing is silently discarded in the persisted record or
    // the timeline view that reads this column; when only one is present it
    // stores just that one, matching prior behavior exactly.
    const suggestedNextLesson =
      mathSuggestion && englishSuggestion
        ? `Math: ${mathSuggestion}\n\nEnglish: ${englishSuggestion}`
        : mathSuggestion ?? englishSuggestion;

    const created = await progressRepository.create(supabase, {
      ...values,
      volunteer_id: user.id,
      suggested_next_lesson: suggestedNextLesson,
      english_roadmap_id: englishValidation.roadmapEntryId,
      math_roadmap_id: mathValidation.roadmapEntryId,
    });

    return NextResponse.json({
      progress: created,
      mathSuggestion: mathSuggestion ?? null,
      englishSuggestion: englishSuggestion ?? null,
      // Backwards-compatible combined field for existing consumers.
      suggestedNextLesson,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
