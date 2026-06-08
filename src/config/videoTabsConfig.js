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

// ── SubCategory normalizer ───────────────────────────────────────────

const SUB_CATEGORY_SLUG_MAP = {
  // Hebrew values from DB
  'ניתוח טכני':   'technical-analysis',
  'פונדמנטלי':    'fundamental-analysis',
  'מאקרו':        'macro',
  'מבזק בוקר':   'morning-brief',
  'מבזק ערב':    'evening-brief',
  'מבזק שבועי':  'weekly-brief',
  'מבזק דוחות':  'earnings-brief',
  'פוליטי':       'political',
  'פוליטיקה':     'political',
  // English slugs (identity — future-proof)
  'technical-analysis':   'technical-analysis',
  'fundamental-analysis': 'fundamental-analysis',
  'macro':                'macro',
  'morning-brief':        'morning-brief',
  'evening-brief':        'evening-brief',
  'weekly-brief':         'weekly-brief',
  'earnings-brief':       'earnings-brief',
  'political':            'political',
};

/** Returns a canonical slug for a subCategory string, or null if unrecognized. */
export function normalizeSubCategory(subCategory) {
  const raw = String(subCategory || '').trim();
  return SUB_CATEGORY_SLUG_MAP[raw] || SUB_CATEGORY_SLUG_MAP[raw.toLowerCase()] || null;
}

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

/** Level-1 group tabs for learning videos (≤5 items + optional app-builder) */
export const LEARNING_GROUP_MAIN_TABS = [
  { value: 'summary',        label: 'סיכום',     emoji: '📋' },
  { value: 'learning-group', label: 'למידה',      emoji: '📚', isGroup: true },
  { value: 'trading-brain',  label: 'מוח המסחר', emoji: '🧠' },
  { value: 'ai-analysis',    label: 'ניתוח AI',   emoji: '🤖' },
];

/** Level-2 sub-tabs shown inside the למידה group */
export const LEARNING_SUB_TABS = [
  { value: 'chapters',         label: 'פרקים',       emoji: '📚' },
  { value: 'useful-knowledge', label: 'ידע שימושי',  emoji: '💡' },
  { value: 'definitions',      label: 'מושגים',       emoji: '📖' },
  { value: 'indicators',       label: 'אינדיקטורים', emoji: '📈' },
  { value: 'setups',           label: 'סטאפים',       emoji: '🎯' },
  { value: 'patterns',         label: 'פטרנים',       emoji: '📊' },
  { value: 'checklists',       label: "צ'קליסטים",   emoji: '✅' },
  { value: 'mistakes',         label: 'טעויות',       emoji: '⚠️' },
];

export const LEARNING_SUB_TAB_VALUES = new Set([
  'chapters', 'useful-knowledge', 'definitions', 'indicators',
  'setups', 'patterns', 'checklists', 'mistakes',
]);

