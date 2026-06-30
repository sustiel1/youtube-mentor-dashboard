/**
 * Regression fixture: Morning Brief / Market Brief routing rules.
 * Run with: node scripts/test-morning-brief-routing.mjs
 *
 * Validates:
 *   1. "מבזק לייב פתיחה לתאריך" titles are classified as morningBrief
 *   2. Specialized merge keeps all major marketBrief sections
 *   3. Non-market videos are not affected
 */

// ── Minimal copy of detection logic from videoTabsConfig.js ──────────────

const MORNING_BRIEF_KEYWORDS = [
  'מבזק בוקר', 'morning brief', 'premarket', 'pre-market',
  'סקירת בוקר', 'פתיחת שוק',
  'מבזק לייב פתיחה',
];

const EVENING_BRIEF_KEYWORDS = [
  'מבזק ערב', 'סיכום יום', 'market close', 'סקירת ערב',
  'evening brief', 'סגירת שוק',
];

function matchesAny(str, keywords) {
  const lower = String(str || '').toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

function detectVideoType(video) {
  if (!video) return 'general';
  const ct       = String(video.contentType || '').toLowerCase();
  const category = String(video.category || '').toLowerCase();
  const subCat   = String(video.subCategory || '').toLowerCase();
  const title    = String(video.title || '').toLowerCase();
  const combined = `${title} ${String(video.channelName || '')}`.toLowerCase();

  if (ct === 'political' || category.includes('פוליטיק')) return 'political';
  if (matchesAny(title, MORNING_BRIEF_KEYWORDS) || ct === 'marketbrief') return 'morningBrief';
  if (matchesAny(title, EVENING_BRIEF_KEYWORDS)) return 'eveningBrief';

  const isMarketCat = category.includes('שוק') || category === 'markets';
  const isTechnical = ct === 'technical' || ct === 'market' || subCat.includes('טכני');
  if (isMarketCat || isTechnical) return 'learning';

  return 'general';
}

const SUB_CATEGORY_SLUG_MAP = {
  'מבזק בוקר':   'morning-brief',
  'מבזק ערב':    'evening-brief',
  'מבזק שבועי':  'weekly-brief',
  'ניתוח טכני':  'technical-analysis',
  'פונדמנטלי':   'fundamental-analysis',
  'macro':       'macro',
  'morning-brief': 'morning-brief',
  'evening-brief': 'evening-brief',
};

function normalizeSubCategory(subCategory) {
  const raw = String(subCategory || '').trim();
  return SUB_CATEGORY_SLUG_MAP[raw] || SUB_CATEGORY_SLUG_MAP[raw.toLowerCase()] || null;
}

function resolveEffectiveBriefSlug(normalizedSubCategory, marketBriefData, videoType) {
  if (normalizedSubCategory) return normalizedSubCategory;
  if (marketBriefData?.contentType === 'marketBrief') return 'morning-brief';
  if (videoType === 'morningBrief') return 'morning-brief';
  if (videoType === 'eveningBrief') return 'evening-brief';
  return null;
}

// ── Minimal merge logic from morningBriefDisplay.js ──────────────────────

const SPECIALIZED_MERGE_ARRAY_KEYS = [
  'indices', 'marketNews', 'macroFactors', 'stocksMentioned',
  'watchlistLevels', 'keyLevels', 'catalysts', 'sectorRotation',
  'tradingOpportunities', 'economicCalendar', 'earnings', 'risks', 'sentiment',
];

function mergeMorningBriefSpecializedSource(gem) {
  if (!gem) return null;
  const raw  = gem.rawData && typeof gem.rawData === 'object' ? gem.rawData : {};
  const spec = gem.universalTabs?.specialized || {};
  const merged = {};
  for (const key of SPECIALIZED_MERGE_ARRAY_KEYS) {
    const combined = [
      ...(Array.isArray(raw[key])  ? raw[key]  : []),
      ...(Array.isArray(spec[key]) ? spec[key] : []),
    ];
    if (combined.length > 0) merged[key] = combined;
  }
  return merged;
}

// ── Test helpers ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

// ── Test suite ────────────────────────────────────────────────────────────

console.log('\n=== Morning Brief Routing Regression Fixture ===\n');

// ── 1. Title detection ────────────────────────────────────────────────────
console.log('1. Title-based detection (detectVideoType)');

const liveBriefVideo = { title: 'מבזק לייב פתיחה לתאריך 29.6.26', category: 'שוק ההון' };
assert(
  '"מבזק לייב פתיחה לתאריך" → morningBrief',
  detectVideoType(liveBriefVideo) === 'morningBrief'
);

assert(
  '"מבזק בוקר" → morningBrief',
  detectVideoType({ title: 'מבזק בוקר יום שלישי' }) === 'morningBrief'
);

assert(
  'political video not affected',
  detectVideoType({ title: 'ניתוח פוליטי', contentType: 'political' }) === 'political'
);

assert(
  'generic learning video not affected',
  detectVideoType({ title: 'ניתוח טכני על AAPL', category: 'שוק ההון', subCategory: 'ניתוח טכני' }) === 'learning'
);

assert(
  'empty video → general',
  detectVideoType({}) === 'general'
);

// ── 2. effectiveBriefSlug resolution ─────────────────────────────────────
console.log('\n2. effectiveBriefSlug resolution');

assert(
  'title-only (no GEM, no subCategory) → morning-brief via videoType',
  resolveEffectiveBriefSlug(null, null, 'morningBrief') === 'morning-brief'
);

assert(
  'GEM contentType=marketBrief → morning-brief',
  resolveEffectiveBriefSlug(null, { contentType: 'marketBrief' }, 'general') === 'morning-brief'
);

assert(
  'subCategory=מבזק בוקר → morning-brief',
  resolveEffectiveBriefSlug(normalizeSubCategory('מבזק בוקר'), null, 'general') === 'morning-brief'
);

assert(
  'generic video with no signals → null',
  resolveEffectiveBriefSlug(null, null, 'general') === null
);

// ── 3. Specialized merge keeps all major marketBrief sections ─────────────
console.log('\n3. Specialized / rawData merge');

const REFERENCE_GEM = {
  contentType: 'marketBrief',
  rawData: {
    marketOverview: { brief: 'test', date: '2026-06-29' },
    indices: [{ symbol: 'SPX', name: 'S&P 500', changePercent: 1.0, status: 'עליה' }],
    marketNews: [{ title: 'קומקאסט מתפצלת', description: 'test' }],
    macroFactors: [{ name: 'VIX', value: '18.0', trend: 'נחלש', notes: 'מדד התנודתיות נרגע' }],
    stocksMentioned: [{ symbol: 'PLTR', name: 'Palantir', context: 'שותפות עם NVDA', action: 'מעקב הדוק', technicalState: 'עולה ב-3%' }],
    watchlistLevels: [{ symbol: 'PLTR', level: '128.8', type: 'Resistance', notes: 'כל עוד מתחת לרמה' }],
    keyLevels: [{ asset: 'S&P 500', level: '736-737', type: 'Intraday' }],
    catalysts: [{ date: '2026-06-29', event: 'כנס נגידים', impact: 'גבוה' }],
    sectorRotation: [{ sector: 'Technology', trend: 'חיובי', notes: 'מובל על ידי שבבים' }],
    tradingOpportunities: [{ symbol: 'NOW', setup: 'פריצת התנגדות', stopLoss: '98.0', target: 'N/A' }],
    economicCalendar: [{ event: 'נאום נגיד הפד', importance: 'קריטי' }],
    earnings: [],
    risks: [{ riskFactor: 'שבירת רצפת 60K בביטקוין' }],
    sentiment: [{ scope: 'Market', status: 'Bullish', details: 'עליות חדות' }],
  },
};

const merged = mergeMorningBriefSpecializedSource(REFERENCE_GEM);

assert('indices preserved',              merged.indices?.length > 0);
assert('marketNews preserved',           merged.marketNews?.length > 0);
assert('macroFactors preserved',         merged.macroFactors?.length > 0);
assert('stocksMentioned preserved',      merged.stocksMentioned?.length > 0);
assert('watchlistLevels preserved',      merged.watchlistLevels?.length > 0);
assert('keyLevels preserved',            merged.keyLevels?.length > 0);
assert('catalysts preserved',            merged.catalysts?.length > 0);
assert('sectorRotation preserved',       merged.sectorRotation?.length > 0);
assert('tradingOpportunities preserved', merged.tradingOpportunities?.length > 0);
assert('economicCalendar preserved',     merged.economicCalendar?.length > 0);
assert('risks preserved',                merged.risks?.length > 0);
assert('sentiment preserved',            merged.sentiment?.length > 0);

// ── 4. macroFactors.notes field ───────────────────────────────────────────
console.log('\n4. macroFactors.notes field pickup');

function normalizeMacroIndicatorRowMinimal(item) {
  if (!item || typeof item !== 'object') return null;
  const indicator = item.name || item.symbol || item.indicator || '';
  const value     = item.value || item.level || '';
  const description = item.description || item.comment || item.note || item.notes || item.context || '';
  return { indicator, value, description };
}

const macroRow = normalizeMacroIndicatorRowMinimal({ name: 'VIX', value: '18.0', trend: 'נחלש', notes: 'מדד התנודתיות נרגע' });
assert('macroFactors.notes picked as description', macroRow?.description === 'מדד התנודתיות נרגע');
assert('macroFactors.name picked as indicator',    macroRow?.indicator === 'VIX');
assert('macroFactors.value picked',                macroRow?.value === '18.0');

// ── 5. Non-market videos unaffected ──────────────────────────────────────
console.log('\n5. Non-market video isolation');

const nutritionVideo = { title: 'ארוחת בוקר קטוגנית - מה לאכול', category: 'בריאות ותזונה' };
assert(
  'nutrition video → general (not morningBrief)',
  detectVideoType(nutritionVideo) === 'general'
);
assert(
  'nutrition effectiveBriefSlug → null',
  resolveEffectiveBriefSlug(null, null, detectVideoType(nutritionVideo)) === null
);

const techAnalysis = { title: 'ניתוח RSI ו-MACD', category: 'שוק ההון', subCategory: 'ניתוח טכני' };
assert(
  'technical analysis → learning (not morningBrief)',
  detectVideoType(techAnalysis) === 'learning'
);

// ── Result ────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
