const SPECIALIZED_SECTION_PRIORITY = Object.freeze([
  new Set(['sentiment', 'brief-sentiment']),
  new Set(['market-regime']),
  new Set(['economic-calendar', 'brief-calendar']),
  new Set(['macro', 'brief-macro']),
]);

const OPPORTUNITIES_RISKS_SECTION_KEYS = new Set([
  'opportunities-risks',
  'opportunities',
  'brief-opportunities',
  'risks',
  'brief-risks',
]);
const SECTOR_SECTION_KEYS = new Set(['sectors', 'brief-sectors']);
const MARKET_SECTION_KEYS = new Set(['markets', 'indices', 'brief-markets']);
const STOCKS_MENTIONED_SECTION_KEYS = new Set(['stocks-mentioned', 'brief-stocks', 'stocksMentioned']);

function stableSectionKeys(section) {
  return new Set([
    section?.key,
    section?.sectionKey,
    section?.sourceSectionId,
    section?.tabKey,
    section?.sourceTabId,
    ...(Array.isArray(section?.provenance)
      ? section.provenance.flatMap((entry) => [entry?.sourceSectionId, entry?.sourceTabId])
      : []),
  ].filter(Boolean));
}

function sectionPriority(section) {
  const keys = stableSectionKeys(section);
  return SPECIALIZED_SECTION_PRIORITY.findIndex((priorityKeys) => (
    [...priorityKeys].some((key) => keys.has(key))
  ));
}

function hasStableSectionKey(section, expectedKeys) {
  return [...stableSectionKeys(section)].some((key) => expectedKeys.has(key));
}

function placeSectionsBeforeTarget(sections, movingKeys, targetKeys) {
  if (!sections.some((section) => hasStableSectionKey(section, targetKeys))) return sections;

  const movingSections = sections.filter((section) => (
    hasStableSectionKey(section, movingKeys)
  ));
  if (movingSections.length === 0) return sections;

  const remaining = sections.filter((section) => (
    !hasStableSectionKey(section, movingKeys)
  ));
  const targetIndex = remaining.findIndex((section) => hasStableSectionKey(section, targetKeys));
  return [
    ...remaining.slice(0, targetIndex),
    ...movingSections,
    ...remaining.slice(targetIndex),
  ];
}

/** Presentation-only stable ordering; never mutates or duplicates source sections. */
export function orderSpecializedSections(sections = []) {
  const safe = Array.isArray(sections) ? sections.filter(Boolean) : [];
  const prioritized = safe
    .map((section, originalIndex) => ({ section, originalIndex, priority: sectionPriority(section) }))
    .sort((a, b) => {
      const aRank = a.priority < 0 ? SPECIALIZED_SECTION_PRIORITY.length : a.priority;
      const bRank = b.priority < 0 ? SPECIALIZED_SECTION_PRIORITY.length : b.priority;
      return aRank - bRank || a.originalIndex - b.originalIndex;
    })
    .map(({ section }) => section);
  const opportunitiesBeforeSectors = placeSectionsBeforeTarget(
    prioritized,
    OPPORTUNITIES_RISKS_SECTION_KEYS,
    SECTOR_SECTION_KEYS,
  );
  return placeSectionsBeforeTarget(
    opportunitiesBeforeSectors,
    MARKET_SECTION_KEYS,
    STOCKS_MENTIONED_SECTION_KEYS,
  );
}
