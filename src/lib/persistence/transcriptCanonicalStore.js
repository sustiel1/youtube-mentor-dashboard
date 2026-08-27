import { createAppDataRepository, openAppDataDb } from './appDataDb.js';
import { APP_DATA_STORES } from './storageManifest.js';
import { APPLICATION_STORAGE_MODES, getApplicationStorageMode } from './storageMode.js';

let repositoryPromise = null;
let databasePromise = null;

export function getCanonicalTranscriptRecordId(videoId) {
  const normalized = String(videoId || '').trim();
  if (!normalized) throw new TypeError('videoId is required');
  return `youtube_transcript_${normalized}`;
}

function normalizeTranscriptPayload(payload) {
  const body = typeof payload?.body === 'string' ? payload.body : '';
  const segments = Array.isArray(payload?.segments)
    ? payload.segments.map((segment) => ({
        text: String(segment?.text || '').trim(),
        startSeconds: Number(segment?.startSeconds ?? segment?.start ?? 0),
        durationSeconds: Number(segment?.durationSeconds ?? segment?.duration ?? 0),
      })).filter((segment) => segment.text && Number.isFinite(segment.startSeconds))
    : [];
  const textLength = body.trim().length || segments.reduce((sum, segment) => sum + segment.text.length, 0);
  if (textLength < 40) throw new TypeError('A usable transcript payload is required');
  return {
    body,
    segments,
    source: payload?.source || 'youtube-timedtext',
    language: payload?.language || payload?.lang || null,
    status: payload?.status || 'youtube',
    quality: payload?.quality || 'low',
    importedAt: payload?.importedAt || new Date().toISOString(),
  };
}

async function resolveRuntimeRepository(mode) {
  if (mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) return null;
  if (!databasePromise) {
    databasePromise = openAppDataDb().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  if (!repositoryPromise) {
    repositoryPromise = databasePromise.then(createAppDataRepository).catch((error) => {
      repositoryPromise = null;
      throw error;
    });
  }
  return repositoryPromise;
}

export function createTranscriptCanonicalStore({ repository = null } = {}) {
  async function getActiveGeneration() {
    if (!repository) return null;
    const active = await repository.readMeta('activeGeneration');
    return active?.state === 'active' ? active.generationId : null;
  }

  async function read(videoId) {
    if (!repository) return null;
    const generationId = await getActiveGeneration();
    if (!generationId) return null;
    const id = getCanonicalTranscriptRecordId(videoId);
    const [record] = await repository.readRecords(APP_DATA_STORES.TRANSCRIPTS, [[generationId, id]]);
    if (!record?.payload) return null;
    try {
      return {
        data: normalizeTranscriptPayload(record.payload),
        storage: 'indexedDB',
        objectStore: APP_DATA_STORES.TRANSCRIPTS,
        generationId,
        id,
      };
    } catch {
      return null;
    }
  }

  async function write(videoId, payload) {
    const data = normalizeTranscriptPayload(payload);
    const id = getCanonicalTranscriptRecordId(videoId);
    if (!repository) return { ok: false, code: 'indexeddb-repository-unavailable', id };
    const generationId = await getActiveGeneration();
    if (!generationId) return { ok: false, code: 'indexeddb-active-generation-missing', id };
    const record = {
      generationId,
      id,
      videoId: String(videoId),
      kind: 'youtube',
      payload: data,
      savedAt: data.importedAt,
    };
    try {
      await repository.writeBatch(APP_DATA_STORES.TRANSCRIPTS, [record]);
      const [readBack] = await repository.readRecords(APP_DATA_STORES.TRANSCRIPTS, [[generationId, id]]);
      if (!readBack || JSON.stringify(readBack.payload) !== JSON.stringify(data)) {
        throw new Error('IndexedDB transcript read-after-write mismatch');
      }
      return {
        ok: true,
        storage: 'indexedDB',
        objectStore: APP_DATA_STORES.TRANSCRIPTS,
        generationId,
        id,
        payloadCodeUnits: JSON.stringify(data).length,
      };
    } catch (error) {
      return {
        ok: false,
        code: `indexeddb-${error?.name || 'write-failed'}`,
        storage: 'indexedDB',
        objectStore: APP_DATA_STORES.TRANSCRIPTS,
        id,
        exceptionName: error?.name || 'Error',
        exceptionMessage: error?.message || String(error),
      };
    }
  }

  async function remove(videoId) {
    const id = getCanonicalTranscriptRecordId(videoId);
    if (!repository?.deleteRecords) return { ok: false, code: 'indexeddb-delete-unavailable', id };
    const generationId = await getActiveGeneration();
    if (!generationId) return { ok: false, code: 'indexeddb-active-generation-missing', id };
    try {
      await repository.deleteRecords(APP_DATA_STORES.TRANSCRIPTS, [[generationId, id]]);
      const [readBack] = await repository.readRecords(APP_DATA_STORES.TRANSCRIPTS, [[generationId, id]]);
      if (readBack) throw new Error('IndexedDB transcript delete read-back mismatch');
      return { ok: true, storage: 'indexedDB', objectStore: APP_DATA_STORES.TRANSCRIPTS, generationId, id };
    } catch (error) {
      return {
        ok: false,
        code: `indexeddb-${error?.name || 'delete-failed'}`,
        storage: 'indexedDB',
        objectStore: APP_DATA_STORES.TRANSCRIPTS,
        id,
        exceptionName: error?.name || 'Error',
        exceptionMessage: error?.message || String(error),
      };
    }
  }

  return { read, write, remove };
}

async function getRuntimeStore() {
  const mode = getApplicationStorageMode();
  const repository = await resolveRuntimeRepository(mode);
  return { mode, store: createTranscriptCanonicalStore({ repository }) };
}

export async function readCanonicalTranscript(videoId) {
  const { mode, store } = await getRuntimeStore();
  if (mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) return null;
  try {
    return await store.read(videoId);
  } catch {
    return null;
  }
}

export async function writeCanonicalTranscript(videoId, payload) {
  const { mode, store } = await getRuntimeStore();
  if (mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) {
    return { ok: false, code: 'indexeddb-mode-inactive', storage: 'localStorage' };
  }
  return store.write(videoId, payload);
}

export async function deleteCanonicalTranscript(videoId) {
  const { mode, store } = await getRuntimeStore();
  if (mode !== APPLICATION_STORAGE_MODES.INDEXED_DB) {
    return { ok: false, code: 'indexeddb-mode-inactive', storage: 'localStorage' };
  }
  return store.remove(videoId);
}
