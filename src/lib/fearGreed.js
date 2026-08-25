// Client-side helpers for the CNN Fear & Greed live proxy response.
// Same normalized shape whether served by vite.config.js's dev-time
// /api/market/fear-greed middleware or the deployed Base44 FetchFearGreed
// backend function — see backend/fetch-fear-greed.function.js.

export const FEAR_GREED_API_PATH = '/api/market/fear-greed';

// CNN's index is published roughly once a day; this only controls how long
// a live response is considered fresh before react-query refetches it on
// the next mount (e.g. reopening the video panel). Within this window,
// repeated visits reuse the in-memory result instead of re-hitting CNN; the
// manual refresh button (FearGreedScoreCardContainer) bypasses it entirely.
export const FEAR_GREED_QUERY_STALE_TIME_MS = 5 * 60 * 1000;

// The 7 sub-indicators CNN publishes alongside the overall score, in CNN's
// own display order. Ids are canonical (proxy maps CNN's raw keys —
// e.g. market_momentum_sp500, market_volatility_vix — onto these) so the
// client never needs to know CNN's internal naming.
export const FEAR_GREED_INDICATOR_IDS = Object.freeze([
  'market_momentum',
  'stock_price_strength',
  'stock_price_breadth',
  'put_call_options',
  'market_volatility',
  'safe_haven_demand',
  'junk_bond_demand',
]);

export const FEAR_GREED_INDICATOR_LABELS_HE = Object.freeze({
  market_momentum: 'תנופת השוק',
  stock_price_strength: 'חוזק מחירי המניות',
  stock_price_breadth: 'רוחב שוק המניות',
  put_call_options: 'אופציות Put/Call',
  market_volatility: 'תנודתיות השוק',
  safe_haven_demand: 'ביקוש לחוף מבטחים',
  junk_bond_demand: 'ביקוש לאג״ח זבל',
});

// Concise Hebrew summaries — not translations of CNN's own paragraphs.
export const FEAR_GREED_INDICATOR_TOOLTIPS_HE = Object.freeze({
  market_momentum: 'משווה את S&P 500 לממוצע הנע של 125 ימי מסחר. מעל הממוצע נוטה להעיד על תאווה; מתחתיו על פחד.',
  stock_price_strength: 'משווה בין מניות בשיא ובשפל של 52 שבועות ב־NYSE. יותר שיאים מעידים בדרך כלל על תאווה.',
  stock_price_breadth: 'בוחן את היקף המסחר במניות עולות לעומת יורדות. השתתפות רחבה בעליות מעידה על שוק חזק יותר.',
  put_call_options: 'בוחן את היחס בין אופציות מכר לרכש. יחס עולה או גבוה מעיד בדרך כלל על חשש גובר.',
  market_volatility: 'משווה את ה־VIX לממוצע הנע של 50 יום. תנודתיות עולה נוטה להעיד על פחד.',
  safe_haven_demand: 'משווה את תשואות המניות והאג״ח ב־20 ימי המסחר האחרונים. העדפת אג״ח מעידה בדרך כלל על פחד.',
  junk_bond_demand: 'בוחן את פער התשואות בין אג״ח זבל לאג״ח בדירוג השקעה. פער קטן מעיד על נכונות גבוהה יותר לקחת סיכון.',
});

// Single source of truth for the 5-state color mapping. FearGreedScoreCard.jsx
// intentionally stays import-free (see scripts/fear-greed-score-card-qa.mjs),
// so it re-declares the same literal Tailwind colors locally for its score
// badge and bottom scale — keep both in sync with this list if it ever changes:
//   Extreme Fear -> red-500, Fear -> orange-400, Neutral -> amber-300,
//   Greed -> lime-400, Extreme Greed -> emerald-500.
export const FEAR_GREED_RATING_STYLES = Object.freeze({
  'extreme fear': { labelHe: 'פחד קיצוני', dotCls: 'bg-red-500', textCls: 'text-red-700 dark:text-red-400' },
  fear: { labelHe: 'פחד', dotCls: 'bg-orange-400', textCls: 'text-orange-700 dark:text-orange-400' },
  neutral: { labelHe: 'ניטרלי', dotCls: 'bg-amber-300', textCls: 'text-amber-700 dark:text-amber-400' },
  greed: { labelHe: 'תאווה', dotCls: 'bg-lime-400', textCls: 'text-lime-700 dark:text-lime-400' },
  'extreme greed': { labelHe: 'תאווה קיצונית', dotCls: 'bg-emerald-500', textCls: 'text-emerald-700 dark:text-emerald-400' },
});

export function normalizeCnnRatingKey(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return Object.hasOwn(FEAR_GREED_RATING_STYLES, key) ? key : null;
}

