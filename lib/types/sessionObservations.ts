/**
 * Structured, per-session observation data captured by the richer
 * ProgressForm (see components/progress/ProgressForm.tsx) and persisted in
 * the `progress.session_observations` JSONB column (see
 * supabase/migrations/004_session_observations.sql).
 *
 * This is intentionally a single JSON blob rather than one column per field:
 * new observation types can be added here later without another migration,
 * while the write path stays a single progressRepository.create() call like
 * every other progress field.
 *
 * Every field is optional — a volunteer can log as much or as little
 * structure as they have time for. Fields that duplicate an existing
 * top-level `progress` column (topic, status) are NOT repeated here; see
 * english_topic/math_topic/english_status/math_status on Progress instead.
 *
 * IMPORTANT (privacy): this type must never contain a student name, ID, or
 * any other identifier. It is one of the allow-listed inputs into
 * Tsareena's Gemini context builder (components/ai/TsareenaContext.ts) —
 * keep it that way.
 */

export type Mood = "very_low" | "low" | "neutral" | "good" | "very_good";
export type Energy = "very_low" | "low" | "moderate" | "high" | "very_high";
export type Attention = "frequently_distracted" | "somewhat_distracted" | "mostly_focused" | "highly_focused";
export type Participation = "avoided" | "limited" | "moderate" | "active" | "very_active";
export type ConfidenceLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

export type CurrentUnderstanding = "not_understood" | "beginning" | "partial" | "good" | "strong";
export type Difficulty = "very_difficult" | "difficult" | "moderate" | "easy" | "very_easy";
export type Independence = "constant_help" | "frequent_help" | "occasional_help" | "mostly_independent" | "fully_independent";
export type Accuracy = "mostly_incorrect" | "mixed" | "mostly_correct" | "highly_accurate";
export type ExplainAbility = "could_not" | "needed_significant_prompting" | "partial" | "clear" | "confident";
export type ApplyAbility = "could_not" | "needed_significant_help" | "with_some_help" | "mostly_independent" | "fully_independent";

export type LessonExecution = "not_completed" | "partially_completed" | "mostly_completed" | "fully_completed";
export type LessonObjective = "not_achieved" | "partially_achieved" | "mostly_achieved" | "achieved";
export type TimeAvailability = "not_enough" | "slightly_short" | "enough" | "more_than_enough";
export type ActivitiesCompleted = "none" | "some" | "most" | "all";
export type LessonChanges = "no_change" | "minor_adjustment" | "major_adjustment" | "completely_changed";

export type TeachingApproach =
  | "direct_explanation"
  | "guided_practice"
  | "worked_examples"
  | "questioning"
  | "visual_explanation"
  | "game_activity"
  | "reading_practice"
  | "problem_solving"
  | "revision"
  | "mixed_approach";

export type ActivityType =
  | "worksheet"
  | "verbal_practice"
  | "flashcards"
  | "game"
  | "reading"
  | "writing"
  | "real_world_example"
  | "discussion"
  | "problem_set"
  | "other";

export type ExplanationEffectiveness = "not_effective" | "slightly_effective" | "moderately_effective" | "very_effective" | "extremely_effective";

export type ProgressVsPrevious = "regressed" | "no_change" | "small_improvement" | "good_improvement" | "significant_improvement";
export type RevisionNeed = "definitely" | "probably" | "maybe" | "probably_not" | "ready_to_progress";

export type SessionEffectiveness = "poor" | "below_average" | "good" | "very_good" | "excellent";

export type BiggestSuccess =
  | "understood_difficult_concept"
  | "participated_actively"
  | "worked_independently"
  | "improved_accuracy"
  | "gained_confidence"
  | "completed_lesson"
  | "applied_concept_successfully"
  | "other";

export type BiggestChallenge =
  | "distraction"
  | "low_energy"
  | "low_confidence"
  | "missing_prerequisite"
  | "concept_too_difficult"
  | "activity_didnt_work"
  | "time_constraints"
  | "behavioral_issue"
  | "plan_changed"
  | "other";

export type ObjectiveBlocker =
  | "prerequisite_gap"
  | "distraction"
  | "time_ran_out"
  | "activity_too_difficult"
  | "activity_too_easy"
  | "plan_changed"
  | "attendance_issue"
  | "other";

export type DistractionSource = "peers" | "environment" | "device" | "low_energy" | "personal" | "other";

/** Applies to one subject (english or math) within a session. */
export interface SubjectSessionObservations {
  // Learning observations
  priorUnderstanding?: CurrentUnderstanding;
  currentUnderstanding?: CurrentUnderstanding;
  difficulty?: Difficulty;
  independence?: Independence;
  accuracy?: Accuracy;
  explainAbility?: ExplainAbility;
  applyAbility?: ApplyAbility;
  difficultyCause?: string; // conditional: currentUnderstanding === "not_understood"

  // Lesson execution
  lessonExecution?: LessonExecution;
  lessonObjective?: LessonObjective;
  objectiveBlocker?: ObjectiveBlocker; // conditional: lessonObjective === "not_achieved"
  incompleteReason?: string; // conditional: lessonExecution === "partially_completed"
  timeAvailability?: TimeAvailability;
  activitiesCompleted?: ActivitiesCompleted;
  lessonChanges?: LessonChanges;

  // Teaching observations
  teachingApproach?: TeachingApproach;
  activityType?: ActivityType;
  explanationEffectiveness?: ExplanationEffectiveness;
  whatWorked?: string;
  whatDidntWork?: string;
  neededAdditionalExamples?: boolean;
  revisionRequired?: boolean;

  // Outcome
  progressVsPrevious?: ProgressVsPrevious;
  revisionNeed?: RevisionNeed;
  revisionArea?: string; // conditional: revisionNeed === "definitely"
  confidenceMovingForward?: ConfidenceLevel;
  recommendedFocusNext?: string;
}

export interface SessionObservations {
  // Student state (session-level, not per-subject)
  mood?: Mood;
  energy?: Energy;
  attention?: Attention;
  distractionSource?: DistractionSource; // conditional: attention === "frequently_distracted"
  participation?: Participation;
  confidence?: ConfidenceLevel;
  confidenceCause?: string; // conditional: confidence === "very_low"

  // Per-subject observations
  english?: SubjectSessionObservations;
  math?: SubjectSessionObservations;

  // Session quality (session-level)
  overallEffectiveness?: SessionEffectiveness;
  biggestSuccess?: BiggestSuccess;
  biggestSuccessOther?: string;
  biggestChallenge?: BiggestChallenge;
  biggestChallengeOther?: string;

  // Free text, kept small and optional
  unusualNote?: string;
}
