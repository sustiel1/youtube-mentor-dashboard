// ─── Mentor Scan Freeze Storage ───────────────────────────────────────────────
// Tracks which mentors are excluded from automatic scans ("frozen").
// Frozen mentors still exist and their videos remain; only Fetch All skips them.
// Manual per-mentor fetch always works regardless of frozen state.
//
// Key: "yt_mentor_scan_frozen_v1" → string[] of mentor IDs

const FROZEN_KEY = "yt_mentor_scan_frozen_v1";

function readIds() {
  try {
    const raw = localStorage.getItem(FROZEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  try {
    localStorage.setItem(FROZEN_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn("[mentorScanStorage] write failed:", e.message);
  }
}

export function freezeMentor(id) {
  const ids = readIds();
  if (!ids.includes(id)) {
    writeIds([...ids, id]);
  }
}

export function unfreezeMentor(id) {
  writeIds(readIds().filter((x) => x !== id));
}

export function isMentorFrozen(id) {
  return readIds().includes(id);
}

export function getFrozenMentorIds() {
  return readIds();
}

export function toggleMentorFreeze(id) {
  if (isMentorFrozen(id)) {
    unfreezeMentor(id);
    return false;
  } else {
    freezeMentor(id);
    return true;
  }
}
