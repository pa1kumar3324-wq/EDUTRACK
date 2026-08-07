import type { LearningRoadmapEntry, Progress, Subject } from "@/lib/types/database";

export interface NextLessonRecommendation {
  subject: Subject;
  topic: string;
  reason: string;
  isRevision: boolean;
}

/**
 * Core continuity logic: given a student's ordered roadmap for a subject and
 * their progress history, decide what should be taught next.
 *
 * Rule of thumb:
 *  1. If the most recent session on this subject was "not_understood" or
 *     "needs_help", recommend REVISING that same topic before moving on.
 *  2. Otherwise, recommend the next topic in roadmap order after the most
 *     recently taught one.
 *  3. If nothing has been taught yet, recommend the first roadmap topic.
 */
export function recommendNextTopic(
  subject: Subject,
  roadmap: LearningRoadmapEntry[],
  history: Progress[]
): NextLessonRecommendation | null {
  const subjectRoadmap = roadmap
    .filter((r) => r.subject === subject)
    .sort((a, b) => a.order_index - b.order_index);

  if (subjectRoadmap.length === 0) return null;

  const subjectHistory = history
    .filter((p) => (subject === "english" ? p.english_topic : p.math_topic))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const lastEntry = subjectHistory[0];

  if (!lastEntry) {
    const first = subjectRoadmap[0];
    return first
      ? {
          subject,
          topic: first.topic,
          reason: "No sessions logged yet — starting from the beginning of the roadmap.",
          isRevision: false,
        }
      : null;
  }

  const lastTopic = subject === "english" ? lastEntry.english_topic : lastEntry.math_topic;
  const lastStatus = subject === "english" ? lastEntry.english_status : lastEntry.math_status;

  if (lastStatus === "not_understood" || lastStatus === "needs_help") {
    return {
      subject,
      topic: lastTopic ?? subjectRoadmap[0].topic,
      reason:
        lastStatus === "not_understood"
          ? `Last session the student didn't grasp "${lastTopic}" — revisit before advancing.`
          : `Last session "${lastTopic}" still needed help — reinforce before moving on.`,
      isRevision: true,
    };
  }

  const currentIndex = subjectRoadmap.findIndex(
    (r) => r.topic.toLowerCase() === (lastTopic ?? "").toLowerCase()
  );

  const next = currentIndex >= 0 ? subjectRoadmap[currentIndex + 1] : subjectRoadmap[0];

  if (!next) {
    return {
      subject,
      topic: lastTopic ?? subjectRoadmap[subjectRoadmap.length - 1].topic,
      reason: "Student has completed the full roadmap for this grade — consider enrichment or the next grade level.",
      isRevision: false,
    };
  }

  return {
    subject,
    topic: next.topic,
    reason: `Student is independent on "${lastTopic}" — ready to advance.`,
    isRevision: false,
  };
}
