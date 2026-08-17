import { APP_DATA_STORES } from './storageManifest.js';

const WORKSPACE_SOURCE_KEY = 'workspace_library_v1';

function stableWorkspaceRecordId(index, recordId) {
  return `${WORKSPACE_SOURCE_KEY}:${index}:${String(recordId || '')}`;
}

export function buildWorkspaceProjectionRecords(items, generationId) {
  const workspaceItems = [];
  const snapshots = [];

  items.forEach((item, index) => {
    const recordId = String(item?.id || '');
    const id = stableWorkspaceRecordId(index, recordId);
    const videoId = String(
      item?.videoId || item?.sourceVideoId || item?.structuredSnapshot?.videoId || '',
    ) || null;
    workspaceItems.push({
      generationId,
      id,
      recordId,
      sourceIndex: index,
      videoId,
      itemType: item?.itemType || null,
      topicId: item?.topicId || null,
      subTopicId: item?.subTopicId || item?.subtopicId || null,
      value: item,
    });

    if (item?.itemType === 'structured-snapshot' && item?.structuredSnapshot) {
      snapshots.push({
        generationId,
        id,
        workspaceItemId: recordId || null,
        videoId,
        schemaVersion: String(
          item.structuredSnapshot.schemaVersion || item.structuredSnapshot.version || 'legacy',
        ),
        value: item.structuredSnapshot,
      });
    }
  });

  return {
    [APP_DATA_STORES.WORKSPACE_ITEMS]: workspaceItems,
    [APP_DATA_STORES.SNAPSHOTS]: snapshots,
  };
}
