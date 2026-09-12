/**
 * Manual (user-entered) row timestamp overrides — mm:ss typed in by the user
 * to add or correct a row's video timestamp when the AI/transcript pipeline
 * missed it or got it wrong.
 *
 * Deliberately separate from the AI-generated row-timestamp sidecar
 * (rowTimestampSidecar.js / the row-timestamp-opt-in system): no dependency
 * on that system's descriptor/resolver matching, so it works for ANY row
 * that has a youtubeId + display text, including rows the opt-in system
 * doesn't cover (e.g. specialized-tab financial metrics). Keyed only by
 * youtubeId + row text fingerprint. A manual value always wins over an
 * AI-estimated one for the same row — see StaticVideoTimestampLink.jsx.
 */
import { fingerprintRowText } from './rowTimestampSidecar';

const LOCAL_STORAGE_PREFIX = 'yt_mentor_manual_row_timestamps_v1::';

function storageKey(youtubeId, text) {
  return `${LOCAL_STORAGE_PREFIX}${youtubeId}::${fingerprintRowText(text)}`;
}

/** Returns { seconds, updatedAt } or null. */
export function getManualRowTimestamp(youtubeId, text) {
  if (!youtubeId || !text) return null;
  try {
    const raw = localStorage.getItem(storageKey(youtubeId, text));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.seconds === 'number' && Number.isFinite(parsed.seconds) && parsed.seconds >= 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function setManualRowTimestamp(youtubeId, text, seconds) {
  if (!youtubeId || !text || !Number.isFinite(seconds) || seconds < 0) return;
  try {
    localStorage.setItem(storageKey(youtubeId, text), JSON.stringify({ seconds: Math.floor(seconds), updatedAt: Date.now() }));
  } catch {
    /* quota or disabled storage — non-fatal */
  }
}

export function deleteManualRowTimestamp(youtubeId, text) {
  if (!youtubeId || !text) return;
  try {
    localStorage.removeItem(storageKey(youtubeId, text));
  } catch {
    /* non-fatal */
  }
}

/**
 * Parses "MM:SS", "H:MM:SS", or a bare integer (seconds) into total seconds.
 * The leading (largest) unit accepts any number of digits; the remaining
 * unit(s) must each be 0-59. Returns null for anything else.
 */
export function parseManualTimestampInput(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((part, i) => /^\d+$/.test(part) && (i === 0 || part.length <= 2))) return null;

  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}
