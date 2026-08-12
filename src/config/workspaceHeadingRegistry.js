const DEFINITIONS = [
  {
    sourceTabId: 'summary',
    label: 'סיכום',
    icon: '📝',
    workspaceCollection: 'summary',
    description: 'סיכומים שנבחרו ונשמרו',
    legacyAliases: ['summary'],
    legacyItemTypes: ['summary'],
  },
  {
    sourceTabId: 'chapters',
    label: 'פרקים',
    icon: '📚',
    workspaceCollection: 'chapters',
    description: 'פרקים שנבחרו ונשמרו',
    legacyAliases: ['chapters'],
    legacyItemTypes: ['chapter', 'chapters'],
  },
  {
    sourceTabId: 'insights',
    label: 'תובנות',
    icon: '💡',
    workspaceCollection: 'insights',
    description: 'תובנות שנבחרו ונשמרו',
    legacyAliases: ['insights', 'insight'],
    legacyItemTypes: ['insight', 'insights', 'ai-insights'],
  },
  {
    sourceTabId: 'useful-knowledge',
    label: 'ידע שימושי',
    icon: '🧠',
    workspaceCollection: 'knowledge',
    description: 'כללים, לקחים וצ׳קליסטים שנשמרו',
    legacyAliases: ['useful-knowledge', 'knowledge', 'lessons'],
    legacyItemTypes: ['knowledge', 'rule', 'lesson', 'checklist'],
  },
  {
    sourceTabId: 'app-builder',
    label: 'APP',
    icon: '🚀',
    workspaceCollection: 'apps',
    description: 'רעיונות ובריפים לבניית אפליקציות',
    legacyAliases: ['app-builder', 'app builder', 'app', 'apps'],
    legacyItemTypes: ['app', 'app-builder'],
  },
  {
    sourceTabId: 'topics-subtopics',
    label: 'נושאים ותתי־נושאים',
    icon: '🏷️',
    workspaceCollection: 'topics',
    description: 'נושאים ותתי־נושאים שנשמרו',
    legacyAliases: ['topics-subtopics', 'topics'],
    legacyItemTypes: ['topic', 'topics'],
  },
  {
    sourceTabId: 'specialized',
    label: 'תוכן ייעודי',
    icon: '🎯',
    workspaceCollection: 'specialized',
    description: 'תוכן ייעודי שנבחר ונשמר',
    legacyAliases: ['specialized'],
    legacyItemTypes: ['specialized'],
  },
  {
    sourceTabId: 'structured-snapshot',
    analysisLabel: 'Structured Snapshot',
    label: 'תמונת מצב',
    icon: '📊',
    workspaceCollection: 'snapshots',
    description: 'תמונות מצב היסטוריות שנשמרו',
    legacyAliases: ['structured-snapshot', 'snapshot', 'snapshots'],
    legacyItemTypes: ['structured-snapshot'],
  },
];

export const WORKSPACE_HEADING_REGISTRY = Object.freeze(Object.fromEntries(
  DEFINITIONS.map(definition => [definition.sourceTabId, Object.freeze({ ...definition })]),
));

export const VIDEO_ANALYSIS_HEADINGS = Object.freeze(
  DEFINITIONS.filter(definition => definition.sourceTabId !== 'structured-snapshot'),
);

export const WORKSPACE_COLLECTION_HEADINGS = Object.freeze(VIDEO_ANALYSIS_HEADINGS.map(definition => Object.freeze({
  id: definition.workspaceCollection,
  sourceTabId: definition.sourceTabId,
  label: definition.label,
  emoji: definition.icon,
  description: definition.description,
})));

export const WORKSPACE_PERSISTED_COLLECTION_IDS = Object.freeze(
  DEFINITIONS.map(definition => definition.workspaceCollection),
);

export const WORKSPACE_FALLBACK_COLLECTION = Object.freeze({
  id: 'unclassified',
  sourceTabId: null,
  label: 'פריטים נוספים',
  emoji: '📦',
  description: 'פריטים היסטוריים שאין להם שיוך חד־משמעי',
});

export const WORKSPACE_LIBRARY_COLLECTIONS = Object.freeze([
  ...WORKSPACE_COLLECTION_HEADINGS,
  WORKSPACE_FALLBACK_COLLECTION,
]);

export const WORKSPACE_COLLECTION_IDS = Object.freeze(
  WORKSPACE_COLLECTION_HEADINGS.map(definition => definition.id),
);

const normalize = value => String(value ?? '').trim().toLowerCase();
const SOURCE_TAB_BY_ALIAS = new Map();
const SOURCE_TAB_BY_ITEM_TYPE = new Map();

