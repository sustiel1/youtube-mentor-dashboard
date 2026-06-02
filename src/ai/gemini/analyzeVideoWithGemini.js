/**
 * Client-side dispatcher for Gemini video analysis.
 * Routes to the correct prompt/schema/validator per contentType.
 * Actual Gemini API calls happen server-side via /api/gemini-video-content.
 *
 * contentType values: 'general' | 'political' | 'market'
 */

export const CONTENT_TYPES = {
  GENERAL: 'general',
  POLITICAL: 'political',
  MARKET: 'market',
};

/**
 * Detects the most likely contentType from video metadata.
 * Used when contentType is not explicitly provided.
 */
export function detectContentType({ category, tags = [], title = '', contentType } = {}) {
  if (contentType && Object.values(CONTENT_TYPES).includes(contentType)) return contentType;

  const haystack = [category || '', title, ...(tags || [])].join(' ').toLowerCase();

  if (/פוליטיק|political|elections|בחירות|כנסת|ממשלה|מפלגה/i.test(haystack)) {
    return CONTENT_TYPES.POLITICAL;
  }
  if (/stock|market|מניות|בורסה|מסחר|trading|etf|nasdaq|s&p|crypto|ביטקוין|השקעות/i.test(haystack)) {
    return CONTENT_TYPES.MARKET;
  }
  return CONTENT_TYPES.GENERAL;
}

/**
 * Main analysis dispatcher.
 * Sends the transcript and metadata to the server, which routes to the correct Gemini prompt.
 *
 * @param {object} params
 * @param {'general'|'political'|'market'} params.contentType
 * @param {string} params.transcript
 * @param {Array}  params.transcriptSegments
 * @param {string} params.title
 * @param {number} params.duration  - seconds
 * @param {object} params.metadata  - { mentor, category, tags, chapterHints, chaptersTarget, description }
 * @param {AbortSignal} [params.signal]
 */
export async function analyzeVideoWithGemini({
  contentType,
  transcript = '',
  transcriptSegments = [],
  title,
  duration = null,
  metadata = {},
  signal,
}) {
  const resolvedContentType = detectContentType({
    contentType,
    category: metadata.category,
    tags: metadata.tags,
    title,
  });

  const res = await fetch('/api/gemini-video-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contentType: resolvedContentType,
      title,
      description: metadata.description || '',
      durationSeconds: duration,
      mentor: metadata.mentor || null,
      category: metadata.category || null,
      chapterHints: metadata.chapterHints || [],
      chaptersTarget: metadata.chaptersTarget || 6,
      transcriptText: typeof transcript === 'string' ? transcript.trim() : '',
      transcriptSegments,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || 'Gemini analysis failed');
    error.code = data.error || 'GEMINI_ANALYSIS_FAILED';
    error.status = res.status;
    throw error;
  }

  return data;
}
