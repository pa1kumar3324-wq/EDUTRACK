import type { UnderstandingStatus } from "@/lib/types/database";
import { GoogleGenAI } from "@google/genai";

interface SuggestionInput {
  studentName: string;
  grade?: number;
  subject: "english" | "math";
  topic: string;
  status: UnderstandingStatus;
  notes?: string;
  nextRoadmapTopic?: string;
  /**
   * Whether the roadmap engine's recommendation is a REVISION of the topic
   * just taught (same topic again) rather than an ADVANCEMENT to a new one.
   * Always comes from resolveRoadmapPosition()/recommendNextTopic() in
   * lib/utils/roadmapEngine.ts — this file never infers or overrides it.
   */
  isRevision?: boolean;
}

/**
 * Produces the "Suggested Next Lesson" text shown after a progress submission.
 *
 * If GEMINI_API_KEY is configured, this delegates to Gemini for a more
 * tailored suggestion (see /app/api/progress/route.ts). Otherwise it falls
 * back to this deterministic heuristic, so the feature works out of the box
 * with zero external dependencies.
 */
export function heuristicSuggestion(input: SuggestionInput): string {
  const { subject, topic, status, nextRoadmapTopic, isRevision } = input;
  const subjectLabel = subject === "english" ? "English" : "Math";

  if (status === "not_understood") {
    return `Spend the first 15 minutes of the next session re-teaching "${topic}" with a different method (visual aids or hands-on examples) before attempting anything new in ${subjectLabel}.`;
  }

  if (status === "needs_help") {
    // REVISION: the roadmap engine is recommending the SAME topic again, so
    // never phrase this as "before moving to" that same topic.
    if (isRevision) {
      return `Spend 10-15 minutes revisiting "${topic}" using guided practice and concrete examples, and check whether the student can work through it independently before introducing anything new.`;
    }
    return `Briefly review "${topic}" for 10 minutes to build confidence, then continue reinforcing it with guided practice before moving to ${nextRoadmapTopic ?? "the next topic"}.`;
  }

  // independent
  return nextRoadmapTopic
    ? `Student is confident with "${topic}" — begin introducing "${nextRoadmapTopic}" next session.`
    : `Student is confident with "${topic}" — ready to advance to the next roadmap topic in ${subjectLabel}.`;
}

/**
 * Gemini's role is strictly limited to producing short, practical teaching
 * advice for the volunteer's NEXT session. It never decides — and is
 * explicitly told not to decide — the student's grade, subject, roadmap
 * position, or progress status; those all come from the deterministic
 * roadmap engine (see lib/utils/roadmapEngine.ts) and are only ever passed
 * INTO this prompt as fixed context, never derived from it.
 */
const SYSTEM_INSTRUCTION = `You are helping a volunteer tutor at an NGO plan the next tutoring session for a child.
You are given the topic just taught, how well the student understood it, and a roadmap decision — already made by a separate system, which you do not choose or reinterpret — telling you whether the next session is a REVISION of the same topic or an ADVANCEMENT to a new topic.
Your only job: suggest, in 1-3 short sentences, exactly what the volunteer should do in the next session. Be concrete and actionable.

If the roadmap decision is REVISION:
- The next session reinforces/reteaches the SAME topic the student just struggled with — the student is NOT moving to a new topic yet.
- Never describe that same topic as something the student is about to move to, and never use phrasing like "before moving to X" where X is that same topic.
- Focus on diagnosing the specific misunderstanding and guided practice on that topic.

If the roadmap decision is ADVANCEMENT:
- The next session introduces the given next roadmap topic.
- You may briefly mention checking the prior topic before introducing the new one.

Do not use markdown, headings, or bullet points — plain prose only.
Do not restate or change the roadmap decision or topic you were given; only explain how to approach it.
Do not offer any medical, psychological, or diagnostic assessment of the student.
Do not include generic motivational language or long explanations — be brief and practical.`;

function buildPrompt(input: SuggestionInput): string {
  const subjectLabel = input.subject === "english" ? "English" : "Math";
  // Deliberately omit the student's name and any other identifying field —
  // none of it is needed to generate teaching advice, and this endpoint
  // sends real student data to a third-party API, so only the minimum
  // required context goes out (see the "PRIVACY" requirements this was
  // implemented against).
  const roadmapDecisionLine = input.isRevision
    ? `Roadmap decision (fixed, do not change): REVISION — the recommended next-session topic is the SAME topic just taught, "${input.nextRoadmapTopic ?? input.topic}". The student is not moving on yet.`
    : `Roadmap decision (fixed, do not change): ADVANCEMENT — the next roadmap topic is "${input.nextRoadmapTopic ?? "unknown"}".`;
  const lines = [
    `Grade: ${input.grade ?? "unknown"}`,
    `Subject: ${subjectLabel}`,
    `Topic just taught: ${input.topic}`,
    `Understanding: ${input.status}`,
    `Volunteer notes: ${input.notes?.trim() || "none"}`,
    roadmapDecisionLine,
  ];
  return lines.join("\n");
}

let cachedClient: GoogleGenAI | null | undefined;

/** Lazily constructs (and caches) the Gemini client, or null if unconfigured. */
function getGeminiClient(): GoogleGenAI | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  cachedClient = apiKey ? new GoogleGenAI({ apiKey }) : null;
  return cachedClient;
}

/**
 * Optional: call the Gemini API for a richer, context-aware suggestion.
 * Falls back to the heuristic on ANY failure — missing/invalid key, rate
 * limits, network errors, API errors, or an empty/malformed response — so a
 * Gemini outage or misconfiguration can never break progress submission.
 */
export async function generateAiSuggestion(input: SuggestionInput): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) return heuristicSuggestion(input);

  try {
    const response = await ai.models.generateContent({
      // gemini-3.6-flash is the current GA stable Flash model (as of the
      // Gemini 3.x line) — see https://ai.google.dev/gemini-api/docs/generate-content/latest-model.
      // Google retires model IDs on a rolling basis (2.5 Flash was cut off
      // for new API keys ahead of its official shutdown date); if this
      // starts 404ing again, check that page for the current GA Flash ID
      // and update the string below — everything else in this file stays
      // the same.
      model: "gemini-3.6-flash",
      contents: buildPrompt(input),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 200,
        // NOTE: temperature/top_p/top_k are deprecated as of Gemini 3.x and
        // are ignored (or rejected with a 400) by the API — do NOT add them
        // back. Determinism/tone is controlled via SYSTEM_INSTRUCTION
        // instead, per Google's own migration guidance.
      },
    });

    const text = response.text;
    return typeof text === "string" && text.trim() ? text.trim() : heuristicSuggestion(input);
  } catch (error) {
    // Never log the API key or student data — just enough to diagnose a
    // misconfiguration or outage from server logs.
    console.error(
      "[suggestionEngine] Gemini request failed, falling back to heuristic suggestion:",
      error instanceof Error ? error.message : "unknown error"
    );
    return heuristicSuggestion(input);
  }
}

