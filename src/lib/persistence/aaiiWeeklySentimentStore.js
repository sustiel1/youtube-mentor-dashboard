import { createAppDataRepository, openAppDataDb } from './appDataDb.js';
import { createStorageFacade } from './storageFacade.js';
import { APPLICATION_STORAGE_MODES, getApplicationStorageMode } from './storageMode.js';
import { createEmptyAaiiWeeklyStore, upsertAaiiWeeklyRecord } from '../aaiiWeeklySentiment.js';

export const AAII_WEEKLY_SENTIMENT_STORAGE_KEY = 'market_aaii_weekly_sentiment_v1';

let repositoryPromise = null;

// Reuses the same IndexedDB connection primitives as the rest of the app
// (openAppDataDb/createAppDataRepository) against the existing schema/generation —
// never creates, clears or migrates a generation. Resolves to null when the
// active storage mode is localStorage, in which case the facade transparently
// falls back to localStorage on its own.
async function resolveRepository() {
  if (getApplicationStorageMode() !== APPLICATION_STORAGE_MODES.INDEXED_DB) return null;
  if (!repositoryPromise) {
    repositoryPromise = openAppDataDb().then(createAppDataRepository).catch((error) => {
      repositoryPromise = null;
      throw error;
    });
  }
  try {
    return await repositoryPromise;
  } catch {
    return null;
  }
}

async function getFacade() {
  const repository = await resolveRepository();
  return createStorageFacade({ repository });
}

export async function readAaiiWeeklySentimentStore() {
  const facade = await getFacade();
  const value = await facade.getJson(AAII_WEEKLY_SENTIMENT_STORAGE_KEY, null);
  if (!value || typeof value !== 'object' || !value.records || typeof value.records !== 'object') {
    return createEmptyAaiiWeeklyStore();
  }
  return value;
}

export async function saveAaiiWeeklySentimentRecord(record) {
  const facade = await getFacade();
  const current = await readAaiiWeeklySentimentStore();
  const next = upsertAaiiWeeklyRecord(current, record);
  const result = await facade.setRaw(AAII_WEEKLY_SENTIMENT_STORAGE_KEY, JSON.stringify(next));
  if (!result.ok) {
    throw new Error(`Failed to persist AAII weekly sentiment record (${result.code})`);
  }
  return next;
}
