import { create } from "zustand";
import type { GeminiTurn } from "@/components/ai/geminiClient";
import type { ClientStudentDisplayContext } from "@/components/ai/TsareenaContext";

export type TsareenaAvatarState =
  | "idle"
  | "happy"
  | "thinking"
  | "curious"
  | "excited"
  | "confused"
  | "celebrating"
  | "error";

export interface TsareenaUIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  isError?: boolean;
}

interface TsareenaState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  avatarState: TsareenaAvatarState;
  setAvatarState: (state: TsareenaAvatarState) => void;

  // UI-facing messages (may reference the student by name — the UI already
  // legitimately knows it). Kept entirely separate from the Gemini-facing
  // history below, per §9 of the Tsareena spec.
  messages: TsareenaUIMessage[];
  addMessage: (message: TsareenaUIMessage) => void;
  clearConversation: () => void;

  // Gemini-facing history: sanitized turns only, built via
  // sanitizeMessageForGemini() before ever landing here. Never rendered to
  // the user directly — it exists purely to give Gemini short-term memory
  // of the current conversation.
  geminiTurns: GeminiTurn[];
  addGeminiTurn: (turn: GeminiTurn) => void;

  isThinking: boolean;
  setThinking: (thinking: boolean) => void;

  // Rare, throttled contextual comments (§13). lastCommentAt is a plain
  // timestamp (ms) — in-memory is enough since "per session" here means
  // "per app session", i.e. resets on full reload same as the rest of this
  // store.
  lastCommentAt: number | null;
  commentCount: number;
  recordComment: () => void;

  // Page-aware DISPLAY context (§21): the page currently on screen (e.g. a
  // student profile) registers what it already legitimately fetched here,
  // via TsareenaFocusRegistrar. Tsareena reads this to tailor quick prompts
  // and as the input to buildTsareenaGeminiContext() — it never fetches
  // this data itself or opens its own query path.
  //
  // IMPORTANT: this is display data ONLY. It is deliberately NOT the thing
  // that decides whether the conversation gets cleared — see
  // `activeSecurityContext` below for why, and setFocusContext's own
  // comment for what that means in practice.
  focusContext: ClientStudentDisplayContext | null;
  setFocusContext: (context: ClientStudentDisplayContext | null) => void;

  // ── Security-context identity ─────────────────────────────────────────
  // The authoritative answer to "which conversation is this?". A
  // conversation may only survive while the volunteer stays within the
  // same TsareenaSecurityContext; it must be destroyed the instant that
  // context changes (see setSecurityContext). This is intentionally kept
  // separate from `focusContext`/TsareenaFocusRegistrar's mount lifecycle
  // — that registrar isn't mounted on every page that belongs to a given
  // student (e.g. the "update progress" page), and its unmount is
  // separated from the actual navigation by an async server round-trip,
  // so it cannot reliably tell "the volunteer left this student" apart
  // from "this particular page just doesn't register display data".
  // `activeSecurityContext` is instead driven directly off the URL (see
  // Tsareena.tsx), which changes atomically and synchronously with
  // navigation and has no such gap.
  activeSecurityContext: TsareenaSecurityContext;
  setSecurityContext: (next: TsareenaSecurityContext) => void;

  // Bumped every time setSecurityContext actually crosses a boundary (i.e.
  // every time it clears the conversation). Lets in-flight async work
  // (a pending Gemini request) recognize that the context it was answering
  // no longer exists, so a stale reply can never be spliced into whatever
  // conversation is active by the time it resolves — see Tsareena.tsx's
  // handleSend.
  contextGeneration: number;

  /** A rare contextual-comment event waiting to be shown (§13). */
  pendingEvent: { type: string; at: number } | null;
  notifyEvent: (type: string) => void;
  clearPendingEvent: () => void;
}

const MIN_MS_BETWEEN_COMMENTS = 5 * 60 * 1000; // 5 minutes
const MAX_COMMENTS_PER_SESSION = 6;

