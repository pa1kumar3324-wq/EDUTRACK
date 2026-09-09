import type { Subject, UnderstandingStatus } from "@/lib/types/database";
import type { SessionObservations, SubjectSessionObservations } from "@/lib/types/sessionObservations";

/**
 * ── STRICT IDENTITY SEPARATION ────────────────────────────────────────────
 *
 * There are two representations of "the current student" in Tsareena:
 *
 *  1. ClientStudentDisplayContext — what the UI already legitimately knows
 *     (it came from an already-authorized, RLS-protected page load). May
 *     contain the student's name. Rendered in chat bubbles, quick-prompt
 *     labels, etc. NEVER sent to Gemini directly.
 *
 *  2. TsareenaGeminiContext — the ONLY shape that is ever allowed into a
 *     Gemini request. It is a standalone type with its own explicit field
 *     list — not an Omit<> or subtype of anything that carries identity —
 *     so accidentally adding studentName/studentId/uid/email/phone to it is
 *     a visible, single-line diff to review, not something that can sneak
 *     in via a shared base type.
 *
 * buildTsareenaGeminiContext() is the ONLY place allowed to construct #2. No
 * other file should hand-assemble a Gemini-bound context object.
 *
 * Within #2, Math and English are represented INDEPENDENTLY (`math` /
 * `english` below) rather than flattened into one ambiguous
 * subject/topic/status view — see SubjectGeminiContext. A few flattened
 * fields are kept at the top level purely for backward compatibility with
 * anything that might still read the old shape; Tsareena's own prompt
 * builder (components/ai/TsareenaPrompt.ts) reads `math` / `english`
 * instead and ignores them.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ClientStudentDisplayContext {
  studentName: string;
  studentId: string;
  grade: number;
  englishTopic: string | null;
  englishStatus: UnderstandingStatus | null;
  mathTopic: string | null;
  mathStatus: UnderstandingStatus | null;
  englishRoadmapPosition?: string | null;
  englishNextTopic?: string | null;
  englishRevisionState?: string | null;
  mathRoadmapPosition?: string | null;
  mathNextTopic?: string | null;
  mathRevisionState?: string | null;
  relevantNotes?: string | null;
  /** Legacy combined "Suggested Next Lesson" text (may cover one or both subjects — see resolveSubjectExistingSuggestion). */
  existingHeuristicSuggestion?: string | null;
  /** This subject's slice of the most recent suggestion that actually covered it. */
  mathExistingSuggestion?: string | null;
  englishExistingSuggestion?: string | null;
  /** Small, bounded window — never the full history. */
  recentSessions?: RecentProgressSummary[];
}

export interface RecentProgressSummary {
  subject: Subject;
  topic: string | null;
  understanding: UnderstandingStatus | null;
  sessionsAgo: number;
  observations?: SanitizedSessionObservation | null;
}

/** A session's structured observations, stripped of anything not safe to send. */
export type SanitizedSessionObservation = SubjectSessionObservations & {
  mood?: SessionObservations["mood"];
  energy?: SessionObservations["energy"];
  attention?: SessionObservations["attention"];
  participation?: SessionObservations["participation"];
  confidence?: SessionObservations["confidence"];
};

/**
 * One subject's context, represented independently of the other (§8 of the
 * Tsareena spec). Every field here is scoped to THIS subject only — a Math
 * observation, history entry, or recommendation can never end up under
 * `english` or vice versa.
 */
export interface SubjectGeminiContext {
  currentTopic: string | null;
  currentUnderstanding: UnderstandingStatus | null;
  roadmapPosition: string | null;
  nextTopic: string | null;
  revisionState: string | null;
  /** Most recent structured observation recorded for THIS subject, sanitized. */
  recentObservation: SanitizedSessionObservation | null;
  /** Bounded, most-recent-first, THIS subject only. */
  recentHistory: RecentProgressSummary[];
  /** EduTrack's own deterministic suggestion for THIS subject, sanitized. */
  existingRecommendation: string | null;
}

/**
 * The ONLY shape that may ever be sent to Gemini. Every field here is
 * explicitly allow-listed as safe (§7/§20 of the Tsareena spec) — grade,
 * subject, topic, understanding, roadmap position, structured observations,
 * and a small bounded window of recent history. Nothing identifying can
 * live here because nothing identifying is declared here.
 */
