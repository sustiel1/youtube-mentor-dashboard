// ─── Video Analytics Service ─────────────────────────────────────────────────
// Local analysis for videos: tags, quality score, summaries, chapters.
// Real description timestamps: UI (youtubeApi + youtubeChapterCache).
// Transcript-based chapters: generateChaptersFromTranscript() — filled only when
// the user runs "Analyze with AI" and a transcript is available (youtubeTranscript).
//
// API:
//   analyzeVideo(video, {force})     → video with aiTags, qualityScore, aiSummaryShort, aiSummaryLong, aiChapters, analyzedAt
//   analyzeVideos(videos)            → batch analyze, skip already-analyzed
//   getDashboardStats(videos, mentors) → KPI stats + topVideos for SmartDashboard

import { extractTimestampsFromDescription } from './youtubeMetadata';

/** Parse a video duration string to seconds. Handles ISO 8601 (PT1H10M25S), MM:SS, H:MM:SS, plain number. */
function parseDurationToSeconds(duration) {
  if (!duration) return 0;
  const s = String(duration);
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':').map(Number);
    return parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
  }
  const iso = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (iso) return (Number(iso[1] || 0) * 3600) + (Number(iso[2] || 0) * 60) + Number(iso[3] || 0);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Structural chapter outline — timestamps estimated from video duration.
 * Each chapter gets startSeconds = index * (durationSec / total) when durationSec > 0.
 */
function estimatedChapters(list, durationSec = 0) {
  const total = list.length;
  return list.map((c, idx) => {
    const secs = durationSec > 0 ? Math.round(idx * durationSec / total) : null;
    return {
      ...c,
      timeSource: 'estimated',
      ...(secs !== null ? { startSeconds: secs, timestamp: formatMmSsFromSeconds(secs) } : {}),
    };
  });
}

// ── Tag detection rules ───────────────────────────────────────────────────────
const TAG_RULES = [
  {
    tags: ['Trading', 'Markets'],
    keywords: [
      'stock', 'trading', 'market', 'trade', 'forex', 'options', 'futures',
      'chart', 'technical', 'price action', 'trend', 'bullish', 'bearish',
      'שוק', 'מסחר', 'מניה', 'בורסה', 'סוחר', 'אנליזה', 'גרף', 'מגמה',
    ],
  },
  {
    tags: ['AI', 'Automation'],
    keywords: [
      'ai', 'artificial intelligence', 'machine learning', 'gpt', 'llm',
      'chatgpt', 'automation', 'bot', 'agent', 'base44', 'claude', 'gemini',
      'cursor', 'בינה', 'אוטומציה', 'אוטומט',
    ],
  },
  {
    tags: ['Dev'],
    keywords: [
      'code', 'coding', 'programming', 'react', 'javascript', 'python',
      'developer', 'api', 'software', 'app', 'web', 'פיתוח', 'קוד', 'תוכנה',
    ],
  },
  {
    tags: ['Strategy'],
    keywords: [
      'strategy', 'plan', 'system', 'method', 'framework', 'rule', 'setup',
      'אסטרטגיה', 'שיטה', 'מערכת', 'כלל', 'תוכנית', 'סטראטגיה',
    ],
  },
  {
    tags: ['Education'],
    keywords: [
      'tutorial', 'course', 'learn', 'beginner', 'guide', 'how to', 'tip',
      'הדרכה', 'קורס', 'למד', 'טיפ', 'שיעור', 'מדריך',
    ],
  },
];

// Category codes from mentor data → display tag
const CATEGORY_TAG_MAP = {
  Markets:    'Trading',
  AI:         'AI',
  Dev:        'Dev',
  Automation: 'Automation',
};

function extractTags(video) {
  const text = ((video.title || '') + ' ' + (video.description || '')).toLowerCase();
  const found = new Set();

  for (const rule of TAG_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      rule.tags.forEach((t) => found.add(t));
    }
  }

  // Category field is a reliable signal — always include it
  if (video.category && CATEGORY_TAG_MAP[video.category]) {
    found.add(CATEGORY_TAG_MAP[video.category]);
  }

  return [...found];
}

function computeQualityScore(video, tags) {
  let score = 5;

  const title = video.title || '';
  const desc  = video.description || '';

  // Title length (sweet spot: 25–90 chars)
  if (title.length >= 25 && title.length <= 90) score += 1;
  if (title.length < 10) score -= 2;

  // Description richness
  if (desc.length > 100) score += 1;
  if (desc.length > 300) score += 1;

  // Engagement signals in title
  if (/\d/.test(title)) score += 0.5;  // numbers
  if (/[?!]/.test(title)) score += 0.5; // question or exclamation

  // Recognized topic → relevant content
  if (tags.length >= 1) score += 0.5;
  if (tags.length >= 2) score += 0.5;

  return Math.min(10, Math.max(1, Math.round(score)));
}

