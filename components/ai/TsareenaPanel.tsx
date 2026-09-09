"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Settings, Trash2, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TsareenaAvatar } from "@/components/ai/TsareenaAvatar";
import { TsareenaMessage, TsareenaThinkingBubble } from "@/components/ai/TsareenaMessage";
import { TsareenaSettings } from "@/components/ai/TsareenaSettings";
import { TsareenaKeySetup } from "@/components/ai/TsareenaKeySetup";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { TsareenaUIMessage } from "@/store/useTsareenaStore";
import type { GeminiConnectionStatus } from "@/components/ai/useGeminiKey";
import { maskKey } from "@/components/ai/useGeminiKey";

interface TsareenaPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: TsareenaUIMessage[];
  isThinking: boolean;
  quickPrompts: string[];
  onSend: (text: string) => void;
  onClear: () => void;
  status: GeminiConnectionStatus;
  keyValue: string | null;
  onConnect: (key: string) => void;
  onForget: () => void;
  onMaybeLater: () => void;
}

function ConnectionBadge({ status }: { status: GeminiConnectionStatus }) {
  const label = status === "connected" ? "Connected" : status === "connecting" ? "Connecting\u2026" : status === "error" ? "Error" : "Not connected";
  const tone =
    status === "connected"
      ? "bg-success/10 text-success"
      : status === "error"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tone)}>{label}</span>;
}

function PanelBody({
  messages,
  isThinking,
  quickPrompts,
  onSend,
  onClear,
  status,
  keyValue,
  onConnect,
  onForget,
  onMaybeLater,
  onClose,
}: Omit<TsareenaPanelProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value) return;
    onSend(value);
    setInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <TsareenaAvatar size={30} state={isThinking ? "thinking" : "idle"} />
          <div>
            <p className="font-display text-sm font-semibold leading-tight">Tsareena</p>
            <ConnectionBadge status={status} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={showSettings ? "Back to chat" : "Settings"}
            onClick={() => setShowSettings((s) => !s)}
          >
            {showSettings ? <ArrowLeft className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
          </Button>
          {!showSettings && messages.length > 0 && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Clear conversation" onClick={onClear}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Close assistant" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showSettings ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TsareenaSettings status={status} currentKeyMasked={keyValue ? maskKey(keyValue) : null} onConnect={onConnect} onForget={onForget} />
        </div>
      ) : (
        <>
          {/* Conversation */}
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {status !== "connected" && messages.length === 0 && (
              <TsareenaKeySetup status={status} currentKeyMasked={null} onConnect={onConnect} onForget={onForget} onMaybeLater={onMaybeLater} />
            )}
            {messages.map((m) => (
              <TsareenaMessage key={m.id} message={m} />
            ))}
            {isThinking && <TsareenaThinkingBubble />}
            {messages.length === 0 && !isThinking && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <TsareenaAvatar size={40} state="curious" />
                <p>Ask me about a student's progress, or pick a quick prompt below.</p>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          {quickPrompts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSend(p)}
                  className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-secondary-foreground transition-colors hover:bg-secondary"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={status === "connected" ? "Ask Tsareena\u2026" : "Connect a Gemini key to chat, or browse quick prompts above"}
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Message Tsareena"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!input.trim() || isThinking} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

export function TsareenaPanel(props: TsareenaPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[88vh] max-h-[88vh] flex-col p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetTitle className="sr-only">Tsareena assistant</SheetTitle>
          <SheetDescription className="sr-only">Chat with Tsareena, EduTrack's optional AI assistant</SheetDescription>
          <PanelBody {...props} onClose={() => props.onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-label="Tsareena assistant"
      className="animate-scale-in fixed bottom-24 right-6 z-40 flex h-[560px] w-[380px] max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg"
    >
      <PanelBody {...props} onClose={() => props.onOpenChange(false)} />
    </div>
  );
}
