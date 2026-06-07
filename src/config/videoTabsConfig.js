/**
 * Dynamic tab configuration per video type.
 *
 * detectVideoType(video)           → 'learning' | 'morningBrief' | 'eveningBrief' | 'political' | 'general'
 * getTabsForVideo(video, options)  → tab definition array
 * extractVideoTabItems(video, tabValue, marketBriefData) → string[] for tab content
 * getTabBadge(video, tabValue, marketBriefData)          → number (badge count)
 */

// ── Keyword lists ────────────────────────────────────────────────────

const LEARNING_KEYWORDS = [
  'לימוד', 'ניתוח טכני', 'סטאפים', 'אינדיקטורים',
  'price action', 'smc', 'ict', 'macd', 'ema', 'rsi',
  'wysetrade', 'micha stocks', 'technical analysis',
  'setup', 'candlestick', 'chart pattern', 'support resistance',
  'תמיכה והתנגדות', 'נר יפני', 'ממוצע נע', 'moving average',
];

const MORNING_BRIEF_KEYWORDS = [
  'מבזק בוקר', 'morning brief', 'premarket', 'pre-market',
  'סקירת בוקר', 'פתיחת שוק',
];

const EVENING_BRIEF_KEYWORDS = [
  'מבזק ערב', 'סיכום יום', 'market close', 'סקירת ערב',
  'evening brief', 'סגירת שוק',
];

function matchesAny(str, keywords) {
  const lower = String(str || '').toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

// ── Video type detection ─────────────────────────────────────────────

/**
 * Returns a video type string based on category, contentType, title, and keywords.
 * Returns 'general' when no specific type is detected.
 */
export function detectVideoType(video) {
  if (!video) return 'general';

  const ct       = String(video.contentType || video.analysis?.contentType || '').toLowerCase();
  const category = String(video.category || '').toLowerCase();
  const subCat   = String(video.subCategory || '').toLowerCase();
  const title    = String(video.title || '').toLowerCase();
  const channel  = String(video.channelName || video.mentorName || '').toLowerCase();
  const tagsStr  = (Array.isArray(video.tags) ? video.tags : []).join(' ').toLowerCase();
  const combined = `${title} ${channel} ${tagsStr}`;

  if (ct === 'political' || category.includes('פוליטיק')) return 'political';

  if (matchesAny(title, MORNING_BRIEF_KEYWORDS) || ct === 'marketbrief') return 'morningBrief';
  if (matchesAny(title, EVENING_BRIEF_KEYWORDS)) return 'eveningBrief';

  const isMarketCat     = category.includes('שוק') || category === 'markets' || category.includes('מסחר');
  const isTechnicalType = ct === 'technical' || ct === 'market' || subCat.includes('טכני') || subCat.includes('technical');
  const hasLearningKw   = matchesAny(combined, LEARNING_KEYWORDS);

  if (isMarketCat || isTechnicalType || hasLearningKw) return 'learning';

  return 'general';
}

// ── Tab definitions ──────────────────────────────────────────────────

export const LEARNING_TABS = [
  { value: 'summary',          label: 'סיכום',         emoji: '📋' },
  { value: 'chapters',         label: 'פרקים',          emoji: '📚' },
  { value: 'useful-knowledge', label: 'ידע שימושי',    emoji: '💡' },
  { value: 'definitions',      label: 'מושגים',         emoji: '📖' },
  { value: 'indicators',       label: 'אינדיקטורים',   emoji: '📈' },
  { value: 'setups',           label: 'סטאפים',         emoji: '🎯' },
  { value: 'patterns',         label: 'פטרנים',         emoji: '📊' },
  { value: 'checklists',       label: "צ'קליסטים",     emoji: '✅' },
  { value: 'mistakes',         label: 'טעויות',         emoji: '⚠️' },
  { value: 'trading-brain',    label: 'מוח המסחר',     emoji: '🧠' },
  { value: 'ai-analysis',      label: 'ניתוח AI',       emoji: '🤖' },
];

export const BRIEF_TABS = [
  { value: 'summary',              label: 'סיכום',          emoji: '📋' },
  { value: 'market-news',          label: 'חדשות שוק',      emoji: '📰' },
  { value: 'indices',              label: 'מדדים',          emoji: '📊' },
  { value: 'stocks-mentioned',     label: 'מניות מוזכרות',  emoji: '🏢' },
  { value: 'brief-risks',          label: 'סיכונים',        emoji: '⚠️' },
  { value: 'brief-opportunities',  label: 'הזדמנויות',      emoji: '🎯' },
  { value: 'brief-conclusions',    label: 'מסקנות למסחר',   emoji: '🧠' },
  { value: 'ai-analysis',          label: 'ניתוח AI',       emoji: '🤖' },
];

export const DEFAULT_TABS = [
  { value: 'summary',     label: 'סיכום',         emoji: '📝' },
  { value: 'keypoints',   label: 'נקודות מפתח',   emoji: '📌' },
  { value: 'chapters',    label: 'פרקים',          emoji: '📚' },
  { value: 'ai-analysis', label: 'ניתוח AI',       emoji: '🧠' },
];

/**
 * Returns the ordered tab array for a given video.
 * Pass runtime flags for conditionally-shown tabs.
 */
export function getTabsForVideo(video, {
  hasPolitical   = false,
  hasMarketBrief = false,
  hasAppBuilder  = false,
} = {}) {
  const type = detectVideoType(video);

  if (type === 'learning') {
    const tabs = [...LEARNING_TABS];
    if (hasAppBuilder) tabs.push({ value: 'app-builder', label: 'בונה אפליקציות', emoji: '🏗️' });
    return tabs;
  }

  if (type === 'morningBrief' || type === 'eveningBrief') {
    const tabs = [...BRIEF_TABS];
    if (hasMarketBrief) tabs.splice(1, 0, { value: 'market-brief', label: 'מבזק שוק', emoji: '📈' });
    return tabs;
  }

  // Default + conditional
  const tabs = [...DEFAULT_TABS];
  if (hasPolitical)   tabs.push({ value: 'political',     label: 'פוליטי',           emoji: '🏛️' });
  if (hasMarketBrief) tabs.push({ value: 'market-brief',  label: 'מבזק שוק',         emoji: '📈' });
  if (hasAppBuilder)  tabs.push({ value: 'app-builder',   label: 'בונה אפליקציות',   emoji: '🏗️' });
  return tabs;
}

// ── Field extraction ─────────────────────────────────────────────────

function pickArray(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return [];
}

function pickNested(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur == null) return [];
  }
  return Array.isArray(cur) && cur.length > 0 ? cur : [];
}

