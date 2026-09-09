import type { ScaleOption } from "@/components/progress/ScaleSelect";

const opts = (pairs: [string, string][]): ScaleOption[] => pairs.map(([value, label]) => ({ value, label }));

export const MOOD_OPTIONS = opts([
  ["very_low", "Very low"],
  ["low", "Low"],
  ["neutral", "Neutral"],
  ["good", "Good"],
  ["very_good", "Very good"],
]);

export const ENERGY_OPTIONS = opts([
  ["very_low", "Very low"],
  ["low", "Low"],
  ["moderate", "Moderate"],
  ["high", "High"],
  ["very_high", "Very high"],
]);

export const ATTENTION_OPTIONS = opts([
  ["frequently_distracted", "Frequently distracted"],
  ["somewhat_distracted", "Somewhat distracted"],
  ["mostly_focused", "Mostly focused"],
  ["highly_focused", "Highly focused"],
]);

export const DISTRACTION_SOURCE_OPTIONS = opts([
  ["peers", "Peers"],
  ["environment", "Environment"],
  ["device", "Device"],
  ["low_energy", "Low energy"],
  ["personal", "Personal / emotional"],
  ["other", "Other"],
]);

export const PARTICIPATION_OPTIONS = opts([
  ["avoided", "Avoided participation"],
  ["limited", "Limited"],
  ["moderate", "Moderate"],
  ["active", "Active"],
  ["very_active", "Very active"],
]);

export const CONFIDENCE_OPTIONS = opts([
  ["very_low", "Very low"],
  ["low", "Low"],
  ["moderate", "Moderate"],
  ["high", "High"],
  ["very_high", "Very high"],
]);

export const UNDERSTANDING_OPTIONS = opts([
  ["not_understood", "Not understood"],
  ["beginning", "Beginning"],
  ["partial", "Partial"],
  ["good", "Good"],
  ["strong", "Strong"],
]);

export const DIFFICULTY_OPTIONS = opts([
  ["very_difficult", "Very difficult"],
  ["difficult", "Difficult"],
  ["moderate", "Moderate"],
  ["easy", "Easy"],
  ["very_easy", "Very easy"],
]);

export const INDEPENDENCE_OPTIONS = opts([
  ["constant_help", "Needed constant help"],
  ["frequent_help", "Needed frequent help"],
  ["occasional_help", "Occasional help"],
  ["mostly_independent", "Mostly independent"],
  ["fully_independent", "Fully independent"],
]);

export const ACCURACY_OPTIONS = opts([
  ["mostly_incorrect", "Mostly incorrect"],
  ["mixed", "Mixed"],
  ["mostly_correct", "Mostly correct"],
  ["highly_accurate", "Highly accurate"],
]);

export const EXPLAIN_ABILITY_OPTIONS = opts([
  ["could_not", "Could not explain"],
  ["needed_significant_prompting", "Needed significant prompting"],
  ["partial", "Could explain partially"],
  ["clear", "Could explain clearly"],
  ["confident", "Could explain confidently"],
]);

export const APPLY_ABILITY_OPTIONS = opts([
  ["could_not", "Could not apply"],
  ["needed_significant_help", "Needed significant help"],
  ["with_some_help", "Could apply with some help"],
  ["mostly_independent", "Mostly independent"],
  ["fully_independent", "Fully independent"],
]);

export const LESSON_EXECUTION_OPTIONS = opts([
  ["not_completed", "Not completed"],
  ["partially_completed", "Partially completed"],
  ["mostly_completed", "Mostly completed"],
  ["fully_completed", "Fully completed"],
]);

export const LESSON_OBJECTIVE_OPTIONS = opts([
  ["not_achieved", "Not achieved"],
  ["partially_achieved", "Partially achieved"],
  ["mostly_achieved", "Mostly achieved"],
  ["achieved", "Achieved"],
]);

export const OBJECTIVE_BLOCKER_OPTIONS = opts([
  ["prerequisite_gap", "Struggled with prerequisite concept"],
  ["distraction", "Student was distracted"],
  ["time_ran_out", "Time ran out"],
  ["activity_too_difficult", "Activity was too difficult"],
  ["activity_too_easy", "Activity was too easy"],
  ["plan_changed", "Lesson plan changed"],
  ["attendance_issue", "Attendance / session issue"],
  ["other", "Other"],
]);

