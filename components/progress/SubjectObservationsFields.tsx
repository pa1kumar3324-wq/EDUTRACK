"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScaleSelect } from "@/components/progress/ScaleSelect";
import type { SubjectSessionObservations } from "@/lib/types/sessionObservations";
import {
  UNDERSTANDING_OPTIONS,
  DIFFICULTY_OPTIONS,
  INDEPENDENCE_OPTIONS,
  ACCURACY_OPTIONS,
  EXPLAIN_ABILITY_OPTIONS,
  APPLY_ABILITY_OPTIONS,
  LESSON_EXECUTION_OPTIONS,
  LESSON_OBJECTIVE_OPTIONS,
  OBJECTIVE_BLOCKER_OPTIONS,
  TIME_AVAILABILITY_OPTIONS,
  ACTIVITIES_COMPLETED_OPTIONS,
  LESSON_CHANGES_OPTIONS,
  TEACHING_APPROACH_OPTIONS,
  ACTIVITY_TYPE_OPTIONS,
  EXPLANATION_EFFECTIVENESS_OPTIONS,
  PROGRESS_VS_PREVIOUS_OPTIONS,
  REVISION_NEED_OPTIONS,
  CONFIDENCE_OPTIONS,
} from "@/components/progress/sessionObservationOptions";

type Patch = Partial<SubjectSessionObservations>;

