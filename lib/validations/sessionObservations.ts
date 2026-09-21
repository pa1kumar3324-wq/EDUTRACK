import { z } from "zod";

// Keep these enums in exact sync with lib/types/sessionObservations.ts.
// Duplicated intentionally: zod needs literal string unions for runtime
// validation, and the plain TS types give compile-time shape checking to
// every consumer (form, API route, Tsareena context builder) without
// depending on zod's inferred types everywhere.

const mood = z.enum(["very_low", "low", "neutral", "good", "very_good"]);
const energy = z.enum(["very_low", "low", "moderate", "high", "very_high"]);
const attention = z.enum(["frequently_distracted", "somewhat_distracted", "mostly_focused", "highly_focused"]);
const participation = z.enum(["avoided", "limited", "moderate", "active", "very_active"]);
const confidenceLevel = z.enum(["very_low", "low", "moderate", "high", "very_high"]);
const distractionSource = z.enum(["peers", "environment", "device", "low_energy", "personal", "other"]);

const understanding = z.enum(["not_understood", "beginning", "partial", "good", "strong"]);
const difficulty = z.enum(["very_difficult", "difficult", "moderate", "easy", "very_easy"]);
const independence = z.enum(["constant_help", "frequent_help", "occasional_help", "mostly_independent", "fully_independent"]);
const accuracy = z.enum(["mostly_incorrect", "mixed", "mostly_correct", "highly_accurate"]);
const explainAbility = z.enum(["could_not", "needed_significant_prompting", "partial", "clear", "confident"]);
const applyAbility = z.enum(["could_not", "needed_significant_help", "with_some_help", "mostly_independent", "fully_independent"]);

const lessonExecution = z.enum(["not_completed", "partially_completed", "mostly_completed", "fully_completed"]);
const lessonObjective = z.enum(["not_achieved", "partially_achieved", "mostly_achieved", "achieved"]);
const objectiveBlocker = z.enum([
  "prerequisite_gap",
  "distraction",
  "time_ran_out",
  "activity_too_difficult",
  "activity_too_easy",
  "plan_changed",
  "attendance_issue",
  "other",
]);
const timeAvailability = z.enum(["not_enough", "slightly_short", "enough", "more_than_enough"]);
const activitiesCompleted = z.enum(["none", "some", "most", "all"]);
const lessonChanges = z.enum(["no_change", "minor_adjustment", "major_adjustment", "completely_changed"]);

const teachingApproach = z.enum([
  "direct_explanation",
  "guided_practice",
  "worked_examples",
  "questioning",
  "visual_explanation",
  "game_activity",
  "reading_practice",
  "problem_solving",
  "revision",
  "mixed_approach",
]);
const activityType = z.enum([
  "worksheet",
  "verbal_practice",
  "flashcards",
  "game",
  "reading",
  "writing",
  "real_world_example",
  "discussion",
  "problem_set",
  "other",
]);
const explanationEffectiveness = z.enum([
  "not_effective",
  "slightly_effective",
  "moderately_effective",
  "very_effective",
  "extremely_effective",
]);

const progressVsPrevious = z.enum(["regressed", "no_change", "small_improvement", "good_improvement", "significant_improvement"]);
const revisionNeed = z.enum(["definitely", "probably", "maybe", "probably_not", "ready_to_progress"]);

const sessionEffectiveness = z.enum(["poor", "below_average", "good", "very_good", "excellent"]);
const biggestSuccess = z.enum([
  "understood_difficult_concept",
  "participated_actively",
  "worked_independently",
  "improved_accuracy",
  "gained_confidence",
  "completed_lesson",
  "applied_concept_successfully",
  "other",
]);
const biggestChallenge = z.enum([
  "distraction",
  "low_energy",
  "low_confidence",
  "missing_prerequisite",
  "concept_too_difficult",
  "activity_didnt_work",
  "time_constraints",
  "behavioral_issue",
  "plan_changed",
  "other",
]);

const shortText = z.string().max(300).optional().or(z.literal(""));

const subjectObservations = z
  .object({
    priorUnderstanding: understanding.array().optional(),
    currentUnderstanding: understanding.array().optional(),
    difficulty: difficulty.array().optional(),
    independence: independence.array().optional(),
    accuracy: accuracy.array().optional(),
    explainAbility: explainAbility.array().optional(),
    applyAbility: applyAbility.array().optional(),
    difficultyCause: shortText,

    lessonExecution: lessonExecution.array().optional(),
    lessonObjective: lessonObjective.array().optional(),
    objectiveBlocker: objectiveBlocker.array().optional(),
    incompleteReason: shortText,
    timeAvailability: timeAvailability.array().optional(),
    activitiesCompleted: activitiesCompleted.array().optional(),
    lessonChanges: lessonChanges.array().optional(),

    teachingApproach: teachingApproach.array().optional(),
    activityType: activityType.array().optional(),
    explanationEffectiveness: explanationEffectiveness.array().optional(),
    whatWorked: shortText,
    whatDidntWork: shortText,
    neededAdditionalExamples: z.boolean().optional(),
    revisionRequired: z.boolean().optional(),

    progressVsPrevious: progressVsPrevious.array().optional(),
    revisionNeed: revisionNeed.array().optional(),
    revisionArea: shortText,
    confidenceMovingForward: confidenceLevel.array().optional(),
    recommendedFocusNext: shortText,
  })
  .partial()
  .optional();

export const sessionObservationsSchema = z
  .object({
    mood: mood.array().optional(),
    energy: energy.array().optional(),
    attention: attention.array().optional(),
    distractionSource: distractionSource.array().optional(),
    participation: participation.array().optional(),
    confidence: confidenceLevel.array().optional(),
    confidenceCause: shortText,

    english: subjectObservations,
    math: subjectObservations,

    overallEffectiveness: sessionEffectiveness.array().optional(),
    biggestSuccess: biggestSuccess.array().optional(),
    biggestSuccessOther: shortText,
    biggestChallenge: biggestChallenge.array().optional(),
    biggestChallengeOther: shortText,

    unusualNote: z.string().max(500).optional().or(z.literal("")),
  })
  .partial();

export type SessionObservationsFormValues = z.infer<typeof sessionObservationsSchema>;
