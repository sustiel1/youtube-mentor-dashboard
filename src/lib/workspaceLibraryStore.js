import { DEFAULT_WORKSPACE_TOPICS } from '@/config/workspaceTaxonomy';

const ITEMS_KEY = 'workspace_library_v1';
const TOPICS_KEY = 'workspace_topics_v1';

// ─── Topics ───────────────────────────────────────────────────────────────────

export function getWorkspaceTopics() {
  try {
    const raw = localStorage.getItem(TOPICS_KEY);
    if (!raw) return [...DEFAULT_WORKSPACE_TOPICS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_WORKSPACE_TOPICS];
  } catch {
    return [...DEFAULT_WORKSPACE_TOPICS];
  }
}

export function saveWorkspaceTopics(topics) {
  try {
    localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
  } catch {}
}

export function addWorkspaceTopic({ name, parentId = null, emoji = null }) {
  const topics = getWorkspaceTopics();
  const newTopic = {
    id: `wt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(name || '').trim(),
    parentId: parentId || null,
    emoji: emoji || null,
    createdAt: new Date().toISOString(),
  };
  topics.push(newTopic);
  saveWorkspaceTopics(topics);
  return newTopic;
}

export function updateWorkspaceTopic(id, updates) {
  const topics = getWorkspaceTopics();
  const idx = topics.findIndex(t => t.id === id);
  if (idx === -1) return;
  topics[idx] = { ...topics[idx], ...updates };
  saveWorkspaceTopics(topics);
}

/**
 * Returns { ok: true } on success.
 * Returns { ok: false, count: N } if saved items reference this topic (or its sub-topics),
 * in which case nothing is deleted.
 */
export function deleteWorkspaceTopic(id) {
  const allTopics = getWorkspaceTopics();
  const items = getWorkspaceItems();

  const idsToDelete = new Set([
    id,
    ...allTopics.filter(t => t.parentId === id).map(t => t.id),
  ]);

  const affectedCount = items.filter(
    i => idsToDelete.has(i.topicId) || idsToDelete.has(i.subTopicId)
  ).length;

  if (affectedCount > 0) {
    return { ok: false, count: affectedCount };
  }

  saveWorkspaceTopics(allTopics.filter(t => !idsToDelete.has(t.id)));
  return { ok: true, count: 0 };
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function getWorkspaceItems() {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _saveItems(items) {
  try {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  } catch {}
}

export function saveWorkspaceItem(item) {
  const items = getWorkspaceItems();
  const videoId = item.videoId;
  const idx = videoId ? items.findIndex(i => i.videoId === videoId) : -1;

  if (idx !== -1) {
    items[idx] = { ...items[idx], ...item, updatedAt: new Date().toISOString() };
  } else {
    items.unshift({
      ...item,
      id: item.id || `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt: item.savedAt || new Date().toISOString(),
    });
  }
  _saveItems(items);
}

/** §22 Bulk save — writes all items in one pass. */
export function saveWorkspaceItemsBulk(items = []) {
  if (!items.length) return { saved: 0, failed: 0 };
  const existing = getWorkspaceItems();
  let saved = 0;
  let failed = 0;
  const next = [...existing];
  const now = new Date().toISOString();
  items.forEach((item) => {
    if (!item) { failed++; return; }
    const videoId = item.videoId;
    const idx = videoId ? next.findIndex(i => i.videoId === videoId) : -1;
    if (idx !== -1) {
      next[idx] = { ...next[idx], ...item, updatedAt: now };
    } else {
      next.unshift({
        ...item,
        id: item.id || `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        savedAt: item.savedAt || now,
      });
    }
    saved++;
  });
  _saveItems(next);
  return { saved, failed };
}

export function updateWorkspaceItem(id, updates) {
  const items = getWorkspaceItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  _saveItems(items);
}

export function deleteWorkspaceItem(id) {
  _saveItems(getWorkspaceItems().filter(i => i.id !== id));
}

export function isVideoInWorkspaceLibrary(videoId) {
  if (!videoId) return false;
  try {
    return getWorkspaceItems().some(i => i.videoId === videoId);
  } catch {
    return false;
  }
}

export function getWorkspaceItemByVideoId(videoId) {
  if (!videoId) return null;
  try {
    return getWorkspaceItems().find(i => i.videoId === videoId) || null;
  } catch {
    return null;
  }
}

export function updateWorkspaceItemByVideoId(videoId, updates) {
  if (!videoId) return;
  const items = getWorkspaceItems();
  const idx = items.findIndex(i => i.videoId === videoId);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  _saveItems(items);
}
