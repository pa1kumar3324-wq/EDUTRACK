"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateGeminiKey, GeminiRequestError } from "@/components/ai/geminiClient";
import { type GeminiConnectionStatus } from "@/components/ai/useGeminiKey";
import { NO_KEY_PITCH } from "@/components/ai/tsareenaContent";

interface Props {
  status: GeminiConnectionStatus;
  currentKeyMasked: string | null;
  onConnect: (key: string) => void;
  onForget: () => void;
  onMaybeLater?: () => void;
  compact?: boolean;
}

/**
 * The entire flow lives client-side. `onConnect` only ever receives the raw
 * key to hand to useGeminiKey's connect() — it never travels through an
 * EduTrack API route or fetch to our own backend anywhere in this file.
 */
export function TsareenaKeySetup({ status, currentKeyMasked, onConnect, onForget, onMaybeLater, compact }: Props) {
  const [input, setInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(status !== "connected");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setValidating(true);
    try {
      await validateGeminiKey(input.trim());
      onConnect(input.trim());
      setInput("");
      setEditing(false);
    } catch (err) {
      const message = err instanceof GeminiRequestError ? err.message : "Couldn't validate that key. Check it and try again.";
      setError(message);
    } finally {
      setValidating(false);
    }
  }

  if (status === "connected" && !editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <ShieldCheck className="h-4 w-4" /> Gemini — Connected
        </div>
        {currentKeyMasked && <p className="font-mono text-xs text-muted-foreground">{currentKeyMasked}</p>}
        <p className="text-xs text-muted-foreground">
          Your Gemini API key stays on this device and isn't stored by EduTrack.
        </p>
        <div className="flex gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Replace Key
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onForget}>
            Forget Key
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      {!compact && <p className="text-sm text-foreground">{NO_KEY_PITCH}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Label htmlFor="tsareena-gemini-key" className="text-xs text-muted-foreground">
          Gemini API key
        </Label>
        <div className="relative">
          <Input
            id="tsareena-gemini-key"
            type={showKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" size="sm" disabled={validating || !input.trim()}>
            {validating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {status === "connected" ? "Save New Key" : "Add Gemini API Key"}
          </Button>
          {status === "connected" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          {status !== "connected" && onMaybeLater && (
            <Button type="button" size="sm" variant="ghost" onClick={onMaybeLater}>
              Maybe Later
            </Button>
          )}
        </div>
      </form>
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
      >
        Get a Gemini API key <ExternalLink className="h-3 w-3" />
      </a>
      <p className="text-xs text-muted-foreground">
        Your questions are sent directly to Gemini using the key you provide. EduTrack does not store your personal
        Gemini API key. Gemini processes requests under Google's own applicable policies.
      </p>
    </div>
  );
}
