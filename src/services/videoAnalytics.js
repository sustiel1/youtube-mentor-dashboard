// ─── Video Analytics Service ─────────────────────────────────────────────────
// Mock AI analysis for local videos: tags, quality score, summary.
// No external API — computed from title, description, and category.
//
// API:
//   analyzeVideo(video)              → video with aiTags, qualityScore, aiSummary, analyzedAt
//   analyzeVideos(videos)            → batch analyze, skip already-analyzed
//   getDashboardStats(videos, mentors) → KPI stats + topVideos for SmartDashboard

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

function generateSummary(video, tags) {
  const title = video.title || 'סרטון';
  if (!tags.length) return `סרטון: "${title}"`;
  return `סרטון בנושא ${tags.slice(0, 2).join(' ו-')}: "${title}"`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function analyzeVideo(video, { force = false } = {}) {
  if (video.analyzedAt && !force) return video;

  const tags         = extractTags(video);
  const qualityScore = computeQualityScore(video, tags);
  const aiSummary    = generateSummary(video, tags);

  return {
    ...video,
    aiTags:      tags,
    qualityScore,
    aiSummary,
    analyzedAt:  new Date().toISOString(),
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
