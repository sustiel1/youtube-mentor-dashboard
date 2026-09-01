import { getWorkspaceNavigationCollectionForItem } from '@/config/workspaceHeadingRegistry';
import { getWorkspaceSourceVideoId } from '@/utils/workspaceItemIdentity';
import { getVirtualNavigationPathForCanonicalDestination } from '@/utils/workspaceVirtualTaxonomy';

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map(value => String(value || '').trim())
    .filter(Boolean))];
}

/**
 * Builds the canonical Workspace Library destination for records confirmed by
 * a successful persistence result. `itemId` remains the durable deep-link;
 * revealRecordIds/revealToken are transient in-memory navigation state and are
 * intentionally omitted by getWorkspaceLibraryUrl on reload.
 */
export function buildWorkspaceSaveRevealParams({
  persistenceResult,
  recordIds = [],
  topics = [],
  tokenFactory = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
} = {}) {
  if (!persistenceResult?.ok || !Array.isArray(persistenceResult.persistedItems)) return null;

  const requestedIds = uniqueIds(recordIds);
  const persistedById = new Map(
    persistenceResult.persistedItems
      .filter(item => item?.id)
      .map(item => [String(item.id), item]),
  );
  const confirmedRecords = requestedIds.map(id => persistedById.get(id)).filter(Boolean);
  if (confirmedRecords.length === 0) return null;

  const confirmedIds = confirmedRecords.map(item => String(item.id));
  const first = confirmedRecords[0];
  const sourceVideoIds = uniqueIds(confirmedRecords.map(getWorkspaceSourceVideoId));
  const collections = uniqueIds(confirmedRecords.map(item => (
    getWorkspaceNavigationCollectionForItem(item, 'unclassified')
  )));
  const topicPaths = confirmedRecords.map(item => (
    getVirtualNavigationPathForCanonicalDestination(item.topicId, item.subTopicId, topics)
  ));
  const sharedTopicId = uniqueIds(topicPaths.map(path => path.topicId));
  const sharedSubtopicId = uniqueIds(topicPaths.map(path => path.subtopicId));

  return {
    itemId: first.id,
    ...(sourceVideoIds.length === 1 ? { video: sourceVideoIds[0] } : {}),
    ...(collections.length === 1 ? { collection: collections[0] } : {}),
    ...(sharedTopicId.length === 1 ? { topicId: sharedTopicId[0] } : {}),
    ...(sharedSubtopicId.length === 1 ? { subtopicId: sharedSubtopicId[0] } : {}),
    revealRecordIds: confirmedIds,
    revealCount: confirmedIds.length,
    revealToken: String(tokenFactory()),
  };
}

