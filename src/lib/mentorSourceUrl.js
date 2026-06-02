/**
 * YouTube mentor source URLs: validation, normalization, and parsing.
 * Used by Add Mentor dialog, local mentor save, RSS helpers, and channel links.
 */

const DISALLOWED_YOUTUBE_PATHS = /\/(watch|embed|shorts|live|playlist)(\/|\?|$)/i;

/** UC… channel id length (YouTube convention). */
const UC_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;

/**
 * Extract YouTube channel ID from a sourceUrl or bare id string.
 * Handles: https://www.youtube.com/channel/UCxxxxxx  or bare "UCxxxxxx" (24 chars).
 */
export function extractChannelIdFromUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (s.startsWith("UC") && s.length === 24 && UC_ID_RE.test(s)) return s;
  const m = s.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/i);
  return m ? m[1] : null;
}

/**
 * Extract @handle segment (without @) from a URL.
 * Handles: https://www.youtube.com/@handle
 */
export function extractHandleFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(/\/@([^/?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/^@/, "");
  } catch {
    return m[1].replace(/^@/, "");
  }
}

/**
 * Normalize common YouTube channel URLs to https://www.youtube.com/…
 * Non-YouTube URLs are returned trimmed unchanged.
 */
export function normalizeMentorYouTubeSourceUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return trimmed;

  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "youtube.com" && host !== "m.youtube.com") {
    return trimmed;
  }

  const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
  if (DISALLOWED_YOUTUBE_PATHS.test(`${path}${u.search || ""}`)) {
    return trimmed;
  }

  const handleMatch = path.match(/^\/@([^/?#]+)/i);
  if (handleMatch) {
    let h;
    try {
      h = decodeURIComponent(handleMatch[1]).replace(/^@/, "");
    } catch {
      h = handleMatch[1].replace(/^@/, "");
    }
    h = h.toLowerCase();
    return `https://www.youtube.com/@${h}`;
  }

  const chMatch = path.match(/^\/channel\/(UC[a-zA-Z0-9_-]{22})/i);
  if (chMatch) {
    return `https://www.youtube.com/channel/${chMatch[1]}`;
  }

  const cMatch = path.match(/^\/c\/([^/?#]+)/i);
  if (cMatch) {
    return `https://www.youtube.com/c/${cMatch[1]}`;
  }

  const userMatch = path.match(/^\/user\/([^/?#]+)/i);
  if (userMatch) {
    return `https://www.youtube.com/user/${userMatch[1]}`;
  }

  return `https://www.youtube.com${path}${u.search}${u.hash}`;
}

/**
 * Accepts common YouTube channel paths and RSS-style URLs for "add mentor" source field.
 */
export function isAcceptableMentorSourceUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return false;
  let u;
  try {
    u = new URL(trimmed);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  const path = u.pathname || "";

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (DISALLOWED_YOUTUBE_PATHS.test(`${path}${u.search || ""}`)) return false;
    if (/\/@[^/]+/i.test(path)) return true;
    if (/\/channel\/UC[a-zA-Z0-9_-]{22}/i.test(path)) return true;
    if (/\/c\/[^/]+/i.test(path)) return true;
    if (/\/user\/[^/]+/i.test(path)) return true;
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("rss") || lower.includes("feed") || lower.endsWith(".xml")) return true;
  return false;
}
