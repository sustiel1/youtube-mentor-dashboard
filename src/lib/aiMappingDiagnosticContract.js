import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { buildMorningBriefBulkSections } from '@/lib/morningBriefBulkSections';
import { resolveSummaryConclusion } from '@/lib/summaryConclusionResolver';
import {
  AMBIGUOUS_UNLABELLED_PERCENTAGE_REASON,
  isAmbiguousUnlabelledMacroPercentage,
} from '@/lib/macroDisplayCleanup';

export const LEARNING_FIELD_TO_TAB = {
  definitions: 'definitions',
  concepts: 'definitions',
  indicators: 'indicators',
  setups: 'setups',
  tradingSetups: 'setups',
  patterns: 'patterns',
  tradingPatterns: 'patterns',
  checklists: 'checklists',
  mistakesToAvoid: 'mistakes',
  warnings: 'mistakes',
  riskRules: 'mistakes',
  brainHighlights: 'trading-brain',
  tradingPrinciples: 'trading-brain',
  mentalModels: 'trading-brain',
  keyInsights: 'trading-brain',
  mainLesson: 'trading-brain',
  usefulKnowledge: 'useful-knowledge',
  keyTakeaways: 'useful-knowledge',
  actionItems: 'useful-knowledge',
};

export const BRIEF_FIELD_TO_TAB = {
  marketNews: 'market-news',
  headlines: 'market-news',
  news: 'market-news',
  topStories: 'market-news',
  snapshot: 'market-news',
  marketOverview: 'market-news',
  catalysts: 'market-news',
  indices: 'indices',
  indexPerformance: 'indices',
  indexData: 'indices',
  keyLevels: 'indices',
  sectorRotation: 'indices',
  macro: 'brief-macro',
  macroEvents: 'brief-macro',
  macroHighlights: 'brief-macro',
  macroContext: 'brief-macro',
  economicContext: 'brief-macro',
  economicEvents: 'brief-macro',
  macroFactors: 'brief-macro',
  sentiment: 'brief-sentiment',
  marketSentiment: 'brief-sentiment',
  sentimentAnalysis: 'brief-sentiment',
  marketMood: 'brief-sentiment',
  fearGreed: 'brief-sentiment',
  calendar: 'brief-calendar',
  economicCalendar: 'brief-calendar',
  events: 'brief-calendar',
  upcomingEvents: 'brief-calendar',
  schedule: 'brief-calendar',
  stocks: 'stocks-mentioned',
  stocksMentioned: 'stocks-mentioned',
  watchlist: 'stocks-mentioned',
  tickers: 'stocks-mentioned',
  watchlistLevels: 'stocks-mentioned',
  risks: 'brief-risks',
  warnings: 'brief-risks',
  riskFactors: 'brief-risks',
  opportunities: 'brief-opportunities',
  tradingOpportunities: 'brief-opportunities',
  trades: 'brief-opportunities',
  reusableKnowledge: 'brief-conclusions',
  actionChecklist: 'brief-conclusions',
  conclusions: 'brief-conclusions',
  keyTakeaways: 'brief-conclusions',
  top5Insights: 'brief-conclusions',
  learningInsights: 'brief-conclusions',
  chapters: 'chapters',
  obsidianTopics: 'useful-knowledge',
  universalTabs: 'summary',
};

export const COVERAGE_TAB_KEYS = [
  'summary',
  'chapters',
  'insights',
  'useful-knowledge',
  'app-builder',
  'topics-subtopics',
  'specialized',
];

