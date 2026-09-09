/** Randomized login greeting lines (§12). One shown at most once per session. */
export const LOGIN_GREETINGS = [
  "Welcome back. The dashboard survived without you.",
  "You're back. I brought the data. You bring the coffee. \u2615",
  "Ready to make some academic progress happen?",
  "Welcome back. Let's see what our scholars have been up to. \ud83d\udc40",
  "I checked the dashboard. It has opinions.",
  "Back again? I was just pretending to understand spreadsheets.",
];

/** Rare, contextual comments after meaningful events (§13). Keyed by event type. */
export const EVENT_COMMENTS: Record<string, string[]> = {
  progress_logged: [
    "That was productive. I'm counting it.",
    "Someone's doing some serious academic admin today.",
    "I inspected the data. It passed my extremely scientific vibe check.",
    "Tiny progress is still progress.",
    "You clicked that button with confidence. Respect.",
  ],
  both_subjects_logged: ["Math and English both showed up today. Respect."],
  attendance_logged: ["Attendance, logged. My spreadsheet heart is full."],
  streak: ["Three sessions logged. Productivity detected."],
  return_after_absence: ["Look who's back. The students missed you. Probably."],
};

export function randomFrom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)] as T;
}

/** No-key setup copy (§15). */
export const NO_KEY_PITCH =
  "Want to give me a brain? Connect your own Gemini API key and I can help analyze progress, explain patterns, suggest teaching strategies, and think through what to do next.";
export const NO_KEY_DECLINE_LINE = "No worries. I'll still be here. My advanced brain is taking the afternoon off. \ud83d\ude0c";

/** Quick prompts shown when opened on a student profile (§23). */
export const PROFILE_QUICK_PROMPTS = [
  "Summarize this student's progress",
  "What should I focus on next?",
  "What topics need revision?",
  "Explain their recent difficulties",
  "Suggest a teaching approach",
  "Compare Math and English progress",
];

/** General quick prompts shown elsewhere in the app (§23). */
export const GENERAL_QUICK_PROMPTS = [
  "How should I interpret a 'Needs Help' status?",
  "How can I make my next session more effective?",
  "Explain the roadmap system",
];
