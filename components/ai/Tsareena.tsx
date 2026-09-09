"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useTsareenaStore } from "@/store/useTsareenaStore";
import { useGeminiKey } from "@/components/ai/useGeminiKey";
import { TsareenaAvatar } from "@/components/ai/TsareenaAvatar";
import { TsareenaGreeting } from "@/components/ai/TsareenaGreeting";
import {
  buildTsareenaGeminiContext,
  sanitizeMessageForGemini,
  collectIdentifyingStrings,
} from "@/components/ai/TsareenaContext";
import { buildContextBlock } from "@/components/ai/TsareenaPrompt";
import { sendTsareenaMessage, GeminiRequestError, type GeminiTurn } from "@/components/ai/geminiClient";
import { LOGIN_GREETINGS, EVENT_COMMENTS, randomFrom, PROFILE_QUICK_PROMPTS, GENERAL_QUICK_PROMPTS, NO_KEY_DECLINE_LINE } from "@/components/ai/tsareenaContent";
import { cn } from "@/lib/utils";

// Lazy-loaded so the assistant's bundle/SDK never ships on the initial
// route load (§30) — it only loads once the volunteer actually opens it,
// or the greeting/launcher first need to render (launcher itself is tiny
// and stays eager; only the heavier panel is deferred).
const TsareenaPanel = dynamic(() => import("@/components/ai/TsareenaPanel").then((m) => m.TsareenaPanel), {
  ssr: false,
});

const GREETING_SESSION_KEY = "tsareena_greeted";

// Matches /students/<id> and any sub-page of it (e.g. /students/<id>/update)
// — every one of those pages is authorized for, and about, that one
// student, so they all share that student's security context.
const STUDENT_ROUTE_PATTERN = /^\/students\/([^/]+)/;