export interface TsareenaGeminiContext {
  grade: number;

  /** Independent per-subject context — see SubjectGeminiContext. This is what Tsareena's prompt builder actually reads. */
  math: SubjectGeminiContext;
  english: SubjectGeminiContext;

  // ── Flattened legacy view, kept only for backward compatibility (§8.2 of
  // the Tsareena spec) with anything that might still read the pre-split
  // shape. Tsareena's own prompt builder no longer uses these — do not add
  // new consumers of them; use `math` / `english` instead.
  subject: "math" | "english" | "both" | null;
  currentTopic: string | null;
  currentUnderstanding: UnderstandingStatus | null;
  roadmapPosition: string | null;
  nextTopic: string | null;
  revisionState: string | null;
  recentProgress: RecentProgressSummary[];

  relevantNotes: string | null;
  existingHeuristicSuggestion: string | null;
}

/**
 * Conversation-history sanitizer (§9 — the highest-risk leak surface).
 *
 * Replaces every occurrence of the current student's known identifying
 * strings (name, and any other known-identifying string already available
 * client-side) with a neutral referent, using simple, safe, literal string
 * replacement of the SPECIFIC known name(s) for the current context — not
 * generic "detect any name" heuristics, which are unreliable. This runs on
 * every volunteer message before it is appended to the Gemini-facing
 * history, including retries and regenerations (never replay a cached raw
 * string that predates sanitization).
 *
 * This is also the single sanitization primitive reused for every other
 * free-text field that reaches Gemini — see sanitizeFreeText and
 * sanitizeObservationForGemini below. There is deliberately no second
 * string-replacement implementation anywhere else in the app.
 */
export function sanitizeMessageForGemini(rawText: string, identifyingStrings: string[]): string {
  let sanitized = rawText;
  for (const identifier of identifyingStrings) {
    const trimmed = identifier.trim();
    if (!trimmed) continue;
    // Escape regex special characters, replace case-insensitively, whole
    // occurrences only (works for first names, full names, guardian names).
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "gi");
    sanitized = sanitized.replace(pattern, "the student");

    // Also strip the possessive form ("Rahul's" -> "the student's").
    const possessivePattern = new RegExp(`${escaped}('s)?`, "gi");
    sanitized = sanitized.replace(possessivePattern, (match) => (match.toLowerCase().endsWith("'s") ? "the student's" : "the student"));
  }
  return sanitized;
}

/** Collects every known client-side identifying string for the current student, for use with sanitizeMessageForGemini. */
export function collectIdentifyingStrings(student: Pick<ClientStudentDisplayContext, "studentName">): string[] {
  const strings = [student.studentName];
  // Also sanitize just the first name on its own, since volunteers commonly
  // use it alone in a follow-up ("How is Rahul doing today?").
  const firstName = student.studentName.split(/\s+/)[0];
  if (firstName && firstName !== student.studentName) strings.push(firstName);
  return strings;
}

/**
 * sanitizeMessageForGemini for a single optional/nullable free-text field —
 * volunteer notes, whatWorked/whatDidntWork, AI-suggestion text, etc. This
 * is the ONLY place those fields should be sanitized; buildTsareenaGeminiContext
 * calls this on every free-text field it forwards rather than passing any
 * of them through untouched. Returns null (not undefined/empty string) when
 * there's nothing to sanitize, matching this file's nullish conventions.
 */
function sanitizeFreeText(text: string | null | undefined, identifiers: string[]): string | null {
  if (!text) return null;
  const sanitized = sanitizeMessageForGemini(text, identifiers);
  return sanitized.trim() ? sanitized : null;
}

/**
 * A structured observation's enum/boolean fields (mood, accuracy, teaching
 * approach, ...) can't carry a name — they're closed vocabularies. Its
 * free-text fields (whatWorked, whatDidntWork, difficultyCause,
 * incompleteReason, revisionArea, recommendedFocusNext) are ordinary prose a
 * volunteer typed, exactly like a chat message or a progress note, and can
 * just as easily contain the student's name. This runs every one of those
 * through the same sanitizer as everything else before the observation is
 * allowed into a Gemini-bound context.
 */
