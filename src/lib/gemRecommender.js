// ─── Gem Recommender ────────────────────────────────────────────────────────
// Classifies a video to the most suitable Gemini Gem based on metadata + transcript.

import { getTopicRule } from "@/lib/topicRules";

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
      "premarket", "afternoon", "wrap", "watchlist", "market open"],
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
// Maps any political variant (typos, English, partial) → canonical "פוליטיקה"
const POLITICAL_VARIANTS = ['פולטי', 'פוליטי', 'פולטיקה', 'פוליטיקה ותוכן', 'political', 'politics', 'politics', 'פוליטיקה'];

export function normalizeCategoryName(raw) {
  if (!raw) return raw;
  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();
  if (POLITICAL_VARIANTS.some(v => v.toLowerCase() === lower)) return 'פוליטיקה';
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
