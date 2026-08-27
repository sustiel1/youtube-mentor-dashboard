import { classifyStorageError } from './persistence/storageIntegrity.js';

export const GEMS_STORAGE_QUOTA_MESSAGE =
  'האחסון בדפדפן מלא. התוכן לא נשמר והנתונים הקיימים לא שונו.';

export const GEMS_DRAFT_QUOTA_WARNING =
  'טיוטת הקלט לא נשמרה כי אחסון הדפדפן מלא. עדיין אפשר להתחיל ניתוח; השמירה הסופית תיבדק בנפרד. הנתונים הקיימים לא שונו.';

export const GEMS_DRAFT_STORAGE_WARNING =
  'טיוטת הקלט לא נשמרה בדפדפן. עדיין אפשר להתחיל ניתוח; השמירה הסופית תיבדק בנפרד.';

export const GEMS_MARKET_BRIEF_SIDECAR_WARNING =
  'הניתוח נשמר ברשומת הסרטון, אך עותק התאימות של Market Brief לא עודכן. הנתונים הקודמים בעותק התאימות נשמרו.';

export class GemsLocalPersistenceError extends Error {
  constructor(message, { classification, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'GemsLocalPersistenceError';
    this.classification = classification || 'storage-operation-failed';
    this.code = this.classification === 'quota-exceeded'
      ? 'GEMS_STORAGE_QUOTA_EXCEEDED'
      : 'GEMS_STORAGE_WRITE_FAILED';
  }
}

export function getGemsDraftPersistenceWarning(error) {
  return error?.classification === 'quota-exceeded'
    ? GEMS_DRAFT_QUOTA_WARNING
    : GEMS_DRAFT_STORAGE_WARNING;
}

export function persistVerifiedLocalValue(
  key,
  value,
  storage = globalThis.localStorage,
) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  try {
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) {
      throw new Error('localStorage read-back mismatch');
    }
    return serialized;
  } catch (error) {
    const classification = classifyStorageError(error);
    const message = classification === 'quota-exceeded'
      ? GEMS_STORAGE_QUOTA_MESSAGE
      : 'שמירת נתוני GEMS המקומיים נכשלה. התוכן לא נשמר.';
    throw new GemsLocalPersistenceError(message, { classification, cause: error });
  }
}

/**
 * Commits the canonical video record before touching the compatibility sidecar.
 * A failed required commit leaves the previous sidecar untouched. A sidecar
 * failure after a verified video commit is reported as a warning because the
 * canonical record is already durable and wins reload selection by timestamp.
 */
export function persistCommittedMarketBrief({
  videoId,
  marketBriefData,
  commitVideo,
  storage = globalThis.localStorage,
}) {
  if (typeof commitVideo !== 'function') {
    throw new TypeError('commitVideo must be a function');
  }

  const savedVideo = commitVideo();
  if (!savedVideo) {
    throw new GemsLocalPersistenceError(
      'שמירת הניתוח הסופי נכשלה. לא דווחה הצלחה והנתונים הקיימים נשמרו.',
      { classification: 'storage-operation-failed' },
    );
  }

  let sidecarError = null;
  if (videoId) {
    try {
      persistVerifiedLocalValue(`market_brief_${videoId}`, marketBriefData, storage);
    } catch (error) {
      sidecarError = error;
    }
  }

  return {
    savedVideo,
    sidecarPersisted: !sidecarError,
    sidecarError,
    sidecarWarning: sidecarError ? GEMS_MARKET_BRIEF_SIDECAR_WARNING : null,
  };
}
