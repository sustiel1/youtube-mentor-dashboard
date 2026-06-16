/**
 * Collect video / app-builder content as Obsidian merge items (same engine as per-row saves).
 */
import { buildObsidianItemIdentityKey } from '@/lib/obsidianItemSaveStore';
import { APP_BUILDER_SECTIONS } from '@/lib/appBuilderStore';
import { extractUniversalTabContent, extractUniversalTabFlatItems } from '@/lib/universalTabSections';
import { buildDailyBriefingView } from '@/lib/summaryBriefingDisplay';
import { buildMorningBriefBulkSections, buildMorningBriefCardBulkItems } from '@/lib/morningBriefBulkSections';
import {
  buildBulkItemsFromSections,
  buildBulkItemsFromTexts,
  buildCardBulkItemsFromSections,
  buildChaptersBulkItems,
  buildSummaryBriefingBulkItems,
  buildSummaryBriefingCardBulkItems,
  formatBulkItemText,
} from '@/lib/universalTabBulkItems';

function resolveVideoId(video = {}) {
  return String(video?.youtubeId || video?.id || 'unknown');
}

function dedupeMergeItems(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.identityKey || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Boolean(String(item?.text || '').trim());
  });
}

export function bulkEntryToMergeItem(entry, videoId) {
  const text = String(entry?.text || '').trim();
  if (!text) return null;
  const tabKey = entry?.type || entry?.tabScope || 'multi';
  const sectionKey = entry?.sectionLabel || '';
  return {
    text,
    sectionLabel: sectionKey || 'כללי',
    identityKey: buildObsidianItemIdentityKey({
      videoId,
      tabKey,
      sectionKey,
      text,
    }),
    timestamp: entry?.timestamp || '',
  };
}

export function bulkEntriesToMergeItems(entries = [], videoId) {
  return dedupeMergeItems(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => bulkEntryToMergeItem(entry, videoId))
      .filter(Boolean),
  );
}

/** Stable per-section identity — re-save skips duplicate section marker. */
export function buildAppBuilderSectionIdentityKey(videoId, sectionKey) {
  return `obsidian-item:${resolveVideoId({ id: videoId })}:app-builder:${sectionKey}:section`;
}

export function buildAppBuilderMergeItems({
  videoId,
  sections = {},
  sectionDefs = APP_BUILDER_SECTIONS,
} = {}) {
  const vid = resolveVideoId({ id: videoId });
  return dedupeMergeItems(
    sectionDefs
      .map(({ key, label }) => {
        const text = String(sections[key] || '').trim();
        if (!text) return null;
        return {
          text,
          sectionLabel: label || key,
          identityKey: buildAppBuilderSectionIdentityKey(vid, key),
        };
      })
      .filter(Boolean),
  );
}

function pushLegacyArrayItems(bulkEntries, video, field, sectionLabel, tabKey) {
  const list = Array.isArray(video?.[field]) ? video[field] : [];
  list.forEach((item, i) => {
    const text = formatBulkItemText(item);
    if (!text) return;
    bulkEntries.push({
      id: `${tabKey}:${field}:${i}`,
      text,
      sectionLabel,
      type: tabKey,
      tabScope: tabKey,
    });
  });
}

function pushNotes(bulkEntries, videoNotes = []) {
  (Array.isArray(videoNotes) ? videoNotes : []).forEach((note, i) => {
    const text = String(note?.content || note?.text || '').trim();
    if (!text) return;
    bulkEntries.push({
      id: `notes:${i}`,
      text,
      sectionLabel: '📝 הערות',
      type: 'notes',
      tabScope: 'notes',
    });
  });
}

function collectTabBulkEntries(effectiveVideo, tabKey, marketBriefData) {
  const shaped = extractUniversalTabContent(effectiveVideo, tabKey, marketBriefData);
  if (shaped?.mode === 'sections') {
    const populated = (shaped.sections || []).filter(
      (s) => Array.isArray(s.items) && s.items.length > 0,
    );
    return [
      ...buildCardBulkItemsFromSections(
        populated.map((s) => ({ ...s, tabKey })),
        tabKey,
      ),
      ...buildBulkItemsFromSections(
        populated.map((s) => ({ ...s, tabKey })),
        tabKey,
      ),
    ];
  }
  const flat = shaped?.mode === 'flat' && shaped.items?.length
    ? shaped.items
    : extractUniversalTabFlatItems(effectiveVideo, tabKey, marketBriefData);
  if (!flat.length) return [];
  return buildBulkItemsFromTexts(flat, {
    tabScope: tabKey,
    sectionLabel: tabKey,
    type: tabKey,
    idPrefix: tabKey,
  });
}

/**
 * Full video package → merge items (all universal tabs + legacy fields + notes).
 */