/** 7 universal tabs — shown for every video regardless of type or category */
export const UNIVERSAL_TABS = [
  { value: 'summary',          label: 'סיכום',              emoji: '📝' },
  { value: 'chapters',         label: 'פרקים',               emoji: '📚' },
  { value: 'insights',         label: 'תובנות',              emoji: '💡' },
  { value: 'useful-knowledge', label: 'ידע שימושי',         emoji: '🧠' },
  { value: 'app-builder',      label: 'APP',                 emoji: '🚀' },
  { value: 'topics-subtopics', label: 'נושאים ותתי־נושאים', emoji: '🏷️' },
  { value: 'specialized',      label: 'תוכן ייעודי',        emoji: '🎯' },
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

// ── Sub-topic specific tab arrays ────────────────────────────────────

export const TECHNICAL_TABS = [
  { value: 'summary',          label: 'סיכום',           emoji: '📝' },
  { value: 'chapters',         label: 'פרקים',            emoji: '📚' },
  { value: 'definitions',      label: 'מושגים',           emoji: '📖' },
  { value: 'indicators',       label: 'אינדיקטורים',      emoji: '📈' },
  { value: 'setups',           label: 'אסטרטגיות',        emoji: '⚙️' },
  { value: 'checklists',       label: "צ'קליסטים",        emoji: '📋' },
  { value: 'mistakes',         label: 'טעויות ואזהרות',   emoji: '⚠️' },
  { value: 'trading-brain',    label: 'תובנות מפתח',      emoji: '💡' },
  { value: 'useful-knowledge', label: 'ידע שימושי',       emoji: '🧠' },
  { value: 'app-builder',      label: 'רעיונות אפליקציה', emoji: '🚀' },
];

export const FUNDAMENTAL_TABS = [
  { value: 'summary',               label: 'סיכום',            emoji: '📝' },
  { value: 'chapters',              label: 'פרקים',             emoji: '📚' },
  { value: 'definitions',           label: 'מושגים',            emoji: '📖' },
  { value: 'financial-metrics',     label: 'מדדים פיננסיים',   emoji: '📈' },
  { value: 'valuation',             label: 'הערכת שווי',        emoji: '💰' },
  { value: 'analysis-frameworks',   label: 'מסגרות ניתוח',      emoji: '⚙️' },
  { value: 'investment-checklist',  label: "צ'קליסט השקעה",     emoji: '📋' },
  { value: 'mistakes',              label: 'סיכונים',           emoji: '⚠️' },
  { value: 'trading-brain',         label: 'תובנות מפתח',       emoji: '💡' },
  { value: 'useful-knowledge',      label: 'ידע שימושי',        emoji: '🧠' },
  { value: 'app-builder',           label: 'רעיונות אפליקציה',  emoji: '🚀' },
];

export const MACRO_TABS = [
  { value: 'summary',          label: 'סיכום',           emoji: '📝' },
  { value: 'chapters',         label: 'פרקים',            emoji: '📚' },
  { value: 'definitions',      label: 'מושגים',           emoji: '📖' },
  { value: 'cause-effect',     label: 'סיבה ותוצאה',     emoji: '🔗' },
  { value: 'market-impact',    label: 'השפעה על השוק',    emoji: '🌎' },
  { value: 'checklists',       label: "צ'קליסט מאקרו",    emoji: '📋' },
  { value: 'mistakes',         label: 'סיכונים',          emoji: '⚠️' },
  { value: 'trading-brain',    label: 'תובנות מפתח',      emoji: '💡' },
  { value: 'useful-knowledge', label: 'ידע שימושי',       emoji: '🧠' },
  { value: 'app-builder',      label: 'רעיונות אפליקציה', emoji: '🚀' },
];

export const MORNING_BRIEF_TABS = [
  { value: 'market-news',     label: 'כותרות',        emoji: '📰' },
  { value: 'indices',         label: 'שווקים',         emoji: '📈' },
  { value: 'brief-macro',     label: 'אירועי מאקרו',  emoji: '🌍' },
  { value: 'brief-sentiment', label: 'סנטימנט שוק',   emoji: '📊' },
  { value: 'brief-calendar',  label: 'לוח כלכלי',     emoji: '📅' },
  { value: 'stocks-mentioned',label: 'רשימת מעקב',    emoji: '🎯' },
  { value: 'chapters',        label: 'פרקים',          emoji: '📚' },
  { value: 'ai-analysis',     label: 'ניתוח AI',       emoji: '🧠' },
];

export const EVENING_BRIEF_TABS = [
  { value: 'summary',         label: 'סיכום יומי',       emoji: '📰' },
  { value: 'indices',         label: 'סקירת שוק',         emoji: '📈' },
  { value: 'market-news',     label: 'עדכוני מאקרו',     emoji: '🌍' },
  { value: 'brief-sectors',   label: 'ביצועי סקטורים',    emoji: '📊' },
  { value: 'brief-changes',   label: 'מה השתנה היום',     emoji: '🔄' },
  { value: 'brief-tomorrow',  label: 'אירועי מחר',        emoji: '📅' },
  { value: 'chapters',        label: 'פרקים',              emoji: '📚' },
  { value: 'ai-analysis',     label: 'מסקנות AI',         emoji: '🧠' },
];

export const WEEKLY_BRIEF_TABS = [
  { value: 'brief-highlights', label: 'כותרות השבוע',   emoji: '📰' },
  { value: 'indices',          label: 'ביצועי שוק',      emoji: '📈' },
  { value: 'market-news',      label: 'סקירת מאקרו',    emoji: '🌍' },
  { value: 'brief-winners',    label: 'מנצחים',          emoji: '🏆' },
  { value: 'brief-losers',     label: 'מפסידים',         emoji: '📉' },
  { value: 'brief-outlook',    label: 'תחזית שבוע הבא', emoji: '🔮' },
  { value: 'chapters',         label: 'פרקים',           emoji: '📚' },
  { value: 'ai-analysis',      label: 'ניתוח AI',        emoji: '🧠' },
];

export const EARNINGS_BRIEF_TABS = [
  { value: 'summary',               label: 'סיכום דוחות',    emoji: '📝' },
  { value: 'financial-metrics',     label: 'מדדים פיננסיים', emoji: '📈' },
  { value: 'earnings-guidance',     label: 'תחזיות',          emoji: '🎯' },
  { value: 'earnings-commentary',   label: 'פרשנות הנהלה',   emoji: '💬' },
  { value: 'mistakes',              label: 'סיכונים',         emoji: '⚠️' },
  { value: 'trading-brain',         label: 'תובנות מפתח',    emoji: '💡' },
  { value: 'useful-knowledge',      label: 'ידע שימושי',     emoji: '🧠' },
  { value: 'chapters',              label: 'פרקים',           emoji: '📚' },
];

export const POLITICAL_TABS = [
  { value: 'summary',                  label: 'סיכום',            emoji: '📝' },
  { value: 'political-players',        label: 'שחקנים מרכזיים',  emoji: '👥' },
  { value: 'political-for',            label: 'בעד',              emoji: '⚔️' },
  { value: 'political-against',        label: 'נגד',              emoji: '🛡️' },
  { value: 'political-slogans',        label: 'סיסמאות וציטוטים', emoji: '📢' },
  { value: 'political-implications',   label: 'השלכות עתידיות',   emoji: '🔮' },
  { value: 'political-liberal',        label: 'יהדות ליברלית',    emoji: '🕊️' },
  { value: 'useful-knowledge',         label: 'ידע שימושי',       emoji: '🧠' },
  { value: 'app-builder',              label: 'רעיונות אפליקציה', emoji: '🚀' },
];

/**
 * Returns the ordered tab array for a specific subCategory slug.
 * Returns null when the slug is unrecognized (caller falls back to detectVideoType).
 */
export function getTabsBySubTopic(subCategory) {
  const slug = normalizeSubCategory(subCategory);
  switch (slug) {
    case 'technical-analysis':   return [...TECHNICAL_TABS];
    case 'fundamental-analysis': return [...FUNDAMENTAL_TABS];
    case 'macro':                return [...MACRO_TABS];
    case 'morning-brief':        return [...MORNING_BRIEF_TABS];
    case 'evening-brief':        return [...EVENING_BRIEF_TABS];
    case 'weekly-brief':         return [...WEEKLY_BRIEF_TABS];
    case 'earnings-brief':       return [...EARNINGS_BRIEF_TABS];
    case 'political':            return [...POLITICAL_TABS];
    default:                     return null;
  }
}

/**
 * Returns the ordered tab array for a given video.
 * Priority: subCategory → detectVideoType → DEFAULT fallback.
 */
export function getTabsForVideo(video, {
  hasPolitical   = false,
  hasMarketBrief = false,
  hasAppBuilder  = false,
} = {}) {
  // 1. subCategory takes priority
  const subCatTabs = getTabsBySubTopic(video?.subCategory);
  if (subCatTabs) return subCatTabs;

  // 2. keyword / contentType detection
  const type = detectVideoType(video);

  if (type === 'learning') {
    const tabs = [...LEARNING_TABS];
    if (hasAppBuilder) tabs.push({ value: 'app-builder', label: 'בונה אפליקציות', emoji: '🏗️' });
    return tabs;
  }

  if (type === 'morningBrief') {
    const tabs = [...MORNING_BRIEF_TABS];
    if (hasMarketBrief) tabs.splice(1, 0, { value: 'market-brief', label: 'מבזק שוק', emoji: '📈' });
    return tabs;
  }

  if (type === 'eveningBrief') {
    const tabs = [...EVENING_BRIEF_TABS];
    if (hasMarketBrief) tabs.splice(1, 0, { value: 'market-brief', label: 'מבזק שוק', emoji: '📈' });
    return tabs;
  }

  // 3. Default + conditional
  const tabs = [...DEFAULT_TABS];
  if (hasPolitical)   tabs.push({ value: 'political',    label: 'פוליטי',         emoji: '🏛️' });
  if (hasMarketBrief) tabs.push({ value: 'market-brief', label: 'מבזק שוק',       emoji: '📈' });
  if (hasAppBuilder)  tabs.push({ value: 'app-builder',  label: 'בונה אפליקציות', emoji: '🏗️' });
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

// Convert an object's key-value pairs to readable "key: value" strings.
// Handles nested objects one level deep. Used for GEM fields like marketOverview.
function pickObjectAsStrings(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const entries = Object.entries(val).map(([k, v]) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'object' && !Array.isArray(v)) {
        const parts = Object.entries(v)
          .filter(([, vv]) => vv !== null && vv !== undefined)
          .map(([k2, v2]) => `${k2}: ${v2}`)
          .join(' | ');
        return `${k}: ${parts}`.trim();
      }
      return `${k}: ${v}`;
    }).filter(Boolean);
    if (entries.length > 0) return entries;
  }
  return [];
}

