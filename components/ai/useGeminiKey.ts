"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Owns the volunteer's personal Gemini API key.
 *
 * SECURITY (§16 of the Tsareena spec): the key lives ONLY here — in React
 * state, and optionally mirrored into sessionStorage so it survives a
 * reload within the same tab session. It is never:
 *  - sent to any EduTrack API route or Supabase,
 *  - written to localStorage (no indefinite persistence by default),
 *  - put into the shared Zustand store (store/useAppStore.ts) — that store
 *    is broader-scoped and this key has no reason to be there,
 *  - logged, or included in any error message.
 *
 * MULTI-USER ISOLATION: the sessionStorage entry is namespaced by the
 * currently authenticated volunteer's id (`userId`, passed in by the
 * caller — see Tsareena.tsx, which gets it from the server-rendered
 * dashboard layout). Previously this used one fixed storage key for every
 * volunteer, so if Volunteer A signed in, connected their key, signed out,
 * and Volunteer B signed into the *same browser tab* afterwards, B would
 * silently inherit A's key on next render — sessionStorage isn't cleared
 * by EduTrack's own sign-out, so the old fixed key was still sitting
 * there. Namespacing the storage key by userId closes that: B's lookup
 * uses a different storage key than A's, so B never sees A's key, and if
 * `userId` is ever unknown (still loading / signed out) no key is
 * restored at all rather than falling back to a shared slot.
 *
 * Kept as its own hook (rather than folded into a bigger Tsareena state
 * hook) specifically so the key's lifecycle is easy to audit in one place.
 */
const SESSION_STORAGE_PREFIX = "tsareena_gemini_key:";

// Old, pre-isolation storage key. Only ever read here, and only to remove
// it — a leftover from before keys were namespaced per user, which must
// not go on being usable as an accidental cross-user fallback.
const LEGACY_UNNAMESPACED_KEY = "tsareena_gemini_key";

function storageKeyFor(userId: string): string {
  return `${SESSION_STORAGE_PREFIX}${userId}`;
}

export type GeminiConnectionStatus = "not_connected" | "connecting" | "connected" | "error";

/**
 * @param userId The currently authenticated volunteer's id. The key this
 * hook manages is scoped to this id, so different volunteers signed into
 * the same browser tab (one after another) never see each other's key.
 * Pass `null` while the authenticated user is unknown (e.g. still
 * resolving) — in that state no key is loaded or persisted.
 */
export function useGeminiKey(userId: string | null) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [status, setStatus] = useState<GeminiConnectionStatus>("not_connected");
  const [lastError, setLastError] = useState<string | null>(null);

  // Restore from sessionStorage whenever the authenticated user changes
  // (including on mount). Re-running this per userId — rather than only
  // on mount — is what makes a same-tab account switch (A signs out, B
  // signs in without a full page reload) land on B's own key/state
  // instead of continuing to show A's.
  useEffect(() => {
    // Always drop the legacy, pre-isolation entry so it can never be
    // read as a cross-user fallback by an older code path or a stale tab.
    try {
      sessionStorage.removeItem(LEGACY_UNNAMESPACED_KEY);
    } catch {
      // Storage unavailable — nothing to clean up.
    }

    if (!userId) {
      setApiKeyState(null);
      setStatus("not_connected");
      setLastError(null);
      return;
    }

    try {
      const stored = sessionStorage.getItem(storageKeyFor(userId));
      if (stored) {
        setApiKeyState(stored);
        setStatus("connected");
      } else {
        // No key for this user — do NOT carry over whatever the
        // previously-rendered user's in-memory state was.
        setApiKeyState(null);
        setStatus("not_connected");
      }
      setLastError(null);
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — key setup
      // still works for the current in-memory session, it just won't
      // survive a reload. Never surface this as an error to the user.
      setApiKeyState(null);
      setStatus("not_connected");
    }
  }, [userId]);

  const connect = useCallback(
    (key: string) => {
      setApiKeyState(key);
      setStatus("connected");
      setLastError(null);
      if (!userId) return; // Nothing to persist against — in-memory only.
      try {
        sessionStorage.setItem(storageKeyFor(userId), key);
      } catch {
        // Storage unavailable — key still works for this in-memory session.
      }
    },
    [userId]
  );

  const setConnecting = useCallback(() => {
    setStatus("connecting");
    setLastError(null);
  }, []);

  const setError = useCallback((message: string) => {
    setStatus("error");
    setLastError(message);
  }, []);

  /** "Forget My Key" — immediately clears state and storage for the current user. */
  const forget = useCallback(() => {
    setApiKeyState(null);
    setStatus("not_connected");
    setLastError(null);
    if (!userId) return;
    try {
      sessionStorage.removeItem(storageKeyFor(userId));
    } catch {
      // No-op if storage is unavailable.
    }
  }, [userId]);

  return { apiKey, status, lastError, connect, setConnecting, setError, forget };
}

/** Masks all but the last 4 characters of a key for display — never redisplays the full key. */
export function maskKey(key: string): string {
  const tail = key.slice(-4);
  return `${"•".repeat(Math.max(key.length - 4, 8))}${tail}`;
}
