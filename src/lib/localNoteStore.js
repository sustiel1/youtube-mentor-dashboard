// ─── Local Note Store ─────────────────────────────────────────────────────────
// Fallback persistence for Notes when Base44 is unavailable.
// Stores notes in localStorage (text-only — safe and stable for this use case).
//
// Note structure: { id, videoId, content, createdAt, updatedAt }
// (field is "content" to match existing NoteEditor and Note entity schema)
//
// Priority chain in useNotesByVideo:
//   1. Base44 (when connected)
//   2. localStorage — notes created offline
//   3. mockData — static sample notes

const STORAGE_KEY = "yt_mentor_notes_v1";

// Return all notes from localStorage
export function getLocalNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Return notes for a specific video
export function getNotesByVideoId(videoId) {
  return getLocalNotes().filter((n) => n.videoId === videoId);
}

// Create a new note and persist it; returns the saved record
// timestampSeconds / timestampLabel are optional — backward-compatible with old notes
export function createLocalNote({ videoId, content, timestampSeconds, timestampLabel }) {
  const notes = getLocalNotes();
  const note = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    videoId,
    content,
    ...(timestampSeconds != null && { timestampSeconds, timestampLabel }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...notes, note]));
  } catch (e) {
    console.warn("[localNoteStore] write failed:", e.message);
  }
  return note;
}

// Delete a note by id
export function deleteLocalNote(id) {
  const notes = getLocalNotes().filter((n) => n.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn("[localNoteStore] write failed:", e.message);
  }
}
