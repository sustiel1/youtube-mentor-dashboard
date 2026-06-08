/**
 * §26 APP Builder localStorage store.
 * Persists draft sections per video.
 * Storage key: app_builder_v1
 *
 * Entry shape per videoId:
 *   { summary: "...", requirements: "...", ..., _meta: { exportedAt: ISO } }
 * _meta is always excluded from draft reads to keep section data clean.
 */

const STORAGE_KEY = 'app_builder_v1';

export const APP_BUILDER_SECTIONS = [
  { key: 'summary',      label: '📝 סיכום — מה לבנות',  hint: 'מה ניתן לבנות מהסרטון הזה?' },
  { key: 'requirements', label: '🎯 דרישות',              hint: 'קלטים, פלטים, מטרות משתמש' },
  { key: 'screens',      label: '🖥️ מסכים',              hint: 'דפים, דשבורדים, זרימות משתמש' },
  { key: 'logic',        label: '⚙️ לוגיקה',             hint: 'חוקים עסקיים, אוטומציות, לוגיקת עיבוד' },
  { key: 'risks',        label: '⚠️ סיכונים',            hint: 'סיכונים טכניים, סיכוני UX, מורכבות' },
  { key: 'tasks',        label: '📋 משימות',              hint: 'היקף MVP, משימות פיתוח' },
  { key: 'prompt',       label: '🚀 פרומפט פיתוח',       hint: 'פרומפט מוכן ל-Claude Code, Codex, או Base44' },
];

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[appBuilderStore] write failed:', e?.message || e);
  }
}

/**
 * Returns only section content for a video (excludes _meta).
 */
export function getAppBuilderDraft(videoId) {
  if (!videoId) return {};
  const entry = readAll()[String(videoId)] ?? {};
  // eslint-disable-next-line no-unused-vars
  const { _meta, ...sections } = entry;
  return sections;
}

/** Returns true if any section has content for this video. */
export function hasAppBuilderDraft(videoId) {
  if (!videoId) return false;
  const draft = getAppBuilderDraft(videoId);
  return APP_BUILDER_SECTIONS.some(({ key }) => Boolean(draft[key]?.trim()));
}

/** Saves sections (partial or full) for a video. Merges with existing, preserves _meta. */
export function saveAppBuilderDraft(videoId, sections = {}) {
  if (!videoId) return;
  const all = readAll();
  all[String(videoId)] = { ...(all[String(videoId)] ?? {}), ...sections };
  writeAll(all);
}

/** Records the timestamp of the last Obsidian export for this video. */
export function markExportedToObsidian(videoId) {
  if (!videoId) return;
  const all = readAll();
  const entry = all[String(videoId)] ?? {};
  all[String(videoId)] = { ...entry, _meta: { ...(entry._meta || {}), exportedAt: new Date().toISOString() } };
  writeAll(all);
}

/** Returns export metadata: { lastExported: ISO string | null }. */
export function getExportStatus(videoId) {
  if (!videoId) return { lastExported: null };
  const entry = readAll()[String(videoId)];
  return { lastExported: entry?._meta?.exportedAt ?? null };
}

/** Removes all draft data and metadata for a video. */
export function clearAppBuilderDraft(videoId) {
  if (!videoId) return;
  const all = readAll();
  delete all[String(videoId)];
  writeAll(all);
}