// ── Rich item formatters for Morning Brief tabs ───────────────────────

/**
 * Formats a watchlist/stocks item as multi-line rich text.
 * Handles both plain strings ("JPM") and rich objects ({ symbol, reason, importance, catalyst }).
 * Returns empty string if item is null/empty.
 */
function formatWatchlistItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);

  const symbol = (item.symbol || item.ticker || item.name || item.stock || '').trim();
  const reason = (item.reason || item.why || item.note || '').trim();
  const importance = (item.importance || item.priority || item.weight || '').trim();
  const catalyst = (item.catalyst || item.trigger || item.event || '').trim();
  const level = (item.level || item.price || item.target || '').trim();

  // No structured fields — fall back to first string value in object
  if (!symbol && !reason) {
    return Object.values(item).find(v => typeof v === 'string' && v.trim()) || '';
  }

  const parts = [];
  if (symbol) parts.push(symbol);
  if (reason && reason !== catalyst) parts.push(`סיבה: ${reason}`);
  if (importance) parts.push(`חשיבות: ${importance}`);
  // Show catalyst only if different from reason
  if (catalyst && catalyst !== reason) parts.push(`קטליסט: ${catalyst}`);
  if (level) parts.push(`רמה: ${level}`);
  return parts.join('\n');
}

