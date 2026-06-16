/**
 * Collects universal-tab knowledge counts for Obsidian save preview (presentation only).
 * Does not alter extraction, GEM schemas, or stored data.
 */
import { extractUniversalTabContent, extractUniversalTabFlatItems } from './universalTabSections';
import {
  formatBulkItemText,
  buildSummaryBriefingBulkItems,
} from './universalTabBulkItems';
import { buildDailyBriefingView } from './summaryBriefingDisplay';
import { buildMorningBriefBulkSections } from './morningBriefBulkSections';

export const VIDEO_KNOWLEDGE_TAB_LABELS = {
  summary: '📝 סיכום',
  chapters: '📚 פרקים',
  insights: '💡 תובנות',
  'useful-knowledge': '🧠 ידע שימושי',
  'app-builder': '🚀 APP',
  'topics-subtopics': '🏷️ נושאים ותת-נושאים',
  specialized: '🎯 תוכן ייעודי',
};

function countShapedItems(shaped) {
  if (!shaped) return 0;
  if (shaped.mode === 'sections') {
    return shaped.sections.reduce((n, s) => n + (Array.isArray(s.items) ? s.items.length : 0), 0);
  }
  return Array.isArray(shaped.items) ? shaped.items.length : 0;
}

function uniqueCount(items = []) {
  const seen = new Set();
  let n = 0;
  for (const item of items) {
    const text = formatBulkItemText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    n += 1;
  }
  return n;
}

/**
 * @returns {{ sections: Array<{key,label,count}>, totalItems: number }}
 */
export function collectVideoKnowledgePackage({
  effectiveVideo = {},
  marketBriefData = null,
  summaryShort = '',
  fullSummary = '',
  displayChapters = [],
  gemTopicsSections = [],
  gemTopicsFlat = [],
} = {}) {
  const sections = [];

  const summaryShaped = marketBriefData
    ? extractUniversalTabContent(effectiveVideo, 'summary', marketBriefData)
    : null;
  const dailyBriefing = buildDailyBriefingView({
    effectiveVideo,
    marketBriefData,
    summaryShort,
    fullSummary,
    summaryShaped,
  });
  const summaryBulk = buildSummaryBriefingBulkItems(dailyBriefing);
  const summaryFlat = summaryShaped?.mode === 'sections'
    ? summaryShaped.sections.flatMap((s) => s.items || [])
    : (summaryShaped?.items || extractUniversalTabFlatItems(effectiveVideo, 'summary', marketBriefData));
  const summaryCount = uniqueCount([
    ...summaryBulk.map((i) => i.text),
    ...summaryFlat,
    ...(Array.isArray(effectiveVideo?.keyPoints) ? effectiveVideo.keyPoints : []),
    ...(summaryShort ? [summaryShort] : []),
  ]);
  if (summaryCount > 0) {
    sections.push({ key: 'summary', label: VIDEO_KNOWLEDGE_TAB_LABELS.summary, count: summaryCount });
  }

  const chapterCount = Array.isArray(displayChapters) ? displayChapters.length : 0;
  if (chapterCount > 0) {
    sections.push({ key: 'chapters', label: VIDEO_KNOWLEDGE_TAB_LABELS.chapters, count: chapterCount });
  }

  const insightsShaped = extractUniversalTabContent(effectiveVideo, 'insights', marketBriefData);
  const insightsCount = countShapedItems(insightsShaped)
    || extractUniversalTabFlatItems(effectiveVideo, 'insights', marketBriefData).length;
  if (insightsCount > 0) {
    sections.push({ key: 'insights', label: VIDEO_KNOWLEDGE_TAB_LABELS.insights, count: insightsCount });
  }

  const ukShaped = extractUniversalTabContent(effectiveVideo, 'useful-knowledge', marketBriefData);
  const ukCount = countShapedItems(ukShaped)
    || extractUniversalTabFlatItems(effectiveVideo, 'useful-knowledge', marketBriefData).length;
  if (ukCount > 0) {
    sections.push({ key: 'useful-knowledge', label: VIDEO_KNOWLEDGE_TAB_LABELS['useful-knowledge'], count: ukCount });
  }

  const appShaped = extractUniversalTabContent(effectiveVideo, 'app-builder', marketBriefData);
  const appCount = countShapedItems(appShaped)
    || extractUniversalTabFlatItems(effectiveVideo, 'app-builder', marketBriefData).length;
  if (appCount > 0) {
    sections.push({ key: 'app-builder', label: VIDEO_KNOWLEDGE_TAB_LABELS['app-builder'], count: appCount });
  }

  const topicsShaped = extractUniversalTabContent(effectiveVideo, 'topics-subtopics', marketBriefData);
  const topicsFromGem = (Array.isArray(gemTopicsSections) ? gemTopicsSections : [])
    .reduce((n, s) => n + (s.items?.length || 0), 0);
  const topicsCount = countShapedItems(topicsShaped)
    || topicsFromGem
    || (Array.isArray(gemTopicsFlat) ? gemTopicsFlat.length : 0)
    || extractUniversalTabFlatItems(effectiveVideo, 'topics-subtopics', marketBriefData).length;
  if (topicsCount > 0) {
    sections.push({ key: 'topics-subtopics', label: VIDEO_KNOWLEDGE_TAB_LABELS['topics-subtopics'], count: topicsCount });
  }

  const specializedSections = buildMorningBriefBulkSections(effectiveVideo, marketBriefData);
  const specializedCount = specializedSections.reduce(
    (n, s) => n + (Array.isArray(s.items) ? s.items.length : 0),
    0,
  );
  if (specializedCount > 0) {
    sections.push({ key: 'specialized', label: VIDEO_KNOWLEDGE_TAB_LABELS.specialized, count: specializedCount });
  }

  const totalItems = sections.reduce((n, s) => n + s.count, 0);
  return { sections, totalItems };
}
