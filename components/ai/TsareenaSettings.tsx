"use client";

import { TsareenaKeySetup } from "@/components/ai/TsareenaKeySetup";
import type { GeminiConnectionStatus } from "@/components/ai/useGeminiKey";

export function TsareenaSettings({
  status,
  currentKeyMasked,
  onConnect,
  onForget,
}: {
  status: GeminiConnectionStatus;
  currentKeyMasked: string | null;
  onConnect: (key: string) => void;
  onForget: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="text-sm font-medium">Gemini connection</p>
        <p className="text-xs text-muted-foreground">Tsareena's advanced brain, powered by your own Gemini key.</p>
      </div>
      <TsareenaKeySetup status={status} currentKeyMasked={currentKeyMasked} onConnect={onConnect} onForget={onForget} compact />
    </div>
  );
}
