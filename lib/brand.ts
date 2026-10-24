/**
 * Brand constants for EduTrack's attribution to its creator, Emporum.
 *
 * The Emporum site defaults to the official address below. A deployment can override it with
 * NEXT_PUBLIC_EMPORUM_URL (https only); an invalid override falls back to the default.
 */
export const EMPORUM_DEFAULT_URL = "https://emporum.netlify.app/";
export const PRODUCT_NAME = "EduTrack";
export const CREATOR_NAME = "Emporum";

/** Returns the Emporum URL: a valid https env override, otherwise the official default. */
export function getEmporumUrl(): string {
  // NEXT_PUBLIC_* must be read with this literal expression so Next can inline it for client bundles.
  const raw = process.env.NEXT_PUBLIC_EMPORUM_URL?.trim();
  if (!raw) return EMPORUM_DEFAULT_URL;
  try {
    const url = new URL(raw);
    // https only, and no embedded credentials: this value is rendered as a public link.
    if (url.protocol !== "https:" || url.username || url.password) return EMPORUM_DEFAULT_URL;
    return url.toString();
  } catch {
    return EMPORUM_DEFAULT_URL;
  }
}
