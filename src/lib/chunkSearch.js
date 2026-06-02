const QUALITY_SCORE = { high: 3, medium: 1, low: 0, none: 0 };
const SOURCE_SCORE  = { ai: 3, description: 1, fallback: 0, none: 0 };

function scoreChunk(chunk, mentorName, terms) {
  const title   = (chunk.title || '').toLowerCase();
  const summary = (chunk.summary || '').toLowerCase();
  const mentor  = (mentorName || '').toLowerCase();
  const excerpt = (chunk.transcriptExcerpt || '').toLowerCase();
  const tagStr  = (chunk.tags || []).join(' ').toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term))   score += 10;
    if (tagStr.includes(term))  score += 6;
    if (summary.includes(term)) score += 4;
    if (mentor.includes(term))  score += 3;
    if (excerpt.includes(term)) score += 5;
  }
  if (score === 0) return 0;

  score += QUALITY_SCORE[chunk.transcriptQuality] ?? 0;
  score += QUALITY_SCORE[chunk.chapterQuality]    ?? 0;
  score += SOURCE_SCORE[chunk.source]             ?? 0;

  return score;
}

/**
 * Keyword search over knowledgeChunks with lightweight ranking.
 * @param {string} query
 * @param {{ chunks: Array, videoMap: Object, mentorMap: Object }} opts
 * @returns {Array<{ chunk, video, mentorName, score }>} sorted by score desc
 */
export function searchChunks(query, { chunks, videoMap, mentorMap }) {
  const q = (query || '').trim();
  if (!q) return [];

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];

  for (const chunk of chunks) {
    const video      = videoMap[chunk.videoId] || null;
    const mentorName = video
      ? (mentorMap[video.mentorId] || video.channelTitle || '')
      : '';
    const score = scoreChunk(chunk, mentorName, terms);
    if (score > 0) results.push({ chunk, video, mentorName, score });
  }

  return results.sort((a, b) => b.score - a.score);
}
