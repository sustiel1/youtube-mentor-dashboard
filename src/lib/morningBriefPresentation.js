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
};

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

/** Optional subsection title suffix, e.g. "הזדמנויות (3)". */
export function morningBriefSubsectionTitle(presentation, title, count) {
  const visibleCount = morningBriefSectionCount(presentation, count);
  return visibleCount != null ? `${title} (${visibleCount})` : title;
}
