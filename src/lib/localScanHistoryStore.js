// Persistent scan history per mentor/channel.
// Key: "yt_scan_history_v1" → { [mentorId]: ScanRecord }
// ScanRecord shape:
//   { lastScannedAt, lastScanStatus, lastScanFoundCount, lastScanImportedCount, lastScanError, lastScanSource }
// lastScanStatus: "ok" | "no_new" | "error" | (null = not scanned)

const STORAGE_KEY = "yt_scan_history_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[scanHistory] write failed:", e?.message);
  }
}

export function getAllScanHistory() {
  return readAll();
}

export function getScanHistory(mentorId) {
  if (!mentorId) return null;
  return readAll()[mentorId] ?? null;
}

/**
 * @param {string} mentorId
 * @param {{ lastScanStatus: "ok"|"no_new"|"error", lastScanFoundCount?: number, lastScanImportedCount?: number, lastScanError?: string|null, lastScanSource?: string }} record
 */
export function setScanHistory(mentorId, record) {
  if (!mentorId) return;
  const all = readAll();
  all[mentorId] = {
    ...(all[mentorId] ?? {}),
    ...record,
    lastScannedAt: new Date().toISOString(),
  };
  writeAll(all);
  return all[mentorId];
}

export function clearScanHistory(mentorId) {
  if (!mentorId) return;
  const all = readAll();
  delete all[mentorId];
  writeAll(all);
}
