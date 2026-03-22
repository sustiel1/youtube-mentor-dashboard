/**
 * Base44 Backend Function: AnalyzeVideo
 *
 * HOW TO DEPLOY:
 * 1. Open your Base44 project → Functions → Create New Function
 * 2. Name it exactly: AnalyzeVideo
 * 3. Paste this code into the function editor
 * 4. Add env var: GEMINI_API_KEY = <your Google AI Studio API key>
 *    (Get a free key at: https://aistudio.google.com/app/apikey)
 * 5. Save & Deploy
 *
 * INPUT:  { videoId: string }
 * OUTPUT: { shortSummary, fullSummary, keyPoints[], tags[] }
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function handler({ videoId }, { entities }) {
  // 1. Fetch the video record from the database
  const videos = await entities.Video.filter({ _id: videoId });
  const video = videos[0];
  if (!video) throw new Error(`Video not found: ${videoId}`);

  // 2. Build the prompt
  const existingPoints = (video.keyPoints || []).join(', ') || 'אין';
  const prompt = `
נתח את הסרטון הבא ותחזיר JSON בלבד, ללא markdown וללא טקסט נוסף.

כותרת: ${video.title}
תיאור: ${video.fullSummary || video.shortSummary || 'אין תיאור'}
נקודות מפתח קיימות: ${existingPoints}

החזר את הפורמט הזה בלבד:
{
  "shortSummary": "תקציר קצר של 2-3 משפטים",
  "fullSummary": "תקציר מפורט של 4-6 משפטים עם תובנות מעשיות",
  "keyPoints": ["נקודה 1", "נקודה 2", "נקודה 3", "נקודה 4"],
  "tags": ["תגית1", "תגית2"]
}
`.trim();

  // 3. Call Gemini (API key stays on backend, never sent to client)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // gemini-1.5-flash is free-tier eligible and fast
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();

  // 4. Parse the JSON response (strip markdown fences if present)
  const cleaned = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  const analysis = JSON.parse(cleaned);

  // 5. Persist results to the Video entity
  await entities.Video.update(videoId, {
    shortSummary: analysis.shortSummary,
    fullSummary:  analysis.fullSummary,
    keyPoints:    analysis.keyPoints,
    tags:         analysis.tags,
    status:       'done',
  });

  // 6. Return to frontend
  return {
    shortSummary: analysis.shortSummary,
    fullSummary:  analysis.fullSummary,
    keyPoints:    analysis.keyPoints,
    tags:         analysis.tags,
  };
}

module.exports = { handler };

// ─── Future extensions ────────────────────────────────────────────────────
// To add transcript support:
//   const transcript = video.transcript || '';
//   // append to prompt: `תמליל: ${transcript}`
//
// To support Files API (video file upload):
//   const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
//   const uploaded = await fileManager.uploadFile(videoBuffer, { mimeType: 'video/mp4' });
//   // use uploaded.file.uri in the model request