/**
 * Formats a macro event item as multi-line rich text.
 * Handles both plain strings ("US Jobs Report") and rich objects ({ event, importance, impact, sectors }).
 */
function formatMacroItem(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);

  const event = (item.event || item.title || item.name || item.subject || '').trim();
  const importance = (item.importance || item.priority || item.significance || '').trim();
  const impact = (item.impact || item.marketImpact || item.effect || item.expectedImpact || '').trim();
  const sectors = item.sectors || item.assets || item.affectedSectors;
  const sectorsStr = Array.isArray(sectors)
    ? sectors.join(', ')
    : typeof sectors === 'string' ? sectors : '';
  const date = (item.date || item.time || item.when || '').trim();

  if (!event && !impact) {
    return Object.values(item).find(v => typeof v === 'string' && v.trim()) || '';
  }

  const parts = [];
  if (event) parts.push(event);
  if (date) parts.push(`📅 ${date}`);
  if (importance) parts.push(`חשיבות: ${importance}`);
  if (impact) parts.push(`השפעה: ${impact}`);
  if (sectorsStr) parts.push(`סקטורים: ${sectorsStr}`);
  return parts.join('\n');
}

/**
 * Returns an array of items for the given tab value.
 * Handles both flat (new) and nested legacy analysis structures.
 *
 * @param {object} video           — the video prop (post-analysis)
 * @param {string} tabValue        — tab value string
 * @param {object|null} marketBriefData — from localStorage gem JSON paste
 */
