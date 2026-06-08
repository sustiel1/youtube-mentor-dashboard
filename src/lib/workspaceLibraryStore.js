const ITEMS_KEY = 'workspace_library_v1';
const TOPICS_KEY = 'workspace_topics_v1';
const SEED_DATE = '2024-01-01T00:00:00.000Z';

const DEFAULT_TOPICS = [
  { id: 'wt-politics', name: 'פוליטיקה', parentId: null, emoji: '🏛', createdAt: SEED_DATE },
  { id: 'wt-politics-judicial', name: 'רפורמה משפטית', parentId: 'wt-politics', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-politics-religion', name: 'דת ומדינה', parentId: 'wt-politics', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-politics-security', name: 'ביטחון', parentId: 'wt-politics', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-politics-arab-jewish', name: 'יחסי ערבים-יהודים', parentId: 'wt-politics', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-politics-economy', name: 'כלכלה פוליטית', parentId: 'wt-politics', emoji: null, createdAt: SEED_DATE },

  { id: 'wt-markets', name: 'שוק ההון', parentId: null, emoji: '📈', createdAt: SEED_DATE },
  { id: 'wt-markets-fundamental', name: 'ניתוח פונדמנטלי', parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-technical', name: 'ניתוח טכני', parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-macro', name: 'מקרו', parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-etf', name: 'ETF', parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-markets-value', name: 'השקעת ערך', parentId: 'wt-markets', emoji: null, createdAt: SEED_DATE },

  { id: 'wt-ai', name: 'בינה מלאכותית וטכנולוגיה', parentId: null, emoji: '🤖', createdAt: SEED_DATE },
  { id: 'wt-ai-tools', name: 'כלי AI', parentId: 'wt-ai', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-ai-automation', name: 'אוטומציה', parentId: 'wt-ai', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-ai-programming', name: 'תכנות', parentId: 'wt-ai', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-ai-agents', name: 'סוכנים', parentId: 'wt-ai', emoji: null, createdAt: SEED_DATE },

  { id: 'wt-health', name: 'בריאות ותזונה', parentId: null, emoji: '🥗', createdAt: SEED_DATE },
  { id: 'wt-health-keto', name: 'קטו', parentId: 'wt-health', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-health-diabetes', name: 'סוכרת', parentId: 'wt-health', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-health-nutrition', name: 'תזונה', parentId: 'wt-health', emoji: null, createdAt: SEED_DATE },
  { id: 'wt-health-exercise', name: 'ספורט', parentId: 'wt-health', emoji: null, createdAt: SEED_DATE },

  { id: 'wt-general', name: 'כללי', parentId: null, emoji: '📁', createdAt: SEED_DATE },
];

// ─── Topics ───────────────────────────────────────────────────────────────────

export function getWorkspaceTopics() {
  try {
    const raw = localStorage.getItem(TOPICS_KEY);
    if (!raw) return [...DEFAULT_TOPICS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_TOPICS];
  } catch {
    return [...DEFAULT_TOPICS];
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

export function deleteWorkspaceTopic(id) {
  let topics = getWorkspaceTopics();
  topics = topics.filter(t => t.id !== id && t.parentId !== id);
  saveWorkspaceTopics(topics);
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
