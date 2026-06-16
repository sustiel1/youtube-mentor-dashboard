// ─── Video Analytics Service ─────────────────────────────────────────────────
// Local analysis for videos: tags, quality score, summaries, chapters.
// Real description timestamps: UI (youtubeApi + youtubeChapterCache).
// Transcript-based chapters: generateChaptersFromTranscript() — filled only when
// the user runs "Analyze with AI" and a transcript is available (youtubeTranscript).
//
// API:
//   analyzeVideo(video, {force})     → video with aiTags, qualityScore, aiSummaryShort, aiSummaryLong, aiChapters, analyzedAt
//   analyzeVideos(videos)            → batch analyze, skip already-analyzed
//   getDashboardStats(videos, mentors) → KPI stats (newToday = ingested today, local calendar day)

import { extractChaptersFromDescription, extractTimestampsFromDescription } from './youtubeMetadata';

export function hasNonEmptyChapters(chapters) {
  return Array.isArray(chapters) && chapters.length > 0;
}

/** Parse a video duration string to seconds. Handles ISO 8601 (PT1H10M25S), MM:SS, H:MM:SS, plain number. */
export function parseDurationToSeconds(duration) {
  if (!duration) return 0;
  const s = String(duration).trim().replace(/^[^\dP]+/, '').replace(/[^\d:SPTHM]+$/i, '');
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

export function getVideoDurationSeconds(video) {
  const candidates = [
    video?.duration,
    video?.durationLabel,
    video?.metadata?.duration,
    video?.stats?.duration,
    video?.contentDetails?.duration,
    video?.snippet?.duration,
    video?.analysis?.duration,
  ];
  for (const candidate of candidates) {
    const seconds = parseDurationToSeconds(candidate);
    if (seconds > 0) return seconds;
  }
  return 0;
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
      // No duration → outline only (gray in UI); with duration → estimated orange navigation
      timeSource: secs !== null ? 'estimated' : 'outline',
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

function normalizeTextForOutline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildSummarySnippet(video, fallback) {
  const text = normalizeTextForOutline(
    video?.aiSummaryShort ||
    video?.shortSummary ||
    video?.aiSummaryLong ||
    video?.fullSummary ||
    ''
  );
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function buildContextText(video, tags) {
  return normalizeTextForOutline([
    video?.title,
    video?.description,
    video?.aiSummaryShort,
    video?.shortSummary,
    video?.aiSummaryLong,
    video?.fullSummary,
    video?._channelName,
    video?.mentorName,
    video?.mentor,
    (video?.tags || []).join(' '),
    (video?.aiTags || tags || []).join(' '),
  ].filter(Boolean).join(' ')).toLowerCase();
}

const BURSA_GRAPH_RE = /בורסה גרף/;

function limitChapterPlan(plan, durationSec, desc, video) {
  const longDesc = desc.length >= 700;
  const bursaGraph = BURSA_GRAPH_RE.test(
    `${video?._channelName || ""} ${video?.mentorName || ""} ${video?.mentor || ""}`
  );
  if (bursaGraph) {
    if (durationSec <= 0) return plan.slice(0, longDesc ? 8 : 6);
    if (durationSec <= 8 * 60) return plan.slice(0, 6);
    if (durationSec <= 15 * 60) return plan.slice(0, 7);
    if (durationSec <= 25 * 60) return plan.slice(0, 8);
    if (durationSec <= 40 * 60) return plan.slice(0, 9);
    return plan.slice(0, 10);
  }
  if (durationSec <= 0) return plan.slice(0, longDesc ? 6 : 5);
  if (durationSec <= 8 * 60) return plan.slice(0, 5);
  if (durationSec <= 15 * 60) return plan.slice(0, 6);
  if (durationSec <= 30 * 60) return plan.slice(0, 7);
  return plan.slice(0, 8);
}

function buildMarketsPlan(video, contextText) {
  const summarySnippet = buildSummarySnippet(
    video,
    "מיפוי מהיר של הרעיון המרכזי והקשר לשוק הנוכחי."
  );
  const channelName = video?._channelName || video?.mentorName || "הערוץ";

  return [
    { title: "פתיחה והקשר", description: summarySnippet },
    {
      title: "סקירת שוק ונושא מרכזי",
      description: `מה ${channelName} מדגיש כרגע בשוק, ואיך זה מתחבר לכותרת הסרטון.`,
    },
    {
      title: /s&p|nasdaq|dow|index|מדד/.test(contextText) ? "מדדים ומושגים מרכזיים" : "מניות ומוקדי עניין",
      description: /s&p|nasdaq|dow|index|מדד/.test(contextText)
        ? "מעבר על המדדים, המונחים והאינדיקציות שחוזרים לאורך הסרטון."
        : "מיפוי המניות, הסקטורים או הנכסים שמקבלים פוקוס עיקרי.",
    },
    {
      title: "ניתוח טכני מעמיק",
      description: "פירוק התבניות, הרמות והתרחישים שהסרטון משתמש בהם כדי להסביר את המהלך.",
    },
    {
      title: "סיכונים וניהול סיכונים",
      description: "הנקודות שבהן התרחיש עלול להישבר, ומה חשוב לבדוק לפני החלטה.",
    },
    {
      title: "הזדמנויות ותרחישים",
      description: "איפה עשויות להיווצר הזדמנויות, ואילו תרחישים חיוביים או שליליים עולים מהניתוח.",
    },
    {
      title: "תוכנית פעולה מעשית",
      description: "איך לתרגם את הניתוח למעקב, רשימת בדיקה או פעולה מסודרת.",
    },
    {
      title: "סיכום וצעדים הבאים",
      description: "מה לקחת הלאה מהסרטון ואילו נקודות לעקוב אחריהן בהמשך.",
    },
  ];
}

function buildAiPlan(video) {
  const summarySnippet = buildSummarySnippet(
    video,
    "מסגור הבעיה, הערך של הכלי וההקשר שבו משתמשים בו."
  );
  return [
    { title: "פתיחה והקשר", description: summarySnippet },
    { title: "הבעיה והיעד", description: "מה רוצים לפתור, ולמי הפתרון או האוטומציה מיועדים." },
    { title: "הכלים והסטאק", description: "סקירה של הכלים, המודלים או הפלטפורמות שעליהם הסרטון נשען." },
    { title: "Workflow ויישום", description: "הדגמה של הזרימה המרכזית או השלבים בפועל." },
    { title: "מגבלות וסיכונים", description: "איפה הפתרון נשבר, ומה דורש בדיקה או זהירות לפני שימוש אמיתי." },
    { title: "הזדמנויות לייעול", description: "אילו חלקים אפשר להאיץ, לשפר או להרחיב עם AI." },
    { title: "תוכנית יישום", description: "צעדים ישימים כדי לקחת את הרעיון לסביבת עבודה אמיתית." },
    { title: "סיכום וצעדים הבאים", description: "הנקודות החשובות להמשך והמשך חקירה/ביצוע." },
  ];
}

function buildDevPlan(video) {
  const summarySnippet = buildSummarySnippet(
    video,
    "מסגור הבעיה הטכנית, הכלים המרכזיים ומה ננסה להבין או לבנות."
  );
  return [
    { title: "פתיחה והקשר", description: summarySnippet },
    { title: "הבעיה והדרישות", description: "מה הבעיה הטכנית ומהם התנאים שהפתרון צריך לעמוד בהם." },
    { title: "ארכיטקטורה וסטאק", description: "סקירה של המבנה, הכלים או הספריות שנמצאים במרכז הסרטון." },
    { title: "מימוש וניתוח עומק", description: "הליבה הטכנית של הפתרון, כולל קוד, לוגיקה או החלטות תכנון." },
    { title: "תקלות ומגבלות", description: "איפה יש נקודות שבירות, טעויות נפוצות או trade-offs שצריך להבין." },
    { title: "הזדמנויות ושיפורים", description: "אילו הרחבות, אופטימיזציות או כיווני שיפור עולים מהפתרון." },
    { title: "תוכנית יישום", description: "איך לקחת את הרעיונות מהסרטון ולהחיל אותם בפרויקט אמיתי." },
    { title: "סיכום וצעדים הבאים", description: "מה לזכור, ומה נכון לבדוק או ליישם בהמשך." },
  ];
}

function buildGeneralPlan(video, contextText) {
  const summarySnippet = buildSummarySnippet(
    video,
    "הסרטון מציג את הרעיון המרכזי, ההקשר והנקודות שכדאי להבין כבר בפתיחה."
  );
  return [
    { title: "פתיחה והקשר", description: summarySnippet },
    {
      title: /סקירה|review|overview|market/.test(contextText) ? "סקירה ונושא מרכזי" : "נושא מרכזי ורקע",
      description: "מהו הציר המרכזי של הסרטון ואיך הוא נבנה לאורך הצפייה.",
    },
    { title: "מושגים ונקודות מפתח", description: "המושגים, ההבחנות או הנתונים שחשוב להבין כדי לעקוב." },
    { title: "ניתוח עומק", description: "החלק שבו הרעיון נפתח לעומק דרך דוגמאות, הסברים או פירוק מהלך." },
    { title: "סיכונים ומגבלות", description: "איפה חשוב לשמור על ביקורתיות, ומה עלול להגביל את היישום." },
    { title: "הזדמנויות ויישומים", description: "כיוונים מעשיים או אפשרויות המשך שעולות מתוך התוכן." },
    { title: "תוכנית פעולה", description: "איך לקחת את התובנות ולתרגם אותן לפעולה מסודרת." },
    { title: "סיכום וצעדים הבאים", description: "הנקודות שאיתן יוצאים מהסרטון והמשך הצעדים שכדאי לעשות." },
  ];
}

function generateChapters(video, tags) {
  // Real timestamps from the YouTube description (RSS / stored field) — only source for startSeconds
  const desc = typeof video.description === 'string' ? video.description : '';
  const parsed = extractTimestampsFromDescription(desc);
  if (parsed.length > 0) return parsed;

  // Estimated timestamps: divide video duration evenly across chapters
  const durationSec = getVideoDurationSeconds(video);
  const contextText = buildContextText(video, tags);
  const semanticPlan =
    tags.includes('Trading') || tags.includes('Markets')
      ? buildMarketsPlan(video, contextText)
      : tags.includes('AI') || tags.includes('Automation')
        ? buildAiPlan(video)
        : tags.includes('Dev')
          ? buildDevPlan(video)
          : buildGeneralPlan(video, contextText);
  if (semanticPlan.length > 0) {
    return estimatedChapters(limitChapterPlan(semanticPlan, durationSec, desc, video), durationSec);
  }
  const t = (video.title || '').toLowerCase();

  function targetChapterCount() {
    // Base on duration; if unknown, use description length as a proxy.
    const longDesc = desc.length >= 900;
    const medDesc = desc.length >= 450;
    if (durationSec > 0) {
      if (durationSec <= 8 * 60)  return 6;
      if (durationSec <= 15 * 60) return longDesc ? 10 : 8;
      if (durationSec <= 30 * 60) return longDesc ? 12 : 10;
      if (durationSec <= 60 * 60) return 12;
      return 12;
    }
    if (longDesc) return 10;
    if (medDesc) return 8;
    return 6;
  }

  function keywordOutline() {
    const text = `${video.title || ""}\n${desc}\n${(video.tags || []).join(" ")}\n${(video.aiTags || []).join(" ")}`.toLowerCase();
    const picks = [];
    const seen = new Set();
    const add = (title, description) => {
      const key = String(title || "").trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      picks.push({ title, description });
    };

    // Seed by requested keywords (Hebrew) — order matters
    const rules = [
      { re: /שוק|market|markets/, title: "סקירת שוק", description: "מה קורה בשוק עכשיו ומה המשמעות למשקיעים" },
      { re: /מדד|מדדים|s&p|nasdaq|dow|index/, title: "מדדים מרכזיים", description: "מדדים, מגמות ורמות חשובות" },
      { re: /מניה|מניות|stocks?|equities?/, title: "מניות בולטות", description: "מניות חזקות/חלשות, סקטורים ומוקדי עניין" },
      { re: /ניתוח|analysis|technical|גרף|chart/, title: "ניתוח טכני", description: "תבניות, רמות תמיכה/התנגדות ונקודות מפתח" },
      { re: /תחזית|forecast|צפי|הערכה|outlook/, title: "תחזית והמשך", description: "תרחישים אפשריים ומה לחפש בהמשך" },
      { re: /חדשות|מאקרו|אינפלציה|ריבית|fed|cpi|jobs/, title: "מאקרו וחדשות", description: "נתונים מאקרו/חדשות שיכולים להזיז את השוק" },
      { re: /סיכון|risk|ניהול|סטופ|stop|תיק|portfolio/, title: "ניהול סיכונים", description: "איך לנהל פוזיציות, סטופים וגודל חשיפה" },
      { re: /אסטרטג|strategy|שיטה|setup/, title: "אסטרטגיה וסטאפים", description: "כללי כניסה/יציאה ותכנון מהלכים" },
    ];
    for (const r of rules) {
      if (r.re.test(text)) add(r.title, r.description);
    }

    // If description is long, split into extra “detail” chapters
    if (desc.length >= 700) {
      add("נקודות מפתח מהתיאור", "סיכום מהיר של הנושאים שהוזכרו בתיאור הסרטון");
      add("דוגמאות ותרחישים", "דוגמאות מעשיות / תרחישים והשלכות");
    }

    // Ensure we always have at least a reasonable outline
    if (picks.length === 0) {
      add("הקדמה", "הצגת הנושא והמטרה המרכזית");
      add("תוכן מרכזי", "הרעיונות והמושגים העיקריים");
      add("יישום מעשי", "כיצד ליישם את הנלמד בפועל");
      add("סיכום", "נקודות מפתח לזכור");
    } else {
      // Add intro/outro if missing to improve structure
      add("פתיחה והקשר", "למה זה חשוב ומה נבדוק בסרטון");
      add("סיכום וצעדים הבאים", "מה לקחת מכאן ומה לבדוק בהמשך");
    }

    // Trim/expand to target count
    const target = targetChapterCount();
    if (picks.length > target) return picks.slice(0, target);
    while (picks.length < target) {
      const idx = picks.length + 1;
      add(`העמקה ${idx - Math.min(3, target)}`, "תוספת נושא/דגש משלים לשמירה על רצף הפרקים");
      if (picks.length >= target) break;
    }
    return picks;
  }

  if (tags.includes('Trading') || tags.includes('Markets')) {
    return estimatedChapters(keywordOutline(), durationSec);
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

/**
 * Normalize AI / API payloads that use chapters, sections, topics, or videoTopics.
 * @param {object|null|undefined} result
 * @returns {{ title: string, description: string, startSeconds?: number, timestamp?: string, timeSource?: string }[] | null}
 */
export function chaptersFromAiAnalysisResult(result) {
  if (!result || typeof result !== 'object') return null;

  const normalizeOne = (raw, idx) => {
    if (!raw || typeof raw !== 'object') return null;
    const title =
      raw.title || raw.name || raw.heading || raw.topic || `פרק ${idx + 1}`;
    const description =
      raw.description ||
      raw.summary ||
      raw.summaryText ||
      raw.body ||
      "";
    const summary = String(description || "");
    const keyPoints = Array.isArray(raw.keyPoints)
      ? raw.keyPoints.filter(Boolean).map((point) => String(point).trim()).filter(Boolean)
      : [];
    let startSeconds = raw.startSeconds ?? raw.start_sec ?? raw.timestampSeconds ?? raw.t;
    let endSeconds = raw.endSeconds ?? raw.end_sec ?? raw.endTimestampSeconds ?? raw.end;
    if (typeof startSeconds === "string" && startSeconds.trim() !== "") {
      const n = Number(startSeconds);
      startSeconds = Number.isFinite(n) && n >= 0 ? n : undefined;
    } else if (typeof startSeconds === "number" && Number.isFinite(startSeconds) && startSeconds >= 0) {
      /* keep */
    } else {
      startSeconds = undefined;
    }
    if (typeof endSeconds === "string" && endSeconds.trim() !== "") {
      const n = Number(endSeconds);
      endSeconds = Number.isFinite(n) && n >= 0 ? n : null;
    } else if (typeof endSeconds === "number" && Number.isFinite(endSeconds) && endSeconds >= 0) {
      /* keep */
    } else {
      endSeconds = null;
    }
    const timestamp =
      raw.timestamp ||
      raw.timestampLabel ||
      (startSeconds != null ? formatMmSsFromSeconds(startSeconds) : undefined);
    const base = {
      title,
      description: summary,
      summary,
      keyPoints,
      endSeconds,
      ...(startSeconds != null ? { startSeconds, timestamp } : {}),
      timeSource:
        raw.timeSource ||
        (startSeconds != null ? "transcript" : "outline"),
    };
    return base;
  };

  const keys = ["aiChapters", "chapters", "sections", "topics", "videoTopics"];
  for (const key of keys) {
    const arr = result[key];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const out = arr.map((raw, i) => normalizeOne(raw, i)).filter(Boolean);
    if (out.length > 0) return out;
  }
  return null;
}

function normalizeChapterArray(chapters) {
  if (!Array.isArray(chapters) || chapters.length === 0) return [];
  return chaptersFromAiAnalysisResult({ chapters }) ?? [];
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
      if (typeof value === "string") return cleanAtomicText(value);
      if (value && typeof value === "object") {
        return cleanAtomicText(
          value.summary ||
          value.title ||
          value.text ||
          value.fact ||
          value.insight ||
          value.rule ||
          value.warning ||
          value.point ||
          value.value ||
          value.explanation ||
          ""
        );
      }
      return cleanAtomicText(value);
    })
    .filter(Boolean);
}

/**
 * Normalizes a single learning item (string or structured GEM object).
 * Handles any object shape by: known aliases first, then "join all strings" fallback.
 */
function normalizeLearningItem(value) {
  if (typeof value === 'string') return cleanAtomicText(value);
  if (!value || typeof value !== 'object') return '';

  // term + definition (glossary / definitions tab)
  const term = String(value.term || '').trim();
  const definition = String(value.definition || '').trim();
  if (term && definition) return cleanAtomicText(`${term}: ${definition}`);
  if (definition) return cleanAtomicText(definition);
  if (term) return cleanAtomicText(term);

  // label: name / indicator / pattern / setup + description / usage / details
  const label = String(
    value.name || value.indicator || value.indicatorName ||
    value.pattern || value.patternName ||
    value.setup || value.setupName ||
    value.principle || value.model || value.highlight ||
    value.checklist || value.mistake || value.step || value.item ||
    ''
  ).trim();
  const desc = String(
    value.description || value.desc || value.usage ||
    value.explanation || value.details || value.signal ||
    value.conditions || value.condition || value.note || value.info ||
    ''
  ).trim();
  if (label && desc) return cleanAtomicText(`${label}: ${desc}`);
  if (desc) return cleanAtomicText(desc);
  if (label) return cleanAtomicText(label);

  // single well-known keys
  const single =
    value.summary || value.title || value.text || value.fact ||
    value.insight || value.rule || value.warning || value.point ||
    value.value || value.knowledge || value.takeaway ||
    value.content || value.body || '';
  if (single) return cleanAtomicText(String(single));

  // Last resort: join ALL non-empty string values in the object (order by key)
  const joined = Object.values(value)
    .filter(v => typeof v === 'string' && v.trim())
    .join(': ');
  return cleanAtomicText(joined);
}

/** Like normalizeStringArray but understands learning-field object shapes. */
function normalizeLearningArray(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeLearningItem).filter(Boolean);
}

function normalizeAtomicTags(values) {
  return normalizeStringArray(values).slice(0, 6);
}

// ── Political field normalizers — handle both string[] and Claude-style object[] ──

/** arguments: { claim, evidence, strength }[] | string[] → string[] */
function normalizePoliticalArgList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    if (typeof x === 'string') return x.trim();
    if (x && typeof x === 'object') {
      const claim = String(x.claim || x.text || x.summary || x.title || '').trim();
      const evidence = String(x.evidence || '').trim();
      if (claim && evidence) return `${claim} — ${evidence}`;
      return claim;
    }
    return '';
  }).filter(Boolean);
}

