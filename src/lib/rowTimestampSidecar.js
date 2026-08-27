/**
 * Sidecar storage for opt-in row timestamps (WORK-ID YMD-ONDEMAND-ROW-TIMES).
 *
 * Deliberately separate from the video/analysis record: never overwrites or
 * mutates the underlying analysis. Keyed by video + stable row path +
 * content fingerprint, so a row whose text later changes automatically
 * stops matching its old annotation (see resolveAnnotation).
 *
 * Storage-agnostic: every function takes a plain `store` object with
 * `{ get(key), set(key, value), delete(key), keys() }` — synchronous, so
 * lookups stay O(1) and safe to call during render. `createMemoryStore()`
 * (used by tests and previews) and `createLocalStorageStore()` (for real
 * persistence, one JSON blob per video under its own key — never touches
 * the existing video/analysis storage) both satisfy this interface.
 */

/** Small, fast, synchronous non-cryptographic hash (djb2) — sufficient for
 * change-detection fingerprinting, not a security control. */
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/** Normalizes text before fingerprinting (trim + collapse internal
 * whitespace) so trivial formatting differences don't spuriously
 * invalidate an otherwise-unchanged row. */
export function normalizeRowText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

export function fingerprintRowText(text) {
  return djb2(normalizeRowText(text));
}

export function buildRowPath(tab, field, index) {
  return `${tab}.${field}[${index}]`;
}

export function buildSidecarKey(videoId, rowPath) {
  return `${videoId}::${rowPath}`;
}

export function createMemoryStore() {
  const map = new Map();
  return {
    get: (key) => (map.has(key) ? map.get(key) : null),
    set: (key, value) => { map.set(key, value); },
    delete: (key) => { map.delete(key); },
    keys: () => Array.from(map.keys()),
  };
}

const LOCAL_STORAGE_PREFIX = 'yt_mentor_row_timestamps_v1::';

/** Real persistence adapter: one localStorage entry per (video, row path) —
 * a distinct key namespace from the video/analysis storage, so it can never
 * overwrite it. Not exercised against real browser storage by any
 * automated test in this codebase; tests use createMemoryStore(). */
export function createLocalStorageStore() {
  return {
    get: (key) => {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try { localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value)); } catch { /* quota or disabled storage — non-fatal */ }
    },
    delete: (key) => {
      try { localStorage.removeItem(LOCAL_STORAGE_PREFIX + key); } catch { /* non-fatal */ }
    },
    keys: () => {
      const out = [];
      try {
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (k && k.startsWith(LOCAL_STORAGE_PREFIX)) out.push(k.slice(LOCAL_STORAGE_PREFIX.length));
        }
      } catch { /* non-fatal */ }
      return out;
    },
  };
}

/**
 * Saves ONLY the accepted/checked annotations from a preview batch. Each
 * annotation must already carry a `fingerprint` computed from the exact row
 * text it was generated against.
 */
export function saveAnnotations(store, videoId, annotations) {
  const saved = [];
  for (const ann of annotations) {
    if (!ann || !ann.rowPath || !ann.fingerprint) continue;
    const key = buildSidecarKey(videoId, ann.rowPath);
    store.set(key, {
      rowPath: ann.rowPath,
      fingerprint: ann.fingerprint,
      estimatedStartSeconds: ann.estimatedStartSeconds,
      estimatedEndSeconds: ann.estimatedEndSeconds ?? null,
      timestampConfidence: ann.timestampConfidence ?? null,
      sourceQuote: ann.sourceQuote,
      createdAt: ann.createdAt || Date.now(),
    });
    saved.push(key);
  }
  return saved;
}

/**
 * O(1) lookup for render: returns the stored annotation for `rowPath` ONLY
 * if it exists AND its stored fingerprint matches the row's CURRENT text —
 * otherwise returns null (silently, not an error: this is the "row text
 * materially changed" invalidation path, not a failure).
 */
export function resolveAnnotation(store, videoId, rowPath, currentText) {
  const entry = store.get(buildSidecarKey(videoId, rowPath));
  if (!entry) return null;
  if (entry.fingerprint !== fingerprintRowText(currentText)) return null;
  return entry;
}

/** Builds an O(1) lookup index for a whole video at once — call this ONCE
 * at the video boundary (e.g. in a useMemo keyed on videoId), never inside
 * a per-row render. */
export function indexAnnotationsForVideo(store, videoId) {
  const prefix = `${videoId}::`;
  const index = new Map();
  for (const key of store.keys()) {
    if (!key.startsWith(prefix)) continue;
    const entry = store.get(key);
    if (entry?.rowPath) index.set(entry.rowPath, entry);
  }
  return index;
}

/** Pure O(1) lookup against a pre-built index (see indexAnnotationsForVideo) —
 * this is the function actual rendering should call. */
export function resolveFromIndex(index, rowPath, currentText) {
  const entry = index.get(rowPath);
  if (!entry) return null;
  if (entry.fingerprint !== fingerprintRowText(currentText)) return null;
  return entry;
}

export const ROW_TIMESTAMP_RESULT_STATUS = Object.freeze({
  MAPPED: 'mapped',
  STALE: 'stale',
  UNMATCHED: 'unmatched',
  ORPHAN: 'orphan',
});

function validAnnotationSeconds(annotation) {
  const seconds = annotation?.estimatedStartSeconds;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0;
}