/** Filter allPoints by category — used by multiple universal tabs. */
function filterAllPoints(video, a, categories) {
  const catSet = new Set(categories.map(c => c.toLowerCase()));
  return [
    ...pickArray(video, 'allPoints'),
    ...pickArray(a, 'allPoints'),
  ].filter(p => p && catSet.has((p.category || '').toLowerCase()))
   .map(p => String(p.point || p.text || '').trim())
   .filter(Boolean);
}

export function extractVideoTabItems(video, tabValue, marketBriefData = null) {
  if (!video) return [];

  const al = video.analysis?.learning || {};
  const a  = video.analysis || {};

  switch (tabValue) {
    case 'chapters':
      return [
        ...pickArray(video, 'chapters', 'aiChapters'),
        ...pickArray(a, 'chapters', 'aiChapters'),
      ];

    case 'useful-knowledge':
      return [
        // GEMS JSON: learning sub-fields now normalized into analysis root
        ...pickArray(a, 'frameworks', 'usefulKnowledge', 'keyTakeaways'),
        // Legacy / flat formats
        ...pickArray(video, 'actionItems', 'usefulKnowledge', 'keyTakeaways'),
        ...pickArray(al, 'keyTakeaways', 'actionItems'),
        // allPoints filtered for knowledge categories
        ...filterAllPoints(video, a, ['rule', 'strategy', 'checklist']),
      ];

    case 'definitions':
      return [
        ...pickArray(video, 'definitions', 'concepts'),
        ...pickArray(al, 'definitions'),
        ...pickArray(a, 'definitions', 'concepts'),
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
        ...pickArray(a, 'setups', 'tradingSetups'),
      ];

    case 'patterns':
      return [
        ...pickArray(video, 'patterns', 'tradingPatterns'),
        ...pickArray(al, 'patterns'),
        ...pickArray(a, 'patterns', 'tradingPatterns'),
      ];

    case 'checklists':
      return [
        ...pickArray(video, 'checklists'),
        ...pickArray(al, 'checklists'),
        ...pickArray(a, 'checklists', 'rules'),
      ];

    case 'mistakes':
      return [
        ...pickArray(video, 'mistakesToAvoid', 'warnings', 'riskRules'),
        ...pickArray(al, 'mistakes', 'mistakesToAvoid'),
        ...pickArray(a, 'warnings', 'mistakesToAvoid'),
      ];

    case 'insights':
      return [
        // GEMS JSON: learning.keyInsights (rich objects now in analysis.keyInsights)
        ...pickArray(a, 'keyInsights'),
        // Legacy and other formats
        ...pickArray(video, 'keyInsights', 'brainHighlights', 'tradingPrinciples', 'mentalModels', 'keyPoints'),
        ...pickNested(video, 'analysis.brainHighlights'),
        ...pickArray(a, 'brainHighlights', 'tradingPrinciples', 'mentalModels'),
        ...pickArray(video, 'top5Insights'),
        // allPoints filtered for insight category
        ...filterAllPoints(video, a, ['insight']),
        // brief-conclusions fields (marketBriefData or video fallback)
        ...(marketBriefData
          ? pickArray(marketBriefData, 'reusableKnowledge', 'top5Insights', 'keyTakeaways', 'learningInsights', 'actionChecklist', 'conclusions')
          : pickArray(video, 'briefConclusions', 'sessionConclusions')
        ),
      ];

    case 'trading-brain':
      return [
        ...pickStringAsArray(video, 'mainLesson'),
        ...pickArray(video, 'brainHighlights', 'tradingPrinciples', 'mentalModels', 'keyInsights'),
        ...pickNested(video, 'analysis.brainHighlights'),
        ...pickArray(al, 'brainHighlights', 'tradingPrinciples'),
        ...pickArray(a, 'brainHighlights', 'tradingPrinciples', 'mentalModels'),
      ];

    case 'market-news':
      if (marketBriefData) {
        return [
          ...pickArray(marketBriefData, 'marketNews', 'headlines', 'news', 'topStories'),
          ...pickObjectAsStrings(marketBriefData, 'marketOverview'),
          ...pickArray(marketBriefData, 'catalysts', 'snapshot'),
        ];
      }
      return [
        ...pickArray(video, 'marketConditions'),
        ...pickArray(video, 'concepts', 'definitions'),
      ];

    case 'indices':
      if (marketBriefData) {
        return [
          ...pickArray(marketBriefData, 'indices', 'indexPerformance', 'indexData'),
          ...pickArray(marketBriefData, 'keyLevels'),
          ...pickArray(marketBriefData, 'sectorRotation'),
        ];
      }
      return [
        ...pickArray(video, 'marketConditions', 'keyLevels'),
        ...pickArray(video, 'indicators'),
      ];

    case 'stocks-mentioned': {
      const rawWatchlist = marketBriefData
        ? [
            ...pickArray(marketBriefData, 'stocksMentioned', 'stocks', 'watchlist', 'tickers'),
            ...pickArray(marketBriefData, 'watchlistLevels'),
          ]
        : pickArray(video, 'stocksMentioned');
      return rawWatchlist.map(formatWatchlistItem).filter(Boolean);
    }

    case 'brief-risks':
      return marketBriefData
        ? pickArray(marketBriefData, 'risks', 'warnings', 'riskFactors')
        : pickArray(video, 'warnings', 'riskRules', 'risks');

    case 'brief-opportunities':
      return marketBriefData
        ? pickArray(marketBriefData, 'opportunities', 'tradingOpportunities', 'trades')
        : pickArray(video, 'actionItems', 'tradingSetups', 'opportunities');

    case 'brief-conclusions':
      if (marketBriefData) {
        return [
          ...pickArray(marketBriefData, 'reusableKnowledge', 'actionChecklist', 'conclusions'),
          ...pickArray(marketBriefData, 'top5Insights', 'learningInsights', 'keyTakeaways'),
        ];
      }
      return [
        ...pickStringAsArray(video, 'mainLesson'),
        ...pickArray(video, 'keyInsights'),
      ];

    // ── Fundamental analysis ──────────────────────────────────────────
    case 'financial-metrics':
      return [
        ...pickArray(video, 'financialMetrics'),
        ...pickArray(a, 'financialMetrics'),
      ];

    case 'valuation':
      return [
        ...pickArray(video, 'valuation'),
        ...pickArray(a, 'valuation'),
      ];

    case 'analysis-frameworks':
      return [
        ...pickArray(video, 'frameworks', 'analysisFrameworks'),
        ...pickArray(a, 'frameworks', 'analysisFrameworks'),
      ];

    case 'investment-checklist':
      return [
        ...pickArray(video, 'investmentChecklist'),
        ...pickArray(a, 'investmentChecklist'),
        ...pickArray(video, 'checklists'), // graceful fallback
      ];

    // ── Macro ─────────────────────────────────────────────────────────
    case 'cause-effect':
      return [
        ...pickArray(video, 'causeEffect'),
        ...pickArray(a, 'causeEffect'),
      ];

    case 'market-impact':
      return [
        ...pickArray(video, 'marketImpact'),
        ...pickArray(a, 'marketImpact'),
      ];

    // ── Morning/evening brief ─────────────────────────────────────────
    case 'brief-macro': {
      const rawMacro = marketBriefData
        ? [
            ...pickArray(marketBriefData, 'macro', 'macroEvents', 'macroHighlights', 'macroContext', 'economicContext', 'economicEvents'),
            ...pickArray(marketBriefData, 'macroFactors'),
          ]
        : [
            ...pickArray(video, 'macroEvents', 'macroHighlights', 'marketConditions'),
            ...pickArray(video, 'patterns'),
          ];
      return rawMacro.map(formatMacroItem).filter(Boolean);
    }

    case 'brief-sentiment':
      if (marketBriefData) {
        return [
          ...pickArray(marketBriefData, 'sentiment', 'marketSentiment', 'sentimentAnalysis', 'marketMood', 'fearGreed'),
          ...pickArray(marketBriefData, 'sectorRotation'),
        ];
      }
      return [
        ...pickArray(video, 'marketSentiment', 'sentiment'),
        ...pickArray(video, 'tradingPrinciples', 'mentalModels'),
      ];

    case 'brief-calendar':
      if (marketBriefData) {
        return pickArray(marketBriefData, 'calendar', 'economicCalendar', 'events', 'upcomingEvents', 'schedule');
      }
      return [
        ...pickArray(video, 'economicCalendar', 'calendar', 'upcomingEvents'),
        ...pickArray(video, 'checklists'),
      ];

    case 'brief-sectors':
      return pickArray(video, 'sectorPerformance', 'sectors');

    case 'brief-changes':
      return pickArray(video, 'marketChanges', 'changes');

    case 'brief-tomorrow':
      return pickArray(video, 'tomorrowEvents', 'nextEvents');

    // ── Weekly brief ──────────────────────────────────────────────────
    case 'brief-highlights':
      return [
        ...pickArray(video, 'weeklyHighlights', 'highlights'),
        ...pickArray(video, 'marketConditions'),
      ];

    case 'brief-winners':
      return pickArray(video, 'winners', 'topGainers');

    case 'brief-losers':
      return pickArray(video, 'losers', 'topLosers');

    case 'brief-outlook':
      return [
        ...pickStringAsArray(video, 'weeklyOutlook', 'outlook'),
        ...pickArray(video, 'nextWeekOutlook'),
      ];

    // ── Earnings brief ────────────────────────────────────────────────
    case 'earnings-guidance':
      return pickArray(video, 'guidance', 'earningsGuidance');

    case 'earnings-commentary':
      return pickArray(video, 'managementCommentary', 'commentary');

    // ── Political ─────────────────────────────────────────────────────
    case 'political-players':
      return [
        ...pickArray(video, 'keyPlayers', 'politicalPlayers'),
        ...pickArray(a, 'keyPlayers'),
      ];

    case 'political-for':
      return [
        ...pickArray(video, 'argumentsFor', 'proArguments'),
        ...pickArray(a, 'argumentsFor'),
      ];

    case 'political-against':
      return [
        ...pickArray(video, 'argumentsAgainst', 'conArguments'),
        ...pickArray(a, 'argumentsAgainst'),
      ];

    case 'political-slogans':
      return [
        ...pickArray(video, 'slogans', 'quotes'),
        ...pickArray(a, 'slogans', 'quotes'),
      ];

    case 'political-implications':
      return [
        ...pickArray(video, 'futureImplications', 'implications'),
        ...pickArray(a, 'implications'),
      ];

    case 'political-liberal':
      return [
        ...pickArray(video, 'liberalJudaism', 'liberalPerspective'),
        ...pickArray(a, 'liberalJudaism'),
      ];

    case 'app-builder': {
      const ab = a.appBuilding || {};
      return [
        ...pickArray(ab, 'kpiList'),
        ...pickArray(ab, 'dashboards'),
        ...pickArray(ab, 'prompts'),
        ...pickArray(ab, 'screeningCriteria'),
        ...pickArray(ab, 'dataFields'),
        ...pickArray(ab, 'suggestedFeatures'),
        ...filterAllPoints(video, a, ['feature', 'prompt', 'kpi']),
      ];
    }

    case 'topics-subtopics':
      return [
        ...pickArray(a, 'obsidianTopics', 'metadataTopics', 'tags'),
        ...pickArray(video, 'obsidianTopics', 'tags', 'topicIds'),
      ];

    default:
      return [];
  }
}

