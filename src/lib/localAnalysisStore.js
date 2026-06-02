import { isDriveConnected, writeDriveAnalysis, readDriveAnalysis } from './gdriveAnalysisStore.js';

const STORAGE_PREFIX = "analysis:";

function getAnalysisKey(videoId) {
  return `${STORAGE_PREFIX}${videoId}`;
}

export function loadSavedAnalysis(videoId) {
  if (!videoId) return null;
  try {
    const raw = localStorage.getItem(getAnalysisKey(videoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSavedAnalysis(videoId, payload) {
  if (!videoId || !payload || typeof payload !== "object") return false;
  try {
    localStorage.setItem(
      getAnalysisKey(videoId),
      JSON.stringify({
        version: 1,
        videoId,
        savedAt: new Date().toISOString(),
        ...payload,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function deleteSavedAnalysis(videoId) {
  if (!videoId) return false;
  try {
    localStorage.removeItem(getAnalysisKey(videoId));
    return true;
  } catch {
    return false;
  }
}

// ── Drive-aware wrappers (Phase 2 + Phase 3) ─────────────────────────────────

// Phase 2: Write to localStorage (sync, unchanged) then mirror to Drive (async, fire-and-forget).
export async function saveSavedAnalysisWithDrive(videoId, payload) {
  saveSavedAnalysis(videoId, payload);
  if (!isDriveConnected()) return;
  try {
    await writeDriveAnalysis(videoId, payload);
  } catch (e) {
    console.warn('[localAnalysisStore] Drive mirror write failed:', e.message);
  }
}

// Phase 3: Return localStorage data immediately; if Drive has a newer version,
// refresh localStorage and invoke onDriveLoaded so the UI can update silently.
export function loadSavedAnalysisWithDrive(videoId, { onDriveLoaded } = {}) {
  const local = loadSavedAnalysis(videoId);

  if (isDriveConnected()) {
    readDriveAnalysis(videoId)
      .then((remote) => {
        if (!remote) return;
        const remoteNewer = !local?.savedAt || remote.savedAt > local.savedAt;
        if (remoteNewer) {
          saveSavedAnalysis(videoId, remote);
          onDriveLoaded?.(remote);
        }
      })
      .catch(() => {}); // Drive unavailable — silently ignore
  }

  return local;
}

