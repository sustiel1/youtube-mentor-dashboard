// functions.js — Frontend callers for AI analysis
//
// DEV  (localhost):  calls Vite dev-server middleware → Gemini
//                    GEMINI_API_KEY stays in .env, never sent to browser
//
// PROD (Base44):     calls Base44 backend function "AnalyzeVideo"
//                    deploy /backend/analyze-video.function.js to Base44 platform

import { base44 } from './base44Client';

/**
 * Analyze a video using Gemini AI.
 *
 * @param {{ videoId: string, title: string, description?: string, keyPoints?: string[] }} params
 * @returns {Promise<{ shortSummary: string, fullSummary: string, keyPoints: string[], tags: string[], videoTopics: {title:string, timestampSeconds:number, timestampLabel:string}[] }>}
 */
export async function analyzeVideoWithAI({ videoId, title, description = '', keyPoints = [] }) {

  // 1. Try Base44 backend function (works in both dev and production)
  try {
    const result = await base44.functions.AnalyzeVideo({ videoId });
    if (result?.shortSummary) return result;
  } catch (e) {
    console.warn('[AI] AnalyzeVideo unavailable — falling back to dev proxy', e.message);
  }

  // 2. Fallback: Vite dev server proxy (only works in development)
  const res = await fetch('/api/analyze-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, title, description, keyPoints }),
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