function generateSummaryShort(video, tags) {
  const title = video.title || '';
  const t = title.toLowerCase();

  if (tags.includes('Trading') || tags.includes('Markets')) {
    if (t.includes('?'))
      return `ניתוח מעמיק של שאלה קריטית למסחר: ${title}`;
    if (t.includes('strategy') || t.includes('אסטרטגי') || t.includes('שיטה'))
      return `שיטת מסחר מוכחת — כלים לתכנון עסקאות יעיל: ${title.slice(0, 55)}`;
    if (t.includes('chart') || t.includes('גרף') || t.includes('technical') || t.includes('ניתוח'))
      return `ניתוח טכני בפועל — כיצד לקרוא תנועות שוק: ${title.slice(0, 55)}`;
    return `תובנות מסחר ושוק ההון — גישות מעשיות: ${title.slice(0, 60)}`;
  }
  if (tags.includes('AI') || tags.includes('Automation')) {
    if (t.includes('automation') || t.includes('אוטומציה') || t.includes('n8n') || t.includes('make'))
      return `אוטומציה מלאה — כיצד לייעל תהליכים עם כלים חכמים: ${title.slice(0, 55)}`;
    return `בינה מלאכותית בפועל — יישומים מעשיים: ${title.slice(0, 60)}`;
  }
  if (tags.includes('Dev')) {
    if (t.includes('react') || t.includes('javascript') || t.includes('typescript'))
      return `פיתוח Frontend — קוד נקי וממשק מקצועי: ${title.slice(0, 55)}`;
    return `פיתוח תוכנה — פתרונות טכניים מוכחים: ${title.slice(0, 60)}`;
  }
  return `${title.slice(0, 70)} — תוכן מקצועי ומעשי`;
}

function generateSummaryLong(video, tags) {
  const title = video.title || '';

  if (tags.includes('Trading') || tags.includes('Markets')) {
    return [
      `הסרטון עוסק בניתוח שוק ההון ומציג גישה מעשית ל${title.slice(0, 40)}.`,
      `מתאים לסוחרים ברמת ביניים שמחפשים לחדד שיטות ניתוח וקבלת החלטות.`,
      `תלמד לזהות הזדמנויות בשוק, לנהל סיכונים ולבנות תוכנית מסחר מסודרת.`,
      tags.includes('Strategy')
        ? `נדונות שיטות ספציפיות לבניית מערכת מסחר עקבית עם כללי כניסה ויציאה ברורים.`
        : `הדגש הוא על ניתוח טכני, קריאת תנועות מחיר ופסיכולוגיית מסחר.`,
    ].join('\n');
  }
  if (tags.includes('AI') || tags.includes('Automation')) {
    return [
      `הסרטון סוקר כלי AI ואוטומציה מתקדמים ומדגים כיצד להשתמש בהם בצורה פרקטית.`,
      `מתאים למי שרוצה לשלב בינה מלאכותית בתהליכי עבודה יומיומיים ולחסוך שעות.`,
      `הסרטון מסביר את המושגים הבסיסיים, מציג דוגמאות מהחיים ונותן כלים מיידיים ליישום.`,
      `בסיום הצפייה תדע כיצד לנצל AI לאוטומציה של משימות חוזרות ושיפור תפוקה.`,
    ].join('\n');
  }
  if (tags.includes('Dev')) {
    return [
      `הסרטון מכסה נושאי פיתוח תוכנה ומציג פתרונות קוד מעשיים לבעיות נפוצות.`,
      `מתאים למפתחים שרוצים להרחיב ידע טכני ולאמץ שיטות עבודה טובות יותר.`,
      `הסרטון מציג ארכיטקטורה נכונה, כתיבת קוד נקי ופתרון בעיות שכיחות.`,
      `בסיום הצפייה תקבל כלים מעשיים שניתן ליישם ישירות בפרויקטים אמיתיים.`,
    ].join('\n');
  }
  return [
    `הסרטון מציג תוכן מקצועי ומעשי בנושא ${title.slice(0, 50)}.`,
    `מתאים למי שרוצה ללמוד ולהתפתח בתחום ולרכוש ידע שימושי.`,
    `הסרטון מכסה עקרונות מרכזיים ומציג גישות שניתן ליישם מיד.`,
  ].join('\n');
}