function pickStringAsArray(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (typeof val === 'string' && val.trim()) return [val.trim()];
  }
  return [];
}

/**
 * Returns an array of items for the given tab value.
 * Handles both flat (new) and nested legacy analysis structures.
 *
 * @param {object} video           — the video prop (post-analysis)
 * @param {string} tabValue        — tab value string
 * @param {object|null} marketBriefData — from localStorage gem JSON paste
 */
export function extractVideoTabItems(video, tabValue, marketBriefData = null) {
  if (!video) return [];

  const al = video.analysis?.learning || {};
  const a  = video.analysis || {};

  switch (tabValue) {
    case 'useful-knowledge':
      return [
        ...pickArray(video, 'actionItems', 'usefulKnowledge', 'keyTakeaways'),
        ...pickArray(al, 'keyTakeaways', 'actionItems'),
      ];

    case 'definitions':
      return [
        ...pickArray(video, 'definitions', 'concepts'),
        ...pickArray(al, 'definitions'),
        ...pickArray(a, 'concepts'),
      ];

    case 'indicators':
      return [
        ...pickArray(video, 'indicators'),
        ...pickArray(al, 'indicators'),
        ...pickArray(a, 'indicators'),
      ];

    case 'setups':
      return [
        ...pickArray(video, 'setups', 'tradingSetups'),
        ...pickArray(al, 'setups'),
        ...pickArray(a, 'tradingSetups'),
      ];

    case 'patterns':
      return [
        ...pickArray(video, 'patterns', 'tradingPatterns'),
        ...pickArray(al, 'patterns'),
      ];

    case 'checklists':
      return [
        ...pickArray(video, 'checklists'),
        ...pickArray(al, 'checklists'),
        ...pickArray(a, 'rules'),
      ];

    case 'mistakes':
      return [
        ...pickArray(video, 'mistakesToAvoid', 'warnings', 'riskRules'),
        ...pickArray(al, 'mistakes', 'mistakesToAvoid'),
        ...pickArray(a, 'warnings'),
      ];

    case 'trading-brain':
      return [
        ...pickStringAsArray(video, 'mainLesson'),
        ...pickArray(video, 'brainHighlights', 'tradingPrinciples', 'mentalModels', 'keyInsights'),
        ...pickNested(video, 'analysis.brainHighlights'),
        ...pickArray(al, 'brainHighlights', 'tradingPrinciples'),
      ];

    case 'market-news':
      return marketBriefData
        ? pickArray(marketBriefData, 'snapshot', 'marketNews')
        : pickArray(video, 'marketConditions');

    case 'indices':
      return marketBriefData
        ? pickArray(marketBriefData, 'snapshot')
        : pickArray(video, 'marketConditions', 'keyLevels');

    case 'stocks-mentioned':
      if (marketBriefData) {
        const stocks = marketBriefData.stocks;
        return Array.isArray(stocks) ? stocks : pickArray(marketBriefData, 'stocksMentioned');
      }
      return pickArray(video, 'stocksMentioned');

    case 'brief-risks':
      return marketBriefData
        ? pickArray(marketBriefData, 'risks')
        : pickArray(video, 'warnings', 'riskRules', 'risks');

    case 'brief-opportunities':
      return marketBriefData
        ? pickArray(marketBriefData, 'opportunities')
        : pickArray(video, 'actionItems', 'tradingSetups', 'opportunities');

    case 'brief-conclusions':
      return marketBriefData
        ? pickArray(marketBriefData, 'reusableKnowledge', 'actionChecklist')
        : [
            ...pickStringAsArray(video, 'mainLesson'),
            ...pickArray(video, 'keyInsights'),
          ];

    default:
      return [];
  }
}

/**
 * Returns the badge count for a given tab (number of extracted items, capped at 99).
 */
export function getTabBadge(video, tabValue, marketBriefData = null) {
  const BADGED_TABS = new Set([
    'useful-knowledge', 'definitions', 'indicators', 'setups',
    'patterns', 'checklists', 'mistakes', 'trading-brain',
    'stocks-mentioned', 'brief-risks', 'brief-opportunities', 'brief-conclusions',
    'market-news', 'indices',
  ]);
  if (!BADGED_TABS.has(tabValue)) return 0;
  return Math.min(extractVideoTabItems(video, tabValue, marketBriefData).length, 99);
}
