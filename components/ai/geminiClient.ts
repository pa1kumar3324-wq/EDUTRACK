"use client";

import { GoogleGenAI } from "@google/genai";
import { TSAREENA_SYSTEM_PROMPT } from "@/components/ai/TsareenaPrompt";

/**
 * Every call in this file runs entirely in the browser and talks directly
 * to Google's Gemini API using the volunteer's own personal API key. Never
 * import this file into anything that runs on the server (an API route, a
 * Server Component, etc.) — doing so would recreate exactly the
 * "Volunteer Browser -> EduTrack API -> Gemini" path the Tsareena spec
 * forbids. The key passed into every function here comes from
 * useGeminiKey() and never leaves the client.
 */

export const TSAREENA_MODEL = "gemini-3.6-flash";

export type GeminiTurn = { role: "user" | "model"; text: string };

export class GeminiRequestError extends Error {
  kind: "invalid_key" | "rate_limited" | "network" | "empty_response" | "unknown";
  constructor(kind: GeminiRequestError["kind"], message: string) {
    super(message);
    this.kind = kind;
    this.name = "GeminiRequestError";
  }
}

function classifyError(error: unknown): GeminiRequestError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("api key") || lower.includes("401") || lower.includes("403") || lower.includes("permission")) {
    return new GeminiRequestError("invalid_key", "That key and I just had an awkward handshake. Check the key and try again.");
  }
  if (lower.includes("429") || lower.includes("rate") || lower.includes("quota")) {
    return new GeminiRequestError("rate_limited", "Gemini's a little busy right now (rate limit). Give it a moment and try again.");
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("timeout")) {
    return new GeminiRequestError("network", "Gemini seems to have wandered off for a snack. Try again in a moment.");
  }
  return new GeminiRequestError("unknown", "Gemini isn't cooperating right now. Your EduTrack data is safe. Try again in a moment.");
}

/**
 * Minimal validation request — confirms the key actually works before the
 * UI shows "Connected". Runs directly from the browser, never through
 * EduTrack. Throws GeminiRequestError on any failure.
 */
export async function validateGeminiKey(apiKey: string): Promise<void> {
  if (!apiKey.trim()) throw new GeminiRequestError("invalid_key", "Please enter a Gemini API key.");
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TSAREENA_MODEL,
      contents: "Reply with the single word: ready",
      // 10 was too tight — gemini-3.6-flash can spend a few tokens on
      // leading formatting before the actual word, which hit MAX_TOKENS
      // and came back with empty content, failing validation on a valid key.
      config: { maxOutputTokens: 40 },
    });
    const finishReason = response.candidates?.[0]?.finishReason;
    if (typeof response.text !== "string" || !response.text.trim()) {
      if (finishReason === "MAX_TOKENS") {
        throw new GeminiRequestError(
          "unknown",
          "Gemini's key check got cut off before it could reply. Try again — if it keeps happening, the key may still be fine.",
        );
      }
      throw new GeminiRequestError("empty_response", "Gemini gave an empty response during validation.");
    }
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    throw classifyError(error);
  }
}

/**
 * Sends a sanitized, name-free conversation (system prompt + context block
 * baked into the first user turn by the caller, plus prior sanitized
 * turns) directly to Gemini from the browser. Never called with raw,
 * unsanitized volunteer text — see components/ai/TsareenaContext.ts.
 */
export async function sendTsareenaMessage(apiKey: string, turns: GeminiTurn[]): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TSAREENA_MODEL,
      contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      config: {
        systemInstruction: TSAREENA_SYSTEM_PROMPT,
        maxOutputTokens: 700,
      },
    });
    const text = response.text;
    if (typeof text !== "string" || !text.trim()) {
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === "MAX_TOKENS") {
        throw new GeminiRequestError(
          "empty_response",
          "That answer ran out of room before it finished. Try asking a more specific question.",
        );
      }
      throw new GeminiRequestError("empty_response", "Gemini gave an empty response. Try rephrasing the question.");
    }
    return text.trim();
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    throw classifyError(error);
  }
}
