"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScaleSelect } from "@/components/progress/ScaleSelect";
import type { SessionObservations } from "@/lib/types/sessionObservations";
import {
  MOOD_OPTIONS,
  ENERGY_OPTIONS,
  ATTENTION_OPTIONS,
  DISTRACTION_SOURCE_OPTIONS,
  PARTICIPATION_OPTIONS,
  CONFIDENCE_OPTIONS,
} from "@/components/progress/sessionObservationOptions";

type Patch = Partial<SessionObservations>;

export function StudentStateFields({ value, onChange }: { value: SessionObservations; onChange: (patch: Patch) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScaleSelect
          id="mood"
          label="Mood"
          options={MOOD_OPTIONS}
          value={value.mood}
          onChange={(v) => onChange({ mood: v as SessionObservations["mood"] })}
        />
        <ScaleSelect
          id="energy"
          label="Energy"
          options={ENERGY_OPTIONS}
          value={value.energy}
          onChange={(v) => onChange({ energy: v as SessionObservations["energy"] })}
        />
        <ScaleSelect
          id="attention"
          label="Attention"
          options={ATTENTION_OPTIONS}
          value={value.attention}
          onChange={(v) => onChange({ attention: v as SessionObservations["attention"] })}
        />
        <ScaleSelect
          id="participation"
          label="Participation"
          options={PARTICIPATION_OPTIONS}
          value={value.participation}
          onChange={(v) => onChange({ participation: v as SessionObservations["participation"] })}
        />
        <ScaleSelect
          id="confidence"
          label="Confidence"
          options={CONFIDENCE_OPTIONS}
          value={value.confidence}
          onChange={(v) => onChange({ confidence: v as SessionObservations["confidence"] })}
        />
      </div>

      {/* Conditional: frequently distracted -> source */}
      {value.attention === "frequently_distracted" && (
        <div className="rounded-lg border border-dashed border-border p-2.5">
          <ScaleSelect
            id="distraction-source"
            label="What was the main source of distraction?"
            options={DISTRACTION_SOURCE_OPTIONS}
            value={value.distractionSource}
            onChange={(v) => onChange({ distractionSource: v as SessionObservations["distractionSource"] })}
          />
        </div>
      )}

      {/* Conditional: very low confidence -> cause */}
      {value.confidence === "very_low" && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-2.5">
          <Label htmlFor="confidence-cause" className="text-xs">
            What seemed to affect confidence?
          </Label>
          <Textarea id="confidence-cause" className="min-h-16" value={value.confidenceCause ?? ""} onChange={(e) => onChange({ confidenceCause: e.target.value })} />
        </div>
      )}
    </div>
  );
}