// Same boundaries as FEAR_GREED_ZONES in FearGreedScoreCard.jsx (duplicated
// there for the same import-free reason as the color mapping above) — used
// to classify the *overall* score into one of the 5 rating keys, since CNN's
// raw "rating" string for the overall score isn't used by this app (the
// score-derived classification is treated as the single source of truth).
const FEAR_GREED_SCORE_ZONES = Object.freeze([
  { min: 0, max: 24, ratingKey: 'extreme fear' },
  { min: 25, max: 44, ratingKey: 'fear' },
  { min: 45, max: 55, ratingKey: 'neutral' },
  { min: 56, max: 75, ratingKey: 'greed' },
  { min: 76, max: 100, ratingKey: 'extreme greed' },
]);

export function ratingKeyForScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) return null;
  return FEAR_GREED_SCORE_ZONES.find((zone) => score >= zone.min && score <= zone.max)?.ratingKey ?? null;
}

// Concise, general interpretation of what each zone conventionally signals —
// not a per-score custom analysis, and not investment advice (see
// FEAR_GREED_DISCLAIMER_HE below).
export const FEAR_GREED_ZONE_INTERPRETATION_HE = Object.freeze({
  'extreme fear': 'פחד קיצוני עשוי להעיד על ירידות חדות ובהלה מוגברת בקרב משקיעים.',
  fear: 'פחד עשוי להעיד על זהירות מוגברת וחשש גובר בקרב משקיעים.',
  neutral: 'מצב מאוזן יחסית, ללא נטייה ברורה לפחד או לתאווה.',
  greed: 'תאווה עשויה להעיד על אופטימיות גוברת ולעיתים תמחור-יתר.',
  'extreme greed': 'תאווה קיצונית עשויה להעיד על אופוריה ותמחור-יתר משמעותי בשוק.',
});

export const FEAR_GREED_OVERALL_EXPLANATION_HE =
  'המדד משקלל 7 אינדיקטורים כדי לאמוד עד כמה משקיעים נסחפים כרגע אחר פחד או אחר תאווה, ביחס להתנהגות רגילה של השוק.';

export const FEAR_GREED_DISCLAIMER_HE =
  'מדד זה משקף סנטימנט משקיעים בלבד ואינו מהווה ייעוץ השקעות.';

function toIsoOrNull(value) {
  if (typeof value === 'string') {
    return !Number.isNaN(Date.parse(value)) ? value : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function normalizeComparisonScore(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 100 ? Math.round(num) : null;
}

function normalizeIndicatorEntry(entry) {
  const score = Number(entry?.score);
  const ratingKey = normalizeCnnRatingKey(entry?.rating);
  if (!Number.isFinite(score) || score < 0 || score > 100 || !ratingKey) return null;
  return {
    score: Math.round(score),
    ratingKey,
    updatedAt: toIsoOrNull(entry?.updatedAt ?? entry?.timestamp),
  };
}

export function normalizeCnnFearGreedPayload(raw) {
  const score = Number(raw?.fear_and_greed?.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;

  const updatedAt = toIsoOrNull(raw?.fear_and_greed?.timestamp);

  const indicators = {};
  for (const id of FEAR_GREED_INDICATOR_IDS) {
    // A missing or malformed sub-indicator never blocks the overall score,
    // and is never guessed — it just renders as unavailable (null).
    indicators[id] = normalizeIndicatorEntry(raw?.indicators?.[id]);
  }

  return {
    // CNN's own page displays the whole-number score (e.g. 54.51 -> "55"),
    // and FearGreedScoreCard renders it as a bare integer in a fixed-size
    // badge — round the same way so the two never visibly disagree.
    score: Math.round(score),
    updatedAt,
    indicators,
    // Each is null unless CNN's payload explicitly supplied it — never
    // estimated, never carried over from a previous fetch.
    previousClose: normalizeComparisonScore(raw?.fear_and_greed?.previousClose),
    previousWeek: normalizeComparisonScore(raw?.fear_and_greed?.previousWeek),
    previousMonth: normalizeComparisonScore(raw?.fear_and_greed?.previousMonth),
    previousYear: normalizeComparisonScore(raw?.fear_and_greed?.previousYear),
    source: 'cnn',
  };
}

export function formatFearGreedUpdatedAt(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

// Time-only, for "last checked" — distinct from formatFearGreedUpdatedAt,
// which formats CNN's own index timestamp (when CNN recalculated the
// score). This one formats fetchedAt: when the app itself last called the
// proxy, regardless of whether CNN's own number changed.
export function formatFearGreedCheckedAtTime(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}
