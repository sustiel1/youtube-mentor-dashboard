export const MARKET_BRIEF_GEM = Object.freeze({
  key: "morning-evening-market-brief",
  labelHe: "מבזק בוקר / ערב",
  descriptionHe: "ניתוח מבזקי שוק לפני פתיחת המסחר ואחרי סיום המסחר",
  url: "https://gemini.google.com/gem/1CN2KyVNHZalbhNR6rqCcztivoHcl4ySx?usp=sharing",
  supportedVideoTypes: Object.freeze(["morningBrief", "eveningBrief"]),
  supportedContentTypes: Object.freeze(["marketBrief"]),
});

export const MARKET_BRIEF_GEM_URL = MARKET_BRIEF_GEM.url;
export const MARKET_BRIEF_GEM_NAME = MARKET_BRIEF_GEM.labelHe;

const MORNING_SIGNALS = [
  "מבזק בוקר",
  "מבזק פתיחה",
  "מבזק לייב פתיחה",
  "פתיחת מסחר",
  "לפני המסחר",
  "פרימרקט",
  "morning brief",
  "market open",
  "opening bell",
];

const EVENING_SIGNALS = [
  "מבזק ערב",
  "לייט נייט",
  "לייטנייט",
  "סיכום יום המסחר",
  "סיכום יום",
  "סיכום מסחר",
  "אחרי המסחר",
  "לאחר יום המסחר",
  "נעילת מסחר",
  "after market",
  "after hours",
  "late night",
  "נעילה",
  "closing brief",
  "market close",
];

const MORNING_EMPHASIS = [
  "futures and major-index direction",
  "pre-market movers",
  "overnight macro developments",
  "today's economic calendar",
  "sector leadership and weakness",
  "verified opportunities and risks",
  "support, resistance and invalidation levels",
  "catalysts expected during the session",
];

const EVENING_EMPHASIS = [
  "actual closing performance",
  "market breadth",
  "sector winners and losers",
  "stocks that moved and why",
  "earnings and after-hours developments",
  "risks revealed during the session",
  "lessons from the completed trading day",
  "levels and catalysts for the next session",
];

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function includesAny(value, signals) {
  const text = normalized(value);
  return signals.some((signal) => text.includes(signal));
}

function hasExplicitNonBriefConfirmation(video) {
  if (!video?.userConfirmedSubCategory) return false;
  const confirmed = normalized(video?.confirmedSubCategory);
  return Boolean(confirmed)
    && !includesAny(confirmed, [...MORNING_SIGNALS, ...EVENING_SIGNALS])
    && !["morning-brief", "evening-brief", "marketbrief"].includes(confirmed);
}

export function isCanonicalMarketBrief({ video, videoType, tabsKey, contentType } = {}) {
  const explicitContentType = normalized(contentType || video?.contentType || video?.analysis?.contentType);
  const explicitVideoType = normalized(video?.videoType || videoType);
  const explicitTabsKey = normalized(tabsKey || video?.tabsKey);

  if (hasExplicitNonBriefConfirmation(video)) return false;

  const title = video?.title || "";
  return includesAny(title, [...MORNING_SIGNALS, ...EVENING_SIGNALS])
    || explicitContentType === "marketbrief"
    || explicitTabsKey === "morningbrief"
    || ["morningbrief", "eveningbrief", "close"].includes(explicitVideoType);
}

export function resolveMarketBriefSession({ video, videoType, structuredData, manualSession } = {}) {
  const explicitSession = normalized(manualSession || video?.briefType || video?.briefSession || video?.analysis?.briefType);
  if (explicitSession === "morning" || explicitSession === "evening") {
    return buildSession(explicitSession, manualSession ? "manual" : "explicit", "high");
  }

  const explicitMarketSession = normalized(video?.marketSession || video?.marketPhase || video?.analysis?.marketSession);
  if (["before-market", "pre-market", "premarket"].includes(explicitMarketSession)) return buildSession("morning", "explicit", "high");
  if (["after-market", "post-market", "afterhours", "close"].includes(explicitMarketSession)) return buildSession("evening", "explicit", "high");

  const structuredBriefType = normalized(structuredData?.briefType || structuredData?.briefSession);
  if (structuredBriefType === "morning" || structuredBriefType === "evening") {
    return buildSession(structuredBriefType, "stored", "high");
  }
  const structuredSession = normalized(structuredData?.marketSession || structuredData?.marketPhase);
  if (["before-market", "pre-market", "premarket"].includes(structuredSession)) return buildSession("morning", "stored", "high");
  if (["after-market", "post-market", "afterhours", "close"].includes(structuredSession)) return buildSession("evening", "stored", "high");

  const title = video?.title || "";
  if (includesAny(title, MORNING_SIGNALS)) return buildSession("morning", "title", "high");
  if (includesAny(title, EVENING_SIGNALS)) return buildSession("evening", "title", "high");

  const detectedVideoType = normalized(videoType);
  if (detectedVideoType === "morningbrief") return buildSession("morning", "stored", "high");
  if (["eveningbrief", "close"].includes(detectedVideoType)) return buildSession("evening", "stored", "high");

  const explicitVideoType = normalized(video?.videoType);
  if (explicitVideoType === "morningbrief") return buildSession("morning", "stored", "high");
  if (["eveningbrief", "close"].includes(explicitVideoType)) return buildSession("evening", "stored", "high");

  return {
    briefType: "unknown",
    marketSession: "unknown",
    labelHe: "מבזק בוקר / ערב",
    phaseLabelHe: "מועד המסחר לא זוהה",
    icon: "📰",
    classificationSource: "fallback",
    confidence: null,
  };
}

function buildSession(briefType, classificationSource, confidence) {
  const morning = briefType === "morning";
  return {
    briefType,
    marketSession: morning ? "before-market" : "after-market",
    labelHe: morning ? "מבזק בוקר" : "מבזק ערב",
    phaseLabelHe: morning ? "לפני פתיחת המסחר" : "לאחר יום המסחר",
    icon: morning ? "🌅" : "🌙",
    classificationSource,
    confidence,
  };
}

export function buildMarketBriefGemPayload({ video, fullTranscriptText, session }) {
  const resolved = session || resolveMarketBriefSession({ video });
  const emphasis = resolved.briefType === "morning"
    ? MORNING_EMPHASIS
    : resolved.briefType === "evening"
      ? EVENING_EMPHASIS
      : [];

  return [
    "VIDEO TITLE:",
    String(video?.title || "").trim(),
    "",
    "VIDEO URL:",
    resolveVideoUrl(video),
    "",
    "RECORDING DATE:",
    String(video?.publishedAt || video?.publishDate || video?.date || video?.recordingDate || "").trim(),
    "",
    "TIMEZONE:",
    "Asia/Jerusalem",
    "",
    "BRIEF SESSION:",
    resolved.briefType,
    "",
    "MARKET PHASE:",
    resolved.marketSession,
    "",
    "ANALYSIS EMPHASIS:",
    ...emphasis.map((item) => `- ${item}`),
    "",
    "TRANSCRIPT:",
    String(fullTranscriptText || ""),
  ].join("\n");
}

export function openCanonicalMarketBriefGem() {
  if (typeof window === "undefined" || typeof window.open !== "function") return false;
  return Boolean(window.open(MARKET_BRIEF_GEM.url, "_blank", "noopener,noreferrer"));
}

function resolveVideoUrl(video) {
  const explicitUrl = String(video?.url || video?.videoUrl || video?.youtubeUrl || "").trim();
  if (explicitUrl) return explicitUrl;
  const youtubeId = String(video?.youtubeId || "").trim();
  return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "";
}
