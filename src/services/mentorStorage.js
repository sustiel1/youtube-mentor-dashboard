// ─── Mentor Storage Service ───────────────────────────────────────────────────
// localStorage-based soft-delete for mentors loaded from mock data.
// Hidden mentors are excluded from all lists, auto-sync, and RSS tab.
//
// Key: "yt_mentor_hidden_ids_v1" → string[] of mentor IDs
//
// API:
//   hideMentor(id)              → add to hidden list
//   restoreMentor(id)           → remove from hidden list
//   getHiddenMentorIds()        → string[]
//   filterVisibleMentors(list)  → return list minus hidden IDs

const HIDDEN_KEY = "yt_mentor_hidden_ids_v1";

function readIds() {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn("[mentorStorage] write failed:", e.message);
  }
}

export function hideMentor(id) {
  const ids = readIds();
  if (!ids.includes(id)) {
    writeIds([...ids, id]);
  }
}

export function restoreMentor(id) {
  writeIds(readIds().filter((x) => x !== id));
}

export function getHiddenMentorIds() {
  return readIds();
}

export function filterVisibleMentors(mentors) {
  const hidden = new Set(readIds());
  return mentors.filter((m) => !hidden.has(m.id));
}
