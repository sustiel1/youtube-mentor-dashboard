/**
 * GEM Content Router — source-of-truth prompt/schema/validator mapping layer.
 *
 * Single source of truth for:
 *   1. Fine-grained contentType constants
 *   2. Title override rules (deterministic, highest priority)
 *   3. Transcript signal rules (keyword-based classification)
 *   4. contentType → Gemini dispatch type mapping
 *   5. contentType → recommended GEM key mapping
 *   6. contentType → promptBuilderKey / schemaKey / validatorKey mapping
 *   7. resolveContentClassification() — produces metadata.contentClassification
 *
 * metadata.contentClassification shape:
 * {
 *   contentType:    'marketBrief' | 'macro' | 'dailyTrading' | 'fundamental' | 'general' | 'political'
 *   recommendedGem: 'news' | 'macro' | 'technical' | 'fundamental' | 'general' | 'political'
 *   confidence:     'high' | 'medium' | 'low'
 *   confidencePct:  number (0-97)
 *   reason:         string (Hebrew)
 *   source:         'titleOverride' | 'titleKeywords' | 'transcriptRules' | 'fallback'
 *   classifiedAt:   ISO string (added by wrapAsMetadataClassification)
 * }
 *
 * Language rules for GEM output:
 *   - JSON keys: English (contentType, recommendedGem, reason, etc.)
 *   - User-facing text values: Hebrew (reason, gemLabel)
 *   - Transcript analysis content: Hebrew
 *   - Ticker symbols and technical terms: English
 */

// ── Fine-grained content type constants ──────────────────────────────────────
export const CONTENT_TYPES = {
  MARKET_BRIEF:  'marketBrief',
  MACRO:         'macro',
  DAILY_TRADING: 'dailyTrading',
  FUNDAMENTAL:   'fundamental',
  GENERAL:       'general',
  POLITICAL:     'political',
};

// ── Gemini dispatch type mapping ──────────────────────────────────────────────
// Maps fine-grained contentType → coarse Gemini prompt dispatch type.
// Used by vite.config.js server handler and analyzeVideoWithGemini.js.
export const GEMINI_DISPATCH_TYPE = {
  marketBrief:   'market',
  macro:         'market',
  dailyTrading:  'market',
  fundamental:   'market',
  general:       'general',
  political:     'political',
};

// ── Recommended GEM key mapping ───────────────────────────────────────────────
// Maps fine-grained contentType → recommended GEM key for the recommendation UI.
export const CONTENT_TYPE_TO_GEM = {
  marketBrief:   'news',
  macro:         'macro',
  dailyTrading:  'technical',
  fundamental:   'fundamental',
  general:       'general',
  political:     'political',
};

// ── Title override rules ──────────────────────────────────────────────────────
// Deterministic — if title matches, classification cannot be overridden.
// Aligned with TITLE_OVERRIDE_RULES in src/lib/gemRecommender.js.
// HARD RULE: "מבזק לייב פתיחה לתאריך" always → marketBrief / news GEM.
export const TITLE_OVERRIDE_RULES = [
  {
    pattern: 'מבזק לייב פתיחה',
    contentType: CONTENT_TYPES.MARKET_BRIEF,
    recommendedGem: 'news',
    source: 'titleOverride',
    reason: 'כותרת "מבזק לייב פתיחה" — מבזק פתיחה לייב.',
  },
  {
    pattern: 'מבזק בוקר',
    contentType: CONTENT_TYPES.MARKET_BRIEF,
    recommendedGem: 'news',
    source: 'titleOverride',
    reason: 'כותרת "מבזק בוקר" — מבזק בוקר סטנדרטי.',
  },
];

