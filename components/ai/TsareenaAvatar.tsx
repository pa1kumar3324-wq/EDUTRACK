"use client";

import { cn } from "@/lib/utils";
import type { TsareenaAvatarState } from "@/store/useTsareenaStore";

/**
 * Tsareena's original mascot: a small, rounded, expressive AI creature —
 * not based on any existing copyrighted character. Built entirely from
 * primitive SVG shapes using the app's own design tokens (primary/accent
 * CSS variables) so it themes correctly in light and dark mode.
 *
 * VISUAL REFRESH: softened into a cuter, more clearly girl-coded look —
 * a little top-knot bow, wispy "bangs" framing the face, bigger eyes with
 * a lash flick, a permanent soft blush (not just on the happy states),
 * and gentler, rounder mouth shapes. This is a styling-only pass: every
 * state below still maps 1:1 to the same TsareenaAvatarState values the
 * rest of the app drives (idle/happy/thinking/curious/excited/confused/
 * celebrating/error), so nothing about when or why a state is shown
 * changed — only how each one is drawn.
 *
 * Visual states are expressed through eye shape/position and a couple of
 * small accent details (the bow, cheek blush) rather than a fully
 * different drawing per state, which keeps this file small and the
 * character instantly recognizable across states. All motion uses
 * Tailwind `animate-*` utilities, which app/globals.css already
 * neutralizes under prefers-reduced-motion — no extra handling needed
 * here.
 */