export const TIME_AVAILABILITY_OPTIONS = opts([
  ["not_enough", "Not enough"],
  ["slightly_short", "Slightly short"],
  ["enough", "Enough"],
  ["more_than_enough", "More than enough"],
]);

export const ACTIVITIES_COMPLETED_OPTIONS = opts([
  ["none", "None completed"],
  ["some", "Some completed"],
  ["most", "Most completed"],
  ["all", "All completed"],
]);

export const LESSON_CHANGES_OPTIONS = opts([
  ["no_change", "No change"],
  ["minor_adjustment", "Minor adjustment"],
  ["major_adjustment", "Major adjustment"],
  ["completely_changed", "Completely changed"],
]);

export const TEACHING_APPROACH_OPTIONS = opts([
  ["direct_explanation", "Direct explanation"],
  ["guided_practice", "Guided practice"],
  ["worked_examples", "Worked examples"],
  ["questioning", "Questioning"],
  ["visual_explanation", "Visual explanation"],
  ["game_activity", "Game / activity"],
  ["reading_practice", "Reading practice"],
  ["problem_solving", "Problem solving"],
  ["revision", "Revision"],
  ["mixed_approach", "Mixed approach"],
]);

export const ACTIVITY_TYPE_OPTIONS = opts([
  ["worksheet", "Worksheet"],
  ["verbal_practice", "Verbal practice"],
  ["flashcards", "Flashcards"],
  ["game", "Game"],
  ["reading", "Reading"],
  ["writing", "Writing"],
  ["real_world_example", "Real-world example"],
  ["discussion", "Discussion"],
  ["problem_set", "Problem set"],
  ["other", "Other"],
]);

export const EXPLANATION_EFFECTIVENESS_OPTIONS = opts([
  ["not_effective", "Not effective"],
  ["slightly_effective", "Slightly effective"],
  ["moderately_effective", "Moderately effective"],
  ["very_effective", "Very effective"],
  ["extremely_effective", "Extremely effective"],
]);

export const PROGRESS_VS_PREVIOUS_OPTIONS = opts([
  ["regressed", "Regressed"],
  ["no_change", "No noticeable change"],
  ["small_improvement", "Small improvement"],
  ["good_improvement", "Good improvement"],
  ["significant_improvement", "Significant improvement"],
]);

export const REVISION_NEED_OPTIONS = opts([
  ["definitely", "Definitely needs revision"],
  ["probably", "Probably needs revision"],
  ["maybe", "Maybe"],
  ["probably_not", "Probably ready"],
  ["ready_to_progress", "Ready to progress"],
]);

export const SESSION_EFFECTIVENESS_OPTIONS = opts([
  ["poor", "Poor"],
  ["below_average", "Below average"],
  ["good", "Good"],
  ["very_good", "Very good"],
  ["excellent", "Excellent"],
]);

export const BIGGEST_SUCCESS_OPTIONS = opts([
  ["understood_difficult_concept", "Understood a difficult concept"],
  ["participated_actively", "Participated actively"],
  ["worked_independently", "Worked independently"],
  ["improved_accuracy", "Improved accuracy"],
  ["gained_confidence", "Gained confidence"],
  ["completed_lesson", "Completed planned lesson"],
  ["applied_concept_successfully", "Applied concept successfully"],
  ["other", "Other"],
]);

export const BIGGEST_CHALLENGE_OPTIONS = opts([
  ["distraction", "Student distraction"],
  ["low_energy", "Low energy"],
  ["low_confidence", "Low confidence"],
  ["missing_prerequisite", "Missing prerequisite knowledge"],
  ["concept_too_difficult", "Concept too difficult"],
  ["activity_didnt_work", "Activity did not work"],
  ["time_constraints", "Time constraints"],
  ["behavioral_issue", "Behavioral issue"],
  ["plan_changed", "Volunteer needed to change plan"],
  ["other", "Other"],
]);