function sanitizeObservationForGemini(
  obs: SanitizedSessionObservation | null | undefined,
  identifiers: string[]
): SanitizedSessionObservation | null {
  if (!obs) return null;
  return {
    ...obs,
    difficultyCause: sanitizeFreeText(obs.difficultyCause, identifiers) ?? undefined,
    incompleteReason: sanitizeFreeText(obs.incompleteReason, identifiers) ?? undefined,
    whatWorked: sanitizeFreeText(obs.whatWorked, identifiers) ?? undefined,
    whatDidntWork: sanitizeFreeText(obs.whatDidntWork, identifiers) ?? undefined,
    revisionArea: sanitizeFreeText(obs.revisionArea, identifiers) ?? undefined,
    recommendedFocusNext: sanitizeFreeText(obs.recommendedFocusNext, identifiers) ?? undefined,
  };
}

/**
 * The sanitizer: turns UI-facing student context (which may contain a name,
 * and free text a volunteer may have written the student's name into) into
 * the allow-listed, per-subject Gemini-facing context. This is the single
 * place that "crosses the line" from display data to model input — nothing
 * downstream needs to remember to strip or split anything, because the
 * output type here is structurally identity-light and already split by
 * subject.
 */
export function buildTsareenaGeminiContext(
  student: ClientStudentDisplayContext,
  focusSubject: Subject | null
): TsareenaGeminiContext {
  const identifiers = collectIdentifyingStrings(student);

  const allRecentSanitized: RecentProgressSummary[] = (student.recentSessions ?? []).map((entry) => ({
    ...entry,
    observations: sanitizeObservationForGemini(entry.observations, identifiers),
  }));

  const englishRecent = allRecentSanitized.filter((e) => e.subject === "english").slice(0, 5);
  const mathRecent = allRecentSanitized.filter((e) => e.subject === "math").slice(0, 5);

  const english: SubjectGeminiContext = {
    currentTopic: student.englishTopic,
    currentUnderstanding: student.englishStatus,
    roadmapPosition: student.englishRoadmapPosition ?? null,
    nextTopic: student.englishNextTopic ?? null,
    revisionState: student.englishRevisionState ?? null,
    recentObservation: englishRecent[0]?.observations ?? null,
    recentHistory: englishRecent,
    existingRecommendation: sanitizeFreeText(student.englishExistingSuggestion, identifiers),
  };

  const math: SubjectGeminiContext = {
    currentTopic: student.mathTopic,
    currentUnderstanding: student.mathStatus,
    roadmapPosition: student.mathRoadmapPosition ?? null,
    nextTopic: student.mathNextTopic ?? null,
    revisionState: student.mathRevisionState ?? null,
    recentObservation: mathRecent[0]?.observations ?? null,
    recentHistory: mathRecent,
    existingRecommendation: sanitizeFreeText(student.mathExistingSuggestion, identifiers),
  };

  // Legacy flattened view — same "math first" tie-break as before, kept
  // only so nothing that might still read these top-level fields breaks.
  const flattenedSubject: TsareenaGeminiContext["subject"] =
    focusSubject ?? (student.englishTopic && student.mathTopic ? "both" : student.mathTopic ? "math" : student.englishTopic ? "english" : null);
  const pick = <T,>(englishVal: T, mathVal: T): T | null => {
    if (flattenedSubject === "english") return englishVal ?? null;
    if (flattenedSubject === "math") return mathVal ?? null;
    return (mathVal ?? englishVal ?? null) as T | null;
  };

  return {
    grade: student.grade,
    math,
    english,

    subject: flattenedSubject,
    currentTopic: pick(student.englishTopic, student.mathTopic),
    currentUnderstanding: pick(student.englishStatus, student.mathStatus),
    roadmapPosition: pick(student.englishRoadmapPosition ?? null, student.mathRoadmapPosition ?? null),
    nextTopic: pick(student.englishNextTopic ?? null, student.mathNextTopic ?? null),
    revisionState: pick(student.englishRevisionState ?? null, student.mathRevisionState ?? null),
    // Bounded: never forward more than a handful of recent sessions.
    recentProgress: allRecentSanitized.slice(0, 5),

    relevantNotes: sanitizeFreeText(student.relevantNotes, identifiers),
    existingHeuristicSuggestion: sanitizeFreeText(student.existingHeuristicSuggestion, identifiers),
  };
}