export function Tsareena({ userId }: { userId: string }) {
  const store = useTsareenaStore();
  // Namespaces the BYOK key to the currently authenticated volunteer (see
  // useGeminiKey.ts) so a different volunteer signing into the same
  // browser tab never inherits this one's Gemini key. `userId` comes from
  // the server-rendered dashboard layout (lib/auth.ts's requireUser) —
  // it's only ever used here as a local storage namespace, never sent
  // anywhere.
  const geminiKey = useGeminiKey(userId);
  const pathname = usePathname();
  const [greeting, setGreeting] = useState<string | null>(null);
  const [comment, setComment] = useState<string | null>(null);

  // Tsareena itself lives in the dashboard layout and never unmounts
  // across in-app navigation, so the URL is a synchronous, always-current
  // signal of which security context the volunteer is in — unlike
  // TsareenaFocusRegistrar, which only mounts on pages that happen to
  // fetch student display data, with a real async gap around it (see
  // store/useTsareenaStore.ts). Every route change re-evaluates this and
  // setSecurityContext decides for itself whether that's actually a
  // boundary crossing (a genuinely different student, or general<->
  // student), which is what actually clears the conversation.
  useEffect(() => {
    const studentMatch = pathname.match(STUDENT_ROUTE_PATTERN);
    store.setSecurityContext(studentMatch ? { kind: "student", studentId: studentMatch[1] ?? "" } : { kind: "general" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Login greeting: shown at most once per browser tab session, tied to a
  // fresh app load rather than every internal route change (this component
  // mounts once, high in the tree, and this effect only runs on that
  // mount).
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(GREETING_SESSION_KEY)) {
        setGreeting(randomFrom(LOGIN_GREETINGS));
        sessionStorage.setItem(GREETING_SESSION_KEY, "1");
      }
    } catch {
      // sessionStorage unavailable — simply skip the greeting rather than
      // risk showing it on every render.
    }
  }, []);

  // Occasional contextual comments (§13), driven by other components
  // calling useTsareenaStore.getState().notifyEvent(type) after a
  // meaningful action (e.g. ProgressForm after a successful submit).
  const pendingEvent = store.pendingEvent;
  useEffect(() => {
    if (!pendingEvent) return;
    const pool = EVENT_COMMENTS[pendingEvent.type];
    if (pool && pool.length) {
      setComment(randomFrom(pool));
      store.recordComment();
    }
    store.clearPendingEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEvent]);

  // Escape closes the panel (desktop panel isn't a Radix Dialog, so this
  // isn't automatic for it the way it is for the mobile Sheet).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && store.isOpen) store.close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store.isOpen, store]);

  const handleSend = useCallback(
    async (rawText: string) => {
      // Snapshot which security context this request is FOR. If the
      // volunteer navigates to a different student (or to/from general)
      // before Gemini replies, setSecurityContext will have bumped this,
      // and we use that to recognize — after the await below — that the
      // reply we get back belongs to a conversation that no longer exists.
      const requestGeneration = useTsareenaStore.getState().contextGeneration;
      const focus = useTsareenaStore.getState().focusContext;
      const identifiers = focus ? collectIdentifyingStrings(focus) : [];
      const sanitizedText = sanitizeMessageForGemini(rawText, identifiers);

      store.addMessage({ id: crypto.randomUUID(), role: "user", text: rawText, createdAt: Date.now() });

      if (geminiKey.status !== "connected" || !geminiKey.apiKey) {
        store.addMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          text: "I can dig deeper into that once you connect Gemini. Open Settings above to add your own API key — completely optional, and it never leaves your browser.",
          createdAt: Date.now(),
        });
        return;
      }

      store.setThinking(true);
      try {
        const context = focus
          ? buildTsareenaGeminiContext(focus, null)
          : buildTsareenaGeminiContext(
              {
                studentName: "",
                studentId: "",
                grade: 0,
                englishTopic: null,
                englishStatus: null,
                mathTopic: null,
                mathStatus: null,
              },
              null
            );
        const contextBlock = buildContextBlock(context);

        // First turn in a fresh conversation carries the context block;
        // subsequent turns are just the sanitized question, so the model
        // still has the earlier context via conversation history.
        const isFirstTurn = store.geminiTurns.length === 0;
        const turnText = isFirstTurn ? `${contextBlock}\n\nCURRENT QUESTION\n${sanitizedText}` : sanitizedText;

        const newTurn: GeminiTurn = { role: "user", text: turnText };
        const turns: GeminiTurn[] = [...store.geminiTurns, newTurn];

        const reply = await sendTsareenaMessage(geminiKey.apiKey, turns);

        // The volunteer may have switched security contexts while this
        // request was in flight (e.g. Student A -> Student B). If so,
        // contextGeneration has already moved past requestGeneration, and
        // committing this reply now would splice Student A's turn and
        // Gemini's reply into Student B's — now-active — conversation.
        // Drop it silently; it belongs to a conversation that no longer
        // exists.
        if (useTsareenaStore.getState().contextGeneration !== requestGeneration) return;

        store.addGeminiTurn(newTurn);
        store.addGeminiTurn({ role: "model", text: reply });
        store.addMessage({ id: crypto.randomUUID(), role: "assistant", text: reply, createdAt: Date.now() });
        store.setAvatarState("happy");
      } catch (error) {
        if (useTsareenaStore.getState().contextGeneration !== requestGeneration) return;
        const message = error instanceof GeminiRequestError ? error.message : "Something went wrong talking to Gemini.";
        store.addMessage({ id: crypto.randomUUID(), role: "assistant", text: message, createdAt: Date.now(), isError: true });
        store.setAvatarState("error");
      } finally {
        // Only touch the thinking/avatar indicators if they still belong
        // to the active context — otherwise a stale request finishing
        // late could flip off (or flicker) the indicator for a genuinely
        // new, still-in-flight request under the new context.
        // setSecurityContext already reset isThinking synchronously when
        // the boundary was crossed, so there's nothing stale to clean up.
        if (useTsareenaStore.getState().contextGeneration === requestGeneration) {
          store.setThinking(false);
          setTimeout(() => store.setAvatarState("idle"), 2500);
        }
      }
    },
    [store, geminiKey]
  );

  const quickPrompts = store.focusContext ? PROFILE_QUICK_PROMPTS : GENERAL_QUICK_PROMPTS;

  return (
    <>
      {/* Launcher */}
      <div
        className={cn(
          "fixed z-40 flex flex-col items-end gap-2",
          "bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-[calc(1.25rem+env(safe-area-inset-right))]"
        )}
      >
        {greeting && !store.isOpen && (
          <div className="relative">
            <TsareenaGreeting text={greeting} onDismiss={() => setGreeting(null)} />
          </div>
        )}
        {comment && !store.isOpen && !greeting && (
          <div className="relative">
            <TsareenaGreeting text={comment} onDismiss={() => setComment(null)} />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setGreeting(null);
            setComment(null);
            store.toggle();
          }}
          aria-label={store.isOpen ? "Close Tsareena assistant" : "Open Tsareena assistant"}
          title="Tsareena"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-soft-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 md:h-14 md:w-14"
        >
          <TsareenaAvatar size={32} state={store.isOpen ? "curious" : store.avatarState} />
        </button>
      </div>

      <TsareenaPanel
        open={store.isOpen}
        onOpenChange={(open) => (open ? store.open() : store.close())}
        messages={store.messages}
        isThinking={store.isThinking}
        quickPrompts={store.messages.length === 0 ? quickPrompts : []}
        onSend={handleSend}
        onClear={() => store.clearConversation()}
        status={geminiKey.status}
        keyValue={geminiKey.apiKey}
        onConnect={geminiKey.connect}
        onForget={geminiKey.forget}
        onMaybeLater={() => {
          store.addMessage({ id: crypto.randomUUID(), role: "assistant", text: NO_KEY_DECLINE_LINE, createdAt: Date.now() });
        }}
      />
    </>
  );
}
