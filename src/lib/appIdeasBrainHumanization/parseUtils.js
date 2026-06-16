/**
 * Shared parsers for App Brain humanization rules.
 * Phase P1 can extend formatDisplayNumber, LEVEL_LABELS_HE, etc. here.
 */

/** @typedef {Record<string, string>} KeyValueMap */

const TECHNICAL_KEY_RE = /^(metric|value|trigger|type|risk|level|symbol|strategy|asset|ticker|event|impact|sector|price|target|note|importance)$/i;

/**
 * Parse "key: value | key: value" fragments (pipe or comma separated).
 * @param {string} text
 * @returns {KeyValueMap|null}
 */
export function parseKeyValueSegments(text) {
  const raw = String(text || '').trim();
  if (!raw || !raw.includes(':')) return null;

  const segments = raw.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const map = {};
  let parsed = 0;

  for (const segment of segments) {
    const colon = segment.indexOf(':');
    if (colon <= 0) return null;
    const key = segment.slice(0, colon).trim().toLowerCase();
    const value = segment.slice(colon + 1).trim();
    if (!key || !value) return null;
    map[key] = value;
    parsed += 1;
  }

  return parsed > 0 ? map : null;
}

/** True when text looks like structured AI key:value output. */
export function looksLikeTechnicalKeyValue(text) {
  const map = parseKeyValueSegments(text);
  if (!map) return false;
  const keys = Object.keys(map);
  return keys.length > 0 && keys.every((k) => TECHNICAL_KEY_RE.test(k));
}

/**
 * Phase P1: locale-aware number formatting (62357 → 62,357).
 * @param {string|number} value
 * @returns {string}
 */
export function formatDisplayNumber(value) {
  const raw = String(value ?? '').trim();
  const normalized = raw.replace(/,/g, '');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('en-US');
}

/** Phase P1: severity / level labels in Hebrew. */
export const LEVEL_LABELS_HE = {
  high: 'גבוה',
  medium: 'בינוני',
  low: 'נמוך',
  critical: 'קריטי',
};

export function translateLevelWord(word) {
  const key = String(word || '').trim().toLowerCase();
  return LEVEL_LABELS_HE[key] || word;
}
