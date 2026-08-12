import {
  WORKSPACE_COLLECTION_HEADINGS,
  WORKSPACE_FALLBACK_COLLECTION,
  getWorkspaceNavigationCollectionForItem,
} from '../config/workspaceHeadingRegistry.js';

export const WORKSPACE_COLLECTIONS = [
  ...WORKSPACE_COLLECTION_HEADINGS,
  WORKSPACE_FALLBACK_COLLECTION,
];

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

export function getWorkspaceCollectionId(item) {
  return getWorkspaceNavigationCollectionForItem(item, 'unclassified');
}

function searchableText(item) {
  const snapshot = item?.itemType === 'structured-snapshot' ? item.structuredSnapshot : null;
  return [
    item?.videoTitle, item?.title, item?.savedTitle, item?.notes, item?.fullNotes,
    item?.symbol, item?.ticker, item?.asset, item?.companyName, item?.channelName,
    item?.source, item?.sourceTab, ...(Array.isArray(item?.tags) ? item.tags : []),
    snapshot ? JSON.stringify(snapshot) : '',
  ].filter(Boolean).join(' ').toLocaleLowerCase('he');
}

export function createWorkspaceLibraryPresentation(items = []) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const all = [...safeItems];
  const byCollection = Object.fromEntries(
    WORKSPACE_COLLECTIONS.map(collection => [collection.id, []]),
  );

  for (const item of all) byCollection[getWorkspaceCollectionId(item)].push(item);

  const counts = Object.fromEntries(Object.entries(byCollection).map(([key, value]) => [key, value.length]));
  counts.all = all.length;

  return {
    all,
    byCollection,
    counts,
    ids: all.map(item => item.id),
    search(query, source = all) {
      const needle = normalized(query);
      return needle ? source.filter(item => searchableText(item).includes(needle)) : [...source];
    },
    select(collectionId = 'all') {
      return collectionId === 'all' ? [...all] : [...(byCollection[collectionId] || [])];
    },
  };
}
