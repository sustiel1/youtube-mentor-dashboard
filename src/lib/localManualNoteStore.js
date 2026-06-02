const STORAGE_KEY = "yt_manual_notes_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn("[localManualNoteStore] write failed:", e.message);
  }
}

function generateId() {
  return `mn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Returns all manual notes, newest first
export function getManualNotes() {
  return readAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Returns notes for a specific topicId (includes notes where subtopicId also belongs to that topic)
export function getManualNotesByTopic(topicId) {
  if (!topicId) return [];
  return readAll().filter(
    (n) => n.topicId === topicId || n.subtopicId === topicId
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Returns a single note by id, or null if not found
export function getManualNote(id) {
  return readAll().find((n) => n.id === id) ?? null;
}

// Creates a new note. Returns the saved note object.
// Required: topicId, title, content
// Optional: subtopicId, sourceType, tags
export function saveManualNote({ topicId, subtopicId = null, title, content, sourceType = "manual", tags = [] }) {
  const now = new Date().toISOString();
  const note = {
    id: generateId(),
    topicId: topicId ?? null,
    subtopicId: subtopicId ?? null,
    title: (title || "").trim(),
    content: content || "",
    sourceType,
    tags: Array.isArray(tags) ? tags : [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([...readAll(), note]);
  return note;
}

// Updates an existing note by id. Returns the updated note, or null if not found.
export function updateManualNote(id, updates) {
  const all = readAll();
  const idx = all.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, id, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

// Removes a note by id. Returns true if deleted, false if not found.
export function deleteManualNote(id) {
  const all = readAll();
  const filtered = all.filter((n) => n.id !== id);
  if (filtered.length === all.length) return false;
  writeAll(filtered);
  return true;
}
