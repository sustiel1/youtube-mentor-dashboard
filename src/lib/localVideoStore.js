// ─── Local Video Store ─────────────────────────────────────────────────────────
// Fallback persistence layer when Base44 is unavailable.
// Stores ingested videos in localStorage so they survive page refresh.
//
// Priority chain in useVideos:
//   1. Base44 (production)
//   2. localStorage — real ingested videos (dev, no Base44)
//   3. mockData    — only when localStorage is also empty

const STORAGE_KEY = "yt_mentor_videos_v1";

export function getLocalVideos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function hasLocalVideos() {
  return getLocalVideos().length > 0;
}

// Save one video, return the saved record (with generated id)
export function saveLocalVideo(videoData) {
  const videos = getLocalVideos();

  // Dedup by URL before saving
  const urlExists = videos.some((v) => v.url === videoData.url);
  if (urlExists) return null; // already exists

  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = { ...videoData, id };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...videos, record]));
  } catch (e) {
    // localStorage quota exceeded — unlikely but handle gracefully
    console.warn("[localVideoStore] localStorage write failed:", e.message);
  }

  return record;
}

// Update fields on an existing local video by id
// Returns the updated record, or null if not found
export function updateLocalVideo(id, updates) {
  const videos = getLocalVideos();
  const idx = videos.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  const updated = { ...videos[idx], ...updates };
  videos[idx] = updated;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch (e) {
    console.warn("[localVideoStore] localStorage write failed:", e.message);
  }
  return updated;
}

// Clear all locally stored videos (used for reset)
export function clearLocalVideos() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getLocalVideoCount() {
  return getLocalVideos().length;
}
