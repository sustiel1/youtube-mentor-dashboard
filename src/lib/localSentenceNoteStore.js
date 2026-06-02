const STORAGE_KEY = "yt_sentence_notes_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("[sentenceNoteStore] write failed:", e?.message);
  }
}

function emit(videoId) {
  try {
    window.dispatchEvent(new CustomEvent("sentence-notes-updated", { detail: { videoId } }));
  } catch {}
}

export function getSentenceNotesByVideo(videoId) {
  if (!videoId) return [];
  return readAll()
    .filter((n) => n.videoId === videoId)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

export function getSentenceNote(videoId, rowKey) {
  if (!videoId || !rowKey) return null;
  const id = `snote:${videoId}:${rowKey}`;
  return readAll().find((n) => n.id === id) || null;
}

export function upsertSentenceNote({ videoId, rowKey, sentence, note, category, videoTitle }) {
  if (!videoId || !rowKey) return null;
  const all = readAll();
  const id = `snote:${videoId}:${rowKey}`;
  const now = new Date().toISOString();
  const existing = all.find((n) => n.id === id);
  const item = {
    id,
    videoId,
    rowKey,
    sentence: sentence || "",
    note: note || "",
    category: category || null,
    videoTitle: videoTitle || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const next = existing ? all.map((n) => (n.id === id ? item : n)) : [...all, item];
  writeAll(next);
  emit(videoId);
  return item;
}

export function deleteSentenceNote(videoId, rowKey) {
  if (!videoId || !rowKey) return;
  const id = `snote:${videoId}:${rowKey}`;
  writeAll(readAll().filter((n) => n.id !== id));
  emit(videoId);
}