function generateChapters(video, tags) {
  // Real timestamps from the YouTube description (RSS / stored field) — only source for startSeconds
  const desc = typeof video.description === 'string' ? video.description : '';
  const parsed = extractTimestampsFromDescription(desc);
  if (parsed.length > 0) return parsed;

  // Estimated timestamps: divide video duration evenly across chapters
  const durationSec = parseDurationToSeconds(video.duration);
  const t = (video.title || '').toLowerCase();

  if (tags.includes('Trading') || tags.includes('Markets')) {
    if (t.includes('strategy') || t.includes('אסטרטגי') || t.includes('שיטה')) {
      return estimatedChapters([
        { title: 'הבסיס התיאורטי',    description: 'הרקע והמושגים שצריך להבין לפני שמתחילים' },
        { title: 'הגדרת האסטרטגיה',  description: 'הכללים המדויקים — מה לחפש ומתי לפעול' },
        { title: 'ניהול סיכונים',     description: 'הגנה על ההון: stop loss, גודל פוזיציה, יחס R:R' },
        { title: 'יישום בפועל',       description: 'דוגמאות חיות מהשוק עם ניתוח עסקאות אמיתיות' },
        { title: 'שגיאות נפוצות',     description: 'מה להימנע — הטעויות הכי יקרות בשיטה זו' },
      ], durationSec);
    }
    if (t.includes('technical') || t.includes('גרף') || t.includes('chart') || t.includes('ניתוח')) {
      return estimatedChapters([
        { title: 'קריאת הגרף',             description: 'כיצד לפרש תנועות מחיר ומגמות' },
        { title: 'אינדיקטורים מרכזיים',    description: 'הכלים הטכניים החשובים ומה הם מראים' },
        { title: 'זיהוי תבניות',           description: 'תבניות מחיר נפוצות ומה כל אחת מסמלת' },
        { title: 'נקודות כניסה ויציאה',    description: 'מתי בדיוק לפתוח ולסגור פוזיציה' },
      ], durationSec);
    }
    return estimatedChapters([
      { title: 'ניתוח השוק',      description: 'מה קורה בשוק כרגע ולמה זה חשוב' },
      { title: 'זיהוי הזדמנויות', description: 'אינדיקציות לעסקאות פוטנציאליות' },
      { title: 'ניהול סיכונים',   description: 'הגנה על ההשקעה וניהול פוזיציות' },
      { title: 'תוכנית פעולה',   description: 'צעדים מעשיים ליישום מיידי' },
      { title: 'סיכום ומסקנות',  description: 'הנקודות הכי חשובות לזכור' },
    ], durationSec);
  }

  if (tags.includes('AI')) {
    return estimatedChapters([
      { title: 'מבוא לכלי ה-AI',      description: 'מה הכלי עושה ולמה הוא שימושי לך' },
      { title: 'הגדרה ראשונית',       description: 'כיצד להתחיל — שלב אחר שלב' },
      { title: 'Prompt Engineering',  description: 'כיצד לנסח בקשות שמניבות תוצאות מדויקות' },
      { title: 'שימושים מתקדמים',    description: 'טכניקות שמרחיבות את יכולות הכלי' },
      { title: 'יישומים מעשיים',     description: 'דוגמאות מהחיים האמיתיים שניתן לאמץ מיד' },
    ], durationSec);
  }

  if (tags.includes('Automation')) {
    return estimatedChapters([
      { title: 'הגדרת הבעיה',          description: 'מה האוטומציה מחליפה ומה היא חוסכת' },
      { title: 'ארכיטקטורת הפתרון',   description: 'כיצד הזרימה עובדת מקצה לקצה' },
      { title: 'בניית ה-Workflow',     description: 'שלב אחר שלב עם צילומי מסך' },
      { title: 'בדיקה ואיתור שגיאות', description: 'כיצד לוודא שהכל עובד ולטפל בכשלים' },
    ], durationSec);
  }

  if (tags.includes('Dev')) {
    return estimatedChapters([
      { title: 'הגדרת הבעיה',              description: 'מה מנסים לפתור ומדוע זה חשוב' },
      { title: 'ארכיטקטורה ועיצוב',        description: 'כיצד לבנות את הפתרון נכון מהבסיס' },
      { title: 'מימוש',                     description: 'כתיבת הקוד בפועל — ההדגשים הקריטיים' },
      { title: 'בדיקות',                    description: 'ווידוא שהקוד עובד כצפוי בתנאי ייצור' },
      { title: 'Deployment ואופטימיזציה',  description: 'הוצאה לפועל ושיפורי ביצועים' },
    ], durationSec);
  }

  return estimatedChapters([
    { title: 'הקדמה',       description: 'הצגת הנושא והמטרה המרכזית' },
    { title: 'תוכן מרכזי', description: 'הרעיונות והמושגים העיקריים' },
    { title: 'יישום מעשי', description: 'כיצד ליישם את הנלמד בפועל' },
    { title: 'סיכום',       description: 'נקודות מפתח לזכור' },
  ], durationSec);
}

function formatMmSsFromSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function makeTranscriptChunkTitle(blob, idx, videoTitle) {
  const words = blob.split(/\s+/).filter(Boolean);
  let t = words.slice(0, 8).join(' ');
  if (t.length < 4) {
    t = videoTitle ? `חלק ${idx + 1} — ${String(videoTitle).slice(0, 40)}` : `חלק ${idx + 1}`;
  }
  if (t.length > 56) t = `${t.slice(0, 53)}…`;
  return t;
}

/**
 * Build 4–6 navigable chapters from parsed timed transcript lines (local heuristic).
 * Returns null when transcript is too short — caller should keep existing chapter logic.
 *
 * @param {{ lines: { start: number, text: string }[] }} transcript — output of parseTranscript()
 * @param {object} video
 * @returns {{ title: string, description: string, timestamp: string, startSeconds: number, timeSource: "transcript-ai" }[] | null}
 */
export function generateChaptersFromTranscript(transcript, video) {
  const lines = transcript?.lines;
  if (!Array.isArray(lines) || lines.length < 10) return null;

  const fullText = lines.map((l) => l.text).join(' ');
  if (fullText.length < 400) return null;

  const nTarget = Math.min(6, Math.max(4, Math.round(lines.length / 40)));
  const chunk = Math.ceil(lines.length / nTarget);
  const chapters = [];

  for (let i = 0; i < nTarget; i++) {
    const slice = lines.slice(i * chunk, (i + 1) * chunk);
    if (!slice.length) continue;
    const start = slice[0].start;
    const blob = slice.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim();
    if (!blob) continue;
    chapters.push({
      title:        makeTranscriptChunkTitle(blob, i, video?.title),
      description:  blob.length > 220 ? `${blob.slice(0, 217)}…` : blob,
      timestamp:    formatMmSsFromSeconds(start),
      startSeconds: Math.max(0, Math.floor(Number(start) || 0)),
      timeSource:   'transcript-ai',
    });
  }

  return chapters.length >= 2 ? chapters : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function analyzeVideo(video, { force = false } = {}) {
  if (video.analyzedAt && !force) return video;

  const tags           = extractTags(video);
  const qualityScore   = computeQualityScore(video, tags);
  const aiSummaryShort = generateSummaryShort(video, tags);
  const aiSummaryLong  = generateSummaryLong(video, tags);
  const aiChapters     = generateChapters(video, tags);

  return {
    ...video,
    aiTags:         tags,
    qualityScore,
    aiSummaryShort,
    aiSummaryLong,
    aiChapters,
    analyzedAt:     new Date().toISOString(),
  };
}

export function analyzeVideos(videos) {
  return videos.map(analyzeVideo);
}

export function getDashboardStats(videos, mentors = []) {
  if (!videos.length) return null;

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // New today (by fetchedAt)
  const newToday = videos.filter((v) => {
    const d = v.fetchedAt ? new Date(v.fetchedAt) : null;
    return d && d >= todayStart;
  }).length;

  // Most active mentor (most stored videos)
  const mentorCounts = {};
  for (const v of videos) {
    if (v.mentorId) mentorCounts[v.mentorId] = (mentorCounts[v.mentorId] || 0) + 1;
  }
  const topMentorId = Object.entries(mentorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topMentor = {
    name:  mentors.find((m) => m.id === topMentorId)?.name || '—',
    count: mentorCounts[topMentorId] || 0,
  };

  // Average quality score
  const withScore = videos.filter((v) => v.qualityScore != null);
  const avgQuality = withScore.length
    ? Math.round((withScore.reduce((s, v) => s + v.qualityScore, 0) / withScore.length) * 10) / 10
    : 0;

  // Tag distribution (sorted by count)
  const tagCounts = {};
  for (const v of videos) {
    for (const tag of v.aiTags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Top videos by quality score
  const topVideos = [...videos]
    .filter((v) => v.qualityScore != null)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 8);

  return {
    newToday,
    totalSaved: videos.length,
    topMentor,
    avgQuality,
    tagCounts,
    topVideos,
  };
}