for (const definition of DEFINITIONS) {
  SOURCE_TAB_BY_ALIAS.set(normalize(definition.sourceTabId), definition.sourceTabId);
  definition.legacyAliases.forEach(alias => SOURCE_TAB_BY_ALIAS.set(normalize(alias), definition.sourceTabId));
  definition.legacyItemTypes.forEach(itemType => SOURCE_TAB_BY_ITEM_TYPE.set(normalize(itemType), definition.sourceTabId));
}

const SOURCE_TAB_BY_COLLECTION = new Map(
  DEFINITIONS.map(definition => [definition.workspaceCollection, definition.sourceTabId]),
);

export function getWorkspaceHeadingBySourceTab(sourceTabId) {
  const canonicalId = SOURCE_TAB_BY_ALIAS.get(normalize(sourceTabId));
  return canonicalId ? WORKSPACE_HEADING_REGISTRY[canonicalId] : null;
}

export function getWorkspaceHeadingByCollection(workspaceCollection) {
  const sourceTabId = SOURCE_TAB_BY_COLLECTION.get(normalize(workspaceCollection));
  return sourceTabId ? WORKSPACE_HEADING_REGISTRY[sourceTabId] : null;
}

export function getWorkspaceHeadingLabel(sourceTabId, fallback = '') {
  return getWorkspaceHeadingBySourceTab(sourceTabId)?.label || fallback;
}

/**
 * Backward-compatible, read-only classification. The priority is deliberately
 * structured: stable provenance, structured payload/type, canonical metadata,
 * then an explicit legacy alias. Titles and free-form Hebrew text are ignored.
 */
export function classifyWorkspaceItemHeading(item = {}) {
  const stable = getWorkspaceHeadingBySourceTab(item.sourceTabId);
  if (stable) return stable;

  if (item.itemType === 'structured-snapshot' && item.structuredSnapshot) {
    return WORKSPACE_HEADING_REGISTRY['structured-snapshot'];
  }
  if (item.appPayload || item.appBrief) return WORKSPACE_HEADING_REGISTRY['app-builder'];

  const canonical = getWorkspaceHeadingByCollection(item.workspaceCollection);
  if (canonical) return canonical;

  const legacyCandidates = [item.sourceTab, item.savedSectionType, item.sectionType];
  for (const candidate of legacyCandidates) {
    const definition = getWorkspaceHeadingBySourceTab(candidate);
    if (definition) return definition;
  }

  const legacyItemType = SOURCE_TAB_BY_ITEM_TYPE.get(normalize(item.itemType));
  return legacyItemType ? WORKSPACE_HEADING_REGISTRY[legacyItemType] : null;
}

export function getWorkspaceCollectionForItem(item = {}, fallback = 'unclassified') {
  return classifyWorkspaceItemHeading(item)?.workspaceCollection || fallback;
}

/**
 * Maps persisted item types to the seven visible Workspace destinations.
 * Structured Snapshot remains a stable persisted type, but its navigation
 * destination is the canonical Targeted Content collection.
 */
export function getWorkspaceNavigationCollectionForItem(item = {}, fallback = 'unclassified') {
  const persistedCollection = getWorkspaceCollectionForItem(item, fallback);
  return persistedCollection === 'snapshots' ? 'specialized' : persistedCollection;
}

export function normalizeWorkspaceNavigationCollection(value, fallback = null) {
  const normalized = normalize(value);
  if (!normalized) return fallback;
  if (normalized === 'snapshots') return 'specialized';
  return WORKSPACE_COLLECTION_IDS.includes(normalized) || normalized === WORKSPACE_FALLBACK_COLLECTION.id
    ? normalized
    : fallback;
}

export function createWorkspaceProvenance({
  sourceVideoId,
  sourceTabId,
  sourceSectionId,
  sourceHeading,
  workspaceCollection,
  semanticTags = [],
} = {}) {
  const heading = getWorkspaceHeadingBySourceTab(sourceTabId)
    || getWorkspaceHeadingByCollection(workspaceCollection);
  if (!heading) return null;
  return {
    sourceVideoId: sourceVideoId ? String(sourceVideoId) : null,
    sourceTabId: heading.sourceTabId,
    sourceSectionId: sourceSectionId ? String(sourceSectionId) : 'unsectioned',
    sourceHeading: String(sourceHeading || heading.label),
    workspaceCollection: heading.workspaceCollection,
    semanticTags: [...new Set((Array.isArray(semanticTags) ? semanticTags : []).map(value => String(value || '').trim().toLowerCase()).filter(Boolean))],
  };
}