/** counterArguments: { topic, counterArgument }[] | string[] → string[] */
function normalizeCounterArgList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    if (typeof x === 'string') return x.trim();
    if (x && typeof x === 'object') {
      const topic = String(x.topic || '').trim();
      const ca = String(x.counterArgument || x.text || x.summary || '').trim();
      if (topic && ca) return `${topic}: ${ca}`;
      return ca || topic;
    }
    return '';
  }).filter(Boolean);
}

/** socialMediaReplies: { platform, text }[] | string[] → string[] */
function normalizeSocialRepliesList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    if (typeof x === 'string') return x.trim();
    if (x && typeof x === 'object') {
      const platform = String(x.platform || '').trim();
      const text = String(x.text || x.summary || '').trim();
      if (platform && text) return `[${platform}] ${text}`;
      return text || platform;
    }
    return '';
  }).filter(Boolean);
}

/** allPoints / knowledgePoints: { point, fact, insight, rule, warning, text, ... }[] | string[] → string[] */
function normalizeAllPointsList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => {
    if (typeof x === 'string') return x.trim();
    if (x && typeof x === 'object')
      return String(x.point || x.fact || x.insight || x.rule || x.warning || x.text || x.summary || x.title || '').trim();
    return '';
  }).filter(Boolean);
}