export const DIAGNOSTIC_TAB_SOURCE_PATHS = {
  summary: [
    'marketBriefData.universalTabs.summary',
    'marketBriefData.rawData.marketOverview',
    'marketBriefData.shortSummary',
    'marketBriefData.fullSummary',
    'marketBriefData.mainLesson',
    'video.shortSummary',
    'video.fullSummary',
    'video.mainLesson',
  ],
  chapters: [
    'marketBriefData.universalTabs.chapters',
    'marketBriefData.rawData.chapters',
    'marketBriefData.chapters',
    'video.chapters',
    'video.aiChapters',
    'video.analysis.chapters',
  ],
  insights: [
    'marketBriefData.universalTabs.insights',
    'marketBriefData.rawData.top5Insights',
    'marketBriefData.rawData.learningInsights',
    'marketBriefData.top5Insights',
    'marketBriefData.learningInsights',
    'video.keyInsights',
  ],
  'useful-knowledge': [
    'marketBriefData.universalTabs.usefulKnowledge',
    'marketBriefData.rawData.reusableKnowledge',
    'marketBriefData.rawData.actionChecklist',
    'marketBriefData.reusableKnowledge',
    'marketBriefData.keyTakeaways',
    'marketBriefData.actionChecklist',
    'video.usefulKnowledge',
    'video.actionItems',
  ],
  'app-builder': [
    'marketBriefData.universalTabs.app',
    'marketBriefData.universalTabs.appBuilder',
    'marketBriefData.rawData.appBuilding',
    'marketBriefData.appBuilding',
    'video.analysis.appBuilding',
  ],
  'topics-subtopics': [
    'marketBriefData.universalTabs.topicsSubtopics',
    'marketBriefData.rawData.obsidianTopics',
    'marketBriefData.rawData.tags',
    'marketBriefData.obsidianTopics',
    'marketBriefData.tags',
    'video.obsidianTopics',
    'video.tags',
  ],
  specialized: [
    'marketBriefData.universalTabs.specialized',
    'marketBriefData.universalTabs.marketOverview',
    'marketBriefData.universalTabs.marketNews',
    'marketBriefData.universalTabs.indices',
    'marketBriefData.universalTabs.sectorRotation',
    'marketBriefData.universalTabs.tradingOpportunities',
    'marketBriefData.universalTabs.risks',
    'marketBriefData.universalTabs.stocksMentioned',
    'marketBriefData.universalTabs.catalysts',
    'marketBriefData.universalTabs.economicCalendar',
    'marketBriefData.universalTabs.macroFactors',
    'marketBriefData.universalTabs.sentiment',
    'marketBriefData.universalTabs.keyLevels',
    'marketBriefData.universalTabs.watchlistLevels',
    'marketBriefData.universalTabs.top5Insights',
    'marketBriefData.universalTabs.learningInsights',
    'marketBriefData.universalTabs.allPoints',
    'marketBriefData.rawData',
    'marketBriefData.marketOverview',
    'marketBriefData.marketNews',
    'marketBriefData.indices',
    'marketBriefData.sectorRotation',
    'marketBriefData.tradingOpportunities',
    'marketBriefData.risks',
    'marketBriefData.stocksMentioned',
    'marketBriefData.catalysts',
    'marketBriefData.economicCalendar',
    'marketBriefData.macroFactors',
    'marketBriefData.sentiment',
    'marketBriefData.keyLevels',
    'marketBriefData.watchlistLevels',
    'marketBriefData.top5Insights',
    'marketBriefData.learningInsights',
    'marketBriefData.allPoints',
  ],
};

function valueCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return value == null ? 0 : 1;
}

function getPathValue({ video, marketBriefData }, path) {
  const [root, ...segments] = String(path || '').split('.');
  const base = root === 'video' ? video : root === 'marketBriefData' ? marketBriefData : undefined;
  return segments.reduce((value, key) => (value == null ? undefined : value[key]), base);
}

export function resolveDiagnosticTab({
  video = {},
  marketBriefData = null,
  tabKey,
}) {
  const sourcePaths = DIAGNOSTIC_TAB_SOURCE_PATHS[tabKey] || [];
  const matchedSourcePaths = sourcePaths.filter(
    (path) => valueCount(getPathValue({ video, marketBriefData }, path)) > 0,
  );
  const items = tabKey === 'specialized'
    ? buildMorningBriefBulkSections(video, marketBriefData)
        .reduce((sum, section) => sum + section.items.length, 0)
    : extractVideoTabItems(video, tabKey, marketBriefData).length;

  return {
    tabKey,
    items,
    sourcePaths,
    matchedSourcePaths,
    dataFound: items > 0,
  };
}

