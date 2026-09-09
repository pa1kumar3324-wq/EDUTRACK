import type { UnderstandingStatus } from "@/lib/types/database";

interface SuggestionInput {
  grade?: number;
  subject: "english" | "math";
  topic: string;
  status: UnderstandingStatus;
  notes?: string;
  nextRoadmapTopic?: string;
  /**
   * Whether the roadmap engine's recommendation is a REVISION of the topic
   * just taught (same topic again) rather than an ADVANCEMENT to a new one.
   * Always comes from resolveRoadmapPosition()/recommendNextTopic() in
   * lib/utils/roadmapEngine.ts — this file never infers or overrides it.
   */
  isRevision?: boolean;
}

/**
 * Produces the "Suggested Next Lesson" text shown after a progress submission.
 *
 * This is the ONLY suggestion source in EduTrack. There used to be an
 * optional server-side Gemini-backed path here (see CHANGELOG) — it has been
 * removed entirely. The only AI system left in the product is Tsareena
 * (components/ai/*), which is a separate, client-side, bring-your-own-key
 * assistant that never touches this file or this API route. This function
 * is fully deterministic, has zero external/network dependency, and always
 * runs — progress logging and the "Suggested Next Lesson" feature work
 * exactly the same whether or not any volunteer has ever connected Tsareena
 * to Gemini.
 */
export function heuristicSuggestion(input: SuggestionInput): string {
  const { subject, topic, status, nextRoadmapTopic, isRevision } = input;
  const subjectLabel = subject === "english" ? "English" : "Math";

  if (status === "not_understood") {
    return `Spend the first 15 minutes of the next session re-teaching "${topic}" with a different method (visual aids or hands-on examples) before attempting anything new in ${subjectLabel}.`;
  }

  if (status === "needs_help") {
    // REVISION: the roadmap engine is recommending the SAME topic again, so
    // never phrase this as "before moving to" that same topic.
    if (isRevision) {
      return `Spend 10-15 minutes revisiting "${topic}" using guided practice and concrete examples, and check whether the student can work through it independently before introducing anything new.`;
    }
    return `Briefly review "${topic}" for 10 minutes to build confidence, then continue reinforcing it with guided practice before moving to ${nextRoadmapTopic ?? "the next topic"}.`;
  }

  // independent
  return nextRoadmapTopic
    ? `Student is confident with "${topic}" — begin introducing "${nextRoadmapTopic}" next session.`
    : `Student is confident with "${topic}" — ready to advance to the next roadmap topic in ${subjectLabel}.`;
}
