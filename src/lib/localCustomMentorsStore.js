// User-added mentors in local-first mode (Base44 off).
// Key: "yt_custom_mentors_v1" → Mentor-shaped objects (see useAddMentorWithSource).

const STORAGE_KEY = "yt_custom_mentors_v1";

function normalizeChannelId(value) {
  const id = String(value || "").trim();
  return id.startsWith("UC") && id.length === 24 ? id : "";
}

export function getLocalCustomMentors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    throw new Error(`לא ניתן לשמור ל-localStorage: ${e?.message || "שגיאה לא ידועה"}`);
  }
}

export function appendLocalCustomMentor(mentor) {
  const next = [...getLocalCustomMentors(), mentor];
  writeAll(next);
  return mentor;
}

export function updateLocalCustomMentorById(id, updates) {
  const list = getLocalCustomMentors();
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...updates };
  const next = [...list];
  next[idx] = updated;
  writeAll(next);
  return updated;
}

export function upsertLocalCustomMentor(mentor) {
  const list = getLocalCustomMentors();
  const nextMentor = mentor && typeof mentor === "object" ? { ...mentor } : null;
  if (!nextMentor) throw new Error("Mentor payload is required");

  const incomingChannelId = normalizeChannelId(
    nextMentor.youtubeChannelId || nextMentor.channelId || ""
  );
  const incomingSourceUrl = String(
    nextMentor.youtubePageUrl || nextMentor.channelUrl || nextMentor.youtubeUrl || ""
  ).trim();

  const existingIndex = list.findIndex((item) => {
    const itemChannelId = normalizeChannelId(item.youtubeChannelId || item.channelId || "");
    const itemSourceUrl = String(item.youtubePageUrl || item.channelUrl || item.youtubeUrl || "").trim();
    if (incomingChannelId && itemChannelId === incomingChannelId) return true;
    if (incomingSourceUrl && itemSourceUrl && itemSourceUrl === incomingSourceUrl) return true;
    return false;
  });

  if (existingIndex >= 0) {
    const merged = { ...list[existingIndex], ...nextMentor };
    const next = [...list];
    next[existingIndex] = merged;
    writeAll(next);
    return merged;
  }

  const next = [...list, nextMentor];
  writeAll(next);
  return nextMentor;
}
