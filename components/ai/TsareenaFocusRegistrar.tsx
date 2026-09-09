"use client";

import { useEffect } from "react";
import { useTsareenaStore } from "@/store/useTsareenaStore";
import type { ClientStudentDisplayContext } from "@/components/ai/TsareenaContext";

/**
 * Mount this (client-side) inside a page that already has authorized
 * access to a specific student's data — currently the student profile page
 * — passing exactly what that page already fetched server-side. Tsareena
 * reads this from the store to (a) tailor its quick prompts and (b) build
 * the sanitized Gemini context (§7) when the volunteer asks a question.
 *
 * This does NOT open any new data-fetching path — it only registers data
 * the Server Component already legitimately loaded via RLS-protected
 * queries. Unmounting (navigating away) clears it, so Tsareena never keeps
 * stale or unrelated-student display data around.
 *
 * IMPORTANT: this only supplies DISPLAY data (§21) — it is not, by itself,
 * what decides whether the conversation survives a navigation. That's
 * `activeSecurityContext` in store/useTsareenaStore.ts, driven off the URL
 * in Tsareena.tsx. This component isn't mounted on every page that
 * belongs to a given student (e.g. "update progress"), so its own
 * mount/unmount can't be trusted as the signal for "the volunteer left
 * this student" — see the store for the full reasoning.
 */
export function TsareenaFocusRegistrar({ context }: { context: ClientStudentDisplayContext }) {
  const setFocusContext = useTsareenaStore((s) => s.setFocusContext);

  useEffect(() => {
    setFocusContext(context);
    return () => setFocusContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.studentId]);

  return null;
}
