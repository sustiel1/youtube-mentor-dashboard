// Persistent topic/category overrides for ALL mentors (mock + custom).
// Allows mock mentors (from mockData.js) to have their topic changed without
// touching the immutable mock array.
// Key: "yt_mentor_topic_overrides_v1" → { [mentorId]: OverrideEntry }
//
// OverrideEntry shape:
//   { topicIds, category, subTopic, subTopicId, updatedAt }

const STORAGE_KEY = "yt_mentor_topic_overrides_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[mentorTopicOverrides] write failed:", e?.message);
  }
}

export function getMentorTopicOverrides() {
  return readAll();
}

export function getMentorTopicOverride(mentorId) {
  if (!mentorId) return null;
  return readAll()[mentorId] ?? null;
}

export function setMentorTopicOverride(mentorId, data) {
  if (!mentorId) return null;
  const all = readAll();
  all[mentorId] = {
    ...(all[mentorId] ?? {}),
    ...data,
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[mentorId];
}

export function clearMentorTopicOverride(mentorId) {
  if (!mentorId) return;
  const all = readAll();
  delete all[mentorId];
  writeAll(all);
}

// Apply stored overrides on top of a mentor array (non-destructive merge).
// Fields overwritten: topicIds, category, subTopic, subTopicId, updatedAt.
export function applyTopicOverridesToMentors(mentors) {
  const overrides = readAll();
  if (!Object.keys(overrides).length) return mentors;
  return mentors.map((m) => {
    const ov = overrides[m.id];
    if (!ov) return m;
    const { updatedAt, ...fields } = ov;
    return { ...m, ...fields, topicOverrideUpdatedAt: updatedAt };
  });
}
