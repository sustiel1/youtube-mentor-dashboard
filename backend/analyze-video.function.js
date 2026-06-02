/**
 * Base44 Backend Function: AnalyzeVideo
 *
 * Env:
 * - ANTHROPIC_API_KEY or VITE_ANTHROPIC_API_KEY
 * - Optional: ANTHROPIC_MODEL
 */

const TRANSCRIPT_CHAR_LIMIT = 8_000;
const CLAUDE_MAX_TOKENS = 3_000;

function buildPrompt({ title, transcript, durationSeconds, mentor, category, chaptersTarget }) {
  return [
    'נתח את התמלול הבא בלבד והחזר JSON בלבד, בלי markdown ובלי טקסט נוסף.',
    'שמור על תשובה קצרה ויציבה. אל תחזיר brainSummary, markdown, או שדות ארוכים שלא נתבקשו.',
    'החזר רק את השדות הבאים ובאותו סדר.',
    'shortSummary: 2-3 משפטים.',
    'fullSummary: 4-6 משפטים.',
    'keyPoints: עד 5 פריטים.',
    `chapters: בערך ${chaptersTarget} פרקים שמכסים את כל הסרטון.`,
    'mainLesson: משפט קצר אחד.',
    'keyInsights: עד 4 פריטים.',
    'rules: עד 4 פריטים.',
    'actionItems: עד 4 פריטים.',
    'mistakesToAvoid: עד 4 פריטים.',
    'strategyOrMethod: משפט קצר אחד או מחרוזת ריקה.',
    'tags: עד 4 תגיות.',
    'אם אין מספיק חומר לשדה מסוים, החזר מערך ריק או מחרוזת ריקה.',
    'כל כותרת פרק חייבת להיות ספציפית ולא גנרית.',
    'אם אין timestamps בתמלול, הערך זמנים לפי התקדמות הטקסט.',
    '',
    `כותרת: ${title}`,
    mentor ? `מנטור: ${mentor}` : null,
    category ? `קטגוריה: ${category}` : null,
    Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0
      ? `משך סרטון בשניות: ${Math.floor(Number(durationSeconds))}`
      : null,
    '',
    'החזר רק JSON בפורמט הבא:',
    JSON.stringify({
      shortSummary: '...',
      fullSummary: '...',
      keyPoints: ['...'],
      chapters: [
        {
          title: '...',
          startSeconds: 0,
          endSeconds: 120,
          summary: '...',
          keyPoints: ['...'],
        },
      ],
      mainLesson: '...',
      keyInsights: ['...'],
      rules: ['...'],
      actionItems: ['...'],
      mistakesToAvoid: ['...'],
      strategyOrMethod: '...',
      tags: ['...'],
    }, null, 2),
    '',
    'אל תחזיר שום שדה נוסף.',
    'Transcript:',
    String(transcript || '').trim(),
  ].filter(Boolean).join('\n');
}

function extractJsonParseDiagnostics(text, error) {
  const message = String(error?.message || '');
  const match = message.match(/position\s+(\d+)/i);
  const position = match ? Number(match[1]) : null;
  const windowStart = Number.isFinite(position) ? Math.max(0, position - 120) : 0;
  const windowEnd = Number.isFinite(position) ? Math.min(text.length, position + 120) : Math.min(text.length, 240);

  return {
    parseError: message,
    parseErrorPosition: Number.isFinite(position) ? position : null,
    parseErrorSnippet: text.slice(windowStart, windowEnd),
  };
}

function parseClaudeJson(rawText) {
  const text = String(rawText || '').trim();
  const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const wrapped = new Error('Claude returned invalid JSON. Try Gemini or reduce transcript length.');
    wrapped.code = 'CLAUDE_INVALID_JSON';
    wrapped.status = 502;
    wrapped.diagnostics = extractJsonParseDiagnostics(cleaned, error);
    throw wrapped;
  }
}

async function callClaude(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error = new Error('Missing ANTHROPIC_API_KEY');
    error.code = 'CLAUDE_API_KEY_MISSING';
    throw error;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || 'Claude request failed');
    error.code = 'CLAUDE_ERROR';
    error.status = response.status;
    throw error;
  }

  return data;
}

async function handler(
  {
    videoId,
    transcript = '',
    title = '',
    durationSeconds = 0,
    mentor = null,
    category = null,
  },
  { entities }
) {
  const videos = await entities.Video.filter({ _id: videoId });
  const video = videos[0];
  if (!video) throw new Error(`Video not found: ${videoId}`);

  const transcriptText = String(transcript || video.transcript || '').trim().slice(0, TRANSCRIPT_CHAR_LIMIT);
  if (!transcriptText) {
    console.error('[Claude] transcript missing', {
      videoId,
      responseLength: 0,
      repairAttempted: false,
      transcriptUsed: false,
      chapterSource: 'description_only',
    });
    const error = new Error('Transcript required');
    error.code = 'TRANSCRIPT_REQUIRED';
    throw error;
  }

  const prompt = buildPrompt({
    title: title || video.title || '',
    transcript: transcriptText,
    durationSeconds,
    mentor,
    category,
    chaptersTarget: durationSeconds > 0 ? (durationSeconds <= 14 * 60 ? 5 : durationSeconds <= 22 * 60 ? 7 : 8) : 6,
  });

  const selectedModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  console.log('[Claude] request started', {
    videoId,
    model: selectedModel,
    transcriptChars: transcriptText.length,
    promptChars: prompt.length,
    transcriptUsed: true,
    chapterSource: 'transcript',
  });

  const result = await callClaude({
    model: selectedModel,
    max_tokens: CLAUDE_MAX_TOKENS,
    temperature: 0.1,
    system: [
      'Return ONLY valid JSON.',
      'Do not wrap the output in Markdown code fences.',
      'Your entire response must be a single JSON object that starts with "{" and ends with "}".',
    ].join('\n'),
    messages: [
      { role: 'user', content: prompt },
    ],
  });

  const text = Array.isArray(result?.content)
    ? result.content.filter((item) => item?.type === 'text').map((item) => item.text || '').join('\n')
    : '';

  console.log('[Claude] response received', {
    videoId,
    responseLength: text.length,
    repairAttempted: false,
    transcriptUsed: true,
    chapterSource: 'transcript',
  });

  const analysis = parseClaudeJson(text);

  await entities.Video.update(videoId, {
    shortSummary: analysis.shortSummary || null,
    fullSummary: analysis.fullSummary || null,
    tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    status: 'done',
  });

  return {
    ...analysis,
    provider: 'claude',
    model: selectedModel,
    isFallback: false,
  };
}

module.exports = { handler };