export function TsareenaAvatar({
  state = "idle",
  size = 40,
  className,
}: {
  state?: TsareenaAvatarState;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width={size} height={size} className={cn(state === "idle" && "animate-float")}>
        {/* antenna, topped with a small bow instead of a plain dot */}
        <line x1="32" y1="7" x2="32" y2="15" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
        <g className={cn(state === "thinking" || state === "curious" ? "animate-pulse" : "")}>
          <path d="M32 6.5 25.5 3.2c-1-.5-2 .6-1.4 1.6L26 8l-1.9 3.2c-.6 1 .4 2.1 1.4 1.6L32 9.5Z" fill="hsl(var(--accent))" />
          <path d="M32 6.5 38.5 3.2c1-.5 2 .6 1.4 1.6L38 8l1.9 3.2c.6 1-.4 2.1-1.4 1.6L32 9.5Z" fill="hsl(var(--accent))" />
          <circle cx="32" cy="6.5" r="1.9" fill="hsl(var(--accent))" stroke="hsl(var(--card))" strokeWidth="0.6" />
        </g>

        {/* body (rounded, slightly wider-hipped blob for a softer silhouette) */}
        <path
          d="M32 13c13.5 0 20.5 9.5 20.5 21.5S45 54 32 54s-20.5-7.5-20.5-19.5S18.5 13 32 13Z"
          fill="hsl(var(--primary) / 0.14)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
        />

        {/* wispy bangs framing the face — the main feminine silhouette cue */}
        <path
          d="M14.5 27c-.6-4.4 2-8.4 6-9.6-2 2-2.8 4.6-2.4 7.6Z"
          fill="hsl(var(--primary) / 0.5)"
        />
        <path
          d="M49.5 27c.6-4.4-2-8.4-6-9.6 2 2 2.8 4.6 2.4 7.6Z"
          fill="hsl(var(--primary) / 0.5)"
        />
        <path
          d="M24 15.5c2.6-1.6 5.4-2.2 8-2.2s5.4.6 8 2.2c-2.6 1-5.3 1.5-8 1.5s-5.4-.5-8-1.5Z"
          fill="hsl(var(--primary) / 0.5)"
        />

        {/* blush — always present, softly, for a cute default expression;
            deeper for the brighter emotional states */}
        <circle
          cx="17.5"
          cy="39"
          r="3.4"
          fill={`hsl(var(--accent) / ${blushOpacity(state)})`}
        />
        <circle
          cx="46.5"
          cy="39"
          r="3.4"
          fill={`hsl(var(--accent) / ${blushOpacity(state)})`}
        />

        {/* eyes (with a small lash flick) */}
        <EyeShapes state={state} />

        {/* mouth */}
        <MouthShape state={state} />

        {/* celebrating sparkles */}
        {state === "celebrating" && (
          <g className="animate-pulse">
            <path d="M10 20l1.4 3.2L14.5 24.5 11.4 25.8 10 29l-1.4-3.2L5.5 24.5l3.1-1.3Z" fill="hsl(var(--warning))" />
            <path d="M54 16l1 2.3L57.3 19.5 55 20.5 54 23l-1-2.5-2.3-1L53 18.3Z" fill="hsl(var(--warning))" />
          </g>
        )}

        {/* error tilt indicator */}
        {state === "error" && <path d="M22 23l6 6M28 23l-6 6" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" />}
      </svg>
    </div>
  );
}

/** Blush opacity: a soft baseline for every state, deeper for the brighter emotional ones. */
function blushOpacity(state: TsareenaAvatarState): number {
  return state === "happy" || state === "celebrating" || state === "excited" ? 0.65 : 0.4;
}

/** Small lash flick reused in the top-right of each round eye for a softer, more feminine look. */
function Lash({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M${cx + 2.6} ${cy - 3.4}q1.6-1.4 3-0.6`}
      stroke="hsl(var(--primary))"
      strokeWidth="1.3"
      fill="none"
      strokeLinecap="round"
    />
  );
}

function EyeShapes({ state }: { state: TsareenaAvatarState }) {
  switch (state) {
    case "thinking":
      return (
        <>
          <line x1="20.5" y1="35" x2="27.5" y2="35" stroke="hsl(var(--primary))" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="43.5" cy="35" r="3.8" fill="hsl(var(--primary))" />
          <Lash cx={43.5} cy={35} />
        </>
      );
    case "curious":
      return (
        <>
          <circle cx="23.5" cy="33" r="4" fill="hsl(var(--primary))" />
          <circle cx="43.5" cy="36" r="4.3" fill="hsl(var(--primary))" />
          <Lash cx={23.5} cy={33} />
          <Lash cx={43.5} cy={36} />
        </>
      );
    case "confused":
      return (
        <>
          <circle cx="23.5" cy="36" r="3.8" fill="hsl(var(--primary))" />
          <circle cx="42.5" cy="33" r="3.8" fill="hsl(var(--primary))" />
          <Lash cx={23.5} cy={36} />
          <Lash cx={42.5} cy={33} />
        </>
      );
    case "excited":
    case "celebrating":
      return (
        <>
          <path d="M19.5 33c1.8-2.4 6-2.4 7.8 0" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M36.7 33c1.8-2.4 6-2.4 7.8 0" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      );
    case "error":
      return (
        <>
          <circle cx="23.5" cy="35" r="3.5" fill="hsl(var(--muted-foreground))" />
          <circle cx="42.5" cy="35" r="3.5" fill="hsl(var(--muted-foreground))" />
        </>
      );
    case "happy":
      return (
        <>
          <path d="M19.5 34c2-2.6 6.4-2.6 8.4 0" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M37 34c2-2.6 6.4-2.6 8.4 0" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      );
    case "idle":
    default:
      return (
        <>
          <circle cx="23.5" cy="35" r="4" fill="hsl(var(--primary))" />
          <circle cx="42.5" cy="35" r="4" fill="hsl(var(--primary))" />
          <Lash cx={23.5} cy={35} />
          <Lash cx={42.5} cy={35} />
        </>
      );
  }
}

function MouthShape({ state }: { state: TsareenaAvatarState }) {
  switch (state) {
    case "happy":
    case "celebrating":
      return <path d="M22.5 44.5c3.8 4.2 15.2 4.2 19 0" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
    case "excited":
      return <ellipse cx="32" cy="45.5" rx="5.5" ry="4.6" fill="hsl(var(--primary))" />;
    case "confused":
      return <path d="M25 45.5q7-4 14 0" stroke="hsl(var(--primary))" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
    case "error":
      return <path d="M25 46.5q7-3 14 0" stroke="hsl(var(--muted-foreground))" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
    case "thinking":
    case "curious":
      return <circle cx="32" cy="45.5" r="2.1" fill="hsl(var(--primary))" />;
    case "idle":
    default:
      return <path d="M25.5 44.5q6.5 3.4 13 0" stroke="hsl(var(--primary))" strokeWidth="2.3" fill="none" strokeLinecap="round" />;
  }
}