/**
 * Returns which GEM JSON fields mapped to which Morning Brief tabs.
 * Used to show an AI Mapping verification section in the ai-analysis tab.
 * Returns [] when marketBriefData is empty/null.
 */
export function getMorningBriefFieldMapping(marketBriefData) {
  if (!marketBriefData || typeof marketBriefData !== 'object') return [];

  const hasData = (key) => {
    const v = marketBriefData[key];
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return Boolean(v);
  };

  const sections = [
    { tab: 'כותרות', emoji: '📰', keys: ['marketNews', 'headlines', 'news', 'topStories', 'catalysts', 'marketOverview'] },
    { tab: 'שווקים',  emoji: '📈', keys: ['indices', 'indexPerformance', 'indexData', 'keyLevels', 'sectorRotation'] },
    { tab: 'אירועי מאקרו', emoji: '🌍', keys: ['macro', 'macroEvents', 'macroHighlights', 'macroFactors', 'economicEvents', 'economicContext'] },
    { tab: 'סנטימנט שוק', emoji: '📊', keys: ['sentiment', 'marketSentiment', 'fearGreed', 'marketMood', 'sentimentAnalysis'] },
    { tab: 'לוח כלכלי', emoji: '📅', keys: ['calendar', 'economicCalendar', 'events', 'upcomingEvents', 'schedule'] },
    { tab: 'רשימת מעקב', emoji: '🎯', keys: ['stocksMentioned', 'stocks', 'watchlist', 'tickers', 'watchlistLevels'] },
    { tab: 'ניתוח AI', emoji: '🧠', keys: ['top5Insights', 'reusableKnowledge', 'keyTakeaways', 'actionChecklist', 'conclusions', 'learningInsights'] },
  ];

  return sections
    .map(({ tab, emoji, keys }) => {
      const found = keys.filter(hasData);
      return { tab, emoji, fields: found };
    })
    .filter(({ fields }) => fields.length > 0);
}

