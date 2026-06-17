/**
 * DEV / script-only audit helpers for Universal Tabs + GEM JSON mapping.
 * Not wired into production UI. Use scripts/runtime-tabs-audit.mjs to run checks.
 */
import { extractVideoTabItems } from '@/config/videoTabsConfig';
import {
  APP_BUILDER_SECTIONS,
  getAppBuilderDraft,
  mapUniversalAppBuilderToSections,
} from '@/lib/appBuilderStore';

export const AUDIT_TAB_VALUES = [
  'summary',
  'chapters',
  'insights',
  'useful-knowledge',
  'app-builder',
  'topics-subtopics',
  'specialized',
];

const BRIEF_SLUGS = new Set(['morning-brief', 'evening-brief', 'weekly-brief', 'earnings-brief']);

function pickLen(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

function countObjectArrayFields(obj, keys) {
  if (!obj || typeof obj !== 'object') return 0;
  return keys.reduce((sum, key) => sum + pickLen(obj[key]), 0);
}

/** Raw item count inside marketBriefData.universalTabs for one tab. */
export function countUniversalJsonItems(marketBriefData, tab) {
  const ut = marketBriefData?.universalTabs;
  if (!ut || typeof ut !== 'object') return 0;

  switch (tab) {
    case 'summary': {
      const s = ut.summary;
      if (Array.isArray(s)) return s.length;
      if (s && typeof s === 'object') {
        let n = 0;
        for (const k of ['shortSummary', 'fullSummary', 'marketMood', 'mainConclusion']) {
          if (typeof s[k] === 'string' && s[k].trim()) n += 1;
        }
        for (const k of ['topTakeaways', 'importantWarnings', 'keyOpportunities']) {
          n += pickLen(s[k]);
        }
        return n;
      }
      return 0;
    }
    case 'chapters':
      return pickLen(ut.chapters);
    case 'insights': {
      const ins = ut.insights;
      if (Array.isArray(ins)) return ins.length;
      if (ins && typeof ins === 'object') {
        return countObjectArrayFields(ins, [
          'top5Insights', 'learningInsights', 'marketLessons', 'tradingInsights', 'conclusions',
        ]);
      }
      return 0;
    }
    case 'useful-knowledge': {
      const uk = ut.usefulKnowledge;
      if (Array.isArray(uk)) return uk.length;
      if (uk && typeof uk === 'object') {
        return countObjectArrayFields(uk, [
          'reusableKnowledge', 'actionChecklist', 'keyTakeaways', 'riskManagement', 'mistakesToAvoid', 'rules',
        ]);
      }
      return 0;
    }
    case 'app-builder': {
      const app = ut.app || ut.appBuilder;
      if (!app || typeof app !== 'object') return 0;
      return countObjectArrayFields(app, [
        'kpiList', 'dataPoints', 'dashboards', 'dashboardUpdates', 'prompts', 'alerts',
        'newIndicators', 'screeningCriteria', 'dataFields', 'suggestedFeatures', 'componentSuggestions',
      ]);
    }
    case 'topics-subtopics': {
      const t = ut.topicsSubtopics;
      if (Array.isArray(t)) return t.length;
      if (t && typeof t === 'object') {
        return countObjectArrayFields(t, ['tags', 'obsidianTopics', 'relatedTopics', 'suggestedSubTopics']);
      }
      return 0;
    }
    case 'specialized': {
      const spec = ut.specialized;
      if (!spec || typeof spec !== 'object') return 0;
      return countObjectArrayFields(spec, [
        'indices', 'indexPerformance', 'marketNews', 'headlines', 'stocksMentioned', 'stocks',
        'macro', 'macroEvents', 'sentiment', 'calendar', 'opportunities', 'risks',
        'top5Insights', 'insights',
      ]);
    }
    default:
      return 0;
  }
}

function countSpecializedRendererInput(effectiveVideo, marketBriefData, normalizedSubCategory) {
  const slug = normalizedSubCategory;
  const sum = (...keys) => keys.reduce(
    (acc, key) => acc + extractVideoTabItems(effectiveVideo, key, marketBriefData).length,
    0,
  );

  if (slug === 'morning-brief') {
    return sum(
      'market-news', 'indices', 'brief-macro', 'brief-sentiment', 'brief-calendar',
      'stocks-mentioned', 'brief-opportunities', 'brief-risks',
    );
  }
  if (slug === 'evening-brief') {
    return sum(
      'market-news', 'indices', 'brief-macro', 'brief-sentiment', 'brief-sectors',
      'brief-changes', 'brief-tomorrow', 'brief-calendar', 'stocks-mentioned',
      'brief-opportunities', 'brief-risks',
    );
  }
  if (slug === 'weekly-brief') {
    return sum(
      'market-news', 'indices', 'brief-highlights', 'brief-macro', 'brief-winners',
      'brief-losers', 'brief-sentiment', 'brief-calendar', 'brief-outlook',
      'stocks-mentioned', 'brief-opportunities', 'brief-risks',
    );
  }
  if (slug === 'earnings-brief') {
    return sum(
      'market-news', 'indices', 'financial-metrics', 'earnings-guidance',
      'earnings-commentary', 'brief-macro', 'brief-sentiment', 'brief-calendar',
      'stocks-mentioned', 'brief-opportunities', 'brief-risks',
    );
  }
  if (slug === 'fundamental-analysis') {
    return sum('financial-metrics', 'valuation', 'analysis-frameworks', 'investment-checklist', 'mistakes', 'checklists');
  }
  if (slug === 'technical-analysis') {
    return sum('indicators', 'setups', 'patterns', 'checklists', 'mistakes');
  }
  if (slug === 'macro') {
    return sum('cause-effect', 'market-impact', 'brief-macro', 'brief-sentiment');
  }
  return extractVideoTabItems(effectiveVideo, 'specialized', marketBriefData).length;
}

/** Mirrors each tab renderer's actual props / inline arrays (not activeTabItems). */
export function countRendererInput(tab, ctx) {
  const {
    effectiveVideo,
    video,
    enrichedVideo,
    marketBriefData,
    baseChapters,
    normalizedSubCategory,
  } = ctx;

  switch (tab) {
    case 'summary': {
      const isBriefVideo = BRIEF_SLUGS.has(normalizedSubCategory);
      const summaryShort = (video?.shortSummary || enrichedVideo?.aiSummaryShort || '')
        ?.replace(/\[MOCK\]\s*/g, '').trim();
      if (isBriefVideo && !summaryShort && marketBriefData) {
        const universal = extractVideoTabItems(effectiveVideo, 'summary', marketBriefData);
        if (universal.length > 0) return universal.length;
        return [
          ...(Array.isArray(marketBriefData.top5Insights) ? marketBriefData.top5Insights : []),
          ...(Array.isArray(marketBriefData.reusableKnowledge) ? marketBriefData.reusableKnowledge : []),
          ...(Array.isArray(marketBriefData.conclusions) ? marketBriefData.conclusions : []),
        ].filter(Boolean).length;
      }
      if (summaryShort) {
        const keyPoints = Array.isArray(video?.keyPoints) ? video.keyPoints.length : 0;
        const tags = Array.isArray(video?.tags) ? video.tags.length : 0;
        return 1 + keyPoints + tags;
      }
      if (video?.gemSummary) return 1;
      return 0;
    }
    case 'chapters': {
      const gemRaw = extractVideoTabItems(effectiveVideo, 'chapters', marketBriefData);
      if (Array.isArray(gemRaw) && gemRaw.length > 0) return gemRaw.length;
      return Array.isArray(baseChapters) ? baseChapters.length : 0;
    }
    case 'insights': {
      const mainLesson = effectiveVideo?.mainLesson ? 1 : 0;
      const universalInsights = extractVideoTabItems(effectiveVideo, 'insights', marketBriefData);
      const legacyKeyInsights = [
        ...(Array.isArray(effectiveVideo?.keyInsights) ? effectiveVideo.keyInsights : []),
        ...(Array.isArray(effectiveVideo?.analysis?.keyInsights) ? effectiveVideo.analysis.keyInsights : []),
        ...(marketBriefData
          ? [
            ...(Array.isArray(marketBriefData.top5Insights) ? marketBriefData.top5Insights : []),
            ...(Array.isArray(marketBriefData.reusableKnowledge) ? marketBriefData.reusableKnowledge : []),
          ]
          : [
            ...(Array.isArray(effectiveVideo?.top5Insights) ? effectiveVideo.top5Insights : []),
            ...(Array.isArray(effectiveVideo?.reusableKnowledge) ? effectiveVideo.reusableKnowledge : []),
          ]),
      ].filter(Boolean).length;
      const keyInsights = universalInsights.length > 0 ? universalInsights.length : legacyKeyInsights;
      const principles = [
        ...(Array.isArray(effectiveVideo?.tradingPrinciples) ? effectiveVideo.tradingPrinciples : []),
        ...(Array.isArray(effectiveVideo?.mentalModels) ? effectiveVideo.mentalModels : []),
        ...(Array.isArray(effectiveVideo?.brainHighlights) ? effectiveVideo.brainHighlights : []),
        ...(Array.isArray(effectiveVideo?.analysis?.brainHighlights) ? effectiveVideo.analysis.brainHighlights : []),
      ].filter(Boolean).length;
      const thesis = [
        ...(Array.isArray(effectiveVideo?.thesis) ? effectiveVideo.thesis : []),
        ...(Array.isArray(effectiveVideo?.analysis?.thesis) ? effectiveVideo.analysis.thesis : []),
      ].filter(Boolean).length;
      return mainLesson + keyInsights + principles + thesis;
    }
    case 'useful-knowledge': {
      const rawRules = [
        ...(Array.isArray(effectiveVideo?.rules) ? effectiveVideo.rules : []),
        ...(Array.isArray(effectiveVideo?.analysis?.rules) ? effectiveVideo.analysis.rules : []),
      ].filter(Boolean);
      const sections = [
        extractVideoTabItems(effectiveVideo, 'useful-knowledge', marketBriefData),
        extractVideoTabItems(effectiveVideo, 'definitions', marketBriefData),
        rawRules,
        extractVideoTabItems(effectiveVideo, 'checklists', marketBriefData),
        extractVideoTabItems(effectiveVideo, 'mistakes', marketBriefData),
      ];
      return sections.reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
    }
    case 'app-builder': {
      const videoId = effectiveVideo?.videoId || effectiveVideo?.id;
      const draft = videoId ? getAppBuilderDraft(videoId) : {};
      const hasDraft = APP_BUILDER_SECTIONS.some(({ key }) => Boolean(draft[key]?.trim()));
      if (hasDraft) {
        return APP_BUILDER_SECTIONS.filter(({ key }) => Boolean(draft[key]?.trim())).length;
      }
      const gemApp = marketBriefData?.universalTabs?.app || marketBriefData?.universalTabs?.appBuilder;
      if (gemApp) {
        const hydrated = mapUniversalAppBuilderToSections(gemApp);
        return APP_BUILDER_SECTIONS.filter(({ key }) => Boolean(hydrated[key]?.trim())).length;
      }
      return 0;
    }
    case 'topics-subtopics': {
      const cat = effectiveVideo?.category ? 1 : 0;
      const subCat = effectiveVideo?.subCategory ? 1 : 0;
      const tags = Array.isArray(effectiveVideo?.tags) ? effectiveVideo.tags.length : 0;
      const topicIds = Array.isArray(effectiveVideo?.topicIds) ? effectiveVideo.topicIds.length : 0;
      const obsidianPath = effectiveVideo?.obsidianTopic ? 1 : 0;
      const obsidianTopics = Array.isArray(effectiveVideo?.obsidianTopics) ? effectiveVideo.obsidianTopics.length : 0;
      const suggestedSubTopics = [
        ...(Array.isArray(effectiveVideo?.suggestedSubTopics) ? effectiveVideo.suggestedSubTopics : []),
        ...(Array.isArray(effectiveVideo?.analysis?.suggestedSubTopics) ? effectiveVideo.analysis.suggestedSubTopics : []),
        ...(Array.isArray(effectiveVideo?.subTopicSuggestions) ? effectiveVideo.subTopicSuggestions : []),
      ].length;
      const gemTopics = extractVideoTabItems(effectiveVideo, 'topics-subtopics', marketBriefData).length;
      return cat + subCat + tags + topicIds + obsidianPath + obsidianTopics + suggestedSubTopics + gemTopics;
    }
    case 'specialized':
      return countSpecializedRendererInput(effectiveVideo, marketBriefData, normalizedSubCategory);
    default:
      return 0;
  }
}

export function detectFirstLossPoint(row) {
  const { tab, jsonCount, extractCount, rendererInputCount, domRenderedCount } = row;

  if (jsonCount === 0 && extractCount === 0 && rendererInputCount === 0) {
    return { point: 'json', file: 'marketBriefData.universalTabs', line: '—', cause: 'No universalTabs payload for this tab (or GEM not pasted)' };
  }
  if (jsonCount > 0 && extractCount === 0) {
    return { point: 'extractor', file: 'src/config/videoTabsConfig.js', line: '~494', cause: `extractVideoTabItems('${tab}') did not read universalTabs` };
  }
  if (extractCount > 0 && rendererInputCount === 0) {
    return { point: 'renderer', file: 'src/components/dashboard/VideoDetailPanel.jsx', line: 'TabsContent', cause: 'Extractor has data but renderer input count is zero' };
  }
  if (tab === 'specialized' && extractCount > 0 && rendererInputCount > 0 && extractCount !== rendererInputCount) {
    return { point: 'none', file: '—', line: '—', cause: 'Expected: tab-level specialized aggregate differs; granular SpecializedContentRenderer path is used' };
  }
  if (typeof domRenderedCount === 'number' && rendererInputCount > 0 && domRenderedCount === 0) {
    return { point: 'dom', file: 'src/components/dashboard/VideoDetailPanel.jsx', line: 'TabsContent', cause: 'Renderer has input but zero visible item rows in active tabpanel DOM' };
  }
  return { point: 'none', file: '—', line: '—', cause: 'Pipeline aligned for this tab (extractor → renderer)' };
}

export function countDomForActiveTab(activeTab) {
  if (typeof document === 'undefined') return 0;
  const root = document.querySelector(`[role="tabpanel"][data-state="active"]`);
  if (!root) return 0;

  switch (activeTab) {
    case 'summary':
      return root.querySelectorAll('[data-section-content="סיכום"], ul.space-y-3 li.flex.items-start, ul.space-y-2 li').length;
    case 'chapters':
      return root.querySelectorAll('[data-chapter-row], .chapter-row, li.group, [class*="chapter"]').length > 0
        ? root.querySelectorAll('button, li').length
        : root.textContent.includes('פרקים') ? (root.textContent.match(/\d+ פרקים/) ? parseInt(root.textContent.match(/(\d+) פרקים/)?.[1] || '0', 10) : 0) : 0;
    case 'insights':
      return root.querySelectorAll('[data-insight-row]').length
        || root.querySelectorAll('.group.flex.items-start.gap-2.rounded-lg').length
        + root.querySelectorAll('table tbody tr').length;
    case 'useful-knowledge':
    case 'specialized':
      return root.querySelectorAll('.group.flex.items-start.gap-2.rounded-lg').length
        + root.querySelectorAll('table tbody tr').length
        + root.querySelectorAll('[class*="MarketIndices"] tr').length;
    case 'app-builder':
      return root.querySelectorAll('textarea').length;
    case 'topics-subtopics':
      return root.querySelectorAll('.rounded-full').length;
    default:
      return root.querySelectorAll('.group.flex.items-start').length;
  }
}

export function buildAuditRow(tab, ctx, activeTab, domOverride = null) {
  const jsonCount = countUniversalJsonItems(ctx.marketBriefData, tab);
  const extractCount = extractVideoTabItems(ctx.effectiveVideo, tab, ctx.marketBriefData).length;
  const activeTabItemsCount = activeTab === tab ? extractCount : extractCount;
  const rendererInputCount = countRendererInput(tab, ctx);
  const domRenderedCount = activeTab === tab
    ? (domOverride ?? countDomForActiveTab(tab))
    : null;

  const row = { tab, jsonCount, extractCount, activeTabItemsCount, rendererInputCount, domRenderedCount };
  const loss = detectFirstLossPoint({ ...row, domRenderedCount: domRenderedCount ?? rendererInputCount });
  return { ...row, ...loss };
}

/** Build audit matrix rows. Set `log: true` only from DEV scripts (never from app UI). */
export function buildAuditMatrix(ctx, domByTab = {}, { log = false } = {}) {
  const rows = AUDIT_TAB_VALUES.map((tab) => {
    const jsonCount = countUniversalJsonItems(ctx.marketBriefData, tab);
    const extractCount = extractVideoTabItems(ctx.effectiveVideo, tab, ctx.marketBriefData).length;
    const activeTabItemsCount = extractCount;
    const rendererInputCount = countRendererInput(tab, ctx);
    const domRenderedCount = domByTab[tab] ?? null;

    if (log) {
      console.log('[RuntimeTabsAudit:jsonCount]', { tab, count: jsonCount });
      console.log('[RuntimeTabsAudit:extractCount]', { tab, count: extractCount });
      console.log('[RuntimeTabsAudit:activeTabItemsCount]', { tab, count: activeTabItemsCount });
      console.log('[RuntimeTabsAudit:rendererInputCount]', { tab, count: rendererInputCount });
      if (domRenderedCount != null) {
        console.log('[RuntimeTabsAudit:domRenderedCount]', { tab, count: domRenderedCount });
      }
    }

    const loss = detectFirstLossPoint({
      tab, jsonCount, extractCount, activeTabItemsCount, rendererInputCount,
      domRenderedCount: domRenderedCount ?? 0,
    });
    if (log) {
      console.log('[RuntimeTabsAudit:firstLossPoint]', {
        tab,
        point: loss.point,
        file: loss.file,
        line: loss.line,
        cause: loss.cause,
      });
    }

    return {
      tab,
      jsonCount,
      extractCount,
      activeTabItemsCount,
      rendererInputCount,
      domRenderedCount: domRenderedCount ?? '—',
      firstLossPoint: loss.point,
      fileLine: `${loss.file}:${loss.line}`,
      rootCause: loss.cause,
    };
  });

  if (log) console.log('[RuntimeTabsAudit:matrix]', rows);
  return rows;
}
