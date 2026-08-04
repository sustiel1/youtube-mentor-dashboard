import { extractVideoTabItems } from '@/config/videoTabsConfig';
import { buildMorningBriefBulkSections } from '@/lib/morningBriefBulkSections';

export const AI_MAPPING_PREVIEW_LIMIT = 120;

const MARKET_BRIEF_RENDERER_SLUGS = new Set(['morning-brief', 'evening-brief']);
const SECRET_KEY_PATTERN = /(api[-_]?key|token|secret|password|credential|authorization|env(?:ironment)?)/i;
const TRANSCRIPT_KEY_PATTERN = /(transcript|fullTranscript|rawTranscript)/i;
const RAW_PAYLOAD_KEY_PATTERN = /(rawProvider|providerPayload|rawResponse|providerResponse|requestPayload)/i;
const METADATA_KEYS = new Set([
  'contentType',
  'provider',
  'analysisProvider',
  'analysisSource',
  'extractionMeta',
  'generatedAt',
  'savedAt',
  'updatedAt',
  'createdAt',
  'videoId',
  'youtubeId',
  'manualOverrides',
  'broadcastSchedule',
]);

const UNIVERSAL_DESTINATIONS = {
  summary: 'summary',
  chapters: 'chapters',
  insights: 'insights',
  usefulKnowledge: 'useful-knowledge',
  app: 'app-builder',
  appBuilder: 'app-builder',
  topicsSubtopics: 'topics-subtopics',
  specialized: 'specialized',
};

const SPECIALIZED_RENDERED_FIELDS = new Set([
  'marketOverview', 'marketNews', 'headlines', 'news', 'topStories', 'catalysts',
  'indices', 'indexPerformance', 'indexData', 'marketDashboard', 'marketRegime',
  'sectorRotation', 'sectors', 'macro', 'macroEvents', 'macroHighlights',
  'macroFactors', 'economicEvents', 'sentiment', 'marketSentiment',
  'sentimentAnalysis', 'marketMood', 'fearGreed', 'calendar', 'economicCalendar',
  'events', 'upcomingEvents', 'schedule', 'stocks', 'stocksMentioned', 'watchlist',
  'tickers', 'watchlistLevels', 'keyLevels', 'risks', 'warnings', 'riskFactors',
  'opportunities', 'tradingOpportunities', 'trades', 'top5Insights',
  'learningInsights', 'allPoints',
]);

const FALLBACKS_BY_UNIVERSAL_FIELD = {
  summary: ['summary', 'shortSummary', 'fullSummary', 'mainLesson'],
  chapters: ['chapters'],
  insights: ['top5Insights', 'learningInsights', 'conclusions'],
  usefulKnowledge: ['reusableKnowledge', 'keyTakeaways', 'actionChecklist'],
  appBuilder: ['appBuilding'],
  topicsSubtopics: ['tags', 'obsidianTopics'],
};

const DESTINATION_LABELS_HE = {
  summary: 'סיכום',
  chapters: 'פרקים',
  insights: 'תובנות',
  'useful-knowledge': 'ידע שימושי',
  'app-builder': 'APP',
  'topics-subtopics': 'נושאים ותתי־נושאים',
  specialized: 'תוכן ייעודי',
  transcript: 'תמלול',
};

export function diagnosticValueCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'boolean') return 1;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

export function hasDiagnosticValue(value) {
  return diagnosticValueCount(value) > 0;
}

export function sanitizeDiagnosticSourcePath(path) {
  const safe = String(path || '')
    .split('.')
    .map((segment) => {
      if (/^\d+$/.test(segment)) return '[]';
      if (SECRET_KEY_PATTERN.test(segment)) return '[רגיש]';
      if (RAW_PAYLOAD_KEY_PATTERN.test(segment)) return '[מטען-פנימי]';
      return segment.replace(/[^\p{L}\p{N}_\-[\]]/gu, '_');
    })
    .join('.')
    .replace(/\.\[\]/g, '[]');
  return safe.length <= 160 ? safe : `${safe.slice(0, 159)}…`;
}

