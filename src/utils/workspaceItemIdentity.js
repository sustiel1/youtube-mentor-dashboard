const VOLATILE_KEYS = new Set([
  'id', 'savedAt', 'updatedAt', 'createdAt', 'archivedAt', 'uiState',
  'selected', 'isSelected', 'sortIndex', 'displayOrder',
]);

function normalizeScalar(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (!value || typeof value !== 'object') return normalizeScalar(value);
  return Object.keys(value).sort().reduce((result, key) => {
    if (!VOLATILE_KEYS.has(key) && value[key] !== undefined) result[key] = normalizeJson(value[key]);
    return result;
  }, {});
}

function fnv1a64(text) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function getWorkspaceSourceVideoId(item) {
  return String(item?.sourceVideoId || item?.videoId || item?.structuredSnapshot?.videoId || '').trim() || null;
}

export function getStructuredSnapshotContent(item) {
  const snapshot = item?.structuredSnapshot;
  if (item?.itemType !== 'structured-snapshot' || !snapshot) return null;
  return normalizeJson({
    stocks: Array.isArray(snapshot.stocksTable) ? snapshot.stocksTable : Array.isArray(snapshot.stocks) ? snapshot.stocks : [],
    markets: Array.isArray(snapshot.marketsTable) ? snapshot.marketsTable : Array.isArray(snapshot.markets) ? snapshot.markets : [],
    sentiment: Array.isArray(snapshot.sentimentTable) ? snapshot.sentimentTable : Array.isArray(snapshot.sentiment) ? snapshot.sentiment : [],
  });
}

export function getWorkspaceItemIdentity(item) {
  const sourceVideoId = getWorkspaceSourceVideoId(item);
  const itemType = String(item?.itemType || '').trim();
  if (!sourceVideoId || !itemType) return null;

  let normalizedContent;
  if (itemType === 'structured-snapshot') normalizedContent = getStructuredSnapshotContent(item);
  else if (item?.identityPayload) normalizedContent = normalizeJson(item.identityPayload);
  else return null;

  const schemaVersion = String(item?.structuredSnapshot?.schemaVersion || item?.structuredSnapshot?.version || 'legacy');
  const sourceSection = String(item?.sourceTab || item?.savedSectionType || item?.sectionType || '').trim();
  const contentHash = fnv1a64(JSON.stringify(normalizedContent));
  return {
    key: [sourceVideoId, itemType, sourceSection, schemaVersion, contentHash].join('|'),
    sourceVideoId,
    itemType,
    sourceSection,
    schemaVersion,
    contentHash,
  };
}

export function buildWorkspaceDuplicatePreview(items = []) {
  const identityGroups = new Map();
  const versionGroups = new Map();
  for (const item of items) {
    const identity = getWorkspaceItemIdentity(item);
    if (!identity) continue;
    const exact = identityGroups.get(identity.key) || [];
    exact.push({ item, identity });
    identityGroups.set(identity.key, exact);
    const versionKey = [identity.sourceVideoId, identity.itemType, identity.sourceSection, identity.schemaVersion].join('|');
    const versions = versionGroups.get(versionKey) || [];
    versions.push({ item, identity });
    versionGroups.set(versionKey, versions);
  }

  const exactDuplicates = [...identityGroups.values()].filter(group => group.length > 1).map(group => {
    const sorted = [...group].sort((a, b) => String(a.item.savedAt || '').localeCompare(String(b.item.savedAt || '')) || String(a.item.id).localeCompare(String(b.item.id)));
    return {
      kind: 'exact',
      canonicalId: sorted[0].item.id,
      proposedRemovalIds: sorted.slice(1).map(entry => entry.item.id),
      records: sorted,
    };
  });

  const historicalVersions = [...versionGroups.values()].filter(group => new Set(group.map(entry => entry.identity.contentHash)).size > 1).map(records => ({ kind: 'versions', records }));
  return { exactDuplicates, historicalVersions };
}