export function getAnalysisDiagnosticStatus({
  provider,
  marketBriefData,
  canonical = false,
} = {}) {
  const hasMarketPayload = !!marketBriefData && typeof marketBriefData === 'object'
    && Object.keys(marketBriefData).length > 0;
  const gemsImport = provider === 'gems' && hasMarketPayload;
  const fallbackOnly = hasMarketPayload && !canonical && !gemsImport;

  return {
    canonicalClaude: canonical,
    gemsImport,
    fallbackOnly,
    anyAnalysisData: canonical || gemsImport || fallbackOnly,
    status: canonical
      ? 'ניתוח Claude קנוני הושלם'
      : gemsImport
        ? 'GEMS JSON נטען בהצלחה'
        : fallbackOnly
          ? 'קיים fallback חלקי בלבד'
          : 'אין נתוני ניתוח',
    contentStatus: canonical || gemsImport
      ? 'קיים תוכן מובנה'
      : fallbackOnly
        ? 'קיים תוכן fallback חלקי בלבד'
        : 'אין תוכן ניתוח',
  };
}

function countCoverageField(object, field) {
  const value = object?.[field];
  return Array.isArray(value)
    ? value.length
    : (typeof value === 'string' && value.trim() ? 1 : 0);
}

export function getAnalysisCoverageSummary({
  video = {},
  marketBriefData = null,
  canonical = false,
} = {}) {
  const resolvedVideo = video || {};
  const analysis = resolvedVideo.analysis || {};
  const learning = analysis.learning || {};
  const tabCounts = Object.fromEntries(COVERAGE_TAB_KEYS.map((tabKey) => [
    tabKey,
    resolveDiagnosticTab({ video: resolvedVideo, marketBriefData, tabKey }).items,
  ]));
  const activeLearningFields = Object.keys(LEARNING_FIELD_TO_TAB).filter((field) => (
    countCoverageField(resolvedVideo, field)
      || countCoverageField(analysis, field)
      || countCoverageField(learning, field)
  )).length;
  const activeBriefFields = marketBriefData
    ? Object.keys(BRIEF_FIELD_TO_TAB).filter((field) => countCoverageField(marketBriefData, field) > 0).length
    : 0;
  const totalItems = Object.values(tabCounts).reduce((sum, count) => sum + count, 0);
  const provider = resolvedVideo.analysisProvider || resolvedVideo.analysisSource || '';
  const status = getAnalysisDiagnosticStatus({ provider, marketBriefData, canonical });
  const hasTranscript = !!String(resolvedVideo.transcript || resolvedVideo.manualTranscript || '').trim()
    || (Array.isArray(resolvedVideo.transcriptSegments) && resolvedVideo.transcriptSegments.length > 0);
  const sourceType = status.gemsImport
    ? 'GEMS'
    : status.canonicalClaude
      ? 'AI'
      : totalItems > 0 && marketBriefData
        ? 'Partial'
        : totalItems > 0
          ? 'Legacy'
          : '';

  return {
    analysisType: marketBriefData ? 'Market Brief' : (resolvedVideo.contentType || 'Analysis'),
    sourceType,
    sourceLabel: sourceType === 'Partial' ? 'נתונים חלקיים' : sourceType,
    activeFields: activeLearningFields + activeBriefFields,
    totalItems,
    tabCounts,
    hasStructuredContent: totalItems > 0,
    hasTranscript,
    isPartial: sourceType === 'Partial',
    status,
  };
}

const EXCLUDED_DIAGNOSTIC_KEYS = new Set([
  'contentType',
  'extractionMeta',
  'provider',
  'analysisProvider',
  'analysisSource',
  'generatedAt',
  'savedAt',
  'updatedAt',
  'createdAt',
  'videoId',
  'youtubeId',
  'manualOverrides',
  'broadcastSchedule',
]);

