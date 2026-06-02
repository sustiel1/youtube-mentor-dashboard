// Google Drive analysis store.
// Mirrors per-video analysis snapshots to Drive for off-localStorage persistence.
//
// Drive folder: yt-mentor-analysis/
//   index.json       ← { videoId → { driveFileId, savedAt } }
//   videos/
//     ${videoId}.json  ← full buildAnalysisSnapshot() payload
//
// Usage:
//   setDriveConnected(true/false)   — called from DriveStatusBadge on app load
//   writeDriveAnalysis(id, payload) — mirror write after every analysis save
//   readDriveAnalysis(id)           — lazy load when panel opens (cache miss)
//   deleteDriveAnalysis(id)         — called when a video is deleted

import {
  ensureDriveFolder,
  ensureDriveFolderPath,
  getDriveIndex,
  saveDriveIndex,
  readDriveFile,
  createDriveFile,
  updateDriveFile,
  deleteDriveFile,
} from './gdriveClient.js';

// ── In-memory state ──────────────────────────────────────────────────────────
let _connected = false;
let _index = null;        // { videoId → { driveFileId, savedAt } } — lazy
let _folderId = null;
let _indexFileId = null;
let _indexLoading = null; // pending Promise to avoid parallel init

// ── Public API ───────────────────────────────────────────────────────────────

export function setDriveConnected(connected) {
  _connected = connected;
  if (!connected) {
    // Reset cached state so a reconnect starts fresh
    _index = null;
    _folderId = null;
    _indexFileId = null;
    _indexLoading = null;
  }
}

export function isDriveConnected() {
  return _connected;
}

// Write analysis payload to Drive. Fire-and-forget from callers.
export async function writeDriveAnalysis(videoId, payload) {
  if (!_connected) return;
  await _ensureIndex();

  const entry = _index[videoId];
  if (entry?.driveFileId) {
    const result = await updateDriveFile(entry.driveFileId, payload);
    if (result === null) {
      // File was deleted externally — fall through to recreate
      delete _index[videoId];
      await _createAnalysisFile(videoId, payload);
    }
  } else {
    await _createAnalysisFile(videoId, payload);
  }

  if (_index[videoId]) {
    _index[videoId].savedAt = payload.savedAt || new Date().toISOString();
  }
  console.log(`[gdriveAnalysis] mirror write succeeded for ${videoId}`);
}

// Read analysis from Drive. Returns null if not found or Drive is unavailable.
export async function readDriveAnalysis(videoId) {
  if (!_connected) return null;
  await _ensureIndex();

  const entry = _index[videoId];
  if (!entry?.driveFileId) return null;

  const data = await readDriveFile(entry.driveFileId);
  if (data === null) {
    // File deleted externally — clean up index
    delete _index[videoId];
    _persistIndex().catch(() => {});
    return null;
  }
  return data;
}

// Delete analysis from Drive (called when a video is removed).
export async function deleteDriveAnalysis(videoId) {
  if (!_connected) return;
  await _ensureIndex();

  const entry = _index[videoId];
  if (!entry?.driveFileId) return;

  try { await deleteDriveFile(entry.driveFileId); } catch {}
  delete _index[videoId];
  await _persistIndex();
}

// Manual backup: upload analysis to a mirrored Brain/Obsidian folder path in Drive.
// folderPath = "שוק ההון/שיטות" (human-readable, matches Obsidian structure)
// fileName   = "SafeTitle-videoId.json"
// Returns { fileId, drivePath }
export async function backupAnalysisToDrive(videoId, payload, folderPath, fileName) {
  if (!_connected) throw new Error('Drive not connected');
  const pathParts = ['YouTubeMentor', ...folderPath.split('/').filter(Boolean)];
  const { folderId } = await ensureDriveFolderPath(pathParts);
  const { fileId } = await createDriveFile(folderId, fileName, payload);
  console.log(`[gdriveAnalysis] manual backup succeeded: YouTubeMentor/${folderPath}/${fileName}`);
  return { fileId, drivePath: folderPath };
}

// Delete a Drive file by its direct fileId (for manual backup cleanup on video delete).
export async function deleteDriveFileById(fileId) {
  if (!_connected || !fileId) return;
  try {
    await deleteDriveFile(fileId);
  } catch (e) {
    console.warn('[gdriveAnalysis] deleteDriveFileById failed:', e.message);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function _ensureIndex() {
  if (_index !== null) return;
  if (_indexLoading) return _indexLoading;

  _indexLoading = (async () => {
    try {
      const { index, folderId, indexFileId } = await getDriveIndex();
      _index = index || {};
      _folderId = folderId;
      _indexFileId = indexFileId;

      if (!_folderId) {
        const { folderId: newId } = await ensureDriveFolder();
        _folderId = newId;
      }
    } catch (e) {
      console.warn('[gdriveAnalysis] index load failed:', e.message);
      _index = {};
    } finally {
      _indexLoading = null;
    }
  })();

  return _indexLoading;
}

async function _createAnalysisFile(videoId, payload) {
  if (!_folderId) return;
  try {
    const { fileId } = await createDriveFile(_folderId, `${videoId}.json`, payload);
    _index[videoId] = { driveFileId: fileId, savedAt: payload.savedAt || new Date().toISOString() };
    await _persistIndex();
  } catch (e) {
    console.warn('[gdriveAnalysis] createAnalysisFile failed:', e.message);
  }
}

async function _persistIndex() {
  if (!_folderId) return;
  try {
    const result = await saveDriveIndex(_folderId, _indexFileId, _index);
    if (result?.indexFileId && !_indexFileId) {
      _indexFileId = result.indexFileId;
    }
  } catch (e) {
    console.warn('[gdriveAnalysis] persistIndex failed:', e.message);
  }
}
