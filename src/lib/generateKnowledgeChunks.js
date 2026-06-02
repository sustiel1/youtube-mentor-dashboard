import { resolveCanonicalChapters } from '@/services/videoAnalytics';
import { getSegments, extractExcerpt } from './localSegmentStore';

function toTimestampLabel(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function generateKnowledgeChunks(video) {
  if (!video?.analyzedAt) return [];

  const { chapters, chapterSource, chapterQuality } = resolveCanonicalChapters(video);
  if (!Array.isArray(chapters) || chapters.length === 0) return [];

  const videoId = video.videoId || video.id;
  const tags = Array.isArray(video.tags) ? video.tags
    : Array.isArray(video.aiTags) ? video.aiTags
    : [];
  const transcriptQuality = video.transcriptQuality || 'none';
  const createdAt = new Date().toISOString();
  const segments = getSegments(videoId);

  return chapters.map((chapter, idx) => {
    const startSeconds = Number.isFinite(chapter.startSeconds) ? chapter.startSeconds : null;
    const endSeconds = Number.isFinite(chapter.endSeconds) ? chapter.endSeconds : null;
    return {
      id: `${videoId}_ch${idx}`,
      videoId,
      chapterIndex: idx,
      title: chapter.title || chapter.name || `פרק ${idx + 1}`,
      summary: chapter.description || chapter.summary || chapter.content || '',
      startSeconds,
      endSeconds,
      timestampLabel: toTimestampLabel(startSeconds),
      source: chapterSource,
      transcriptExcerpt: extractExcerpt(segments, startSeconds, endSeconds),
      transcriptQuality,
      chapterQuality,
      tags,
      createdAt,
    };
  });
}
