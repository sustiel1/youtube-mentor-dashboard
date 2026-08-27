/**
 * Merges sidecar-stored row timestamps into an analysis object for
 * rendering — called ONCE at the video boundary (e.g. a useMemo keyed on
 * videoId + sidecar version), never per-row during render. Every row
 * lookup against the pre-built index is O(1) (see resolveFromIndex).
 *
 * Never mutates the input analysis or its items. A sidecar entry (fresh,
 * fingerprint-valid) always overlays onto a row; if there is no matching
 * sidecar entry, an item's own PRE-EXISTING time fields (from the earlier,
 * now-removed automatic generation) are left exactly as they are —
 * "existing stored timestamps may continue to render if valid" is
 * preserved by simply never touching such items.
 */
import { ROW_FIELD_TABS, extractRows } from './rowExtraction.js';
import { resolveFromIndex } from './rowTimestampSidecar.js';

export function mergeRowTimestampsIntoAnalysis(analysis, annotationIndex, fieldTabs = ROW_FIELD_TABS) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  if (!annotationIndex || annotationIndex.size === 0) return analysis;

  const rows = extractRows(analysis, fieldTabs);
  if (rows.length === 0) return analysis;

  const merged = { ...analysis };
  for (const [, field] of fieldTabs) {
    if (Array.isArray(merged[field])) merged[field] = merged[field].slice();
  }

  for (const row of rows) {
    const annotation = resolveFromIndex(annotationIndex, row.rowPath, row.text);
    if (!annotation) continue;
    const original = merged[row.field][row.index];
    const originalItem = typeof original === 'string' ? { text: original } : { ...original };
    merged[row.field][row.index] = {
      ...originalItem,
      estimatedStartSeconds: annotation.estimatedStartSeconds,
      estimatedEndSeconds: annotation.estimatedEndSeconds ?? null,
      timestampKind: 'estimated',
      timestampSource: 'row-timestamp-opt-in',
      timestampConfidence: annotation.timestampConfidence ?? null,
      sourceQuote: annotation.sourceQuote,
    };
  }

  return merged;
}
