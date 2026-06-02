// Browser-side Google Drive client.
// All calls are proxied through the Vite dev server at /api/gdrive/*
// — no Drive credentials ever reach the browser bundle.

let _statusCache = null; // { connected, email } — updated on connect/check

export async function getDriveStatus() {
  try {
    const res = await fetch('/api/gdrive/status');
    if (!res.ok) return { connected: false, email: null };
    const data = await res.json();
    _statusCache = data;
    return data;
  } catch {
    return { connected: false, email: null };
  }
}

export function getCachedDriveStatus() {
  return _statusCache;
}

export async function getDriveAuthUrl() {
  const res = await fetch('/api/gdrive/auth-url');
  if (!res.ok) throw new Error('Failed to get Drive auth URL');
  const { url } = await res.json();
  return url;
}

// Find or create the analysis root folder in Drive.
export async function ensureDriveFolder() {
  const res = await fetch('/api/gdrive/folder', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to ensure Drive folder');
  return res.json(); // { folderId, created }
}

// Read the index file: { videoId → { driveFileId, savedAt } }
export async function getDriveIndex() {
  const res = await fetch('/api/gdrive/index');
  if (!res.ok) throw new Error('Failed to read Drive index');
  return res.json(); // { index, folderId, indexFileId }
}

// Write the index file back to Drive.
export async function saveDriveIndex(folderId, indexFileId, index) {
  const res = await fetch('/api/gdrive/index', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId, indexFileId, index }),
  });
  if (!res.ok) throw new Error('Failed to save Drive index');
  return res.json(); // { ok, indexFileId }
}

// Read a Drive file by ID. Returns null if the file was not found (404).
export async function readDriveFile(fileId) {
  const res = await fetch(`/api/gdrive/files/${fileId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to read Drive file ${fileId}`);
  return res.json();
}

// Create a new file inside folderId with the given name and JSON data.
export async function createDriveFile(folderId, fileName, data) {
  const res = await fetch('/api/gdrive/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId, fileName, data }),
  });
  if (!res.ok) throw new Error(`Failed to create Drive file ${fileName}`);
  return res.json(); // { fileId }
}

// Update an existing Drive file with new JSON content.
// Returns null if the file no longer exists (caller should recreate).
export async function updateDriveFile(fileId, data) {
  const res = await fetch(`/api/gdrive/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to update Drive file ${fileId}`);
  return res.json(); // { ok: true }
}

// Delete a Drive file. Returns false if already gone (404).
export async function deleteDriveFile(fileId) {
  const res = await fetch(`/api/gdrive/files/${fileId}`, { method: 'DELETE' });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Failed to delete Drive file ${fileId}`);
  return true;
}

// Create nested Drive folders from a path array, returning the leaf folder ID.
// e.g. ["YouTubeMentor", "שוק ההון", "שיטות"] → creates all levels, returns deepest ID.
export async function ensureDriveFolderPath(pathParts) {
  const res = await fetch('/api/gdrive/folder-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pathParts }),
  });
  if (!res.ok) throw new Error(`ensureDriveFolderPath failed: ${res.status}`);
  return res.json(); // { folderId }
}