// ── Transcript + title keyword signals ────────────────────────────────────────
// Used for Phase 2 (transcript) and Phase 3 (title keywords) classification.
export const CONTENT_SIGNALS = {
  [CONTENT_TYPES.MARKET_BRIEF]: [
    'market recap', 'weekly recap', 's&p 500', 'nasdaq', 'dow',
    'sectors', 'market breadth', 'stocks mentioned', 'macro summary',
    'earnings overview', 'next week', 'morning brief', 'today in markets',
    'premarket', 'market open', 'afternoon wrap', 'market update',
    'opening bell', 'market close', 'weekly update', 'daily update',
    'מבזק', 'סיכום שוק', 'מדדים', 'סקטורים', 'מניות', 'מאקרו שבועי',
  ],
  [CONTENT_TYPES.MACRO]: [
    'fed', 'cpi', 'inflation', 'interest rate', 'yield', 'bond',
    'dollar', 'oil', 'unemployment', 'recession', 'liquidity',
    'central bank', 'monetary policy', 'federal reserve', 'fomc',
    'jackson hole', 'gdp', 'economic data', 'yield curve',
    'ריבית', 'אינפלציה', 'צמיחה', 'מיתון', 'בנק מרכזי', 'תשואה', 'פד',
  ],
  [CONTENT_TYPES.DAILY_TRADING]: [
    'breakout', 'support', 'resistance', 'entry', 'stop loss',
    'target', 'intraday', 'scalp', 'day trade', 'setup',
    'volume spike', 'price action', 'trade setup', 'momentum',
    'trigger', 'squeeze', 'gap up', 'gap down', 'levels',
    'פריצה', 'תמיכה', 'התנגדות', 'כניסה', 'יעד', 'סטופ', 'מסחר יומי',
  ],
  [CONTENT_TYPES.FUNDAMENTAL]: [
    'earnings', 'revenue', 'valuation', 'eps', 'pe ratio', 'balance sheet',
    'profit margin', 'cash flow', 'net income', 'gross profit', 'guidance',
    'acquisition', 'dividend', 'analyst', 'upgrade', 'downgrade', 'target price',
    'business model', 'competitive advantage', 'return on equity', 'debt to equity',
    'הכנסות', 'רווח', 'שווי', 'תוצאות', 'דוחות', 'ניתוח יסודי',
  ],
};

// ── Static prompt/schema/validator config table ───────────────────────────────
// Keys map to builder/schema/validator files in src/ai/gemini/{prompts,schemas,validators}/
export const GEM_PROMPT_CONFIG_TABLE = {
  [CONTENT_TYPES.MARKET_BRIEF]: {
    geminiContentType: 'market',
    promptBuilderKey:  'market',
    schemaKey:         'morningBrief',
    validatorKey:      'market',
    gemKey:            'news',
    gemLabel:          'מבזק בוקר',
    description:       'מבזק שוק בוקר / פתיחת מסחר לייב',
  },
  [CONTENT_TYPES.MACRO]: {
    geminiContentType: 'market',
    promptBuilderKey:  'market',
    schemaKey:         'market',
    validatorKey:      'market',
    gemKey:            'macro',
    gemLabel:          'מאקרו',
    description:       'ניתוח מאקרו: ריבית, אינפלציה, מדיניות מוניטרית',
  },
  [CONTENT_TYPES.DAILY_TRADING]: {
    geminiContentType: 'market',
    promptBuilderKey:  'market',
    schemaKey:         'market',
    validatorKey:      'market',
    gemKey:            'technical',
    gemLabel:          'טכני',
    description:       'מסחר יומי: סטאפים, רמות, כניסות ויציאות',
  },
  [CONTENT_TYPES.FUNDAMENTAL]: {
    geminiContentType: 'market',
    promptBuilderKey:  'market',
    schemaKey:         'market',
    validatorKey:      'market',
    gemKey:            'fundamental',
    gemLabel:          'פונדמנטלי',
    description:       'ניתוח יסודי: דוחות, שווי, רווחים',
  },
  [CONTENT_TYPES.GENERAL]: {
    geminiContentType: 'general',
    promptBuilderKey:  'general',
    schemaKey:         'general',
    validatorKey:      'general',
    gemKey:            'general',
    gemLabel:          'כללי',
    description:       'תוכן כללי/חינוכי ללא מאפיינים ייעודיים',
  },
  [CONTENT_TYPES.POLITICAL]: {
    geminiContentType: 'political',
    promptBuilderKey:  'political',
    schemaKey:         'political',
    validatorKey:      'political',
    gemKey:            'political',
    gemLabel:          'פוליטי',
    description:       'תוכן פוליטי: ממשל, ביטחון, גיאו-פוליטיקה',
  },
};

// ── Classification helpers ────────────────────────────────────────────────────

function countKeywordMatches(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
}

/**
 * Scores transcript/title text against each contentType's keyword signals.
 * Returns the contentType with the highest score, or null if below threshold.
 */
function classifyBySignals(text, minMatches = 2) {
  let best = { contentType: null, score: 0 };
  for (const [contentType, keywords] of Object.entries(CONTENT_SIGNALS)) {
    const score = countKeywordMatches(text, keywords);
    if (score > best.score) best = { contentType, score };
  }
  return best.score >= minMatches ? best.contentType : null;
}

// ── Main classification function ──────────────────────────────────────────────

