/**
 * Brand constants for EduTrack's attribution to its creator, Emporum.
 *
 * The Emporum website URL is deliberately NOT hard-coded. No verified public address exists in
 * this repository (the Emporum site files only contain a mailto contact), and guessing a domain
 * would risk shipping a broken or wrong link. Set it per deployment:
 *
 *   NEXT_PUBLIC_EMPORUM_URL=https://<official emporum site>
 *
 * Until it is set (or if it is not a valid https URL) the attribution renders as plain text with
 * no link, so no placeholder or broken destination is ever shown.
 */
export const PRODUCT_NAME = "EduTrack";
export const CREATOR_NAME = "Emporum";

/** Returns the validated Emporum URL, or null when it is unset or not a safe https URL. */
export function getEmporumUrl(): string | null {
  // NEXT_PUBLIC_* must be read with this literal expression so Next can inline it for client bundles.
  const raw = process.env.NEXT_PUBLIC_EMPORUM_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    // https only, and no embedded credentials: this value is rendered as a public link.
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
