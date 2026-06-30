/**
 * Regression fixture: Morning Brief / Market Brief routing + GEM recommendation rules.
 * Run with: node scripts/test-morning-brief-routing.mjs
 *
 * Validates:
 *   1. "מבזק לייב פתיחה לתאריך" titles are classified as morningBrief (routing)
 *   2. Specialized merge keeps all major marketBrief sections
 *   3. Non-market videos are not affected
 *   4. preGemClassifier: title overrides always win (GEM recommendation)
 *   5. preGemClassifier: validation fallback prevents wrong fundamental recommendation
 *   6. Transcript-based classification: Macro / DailyTrading / Fundamental signals
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

// ── Minimal copy of gemContentRouter.js (routing layer) ──────────────────

const ROUTER_CONTENT_TYPES = {
  MARKET_BRIEF:  'marketBrief',
  MACRO:         'macro',
  DAILY_TRADING: 'dailyTrading',
  FUNDAMENTAL:   'fundamental',
  GENERAL:       'general',
  POLITICAL:     'political',
};

const ROUTER_CONTENT_TYPE_TO_GEM = {
  marketBrief:  'news',
  macro:        'macro',
  dailyTrading: 'technical',
  fundamental:  'fundamental',
  general:      'general',
  political:    'political',
};

const ROUTER_TITLE_OVERRIDES = [
  { pattern: 'מבזק לייב פתיחה', contentType: 'marketBrief', recommendedGem: 'news', source: 'titleOverride' },
  { pattern: 'מבזק בוקר',       contentType: 'marketBrief', recommendedGem: 'news', source: 'titleOverride' },
];

const ROUTER_CONTENT_SIGNALS = {
  marketBrief: ['market recap','weekly recap','s&p 500','nasdaq','sectors','stocks mentioned','morning brief','today in markets','premarket','market open','מבזק','סיכום שוק','מדדים','סקטורים','מניות'],
  macro:       ['fed','cpi','inflation','interest rate','yield','bond','dollar','recession','central bank','monetary policy','federal reserve','fomc','gdp','ריבית','אינפלציה','מיתון','בנק מרכזי','פד'],
  dailyTrading:['breakout','support','resistance','entry','stop loss','target','intraday','scalp','day trade','setup','price action','trade setup','פריצה','תמיכה','התנגדות','כניסה','יעד','סטופ'],
  fundamental: ['earnings','revenue','valuation','eps','pe ratio','balance sheet','profit margin','cash flow','net income','guidance','acquisition','dividend','analyst','הכנסות','רווח','שווי','דוחות'],
};

function routerCountMatches(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
}

function routerClassifyBySignals(text, minMatches) {
  let best = { contentType: null, score: 0 };
  for (const [ct, kws] of Object.entries(ROUTER_CONTENT_SIGNALS)) {
    const score = routerCountMatches(text, kws);
    if (score > best.score) best = { contentType: ct, score };
  }
  return best.score >= minMatches ? best.contentType : null;
}

function resolveContentClassificationMinimal(video, transcriptText = '') {
  const title = String(video?.title || '').toLowerCase();
  const hasTranscript = typeof transcriptText === 'string' && transcriptText.trim().length > 200;

  // Phase 1: Title override
  for (const rule of ROUTER_TITLE_OVERRIDES) {
    if (title.includes(rule.pattern.toLowerCase())) {
      return { contentType: rule.contentType, recommendedGem: rule.recommendedGem, source: rule.source, confidence: 'high', confidencePct: 97 };
    }
  }
  // Phase 2: Transcript
  if (hasTranscript) {
    const ct = routerClassifyBySignals(transcriptText.trim(), 2);
    if (ct) return { contentType: ct, recommendedGem: ROUTER_CONTENT_TYPE_TO_GEM[ct] || 'general', source: 'transcriptRules', confidence: 'medium', confidencePct: 75 };
  }
  // Phase 3: Title fallback
  const tct = routerClassifyBySignals(title, 1);
  if (tct) return { contentType: tct, recommendedGem: ROUTER_CONTENT_TYPE_TO_GEM[tct] || 'general', source: 'titleKeywords', confidence: 'low', confidencePct: 55 };
  // Phase 4: General fallback
  return { contentType: 'general', recommendedGem: 'general', source: 'fallback', confidence: 'low', confidencePct: 30 };
}

// ── Minimal copy of preGemClassifier from gemRecommender.js ──────────────

const TITLE_OVERRIDE_RULES = [
  {
    pattern: 'מבזק לייב פתיחה',
    gemKey: 'news',
    gemLabel: 'מבזק בוקר',
    gemIcon: '📰',
    contentType: 'morningBrief',
    source: 'titleOverride',
    reason: 'הכותרת מכילה "מבזק לייב פתיחה" — מזוהה כמבזק פתיחה לייב.',
    recommendedSubCategory: 'מבזקי בוקר',
  },
  {
    pattern: 'מבזק בוקר',
    gemKey: 'news',
    gemLabel: 'מבזק בוקר',
    gemIcon: '📰',
    contentType: 'morningBrief',
    source: 'titleOverride',
    reason: 'הכותרת מכילה "מבזק בוקר" — מזוהה כמבזק בוקר.',
    recommendedSubCategory: 'מבזקי בוקר',
  },
];

const MORNING_BRIEF_TITLE_SIGNALS = [
  'מבזק לייב פתיחה', 'מבזק בוקר', 'morning brief', 'premarket', 'פתיחת שוק', 'סקירת בוקר',
];

// Minimal GEM keyword rules for preGemClassifier validation fallback test
const GEM_TITLE_KEYWORDS_MINIMAL = {
  news:        ['מבזק', 'מבזק לייב', 'פתיחת שוק', 'סקירת בוקר', 'morning', 'brief', 'premarket'],
  macro:       ['macro', 'economy', 'fed', 'recession', 'inflation', 'rate', 'gdp', 'central bank'],
  dayTrading:  ['setup', 'entry', 'stop loss', 'intraday', 'scalp', 'day trade', 'support', 'resistance'],
  fundamental: ['earnings', 'valuation', 'revenue', 'profit', 'pe ratio', 'eps', 'balance sheet'],
};

function minimalClassifyGem(title, transcript = '') {
  const lower = `${title} ${transcript}`.toLowerCase();
  let best = { key: 'fundamental', score: 0 };
  for (const [key, kws] of Object.entries(GEM_TITLE_KEYWORDS_MINIMAL)) {
    const score = kws.filter(kw => lower.includes(kw.toLowerCase())).length;
    if (score > best.score) best = { key, score };
  }
  return best.key;
}

function preGemClassifierMinimal(video, transcriptText = '') {
  const title = String(video?.title || '').toLowerCase();

  // Phase 1: Deterministic title overrides
  for (const rule of TITLE_OVERRIDE_RULES) {
    if (title.includes(rule.pattern.toLowerCase())) {
      return {
        gemKey: rule.gemKey,
        source: rule.source,
        contentType: rule.contentType,
        reason: rule.reason,
        confidence: 'high',
        confidencePct: 97,
      };
    }
  }

  // Phase 2: Keyword classification
  const gemKey = minimalClassifyGem(String(video?.title || ''), transcriptText);
  const hasTranscript = transcriptText.length > 200;

  // Phase 3: Validation fallback — morning brief titles must not stay fundamental
  const isMorningBriefTitle = MORNING_BRIEF_TITLE_SIGNALS.some(s => title.includes(s.toLowerCase()));
  if (isMorningBriefTitle && gemKey !== 'news') {
    return { gemKey: 'news', source: 'titleKeywords', contentType: 'morningBrief', confidence: 'high', confidencePct: 92 };
  }

  return { gemKey, source: hasTranscript ? 'transcriptRules' : 'titleKeywords', confidence: 'medium', confidencePct: 60 };
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

// ── 6. preGemClassifier — title overrides ────────────────────────────────
console.log('\n6. preGemClassifier — title override (GEM recommendation)');

const liveBrief2 = preGemClassifierMinimal({ title: 'מבזק לייב פתיחה לתאריך 25.6.26' });
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → gemKey=news (title override)',
  liveBrief2.gemKey === 'news'
);
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → source=titleOverride',
  liveBrief2.source === 'titleOverride'
);
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → confidencePct=97',
  liveBrief2.confidencePct === 97
);
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → contentType=morningBrief',
  liveBrief2.contentType === 'morningBrief'
);

const liveBrief3 = preGemClassifierMinimal({ title: 'מבזק לייב פתיחה לתאריך 29.6.26' });
assert(
  '"מבזק לייב פתיחה לתאריך 29.6.26" → gemKey=news (title override)',
  liveBrief3.gemKey === 'news'
);
assert(
  '"מבזק לייב פתיחה לתאריך 29.6.26" → source=titleOverride (not fundamental)',
  liveBrief3.source === 'titleOverride'
);

const morningBriefReg = preGemClassifierMinimal({ title: 'מבזק בוקר יום שני 30.6.26' });
assert(
  '"מבזק בוקר יום שני" → gemKey=news via title override',
  morningBriefReg.gemKey === 'news'
);

// ── 7. preGemClassifier — validation fallback ─────────────────────────────
console.log('\n7. preGemClassifier — validation fallback (prevents fundamental override)');

const briefTitleKeyword = preGemClassifierMinimal({ title: 'סקירת בוקר שוק ההון' });
assert(
  '"סקירת בוקר שוק ההון" → gemKey=news via validation fallback (not fundamental)',
  briefTitleKeyword.gemKey === 'news'
);

const premarket = preGemClassifierMinimal({ title: 'premarket analysis nasdaq' });
assert(
  '"premarket analysis nasdaq" → gemKey=news via keyword match',
  premarket.gemKey === 'news'
);

// ── 8. preGemClassifier — transcript-based classification ─────────────────
console.log('\n8. preGemClassifier — transcript-based classification');

const macroTranscript = 'The Fed raised interest rates by 25 basis points. Inflation is still high and the CPI came in hotter than expected. GDP growth is slowing while the federal reserve monetary policy is tightening. Central bank officials signaled a hawkish stance. Bond yields are rising and recession fears are growing.';
const macroResult = preGemClassifierMinimal({ title: 'שוק ההון' }, macroTranscript);
assert(
  'transcript with Fed/inflation/rates → gemKey=macro',
  macroResult.gemKey === 'macro'
);
assert(
  'transcript classified as macro → source=transcriptRules',
  macroResult.source === 'transcriptRules'
);

const tradingTranscript = 'The setup for AAPL is a breakout above resistance at 185. Entry at market open, stop loss at 182, target 190. Intraday scalp with support holding.';
const tradingResult = preGemClassifierMinimal({ title: 'ניתוח מסחר' }, tradingTranscript);
assert(
  'transcript with entry/stop/resistance/intraday → gemKey=dayTrading',
  tradingResult.gemKey === 'dayTrading'
);

const fundamentalTranscript = 'Tesla earnings report Q2: revenue beat by 5%, EPS of $0.91. Valuation at 80 PE ratio. Profit margins improved. Balance sheet shows strong cash flow. Analyst upgrades.';
const fundResult = preGemClassifierMinimal({ title: 'ניתוח מניות' }, fundamentalTranscript);
assert(
  'transcript with earnings/valuation/EPS/revenue → gemKey=fundamental',
  fundResult.gemKey === 'fundamental'
);

// ── 9. Non-market isolation — preGemClassifier ───────────────────────────
console.log('\n9. Non-market isolation with preGemClassifier');

const nutritionResult = preGemClassifierMinimal({ title: 'ארוחת בוקר קטוגנית' }, '');
assert(
  'nutrition title → NOT news (no morning brief keywords)',
  nutritionResult.gemKey !== 'news'
);

const politicalResult = preGemClassifierMinimal({ title: 'בחירות לכנסת ניתוח' }, '');
assert(
  'political title → NOT news (no morning brief override)',
  politicalResult.source !== 'titleOverride'
);

// ── 10. resolveContentClassification (gemContentRouter layer) ────────────
console.log('\n10. resolveContentClassification (routing + metadata layer)');

// 10a. Opening live brief — title override
const rc1 = resolveContentClassificationMinimal({ title: 'מבזק לייב פתיחה לתאריך 25.6.26' });
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → contentType=marketBrief',
  rc1.contentType === 'marketBrief'
);
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → recommendedGem=news',
  rc1.recommendedGem === 'news'
);
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → source=titleOverride',
  rc1.source === 'titleOverride'
);
assert(
  '"מבזק לייב פתיחה לתאריך 25.6.26" → confidence=high',
  rc1.confidence === 'high'
);

// 10b. Standard morning brief — title override
const rc2 = resolveContentClassificationMinimal({ title: 'מבזק בוקר יום שני' });
assert(
  '"מבזק בוקר יום שני" → contentType=marketBrief',
  rc2.contentType === 'marketBrief'
);
assert(
  '"מבזק בוקר יום שני" → source=titleOverride (not transcriptRules)',
  rc2.source === 'titleOverride'
);

// 10c. Macro transcript => contentType=macro
const macroTx = 'The Fed raised interest rates by 25 basis points today at the FOMC meeting. Inflation CPI data came in higher than expected. GDP growth is slowing. Federal reserve monetary policy tightening cycle continues. Bond yields are rising and recession fears are growing. Dollar strengthening against euro. Oil prices declined.';
const rc3 = resolveContentClassificationMinimal({ title: 'ניתוח שוק' }, macroTx);
assert(
  'macro transcript → contentType=macro',
  rc3.contentType === 'macro'
);
assert(
  'macro transcript → recommendedGem=macro',
  rc3.recommendedGem === 'macro'
);
assert(
  'macro transcript → source=transcriptRules',
  rc3.source === 'transcriptRules'
);

// 10d. Daily trading transcript => contentType=dailyTrading
const tradingTx = 'The setup for AAPL is a breakout above resistance at 185. Entry at market open with stop loss at 182 and target 190. Intraday scalp with support holding at 180. Price action shows momentum. Day trade setup for QQQ gap up with volume spike. Trade setup requires risk reward of 1:3.';
const rc4 = resolveContentClassificationMinimal({ title: 'ניתוח טכני' }, tradingTx);
assert(
  'daily trading transcript → contentType=dailyTrading',
  rc4.contentType === 'dailyTrading'
);
assert(
  'daily trading transcript → recommendedGem=technical',
  rc4.recommendedGem === 'technical'
);
assert(
  'daily trading transcript → source=transcriptRules',
  rc4.source === 'transcriptRules'
);

// 10e. Earnings/valuation transcript => contentType=fundamental
const fundTx = 'Tesla Q2 earnings report: revenue beat by 5% at $25B. EPS came in at $0.91 versus expected $0.85. PE ratio at 80 suggests high valuation. Profit margin improved to 18%. Balance sheet shows strong cash flow of $3B. Net income up 30%. Analyst upgrades target price to $300. Guidance raised for next quarter. Business model shift to energy storage. Return on equity at 22%.';
const rc5 = resolveContentClassificationMinimal({ title: 'ניתוח מניות' }, fundTx);
assert(
  'earnings/valuation transcript → contentType=fundamental',
  rc5.contentType === 'fundamental'
);
assert(
  'earnings/valuation transcript → recommendedGem=fundamental',
  rc5.recommendedGem === 'fundamental'
);
assert(
  'earnings/valuation transcript → source=transcriptRules',
  rc5.source === 'transcriptRules'
);

// 10f. Nutrition video — no market signals
const rc6 = resolveContentClassificationMinimal({ title: 'ארוחת בוקר קטוגנית' }, '');
assert(
  'nutrition video → contentType=general (fallback)',
  rc6.contentType === 'general'
);
assert(
  'nutrition video → source=fallback',
  rc6.source === 'fallback'
);

// 10g. Validate stored classification — title override always wins
function validateStoredClassificationMinimal(video, stored) {
  const title = String(video?.title || '').toLowerCase();
  for (const rule of ROUTER_TITLE_OVERRIDES) {
    if (title.includes(rule.pattern.toLowerCase())) {
      const isCorrect = stored?.contentType === rule.contentType;
      return { valid: isCorrect, expectedContentType: rule.contentType };
    }
  }
  return { valid: true };
}

const validOk  = validateStoredClassificationMinimal(
  { title: 'מבזק לייב פתיחה לתאריך 29.6.26' },
  { contentType: 'marketBrief' }
);
const validBad = validateStoredClassificationMinimal(
  { title: 'מבזק לייב פתיחה לתאריך 29.6.26' },
  { contentType: 'fundamental' }
);
assert(
  'validateStoredClassification: correct contentType → valid=true',
  validOk.valid === true
);
assert(
  'validateStoredClassification: fundamental for morning brief title → valid=false',
  validBad.valid === false
);

// ── 11. Tab data regression: rawData fallback for universal tabs ──────────
console.log('\n11. Tab data regression — rawData fallback for universal tabs');

// Minimal simulation of extractVideoTabItems rawData fallback logic
function pickArrayLocal(obj, ...keys) {
  for (const key of keys) {
    const v = obj?.[key];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return [];
}
function pickStringAsArrayLocal(obj, ...keys) {
  for (const key of keys) {
    const v = obj?.[key];
    if (typeof v === 'string' && v.trim()) return [v.trim()];
  }
  return [];
}

// Simulate summary fallback from rawData
function extractSummaryRawData(marketBriefData, video = {}) {
  const utSummary = marketBriefData?.universalTabs?.summary;
  if (Array.isArray(utSummary) && utSummary.length > 0) return utSummary;
  if (utSummary && typeof utSummary === 'object') {
    const items = [
      ...pickStringAsArrayLocal(utSummary, 'shortSummary', 'fullSummary', 'marketMood', 'mainConclusion'),
      ...pickArrayLocal(utSummary, 'topTakeaways', 'importantWarnings', 'keyOpportunities'),
    ];
    if (items.length > 0) return items;
  }
  // rawData fallback
  const rd = marketBriefData?.rawData;
  if (rd && typeof rd === 'object') {
    const rdItems = [
      ...pickStringAsArrayLocal(rd.marketOverview, 'text', 'summary', 'briefSummary', 'overview'),
      ...pickStringAsArrayLocal(rd, 'shortSummary', 'fullSummary', 'mainConclusion'),
      ...pickArrayLocal(rd, 'top5Insights', 'reusableKnowledge').slice(0, 3),
    ];
    if (rdItems.length > 0) return rdItems;
  }
  return pickStringAsArrayLocal(video, 'shortSummary', 'fullSummary', 'gemSummary', 'summary', 'mainLesson');
}

// Simulate insights fallback from rawData
function extractInsightsRawData(marketBriefData) {
  const utInsights = marketBriefData?.universalTabs?.insights;
  if (Array.isArray(utInsights) && utInsights.length > 0) return utInsights;
  if (utInsights && typeof utInsights === 'object') {
    const items = pickArrayLocal(utInsights, 'top5Insights', 'learningInsights', 'marketLessons', 'tradingInsights', 'conclusions');
    if (items.length > 0) return items;
  }
  const rd = marketBriefData?.rawData;
  if (rd && typeof rd === 'object') {
    const rdItems = [
      ...pickArrayLocal(rd, 'top5Insights', 'learningInsights', 'reusableKnowledge'),
      ...pickArrayLocal(rd, 'tradingOpportunities', 'risks'),
    ];
    if (rdItems.length > 0) return rdItems;
  }
  return [];
}

const GEM_WITH_RAW_DATA = {
  contentType: 'marketBrief',
  universalTabs: {
    summary: [],        // empty — should fallback to rawData
    insights: [],       // empty — should fallback to rawData
    usefulKnowledge: [],
    appBuilder: null,
    topicsSubtopics: [],
    specialized: {
      marketNews: ['## Repaired JSON Preview', '```json\n{}\n```', 'חדשות אמיתיות'],
    },
  },
  rawData: {
    marketOverview: { text: 'שוק ההון פתח בעלייה מתונה', marketMood: 'שורי' },
    top5Insights: ['תובנה 1', 'תובנה 2', 'תובנה 3'],
    reusableKnowledge: ['ידע לשימוש חוזר 1', 'ידע לשימוש חוזר 2'],
    marketNews: ['חדשות שוק 1', 'חדשות שוק 2'],
    macroFactors: [{ name: 'CPI', value: '3.2%', trend: 'ירידה' }],
    stocksMentioned: [{ symbol: 'NVDA', reason: 'פריצת שיא' }],
    risks: ['סיכון 1', 'סיכון 2'],
    tradingOpportunities: ['הזדמנות 1'],
  },
};

// Summary fallback from rawData
const summaryItems = extractSummaryRawData(GEM_WITH_RAW_DATA);
assert('Summary: falls back to rawData.marketOverview.text when universalTabs.summary is empty', summaryItems.length > 0);
assert('Summary: first item is the marketOverview text (not "marketMood: ..." label)', summaryItems[0] === 'שוק ההון פתח בעלייה מתונה');
assert('Summary: no "text: ..." raw label in items', !summaryItems.some(s => typeof s === 'string' && s.startsWith('text:')));
assert('Summary: no "marketMood: ..." raw label in items', !summaryItems.some(s => typeof s === 'string' && s.startsWith('marketMood:')));

// Insights fallback from rawData
const insightsItems = extractInsightsRawData(GEM_WITH_RAW_DATA);
assert('Insights: falls back to rawData.top5Insights when universalTabs.insights is empty', insightsItems.length > 0);
assert('Insights: contains rawData.top5Insights items', insightsItems.includes('תובנה 1'));

// ── 12. Diagnostic content filter ────────────────────────────────────────
console.log('\n12. Diagnostic content filter (isDiagnosticItem)');

function isDiagnosticItemLocal(item) {
  if (item == null) return true;
  if (typeof item !== 'string') return false;
  const t = item.trim();
  if (!t) return true;
  if (t.startsWith('```')) return true;
  if (/^#{1,3}\s*Repaired JSON/i.test(t)) return true;
  if (/^#{1,3}\s*Original Error/i.test(t)) return true;
  if (/^#{1,3}\s*How To Prevent/i.test(t)) return true;
  if (/^#{1,3}\s*Suggested Prompt/i.test(t)) return true;
  if (/^#{1,3}\s*Error (Summary|Context|Info)/i.test(t)) return true;
  return false;
}

function filterDiagnosticItemsLocal(arr) {
  return Array.isArray(arr) ? arr.filter(item => !isDiagnosticItemLocal(item)) : [];
}

const brokenSpecNews = [
  '## Repaired JSON Preview',
  '```json',
  '{"key": "value"}',
  '```',
  '## Original Error Context',
  'חדשות שוק אמיתיות 1',
  'חדשות שוק אמיתיות 2',
  { title: 'כותרת', description: 'תיאור' },
];

const filtered = filterDiagnosticItemsLocal(brokenSpecNews);

assert('"## Repaired JSON Preview" is filtered out', !filtered.some(i => i === '## Repaired JSON Preview'));
assert('markdown code fence start "```json" is filtered out', !filtered.some(i => i === '```json'));
assert('markdown code fence end "```" is filtered out', !filtered.some(i => i === '```'));
assert('"## Original Error Context" is filtered out', !filtered.some(i => i === '## Original Error Context'));
assert('Real news item "חדשות שוק אמיתיות 1" is kept', filtered.some(i => i === 'חדשות שוק אמיתיות 1'));
assert('Real news item "חדשות שוק אמיתיות 2" is kept', filtered.some(i => i === 'חדשות שוק אמיתיות 2'));
assert('Object items are never filtered (not diagnostic)', filtered.some(i => typeof i === 'object' && i?.title === 'כותרת'));

// After filter, only real items remain
const realItemsOnly = filtered.filter(i => typeof i === 'string');
assert('Remaining string items contain no repair markers', realItemsOnly.every(i => !isDiagnosticItemLocal(i)));

// ── 13. marketOverview text extraction (no "text:" label leakage) ─────────
console.log('\n13. marketOverview text extraction — no label leakage');

// Simulate the fixed market-news extraction
function extractMarketNewsFixed(src) {
  // Fixed: use pickStringAsArray for marketOverview instead of pickObjectAsStrings
  const moText = pickStringAsArrayLocal(src?.marketOverview, 'text', 'summary', 'overview', 'briefSummary');
  return filterDiagnosticItemsLocal([
    ...pickArrayLocal(src, 'marketNews', 'headlines', 'news', 'topStories'),
    ...moText,
    ...pickArrayLocal(src, 'catalysts', 'snapshot'),
  ]);
}

// OLD (broken): pickObjectAsStrings for marketOverview
function extractMarketNewsOld(src) {
  if (!src) return [];
  const val = src.marketOverview;
  if (!val || typeof val !== 'object' || Array.isArray(val)) return [];
  return Object.entries(val).map(([k, v]) => `${k}: ${v}`).filter(Boolean);
}

const srcWithMarketOverview = {
  marketOverview: { text: 'שוק ההון פתח בעלייה מתונה על רקע נתוני תעסוקה חזקים', marketMood: 'שורי' },
  marketNews: ['חדשות 1', 'חדשות 2'],
};

const fixedResult  = extractMarketNewsFixed(srcWithMarketOverview);
const oldResult    = extractMarketNewsOld(srcWithMarketOverview);

assert('OLD extraction produces "text: ..." label (bug)', oldResult.some(i => i.startsWith('text:')));
assert('OLD extraction produces "marketMood: ..." label (bug)', oldResult.some(i => i.startsWith('marketMood:')));

assert('FIXED extraction: no "text: ..." label leakage', !fixedResult.some(i => typeof i === 'string' && i.startsWith('text:')));
assert('FIXED extraction: no "marketMood: ..." label leakage', !fixedResult.some(i => typeof i === 'string' && i.startsWith('marketMood:')));
assert('FIXED extraction: marketOverview.text included as plain string', fixedResult.includes('שוק ההון פתח בעלייה מתונה על רקע נתוני תעסוקה חזקים'));
assert('FIXED extraction: marketNews items included', fixedResult.includes('חדשות 1'));
assert('FIXED extraction: total items count is marketNews + 1 (text)', fixedResult.length === 3);

// ── 14. "מבזק לייב פתיחה לתאריך 18.6.26" full scenario ───────────────────
console.log('\n14. "מבזק לייב פתיחה לתאריך 18.6.26" — full routing scenario');

const VIDEO_18_6_26 = {
  title: 'מבזק לייב פתיחה לתאריך 18.6.26',
  category: 'שוק ההון',
  subCategory: 'מבזקי בוקר',
};

const type18 = detectVideoType(VIDEO_18_6_26);
assert('"מבזק לייב פתיחה לתאריך 18.6.26" → morningBrief', type18 === 'morningBrief');

const gemRec18 = preGemClassifierMinimal(VIDEO_18_6_26, '');
assert('"מבזק לייב פתיחה לתאריך 18.6.26" GEM → news', gemRec18.gemKey === 'news');
assert('"מבזק לייב פתיחה לתאריך 18.6.26" GEM → titleOverride source', gemRec18.source === 'titleOverride');

const slug18 = resolveEffectiveBriefSlug(
  normalizeSubCategory('מבזקי בוקר') || null,
  { contentType: 'marketBrief' },
  type18
);
assert('"מבזק לייב פתיחה לתאריך 18.6.26" slug → morning-brief', slug18 === 'morning-brief');

const rc18 = resolveContentClassificationMinimal(VIDEO_18_6_26, '');
assert('"מבזק לייב פתיחה לתאריך 18.6.26" contentClassification.contentType → marketBrief', rc18.contentType === 'marketBrief');
assert('"מבזק לייב פתיחה לתאריך 18.6.26" contentClassification.recommendedGem → news', rc18.recommendedGem === 'news');

// ── Result ────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