function scalarPreview(value) {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function compactValuePreview(value) {
  const scalar = scalarPreview(value);
  if (scalar) return scalar;
  if (Array.isArray(value)) {
    return value.slice(0, 2).map((item) => {
      const itemScalar = scalarPreview(item);
      if (itemScalar) return itemScalar;
      if (!item || typeof item !== 'object') return '';
      return Object.entries(item)
        .filter(([key]) => !SECRET_KEY_PATTERN.test(key) && !TRANSCRIPT_KEY_PATTERN.test(key) && !RAW_PAYLOAD_KEY_PATTERN.test(key))
        .slice(0, 2)
        .map(([key, child]) => `${key}: ${scalarPreview(child) || '{…}'}`)
        .join(', ');
    }).filter(Boolean).join(' · ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !SECRET_KEY_PATTERN.test(key) && !TRANSCRIPT_KEY_PATTERN.test(key) && !RAW_PAYLOAD_KEY_PATTERN.test(key))
      .slice(0, 2)
      .map(([key, child]) => `${key}: ${scalarPreview(child) || '{…}'}`)
      .join(' · ');
  }
  return '';
}

export function sanitizeDiagnosticPreview(value, path = '') {
  if (SECRET_KEY_PATTERN.test(path)) return '[ערך רגיש הוסתר]';
  if (TRANSCRIPT_KEY_PATTERN.test(path)) return '[תמלול הוסתר]';
  if (RAW_PAYLOAD_KEY_PATTERN.test(path)) return '[מטען ספק גולמי הוסתר]';
  const text = compactValuePreview(value);
  return text.length <= AI_MAPPING_PREVIEW_LIMIT
    ? text
    : `${text.slice(0, AI_MAPPING_PREVIEW_LIMIT - 1)}…`;
}

function countSpecializedItems(video, marketBriefData) {
  return buildMorningBriefBulkSections(video, marketBriefData)
    .reduce((sum, section) => sum + (Array.isArray(section.items) ? section.items.length : 0), 0);
}

export function resolveAiMappingTab({
  video = {},
  marketBriefData = null,
  normalizedSubCategory = '',
  tabKey,
} = {}) {
  const usesCanonicalSpecializedSelector = tabKey === 'specialized'
    && MARKET_BRIEF_RENDERER_SLUGS.has(normalizedSubCategory);
  const count = usesCanonicalSpecializedSelector
    ? countSpecializedItems(video, marketBriefData)
    : extractVideoTabItems(video, tabKey, marketBriefData).length;
  return { tabKey, count, usesCanonicalSpecializedSelector };
}

export function buildAiMappingCoverage({
  video = {},
  marketBriefData = null,
  normalizedSubCategory = '',
  tabKeys = [],
} = {}) {
  const tabCounts = Object.fromEntries(tabKeys.map((tabKey) => [
    tabKey,
    resolveAiMappingTab({ video, marketBriefData, normalizedSubCategory, tabKey }).count,
  ]));
  return {
    tabCounts,
    totalItems: Object.values(tabCounts).reduce((sum, count) => sum + count, 0),
  };
}

export function countActiveMappedFields({
  video = {},
  marketBriefData = null,
  learningFieldToTab = {},
  briefFieldToTab = {},
} = {}) {
  const analysis = video?.analysis || {};
  const learning = analysis?.learning || {};
  const active = new Set();

  for (const field of Object.keys(learningFieldToTab)) {
    if ([video?.[field], analysis?.[field], learning?.[field]].some(hasDiagnosticValue)) {
      active.add(`learning:${field}`);
    }
  }

  const specialized = marketBriefData?.universalTabs?.specialized;
  for (const field of Object.keys(briefFieldToTab)) {
    const candidates = field === 'universalTabs'
      ? [marketBriefData?.universalTabs]
      : [marketBriefData?.[field], marketBriefData?.rawData?.[field], specialized?.[field]];
    if (candidates.some(hasDiagnosticValue)) active.add(`brief:${field}`);
  }
  return active.size;
}

function destinationLabel(tabKey) {
  return DESTINATION_LABELS_HE[tabKey] || tabKey || 'לא מיועד לתצוגה';
}

function makeExcludedEntry({
  path,
  value,
  reasonHe,
  destinationTab = '',
  displayedElsewhere = false,
  actionRequired = false,
}) {
  return {
    sourcePath: sanitizeDiagnosticSourcePath(path),
    preview: sanitizeDiagnosticPreview(value, path),
    reasonHe,
    destinationTab,
    destinationLabelHe: destinationLabel(destinationTab),
    displayedElsewhere,
    actionRequired,
    actionLabelHe: actionRequired ? 'נדרשת בדיקת מיפוי' : 'לא נדרשת פעולה',
  };
}

function metadataReason(path) {
  if (SECRET_KEY_PATTERN.test(path)) return 'הערך הוחרג מטעמי אבטחה ופרטיות.';
  if (TRANSCRIPT_KEY_PATTERN.test(path)) return 'תוכן התמלול אינו נכלל באבחון המיפוי.';
  if (RAW_PAYLOAD_KEY_PATTERN.test(path)) return 'מטען הספק הגולמי אינו מיועד להצגה באבחון.';
  return 'זהו מידע פנימי או תפעולי שאינו מיועד להצגה כתוכן.';
}

export function buildExcludedItemDiagnostics({
  video = {},
  marketBriefData = null,
  learningFieldToTab = {},
  briefFieldToTab = {},
} = {}) {
  const entries = [];
  const recorded = new Set();
  const add = (options) => {
    const key = String(options.path || '');
    if (!key || recorded.has(key) || !hasDiagnosticValue(options.value)) return;
    recorded.add(key);
    entries.push(makeExcludedEntry(options));
  };

  const collectSensitive = (value, path, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 5) return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (SECRET_KEY_PATTERN.test(key) || TRANSCRIPT_KEY_PATTERN.test(key) || RAW_PAYLOAD_KEY_PATTERN.test(key)) {
        add({
          path: childPath,
          value: child,
          reasonHe: metadataReason(childPath),
          destinationTab: TRANSCRIPT_KEY_PATTERN.test(key) ? 'transcript' : '',
          displayedElsewhere: TRANSCRIPT_KEY_PATTERN.test(key),
        });
        continue;
      }
      collectSensitive(child, childPath, depth + 1);
    }
  };

  collectSensitive(video, 'video');
  collectSensitive(marketBriefData, 'marketBriefData');

  for (const [rootName, root] of [['video', video], ['marketBriefData', marketBriefData || {}]]) {
    for (const key of METADATA_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(root || {}, key)) continue;
      const value = root[key];
      if (key === 'extractionMeta' && value && typeof value === 'object') {
        for (const [metaKey, metaValue] of Object.entries(value)) {
          add({ path: `${rootName}.extractionMeta.${metaKey}`, value: metaValue, reasonHe: metadataReason(metaKey) });
        }
      } else {
        add({ path: `${rootName}.${key}`, value, reasonHe: metadataReason(key) });
      }
    }
  }

  const universalTabs = marketBriefData?.universalTabs;
  for (const [universalField, fallbackFields] of Object.entries(FALLBACKS_BY_UNIVERSAL_FIELD)) {
    const canonicalValue = universalTabs?.[universalField]
      ?? (universalField === 'appBuilder' ? universalTabs?.app : undefined);
    if (!hasDiagnosticValue(canonicalValue)) continue;
    const destinationTab = UNIVERSAL_DESTINATIONS[universalField];
    for (const field of fallbackFields) {
      for (const [path, value] of [
        [`marketBriefData.${field}`, marketBriefData?.[field]],
        [`marketBriefData.rawData.${field}`, marketBriefData?.rawData?.[field]],
        [`video.${field}`, video?.[field]],
      ]) {
        add({
          path,
          value,
          reasonHe: 'קיים מקור קנוני בעדיפות גבוהה יותר, ולכן ערך ה־fallback אינו מוצג שוב.',
          destinationTab,
          displayedElsewhere: true,
        });
      }
    }
  }

  const knownBriefFields = new Set([...Object.keys(briefFieldToTab), ...SPECIALIZED_RENDERED_FIELDS]);
  const visitUnknown = (object, basePath, knownFields) => {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return;
    for (const [key, value] of Object.entries(object)) {
      const path = `${basePath}.${key}`;
      if (recorded.has(path) || !hasDiagnosticValue(value) || METADATA_KEYS.has(key)) continue;
      if (knownFields.has(key)) continue;
      if (SECRET_KEY_PATTERN.test(key) || TRANSCRIPT_KEY_PATTERN.test(key) || RAW_PAYLOAD_KEY_PATTERN.test(key)) continue;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        visitUnknown(value, path, new Set());
        continue;
      }
      add({
        path,
        value,
        reasonHe: 'לא נמצא עבור השדה יעד תצוגה קנוני מאומת.',
        actionRequired: true,
      });
    }
  };

  const universalKnownFields = new Set([
    ...Object.keys(UNIVERSAL_DESTINATIONS),
    ...SPECIALIZED_RENDERED_FIELDS,
  ]);
  visitUnknown(marketBriefData, 'marketBriefData', new Set([...knownBriefFields, 'rawData', 'universalTabs']));
  visitUnknown(marketBriefData?.rawData, 'marketBriefData.rawData', knownBriefFields);
  visitUnknown(universalTabs, 'marketBriefData.universalTabs', universalKnownFields);
  visitUnknown(video?.analysis, 'video.analysis', new Set([...Object.keys(learningFieldToTab), 'learning', 'appBuilding']));
  visitUnknown(video?.analysis?.learning, 'video.analysis.learning', new Set(Object.keys(learningFieldToTab)));

  return entries.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'he'));
}