/**
 * Turns a student's progress history (already-authorized data a page
 * fetched server-side) into a small, bounded window of RecentProgressSummary
 * entries, split by subject, most-recent-first. Never includes any other
 * student's rows. Used to populate ClientStudentDisplayContext.recentSessions
 * before that context ever reaches buildTsareenaGeminiContext().
 */
export function buildRecentSessionSummaries(
  history: Array<{
    english_topic: string | null;
    english_status: UnderstandingStatus | null;
    math_topic: string | null;
    math_status: UnderstandingStatus | null;
    session_observations: SessionObservations | null;
  }>,
  limit = 5
): RecentProgressSummary[] {
  const summaries: RecentProgressSummary[] = [];
  let sessionsAgo = 0;
  for (const row of history) {
    sessionsAgo += 1;
    if (row.english_topic || row.english_status) {
      summaries.push({
        subject: "english",
        topic: row.english_topic,
        understanding: row.english_status,
        sessionsAgo,
        observations: toSanitizedObservation(row.session_observations, "english"),
      });
    }
    if (row.math_topic || row.math_status) {
      summaries.push({
        subject: "math",
        topic: row.math_topic,
        understanding: row.math_status,
        sessionsAgo,
        observations: toSanitizedObservation(row.session_observations, "math"),
      });
    }
    if (summaries.length >= limit) break;
  }
  return summaries.slice(0, limit);
}

function toSanitizedObservation(
  obs: SessionObservations | null,
  subject: "english" | "math"
): SanitizedSessionObservation | null {
  if (!obs) return null;
  const subjectObs = obs[subject];
  if (!subjectObs && !obs.mood && !obs.attention && !obs.participation && !obs.confidence) return null;
  return {
    ...subjectObs,
    mood: obs.mood,
    energy: obs.energy,
    attention: obs.attention,
    participation: obs.participation,
    confidence: obs.confidence,
  };
}

/**
 * `progress.suggested_next_lesson` is a single text column (see
 * supabase/schema.sql) that POST /api/progress writes as either one
 * subject's suggestion, or — when both subjects were logged in the same
 * session — both, joined as "Math: <...>\n\nEnglish: <...>" (see
 * app/api/progress/route.ts, the only writer of this column). This pulls
 * just one subject's half back out, purely by parsing that same
 * deterministic, app-controlled format — no migration or new column
 * needed. Returns null for legacy/unlabeled rows there's no reliable way
 * to attribute to one subject.
 */
function extractSubjectPortion(raw: string, subject: "math" | "english"): string | null {
  const mathPrefix = "Math: ";
  const englishPrefix = "English: ";
  const separator = "\n\nEnglish: ";

  if (raw.startsWith(mathPrefix) && raw.includes(separator)) {
    const sepIndex = raw.indexOf(separator);
    if (subject === "math") return raw.slice(mathPrefix.length, sepIndex).trim();
    return raw.slice(sepIndex + separator.length).trim();
  }
  if (raw.startsWith(mathPrefix)) return subject === "math" ? raw.slice(mathPrefix.length).trim() : null;
  if (raw.startsWith(englishPrefix)) return subject === "english" ? raw.slice(englishPrefix.length).trim() : null;
  return null;
}

/**
 * Finds the most recent progress row that actually recorded `subject` (has
 * both a topic and a status for it) and returns its per-subject slice of
 * `suggested_next_lesson`, so a Math session's "existing recommendation"
 * can never be attributed to English or vice versa (§8 of the Tsareena
 * spec). Mirrors the subject-filtering already used by
 * buildRecentSessionSummaries.
 */
export function resolveSubjectExistingSuggestion(
  history: Array<{
    english_topic: string | null;
    english_status: UnderstandingStatus | null;
    math_topic: string | null;
    math_status: UnderstandingStatus | null;
    suggested_next_lesson: string | null;
  }>,
  subject: "math" | "english"
): string | null {
  for (const row of history) {
    const hasSubject = subject === "math" ? row.math_topic && row.math_status : row.english_topic && row.english_status;
    if (!hasSubject || !row.suggested_next_lesson) continue;
    const extracted = extractSubjectPortion(row.suggested_next_lesson, subject);
    if (extracted) return extracted;
  }
  return null;
}
