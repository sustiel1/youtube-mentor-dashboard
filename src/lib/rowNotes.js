// ─── Row-Level Notes ─────────────────────────────────────────────────────────
// Lets a user attach a note (+screenshots) to one specific list/checklist row,
// not just to the whole video. Reuses the existing per-video Note model/store —
// a note just gets an extra `rowId` field when it belongs to a row.
//
// Scope: every row that has a section identity (bulkSelection.idPrefix, already
// set by every LearningTabContent call site via mergeBulkSelection) and a known
// video — i.e. all tabs/rows, not just a pilot subset (widened 2026-09-11).
export function isRowNotesEnabledForPrefix(idPrefix) {
  return !!idPrefix;
}

// Small deterministic string hash (FNV-1a) — good enough for a stable, fixed-length
// row key; not cryptographic, collisions are not a real concern at this list size.
function fnv1aHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

// rowId is derived from the row's own text (not its array index) so a saved note
// keeps pointing at the same row even if the list is reordered/regenerated later —
// same principle isRowAlreadySaved already uses for the "saved to brain" indicator.
export function buildRowNoteId(idPrefix, text) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
  return `${idPrefix || "row"}:${fnv1aHash(normalized)}`;
}