const SECRET_KEY_PATTERN = /(api[-_]?key|token|secret|password|credential|authorization)/i;
const TRANSCRIPT_KEY_PATTERN = /(transcript|fullTranscript|rawTranscript)/i;
const INVALID_IDENTITY_KEYS = new Set(['id', '_id', 'uuid']);
const PREVIEW_LIMIT = 120;

export const EXCLUSION_REASON_LABELS_HE = {
  'metadata-only': 'מידע פנימי או תפעולי שאינו מיועד להצגה כתוכן.',
  'owned-by-other-tab': 'המידע שייך ללשונית אחרת ומוצג שם.',
  'duplicate-structured-fact': 'אותה עובדה כבר מוצגת בשדה מובנה אחר ולכן הוחרגה כדי למנוע כפילות.',
  'fallback-shadowed': 'קיים מקור קנוני בעדיפות גבוהה יותר, ולכן ערך ה־fallback אינו מוצג.',
  'app-builder-content': 'זהו רעיון לפיתוח האפליקציה והוא שייך ללשונית APP.',
  'topic-metadata': 'זהו תג או נושא לחיפוש ומיון, והוא שייך ללשונית נושאים ותתי־נושאים.',
  'broadcast-metadata': 'זהו מידע על שעת או מבנה השידור, ולא עובדת שוק.',
  'diagnostic-only': 'השדה משמש לאבחון המערכת בלבד ואינו תוכן המיועד להצגה.',
  'internal-provider-field': 'זהו שדה פנימי של ספק הניתוח שאינו מיועד לתצוגה.',
  'security-sensitive': 'השדה אינו מוצג מטעמי אבטחה ופרטיות.',
};

const UNIVERSAL_TAB_DESTINATIONS = {
  summary: 'summary',
  chapters: 'chapters',
  insights: 'insights',
  usefulKnowledge: 'useful-knowledge',
  app: 'app-builder',
  appBuilder: 'app-builder',
  topicsSubtopics: 'topics-subtopics',
  specialized: 'specialized',
};

const FALLBACK_TO_UNIVERSAL_TAB = {
  shortSummary: 'summary',
  fullSummary: 'summary',
  chapters: 'chapters',
  top5Insights: 'insights',
  learningInsights: 'insights',
  reusableKnowledge: 'usefulKnowledge',
  keyTakeaways: 'usefulKnowledge',
  actionChecklist: 'usefulKnowledge',
  appBuilding: 'appBuilder',
  obsidianTopics: 'topicsSubtopics',
  tags: 'topicsSubtopics',
};

function diagnosticItemCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'boolean') return 1;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

function diagnosticValueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function safeDiagnosticPreview(value, key = '') {
  if (SECRET_KEY_PATTERN.test(key)) return '[ערך רגיש הוסתר]';
  if (TRANSCRIPT_KEY_PATTERN.test(key)) return '[תמלול לא מוצג בדוח]';
  let text = '';
  if (typeof value === 'string') text = value.trim();
  else if (typeof value === 'number' || typeof value === 'boolean') text = String(value);
  else if (Array.isArray(value)) {
    text = value.slice(0, 2).map((item) => (
      typeof item === 'string' ? item : JSON.stringify(item)
    )).join(' · ');
  } else if (value && typeof value === 'object') {
    text = JSON.stringify(value);
  }
  if (text.length <= PREVIEW_LIMIT) return text;
  return `${text.slice(0, PREVIEW_LIMIT - 1)}…`;
}