export function collectVideoObsidianMergeItems({
  effectiveVideo = {},
  marketBriefData = null,
  summaryShort = '',
  fullSummary = '',
  displayChapters = [],
  gemTopicsSections = [],
  gemTopicsFlat = [],
  videoNotes = [],
  appBuilderSections = null,
} = {}) {
  const videoId = resolveVideoId(effectiveVideo);
  const bulkEntries = [];

  bulkEntries.push(...buildChaptersBulkItems(displayChapters));

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
  bulkEntries.push(...buildSummaryBriefingCardBulkItems(dailyBriefing));
  bulkEntries.push(...buildSummaryBriefingBulkItems(dailyBriefing));

  if (summaryShaped?.mode === 'sections') {
    const populated = (summaryShaped.sections || []).filter(
      (s) => Array.isArray(s.items) && s.items.length > 0,
    );
    bulkEntries.push(
      ...buildCardBulkItemsFromSections(
        populated.map((s) => ({ ...s, tabKey: 'summary' })),
        'summary',
      ),
      ...buildBulkItemsFromSections(
        populated.map((s) => ({ ...s, tabKey: 'summary' })),
        'summary',
      ),
    );
  } else {
    bulkEntries.push(...collectTabBulkEntries(effectiveVideo, 'summary', marketBriefData));
  }

  bulkEntries.push(...collectTabBulkEntries(effectiveVideo, 'insights', marketBriefData));
  bulkEntries.push(...collectTabBulkEntries(effectiveVideo, 'useful-knowledge', marketBriefData));
  bulkEntries.push(...collectTabBulkEntries(effectiveVideo, 'app-builder', marketBriefData));

  const topicsShaped = extractUniversalTabContent(effectiveVideo, 'topics-subtopics', marketBriefData);
  if (topicsShaped?.mode === 'sections') {
    bulkEntries.push(
      ...buildBulkItemsFromSections(
        (topicsShaped.sections || []).map((s) => ({ ...s, tabKey: 'topics-subtopics' })),
        'topics-subtopics',
      ),
    );
  } else if (Array.isArray(gemTopicsSections) && gemTopicsSections.length > 0) {
    bulkEntries.push(
      ...buildBulkItemsFromSections(
        gemTopicsSections.map((s) => ({ ...s, tabKey: 'topics-subtopics' })),
        'topics-subtopics',
      ),
    );
  } else if (Array.isArray(gemTopicsFlat) && gemTopicsFlat.length > 0) {
    bulkEntries.push(
      ...buildBulkItemsFromTexts(gemTopicsFlat, {
        tabScope: 'topics-subtopics',
        sectionLabel: '🏷️ נושאים ותת-נושאים',
        type: 'topics-subtopics',
        idPrefix: 'topics-subtopics',
      }),
    );
  } else {
    bulkEntries.push(...collectTabBulkEntries(effectiveVideo, 'topics-subtopics', marketBriefData));
  }

  const specializedSections = buildMorningBriefBulkSections(effectiveVideo, marketBriefData);
  bulkEntries.push(...buildMorningBriefCardBulkItems(specializedSections));
  bulkEntries.push(...buildBulkItemsFromSections(specializedSections, 'specialized'));

  pushLegacyArrayItems(bulkEntries, effectiveVideo, 'keyInsights', '⚡ תובנות מרכזיות', 'insights');
  pushLegacyArrayItems(bulkEntries, effectiveVideo, 'keyPoints', '💡 ידע שימושי', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, effectiveVideo, 'rules', '✅ כללים', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, effectiveVideo, 'concepts', '🧩 מושגים', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, effectiveVideo, 'actionItems', '🔁 פעולות', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, effectiveVideo, 'mistakesToAvoid', '⚠️ טעויות', 'useful-knowledge');

  if (summaryShort) {
    bulkEntries.push({
      id: 'summary:short',
      text: summaryShort,
      sectionLabel: '📝 סיכום',
      type: 'summary',
      tabScope: 'summary',
    });
  }

  pushNotes(bulkEntries, videoNotes);

  const fromBulk = bulkEntriesToMergeItems(bulkEntries, videoId);
  const appItems = appBuilderSections && typeof appBuilderSections === 'object'
    ? buildAppBuilderMergeItems({ videoId, sections: appBuilderSections })
    : [];
  return dedupeMergeItems([...fromBulk, ...appItems]);
}

/** Legacy save-all fields → merge items (subset of full collector). */
export function buildSaveAllMergeItems({ video = {}, videoNotes = [], displayChapters = [] } = {}) {
  const videoId = resolveVideoId(video);
  const bulkEntries = [];

  bulkEntries.push(...buildChaptersBulkItems(displayChapters));
  pushLegacyArrayItems(bulkEntries, video, 'keyInsights', '⚡ תובנות מרכזיות', 'insights');
  pushLegacyArrayItems(bulkEntries, video, 'keyPoints', '💡 ידע שימושי', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, video, 'rules', '✅ כללים', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, video, 'concepts', '🧩 מושגים', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, video, 'actionItems', '🔁 פעולות', 'useful-knowledge');
  pushLegacyArrayItems(bulkEntries, video, 'mistakesToAvoid', '⚠️ טעויות', 'useful-knowledge');
  pushNotes(bulkEntries, videoNotes);

  return bulkEntriesToMergeItems(bulkEntries, videoId);
}