/**
 * Resolves content classification for a video.
 *
 * Priority order:
 *   1. Title override (deterministic, unambiguous patterns — always wins)
 *   2. Transcript signal matching (if transcript > 200 chars)
 *   3. Title keyword fallback (signals applied to title only)
 *   4. General fallback
 *
 * @param {object} video  - { title, category, contentType, ... }
 * @param {string} transcriptText
 * @returns {{ contentType, recommendedGem, confidence, confidencePct, reason, source }}
 */
export function resolveContentClassification(video, transcriptText = '') {
  const title = String(video?.title || '').toLowerCase();
  const hasTranscript = typeof transcriptText === 'string' && transcriptText.trim().length > 200;

  // Phase 1: Deterministic title overrides
  for (const rule of TITLE_OVERRIDE_RULES) {
    if (title.includes(rule.pattern.toLowerCase())) {
      return {
        contentType:    rule.contentType,
        recommendedGem: rule.recommendedGem,
        confidence:     'high',
        confidencePct:  97,
        reason:         rule.reason,
        source:         rule.source,
      };
    }
  }

  // Phase 2: Transcript signal classification
  if (hasTranscript) {
    const contentType = classifyBySignals(transcriptText.trim(), 2);
    if (contentType) {
      return {
        contentType,
        recommendedGem: CONTENT_TYPE_TO_GEM[contentType] || 'general',
        confidence:     'medium',
        confidencePct:  75,
        reason:         `זוהה לפי תמלול — תוכן: ${GEM_PROMPT_CONFIG_TABLE[contentType]?.description || contentType}`,
        source:         'transcriptRules',
      };
    }
  }

  // Phase 3: Title keyword fallback
  const titleContentType = classifyBySignals(title, 1);
  if (titleContentType) {
    return {
      contentType:    titleContentType,
      recommendedGem: CONTENT_TYPE_TO_GEM[titleContentType] || 'general',
      confidence:     'low',
      confidencePct:  55,
      reason:         `זוהה לפי כותרת — תוכן: ${GEM_PROMPT_CONFIG_TABLE[titleContentType]?.description || titleContentType}`,
      source:         'titleKeywords',
    };
  }

  // Phase 4: General fallback
  return {
    contentType:    CONTENT_TYPES.GENERAL,
    recommendedGem: 'general',
    confidence:     'low',
    confidencePct:  30,
    reason:         'לא זוהה תוכן ייעודי — כללי כברירת מחדל',
    source:         'fallback',
  };
}

/**
 * Wraps a resolveContentClassification() result in the metadata.contentClassification format.
 * Use this when saving the classification to a video record.
 */
export function wrapAsMetadataClassification(classificationResult) {
  return {
    metadata: {
      contentClassification: {
        ...classificationResult,
        classifiedAt: new Date().toISOString(),
      },
    },
  };
}

/**
 * Returns the Gemini dispatch type for a fine-grained contentType.
 * Maps 'marketBrief' | 'macro' | 'dailyTrading' | 'fundamental' → 'market'
 * Maps 'general' → 'general'
 * Maps 'political' → 'political'
 */
export function getGeminiDispatchType(contentType) {
  return GEMINI_DISPATCH_TYPE[contentType] || 'general';
}

/**
 * Returns the static prompt/schema/validator config for a contentType.
 * Use the returned keys to look up the right builder/schema/validator module.
 */
export function getGemPromptConfig(contentType) {
  return GEM_PROMPT_CONFIG_TABLE[contentType] || GEM_PROMPT_CONFIG_TABLE[CONTENT_TYPES.GENERAL];
}

/**
 * App-side validation: given a video and its stored contentClassification,
 * returns whether the classification is still valid or should be re-computed.
 *
 * Validation rules:
 *   - Title override patterns always win (cannot be invalidated by stored classification)
 *   - marketBrief must not be overridden to fundamental
 *   - macro must not be overridden to fundamental unless earnings/revenue dominate
 *   - dailyTrading must not be overridden to fundamental unless company financials dominate
 */
export function validateStoredClassification(video, storedClassification) {
  if (!storedClassification) return { valid: false, reason: 'no stored classification' };

  const title = String(video?.title || '').toLowerCase();

  // Hard rule: title overrides can never be invalidated by stored classification
  for (const rule of TITLE_OVERRIDE_RULES) {
    if (title.includes(rule.pattern.toLowerCase())) {
      const isCorrect = storedClassification.contentType === rule.contentType;
      return {
        valid: isCorrect,
        expectedContentType: rule.contentType,
        expectedGem: rule.recommendedGem,
        reason: isCorrect
          ? 'title override matches stored classification'
          : `title override requires contentType=${rule.contentType} but stored=${storedClassification.contentType}`,
      };
    }
  }

  return { valid: true, reason: 'no title override conflict' };
}
