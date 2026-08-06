/**
 * Morning Brief UI presentation flags — scoped per surface (not global deletes).
 * Specialized / תוכן ייעודי uses the clean profile below.
 */

export const MORNING_BRIEF_SPECIALIZED_PRESENTATION = {
  /** Section header AI / Manual source badge */
  showAiBadge: false,
  /** BriefContextHeader subtitle + publish date */
  showSourceCaption: false,
  /** Sector holdings links, stock TV/Inv links, finviz name links */
  showHelperLinks: false,
  /** News card emoji sentiment pills (🟢 חיובי) — border color remains */
  showNewsSentimentPill: false,
  /** Stocks table external links column */
  showStockExternalLinks: false,
  /** Row metadata (e.g. macro frequency under indicator) */
  showRowMetadata: false,
  /** Stocks sort control row (מיון) */
  showSortControls: false,
  /** Small numeric count next to section title (real extracted items) */
  showSectionCounts: true,
  /** Colored summary pills under title (חיוביים | ניטרליים | …) — separate from title count */
  showSummaryCounters: false,
  briefSession: 'morning',
  hideEmptyOptionalSections: false,
};

export const MORNING_BRIEF_SECTION_ORDER = [
  'news', 'market-regime', 'sectors', 'opportunities-risks', 'stocks-mentioned',
  'economic-calendar', 'macro', 'sentiment', 'markets',
  'company-events', 'levels', 'top-insights', 'learning-insights', 'all-points',
];

export const EVENING_BRIEF_SECTION_ORDER = [
  'news', 'market-regime', 'markets', 'sectors', 'company-events',
  'stocks-mentioned', 'opportunities-risks', 'levels', 'top-insights',
  'learning-insights', 'economic-calendar', 'macro', 'sentiment', 'all-points',
];

export function getMarketBriefSpecializedPresentation(briefSession = 'unknown') {
  const evening = briefSession === 'evening';
  return {
    ...MORNING_BRIEF_SPECIALIZED_PRESENTATION,
    briefSession,
    hideEmptyOptionalSections: evening,
    sectionOrder: evening ? EVENING_BRIEF_SECTION_ORDER : MORNING_BRIEF_SECTION_ORDER,
  };
}

export function resolveMarketBriefSectionOrder(presentation) {
  return resolveMorningBriefPresentation(presentation).sectionOrder || MORNING_BRIEF_SECTION_ORDER;
}

/** Default when no presentation profile is passed (dev / legacy surfaces). */
export const MORNING_BRIEF_DEFAULT_PRESENTATION = {
  showAiBadge: true,
  showSourceCaption: true,
  showHelperLinks: true,
  showNewsSentimentPill: true,
  showStockExternalLinks: true,
  showRowMetadata: true,
  showSortControls: true,
  showSectionCounts: true,
  showSummaryCounters: true,
};

export function resolveMorningBriefPresentation(overrides) {
  if (!overrides) return MORNING_BRIEF_DEFAULT_PRESENTATION;
  return { ...MORNING_BRIEF_DEFAULT_PRESENTATION, ...overrides };
}

/** Whether to show the numeric item count beside a section title. */
export function morningBriefShowsSectionCount(presentation) {
  return resolveMorningBriefPresentation(presentation).showSectionCounts !== false;
}

/** Whether to show colored summary counter pills under section titles. */
export function morningBriefShowsSummaryCounters(presentation) {
  return resolveMorningBriefPresentation(presentation).showSummaryCounters !== false;
}

/** Returns count for SectionCard when enabled, otherwise undefined. */
export function morningBriefSectionCount(presentation, count) {
  if (!morningBriefShowsSectionCount(presentation)) return undefined;
  return count;
}

/** Real opportunities + risks — excludes padded grid placeholder slots. */
export function countOpportunitiesAndRisks(opportunities, risks) {
  const opp = Array.isArray(opportunities) ? opportunities : [];
  const rsk = Array.isArray(risks) ? risks : [];
  return opp.length + rsk.length;
}

const PRESENTATION_RANK = {
  critical: 4,
  קריטי: 4,
  קריטית: 4,
  high: 3,
  גבוהה: 3,
  גבוה: 3,
  medium: 2,
  בינונית: 2,
  בינוני: 2,
  low: 1,
  נמוכה: 1,
  נמוך: 1,
};

function normalizedRank(value) {
  return PRESENTATION_RANK[String(value ?? '').trim().toLowerCase()] || 0;
}

function meaningfulFieldCount(item, fields) {
  return fields.reduce((count, field) => {
    const value = item?.[field];
    return count + (value !== undefined && value !== null && value !== '' ? 1 : 0);
  }, 0);
}

function stableRank(items, score) {
  const safe = Array.isArray(items) ? items : [];
  return safe
    .map((item, sourceIndex) => ({ item, sourceIndex, score: score(item) }))
    .sort((a, b) => {
      for (let index = 0; index < a.score.length; index += 1) {
        const difference = b.score[index] - a.score[index];
        if (difference) return difference;
      }
      return a.sourceIndex - b.sourceIndex;
    })
    .map(({ item }) => item);
}

export function rankOpportunityItems(items) {
  return stableRank(items, (item) => [
    normalizedRank(item?.priority),
    normalizedRank(item?.confidence),
    meaningfulFieldCount(item, [
      'entry', 'stop', 'target', 'rrRatio', 'timeframe', 'catalyst', 'invalidation',
    ]),
  ]);
}

export function rankRiskItems(items) {
  return stableRank(items, (item) => [
    normalizedRank(item?.severity || item?.category),
    normalizedRank(item?.priority),
    Array.isArray(item?.affectedAssets) ? item.affectedAssets.length : 0,
  ]);
}

/** Optional subsection title suffix, e.g. "הזדמנויות (3)". */
export function morningBriefSubsectionTitle(presentation, title, count) {
  const visibleCount = morningBriefSectionCount(presentation, count);
  return visibleCount != null ? `${title} (${visibleCount})` : title;
}