export function SubjectObservationsFields({
  subjectId,
  value,
  onChange,
}: {
  subjectId: "english" | "math";
  value: SubjectSessionObservations;
  onChange: (patch: Patch) => void;
}) {
  const id = (suffix: string) => `${subjectId}-${suffix}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Learning observations */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScaleSelect
          id={id("prior-understanding")}
          label="Prior understanding"
          options={UNDERSTANDING_OPTIONS}
          value={value.priorUnderstanding}
          onChange={(v) => onChange({ priorUnderstanding: v as SubjectSessionObservations["priorUnderstanding"] })}
        />
        <ScaleSelect
          id={id("current-understanding")}
          label="Current understanding"
          options={UNDERSTANDING_OPTIONS}
          value={value.currentUnderstanding}
          onChange={(v) => onChange({ currentUnderstanding: v as SubjectSessionObservations["currentUnderstanding"] })}
        />
      </div>

      {/* Conditional: understanding not_understood -> cause */}
      {value.currentUnderstanding === "not_understood" && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-2.5">
          <Label htmlFor={id("difficulty-cause")} className="text-xs">
            What seemed to cause the difficulty?
          </Label>
          <Textarea
            id={id("difficulty-cause")}
            className="min-h-16"
            placeholder="e.g. missing prerequisite, unclear explanation, distraction..."
            value={value.difficultyCause ?? ""}
            onChange={(e) => onChange({ difficultyCause: e.target.value })}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScaleSelect
          id={id("difficulty")}
          label="Difficulty of material"
          options={DIFFICULTY_OPTIONS}
          value={value.difficulty}
          onChange={(v) => onChange({ difficulty: v as SubjectSessionObservations["difficulty"] })}
        />
        <ScaleSelect
          id={id("independence")}
          label="Independence"
          options={INDEPENDENCE_OPTIONS}
          value={value.independence}
          onChange={(v) => onChange({ independence: v as SubjectSessionObservations["independence"] })}
        />
        <ScaleSelect
          id={id("accuracy")}
          label="Accuracy"
          options={ACCURACY_OPTIONS}
          value={value.accuracy}
          onChange={(v) => onChange({ accuracy: v as SubjectSessionObservations["accuracy"] })}
        />
        <ScaleSelect
          id={id("explain-ability")}
          label="Could explain the concept"
          options={EXPLAIN_ABILITY_OPTIONS}
          value={value.explainAbility}
          onChange={(v) => onChange({ explainAbility: v as SubjectSessionObservations["explainAbility"] })}
        />
        <ScaleSelect
          id={id("apply-ability")}
          label="Could apply the concept"
          options={APPLY_ABILITY_OPTIONS}
          value={value.applyAbility}
          onChange={(v) => onChange({ applyAbility: v as SubjectSessionObservations["applyAbility"] })}
        />
      </div>

      {/* Lesson execution */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScaleSelect
          id={id("lesson-execution")}
          label="Lesson execution"
          options={LESSON_EXECUTION_OPTIONS}
          value={value.lessonExecution}
          onChange={(v) => onChange({ lessonExecution: v as SubjectSessionObservations["lessonExecution"] })}
        />
        <ScaleSelect
          id={id("lesson-objective")}
          label="Lesson objective"
          options={LESSON_OBJECTIVE_OPTIONS}
          value={value.lessonObjective}
          onChange={(v) => onChange({ lessonObjective: v as SubjectSessionObservations["lessonObjective"] })}
        />
      </div>

      {/* Conditional: objective not achieved -> blocker */}
      {value.lessonObjective === "not_achieved" && (
        <div className="rounded-lg border border-dashed border-border p-2.5">
          <ScaleSelect
            id={id("objective-blocker")}
            label="What prevented the objective from being achieved?"
            options={OBJECTIVE_BLOCKER_OPTIONS}
            value={value.objectiveBlocker}
            onChange={(v) => onChange({ objectiveBlocker: v as SubjectSessionObservations["objectiveBlocker"] })}
          />
        </div>
      )}

      {/* Conditional: partially completed -> what remained */}
      {value.lessonExecution === "partially_completed" && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-2.5">
          <Label htmlFor={id("incomplete-reason")} className="text-xs">
            What remained incomplete?
          </Label>
          <Textarea
            id={id("incomplete-reason")}
            className="min-h-16"
            value={value.incompleteReason ?? ""}
            onChange={(e) => onChange({ incompleteReason: e.target.value })}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScaleSelect
          id={id("time-availability")}
          label="Time availability"
          options={TIME_AVAILABILITY_OPTIONS}
          value={value.timeAvailability}
          onChange={(v) => onChange({ timeAvailability: v as SubjectSessionObservations["timeAvailability"] })}
        />
        <ScaleSelect
          id={id("activities-completed")}
          label="Planned activities completed"
          options={ACTIVITIES_COMPLETED_OPTIONS}
          value={value.activitiesCompleted}
          onChange={(v) => onChange({ activitiesCompleted: v as SubjectSessionObservations["activitiesCompleted"] })}
        />
        <ScaleSelect
          id={id("lesson-changes")}
          label="Lesson changes made"
          options={LESSON_CHANGES_OPTIONS}
          value={value.lessonChanges}
          onChange={(v) => onChange({ lessonChanges: v as SubjectSessionObservations["lessonChanges"] })}
        />
      </div>

      {/* Teaching observations */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScaleSelect
          id={id("teaching-approach")}
          label="Teaching approach"
          options={TEACHING_APPROACH_OPTIONS}
          value={value.teachingApproach}
          onChange={(v) => onChange({ teachingApproach: v as SubjectSessionObservations["teachingApproach"] })}
        />
        <ScaleSelect
          id={id("activity-type")}
          label="Activity type"
          options={ACTIVITY_TYPE_OPTIONS}
          value={value.activityType}
          onChange={(v) => onChange({ activityType: v as SubjectSessionObservations["activityType"] })}
        />
        <ScaleSelect
          id={id("explanation-effectiveness")}
          label="Explanation effectiveness"
          options={EXPLANATION_EFFECTIVENESS_OPTIONS}
          value={value.explanationEffectiveness}
          onChange={(v) => onChange({ explanationEffectiveness: v as SubjectSessionObservations["explanationEffectiveness"] })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("what-worked")} className="text-xs text-muted-foreground">
            What worked (optional)
          </Label>
          <Textarea id={id("what-worked")} className="min-h-16" value={value.whatWorked ?? ""} onChange={(e) => onChange({ whatWorked: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("what-didnt-work")} className="text-xs text-muted-foreground">
            What didn't work (optional)
          </Label>
          <Textarea
            id={id("what-didnt-work")}
            className="min-h-16"
            value={value.whatDidntWork ?? ""}
            onChange={(e) => onChange({ whatDidntWork: e.target.value })}
          />
        </div>
      </div>

      {/* Outcome */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScaleSelect
          id={id("progress-vs-previous")}
          label="Progress vs. previous session"
          options={PROGRESS_VS_PREVIOUS_OPTIONS}
          value={value.progressVsPrevious}
          onChange={(v) => onChange({ progressVsPrevious: v as SubjectSessionObservations["progressVsPrevious"] })}
        />
        <ScaleSelect
          id={id("revision-need")}
          label="Revision requirement"
          options={REVISION_NEED_OPTIONS}
          value={value.revisionNeed}
          onChange={(v) => onChange({ revisionNeed: v as SubjectSessionObservations["revisionNeed"] })}
        />
        <ScaleSelect
          id={id("confidence-moving-forward")}
          label="Confidence moving forward"
          options={CONFIDENCE_OPTIONS}
          value={value.confidenceMovingForward}
          onChange={(v) => onChange({ confidenceMovingForward: v as SubjectSessionObservations["confidenceMovingForward"] })}
        />
      </div>

      {/* Conditional: definitely needs revision -> which area */}
      {value.revisionNeed === "definitely" && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-2.5">
          <Label htmlFor={id("revision-area")} className="text-xs">
            Which area needs revision?
          </Label>
          <Textarea id={id("revision-area")} className="min-h-16" value={value.revisionArea ?? ""} onChange={(e) => onChange({ revisionArea: e.target.value })} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id("recommended-focus")} className="text-xs text-muted-foreground">
          Recommended focus for next session (optional)
        </Label>
        <Textarea
          id={id("recommended-focus")}
          className="min-h-16"
          value={value.recommendedFocusNext ?? ""}
          onChange={(e) => onChange({ recommendedFocusNext: e.target.value })}
        />
      </div>
    </div>
  );
}
