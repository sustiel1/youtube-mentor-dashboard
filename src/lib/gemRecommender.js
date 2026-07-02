// ─── Gem Recommender ────────────────────────────────────────────────────────
// Classifies a video to the most suitable Gemini Gem based on metadata + transcript.

import { getTopicRule } from "@/lib/topicRules";

// Deterministic title overrides — checked before any keyword scoring.
// Highest priority: if pattern matches, recommendation cannot be changed by subCategory or TranscriptGuard.
const TITLE_OVERRIDE_RULES = [
  {
    // "מבזק לייב פתיחה לתאריך DD.MM.YY" — live opening market brief
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
    // "מבזק בוקר" — standard morning brief
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

const GEM_RULES = [
  {
    key: "fundamental",
    label: "פונדמנטלי",
    icon: "📊",
    titleKeywords: ["earnings", "valuation", "fundamental", "revenue", "income", "profit",
      "pe ratio", "cash flow", "dividend", "acquisition", "growth", "analyst",
      "upgrade", "downgrade", "target price", "eps", "q1", "q2", "q3", "q4"],
    topicKeywords: ["fundamental", "stocks", "equity", "financial", "investing", "פונדמנטלי"],
    transcriptKeywords: ["revenue", "earnings", "valuation", "margin", "guidance", "eps",
      "profit", "pe ratio", "market cap", "cash flow", "balance sheet", "dividend",
      "acquisition", "business model", "pricing power", "competitive advantage",
      "return on equity", "debt to equity", "net income", "gross profit"],
  },
  {
    key: "technical",
    label: "טכני",
    icon: "📈",
    titleKeywords: ["technical", "chart", "trading", "setup", "breakout", "analysis",
      "price action", "trade setup"],
    topicKeywords: ["technical", "trading", "charts", "טכני"],
    transcriptKeywords: ["chart", "support", "resistance", "trend", "indicator", "rsi",
      "macd", "moving average", "breakout", "candlestick", "fibonacci", "entry",
      "exit", "stop loss", "price action", "volume", "ema", "sma", "bollinger",
      "oversold", "overbought", "rally", "pullback", "neckline", "head and shoulders",
      "triangle pattern", "flag pattern"],
  },
  {
    key: "news",
    label: "מבזק בוקר",
    icon: "📰",
    titleKeywords: ["morning", "daily", "weekly", "recap", "update", "brief",
      "premarket", "afternoon", "wrap", "watchlist", "market open",
      // Hebrew morning brief patterns — ensures title-only matching even without subCategory
      "מבזק", "מבזק לייב", "פתיחת שוק", "סקירת בוקר"],
    topicKeywords: ["macro", "news", "market", "morning", "מבזק"],
    transcriptKeywords: ["morning brief", "market update", "daily update", "this week",
      "market recap", "headline", "fed", "interest rate", "inflation", "gdp", "cpi",
      "macro", "economic data", "jobs report", "unemployment", "consumer price",
      "today in markets", "market wrap"],
  },
  {
    key: "macro",
    label: "מאקרו",
    icon: "🌐",
    titleKeywords: ["macro", "economy", "fed", "recession", "inflation", "rate", "gdp",
      "central bank", "monetary", "fiscal"],
    topicKeywords: ["macro", "economy", "מאקרו"],
    transcriptKeywords: ["macro", "federal reserve", "interest rate", "monetary policy",
      "fiscal policy", "recession", "inflation", "gdp", "central bank", "yield curve",
      "quantitative easing", "quantitative tightening", "fomc", "jackson hole",
      "balance sheet reduction"],
  },
  {
    key: "appBuilder",
    label: "בניית אפליקציה",
    icon: "🏗️",
    titleKeywords: ["react", "javascript", "code", "build", "software", "tutorial",
      "how to build", "programming", "app development", "feature", "typescript"],
    topicKeywords: ["development", "code", "software", "app builder", "פיתוח"],
    transcriptKeywords: ["react", "javascript", "typescript", "code", "bug", "feature",
      "ui", "component", "api", "database", "deploy", "build", "frontend", "backend",
      "css", "html", "function", "variable", "module", "import", "hook", "useState",
      "useEffect", "props", "render", "npm", "git", "repository", "pull request"],
  },
  {
    key: "political",
    label: "פוליטי",
    icon: "🏛️",
    titleKeywords: [
      "political", "election", "government", "war", "policy", "geopolitical",
      "sanctions", "israel", "hamas", "hezbollah", "ukraine", "russia",
      // Hebrew
      "ישראל", "קלפים", "בחירות", "כנסת", "ממשלה", "מפלגה", "קואליציה",
      "אופוזיציה", "מחאה", "ראש ממשלה", "חרדים", "ערבים", "שלטון",
      "פוליטי", "פוליטיקה", "נתניהו", "הפגנה", "עזה", "כיבוש",
      "שותפות", "דו קיום", "ציונות", "לאומי",
    ],
    topicKeywords: ["political", "geopolitical", "government", "פוליטי", "פוליטיקה"],
    transcriptKeywords: [
      "government", "election", "policy", "congress", "senate",
      "president", "minister", "politics", "war", "military", "sanctions",
      "geopolitical", "diplomacy", "legislation", "bill", "vote", "campaign",
      "administration", "nato", "nuclear", "terrorism", "ceasefire",
      // Hebrew
      "ממשלה", "כנסת", "בחירות", "מפלגה", "ראש ממשלה", "שר", "קואליציה",
      "חרדים", "ערבים", "יהודים", "ישראל", "פלסטינים", "כיבוש", "שלום",
      "מחאה", "דמוקרטיה", "שחיתות", "מערכת המשפט", "הפגנה",
      "גיוס", "צבא", "ביטחון", "חמאס", "עזה", "גדה", "רצועה",
      "נתניהו", "גנץ", "לפיד", "בן גביר", "סמוטריץ",
      "ציונות", "לאומי", "זהות", "שותפות", "דו קיום",
      "קלפים", "הצבעה", "סקר", "קמפיין", "פוליטי", "פוליטיקה",
    ],
  },
  {
    key: "general",
    label: "כללי / ידע אישי",
    icon: "💡",
    titleKeywords: ["health", "nutrition", "keto", "fitness", "personal", "wellness",
      "diet", "diabetes", "lifestyle", "mindset"],
    topicKeywords: ["health", "nutrition", "personal", "בריאות", "general"],
    transcriptKeywords: ["health", "nutrition", "diet", "keto", "diabetes", "fitness",
      "exercise", "personal", "productivity", "mindset", "lifestyle", "sleep",
      "stress", "wellness", "calories", "protein", "carbs", "intermittent fasting"],
  },
];

export const GEM_ALT_OPTIONS = GEM_RULES.map(({ key, label, icon }) => ({ key, label, icon }));

// ── Gem → Category + SubCategory mapping ─────────────────────────────────────
export const GEM_CATEGORY_MAP = {
  fundamental: {
    categoryCode: 'Markets',
    categoryLabel: 'שוק ההון',
    defaultSubCategory: 'ניתוח שוק',
    subCategoryRules: [
      { label: 'ניתוח יסודי',    keywords: ['earnings', 'revenue', 'valuation', 'pe ratio', 'eps', 'cash flow', 'profit margin', 'balance sheet', 'net income'] },
      { label: 'בחירת מניות',    keywords: ['stock pick', 'undervalued', 'growth stock', 'value investing', 'dividend', 'acquisition', 'return on equity'] },
      { label: 'ניתוח שוק',      keywords: ['market analysis', 'sector', 'industry analysis', 'market cap', 'analyst', 'upgrade', 'downgrade', 'target price'] },
    ],
  },
  technical: {
    categoryCode: 'Markets',
    categoryLabel: 'שוק ההון',
    defaultSubCategory: 'ניתוח טכני',
    subCategoryRules: [
      { label: 'פרייס אקשן',     keywords: ['price action', 'candlestick', 'neckline', 'head and shoulders', 'flag pattern', 'triangle pattern'] },
      { label: 'אסטרטגיות מסחר', keywords: ['strategy', 'entry', 'exit', 'stop loss', 'trade setup', 'risk reward', 'pullback'] },
      { label: 'ניתוח טכני',     keywords: ['rsi', 'macd', 'moving average', 'indicator', 'bollinger', 'fibonacci', 'ema', 'sma', 'overbought', 'oversold'] },
    ],
  },
  news: {
    categoryCode: 'Markets',
    categoryLabel: 'שוק ההון',
    defaultSubCategory: 'סיכומי שוק',
    subCategoryRules: [
      { label: 'מבזקי בוקר',   keywords: ['morning brief', 'premarket', 'market open', 'morning update', 'morning briefing'] },
      { label: 'עדכוני שוק',   keywords: ['market update', 'headline', 'today in markets', 'this week', 'market news'] },
      { label: 'סיכומי שוק',   keywords: ['market wrap', 'weekly recap', 'daily recap', 'end of day', 'afternoon wrap'] },
    ],
  },
  macro: {
    categoryCode: 'Markets',
    categoryLabel: 'שוק ההון',
    defaultSubCategory: 'מאקרו',
    subCategoryRules: [
      { label: 'מדיניות מוניטרית', keywords: ['federal reserve', 'fomc', 'interest rate', 'monetary policy', 'fed', 'rate hike', 'rate cut', 'jackson hole'] },
      { label: 'ניהול סיכונים',   keywords: ['recession', 'gdp', 'cpi', 'jobs report', 'unemployment', 'consumer price', 'inflation risk'] },
      { label: 'כלכלה גלובלית',  keywords: ['global economy', 'central bank', 'yield curve', 'quantitative easing', 'quantitative tightening', 'fiscal policy'] },
    ],
  },
  appBuilder: {
    categoryCode: 'Dev',
    categoryLabel: 'פיתוח',
    defaultSubCategory: 'פיתוח ווב',
    subCategoryRules: [
      { label: 'כלי אוטומציה', keywords: ['n8n', 'make.com', 'zapier', 'workflow automation', 'no-code', 'automation tool', 'nocode'] },
      { label: 'Base44',       keywords: ['base44', 'low-code'] },
      { label: 'פיתוח ווב',   keywords: ['react', 'javascript', 'typescript', 'html', 'css', 'frontend', 'backend', 'hook', 'component', 'npm', 'repository'] },
    ],
  },
  political: {
    categoryCode: 'פוליטיקה',
    categoryLabel: 'פוליטיקה',
    defaultSubCategory: 'כללי',
    subCategoryRules: [
      { label: 'משיחיות',          keywords: ['messiah', 'messianic', 'messianism', 'redemption', 'temple', 'משיח', 'גאולה', 'בית המקדש', 'ציונות דתית', 'theological', 'messianic politics', 'חב"ד', 'אדמו"ר', 'גזענות'] },
      { label: 'יחסי דת ומדינה',   keywords: ['religion and state', 'haredi', 'חרדים', 'רבנות', 'גיור', 'כשרות', 'שבת', 'orthodox', 'secular', 'דת ומדינה', 'חוק'] },
      { label: 'בחירות',           keywords: ['election', 'vote', 'ballot', 'campaign', 'poll', 'בחירות', 'קלפי', 'מפלגה', 'party', 'primary'] },
      { label: 'ממשלה וקואליציה',  keywords: ['government', 'coalition', 'minister', 'prime minister', 'ממשלה', 'קואליציה', 'שר', 'ראש ממשלה', 'cabinet', 'parliament', 'כנסת', 'נתניהו', 'ליכוד'] },
      { label: 'ביטחון ומדיניות', keywords: ['military', 'war', 'security', 'army', 'hamas', 'hezbollah', 'terror', 'ceasefire', 'צבא', 'מלחמה', 'ביטחון', 'idf', 'nato'] },
      { label: 'גיאו-פוליטיקה',   keywords: ['geopolitical', 'diplomacy', 'sanctions', 'ukraine', 'russia', 'iran', 'china', 'geopolitics'] },
    ],
  },
  general: {
    categoryCode: 'Health',
    categoryLabel: 'בריאות',
    defaultSubCategory: 'כללי',
    subCategoryRules: [
      { label: 'תזונה וכושר',   keywords: ['nutrition', 'fitness', 'diet', 'exercise', 'keto', 'protein', 'calories', 'intermittent fasting', 'weight loss', 'carbs'] },
      { label: 'בריאות ורפואה', keywords: ['health', 'medical', 'disease', 'diabetes', 'cholesterol', 'blood pressure', 'insulin', 'doctor', 'treatment'] },
      { label: 'פסיכולוגיה',   keywords: ['mindset', 'psychology', 'mental health', 'stress', 'anxiety', 'happiness', 'emotion', 'productivity', 'sleep'] },
    ],
  },
};

function pickSubCategory(gemKey, fullText) {
  const cfg = GEM_CATEGORY_MAP[gemKey];
  if (!cfg?.subCategoryRules?.length) {
    return { label: cfg?.defaultSubCategory ?? 'כללי', confidencePct: 50 };
  }
  const lower = (fullText || '').toLowerCase();
  let best = { label: cfg.defaultSubCategory, score: 0 };
  let totalKeywords = 0;
  for (const rule of cfg.subCategoryRules) {
    const score = rule.keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
    totalKeywords += rule.keywords.length;
    if (score > best.score) best = { label: rule.label, score };
  }
  // confidence: 40 base + up to 55 from match ratio
  const confidencePct = best.score === 0
    ? 40
    : Math.min(95, Math.round(40 + (best.score / Math.max(1, totalKeywords / cfg.subCategoryRules.length)) * 55));
  return { label: best.label, confidencePct };
}

// ─── Category Normalization ────────────────────────────────────────────────────
// Maps English category codes AND political variants to canonical Hebrew labels.
const POLITICAL_VARIANTS = ['פולטי', 'פוליטי', 'פולטיקה', 'פוליטיקה ותוכן', 'political', 'politics', 'פוליטיקה'];

// English category codes used by the RSS ingestion layer → canonical Hebrew labels
const CATEGORY_CODE_TO_HEBREW = {
  Markets: 'שוק ההון',
  AI: 'בינה מלאכותית ואוטומציה',
  Dev: 'פיתוח תוכנה',
  Politics: 'פוליטיקה',
  Health: 'בריאות ותזונה',
  Music: 'מוזיקה',
  Food: 'אוכל ובישול',
};

export function normalizeCategoryName(raw) {
  if (!raw) return raw;
  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();
  if (POLITICAL_VARIANTS.some(v => v.toLowerCase() === lower)) return 'פוליטיקה';
  const hebrewLabel = CATEGORY_CODE_TO_HEBREW[trimmed];
  if (hebrewLabel) return hebrewLabel;
  return trimmed;
}

// Canonical category list — aligns with vault folder names and brain structure
export const KNOWN_CATEGORIES = [
  'פוליטיקה',
  'שוק ההון',
  'בריאות ותזונה',
  'טכנולוגיה ו-AI',
  'ידע אישי',
  'כללי',
];

// Returns fallback subtopic options for a gem key (used when vault API returns empty)
export function getGemSubCategoryFallback(gemKey) {
  const cfg = GEM_CATEGORY_MAP[gemKey];
  if (!cfg?.subCategoryRules?.length) return ['כללי'];
  return ['כללי', ...cfg.subCategoryRules.map(r => r.label)];
}

function countMatches(text, keywords) {
  if (!text || !keywords?.length) return 0;
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
}

export function classifyVideoForGem(video, transcriptText = "", options = {}) {
  const { forcedCategoryLabel = null, forcedTopicName = null } = options;
  const title   = (video?.title || "").toLowerCase();
  const channel = (video?.channelTitle || video?.channelName || video?.channel || "").toLowerCase();
  const topic   = (video?.topic || video?.category || "").toLowerCase();
  const subtopic = (video?.subTopic || video?.subtopic || "").toLowerCase();
  const tags    = Array.isArray(video?.tags) ? video.tags.join(" ").toLowerCase() : "";
  const contentType = (video?.contentType || "").toLowerCase();

  const hasTranscript = typeof transcriptText === "string" && transcriptText.trim().length > 200;
  const metaContext   = `${title} ${channel} ${topic} ${subtopic} ${tags} ${contentType}`;

  const scores = GEM_RULES.map(rule => {
    let score = 0;
    score += countMatches(metaContext, rule.titleKeywords) * 2;
    score += countMatches(metaContext, rule.topicKeywords) * 2;
    if (hasTranscript) {
      score += countMatches(transcriptText, rule.transcriptKeywords);
    }
    return { ...rule, score };
  });

  scores.sort((a, b) => b.score - a.score);

  // HARD RULE: Topic-driven enforcement (highest priority).
  // When a topic is known, only gems from that topic's category are eligible.
  // Within the category, content-based ranking still applies.
  const topicRule = forcedTopicName ? getTopicRule(forcedTopicName) : null;
  if (topicRule) {
    const targetCat = normalizeCategoryName(topicRule.gemCategoryLabel).toLowerCase();
    const topicGems = scores.filter(s => normalizeCategoryName(GEM_CATEGORY_MAP[s.key]?.categoryLabel ?? '').toLowerCase() === targetCat);
    const otherGems = scores.filter(s => normalizeCategoryName(GEM_CATEGORY_MAP[s.key]?.categoryLabel ?? '').toLowerCase() !== targetCat);
    scores.splice(0, scores.length, ...topicGems, ...otherGems);
    console.log('[GemClassify] topic hard rule:', forcedTopicName, '→', targetCat, '→ top gem:', scores[0].key);
  } else if (forcedCategoryLabel) {
    // HARD RULE: channel-resolved category — AI keyword scoring cannot override a known mentor's category.
    // Same priority as topic rule: only gems belonging to this category are eligible.
    const forced = normalizeCategoryName(forcedCategoryLabel).toLowerCase();
    const categoryGems = scores.filter(s => normalizeCategoryName(GEM_CATEGORY_MAP[s.key]?.categoryLabel ?? '').toLowerCase() === forced);
    const otherGems    = scores.filter(s => normalizeCategoryName(GEM_CATEGORY_MAP[s.key]?.categoryLabel ?? '').toLowerCase() !== forced);
    if (categoryGems.length > 0) {
      scores.splice(0, scores.length, ...categoryGems, ...otherGems);
    }
    console.log('[GemClassify] channel hard category rule:', forcedCategoryLabel, '→ eligible:', categoryGems.map(g => g.key), '→ top gem:', scores[0].key);
  }

  // Boost: if video.category is explicitly set to a known category, reward the matching gem.
  // This prevents transcript keyword noise from overriding a category the user already chose.
  const explicitCat = normalizeCategoryName(String(video?.category || '')).toLowerCase();
  if (explicitCat) {
    for (const s of scores) {
      const gemCat = normalizeCategoryName(GEM_CATEGORY_MAP[s.key]?.categoryLabel ?? '').toLowerCase();
      if (gemCat && gemCat === explicitCat) { s.score += 4; break; }
    }
    scores.sort((a, b) => b.score - a.score);
  }

  const top    = scores[0];
  const second = scores[1];

  const fullText = `${metaContext} ${transcriptText}`;

  if (top.score === 0) {
    return {
      gemKey: "general",
      gemLabel: "כללי",
      gemIcon: "💡",
      confidence: "low",
      confidenceLabel: "ביטחון נמוך",
      confidencePct: 30,
      reason: "לא זוהו אותות ברורים — מומלץ Gem כללי כברירת מחדל.",
      phase: hasTranscript ? "accurate" : "preliminary",
      recommendedCategoryCode: 'Health',
      recommendedCategoryLabel: 'בריאות',
      recommendedSubCategory: 'כללי',
      recommendedSubCategoryConfidencePct: 40,
    };
  }

  const margin = top.score - second.score;
  let confidence, confidenceLabel;
  if (top.score >= 6 && margin >= 3) {
    confidence = "high";
    confidenceLabel = "ביטחון גבוה";
  } else if (top.score >= 3 || margin >= 2) {
    confidence = "medium";
    confidenceLabel = "ביטחון בינוני";
  } else {
    confidence = "low";
    confidenceLabel = "ביטחון נמוך";
  }

  const confidencePct = Math.min(96, Math.round(
    40 + (top.score / (top.score + 4)) * 46 + (margin / (margin + 2)) * 10
  ));

  const phase = hasTranscript ? "accurate" : "preliminary";
  const basis = hasTranscript ? "לפי התמלול" : "לפי הכותרת והערוץ";

  const catCfg = GEM_CATEGORY_MAP[top.key] ?? {};
  const recommendedCategoryCode  = catCfg.categoryCode  ?? null;
  const recommendedCategoryLabel = catCfg.categoryLabel ?? null;
  const { label: recommendedSubCategory, confidencePct: recommendedSubCategoryConfidencePct } = pickSubCategory(top.key, fullText);

  const reasonMap = {
    fundamental: `${basis}: הסרטון עוסק בנתונים עסקיים, שווי חברה או ניתוח רווחים — מומלץ Gem פונדמנטלי.`,
    technical:   `${basis}: הסרטון עוסק בניתוח גרפים, רמות תמיכה/התנגדות או כניסות למסחר — מומלץ Gem טכני.`,
    news:        `${basis}: הסרטון הוא עדכון שוק יומי/שבועי עם כותרות מאקרו — מומלץ Gem מבזק בוקר.`,
    macro:       `${basis}: הסרטון עוסק בנושאי מאקרו, ריבית או מדיניות מוניטרית — מומלץ Gem מאקרו.`,
    appBuilder:  `${basis}: הסרטון עוסק בפיתוח, קוד, React או בניית פיצ'רים — מומלץ Gem בניית אפליקציה.`,
    political:   `${basis}: הסרטון עוסק בנושאים גיאו-פוליטיים, ממשל או ביטחון — מומלץ Gem פוליטי.`,
    general:     `${basis}: הסרטון עוסק בבריאות, תזונה או ידע אישי — מומלץ Gem כללי.`,
  };

  return {
    gemKey: top.key,
    gemLabel: top.label,
    gemIcon: top.icon,
    confidence,
    confidenceLabel,
    confidencePct,
    reason: reasonMap[top.key] || `${basis}: מומלץ Gem ${top.label}.`,
    phase,
    recommendedCategoryCode,
    recommendedCategoryLabel,
    recommendedSubCategory,
    recommendedSubCategoryConfidencePct,
  };
}

// ─── TJS GEM Recommender (transcript-only, 4 TJS children) ──────────────────
// Scores only the four GEMS TJS children based on transcript keywords.
// Returns null when transcript is absent/too short.

const TJS_GEM_KEYWORDS = {
  news: [
    'market recap', 'weekly recap', 's&p 500', 'nasdaq', 'dow',
    'sectors', 'market breadth', 'stocks mentioned', 'macro summary',
    'earnings overview', 'next week', 'morning brief', 'today in markets',
    'premarket', 'market open', 'afternoon wrap', 'market update',
    'opening bell', 'market close', 'weekly update', 'daily update',
    'מבזק', 'סיכום שוק', 'מדדים', 'סקטורים', 'מניות', 'מאקרו שבועי',
  ],
  macro: [
    'fed', 'cpi', 'inflation', 'interest rate', 'yield', 'bond',
    'dollar', 'oil', 'unemployment', 'recession', 'liquidity',
    'central bank', 'monetary policy', 'federal reserve', 'fomc',
    'jackson hole', 'gdp', 'economic data', 'yield curve',
    'ריבית', 'אינפלציה', 'צמיחה', 'מיתון', 'בנק מרכזי', 'תשואה', 'פד',
  ],
  dayTrading: [
    'breakout', 'support', 'resistance', 'entry', 'stop loss',
    'target', 'intraday', 'scalp', 'day trade', 'setup',
    'volume spike', 'price action', 'trade setup', 'momentum',
    'trigger', 'squeeze', 'gap up', 'gap down', 'levels',
    'פריצה', 'תמיכה', 'התנגדות', 'כניסה', 'יעד', 'סטופ', 'מסחר יומי',
  ],
  appBuilder: [
    'app idea', 'dashboard', 'screener', 'automation', 'workflow',
    'tool', 'feature request', 'product idea', 'user flow',
    'data model', 'react', 'javascript', 'typescript', 'component',
    'build', 'feature', 'frontend', 'backend',
    'אפליקציה', 'דשבורד', 'סקרינר', 'אוטומציה', 'ממשק', 'פיצ׳ר',
  ],
};

const TJS_GEM_META = {
  news:        { label: 'מבזק בוקר', icon: '📰' },
  macro:       { label: 'מאקרו',      icon: '🌐' },
  dayTrading:  { label: 'מסחר יומי',  icon: '🗓️' },
  appBuilder:  { label: 'AP Builder', icon: '🏗️' },
};

const TJS_REASON = {
  news:       'נמצא דגש על סיכומי שוק, מדדים וסקטורים — מתאים למבזק בוקר',
  macro:      'נמצא דגש על מדיניות מוניטרית, ריבית ואינפלציה — מתאים למאקרו',
  dayTrading: 'נמצא דגש על פריצות, רמות ומסחר יומי — מתאים למסחר יומי',
  appBuilder: 'נמצא דגש על אפליקציה, UI ואוטומציה — מתאים ל-AP Builder',
};

/**
 * Recommends which GEMS TJS child best fits the transcript.
 * Transcript-only — does not use video metadata.
 *
 * @param {string} transcriptText
 * @returns {{ recommendedGemKey, confidencePct, confidence, scores, reason, detectedKeywords, gemKey, gemLabel, gemIcon, phase } | null}
 */
export function recommendTjsGemFromTranscript(transcriptText) {
  if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim().length < 100) {
    return null;
  }

  const lower = transcriptText.toLowerCase();
  const scores = {};
  const allDetected = {};

  for (const [key, keywords] of Object.entries(TJS_GEM_KEYWORDS)) {
    const matches = keywords.filter(kw => lower.includes(kw.toLowerCase()));
    scores[key] = matches.length === 0 ? 0 : Math.min(96, 30 + matches.length * 6);
    allDetected[key] = matches.slice(0, 6);
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topKey, topScore] = sorted[0];
  const [, secondScore] = sorted[1] || [null, 0];

  if (topScore < 36) {
    return {
      recommendedGemKey: null,
      confidencePct: topScore,
      confidence: 'low',
      scores,
      reason: 'אין המלצה חד משמעית — לא זוהה תוכן TJS ברור',
      detectedKeywords: [],
      gemKey: null,
      gemLabel: '',
      gemIcon: '📊',
      phase: 'accurate',
    };
  }

  const margin = topScore - secondScore;
  const rawPct = margin < 10 ? Math.max(40, topScore - 10) : topScore;
  const confidencePct = Math.round(rawPct);
  const confidence = confidencePct >= 70 ? 'high' : confidencePct >= 50 ? 'medium' : 'low';

  return {
    recommendedGemKey: topKey,
    confidencePct,
    confidence,
    scores,
    reason: TJS_REASON[topKey] || `נמצא תוכן TJS — מומלץ ${TJS_GEM_META[topKey]?.label || topKey}`,
    detectedKeywords: allDetected[topKey] || [],
    gemKey: topKey,
    gemLabel: TJS_GEM_META[topKey]?.label || topKey,
    gemIcon: TJS_GEM_META[topKey]?.icon || '📊',
    phase: 'accurate',
  };
}

// ─── Pre-Gem Classifier ──────────────────────────────────────────────────────
// Hybrid classifier: title overrides → keyword scoring → validation fallback.
// Returns a result with a `source` field indicating how the recommendation was made.
// source values: 'titleOverride' | 'titleKeywords' | 'transcriptRules' | 'fallback'
//
// Priority order:
//   1. TITLE_OVERRIDE_RULES (deterministic, unambiguous title patterns)
//   2. classifyVideoForGem (keyword scoring — title + transcript)
//   3. Validation fallback (prevent fundamental from overriding morning-brief titles)

const MORNING_BRIEF_TITLE_SIGNALS = [
  'מבזק לייב פתיחה', 'מבזק בוקר', 'morning brief', 'premarket', 'פתיחת שוק', 'סקירת בוקר',
];

export function preGemClassifier(video, transcriptText = '', options = {}) {
  const title = String(video?.title || '').toLowerCase();

  // Phase 1: Deterministic title overrides (highest priority)
  for (const rule of TITLE_OVERRIDE_RULES) {
    if (title.includes(rule.pattern.toLowerCase())) {
      return {
        gemKey: rule.gemKey,
        gemLabel: rule.gemLabel,
        gemIcon: rule.gemIcon,
        confidence: 'high',
        confidenceLabel: 'ביטחון גבוה',
        confidencePct: 97,
        contentType: rule.contentType,
        source: rule.source,
        reason: rule.reason,
        phase: 'override',
        recommendedCategoryCode: 'Markets',
        recommendedCategoryLabel: 'שוק ההון',
        recommendedSubCategory: rule.recommendedSubCategory || 'מבזקי בוקר',
        recommendedSubCategoryConfidencePct: 97,
      };
    }
  }

  // Phase 2–3: Title keyword + transcript classification via existing classifier
  const result = classifyVideoForGem(video, transcriptText, options);
  const hasTranscript = typeof transcriptText === 'string' && transcriptText.trim().length > 200;
  const source = hasTranscript ? 'transcriptRules' : 'titleKeywords';

  // Phase 4: App-side validation fallback
  // Morning brief titles must not be overridden to fundamental by keyword noise
  const isMorningBriefTitle = MORNING_BRIEF_TITLE_SIGNALS.some(s => title.includes(s.toLowerCase()));
  if (isMorningBriefTitle && result.gemKey !== 'news') {
    return {
      ...result,
      gemKey: 'news',
      gemLabel: 'מבזק בוקר',
      gemIcon: '📰',
      confidence: 'high',
      confidenceLabel: 'ביטחון גבוה',
      confidencePct: 92,
      source: 'titleKeywords',
      reason: 'כותרת הסרטון מזוהה כמבזק בוקר — הגם עודכן בהתאם.',
      recommendedSubCategory: 'מבזקי בוקר',
      recommendedCategoryCode: 'Markets',
      recommendedCategoryLabel: 'שוק ההון',
    };
  }

  return { ...result, source };
}

/** Related template labels for a recommended GEM (from existing subCategory rules). */
export function getRelatedGemTemplates(gemKey) {
  const key = String(gemKey || "").trim();
  const cfg = GEM_CATEGORY_MAP[key];
  const fromRules = Array.isArray(cfg?.subCategoryRules)
    ? cfg.subCategoryRules.map((r) => r.label).filter(Boolean)
    : [];
  const briefAliases = key === "news"
    ? ["מבזק בוקר", "מבזק ערב", "עדכון שוק", "Opening Bell"]
    : [];
  const merged = [...briefAliases, ...fromRules];
  return [...new Set(merged)].slice(0, 6);
}