/**
 * Returns the badge count for a given tab (number of extracted items, capped at 99).
 */
export function getTabBadge(video, tabValue, marketBriefData = null) {
  const BADGED_TABS = new Set([
    // universal tabs
    'chapters', 'insights', 'useful-knowledge', 'app-builder', 'topics-subtopics',
    // existing learning tabs
    'definitions', 'indicators', 'setups',
    'patterns', 'checklists', 'mistakes', 'trading-brain',
    // existing brief tabs
    'stocks-mentioned', 'brief-risks', 'brief-opportunities', 'brief-conclusions',
    'market-news', 'indices',
    // fundamental-analysis
    'financial-metrics', 'valuation', 'analysis-frameworks', 'investment-checklist',
    // macro
    'cause-effect', 'market-impact',
    // morning/evening brief
    'brief-macro', 'brief-sentiment', 'brief-calendar',
    'brief-sectors', 'brief-changes', 'brief-tomorrow',
    // weekly brief
    'brief-highlights', 'brief-winners', 'brief-losers', 'brief-outlook',
    // earnings brief
    'earnings-guidance', 'earnings-commentary',
    // political
    'political-players', 'political-for', 'political-against',
    'political-slogans', 'political-implications', 'political-liberal',
  ]);
  if (!BADGED_TABS.has(tabValue)) return 0;
  return Math.min(extractVideoTabItems(video, tabValue, marketBriefData).length, 99);
}
