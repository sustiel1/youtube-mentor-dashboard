// Manual JSON export/import for the Workspace Library — bundles all three
// related localStorage keys (items, topics, tab preferences) so a restore
// doesn't lose custom topics or UI preferences. No network/OAuth involved —
// local-only, matching the app's local-first design today.

import {
  getWorkspaceItems,
  getWorkspaceTopics,
  saveWorkspaceTopics,
  replaceAllWorkspaceItems,
} from './workspaceLibraryStore';
import { getWorkspaceTabPreferences, saveWorkspaceTabPreferences } from '@/utils/workspaceTabPreferences';

const LAST_BACKUP_KEY = 'workspace_last_backup_v1';
const BACKUP_VERSION = 1;

function buildWorkspaceBackupPayload() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: getWorkspaceItems(),
    topics: getWorkspaceTopics(),
    tabPreferences: getWorkspaceTabPreferences(),
  };
}

function recordBackupTaken(itemCount) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), itemCount }));
  } catch {}
}

/** Returns { at, itemCount } for the last export, or null if never backed up. */
export function getLastWorkspaceBackupInfo() {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.at ? parsed : null;
  } catch {
    return null;
  }
}

/** Builds the backup file and triggers a browser download. Returns the payload (for the caller's toast/count). */
export function exportWorkspaceBackup() {
  const payload = buildWorkspaceBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workspace-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  recordBackupTaken(payload.items.length);
  return payload;
}

/**
 * Parses + validates an uploaded backup file. Throws (Hebrew message) on bad
 * input. topics/tabPreferences are `null` when absent from the file (older
 * or partial exports) so applyWorkspaceBackup knows to leave them untouched
 * rather than wiping current data with nothing.
 */
export async function parseWorkspaceBackupFile(file) {
  let text;
  try {
    text = await file.text();
  } catch {
    throw new Error('לא ניתן לקרוא את הקובץ');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('הקובץ אינו JSON תקין');
  }

  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('הקובץ אינו קובץ גיבוי Workspace תקין (חסר items)');
  }

  return {
    items: parsed.items,
    topics: Array.isArray(parsed.topics) ? parsed.topics : null,
    tabPreferences: parsed.tabPreferences && typeof parsed.tabPreferences === 'object' ? parsed.tabPreferences : null,
    exportedAt: parsed.exportedAt || null,
  };
}

/** Overwrites items (always) and topics/tabPreferences (only if present in the parsed file). */
export function applyWorkspaceBackup(parsed) {
  replaceAllWorkspaceItems(parsed.items);
  if (parsed.topics !== null) saveWorkspaceTopics(parsed.topics);
  if (parsed.tabPreferences !== null) saveWorkspaceTabPreferences(parsed.tabPreferences);
}
