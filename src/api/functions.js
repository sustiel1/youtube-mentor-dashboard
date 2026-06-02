// functions.js — Frontend callers for AI analysis
//
// DEV  (localhost):  calls Vite dev-server middleware → Gemini
//                    GEMINI_API_KEY stays in .env, never sent to browser
//
// PROD (Base44):     calls Base44 backend function "AnalyzeVideo"
//                    deploy /backend/analyze-video.function.js to Base44 platform

import { base44 } from './base44Client';
import { isBase44Enabled } from '@/config/base44Flags';
import { normalizeAiAnalysisResult } from '@/services/videoAnalytics';

/**
 * Analyze a video using Gemini AI.
 *
 * @param {{ videoId: string, title: string, description?: string, keyPoints?: string[] }} params
 * @returns {Promise<{ shortSummary: string, fullSummary: string, keyPoints: string[], tags: string[], videoTopics: {title:string, timestampSeconds:number, timestampLabel:string}[] }>}
 */
export async function analyzeVideoWithAI({
  videoId,
  title,
  description = '',
  keyPoints = [],
  transcript = '',
  transcriptSegments = [],
  durationSeconds = null,
  mentor = null,
  category = null,
  chapterHints = [],
  force = false,
  analysisMode = undefined,
  transcriptStatus = undefined,
  transcriptQuality = undefined,
}) {

  if (isBase44Enabled() && base44) {
    try {
      const result = await base44.functions.AnalyzeVideo({ videoId, transcript, force, analysisMode, transcriptStatus, transcriptQuality });
      const normalized = normalizeAiAnalysisResult(result);
      if (normalized.shortSummary && normalized.chapters.length > 0) return result;
      console.warn('[AI] AnalyzeVideo returned incomplete analysis — falling back to dev proxy');
    } catch (e) {
      console.warn('[AI] AnalyzeVideo unavailable — falling back to dev proxy', e.message);
    }
  }

  // Local-first / fallback: Vite dev server proxy
  const res = await fetch('/api/analyze-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId,
      title,
      description,
      keyPoints,
      transcript,
      transcriptSegments,
      durationSeconds,
      mentor,
      category,
      chapterHints,
      force,
      analysisMode,
      transcriptStatus,
      transcriptQuality,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || 'Gemini request failed');
    err.code   = data.error;
    err.status = res.status;
    throw err;
  }

  return res.json();
}
