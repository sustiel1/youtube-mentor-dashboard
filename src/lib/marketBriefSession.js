const MORNING_MARKET_BRIEF_SIGNALS = [
  'מבזק בוקר',
  'מבזק לייב פתיחה',
  'מבזק פתיחה',
  'פתיחת מסחר',
  'פתיחת שוק',
  'סקירת בוקר',
  'morning brief',
  'market open',
  'opening brief',
  'opening bell',
  'premarket',
  'pre-market',
];

const EVENING_MARKET_BRIEF_SIGNALS = [
  'לייט נייט',
  'לייטנייט',
  'מבזק ערב',
  'סיכום מסחר',
  'סיכום יום',
  'סיכום יום המסחר',
  'נעילת מסחר',
  'סגירת שוק',
  'סקירת ערב',
  'late night',
  'closing brief',
  'market close',
  'evening brief',
  'after market',
  'after hours',
];

const normalize = (value) => String(value || '').trim().toLowerCase();
const includesAny = (value, signals) => signals.some((signal) => value.includes(signal));

function normalizeExplicitSession(value) {
  const normalized = normalize(value).replace(/[\s_]+/g, '-');
  if (['morning', 'morningbrief', 'morning-brief', 'before-market', 'premarket', 'opening'].includes(normalized)) {
    return 'morning';
  }
  if (['evening', 'eveningbrief', 'evening-brief', 'late-night', 'after-market', 'afterhours', 'after-hours', 'closing'].includes(normalized)) {
    return 'evening';
  }
  return null;
}

/** Resolve a market-brief session without using publication time or mentor identity. */
export function resolveMarketBriefSession(video, marketBriefData = null) {
  const explicitCandidates = [
    video?.briefType,
    video?.marketSession,
    video?.videoType,
    video?.analysis?.briefType,
    video?.analysis?.marketSession,
    video?.analysis?.videoType,
    marketBriefData?.briefType,
    marketBriefData?.marketSession,
    marketBriefData?.videoType,
  ];
  for (const candidate of explicitCandidates) {
    const session = normalizeExplicitSession(candidate);
    if (session) return { session, source: 'explicit' };
  }

  const title = normalize(video?.title);
  if (includesAny(title, EVENING_MARKET_BRIEF_SIGNALS)) return { session: 'evening', source: 'title' };
  if (includesAny(title, MORNING_MARKET_BRIEF_SIGNALS)) return { session: 'morning', source: 'title' };
  return { session: 'unknown', source: 'fallback' };
}

export function getMarketBriefSessionDisplay(session) {
  if (session === 'morning') {
    return { videoType: 'morningBrief', slug: 'morning-brief', gemLabel: 'מבזק בוקר', context: 'לפני פתיחת המסחר' };
  }
  if (session === 'evening') {
    return { videoType: 'eveningBrief', slug: 'evening-brief', gemLabel: 'מבזק ערב', context: 'לאחר יום המסחר' };
  }
  return { videoType: null, slug: null, gemLabel: 'מבזק בוקר / ערב', context: 'מועד המסחר לא זוהה' };
}

/** Preserve explicit subcategory routing and the legacy generic marketBrief fallback. */
export function resolveMarketBriefSlug({ video, marketBriefData, normalizedSubCategory } = {}) {
  if (normalizedSubCategory) return normalizedSubCategory;
  const { session } = resolveMarketBriefSession(video, marketBriefData);
  const resolved = getMarketBriefSessionDisplay(session).slug;
  if (resolved) return resolved;
  if (normalize(marketBriefData?.contentType) === 'marketbrief') return 'morning-brief';
  return null;
}

export const MARKET_BRIEF_SESSION_SIGNALS = Object.freeze({
  morning: [...MORNING_MARKET_BRIEF_SIGNALS],
  evening: [...EVENING_MARKET_BRIEF_SIGNALS],
});
