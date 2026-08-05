/**
 * SHA-256 content hashing for Workspace Library dedupe.
 * Normalizes text (trim, collapse whitespace, lowercase) before hashing so that
 * whitespace/casing differences don't produce false-negative duplicate checks.
 */

function normalizeForHash(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Returns a lowercase hex SHA-256 digest of the normalized text, or null for empty input. */
export async function computeContentHash(text) {
  const normalized = normalizeForHash(text);
  if (!normalized) return null;
  const encoded = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
