"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function TsareenaGreeting({
  text,
  onDismiss,
  className,
}: {
  text: string;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "animate-fade-up pointer-events-auto max-w-[220px] rounded-2xl rounded-br-sm border border-border bg-card px-3.5 py-2.5 text-sm shadow-soft-lg",
        className
      )}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-soft hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
      <p className="text-foreground">{text}</p>
    </div>
  );
}
