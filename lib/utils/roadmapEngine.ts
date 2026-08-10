import type { LearningRoadmapEntry, Progress, Subject } from "@/lib/types/database";

export interface NextLessonRecommendation {
  subject: Subject;
  topic: string;
  reason: string;
  isRevision: boolean;
}

export interface RoadmapPosition extends NextLessonRecommendation {
  /**
   * "baseline" when the leader-set starting point is the current position
   * because progress hasn't advanced past it yet; "automatic" when the
   * position comes from the continuity engine reading actual progress
   * history (this includes cases where a baseline exists but has already
   * been surpassed, or where a revision is needed on the baseline topic
   * itself).
   */
  source: "baseline" | "automatic";
  /** The learning_roadmap row id backing this position, when known (used to compute done/upcoming in the tracker UI). */
  roadmapEntryId: string | null;
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
      // Non-null: `subjectRoadmap.length === 0` returned above, so index 0 exists.
      topic: lastTopic ?? subjectRoadmap[0]!.topic,
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
      // Non-null: `subjectRoadmap.length === 0` returned above, so the last index exists.
      topic: lastTopic ?? subjectRoadmap[subjectRoadmap.length - 1]!.topic,
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

/**
 * Single authoritative source of truth for "where is this student on the
 * roadmap right now", for a given subject. Every roadmap consumer (student
 * profile, roadmap tracker, progress form / suggested-next-lesson, etc.)
 * must call this instead of `recommendNextTopic` directly, so they always
 * agree.
 *
 * Semantics: a leader-set position (`student_roadmap_positions`) is a
 * STARTING BASELINE, not a permanent pin. It establishes a floor — "the
 * student's roadmap begins here" — but normal automatic progression
 * (`recommendNextTopic`, unchanged) still drives the student forward once
 * they record progress at or beyond that point:
 *
 *  - If the student has no progress yet, or their most recent progress is
 *    still at/behind the baseline topic, the baseline IS the current
 *    position (source: "baseline").
 *  - As soon as `recommendNextTopic` — reading the *entire*, untouched
 *    progress history — would place the student at or beyond the baseline
 *    topic (including a revision recommendation ON the baseline topic
 *    itself), that automatic recommendation takes over (source:
 *    "automatic"). The baseline is never used to force the student
 *    backwards below progress they've actually demonstrated.
 *  - If the baseline's roadmap entry no longer belongs to the student's
 *    CURRENT grade (e.g. the student was moved to a new grade after the
 *    baseline was set), it is treated as stale and ignored entirely —
 *    automatic recommendation applies as if no baseline existed.
 *  - With no baseline at all, this is exactly `recommendNextTopic`.
 *
 * This never reads or writes `progress` — it only decides which signal
 * (baseline floor vs. automatic engine output) should be treated as the
 * current position, comparing their roadmap order_index.
 */
export function resolveRoadmapPosition(
  subject: Subject,
  grade: number,
  roadmap: LearningRoadmapEntry[],
  history: Progress[],
  baselineEntry: LearningRoadmapEntry | null | undefined
): RoadmapPosition | null {
  const subjectRoadmap = roadmap
    .filter((r) => r.subject === subject)
    .sort((a, b) => a.order_index - b.order_index);

  const automatic = recommendNextTopic(subject, roadmap, history);

  const baselineValid =
    baselineEntry && baselineEntry.subject === subject && baselineEntry.grade === grade ? baselineEntry : null;

  const automaticEntry = automatic
    ? subjectRoadmap.find((r) => r.topic.toLowerCase() === automatic.topic.toLowerCase())
    : undefined;

  if (!baselineValid) {
    if (!automatic) return null;
    return { ...automatic, source: "automatic", roadmapEntryId: automaticEntry?.id ?? null };
  }

  const baselineIndex = subjectRoadmap.findIndex((r) => r.id === baselineValid.id);
  const automaticIndex = automaticEntry ? subjectRoadmap.findIndex((r) => r.id === automaticEntry.id) : -1;

  // Progress has caught up to (or moved past) the baseline — including a
  // revision recommendation on the baseline topic itself — so the automatic
  // engine is authoritative from here on.
  if (automatic && automaticIndex >= baselineIndex) {
    return { ...automatic, source: "automatic", roadmapEntryId: automaticEntry?.id ?? null };
  }

  // No progress yet at/beyond the baseline: the leader-set starting point
  // is the current position.
  return {
    subject,
    topic: baselineValid.topic,
    reason: "Leader-set starting point — the student's roadmap begins here.",
    isRevision: false,
    source: "baseline",
    roadmapEntryId: baselineValid.id,
  };
}
