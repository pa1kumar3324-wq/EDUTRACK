import type { UnderstandingStatus } from "@/lib/types/database";

interface SuggestionInput {
  studentName: string;
  subject: "english" | "math";
  topic: string;
  status: UnderstandingStatus;
  notes?: string;
  nextRoadmapTopic?: string;
}

/**
 * Produces the "Suggested Next Lesson" text shown after a progress submission.
 *
 * If ANTHROPIC_API_KEY is configured, this delegates to Claude for a more
 * tailored suggestion (see /app/api/progress/route.ts). Otherwise it falls
 * back to this deterministic heuristic, so the feature works out of the box
 * with zero external dependencies.
 */
export function heuristicSuggestion(input: SuggestionInput): string {
  const { subject, topic, status, nextRoadmapTopic } = input;
  const subjectLabel = subject === "english" ? "English" : "Math";

  if (status === "not_understood") {
    return `Spend the first 15 minutes of the next session re-teaching "${topic}" with a different method (visual aids or hands-on examples) before attempting anything new in ${subjectLabel}.`;
  }

  if (status === "needs_help") {
    return `Briefly review "${topic}" for 10 minutes to build confidence, then continue reinforcing it with guided practice before moving to ${nextRoadmapTopic ?? "the next topic"}.`;
  }

  // independent
  return nextRoadmapTopic
    ? `Student is confident with "${topic}" — begin introducing "${nextRoadmapTopic}" next session.`
    : `Student is confident with "${topic}" — ready to advance to the next roadmap topic in ${subjectLabel}.`;
}

/**
 * Optional: call the Anthropic API for a richer, context-aware suggestion.
 * Falls back to the heuristic on any failure (missing key, network, etc).
 */
export async function generateAiSuggestion(input: SuggestionInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristicSuggestion(input);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: `You are helping a volunteer tutor at an NGO plan the next session for a child.
Student: ${input.studentName}
Subject: ${input.subject}
Topic just taught: ${input.topic}
Understanding: ${input.status}
Volunteer notes: ${input.notes || "none"}
Next roadmap topic: ${input.nextRoadmapTopic || "unknown"}

In 1-2 short sentences, suggest exactly what the next volunteer should do next session. Be concrete and actionable (e.g. "spend 15 minutes revising X before introducing Y"). Do not use markdown.`,
          },
        ],
      }),
    });

    if (!res.ok) return heuristicSuggestion(input);

    const data = await res.json();
    const text = data?.content?.find((b: { type: string }) => b.type === "text")?.text;
    return typeof text === "string" && text.trim() ? text.trim() : heuristicSuggestion(input);
  } catch {
    return heuristicSuggestion(input);
  }
}
