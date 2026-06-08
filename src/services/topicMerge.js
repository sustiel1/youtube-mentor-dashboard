// Topic merge and integrity utilities.
// All operations work directly on localStorage to avoid circular dependency chains.

const VIDEOS_KEY    = "yt_mentor_videos_v2";
const KI_KEY        = "yt_knowledge_items_v1";
const TOPICS_KEY    = "yt_topic_user_v1";
const OVERRIDES_KEY = "yt_mentor_topic_overrides_v1";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`[topicMerge] write failed for ${key}:`, e?.message);
  }
}

/** Returns groups of topics that share the same normalised name (duplicates). */
export function detectDuplicateTopics(allTopics) {
  const byName = new Map();
  allTopics.forEach(t => {
    const key = String(t.name || "").trim().toLowerCase();
    if (!key) return;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(t);
  });
  return [...byName.values()].filter(group => group.length > 1);
}

/** Count how many videos have topicId in their topicIds array. */
export function countVideosByTopic(topicId, videos) {
  return videos.filter(v => Array.isArray(v.topicIds) && v.topicIds.includes(topicId)).length;
}

/** Count direct child topics. */
export function countSubTopics(topicId, allTopics) {
  return allTopics.filter(t => t.parentId === topicId).length;
}

/**
 * Merge mergeId into keepId across all local stores.
 * Returns stats { videos, knowledgeItems, subTopics, mentors }.
 */
export function mergeTopics(keepId, mergeId) {
  if (!keepId || !mergeId || keepId === mergeId) return { videos: 0, knowledgeItems: 0, subTopics: 0, mentors: 0 };
  const stats = { videos: 0, knowledgeItems: 0, subTopics: 0, mentors: 0 };

  // ── 1. Videos ──────────────────────────────────────────────────────────────
  const videos = readJSON(VIDEOS_KEY, []);
  let videosChanged = false;
  const updatedVideos = videos.map(v => {
    const ids = Array.isArray(v.topicIds) ? v.topicIds : [];
    if (!ids.includes(mergeId)) return v;
    stats.videos++;
    videosChanged = true;
    return { ...v, topicIds: [...new Set(ids.map(id => id === mergeId ? keepId : id))] };
  });
  if (videosChanged) writeJSON(VIDEOS_KEY, updatedVideos);

  // ── 2. Knowledge items (Brain) ─────────────────────────────────────────────
  const items = readJSON(KI_KEY, []);
  let itemsChanged = false;
  const updatedItems = items.map(item => {
    const patches = {};
    if (item.topicId === mergeId)     { patches.topicId = keepId;     itemsChanged = true; stats.knowledgeItems++; }
    if (item.subBrainId === mergeId)  { patches.subBrainId = keepId;  itemsChanged = true; }
    const metaPatches = {};
    if (item.metadata?.topicId === mergeId) { metaPatches.topicId = keepId; itemsChanged = true; }
    return Object.keys(patches).length || Object.keys(metaPatches).length
      ? { ...item, ...patches, metadata: { ...(item.metadata || {}), ...metaPatches } }
      : item;
  });
  if (itemsChanged) writeJSON(KI_KEY, updatedItems);

  // ── 3. User topics — move sub-topics + delete mergeId ─────────────────────
  const userTopics = readJSON(TOPICS_KEY, []);
  let topicsChanged = false;
  const movedSubTopics = userTopics.map(t => {
    if (t.parentId === mergeId) { topicsChanged = true; stats.subTopics++; return { ...t, parentId: keepId }; }
    return t;
  });
  // Remove the merged topic if it's user-added
  const finalTopics = movedSubTopics.filter(t => t.id !== mergeId);
  if (topicsChanged || finalTopics.length < movedSubTopics.length) writeJSON(TOPICS_KEY, finalTopics);

  // ── 4. Mentor topic overrides ──────────────────────────────────────────────
  const overrides = readJSON(OVERRIDES_KEY, {});
  let ovChanged = false;
  Object.keys(overrides).forEach(mentorId => {
    const ov = overrides[mentorId];
    if (!Array.isArray(ov.topicIds)) return;
    if (!ov.topicIds.includes(mergeId)) return;
    ovChanged = true;
    stats.mentors++;
    overrides[mentorId] = { ...ov, topicIds: [...new Set(ov.topicIds.map(id => id === mergeId ? keepId : id))] };
  });
  if (ovChanged) writeJSON(OVERRIDES_KEY, overrides);

  return stats;
}
