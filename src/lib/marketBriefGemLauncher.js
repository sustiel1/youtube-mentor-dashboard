import { getMarketBriefSessionDisplay, resolveMarketBriefSession } from '@/lib/marketBriefSession';

export const MARKET_BRIEF_GEM = Object.freeze({
  key: 'news',
  labelHe: 'מבזק בוקר / ערב',
  url: 'https://gemini.google.com/gem/1CN2KyVNHZalbhNR6rqCcztivoHcl4ySx?usp=sharing',
});

const normalize = (value) => String(value || '').trim().toLowerCase();

function hasConfirmedNonBriefClassification(video) {
  if (!video?.userConfirmedSubCategory) return false;
  const confirmed = normalize(video?.confirmedSubCategory).replace(/[\s_]+/g, '-');
  return Boolean(confirmed) && ![
    'marketbrief', 'market-brief', 'morningbrief', 'morning-brief',
    'eveningbrief', 'evening-brief', 'מבזק-בוקר', 'מבזק-ערב',
  ].includes(confirmed);
}

export function resolveMarketBriefLaunchContext({
  video,
  videoType,
  tabsKey,
  contentType,
  marketBriefData,
  manualSession,
} = {}) {
  if (hasConfirmedNonBriefClassification(video)) {
    return { isMarketBrief: false, session: 'unknown', source: 'confirmed-non-brief' };
  }

  const sessionVideo = manualSession ? { ...video, briefType: manualSession } : video;
  const resolved = resolveMarketBriefSession(sessionVideo, marketBriefData);
  const normalizedVideoType = normalize(videoType || video?.videoType);
  const normalizedTabsKey = normalize(tabsKey || video?.tabsKey);
  const normalizedContentType = normalize(contentType || marketBriefData?.contentType || video?.contentType);
  const isMarketBrief = resolved.session !== 'unknown'
    || normalizedContentType === 'marketbrief'
    || normalizedTabsKey === 'morningbrief'
    || ['morningbrief', 'eveningbrief'].includes(normalizedVideoType);

  return { isMarketBrief, session: resolved.session, source: resolved.source };
}

export function resolveGemLaunchUrl({ isMarketBrief, selectedGemUrl } = {}) {
  return isMarketBrief ? MARKET_BRIEF_GEM.url : String(selectedGemUrl || '').trim();
}

export function buildMarketBriefGemPayload({ video, fullTranscriptText, session }) {
  const display = getMarketBriefSessionDisplay(session);
  const explicitUrl = String(video?.url || video?.videoUrl || video?.youtubeUrl || '').trim();
  const youtubeId = String(video?.youtubeId || '').trim();
  const videoUrl = explicitUrl || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : '');

  return [
    'VIDEO TITLE:',
    String(video?.title || '').trim(),
    '',
    'VIDEO URL:',
    videoUrl,
    '',
    'BRIEF SESSION:',
    session,
    '',
    'MARKET PHASE:',
    display.context,
    '',
    'TRANSCRIPT:',
    String(fullTranscriptText || ''),
  ].join('\n');
}