/**
 * Shared exact production-row resolver. Primary identity is always the
 * persisted legacy row path plus its canonical fingerprint. A renderer that
 * cannot carry the legacy path through a presentation transform may use the
 * guarded fallback: canonical fingerprint scoped to one tab, only when that
 * produces exactly one eligible descriptor.
 */
export function createRowTimestampResolver(descriptors, annotationIndex) {
  const rows = Array.isArray(descriptors) ? descriptors : [];
  const index = annotationIndex instanceof Map ? annotationIndex : new Map();
  const byLegacyPath = new Map();
  const byTabFingerprint = new Map();
  const bySourceObject = new WeakMap();

  rows.forEach((row) => {
    if (!row?.legacyRowPath || !row?.fingerprint) return;
    byLegacyPath.set(row.legacyRowPath, row);
    if (row.renderable === false) return;
    const key = `${row.tab}::${row.fingerprint}`;
    const bucket = byTabFingerprint.get(key) || [];
    bucket.push(row);
    byTabFingerprint.set(key, bucket);
    if (row.sourceItem && typeof row.sourceItem === 'object') {
      const sourceBucket = bySourceObject.get(row.sourceItem) || [];
      sourceBucket.push(row);
      bySourceObject.set(row.sourceItem, sourceBucket);
    }
  });

  const matchDescriptor = ({
    tab,
    section = null,
    productionRowId = null,
    legacyRowPath = null,
    sourceItem = null,
    canonicalSourceText = '',
    displayText = '',
  } = {}) => {
    const canonicalText = normalizeRowText(canonicalSourceText);
    if (!canonicalText) return null;
    const fingerprint = fingerprintRowText(canonicalText);

    if (legacyRowPath) {
      const exact = byLegacyPath.get(legacyRowPath);
      if (!exact || exact.renderable === false || exact.fingerprint !== fingerprint) return null;
      return { ...exact, section: section || exact.section, productionRowId: productionRowId || exact.productionRowId, displayText: displayText || exact.displayText };
    }

    if (sourceItem && typeof sourceItem === 'object') {
      const sourceCandidates = (bySourceObject.get(sourceItem) || [])
        .filter((candidate) => candidate.tab === tab && candidate.fingerprint === fingerprint);
      if (sourceCandidates.length === 1) {
        const [matched] = sourceCandidates;
        return { ...matched, section: section || matched.section, productionRowId: productionRowId || matched.productionRowId, displayText: displayText || matched.displayText };
      }
    }

    const candidates = byTabFingerprint.get(`${tab}::${fingerprint}`) || [];
    if (candidates.length !== 1) return null;
    const [matched] = candidates;
    return { ...matched, section: section || matched.section, productionRowId: productionRowId || matched.productionRowId, displayText: displayText || matched.displayText };
  };

  const resolve = (candidate) => {
    const descriptor = matchDescriptor(candidate);
    if (!descriptor) return null;
    const annotation = resolveFromIndex(index, descriptor.legacyRowPath, descriptor.canonicalSourceText);
    if (!validAnnotationSeconds(annotation)) return null;
    return { descriptor, annotation };
  };

  const classify = (rowsToClassify = rows) => rowsToClassify.map((row) => {
    const annotation = index.get(row.legacyRowPath || row.rowPath) || null;
    if (row.renderable === false) {
      return { ...row, annotation, status: ROW_TIMESTAMP_RESULT_STATUS.ORPHAN };
    }
    const sameFingerprintRows = byTabFingerprint.get(`${row.tab}::${row.fingerprint}`) || [];
    const sourceObjectRows = row.sourceItem && typeof row.sourceItem === 'object'
      ? (bySourceObject.get(row.sourceItem) || []).filter((candidate) => candidate.tab === row.tab && candidate.fingerprint === row.fingerprint)
      : [];
    if (sameFingerprintRows.length !== 1 && sourceObjectRows.length !== 1) {
      return { ...row, annotation, status: ROW_TIMESTAMP_RESULT_STATUS.ORPHAN };
    }
    if (!annotation) {
      return { ...row, annotation: null, status: ROW_TIMESTAMP_RESULT_STATUS.UNMATCHED };
    }
    if (annotation.fingerprint !== row.fingerprint) {
      return { ...row, annotation, status: ROW_TIMESTAMP_RESULT_STATUS.STALE };
    }
    if (!validAnnotationSeconds(annotation)) {
      return { ...row, annotation, status: ROW_TIMESTAMP_RESULT_STATUS.UNMATCHED };
    }
    return { ...row, annotation, status: ROW_TIMESTAMP_RESULT_STATUS.MAPPED };
  });

  return { matchDescriptor, resolve, classify };
}

/**
 * Classifies current eligible rows against one already-built sidecar index.
 * This is deliberately synchronous and performs no storage scan or matching.
 */
export function classifyRowTimestampResults(rows, annotationIndex) {
  const descriptors = (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    legacyRowPath: row.legacyRowPath || row.rowPath,
    canonicalSourceText: row.canonicalSourceText || row.text,
    renderable: row.renderable !== false,
  }));
  return createRowTimestampResolver(descriptors, annotationIndex).classify(descriptors);
}

export function deleteAnnotationsForVideo(store, videoId) {
  const prefix = `${videoId}::`;
  const deleted = [];
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      deleted.push(key);
    }
  }
  return deleted;
}

export function deleteAnnotation(store, videoId, rowPath) {
  store.delete(buildSidecarKey(videoId, rowPath));
}