function inventoryEntry({
  path,
  value,
  status,
  reason,
  reasonCode = '',
  reasonHe = '',
  destination = '',
  destinationLabelHe = '',
  owner = '',
  renderedElsewhere = false,
  exportedElsewhere = false,
  exclusionPermanence = '',
  actionRequired = false,
  recommendedActionHe = '',
  label = '',
}) {
  return {
    sourcePath: path,
    field: label || path.split('.').at(-1),
    path,
    label: label || path.split('.').at(-1),
    valueType: diagnosticValueType(value),
    itemCount: diagnosticItemCount(value),
    destination,
    consumer: destination,
    status,
    reason,
    reasonCode,
    reasonHe: reasonHe || reason,
    owner,
    destinationLabelHe: destinationLabelHe || destination,
    renderedElsewhere,
    exportedElsewhere,
    exclusionPermanence,
    actionRequired,
    recommendedActionHe,
    preview: safeDiagnosticPreview(value, path),
  };
}

function exclusionDescriptor(path) {
  const key = path.split('.').at(-1);
  if (SECRET_KEY_PATTERN.test(key)) {
    return {
      reasonCode: 'security-sensitive',
      owner: 'אבטחה ופרטיות',
      destinationLabelHe: 'לא מיועד לתצוגה',
      exclusionPermanence: 'permanent',
    };
  }
  if (TRANSCRIPT_KEY_PATTERN.test(key)) {
    return {
      reasonCode: 'diagnostic-only',
      owner: 'Metadata',
      destinationLabelHe: 'אבחון בלבד',
      renderedElsewhere: true,
      exclusionPermanence: 'conditional',
    };
  }
  if (key === 'broadcastSchedule') {
    return {
      reasonCode: 'broadcast-metadata',
      owner: 'Metadata',
      destinationLabelHe: 'Metadata',
      exclusionPermanence: 'permanent',
    };
  }
  if (['provider', 'analysisProvider', 'analysisSource'].includes(key)) {
    return {
      reasonCode: 'internal-provider-field',
      owner: 'Metadata',
      destinationLabelHe: 'אבחון בלבד',
      exclusionPermanence: 'permanent',
    };
  }
  if (path.includes('.extractionMeta') || key === 'extractionMeta') {
    return {
      reasonCode: 'diagnostic-only',
      owner: 'אבחון בלבד',
      destinationLabelHe: 'אבחון בלבד',
      exclusionPermanence: 'permanent',
    };
  }
  return {
    reasonCode: 'metadata-only',
    owner: 'Metadata',
    destinationLabelHe: 'Metadata',
    exclusionPermanence: 'permanent',
  };
}

function excludedEntryOptions(path, value) {
  const descriptor = exclusionDescriptor(path);
  const reasonHe = EXCLUSION_REASON_LABELS_HE[descriptor.reasonCode];
  return {
    path,
    value,
    status: 'excluded-by-design',
    reason: reasonHe,
    reasonHe,
    renderedElsewhere: false,
    exportedElsewhere: false,
    actionRequired: false,
    recommendedActionHe: descriptor.renderedElsewhere
      ? 'מוצג בלשונית אחרת'
      : 'לא נדרשת פעולה',
    ...descriptor,
  };
}

function isEmptyOrInvalid(value) {
  if (value == null) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    return keys.length === 0 || keys.every((key) => INVALID_IDENTITY_KEYS.has(key));
  }
  return false;
}

