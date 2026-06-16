/**
 * Item-level Obsidian save tracking — one vault file may contain many items.
 * Key: videoId + tab + sectionKey + text hash + destination path.
 */
import { buildItemSaveIds } from '@/lib/saveStatusResolver';

const STORAGE_KEY = 'yt_obsidian_item_saves_v1';

function normalizeObsidianPath(path) {
  return String(path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase();
}

function normalizeSectionKey(sectionKey) {
  return String(sectionKey || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9א-ת-]/g, '')
    .slice(0, 60) || 'general';
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** Item identity without destination path (for quick-save / open-any). */
export function buildObsidianItemIdentityKey({ videoId, tabKey, sectionKey, text }) {
  const { brainId } = buildItemSaveIds(videoId, tabKey, text);
  const section = normalizeSectionKey(sectionKey);
  return `${brainId.replace(/^brain-item:/, 'obsidian-item:')}:${section}`;
}

/** Full dedupe key including destination vault path. */
export function buildObsidianItemDedupeKey({ videoId, tabKey, sectionKey, text, destinationPath }) {
  const identity = buildObsidianItemIdentityKey({ videoId, tabKey, sectionKey, text });
  const path = normalizeObsidianPath(destinationPath);
  return path ? `${identity}@${path}` : identity;
}

export function recordObsidianItemSave({
  videoId,
  tabKey,
  sectionKey,
  text,
  destinationPath,
  savedAt,
} = {}) {
  const path = normalizeObsidianPath(destinationPath);
  const body = String(text || '').trim();
  if (!path || !body) return null;

  const key = buildObsidianItemDedupeKey({ videoId, tabKey, sectionKey, text: body, destinationPath: path });
  const store = readStore();
  const entry = {
    videoId: String(videoId || 'unknown'),
    tabKey: tabKey || 'multi',
    sectionKey: String(sectionKey || ''),
    textHash: buildItemSaveIds(videoId, tabKey, body).brainId.split(':').pop(),
    textPreview: body.slice(0, 120),
    destinationPath: path,
    savedAt: savedAt || new Date().toISOString(),
  };
  store[key] = entry;
  writeStore(store);
  return entry;
}

function findEntriesForIdentity(identityKey) {
  const store = readStore();
  const prefix = `${identityKey}@`;
  return Object.entries(store)
    .filter(([key]) => key === identityKey || key.startsWith(prefix))
    .map(([, entry]) => entry);
}

export function isObsidianItemSaved(
  { videoId, tabKey, sectionKey, text },
  { destinationPath } = {},
) {
  const body = String(text || '').trim();
  if (!body) return false;

  const identityKey = buildObsidianItemIdentityKey({ videoId, tabKey, sectionKey, text: body });
  const path = normalizeObsidianPath(destinationPath);

  if (path) {
    const key = buildObsidianItemDedupeKey({ videoId, tabKey, sectionKey, text: body, destinationPath: path });
    return Boolean(readStore()[key]);
  }

  return findEntriesForIdentity(identityKey).length > 0;
}

export function resolveObsidianItemSaveEntry(
  { videoId, tabKey, sectionKey, text },
  { destinationPath } = {},
) {
  const body = String(text || '').trim();
  if (!body) return null;

  const identityKey = buildObsidianItemIdentityKey({ videoId, tabKey, sectionKey, text: body });
  const path = normalizeObsidianPath(destinationPath);

  if (path) {
    const key = buildObsidianItemDedupeKey({ videoId, tabKey, sectionKey, text: body, destinationPath: path });
    return readStore()[key] || null;
  }

  const entries = findEntriesForIdentity(identityKey);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))[0];
}

export function resolveObsidianBulkItemStatus(items = [], { videoId, destinationPath, videoSavedPath } = {}) {
  const list = (Array.isArray(items) ? items : []).filter((item) => String(item?.text || '').trim());
  const path = normalizeObsidianPath(destinationPath);
  const normalizedVideoPath = normalizeObsidianPath(videoSavedPath);

  const savedItems = [];
  const unsavedItems = [];

  list.forEach((item) => {
    const params = {
      videoId,
      tabKey: item.tabKey || item.type || item.tabScope || 'multi',
      sectionKey: item.sectionKey || item.sectionLabel || '',
      text: item.text,
    };
    const saved = isObsidianItemSaved(params, path ? { destinationPath: path } : {});
    const preview = String(item.text || '').trim().slice(0, 80);
    if (saved) savedItems.push({ ...item, preview });
    else unsavedItems.push({ ...item, preview });
  });

  const allSaved = list.length > 0 && unsavedItems.length === 0;
  const anySaved = savedItems.length > 0;
  const mixed = anySaved && unsavedItems.length > 0;
  const fileExistsButItemUnsaved = Boolean(
    path
    && normalizedVideoPath
    && path === normalizedVideoPath
    && unsavedItems.length > 0,
  );

  let openPath = path || null;
  if (!openPath && savedItems.length > 0) {
    const entry = resolveObsidianItemSaveEntry({
      videoId,
      tabKey: savedItems[0].tabKey || savedItems[0].type || 'multi',
      sectionKey: savedItems[0].sectionKey || savedItems[0].sectionLabel || '',
      text: savedItems[0].text,
    });
    openPath = entry?.destinationPath || normalizedVideoPath || null;
  } else if (allSaved && path) {
    openPath = path;
  }

  return {
    total: list.length,
    allSaved,
    anySaved,
    mixed,
    noneSaved: !anySaved,
    savedItems,
    unsavedItems,
    fileExistsButItemUnsaved,
    openPath,
  };
}
