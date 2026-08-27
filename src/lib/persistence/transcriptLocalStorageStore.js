export const TRANSCRIPT_LOCAL_STORAGE_KEY = 'yt_mentor_transcript_cache_v1';
// שני origins של loopback מורשים בכוונה לשמירת תמלול ב-localStorage:
// Vite מגיש כברירת מחדל על http://localhost:5184, בעוד חלק מכלי ה-QA/e2e ניגשים דרך 127.0.0.1.
export const AUTHORIZED_TRANSCRIPT_LOCAL_STORAGE_ORIGINS = Object.freeze([
  'http://127.0.0.1:5184',
  'http://localhost:5184',
]);
// תאימות לאחור: הייצוא הישן מצביע על ה-origin הראשי ברשימה.
export const AUTHORIZED_TRANSCRIPT_LOCAL_STORAGE_ORIGIN = AUTHORIZED_TRANSCRIPT_LOCAL_STORAGE_ORIGINS[0];

const MIN_TRANSCRIPT_CHARS = 30;

export function getTranscriptPersistenceDecision({
  requestedBackend = 'localStorage',
  location = globalThis.location,
} = {}) {
  const normalizedRequestedBackend = String(requestedBackend || '').trim().toLowerCase() === 'indexeddb'
    ? 'indexedDB'
    : 'localStorage';
  const origin = String(location?.origin || '').trim() || null;
  if (origin && AUTHORIZED_TRANSCRIPT_LOCAL_STORAGE_ORIGINS.includes(origin)) {
    return {
      backend: 'localStorage',
      origin,
      requestedBackend: normalizedRequestedBackend,
      policy: 'authorized-transcript-localstorage-origin',
      fallback: false,
    };
  }
  return {
    backend: normalizedRequestedBackend,
    origin,
    requestedBackend: normalizedRequestedBackend,
    policy: 'requested-transcript-backend',
    fallback: false,
  };
}

function isQuotaExceeded(error) {
  return error?.name === 'QuotaExceededError'
    || error?.code === 22
    || error?.code === 1014;
}

export class TranscriptLocalStoragePersistenceError extends Error {
  constructor(message, { code, operation, cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'TranscriptLocalStoragePersistenceError';
    this.code = code || 'localstorage-write-failed';
    this.operation = operation || 'unknown';
  }
}

export function isTranscriptLocalStoragePersistenceError(error) {
  return error?.name === 'TranscriptLocalStoragePersistenceError';
}

function getStorage(storage) {
  const resolved = storage || globalThis.localStorage;
  if (!resolved) {
    throw new TranscriptLocalStoragePersistenceError(
      'האחסון המקומי אינו זמין, ולכן התמלול לא נשמר.',
      { code: 'localstorage-unavailable', operation: 'resolve-storage' },
    );
  }
  return resolved;
}

function parseCacheMap(storage, { strict = false } = {}) {
  let raw;
  try {
    raw = getStorage(storage).getItem(TRANSCRIPT_LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('Transcript cache root must be an object');
    }
    return parsed;
  } catch (error) {
    if (!strict) return {};
    throw new TranscriptLocalStoragePersistenceError(
      'מטמון התמלולים הקיים אינו קריא; לא בוצעה דריסה שלו.',
      { code: 'localstorage-cache-invalid', operation: 'read-before-write', cause: error },
    );
  }
}

function normalizeSegment(segment) {
  const text = String(segment?.text || '').trim();
  const startSeconds = Number(segment?.startSeconds ?? segment?.start ?? 0);
  const durationSeconds = Number(segment?.durationSeconds ?? segment?.duration ?? segment?.dur ?? 0);
  if (!text || !Number.isFinite(startSeconds)) return null;
  return {
    text,
    startSeconds,
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : 0,
    start: startSeconds,
  };
}

function normalizePayload(payload) {
  const body = typeof payload?.body === 'string' ? payload.body : '';
  const segments = Array.isArray(payload?.segments)
    ? payload.segments.map(normalizeSegment).filter(Boolean)
    : [];
  const textLength = Math.max(
    body.trim().length,
    segments.reduce((sum, segment) => sum + segment.text.length, 0),
  );
  if (textLength < MIN_TRANSCRIPT_CHARS) {
    throw new TypeError('A usable transcript payload is required');
  }
  const fetchedAt = payload?.fetchedAt || payload?.importedAt || new Date().toISOString();
  return {
    body,
    lang: payload?.lang || payload?.language || null,
    segments,
    fetchedAt,
    importedAt: payload?.importedAt || fetchedAt,
    source: payload?.source || 'youtube-timedtext',
    status: payload?.status || 'youtube',
    quality: payload?.quality || 'low',
  };
}

export function readTranscriptLocalCache(videoId, {
  storage = null,
  maxAgeMs = null,
  now = Date.now(),
} = {}) {
  const normalizedId = String(videoId || '').trim();
  if (!normalizedId) return null;
  const entry = parseCacheMap(storage)[normalizedId];
  if (!entry) return null;
  try {
    const normalized = normalizePayload(entry);
    if (Number.isFinite(maxAgeMs)) {
      const fetchedAt = Date.parse(normalized.fetchedAt || '');
      if (!fetchedAt || now - fetchedAt >= maxAgeMs) return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function writeTranscriptLocalCache(videoId, payload, { storage = null } = {}) {
  const normalizedId = String(videoId || '').trim();
  if (!normalizedId) throw new TypeError('videoId is required');
  const resolvedStorage = getStorage(storage);
  const map = parseCacheMap(resolvedStorage, { strict: true });
  const normalized = normalizePayload(payload);
  map[normalizedId] = normalized;
  const serialized = JSON.stringify(map);

  try {
    resolvedStorage.setItem(TRANSCRIPT_LOCAL_STORAGE_KEY, serialized);
    if (resolvedStorage.getItem(TRANSCRIPT_LOCAL_STORAGE_KEY) !== serialized) {
      throw new Error('Transcript cache read-after-write mismatch');
    }
  } catch (error) {
    const quotaExceeded = isQuotaExceeded(error);
    throw new TranscriptLocalStoragePersistenceError(
      quotaExceeded
        ? 'הורדת התמלול הצליחה, אך localStorage מלא ולכן התמלול לא נשמר. לא דווחה הצלחה.'
        : 'הורדת התמלול הצליחה, אך שמירת התמלול ב-localStorage נכשלה. לא דווחה הצלחה.',
      {
        code: quotaExceeded ? 'localstorage-quota-exceeded' : 'localstorage-write-failed',
        operation: 'write-transcript-cache',
        cause: error,
      },
    );
  }

  return {
    ok: true,
    storage: 'localStorage',
    key: TRANSCRIPT_LOCAL_STORAGE_KEY,
    videoId: normalizedId,
    entryCount: Object.keys(map).length,
    payloadCodeUnits: JSON.stringify(normalized).length,
  };
}

export function deleteTranscriptLocalCache(videoId, { storage = null } = {}) {
  const normalizedId = String(videoId || '').trim();
  if (!normalizedId) return false;
  const resolvedStorage = getStorage(storage);
  const map = parseCacheMap(resolvedStorage, { strict: true });
  if (!(normalizedId in map)) return false;
  delete map[normalizedId];
  resolvedStorage.setItem(TRANSCRIPT_LOCAL_STORAGE_KEY, JSON.stringify(map));
  return true;
}