/**
 * The two — and only two — kinds of conversation identity Tsareena can be
 * in. Deliberately its own explicit type (not derived from
 * ClientStudentDisplayContext) so "what counts as a boundary" is a single,
 * obvious comparison (see sameSecurityContext) rather than something that
 * has to be reverse-engineered from display-data shape.
 */
export type TsareenaSecurityContext = { kind: "general" } | { kind: "student"; studentId: string };

function sameSecurityContext(a: TsareenaSecurityContext, b: TsareenaSecurityContext): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === "student" && b.kind === "student" ? a.studentId === b.studentId : true;
}

export const useTsareenaStore = create<TsareenaState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  avatarState: "idle",
  setAvatarState: (avatarState) => set({ avatarState }),

  messages: [],
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  clearConversation: () => set({ messages: [], geminiTurns: [] }),

  geminiTurns: [],
  addGeminiTurn: (turn) => set((s) => ({ geminiTurns: [...s.geminiTurns, turn] })),

  isThinking: false,
  setThinking: (isThinking) => set({ isThinking }),

  lastCommentAt: null,
  commentCount: 0,
  recordComment: () => set({ lastCommentAt: Date.now(), commentCount: get().commentCount + 1 }),

  focusContext: null,
  // Pure display-data setter. Does NOT touch messages/geminiTurns/isThinking
  // — clearing the conversation is exclusively setSecurityContext's job
  // (see the field comment on activeSecurityContext for why the two are
  // kept apart). TsareenaFocusRegistrar calls this on mount with the
  // page's data and with `null` on unmount; either way, it only ever
  // changes what Tsareena can *display*/send as context, never which
  // conversation is active.
  setFocusContext: (context) => set({ focusContext: context }),

  activeSecurityContext: { kind: "general" },
  contextGeneration: 0,
  // The ONLY place the conversation is cleared for context-isolation
  // reasons. Called from Tsareena.tsx off the current URL (see there for
  // why), every time the URL is (re-)evaluated — including re-navigations
  // to the *same* context, which is why this compares against the
  // previous context rather than clearing unconditionally.
  setSecurityContext: (next) =>
    set((s) => {
      if (sameSecurityContext(s.activeSecurityContext, next)) {
        // Same logical context (general->general, or the same student's
        // id) — nothing crossed a boundary, so the conversation survives.
        // Still write `next` so callers can pass a fresh object each time
        // without needing to memoize it themselves.
        return { activeSecurityContext: next };
      }
      // A security-context boundary was crossed (general<->student, or
      // student A <-> student B). Everything that could carry the
      // previous context's conversation content must go, or it could
      // still reach Gemini (via geminiTurns) or the transcript (via
      // messages) under the new context. `contextGeneration` moves
      // forward so any Gemini request already in flight for the old
      // context can recognize, when it resolves, that it no longer
      // belongs anywhere and must be dropped (see Tsareena.tsx). Reset
      // `isThinking` too, otherwise a request that belonged to the old
      // context (and whose completion is now ignored) would leave the
      // new, unrelated conversation stuck showing a thinking indicator.
      return {
        activeSecurityContext: next,
        contextGeneration: s.contextGeneration + 1,
        messages: [],
        geminiTurns: [],
        isThinking: false,
      };
    }),

  pendingEvent: null,
  notifyEvent: (type) => {
    if (!canShowComment()) return;
    set({ pendingEvent: { type, at: Date.now() } });
  },
  clearPendingEvent: () => set({ pendingEvent: null }),
}));

/** Whether an occasional comment is allowed right now, per the cooldown + session cap. */
export function canShowComment(): boolean {
  const { lastCommentAt, commentCount } = useTsareenaStore.getState();
  if (commentCount >= MAX_COMMENTS_PER_SESSION) return false;
  if (lastCommentAt && Date.now() - lastCommentAt < MIN_MS_BETWEEN_COMMENTS) return false;
  return true;
}
