"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScaleSelect } from "@/components/progress/ScaleSelect";
import type { SessionObservations } from "@/lib/types/sessionObservations";
import { SESSION_EFFECTIVENESS_OPTIONS, BIGGEST_SUCCESS_OPTIONS, BIGGEST_CHALLENGE_OPTIONS } from "@/components/progress/sessionObservationOptions";

type Patch = Partial<SessionObservations>;

export function SessionQualityFields({ value, onChange }: { value: SessionObservations; onChange: (patch: Patch) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ScaleSelect
        id="overall-effectiveness"
        label="Overall session effectiveness"
        options={SESSION_EFFECTIVENESS_OPTIONS}
        value={value.overallEffectiveness}
        onChange={(v) => onChange({ overallEffectiveness: v as SessionObservations["overallEffectiveness"] })}
      />

      <ScaleSelect
        id="biggest-success"
        label="Biggest success"
        options={BIGGEST_SUCCESS_OPTIONS}
        value={value.biggestSuccess}
        onChange={(v) => onChange({ biggestSuccess: v as SessionObservations["biggestSuccess"] })}
      />
      {value.biggestSuccess === "other" && (
        <Textarea
          aria-label="Describe the biggest success"
          className="min-h-14"
          placeholder="Describe what went especially well..."
          value={value.biggestSuccessOther ?? ""}
          onChange={(e) => onChange({ biggestSuccessOther: e.target.value })}
        />
      )}

      <ScaleSelect
        id="biggest-challenge"
        label="Biggest challenge"
        options={BIGGEST_CHALLENGE_OPTIONS}
        value={value.biggestChallenge}
        onChange={(v) => onChange({ biggestChallenge: v as SessionObservations["biggestChallenge"] })}
      />
      {value.biggestChallenge === "other" && (
        <Textarea
          aria-label="Describe the biggest challenge"
          className="min-h-14"
          placeholder="Describe the main obstacle..."
          value={value.biggestChallengeOther ?? ""}
          onChange={(e) => onChange({ biggestChallengeOther: e.target.value })}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unusual-note" className="text-xs text-muted-foreground">
          Anything important to remember? (optional)
        </Label>
        <Textarea id="unusual-note" className="min-h-16" value={value.unusualNote ?? ""} onChange={(e) => onChange({ unusualNote: e.target.value })} />
      </div>
    </div>
  );
}