export function buildStructuredCoverageInventory({
  video = {},
  marketBriefData = null,
} = {}) {
  const payload = marketBriefData && typeof marketBriefData === 'object' ? marketBriefData : {};
  const result = {
    mapped: [],
    unmappedMeaningful: [],
    excludedByDesign: [],
    duplicateFallback: [],
    unsupported: [],
    invalid: [],
    transcriptCoverageStatus: 'not-compared',
  };

  const add = (bucket, options) => {
    result[bucket].push(inventoryEntry(options));
  };

  const addMacroSemanticIssues = (items, basePath) => {
    if (!Array.isArray(items)) return;
    const descriptiveKeys = [
      'description', 'comment', 'condition', 'note', 'notes', 'context',
      'thesis', 'status', 'reason', 'sectors', 'impact', 'marketImpact',
      'effect', 'expectedImpact', 'sentiment', 'bias',
    ];
    items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      descriptiveKeys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(item, key)) return;
        if (!isAmbiguousUnlabelledMacroPercentage(item[key])) return;
        add('unsupported', {
          path: `${basePath}.${index}.${key}`,
          value: item[key],
          status: 'diagnostic-only',
          reason: 'הערך לא מוצג משום שלא נמצא בחוזה משמעות מאומתת לאחוז.',
          reasonCode: AMBIGUOUS_UNLABELLED_PERCENTAGE_REASON,
          reasonHe: 'הערך לא מוצג משום שלא נמצא בחוזה משמעות מאומתת לאחוז.',
          actionRequired: true,
          recommendedActionHe: 'להוסיף שדה סמנטי מפורש, למשל probabilityPercent או changePercent.',
        });
      });
    });
  };

  const visitUnknown = (value, path, unsupported = false) => {
    if (isEmptyOrInvalid(value)) {
      add('invalid', {
        path,
        value,
        status: 'empty-or-invalid',
        reason: 'הערך ריק, לא תקין או מכיל מזהה בלבד',
      });
      return;
    }
    const key = path.split('.').at(-1);
    if (SECRET_KEY_PATTERN.test(key) || TRANSCRIPT_KEY_PATTERN.test(key) || EXCLUDED_DIAGNOSTIC_KEYS.has(key)) {
      if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && !SECRET_KEY_PATTERN.test(key)
        && !TRANSCRIPT_KEY_PATTERN.test(key)
      ) {
        Object.entries(value).forEach(([childKey, childValue]) => {
          const childPath = `${path}.${childKey}`;
          if (isEmptyOrInvalid(childValue)) {
            add('invalid', {
              path: childPath,
              value: childValue,
              status: 'empty-or-invalid',
              reason: 'ערך metadata ריק או לא תקין',
            });
          } else {
            add('excludedByDesign', excludedEntryOptions(childPath, childValue));
          }
        });
      } else {
        add('excludedByDesign', excludedEntryOptions(path, value));
      }
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value).forEach(([childKey, childValue]) => {
        visitUnknown(childValue, `${path}.${childKey}`, unsupported);
      });
      return;
    }
    add(unsupported ? 'unsupported' : 'unmappedMeaningful', {
      path,
      value,
      status: unsupported ? 'unsupported' : 'unmapped-meaningful',
      reason: unsupported
        ? 'השדה מאוכלס אך אינו מוכר בחוזה היישום'
        : 'נמצא תוכן מובנה משמעותי ללא consumer פעיל',
    });
  };

  Object.entries(payload).forEach(([key, value]) => {
    const path = `marketBriefData.${key}`;
    if (key === 'universalTabs' && value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value).forEach(([tabKey, tabValue]) => {
        const tabPath = `${path}.${tabKey}`;
        const destination = UNIVERSAL_TAB_DESTINATIONS[tabKey];
        if (tabKey === 'specialized' && tabValue && typeof tabValue === 'object') {
          addMacroSemanticIssues(tabValue.macroFactors, `${tabPath}.macroFactors`);
        }
        if (destination) {
          add(isEmptyOrInvalid(tabValue) ? 'invalid' : 'mapped', {
            path: tabPath,
            value: tabValue,
            destination,
            status: isEmptyOrInvalid(tabValue) ? 'empty-or-invalid' : 'mapped',
            reason: isEmptyOrInvalid(tabValue)
              ? 'מקור universalTabs ריק או לא תקין'
              : `נצרך על ידי הטאב ${destination}`,
          });
        } else {
          visitUnknown(tabValue, tabPath, true);
        }
      });
      return;
    }

    if (key === 'rawData' && value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value).forEach(([rawKey, rawValue]) => {
        const rawPath = `${path}.${rawKey}`;
        if (rawKey === 'macroFactors') addMacroSemanticIssues(rawValue, rawPath);
        const destination = BRIEF_FIELD_TO_TAB[rawKey]
          ? 'specialized'
          : UNIVERSAL_TAB_DESTINATIONS[FALLBACK_TO_UNIVERSAL_TAB[rawKey]];
        if (destination) {
          add(isEmptyOrInvalid(rawValue) ? 'invalid' : 'mapped', {
            path: rawPath,
            value: rawValue,
            destination,
            status: isEmptyOrInvalid(rawValue) ? 'empty-or-invalid' : 'mapped',
            reason: isEmptyOrInvalid(rawValue)
              ? 'שדה rawData ריק או לא תקין'
              : `נצרך כמקור rawData עבור ${destination}`,
          });
        } else {
          visitUnknown(rawValue, rawPath, true);
        }
      });
      return;
    }

    if (EXCLUDED_DIAGNOSTIC_KEYS.has(key) || SECRET_KEY_PATTERN.test(key) || TRANSCRIPT_KEY_PATTERN.test(key)) {
      visitUnknown(value, path);
      return;
    }

    if (key === 'mainLesson') {
      const resolution = resolveSummaryConclusion({ video, marketBriefData: payload });
      if (isEmptyOrInvalid(value)) {
        add('invalid', {
          path,
          value,
          status: 'empty-or-invalid',
          reason: 'mainLesson ריק או לא תקין',
        });
      } else if (resolution.fallbackStatus === 'duplicate') {
        add('duplicateFallback', {
          path,
          value,
          destination: 'summary / mainConclusion',
          status: 'duplicate-fallback',
          reason: `זהה ל-${resolution.duplicateOf}`,
        });
      } else if (resolution.fallbackStatus === 'shadowed') {
        const reasonCode = 'fallback-shadowed';
        const reasonHe = EXCLUSION_REASON_LABELS_HE[reasonCode];
        add('excludedByDesign', {
          path,
          value,
          destination: 'summary / mainConclusion',
          status: 'excluded-by-design',
          reason: reasonHe,
          reasonCode,
          reasonHe,
          owner: 'סיכום',
          destinationLabelHe: 'סיכום',
          renderedElsewhere: true,
          exportedElsewhere: true,
          exclusionPermanence: 'conditional',
          actionRequired: false,
          recommendedActionHe: 'מוצג בלשונית אחרת',
        });
      } else {
        add('mapped', {
          path,
          value,
          destination: 'summary / mainConclusion',
          status: 'mapped',
          reason: 'נצרך כ-fallback הקנוני של מסקנת Summary',
        });
      }
      return;
    }

    const fallbackTab = FALLBACK_TO_UNIVERSAL_TAB[key];
    const preferredValue = fallbackTab && payload.universalTabs?.[fallbackTab];
    if (fallbackTab && !isEmptyOrInvalid(preferredValue) && !isEmptyOrInvalid(value)) {
      add('duplicateFallback', {
        path,
        value,
        destination: UNIVERSAL_TAB_DESTINATIONS[fallbackTab],
        status: 'duplicate-fallback',
        reason: `המידע מיוצג כבר ב-universalTabs.${fallbackTab}`,
      });
      return;
    }

    if (BRIEF_FIELD_TO_TAB[key] || DIAGNOSTIC_TAB_SOURCE_PATHS.specialized.includes(path)) {
      if (key === 'macroFactors') addMacroSemanticIssues(value, path);
      add(isEmptyOrInvalid(value) ? 'invalid' : 'mapped', {
        path,
        value,
        destination: 'specialized',
        status: isEmptyOrInvalid(value) ? 'empty-or-invalid' : 'mapped',
        reason: isEmptyOrInvalid(value)
          ? 'שדה נתמך אך ריק או לא תקין'
          : 'נצרך על ידי Specialized או fallback נתמך',
      });
      return;
    }

    visitUnknown(value, path);
  });

  const videoTranscript = video?.transcript || video?.manualTranscript;
  if (videoTranscript || (Array.isArray(video?.transcriptSegments) && video.transcriptSegments.length > 0)) {
    result.excludedByDesign.push(inventoryEntry(
      excludedEntryOptions('video.transcript', '[hidden]'),
    ));
  }

  return result;
}
