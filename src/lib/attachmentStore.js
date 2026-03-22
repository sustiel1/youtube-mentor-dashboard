// ─── Attachment Store (IndexedDB) ─────────────────────────────────────────────
// Stores video screenshots / attachments in IndexedDB.
// IndexedDB supports binary data (base64 dataUrls) without the size limits
// of localStorage, making it the right choice for image files.
//
// Attachment structure:
//   { id, videoId, name, type, createdAt, dataUrl }
//
// dataUrl is a base64-encoded string produced by FileReader.readAsDataURL.
// It can be used directly as an <img src> value.
//
// Future migration path: replace saveAttachment / getAttachmentsByVideoId
// with API calls when a backend storage endpoint becomes available.

const DB_NAME = "yt_mentor_db_v1";
const STORE_NAME = "attachments";
const DB_VERSION = 1;

// Open (or create) the IndexedDB database
function openDB() {
  // Guard: IndexedDB may be absent (private browsing, some Firefox/Safari configs)
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error("IndexedDB אינו זמין בדפדפן זה"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // Create object store + index on first open (or version upgrade)
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        // Index by videoId so we can efficiently query per-video attachments
        store.createIndex("videoId", "videoId", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Fetch all attachments for a given video
export async function getAttachmentsByVideoId(videoId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const idx = tx.objectStore(STORE_NAME).index("videoId");
    const req = idx.getAll(videoId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

// Save a new attachment; returns the saved record (with generated id)
export async function saveAttachment({ videoId, name, type, dataUrl }) {
  const db = await openDB();
  const attachment = {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    videoId,
    name,
    type,
    createdAt: new Date().toISOString(),
    dataUrl,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(attachment);
    req.onsuccess = () => resolve(attachment);
    req.onerror = () => reject(req.error);
  });
}

// Delete an attachment by id
export async function deleteAttachment(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Read a File object and return its base64 dataUrl string
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
