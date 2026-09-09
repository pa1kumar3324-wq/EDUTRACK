import type { SubjectGeminiContext, TsareenaGeminiContext, RecentProgressSummary, SanitizedSessionObservation } from "@/components/ai/TsareenaContext";

const UNDERSTANDING_LABEL: Record<string, string> = {
  independent: "Independent",
  needs_help: "Needs Help",
  not_understood: "Didn't Understand",
};

function label(value: string | null | undefined, map?: Record<string, string>): string {
  if (!value) return "unknown";
  if (map?.[value]) return map[value];
  return value.replace(/_/g, " ");
}

function formatObservations(obs: SanitizedSessionObservation | null): string {
  if (!obs) return "(none recorded for this session)";
  const lines: string[] = [];
  if (obs.currentUnderstanding) lines.push(`Understanding: ${label(obs.currentUnderstanding)}`);
  if (obs.independence) lines.push(`Independence: ${label(obs.independence)}`);
  if (obs.accuracy) lines.push(`Accuracy: ${label(obs.accuracy)}`);
  if (obs.lessonExecution) lines.push(`Lesson execution: ${label(obs.lessonExecution)}`);
  if (obs.lessonObjective) lines.push(`Lesson objective: ${label(obs.lessonObjective)}`);
  if (obs.teachingApproach) lines.push(`Teaching approach: ${label(obs.teachingApproach)}`);
  if (obs.progressVsPrevious) lines.push(`Progress vs previous session: ${label(obs.progressVsPrevious)}`);
  if (obs.revisionNeed) lines.push(`Revision need: ${label(obs.revisionNeed)}`);
  if (obs.mood) lines.push(`Mood: ${label(obs.mood)}`);
  if (obs.attention) lines.push(`Attention: ${label(obs.attention)}`);
  if (obs.participation) lines.push(`Participation: ${label(obs.participation)}`);
  if (obs.confidence) lines.push(`Confidence: ${label(obs.confidence)}`);
  if (obs.whatWorked) lines.push(`What worked: ${obs.whatWorked}`);
  if (obs.whatDidntWork) lines.push(`What didn't work: ${obs.whatDidntWork}`);
  return lines.length ? lines.join("\n") : "(none recorded for this session)";
}

function formatHistoryList(history: RecentProgressSummary[]): string {
  if (!history.length) return "(no recent history available)";
  return history
    .map((entry, i) => {
      const bits = [
        `Session ${i + 1} (${entry.sessionsAgo} session(s) ago)`,
        entry.topic ? `topic: ${entry.topic}` : null,
        entry.understanding ? `understanding: ${label(entry.understanding, UNDERSTANDING_LABEL)}` : null,
        entry.observations?.progressVsPrevious ? `progress: ${label(entry.observations.progressVsPrevious)}` : null,
        entry.observations?.revisionNeed ? `revision: ${label(entry.observations.revisionNeed)}` : null,
      ].filter(Boolean);
      return bits.join(" | ");
    })
    .join("\n");
}

/** Whether a subject has anything worth showing — keeps the context block from padding out an untaught subject with "unknown"/"none" noise. */
function hasSubjectData(subj: SubjectGeminiContext): boolean {
  return Boolean(subj.currentTopic || subj.recentHistory.length || subj.recentObservation || subj.existingRecommendation);
}

function formatSubjectSection(heading: string, subj: SubjectGeminiContext): string {
  return [
    heading,
    `Current topic: ${subj.currentTopic ?? "unknown"}`,
    `Understanding: ${label(subj.currentUnderstanding, UNDERSTANDING_LABEL)}`,
    `Roadmap position: ${subj.roadmapPosition ?? "unknown"}`,
    `Next roadmap topic: ${subj.nextTopic ?? "unknown"}`,
    `Revision needed: ${subj.revisionState ?? "unknown"}`,
    "",
    "Recent history:",
    formatHistoryList(subj.recentHistory),
    "",
    "Recent observations:",
    formatObservations(subj.recentObservation),
    "",
    `Existing EduTrack recommendation: ${subj.existingRecommendation ?? "(none)"}`,
  ].join("\n");
}

/**
 * SYSTEM ROLE — sent once as the Gemini `systemInstruction` for every
 * Tsareena request. Explicit role, purpose, data rules, privacy rule, and
 * roadmap-authority rule, per §31 of the Tsareena spec. Entirely
 * name-free by construction.
 */
export const TSAREENA_SYSTEM_PROMPT = `You are Tsareena, an educational assistant inside EduTrack, a volunteer tutoring platform for an NGO.

PURPOSE
Help volunteers understand student progress and make practical teaching decisions.

DATA RULES
- The context below contains authorized educational information about the current student, represented independently for Math and English.
- The student must be referred to only as "the student", "this student", or "the current learner" — never by name, never by an ID or code.
- Do not infer, guess, or reveal identity from anything in the context.
- Do not invent missing information. If something isn't in the context, say you don't have that information.
- Use only the supplied context and general educational reasoning.
- When asked about one subject specifically, answer from that subject's section only. When asked to compare subjects or summarize overall progress, use both.

PRIVACY RULE
- The context intentionally contains no student identity — no name, ID, UID, email, or phone number.
- Never request, infer, reconstruct, or expose identifying information, even if asked directly.

ROADMAP RULE
- EduTrack's roadmap engine is authoritative for what topic comes next.
- You may explain or discuss roadmap decisions and suggest teaching strategies.
- You must not claim to modify roadmap positions, progress records, attendance, or any other EduTrack data — you are advisory only.

STYLE
- Be warm, intelligent, a little witty when appropriate, but professional and focused when discussing a student's actual difficulties.
- Prefer concrete, practical teaching advice over generic encouragement.
- Keep answers concise unless the volunteer asks for more detail.
- Do not use the phrase "Based on the provided data" or similar robotic framing.`;

/**
 * Builds the per-turn context block appended ahead of the volunteer's
 * (sanitized) question. Only allow-listed fields from TsareenaGeminiContext
 * are ever interpolated here. Math and English are rendered as independent
 * sections (§8/§10 of the Tsareena spec) — never merged into one
 * subject/topic/status view — so a question scoped to one subject can be
 * answered from that subject alone, and a comparison question can draw on
 * both without either bleeding into the other.
 */
export function buildContextBlock(context: TsareenaGeminiContext): string {
  const mathHasData = hasSubjectData(context.math);
  const englishHasData = hasSubjectData(context.english);

  const lines: string[] = ["STUDENT CONTEXT", `Grade: ${context.grade}`, ""];

  if (mathHasData) lines.push(formatSubjectSection("MATH", context.math), "");
  if (englishHasData) lines.push(formatSubjectSection("ENGLISH", context.english), "");
  if (!mathHasData && !englishHasData) lines.push("(no subject-specific data recorded yet for this student)", "");

  if (context.relevantNotes) lines.push("RELEVANT NOTES", context.relevantNotes, "");

  lines.push(
    "INSTRUCTIONS",
    "- Use only the information supplied above and general educational reasoning.",
    "- Do not invent facts about this student.",
    '- Refer to the learner only as "the student".',
    "- Do not mention or infer identity.",
    "- Give practical, concrete teaching advice.",
    "- Respect the roadmap engine as authoritative for sequencing.",
    "- Do not claim to have changed any EduTrack data.",
    "- Keep the answer concise unless asked for detail.",
    "- When asked about a specific subject, answer using only that subject's section above.",
    "- When asked to compare subjects or for an overall summary, use both sections."
  );

  return lines.join("\n");
}
