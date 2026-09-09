"use client";

import { cn } from "@/lib/utils";
import { TsareenaAvatar } from "@/components/ai/TsareenaAvatar";
import type { TsareenaUIMessage } from "@/store/useTsareenaStore";

export function TsareenaMessage({ message }: { message: TsareenaUIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && <TsareenaAvatar size={24} state={message.isError ? "error" : "idle"} className="mt-0.5" />}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-soft",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : message.isError
              ? "rounded-tl-sm border border-destructive/30 bg-destructive/5 text-foreground"
              : "rounded-tl-sm bg-secondary text-secondary-foreground"
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

/** Subtle "thinking" indicator — never a faked artificial delay, only shown while an actual request is in flight. */
export function TsareenaThinkingBubble({ label = "Let me inspect that... \ud83d\udd0e" }: { label?: string }) {
  return (
    <div className="flex gap-2">
      <TsareenaAvatar size={24} state="thinking" className="mt-0.5" />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground shadow-soft">
        <span>{label}</span>
        <span className="flex gap-0.5">
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
          <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
        </span>
      </div>
    </div>
  );
}