function normalizeAtomicConfidence(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["high", "medium", "low"].includes(normalized)) return normalized;
  if (["גבוה", "בינוני", "נמוך"].includes(normalized)) {
    return normalized === "גבוה" ? "high" : normalized === "בינוני" ? "medium" : "low";
  }
  return "medium";
}

function cleanAtomicText(value) {
  return String(value || "")
    .replace(/^[\s\-*•\d.)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAtomicTitle(text) {
  const words = cleanAtomicText(text).split(/\s+/).filter(Boolean).slice(0, 8);
  return words.join(" ").trim();
}

function canonicalAtomicText(value) {
  return cleanAtomicText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeAtomicText(value) {
  return canonicalAtomicText(value).split(" ").filter((token) => token.length >= 3);
}

function atomicSimilarity(a, b) {
  const aTokens = new Set(tokenizeAtomicText(a));
  const bTokens = new Set(tokenizeAtomicText(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection += 1;
  }
  return intersection / Math.max(aTokens.size, bTokens.size);
}

function isReusableAtomicText(value) {
  const text = cleanAtomicText(value);
  if (text.length < 18) return false;
  if (text.length > 260) return false;

  const normalized = canonicalAtomicText(text);
  if (!normalized) return false;

  const weakPatterns = [
    "הסרטון",
    "המרצה",
    "היוצר",
    "בסרטון הזה",
    "הפרזנטור",
    "המגיש",
    "what happened in the video",
    "video recap",
    "the video says",
  ];
  if (weakPatterns.some((pattern) => normalized.includes(pattern))) return false;

  const reusableSignals = [
    "צריך",
    "כדאי",
    "תמיד",
    "לעולם",
    "כאשר",
    "אם",
    "verify",
    "compare",
    "check",
    "avoid",
    "rule",
    "principle",
    "framework",
    "signal",
    "risk",
    "growth",
    "trend",
    "thesis",
    "שאל",
    "בדוק",
    "השווה",
    "וודא",
    "הימנע",
    "כלל",
    "עיקרון",
    "מסגרת",
    "סיכון",
    "תזה",
  ];
  return reusableSignals.some((signal) => normalized.includes(signal));
}

function deriveAtomicEvidence(rawItem) {
  if (!rawItem || typeof rawItem !== "object") return "";
  return cleanAtomicText(
    rawItem.sourceQuoteOrEvidence ||
    rawItem.evidence ||
    rawItem.quote ||
    rawItem.sourceQuote ||
    ""
  );
}

function deriveAtomicSummary(rawItem) {
  if (rawItem && typeof rawItem === "object") {
    return cleanAtomicText(
      rawItem.summary ||
      rawItem.title ||
      rawItem.explanation ||
      rawItem.text ||
      rawItem.value ||
      ""
    );
  }
  return cleanAtomicText(rawItem);
}

function deriveAtomicExplanation(rawItem, fallbackSummary) {
  if (rawItem && typeof rawItem === "object") {
    return cleanAtomicText(rawItem.explanation || rawItem.summary || fallbackSummary);
  }
  return fallbackSummary;
}

function toAtomicKnowledgeItems(rawValues, type, limit = 5) {
  const list = Array.isArray(rawValues) ? rawValues : rawValues ? [rawValues] : [];
  const normalized = [];

  for (const rawItem of list) {
    const summary = deriveAtomicSummary(rawItem);
    if (!isReusableAtomicText(summary)) continue;

    const explanation = deriveAtomicExplanation(rawItem, summary);
    const title = cleanAtomicText(
      rawItem && typeof rawItem === "object" ? rawItem.title || buildAtomicTitle(summary) : buildAtomicTitle(summary)
    ) || buildAtomicTitle(summary);
    const evidence = deriveAtomicEvidence(rawItem);
    const tags = normalizeAtomicTags(rawItem && typeof rawItem === "object" ? rawItem.tags : []);
    const confidence = normalizeAtomicConfidence(rawItem && typeof rawItem === "object" ? rawItem.confidence : null);

    const duplicate = normalized.some(
      (item) =>
        canonicalAtomicText(item.summary) === canonicalAtomicText(summary) ||
        atomicSimilarity(item.summary, summary) >= 0.82
    );
    if (duplicate) continue;

    normalized.push({
      type,
      title,
      summary,
      explanation,
      sourceQuoteOrEvidence: evidence,
      confidence,
      tags,
    });

    if (normalized.length >= limit) break;
  }

  return normalized;
}

function buildLegacyAtomicArray(items, limit = 5) {
  return (Array.isArray(items) ? items : [])
    .map((item) => cleanAtomicText(item?.summary || item?.title || ""))
    .filter(Boolean)
    .slice(0, limit);
}

function buildBrainSummaryFromAtomicKnowledge({
  mainLesson,
  keyInsights,
  rules,
  actionItems,
  concepts,
  mistakesToAvoid,
  sourceTitle = "Source",
  sourceUrl = "url",
}) {
  const lines = [
    "## 🎯 Core Idea",
    cleanAtomicText(mainLesson) || "לא צוין בתמלול",
    "",
    "## 🧠 Reusable Insights",
    ...(buildLegacyAtomicArray(keyInsights).map((item) => `- ${item}`)),
    "",
    "## ✅ Principles / Rules",
    ...(buildLegacyAtomicArray(rules).map((item) => `- ${item}`)),
    "",
    "## 🔁 Reusable Actions",
    ...(buildLegacyAtomicArray(actionItems).map((item) => `- ${item}`)),
    "",
    "## 🧩 Key Concepts",
    ...(buildLegacyAtomicArray(concepts).map((item) => `- ${item}`)),
    "",
    "## ⚠️ Mistakes / Risks",
    ...(buildLegacyAtomicArray(mistakesToAvoid).map((item) => `- ${item}`)),
    "",
    "## 📝 Personal Notes",
    "[מלא ידנית]",
    "",
    "## 🔗 Source",
    `[${cleanAtomicText(sourceTitle) || "Source"}](${cleanAtomicText(sourceUrl) || "url"})`,
  ];

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeAtomicKnowledge(rawAnalysis) {
  const root = rawAnalysis && typeof rawAnalysis === "object" ? rawAnalysis : {};
  const nested = root.analysis && typeof root.analysis === "object" ? root.analysis : {};
  const merged = { ...nested, ...root };

  const mainLessonText = cleanAtomicText(merged.mainLesson || nested.mainLesson || "");
  const mainLesson = mainLessonText && isReusableAtomicText(mainLessonText)
    ? {
        type: "insight",
        title: buildAtomicTitle(mainLessonText),
        summary: mainLessonText,
        explanation: mainLessonText,
        sourceQuoteOrEvidence: "",
        confidence: "medium",
        tags: [],
      }
    : null;

  const keyInsights = toAtomicKnowledgeItems(merged.keyInsights || nested.keyInsights, "insight", 5);
  const rules = toAtomicKnowledgeItems(merged.rules || nested.rules, "rule", 5);
  const checklists = toAtomicKnowledgeItems(merged.checklists || nested.checklists, "checklist", 3);
  const warnings = toAtomicKnowledgeItems(merged.warnings || nested.warnings, "warning", 4);
  const frameworks = toAtomicKnowledgeItems(merged.frameworks || nested.frameworks, "framework", 4);
  const concepts = toAtomicKnowledgeItems(merged.concepts || nested.concepts, "concept", 4);
  const thesis = toAtomicKnowledgeItems(merged.thesis || nested.thesis, "thesis", 3);
  const questions = toAtomicKnowledgeItems(merged.questions || nested.questions, "question", 4);
  const mistakesToAvoid = toAtomicKnowledgeItems(
    [...normalizeStringArray(merged.mistakesToAvoid || nested.mistakesToAvoid), ...buildLegacyAtomicArray(warnings)],
    "warning",
    4
  );
  const actionItems = toAtomicKnowledgeItems(merged.actionItems || nested.actionItems, "action", 4);

  return {
    mainLesson,
    keyInsights,
    rules,
    checklists,
    warnings,
    frameworks,
    concepts,
    thesis,
    questions,
    mistakesToAvoid,
    actionItems,
  };
}

const GENERIC_CHAPTER_TITLES = new Set([
  "פתיחה והקשר",
  "הרעיון המרכזי",
  "דוגמאות ויישום",
  "סיכום וצעדים הבאים",
  "introduction",
  "main idea",
  "examples",
  "conclusion",
  "פרק 1",
  "פרק 2",
  "פרק 3",
]);

export function isGenericChapterTitle(title) {
  const normalized = String(title || "").trim().toLowerCase();
  if (!normalized) return true;
  return GENERIC_CHAPTER_TITLES.has(normalized);
}

function parseTimestampStr(ts) {
  if (typeof ts === 'number' && Number.isFinite(ts) && ts >= 0) return Math.floor(ts);
  if (typeof ts !== 'string') return null;
  const parts = ts.split(':').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
  return null;
}

export function normalizeAnalysisChapters(chapters) {
  const normalized = normalizeChapterArray(chapters)
    .map((chapter, index) => {
      const title = String(chapter?.title || "").trim() || `מקטע ${index + 1}`;
      const summary = String(chapter?.summary || chapter?.description || "").trim();
      const keyPoints = normalizeStringArray(chapter?.keyPoints);
      const learnedConcepts = normalizeStringArray(chapter?.learnedConcepts);
      const examples = normalizeStringArray(chapter?.examples);
      const practicalUse = String(chapter?.practicalUse || "").trim() || "לא צוין בתמלול";
      // Support both numeric startSeconds and string timestamp (GEM format: "00:02:15")
      const startSeconds = parseTimestampStr(chapter?.startSeconds) ?? parseTimestampStr(chapter?.timestamp) ?? null;
      const endSeconds = Number.isFinite(chapter?.endSeconds) && chapter.endSeconds >= 0
        ? Math.floor(chapter.endSeconds)
        : null;

      return {
        title,
        summary,
        description: summary,
        keyPoints,
        learnedConcepts,
        examples,
        practicalUse,
        startSeconds,
        endSeconds,
        ...(startSeconds != null ? { timestamp: formatMmSsFromSeconds(startSeconds) } : {}),
        timeSource: chapter?.timeSource || (startSeconds != null ? "transcript" : "outline"),
      };
    })
    .filter((chapter) => chapter.title);

  return normalized
    .sort((a, b) => {
      const aStart = Number.isFinite(a.startSeconds) ? a.startSeconds : Number.MAX_SAFE_INTEGER;
      const bStart = Number.isFinite(b.startSeconds) ? b.startSeconds : Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    })
    .map((chapter, index, arr) => {
      const next = arr[index + 1];
      const endSeconds = Number.isFinite(chapter.endSeconds)
        ? chapter.endSeconds
        : Number.isFinite(next?.startSeconds)
          ? Math.max(chapter.startSeconds ?? 0, next.startSeconds)
          : null;
      return {
        ...chapter,
        endSeconds,
      };
    });
}

export function normalizeAiAnalysisResult(result) {
  const root = result && typeof result === "object" ? result : {};
  const nested = root.analysis && typeof root.analysis === "object" ? root.analysis : {};
  const merged = { ...nested, ...root };
  // Support both flat GEM format (analysis.definitions) and nested legacy (analysis.learning.definitions)
  const learning = merged.learning || nested.learning || {};
  const atomicKnowledge = normalizeAtomicKnowledge(result);

  const chapters =
    normalizeAnalysisChapters(
      merged.chapters ||
      merged.sections ||
      merged.segments ||
      merged.topics ||
      merged.videoTopics ||
      merged.aiChapters
    );

  const fallbackMainLesson = atomicKnowledge.mainLesson?.summary || "";
  const fallbackKeyInsights = buildLegacyAtomicArray(atomicKnowledge.keyInsights, 5);
  const fallbackRules = buildLegacyAtomicArray(atomicKnowledge.rules, 5);
  const fallbackMistakes = buildLegacyAtomicArray(atomicKnowledge.mistakesToAvoid, 4);
  const fallbackActions = buildLegacyAtomicArray(atomicKnowledge.actionItems, 4);
  const fallbackConcepts = buildLegacyAtomicArray(atomicKnowledge.concepts, 4);
  const fallbackFrameworks = buildLegacyAtomicArray(atomicKnowledge.frameworks, 4);
  const fallbackQuestions = buildLegacyAtomicArray(atomicKnowledge.questions, 4);
  const fallbackChecklists = buildLegacyAtomicArray(atomicKnowledge.checklists, 3);
  const fallbackWarnings = buildLegacyAtomicArray(atomicKnowledge.warnings, 4);
  const fallbackThesis = buildLegacyAtomicArray(atomicKnowledge.thesis, 3);
  const derivedBrainSummary = buildBrainSummaryFromAtomicKnowledge({
    mainLesson: merged.mainLesson || fallbackMainLesson,
    keyInsights: atomicKnowledge.keyInsights,
    rules: atomicKnowledge.rules,
    actionItems: atomicKnowledge.actionItems,
    concepts: atomicKnowledge.concepts,
    mistakesToAvoid: atomicKnowledge.mistakesToAvoid.length > 0
      ? atomicKnowledge.mistakesToAvoid
      : atomicKnowledge.warnings,
    sourceTitle: merged.title || "Source",
    sourceUrl: merged.url || "url",
  });
  const resolvedMainLesson = cleanAtomicText(
    typeof merged.mainLesson === "string"
      ? merged.mainLesson
      : merged.mainLesson?.summary || merged.mainLesson?.title || fallbackMainLesson
  );
  const resolvedStrategy = cleanAtomicText(
    typeof merged.strategyOrMethod === "string"
      ? merged.strategyOrMethod
      : merged.strategyOrMethod?.summary || merged.strategyOrMethod?.title || ""
  );

  // Claude rich format: allPoints → keyPoints, brainInsights → keyInsights
  // Also handles GEM format: knowledgePoints → keyPoints (supports string | { fact, insight, rule, warning, point, text, ... })
  const allPointsExtra = normalizeAllPointsList(merged.allPoints || nested.allPoints);
  const brainInsightsExtra = normalizeStringArray(merged.brainInsights || nested.brainInsights);
  const rawKnowledgePoints = merged.knowledgePoints || nested.knowledgePoints;
  const knowledgePointsExtra = normalizeAllPointsList(Array.isArray(rawKnowledgePoints) ? rawKnowledgePoints : []);
  if (Array.isArray(rawKnowledgePoints) && rawKnowledgePoints.length > 0) {
    console.log('[knowledge-debug] normalizeAiAnalysisResult', {
      rawKnowledgePointsCount: rawKnowledgePoints.length,
      normalizedKnowledgePointsCount: knowledgePointsExtra.length,
      sample: rawKnowledgePoints[0],
    });
  }
  const baseKeyPoints = normalizeStringArray(merged.keyPoints || nested.keyPoints);
  const mergedKeyPoints = (() => {
    const extras = [...allPointsExtra, ...knowledgePointsExtra];
    return extras.length > 0 ? [...new Set([...baseKeyPoints, ...extras])] : baseKeyPoints;
  })();

  return {
    shortSummary: String(
      merged.shortSummary ||
      merged.summary ||
      nested.shortSummary ||
      nested.summary ||
      ""
    ).trim(),
    fullSummary: String(
      merged.fullSummary ||
      merged.longSummary ||
      nested.fullSummary ||
      nested.longSummary ||
      ""
    ).trim(),
    summary: String(
      merged.summary ||
      merged.shortSummary ||
      nested.summary ||
      nested.shortSummary ||
      ""
    ).trim(),
    mainLesson: resolvedMainLesson || "לא צוין בתמלול",
    strategyOrMethod: resolvedStrategy || "לא צוין בתמלול",
    keyPoints: mergedKeyPoints,
    tags: normalizeStringArray(merged.tags || merged.aiTags || nested.tags || nested.aiTags),
    rules: normalizeLearningArray(merged.rules || nested.rules || learning.rules).length > 0
      ? normalizeLearningArray(merged.rules || nested.rules || learning.rules)
      : fallbackRules,
    mistakesToAvoid: normalizeLearningArray(merged.mistakesToAvoid || nested.mistakesToAvoid).length > 0
      ? normalizeLearningArray(merged.mistakesToAvoid || nested.mistakesToAvoid)
      : fallbackMistakes,
    keyInsights: (() => {
      const learningInsights = Array.isArray(learning.keyInsights)
        ? learning.keyInsights.map(x => typeof x === 'string' ? x : String(x?.insight || x?.text || x?.title || '')).filter(Boolean)
        : [];
      const base = normalizeStringArray(merged.keyInsights || nested.keyInsights);
      const combined = base.length > 0 ? [...new Set([...base, ...learningInsights])] : (learningInsights.length > 0 ? learningInsights : fallbackKeyInsights);
      return brainInsightsExtra.length > 0
        ? [...new Set([...combined, ...brainInsightsExtra])]
        : combined;
    })(),
    actionItems: normalizeStringArray(merged.actionItems || nested.actionItems).length > 0
      ? normalizeStringArray(merged.actionItems || nested.actionItems)
      : fallbackActions,
    checklists: normalizeLearningArray(merged.checklists || nested.checklists || learning.checklists).length > 0
      ? normalizeLearningArray(merged.checklists || nested.checklists || learning.checklists)
      : fallbackChecklists,
    warnings: normalizeLearningArray(merged.warnings || nested.warnings || learning.warnings).length > 0
      ? normalizeLearningArray(merged.warnings || nested.warnings || learning.warnings)
      : fallbackWarnings,
    frameworks: normalizeLearningArray(merged.frameworks || nested.frameworks || learning.frameworks).length > 0
      ? normalizeLearningArray(merged.frameworks || nested.frameworks || learning.frameworks)
      : fallbackFrameworks,
    concepts: normalizeStringArray(merged.concepts || nested.concepts).length > 0
      ? normalizeStringArray(merged.concepts || nested.concepts)
      : fallbackConcepts,
    thesis: normalizeStringArray(merged.thesis || nested.thesis).length > 0
      ? normalizeStringArray(merged.thesis || nested.thesis)
      : fallbackThesis,
    questions: normalizeStringArray(merged.questions || nested.questions).length > 0
      ? normalizeStringArray(merged.questions || nested.questions)
      : fallbackQuestions,
    // Learning tab fields — flat GEM format (root-level) + nested legacy (analysis.learning.*)
    // Uses normalizeLearningArray to handle object shapes: { term, definition }, { name, description }, etc.
    definitions: normalizeLearningArray(merged.definitions || nested.definitions || learning.definitions),
    indicators: normalizeLearningArray(merged.indicators || nested.indicators || learning.indicators),
    setups: normalizeLearningArray(merged.setups || merged.tradingSetups || nested.setups || nested.tradingSetups || learning.setups),
    patterns: normalizeLearningArray(merged.patterns || merged.tradingPatterns || nested.patterns || learning.patterns),
    tradingPrinciples: normalizeLearningArray(merged.tradingPrinciples || nested.tradingPrinciples || learning.tradingPrinciples),
    mentalModels: normalizeLearningArray(merged.mentalModels || nested.mentalModels || learning.mentalModels),
    brainHighlights: normalizeLearningArray(merged.brainHighlights || nested.brainHighlights || learning.brainHighlights),
    usefulKnowledge: normalizeLearningArray(merged.usefulKnowledge || nested.usefulKnowledge || learning.usefulKnowledge || learning.keyTakeaways),
    keyTakeaways: normalizeLearningArray(merged.keyTakeaways || nested.keyTakeaways || learning.keyTakeaways),
    chapters,
    brainSummary: String(merged.brainSummary || nested.brainSummary || "").trim() || derivedBrainSummary || null,
    atomicKnowledge,
    raw: result,
    contentType: typeof merged.contentType === "string" ? merged.contentType : null,
    mainClaim: typeof merged.mainClaim === "string" ? merged.mainClaim.trim() : null,
    speakerPosition: typeof merged.speakerPosition === "string" ? merged.speakerPosition.trim() : null,
    politicalArguments: normalizePoliticalArgList(merged.arguments || merged.politicalArguments),
    weakPoints: normalizeStringArray(merged.weakPoints),
    counterArguments: normalizeCounterArgList(merged.counterArguments),
    socialMediaReplies: normalizeSocialRepliesList(merged.socialMediaReplies),
    // Fundamental-specific rich fields — preserved with full structure for UI rendering
    allPoints: (() => {
      const raw = merged.allPoints || nested.allPoints;
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(x => x && (x.point || x.text))
        .map(x => ({
          point: String(x.point || x.text || '').trim(),
          category: typeof x.category === 'string' ? x.category.trim().toLowerCase() : 'insight',
        }))
        .filter(x => x.point);
    })(),
    richKeyInsights: (() => {
      const raw = merged.keyInsights || nested.keyInsights || learning.keyInsights;
      if (!Array.isArray(raw)) return [];
      return raw
        .map(x => {
          if (typeof x === 'string') return { insight: x.trim(), whyImportant: '' };
          if (x && typeof x === 'object') return {
            insight: String(x.insight || x.text || x.title || '').trim(),
            whyImportant: String(x.whyImportant || x.reason || x.explanation || '').trim(),
          };
          return null;
        })
        .filter(x => x?.insight);
    })(),
    appBuilding: (() => {
      const ab = merged.appBuilding || nested.appBuilding;
      if (!ab) return null;
      const safeArr = (arr) => Array.isArray(arr) ? arr : [];
      const kpiList = safeArr(ab.kpiList);
      const dashboards = safeArr(ab.dashboards);
      const prompts = safeArr(ab.prompts);
      const screeningCriteria = safeArr(ab.screeningCriteria);
      const dataFields = safeArr(ab.dataFields);
      const suggestedFeatures = safeArr(ab.suggestedFeatures)
        .filter(x => x?.feature)
        .map(x => ({
          feature: String(x.feature || '').trim(),
          reason: String(x.reason || x.explanation || '').trim(),
          priority: ['high', 'medium', 'low'].includes(x.priority) ? x.priority : 'medium',
        }));
      const hasData = kpiList.length > 0 || dashboards.length > 0 || prompts.length > 0
        || screeningCriteria.length > 0 || dataFields.length > 0 || suggestedFeatures.length > 0;
      if (!hasData) return null;
      return { kpiList, dashboards, prompts, screeningCriteria, dataFields, suggestedFeatures };
    })(),
    obsidianTopics: (() => {
      const raw = merged.obsidianTopics || nested.obsidianTopics;
      return Array.isArray(raw) ? raw.filter(x => x && typeof x === 'string') : [];
    })(),
    metadataTopics: (() => {
      const meta = merged.metadata || nested.metadata;
      return Array.isArray(meta?.topics) ? meta.topics.filter(x => x && typeof x === 'string') : [];
    })(),
  };
}

export function validateAiAnalysisQuality(result) {
  const normalized = normalizeAiAnalysisResult(result);
  const chapters = Array.isArray(normalized.chapters) ? normalized.chapters : [];
  const genericTitlesFound = chapters.filter((chapter) => isGenericChapterTitle(chapter.title)).length;
  const genericRatio = chapters.length > 0 ? genericTitlesFound / chapters.length : 1;

  console.log("[ai-quality] contentType", normalized.contentType);
  console.log("[ai-quality] genericTitlesFound", genericTitlesFound);
  console.log("[ai-quality] chaptersCount", chapters.length);
  console.log("[ai-quality] mainLesson", normalized.mainLesson);

  const isPolitical = normalized.contentType === "political";
  const politicalArgs = Array.isArray(normalized.politicalArguments) ? normalized.politicalArguments : [];
  const isValid = isPolitical
    ? !!(normalized.mainClaim || politicalArgs.length > 0)
    : chapters.length > 0 && genericRatio <= 0.3;

  return {
    ...normalized,
    genericTitlesFound,
    genericRatio,
    isValid,
  };
}

const GEMINI_PLACEHOLDER_PATTERNS = [
  'מדומה', 'תובנה ראשונה מהתוכן', 'תובנה שנייה מהתוכן', 'תובנה שלישית מהתוכן',
  'פעולה מדומה', 'כלל מדומה', 'מלכודת נפוצה מדומה', 'אסטרטגיה מדומה',
  'placeholder', 'example text',
];

export function checkGeminiQuality(normalized, { durationSeconds = null, transcriptLength = null } = {}) {
  const reasons = [];

  const textFields = [
    normalized.mainLesson,
    normalized.shortSummary,
    normalized.fullSummary,
    normalized.strategyOrMethod,
    ...(Array.isArray(normalized.keyPoints) ? normalized.keyPoints : []),
    ...(Array.isArray(normalized.keyInsights) ? normalized.keyInsights : []),
    ...(Array.isArray(normalized.rules) ? normalized.rules : []),
    ...(Array.isArray(normalized.actionItems) ? normalized.actionItems : []),
    ...(Array.isArray(normalized.mistakesToAvoid) ? normalized.mistakesToAvoid : []),
  ].filter(Boolean).map(s => String(s));

  for (const text of textFields) {
    const hit = GEMINI_PLACEHOLDER_PATTERNS.find(p => text.includes(p));
    if (hit) {
      reasons.push(`מכיל טקסט placeholder ("${hit}"): "${text.slice(0, 50)}"`);
      break;
    }
  }

  const txLen = Number.isFinite(Number(transcriptLength)) ? Number(transcriptLength) : null;
  const isShortTranscript = txLen != null && txLen < 1500;
  const isMediumTranscript = txLen != null && txLen >= 1500 && txLen < 3000;

  const minSummaryChars = isShortTranscript ? 80 : isMediumTranscript ? 150 : 300;
  const summaryTotal =
    String(normalized.shortSummary || '').length +
    String(normalized.fullSummary || '').length;
  if (summaryTotal < minSummaryChars) {
    reasons.push(`סיכום קצר מדי: ${summaryTotal} תווים (מינימום ${minSummaryChars})`);
  }

  if (!isShortTranscript && !isMediumTranscript) {
    const dur = Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : null;
    const chapters = Array.isArray(normalized.chapters) ? normalized.chapters : [];
    const minChapters = 4;
    if (dur && dur > 300 && chapters.length < minChapters) {
      reasons.push(`מעט מדי פרקים: ${chapters.length} לסרטון של ${Math.round(dur / 60)} דק׳ (מינימום ${minChapters})`);
    }
  }

  const passed = reasons.length === 0;
  console.log('[Gemini quality] passed', passed, txLen != null ? `(transcript ${txLen} chars)` : '');
  if (!passed) console.log('[Gemini quality] reason', reasons.join(' | '));
  return { passed, reasons };
}

const BASIC_SUMMARY_PLACEHOLDER_PATTERNS = ['מדומה', 'מהתוכן', 'תובנה ראשונה'];

export function checkBasicSummaryQuality(result) {
  const reasons = [];
  const shortSummary = String(result?.shortSummary || '').trim();
  const fullSummary = String(result?.fullSummary || '').trim();
  const summaryTotal = shortSummary.length + fullSummary.length;

  if (summaryTotal < 150) {
    reasons.push(`סיכום קצר מדי: ${summaryTotal} תווים (מינימום 150)`);
  }

  const allText = [shortSummary, fullSummary, ...(Array.isArray(result?.keyPoints) ? result.keyPoints : [])].filter(Boolean);
  for (const text of allText) {
    const hit = BASIC_SUMMARY_PLACEHOLDER_PATTERNS.find(p => String(text).includes(p));
    if (hit) {
      reasons.push(`מכיל טקסט placeholder ("${hit}")`);
      break;
    }
  }

  const passed = reasons.length === 0;
  console.log('[Gemini basic quality] passed', passed);
  if (!passed) console.log('[Gemini basic quality] reason', reasons.join(' | '));
  return { passed, reasons };
}

export function validateChaptersForSave(chapters, options = {}) {
  const {
    minChapters = 3,
    minSummaryChars = 20,
    requireKeyPoints = true,
    allowNullEndSecondsForLast = true,
    maxGenericTitleRatio = 0.3,
  } = options;

  const list = Array.isArray(chapters) ? chapters : [];
  if (list.length < minChapters) {
    return { ok: false, reason: `מעט מדי פרקים (${list.length})`, chapters: [] };
  }

  const normalized = list
    .map((c, i) => {
      const title = String(c?.title || "").trim();
      const summary = String(c?.summary || c?.description || "").trim();
      const startSeconds = Number(c?.startSeconds);
      const endRaw = c?.endSeconds;
      const endSeconds = endRaw == null ? null : Number(endRaw);
      const keyPoints = Array.isArray(c?.keyPoints) ? c.keyPoints.filter(Boolean) : [];

      if (!title) return null;
      if (!Number.isFinite(startSeconds) || startSeconds < 0) return null;
      if (summary.length < minSummaryChars) return null;
      if (requireKeyPoints && keyPoints.length === 0) return null;

      const isLast = i === list.length - 1;
      if (endRaw == null) {
        if (!allowNullEndSecondsForLast || !isLast) return null;
      } else if (!Number.isFinite(endSeconds) || endSeconds < startSeconds) {
        return null;
      }

      return {
        ...c,
        title,
        summary,
        description: summary,
        startSeconds: Math.floor(startSeconds),
        endSeconds: endRaw == null ? null : Math.floor(endSeconds),
        keyPoints: requireKeyPoints ? keyPoints : Array.isArray(c?.keyPoints) ? c.keyPoints : [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  if (normalized.length < minChapters) {
    return { ok: false, reason: "חלק מהפרקים חסרים שדות חובה", chapters: [] };
  }

  // Monotonic starts
  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i].startSeconds < normalized[i - 1].startSeconds) {
      return { ok: false, reason: "סדר זמנים לא תקין בפרקים", chapters: [] };
    }
  }

  const genericTitlesFound = normalized.filter((c) => isGenericChapterTitle(c.title)).length;
  const genericRatio = normalized.length > 0 ? genericTitlesFound / normalized.length : 1;
  if (genericRatio > maxGenericTitleRatio) {
    return { ok: false, reason: "יותר מדי כותרות פרק גנריות", chapters: [] };
  }

  return { ok: true, reason: null, chapters: normalized };
}

/** Reject partial chapter timelines when duration is known (last start too early). */
export function validateChapterTimelineCoverage(chapters, durationSeconds, { minLastStartRatio = 0.65 } = {}) {
  const dur = Number(durationSeconds);
  if (!Number.isFinite(dur) || dur <= 0) {
    return { ok: true, skipped: true, reason: null };
  }

  const list = Array.isArray(chapters) ? chapters : [];
  if (list.length < 2) {
    return { ok: false, reason: 'מעט מדי פרקים לבדיקת כיסוי', lastStartSeconds: null, durationSeconds: dur };
  }

  const starts = list
    .map((c) => {
      const s = Number(c?.startSeconds);
      return Number.isFinite(s) && s >= 0 ? s : null;
    })
    .filter((s) => s != null)
    .sort((a, b) => a - b);

  if (starts.length < 2) {
    return { ok: false, reason: 'חסרים timestamps בפרקים — לא ניתן לוודא כיסוי מלא', lastStartSeconds: null, durationSeconds: dur };
  }

  const lastStart = starts[starts.length - 1];
  const minLastStart = Math.floor(dur * minLastStartRatio);
  if (lastStart < minLastStart) {
    return {
      ok: false,
      reason: `הפרק האחרון מתחיל מוקדם מדי (${formatMmSsFromSeconds(lastStart)} מתוך ${formatMmSsFromSeconds(dur)}) — הפרקים לא מכסים את כל הסרטון`,
      lastStartSeconds: lastStart,
      minLastStartSeconds: minLastStart,
      durationSeconds: dur,
    };
  }

  return { ok: true, reason: null, lastStartSeconds: lastStart, durationSeconds: dur };
}

export function chaptersNeedEstimatedTimes(chapters, video) {
  const normalized = normalizeChapterArray(chapters);
  if (normalized.length === 0) return false;
  return getVideoDurationSeconds(video) > 0 && normalized.some((chapter) => !Number.isFinite(chapter?.startSeconds));
}

export function ensureChaptersHaveNavigation(chapters, video) {
  const normalized = normalizeChapterArray(chapters);
  if (normalized.length === 0) return [];
  if (!chaptersNeedEstimatedTimes(normalized, video)) return normalized;
  return outlineWithEstimatedTimes(normalized, video);
}

export function buildDurationFallbackChapters(video) {
  const durationSec = getVideoDurationSeconds(video);
  if (durationSec <= 0) return [];

  const count =
    durationSec < 3 * 60 ? 2 :
    durationSec < 8 * 60 ? 3 :
    durationSec < 20 * 60 ? 4 :
    durationSec < 40 * 60 ? 5 :
    durationSec < 70 * 60 ? 6 : 7;

  const segSec = Math.floor(durationSec / count);

  return Array.from({ length: count }, (_, i) => {
    const startSec = i * segSec;
    const endSec = i < count - 1 ? (i + 1) * segSec : durationSec;
    const m = Math.floor(startSec / 60);
    const s = startSec % 60;
    const timeLabel = `${m}:${String(s).padStart(2, '0')}`;
    return {
      title: timeLabel,
      description: '',
      startSeconds: startSec,
      endSeconds: endSec,
      timeSource: 'estimated',
      chapterSource: 'duration_fallback',
      analysisQuality: 'low',
    };
  });
}

function isManualChapterSource(source) {
  return source === 'manual_transcript' || source === 'saved' || source === 'gems_analysis';
}

function chaptersHaveRealTimestamps(chapters) {
  const list = normalizeChapterArray(chapters);
  if (list.length === 0) return false;
  return list.some((c) => {
    const sec = Number(c?.startSeconds);
    if (!Number.isFinite(sec) || sec < 0) return false;
    return (
      c.timeSource === 'real' ||
      c.chapterSource === 'description_timestamp' ||
      c.chapterSource === 'native_chapters' ||
      c.chapterSource === 'youtube' ||
      c.chapterSource === 'description'
    );
  });
}

/** YouTube / description chapters stored on the video record (priority 2). */
export function resolveStructuredChapters(video) {
  const sources = [video?.descriptionChapters, video?.chapters];
  for (const source of sources) {
    const normalized = normalizeChapterArray(source);
    if (chaptersHaveRealTimestamps(normalized)) {
      return ensureChaptersHaveNavigation(normalized, video);
    }
  }

  const descriptionChapters = extractChaptersFromDescription(
    typeof video?.description === 'string' ? video.description : '',
  );
  if (descriptionChapters.length > 0) {
    return ensureChaptersHaveNavigation(
      descriptionChapters.map((chapter) => ({
        ...chapter,
        timeSource: 'real',
        chapterSource: 'description_timestamp',
      })),
      video,
    );
  }

  return [];
}

/** Collect chapters already on the video (saved / description / native). */
export function collectSavedYoutubeChapters(video) {
  const structured = resolveStructuredChapters(video);
  if (structured.length > 0) {
    const firstSource = structured[0]?.chapterSource;
    const chapterSource =
      firstSource === 'native_chapters' ? 'native_chapters' : 'description_timestamp';
    return { chapters: structured, chapterSource, source: chapterSource };
  }
  return { chapters: [], chapterSource: null, source: null };
}

/**
 * Display + navigation priority:
 * 1 manual/saved → 2 YouTube/description → 3 AI (Gemini/transcript) only if none above.
 */
export function resolveDisplayChaptersWithSource(video) {
  if (!video) {
    return {
      source: 'none',
      chapterSource: 'none',
      analysisQuality: 'none',
      chapters: [],
      message: null,
    };
  }

  if (isManualChapterSource(video.chapterSource)) {
    const manualList = normalizeChapterArray(video.aiChapters).length
      ? video.aiChapters
      : video.chapters;
    const chapters = ensureChaptersHaveNavigation(normalizeChapterArray(manualList), video);
    if (chapters.length > 0) {
      return {
        source: 'saved',
        chapterSource: video.chapterSource || 'saved',
        analysisQuality: 'high',
        chapters,
        message: null,
      };
    }
  }

  const structured = resolveStructuredChapters(video);
  if (structured.length > 0) {
    const chapterSource = structured[0]?.chapterSource || 'description_timestamp';
    const source = chapterSource === 'native_chapters' ? 'native_chapters' : 'description_timestamp';
    return {
      source,
      chapterSource,
      analysisQuality: source === 'native_chapters' ? 'high' : 'medium',
      chapters: structured,
      message: null,
    };
  }

  const aiChapters = normalizeChapterArray(video.aiChapters);
  if (aiChapters.length > 0) {
    const src = video.chapterSource || 'ai_generated';
    return {
      source: src,
      chapterSource: src,
      analysisQuality: video.analysisQuality || 'medium',
      chapters: ensureChaptersHaveNavigation(aiChapters, video),
      message: null,
    };
  }

  return {
    source: 'none',
    chapterSource: 'none',
    analysisQuality: 'none',
    chapters: [],
    message: 'לא נמצאו פרקים מובנים. לחץ על "סרוק פרקים מ-YouTube" לשחזור.',
  };
}

export function getChapterSource(video, options = {}) {
  // Use segments from options first; fall back to what's stored on the video object
  let transcriptSegments = Array.isArray(options?.transcriptSegments) ? options.transcriptSegments : [];
  if (transcriptSegments.length === 0 && Array.isArray(video?.transcriptSegments) && video.transcriptSegments.length > 0) {
    transcriptSegments = video.transcriptSegments;
  }

  // Detect whether any text transcript exists (even without timed segments)
  const hasTextTranscript =
    (typeof video?.transcript === 'string' && video.transcript.trim().length > 100) ||
    (typeof video?.manualTranscript === 'string' && video.manualTranscript.trim().length > 100);

  // A "usable" transcript for chapter splitting requires timed segments
  const usableTranscript =
    transcriptSegments.length > 0 &&
    transcriptSegments.some((segment) => Number.isFinite(segment?.startSeconds ?? segment?.start));

  // For displaying UI we only need to know if any transcript content exists
  const hasAnyTranscript = usableTranscript || hasTextTranscript || transcriptSegments.length > 0;
  const descriptionChapters = extractChaptersFromDescription(
    typeof video?.description === 'string' ? video.description : ''
  );
  const durationSeconds = getVideoDurationSeconds(video);
  const loggableVideoId = !options?.silent && (video?.videoId || video?.id || video?._videoId || null);

  if (loggableVideoId) {
    console.log("[chapter-source] videoId", loggableVideoId);
    console.log("[chapter-source] transcript usable", usableTranscript);
    console.log("[chapter-source] description chapters", descriptionChapters.length);
    console.log("[chapter-source] duration fallback", durationSeconds);
  }

  const structuredOnVideo = resolveStructuredChapters(video);
  if (structuredOnVideo.length > 0) {
    const chapterSource = structuredOnVideo[0]?.chapterSource || 'description_timestamp';
    const source = chapterSource === 'native_chapters' ? 'native_chapters' : 'description_timestamp';
    if (loggableVideoId) console.log("[chapter-source] selected source", source);
    return {
      source,
      chapterSource,
      analysisQuality: source === 'native_chapters' ? 'high' : 'medium',
      chapters: structuredOnVideo,
      transcriptSegments,
      message: usableTranscript
        ? null
        : 'לא נמצא תמלול מלא, אבל נמצאו פרקים מתוך תיאור הסרטון.',
    };
  }

  if (usableTranscript) {
    if (loggableVideoId) console.log("[chapter-source] selected source", "transcript");
    return {
      source: 'transcript',
      chapterSource: 'transcript',
      analysisQuality: transcriptSegments.length >= 10 ? 'high' : 'medium',
      chapters: [],
      transcriptSegments,
      message: null,
    };
  }

  if (descriptionChapters.length > 0) {
    if (loggableVideoId) console.log("[chapter-source] selected source", "description_timestamp");
    return {
      source: 'description_timestamp',
      chapterSource: 'description_timestamp',
      analysisQuality: 'medium',
      chapters: descriptionChapters.map((chapter) => ({
        ...chapter,
        timeSource: 'real',
      })),
      transcriptSegments: [],
      message: hasAnyTranscript ? null : 'לא נמצא תמלול מלא, אבל נמצאו פרקים מתוך תיאור הסרטון.',
    };
  }

  // Text-only transcript (no timed segments) — chapters can be generated via AI
  if (hasTextTranscript) {
    if (loggableVideoId) console.log("[chapter-source] selected source", "text_transcript");
    return {
      source: 'transcript',
      chapterSource: 'text_transcript',
      analysisQuality: 'medium',
      chapters: [],
      transcriptSegments: [],
      message: null,
    };
  }

  if (loggableVideoId) console.log("[chapter-source] selected source", "none");
  return {
    source: 'none',
    chapterSource: 'none',
    analysisQuality: 'none',
    chapters: [],
    transcriptSegments: [],
    message: null,
  };
}

/**
 * Returns true if the video has real structured chapters (YouTube/description timestamps).
 * These should be preserved and NOT overwritten by AI-generated chapters.
 */
export function hasStructuredChapters(video) {
  const desc = normalizeChapterArray(video?.descriptionChapters);
  if (desc.length > 0 && desc.some((c) => Number.isFinite(c.startSeconds))) return true;
  const ch = normalizeChapterArray(video?.chapters);
  if (ch.length > 0 && ch.some((c) => c.timeSource === 'real' && Number.isFinite(c.startSeconds))) return true;
  return false;
}

/**
 * Merges AI-generated content (summaries, keyPoints) into existing structured chapters.
 * Preserves original titles and timestamps. Matches AI chapters by closest startSeconds.
 */
export function enrichChaptersWithAi(structuredChapters, aiChapters) {
  if (!Array.isArray(structuredChapters) || structuredChapters.length === 0) return aiChapters ?? [];
  if (!Array.isArray(aiChapters) || aiChapters.length === 0) return structuredChapters;

  return structuredChapters.map((orig, idx) => {
    const origSec = orig.startSeconds ?? 0;
    const aiMatch = aiChapters.reduce((best, aiCh) => {
      const aiSec = aiCh.startSeconds ?? 0;
      const diff = Math.abs(aiSec - origSec);
      return best === null || diff < best.diff ? { ch: aiCh, diff } : best;
    }, null)?.ch ?? aiChapters[idx] ?? null;

    if (!aiMatch) return { ...orig, chapterSource: orig.chapterSource || 'description_timestamp' };
    return {
      ...orig,
      // Lock original structure
      title: orig.title,
      startSeconds: orig.startSeconds,
      endSeconds: orig.endSeconds,
      timeSource: orig.timeSource ?? 'real',
      chapterSource: orig.chapterSource || 'description_timestamp',
      // Enrich with AI content only if not already present
      summary: orig.summary || aiMatch.summary || aiMatch.description || '',
      description: orig.description || aiMatch.description || aiMatch.summary || '',
      keyPoints: (orig.keyPoints?.length > 0) ? orig.keyPoints : (aiMatch.keyPoints || []),
    };
  });
}

/**
 * Attaches transcript segments to their matching chapters by timestamp.
 * Preserves all existing chapter fields; adds transcriptSegments, transcriptText, transcriptSegmentCount.
 * Idempotent: calling again with fresh segments overwrites previous attachment.
 */
export function attachTranscriptToChapters(chapters, transcriptSegments) {
  if (!Array.isArray(chapters) || chapters.length === 0) return chapters;
  if (!Array.isArray(transcriptSegments) || transcriptSegments.length === 0) {
    return chapters.map((c) => ({
      ...c,
      transcriptSegments: c.transcriptSegments ?? [],
      transcriptText: c.transcriptText ?? '',
      transcriptSegmentCount: c.transcriptSegmentCount ?? 0,
    }));
  }

  // Build lookup: originalIndex → {startSeconds}. Only chapters with valid timestamps participate.
  const timedChapters = chapters
    .map((c, i) => ({ i, sec: Number(c?.startSeconds ?? NaN) }))
    .filter((x) => Number.isFinite(x.sec))
    .sort((a, b) => a.sec - b.sec);

  if (timedChapters.length === 0) return chapters;

  // groups[originalIndex] = segment array
  const groups = new Map(timedChapters.map((x) => [x.i, []]));

  for (const seg of transcriptSegments) {
    const sec = Number(seg?.startSeconds ?? seg?.start ?? NaN);
    if (!Number.isFinite(sec)) continue;
    // Linear scan: last chapter whose startSeconds <= sec
    let assignedI = timedChapters[0].i;
    for (const { sec: cSec, i } of timedChapters) {
      if (cSec <= sec) assignedI = i;
      else break;
    }
    groups.get(assignedI)?.push(seg);
  }

  return chapters.map((chapter, idx) => {
    const segs = groups.get(idx) ?? [];
    const transcriptText = segs
      .map((s) => String(s.text || '').trim())
      .filter(Boolean)
      .join(' ');
    return {
      ...chapter,
      transcriptSegments: segs,
      transcriptText,
      transcriptSegmentCount: segs.length,
    };
  });
}

export function resolveVideoChapters(video, overrideChapters) {
  const override = normalizeChapterArray(overrideChapters);
  if (override.length > 0) {
    return ensureChaptersHaveNavigation(override, video);
  }

  if (isManualChapterSource(video?.chapterSource)) {
    const manualList = normalizeChapterArray(video?.aiChapters).length
      ? video.aiChapters
      : video?.chapters;
    const manual = normalizeChapterArray(manualList);
    if (manual.length > 0) {
      return ensureChaptersHaveNavigation(manual, video);
    }
  }

  const structured = resolveStructuredChapters(video);
  if (structured.length > 0) {
    return structured;
  }

  const storedAi = normalizeChapterArray(video?.aiChapters);
  if (storedAi.length > 0) {
    return ensureChaptersHaveNavigation(storedAi, video);
  }

  const analysisChapters = normalizeChapterArray(video?.analysis?.chapters);
  if (analysisChapters.length > 0) {
    return ensureChaptersHaveNavigation(analysisChapters, video);
  }

  return [];
}

export function buildFallbackAiChapters(video) {
  const existing = resolveVideoChapters(video);
  if (existing.length > 0) return existing;

  const fallback = analyzeVideo(video || {}, { force: true }).aiChapters ?? [];
  return ensureChaptersHaveNavigation(fallback, video);
}

// ── Canonical chapter utilities (Phase 2) ────────────────────────────────────

export function normalizeChapterSource(rawSource) {
  if (rawSource === 'transcript') return 'ai';
  if (rawSource === 'description_timestamp') return 'description';
  if (rawSource === 'duration_fallback') return 'fallback';
  return 'none';
}

export function computeChapterQuality(chapters) {
  const count = Array.isArray(chapters) ? chapters.length : 0;
  if (count >= 5) return 'high';
  if (count >= 2) return 'medium';
  if (count === 1) return 'low';
  return 'none';
}

export function resolveCanonicalChapters(video) {
  const raw = resolveDisplayChaptersWithSource(video);
  const chapterSource = normalizeChapterSource(raw?.chapterSource);
  const chapters = raw?.chapters?.length > 0 ? raw.chapters : resolveVideoChapters(video);
  const chapterQuality = computeChapterQuality(chapters);
  return { chapters, chapterSource, chapterQuality, chapterCount: chapters.length };
}

/**
 * Fill missing startSeconds using even splits across video duration (same heuristic as estimatedChapters).
 */
export function outlineWithEstimatedTimes(chapters, video) {
  if (!Array.isArray(chapters) || chapters.length === 0) return [];
  const durationSec = getVideoDurationSeconds(video);
  const n = chapters.length;
  return chapters.map((c, idx) => {
    if (Number.isFinite(c.startSeconds) && c.startSeconds >= 0) return { ...c };
    const secs = durationSec > 0 ? Math.round((idx * durationSec) / n) : null;
    return {
      ...c,
      timeSource: secs != null ? "estimated" : c.timeSource || "outline",
      ...(secs != null
        ? { startSeconds: secs, timestamp: formatMmSsFromSeconds(secs) }
        : {}),
    };
  });
}

/** Shape expected by TopicLearningPage / Video entity videoTopics field */
export function chaptersToVideoTopics(chapters) {
  if (!Array.isArray(chapters)) return [];
  return chapters.map((c, i) => {
    const hasSec = Number.isFinite(c.startSeconds) && c.startSeconds >= 0;
    const sec = hasSec ? Math.floor(c.startSeconds) : undefined;
    return {
      title: c.title || `פרק ${i + 1}`,
      summary: c.description || "",
      ...(hasSec
        ? {
            timestampSeconds: sec,
            timestampLabel: c.timestamp || formatMmSsFromSeconds(sec),
          }
        : {}),
    };
  });
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
 * @returns {{ title: string, description: string, timestamp: string, startSeconds: number, timeSource: "transcript" }[] | null}
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
      timeSource:   'transcript',
    });
  }

  return chapters.length >= 2 ? chapters : null;
}

/**
 * Match existing AI chapters to transcript timestamps using keyword search.
 * Assigns startSeconds to chapters that currently lack one.
 *
 * Strategy:
 *   - Divide transcript lines into N equal windows (one per chapter).
 *   - Within each window, find the line whose text best matches the chapter keywords.
 *   - If no keyword match, fall back to the first line in the window (still a real timestamp).
 *   - Monotonicity is enforced: each chapter starts after the previous.
 *   - Chapters that already have a valid startSeconds are preserved unchanged.
 *
 * @param {Array<{title: string, description: string, startSeconds?: number}>} chapters
 * @param {{ lines: { start: number, text: string }[] }} transcript — output of parseTranscript()
 * @returns {Array | null} — enriched chapters, or null if nothing could be improved
 */
export function matchChaptersToTranscript(chapters, transcript) {
  const lines = transcript?.lines;
  if (!Array.isArray(lines) || lines.length < 5 || !chapters?.length) return null;

  const n = chapters.length;
  const chunkSize = Math.ceil(lines.length / n);

  function kwTokens(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-zא-ת0-9]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  }

  let minLineIdx = 0;
  let anyMatched = false;

  const result = chapters.map((chapter, i) => {
    // Already valid — advance cursor and keep unchanged
    if (Number.isFinite(chapter.startSeconds) && chapter.startSeconds >= 0) {
      const next = lines.findIndex((l) => l.start > chapter.startSeconds);
      minLineIdx = next >= 0 ? next : lines.length;
      return chapter;
    }

    // Window: minLineIdx → end of chapter's allocated segment (+10% overlap for last)
    const nominalEnd = Math.ceil((i + 1) * chunkSize * 1.1);
    const windowEnd = i === n - 1 ? lines.length : Math.min(lines.length, nominalEnd);
    const window = lines.slice(minLineIdx, windowEnd);
    if (!window.length) return chapter; // No lines left — leave unchanged

    const query = kwTokens((chapter.title || '') + ' ' + (chapter.description || ''));

    let bestScore = -1;
    let bestIdx = 0;

    for (let j = 0; j < window.length; j++) {
      const lineTokens = kwTokens(window[j].text);
      let score = 0;
      for (const q of query) {
        if (lineTokens.some((t) => t.includes(q) || q.includes(t))) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    const chosen = window[bestScore > 0 ? bestIdx : 0];
    const startSeconds = Math.floor(chosen.start);
    const next = lines.findIndex((l) => l.start > chosen.start);
    minLineIdx = next >= 0 ? next : lines.length;
    anyMatched = true;

    return {
      ...chapter,
      startSeconds,
      timestamp: formatMmSsFromSeconds(startSeconds),
      timeSource: 'transcript',
    };
  });

  return anyMatched ? result : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function analyzeVideo(video, { force = false } = {}) {
  // Don't skip if legacy records have analyzedAt but miss newer fields (aiChapters / summaries / tags).
  if (video.analyzedAt && !force) {
    const hasChapters = Array.isArray(video.aiChapters) && video.aiChapters.length > 0;
    const hasSummary = !!(video.aiSummaryShort || video.aiSummaryLong || video.shortSummary || video.fullSummary);
    const hasTags = Array.isArray(video.aiTags) && video.aiTags.length > 0;
    if (hasChapters && (hasSummary || hasTags)) return video;
  }

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

// ── Dashboard KPI helpers (ingestion date = when video appeared on dashboard) ─

function parseFirstValidDate(...raws) {
  for (const r of raws) {
    if (r == null || r === "") continue;
    const d = new Date(r);
    if (Number.isFinite(d.getTime())) return d;
  }
  return null;
}

/**
 * Best-effort instant the video was added / ingested into the app (not YouTube publish time).
 * Manual: addedAt first. RSS/scanned: scannedAt → fetchedAt → createdAt → publishedAt.
 */
export function getVideoDashboardIngestionDate(video) {
  if (!video) return null;
  const isManual =
    video.addedManually === true || String(video.source || "").toLowerCase() === "manual";
  if (isManual) {
    return parseFirstValidDate(
      video.addedAt,
      video.fetchedAt,
      video.scannedAt,
      video.createdAt,
      video.publishedAt,
    );
  }
  return parseFirstValidDate(
    video.scannedAt,
    video.fetchedAt,
    video.createdAt,
    video.publishedAt,
  );
}

function startOfLocalDay(reference = new Date()) {
  const d = reference instanceof Date ? reference : new Date(reference);
  if (!Number.isFinite(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(reference = new Date()) {
  const d = reference instanceof Date ? reference : new Date(reference);
  if (!Number.isFinite(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** True if ingestion timestamp falls on the user's local calendar day of `now`. */
export function isVideoAddedOnLocalCalendarDay(video, now = new Date()) {
  const ingestion = getVideoDashboardIngestionDate(video);
  if (!ingestion) return false;
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);
  if (!dayStart || !dayEnd) return false;
  const t = ingestion.getTime();
  return t >= dayStart.getTime() && t <= dayEnd.getTime();
}

function isVideoExcludedFromDashboardKpis(video) {
  if (!video) return true;
  if (video.hidden === true) return true;
  if (video.deleted === true || video.isDeleted === true) return true;
  return false;
}

export function getDashboardStats(videos, mentors = []) {
  if (!videos.length) return null;

  const now = new Date();

  let newToday = 0;
  const mentorCounts = {};
  let scoreSum = 0;
  let scoreCount = 0;
  const tagCounts = {};

  for (const v of videos) {
    if (isVideoExcludedFromDashboardKpis(v)) continue;
    if (isVideoAddedOnLocalCalendarDay(v, now)) newToday++;
    if (v.mentorId) mentorCounts[v.mentorId] = (mentorCounts[v.mentorId] || 0) + 1;
    if (v.qualityScore != null) { scoreSum += v.qualityScore; scoreCount++; }
    for (const tag of v.aiTags || []) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }

  if (import.meta.env.DEV && typeof console !== "undefined" && console.debug) {
    console.debug(
      "[dashboard] todayCount candidates",
      videos
        .filter((v) => !isVideoExcludedFromDashboardKpis(v))
        .map((v) => ({
          videoId: v.id,
          title: v.title || "",
          ingestion: getVideoDashboardIngestionDate(v)?.toISOString() ?? null,
          included: isVideoAddedOnLocalCalendarDay(v, now),
        })),
    );
  }

  const topMentorId = Object.entries(mentorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topMentor = {
    name:  mentors.find((m) => m.id === topMentorId)?.name || '—',
    count: mentorCounts[topMentorId] || 0,
  };

  const avgQuality = scoreCount
    ? Math.round((scoreSum / scoreCount) * 10) / 10
    : 0;

  // Top videos by quality score
  const topVideos = [...videos]
    .filter((v) => !isVideoExcludedFromDashboardKpis(v) && v.qualityScore != null)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
    .slice(0, 8);

  return {
    newToday,
    totalSaved: videos.filter((v) => !isVideoExcludedFromDashboardKpis(v)).length,
    topMentor,
    avgQuality,
    tagCounts,
    topVideos,
  };
}
