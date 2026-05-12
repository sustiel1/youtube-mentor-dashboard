// Obsidian-compatible Markdown export engine — v2
// Supports: topic-based pathing, LLM-ready headings, temporal YAML, weekly recap.
//
// Root folders:  /Stock Market  /AI  /Development  /Daily
// Sub-folders:   /Sessions  /Learnings
//
// Filename patterns:
//   Daily:         YYYY-MM-DD.md
//   Session:       S-YYYY-MM-DD-[brief-title].md
//   Learning:      L-[short-topic].md
//   Weekly Recap:  W-YYYY-[WW].md

// ── Constants ─────────────────────────────────────────────────────────────────

// Obsidian-first knowledge model:
// Root is always a semantic Topic, with two stable folders: Learnings/ and Notes/
export const PRIMARY_TOPICS = ['Stock Market', 'AI', 'Development', 'General'];

const CATEGORY_TO_TOPIC = {
  Markets: 'Stock Market',
  AI: 'AI',
  Dev: 'Development',
};

const FORMAT_LABELS = new Set(['weekly', 'daily', 'session']);

// Keywords that hint at each primary topic (checked against tags + title + channelTitle)
const TOPIC_KEYWORDS = {
  'Stock Market': ['stock', 'market', 'trading', 'scanner', 'macro', 'chart', 'technical',
    'fundamental', 'options', 'forex', 'earnings', 'bulls', 'bears', 'שוק', 'מניות',
    'מסחר', 'ניתוח', 'בורסה', 'השקעות'],
  'AI': ['ai', 'gpt', 'claude', 'gemini', 'llm', 'machine learning', 'automation',
    'neural', 'prompt', 'rag', 'בינה', 'אוטומציה', 'מודל', 'שפה'],
  'Development': ['dev', 'code', 'react', 'javascript', 'python', 'typescript', 'api',
    'backend', 'frontend', 'database', 'git', 'פיתוח', 'קוד', 'תכנות'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(iso) {
  return (iso ? new Date(iso) : new Date()).toISOString().slice(0, 10);
}

function toISOCreated(iso) {
  return (iso ? new Date(iso) : new Date()).toISOString();
}

function isoWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

export function slugify(text, maxLen = 35) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLen)
    .replace(/-$/, '');
}

function cleanTag(t) {
  return String(t)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-');
}

function listLines(items, fallback = '- ') {
  const filtered = (Array.isArray(items) ? items : []).map((i) => String(i).trim()).filter(Boolean);
  return filtered.length ? filtered.map((i) => `- ${i}`).join('\n') : fallback;
}

const BRAIN_HIGHLIGHT_SECTIONS = ['Reusable Insights', 'Principles', 'Rules', 'Reusable Actions', 'Key Concepts'];

export function extractBrainHighlightsFromVideo(video = {}) {
  if (Array.isArray(video.brainHighlights) && video.brainHighlights.length > 0) {
    return video.brainHighlights.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10);
  }

  const brainSummary = typeof video.brainSummary === 'string' ? video.brainSummary : '';
  if (brainSummary) {
    const bullets = [];
    let inSection = false;
    for (const line of brainSummary.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('## ')) {
        inSection = BRAIN_HIGHLIGHT_SECTIONS.some((section) => trimmed.includes(section));
        continue;
      }
      if (inSection && (trimmed.startsWith('- ') || trimmed.startsWith('* '))) {
        const text = trimmed.slice(2).trim().replace(/\*\*/g, '');
        if (text && text !== '...' && !text.includes('[מלא ידנית]')) bullets.push(text);
      }
      if (bullets.length >= 10) break;
    }
    if (bullets.length >= 2) return bullets;
  }

  return [
    ...(Array.isArray(video.keyInsights) ? video.keyInsights : []),
    ...(Array.isArray(video.keyPoints) ? video.keyPoints : []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

// ── Topic resolution ──────────────────────────────────────────────────────────

/**
 * Infer the primary Obsidian root folder from video metadata.
 * Priority: explicit category field → tag/title keyword match → 'Daily' fallback.
 */
export function resolvePrimaryTopic(video = {}) {
  // 1. Direct category mapping
  if (video.category && CATEGORY_TO_TOPIC[video.category]) {
    return CATEGORY_TO_TOPIC[video.category];
  }

  // 2. Keyword scan across tags + title + channelTitle
  const haystack = [
    ...(video.tags || []),
    video.title || '',
    video.channelTitle || '',
  ].join(' ').toLowerCase();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(kw))) return topic;
  }

  return 'General';
}

/**
 * Constructs the full Obsidian vault path for a note.
 * Example: "Stock Market/Learnings/V-some-video.md"
 */
export function getExportPath(type, primaryTopic, filename) {
  const root = primaryTopic || 'General';
  // Keep API stable: anything that isn't explicitly a "note" goes to Learnings/
  if (type === 'note') return `${root}/Notes/${filename}`;
  return `${root}/Learnings/${filename}`;
}

// ── YAML frontmatter builder ───────────────────────────────────────────────────

function buildFrontmatter({ type, format, topic, source, channel, tags = [], date, created, related = [] }) {
  const cleanTags = tags.map(cleanTag).filter(Boolean);
  const relatedLinks = related.filter(Boolean).map((r) => `[[${r}]]`);
  const fmt = String(format || '').trim().toLowerCase();
  const resolvedFormat = fmt && FORMAT_LABELS.has(fmt) ? fmt : null;
  const lines = [
    '---',
    `type: ${type}`,
    ...(resolvedFormat ? [`format: ${resolvedFormat}`] : []),
    `topic: ${topic || 'General'}`,
    ...(source ? [`source: ${source}`] : []),
    ...(channel ? [`channel: ${channel}`] : []),
    `tags: [${cleanTags.join(', ')}]`,
    `date: ${date}`,
    `created: ${created}`,
    ...(relatedLinks.length ? [`related: ${relatedLinks.join(', ')}`] : []),
    '---',
  ];
  return lines.join('\n');
}

// ── Daily Note ────────────────────────────────────────────────────────────────

export function generateDailyNote({
  date,
  primaryTopic = 'General',
  focus = '',
  activityLog = [],
  nextBestMove = '',
  relatedSessions = [],
  related = [],
  format,
  source,
  channel,
} = {}) {
  const d = date || toDateStr();
  const created = toISOCreated();
  const filename = `${d}.md`;

  const content = [
    buildFrontmatter({ type: 'daily', format: format || 'daily', topic: primaryTopic, source, channel, tags: ['daily'], date: d, created, related }),
    '',
    `# ${d}`,
    '',
    '## Focus',
    focus || '- ',
    '',
    '## Activity Log',
    listLines(activityLog),
    '',
    '## Next Best Move',
    nextBestMove || '- ',
    '',
    '## Related Sessions',
    listLines(relatedSessions.map((s) => `[[${s}]]`)),
  ].join('\n');

  return { content, filename, path: getExportPath('daily', primaryTopic, filename) };
}

// ── Session Note (LLM-Ready) ──────────────────────────────────────────────────

export function generateSessionNote({
  title = '',
  date,
  primaryTopic = 'General',
  context = '',
  technicalAnalysis = '',
  aiInsights = [],
  implementation = [],
  related = [],
  tags = [],
  format,
  source,
  channel,
} = {}) {
  const d = date || toDateStr();
  const created = toISOCreated();
  const filename = `S-${d}-${slugify(title || 'session')}.md`;

  const content = [
    buildFrontmatter({ type: 'session', format: format || 'session', topic: primaryTopic, source, channel, tags: ['session', ...tags], date: d, created, related }),
    '',
    `# ${title || 'Session Summary'}`,
    '',
    '## Context',
    context || '- ',
    '',
    '## Technical Analysis',
    technicalAnalysis || '- ',
    '',
    '## AI Insights',
    listLines(aiInsights),
    '',
    '## Implementation',
    listLines(implementation),
    '',
    ...(related.length ? ['## Related', listLines(related.map((r) => `[[${r}]]`)), ''] : []),
  ].join('\n');

  return { content, filename, path: getExportPath('session', primaryTopic, filename) };
}

// ── Learning Note (LLM-Ready) ─────────────────────────────────────────────────

export function generateLearningNote({
  topic = '',
  date,
  primaryTopic = 'General',
  context = '',
  technicalAnalysis = '',
  aiInsights = '',
  implementation = [],
  related = [],
  tags = [],
  format,
  source,
  channel,
} = {}) {
  const d = date || toDateStr();
  const created = toISOCreated();
  const filename = `L-${slugify(topic || 'insight')}.md`;

  const content = [
    buildFrontmatter({ type: 'learning', format, topic: primaryTopic, source, channel, tags: ['learning', ...tags], date: d, created, related }),
    '',
    `# ${topic || 'Insight'}`,
    '',
    '## Context',
    context || '- ',
    '',
    '## Technical Analysis',
    technicalAnalysis || '- ',
    '',
    '## AI Insights',
    aiInsights || '- ',
    '',
    '## Implementation',
    listLines(implementation),
    '',
    ...(related.length ? ['## Related', listLines(related.map((r) => `[[${r}]]`)), ''] : []),
  ].join('\n');

  return { content, filename, path: getExportPath('learning', primaryTopic, filename) };
}

// ── Weekly Recap ──────────────────────────────────────────────────────────────

export function generateWeeklyRecapNote({
  date,
  sessions = [],
  learnings = [],
  keyThemes = [],
  nextWeekFocus = '',
  primaryTopic = 'General',
  format,
  source,
  channel,
} = {}) {
  const d = date || toDateStr();
  const created = toISOCreated();
  const year = new Date(d).getFullYear();
  const week = String(isoWeekNumber(new Date(d))).padStart(2, '0');
  const filename = `W-${year}-${week}.md`;

  // Compute week start (Monday)
  const dt = new Date(d);
  const dayOfWeek = (dt.getDay() + 6) % 7; // 0=Mon
  const weekStart = new Date(dt);
  weekStart.setDate(dt.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const content = [
    buildFrontmatter({ type: 'weekly-recap', format: format || 'weekly', topic: primaryTopic || 'General', source, channel, tags: ['weekly-recap', `week-${week}`], date: d, created }),
    '',
    `# Week of ${weekStartStr} → ${d}`,
    '',
    '## Sessions This Week',
    listLines(sessions.map((s) => `[[${s}]]`)),
    '',
    '## Learnings This Week',
    listLines(learnings.map((l) => `[[${l}]]`)),
    '',
    '## Key Themes',
    listLines(keyThemes),
    '',
    '## Next Week Focus',
    nextWeekFocus || '- ',
  ].join('\n');

  return { content, filename, path: getExportPath('weekly-recap', primaryTopic || 'General', filename) };
}

// ── Video → Note builders ─────────────────────────────────────────────────────

export function buildVideoLearningNote(video, mentorName = '', primaryTopicOverride = null, notes = []) {
  const primaryTopic = primaryTopicOverride || resolvePrimaryTopic(video);
  const tags = [
    ...(video.tags || []).map(cleanTag),
    ...(mentorName ? [cleanTag(mentorName)] : []),
  ].filter(Boolean);

  const related = [
    ...(mentorName ? [mentorName] : []),
    ...(video.tags || []).slice(0, 2),
  ].filter(Boolean);

  const implementation = [
    ...(video.keyPoints || []),
    ...(video.actionItems || []),
  ].filter(Boolean).slice(0, 8);

  const result = generateLearningNote({
    topic: video.title || 'Video Insight',
    date: video.publishedAt,
    primaryTopic,
    format: video?.obsidianFormat || video?.obsidianTemplate || null,
    source: 'YouTube',
    channel: mentorName || video.channelTitle || '',
    context: [
      mentorName ? `ערוץ: [[${mentorName}]]` : '',
      video.url ? `מקור: ${video.url}` : '',
    ].filter(Boolean).join('\n') || '- ',
    technicalAnalysis: video.strategyOrMethod || video.fullSummary || '- ',
    aiInsights: video.mainLesson || video.shortSummary || '- ',
    implementation,
    related,
    tags,
  });
  const notesSection = buildNotesSection(notes);
  return notesSection ? { ...result, content: result.content + '\n\n' + notesSection } : result;
}

export function buildVideoSessionNote(video, mentorName = '', primaryTopicOverride = null, notes = []) {
  const primaryTopic = primaryTopicOverride || resolvePrimaryTopic(video);
  const tags = (video.tags || []).map(cleanTag).filter(Boolean);

  const chapters = (video.aiChapters || video.chapters || [])
    .map((ch) => ch.title || ch.heading || '')
    .filter(Boolean);

  const aiInsights = [
    ...(video.keyInsights || []),
    ...(video.keyPoints || []),
  ].filter(Boolean).slice(0, 8);

  const implementation = [
    ...(video.mistakesToAvoid || []).map((m) => `הימנע: ${m}`),
    ...(video.actionItems || []),
  ].filter(Boolean).slice(0, 6);

  const related = mentorName ? [mentorName] : [];

  const technicalAnalysis = [
    chapters.length ? `**פרקים:** ${chapters.slice(0, 5).join(' | ')}` : '',
    video.rules?.length ? `**כללים:** ${video.rules.slice(0, 3).join(' · ')}` : '',
  ].filter(Boolean).join('\n') || '- ';

  const result = generateSessionNote({
    title: video.title || 'Video Analysis',
    date: video.analyzedAt || video.publishedAt,
    primaryTopic,
    format: video?.obsidianFormat || video?.obsidianTemplate || 'session',
    source: 'YouTube',
    channel: mentorName || video.channelTitle || '',
    context: [
      mentorName ? `ערוץ: [[${mentorName}]]` : '',
      video.url ? `קישור: ${video.url}` : '',
    ].filter(Boolean).join('\n') || '- ',
    technicalAnalysis,
    aiInsights,
    implementation,
    related,
    tags,
  });
  const notesSection = buildNotesSection(notes);
  return notesSection ? { ...result, content: result.content + '\n\n' + notesSection } : result;
}

export function buildVideoDailyNote(video, mentorName = '', primaryTopicOverride = null, notes = []) {
  const primaryTopic = primaryTopicOverride || resolvePrimaryTopic(video);
  const sessionSlug = slugify(video.title || 'session', 40);
  const relatedSessions = [sessionSlug, ...(mentorName ? [mentorName] : [])].filter(Boolean);

  const result = generateDailyNote({
    primaryTopic,
    format: video?.obsidianFormat || video?.obsidianTemplate || 'daily',
    source: 'YouTube',
    channel: mentorName || video.channelTitle || '',
    focus: video.mainLesson || video.shortSummary || video.title || '',
    activityLog: [
      mentorName ? `צפיתי: ${video.title} של ${mentorName}` : `צפיתי: ${video.title}`,
      ...(video.keyPoints || []).slice(0, 3),
    ].filter(Boolean),
    relatedSessions,
    related: relatedSessions,
  });
  const notesSection = buildNotesSection(notes);
  return notesSection ? { ...result, content: result.content + '\n\n' + notesSection } : result;
}

// ── Notes section builder ─────────────────────────────────────────────────────

function secondsToTimestamp(s) {
  const n = Math.floor(Number(s) || 0);
  const m = Math.floor(n / 60);
  const sec = n % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function buildNotesSection(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return null;
  const lines = ['## Learning Notes', ''];
  for (const note of notes) {
    const ts = note.timestampLabel || (Number.isFinite(note.timestampSeconds) ? secondsToTimestamp(note.timestampSeconds) : null);
    if (ts) lines.push(`**[${ts}]**`);
    if (note.content) lines.push(note.content.trim());
    if (Array.isArray(note.images) && note.images.length > 0) lines.push('📷 Image attached to note');
    lines.push('');
  }
  return lines.join('\n');
}

// ── Atomic Knowledge Markdown builder ────────────────────────────────────────
// Generates Obsidian-ready markdown from structured fields on a video object.
// Each section maps to a reusable knowledge category for long-term retrieval.
//
// Returns null when no structured fields are present — caller must fall back
// to brainSummary or the existing summary builder.
//
// Field priority:
//   mainLesson      → ## 🎯 Core Idea
//   keyInsights     → ## ⚡ Insights
//   rules           → ## ✅ Rules & Principles
//   actionItems     → ## 🔁 Actions
//   mistakesToAvoid → ## ⚠️ Mistakes / Risks
//   concepts        → ## 🧩 Concepts  (reserved for future AI field)
//   aiChapters      → ## 📹 Chapters
//                     ## 📝 Personal Notes  (placeholder)
//                     ## 🔗 Source

/**
 * Returns structured atomic knowledge fields from a video, filtered by selections.
 *
 * selections: Record<"fieldName:index", boolean> | undefined | null
 * - undefined / null → include ALL non-empty items (backwards-compat, export everything)
 * - provided object  → include ONLY items where the key maps to true
 *
 * Used by: buildAtomicKnowledgeMarkdown, createKnowledgeItemFromVideo,
 *          and any future atomic-export pipeline.
 */
export function getSelectedAtomicKnowledge(video, selections) {
  const v = video || {};
  const sel = (selections !== undefined && selections !== null) ? selections : undefined;

  const filterArr = (arr, fieldKey) => {
    if (!Array.isArray(arr)) return [];
    const strs = arr.map((item) => (item ? String(item).trim() : '')).filter(Boolean);
    if (sel === undefined) return strs;
    return strs.filter((_, idx) => sel[`${fieldKey}:${idx}`] === true);
  };

  const filterSingle = (val, fieldKey) => {
    const s = val && typeof val === 'string' ? val.trim() : '';
    if (!s) return null;
    if (sel === undefined) return s;
    return sel[`${fieldKey}:0`] === true ? s : null;
  };

  return {
    mainLesson:      filterSingle(v.mainLesson,      'mainLesson'),
    keyInsights:     filterArr(v.keyInsights,         'keyInsights'),
    brainHighlights: filterArr(extractBrainHighlightsFromVideo(v), 'brainHighlights'),
    rules:           filterArr(v.rules,               'rules'),
    actionItems:     filterArr(v.actionItems,         'actionItems'),
    mistakesToAvoid: filterArr(v.mistakesToAvoid,     'mistakesToAvoid'),
    concepts:        filterArr(v.concepts,            'concepts'),
    frameworks:      filterArr(v.frameworks,        'frameworks'),
    questions:       filterArr(v.questions,         'questions'),
    quotes:          filterArr(v.quotes,              'quotes'),
  };
}

/** Maps video knowledge field → Obsidian folder under topic (ZIP / vault). */
export const ATOMIC_FIELD_TO_FOLDER = {
  mainLesson: 'Atomic/Insights',
  keyInsights: 'Atomic/Insights',
  brainHighlights: 'Atomic/Insights',
  rules: 'Atomic/Rules',
  actionItems: 'Atomic/Actions',
  mistakesToAvoid: 'Atomic/Mistakes',
  concepts: 'Atomic/Concepts',
  frameworks: 'Atomic/Frameworks',
  questions: 'Atomic/Questions',
  quotes: 'Atomic/Quotes',
};

function parseAtomicSelectionKey(key) {
  const m = /^([a-zA-Z]+):(\d+)$/.exec(String(key || ''));
  if (!m) return null;
  return { field: m[1], index: Number(m[2]) };
}

function extractAtomicItemText(video, field, index) {
  const v = video || {};
  if (field === 'mainLesson') {
    if (index !== 0) return null;
    const s = typeof v.mainLesson === 'string' ? v.mainLesson.trim() : '';
    return s || null;
  }
  const arr = field === 'brainHighlights' ? extractBrainHighlightsFromVideo(v) : v[field];
  if (!Array.isArray(arr) || !Number.isFinite(index)) return null;
  const raw = arr[index];
  return raw ? String(raw).trim() : null;
}

/**
 * Build one Obsidian atomic note per selected knowledge item (ZIP export).
 * Uses explicit `selections` only — if missing/empty/no true values, returns [].
 *
 * @returns {Array<{ title: string, type: string, folder: string, slug: string, markdown: string, sourceVideoTitle: string, sourceVideoId: string }>}
 */
export function buildAtomicNotesFromVideo(video, selections) {
  const v = video || {};
  const sel = (selections !== undefined && selections !== null) ? selections : null;
  if (!sel || typeof sel !== 'object') return [];
  const keys = Object.keys(sel).filter((k) => sel[k] === true);
  if (keys.length === 0) return [];

  const primaryTopic = resolvePrimaryTopic(v);
  const videoSlug = slugify(v.title || 'video', 40) || 'video';
  const videoBasename = `V-${videoSlug}`;
  const videoWikiPath = `${primaryTopic}/Learnings/${videoBasename}`;
  const videoDisplayTitle = String(v.title || 'Video')
    .replace(/[\[\]]/g, ' ')
    .replace(/\|/g, ' ')
    .trim() || 'Video';
  const youtubeUrl =
    v.url || (v.videoId ? `https://youtube.com/watch?v=${encodeURIComponent(v.videoId)}` : null);
  const videoIdStr = String(v.videoId || v.id || '').trim();
  const d = toDateStr(v.publishedAt || v.analyzedAt);
  const created = toISOCreated(v.analyzedAt || v.publishedAt);

  const fieldOrder = Object.keys(ATOMIC_FIELD_TO_FOLDER);
  keys.sort((a, b) => {
    const pa = parseAtomicSelectionKey(a);
    const pb = parseAtomicSelectionKey(b);
    if (!pa || !pb) return String(a).localeCompare(String(b));
    const ia = fieldOrder.indexOf(pa.field);
    const ib = fieldOrder.indexOf(pb.field);
    if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    if (pa.index !== pb.index) return pa.index - pb.index;
    return a.localeCompare(b);
  });

  const usedSlugs = new Set();
  const out = [];

  for (const key of keys) {
    const parsed = parseAtomicSelectionKey(key);
    if (!parsed) continue;
    const { field, index } = parsed;
    const folder = ATOMIC_FIELD_TO_FOLDER[field];
    if (!folder) continue;
    const body = extractAtomicItemText(v, field, index);
    if (!body) continue;

    const noteTitle = (body.split('\n')[0] || body).trim().slice(0, 100) || `${field} ${index + 1}`;
    let baseSlug = slugify(`${field}-${index}-${videoSlug}-${body.slice(0, 48)}`, 55);
    if (!baseSlug) baseSlug = `${field}-${index}`;
    let slug = baseSlug;
    let n = 0;
    while (usedSlugs.has(slug)) {
      n += 1;
      slug = `${baseSlug}-${n}`;
    }
    usedSlugs.add(slug);

    const sourceWiki = `[[${videoWikiPath}|${videoDisplayTitle}]]`;
    const typeTag = cleanTag(field) || 'atomic';

    const markdown = [
      '---',
      `type: atomic-${typeTag}`,
      `atomic_field: ${field}`,
      `topic: ${primaryTopic || 'General'}`,
      `source: "${String(sourceWiki).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
      `tags: [${['atomic', typeTag].map(cleanTag).filter(Boolean).join(', ')}]`,
      `date: ${d}`,
      `created: ${created}`,
      '---',
      '',
      `# ${noteTitle}`,
      '',
      body,
      '',
      '## Source',
      `- Video: ${sourceWiki}`,
      ...(youtubeUrl ? [`- URL: ${youtubeUrl}`] : []),
      ...(videoIdStr ? [`- Video ID: ${videoIdStr}`] : []),
      '',
    ].join('\n');

    out.push({
      title: noteTitle,
      type: field,
      folder,
      slug,
      markdown,
      sourceVideoTitle: v.title || '',
      sourceVideoId: videoIdStr,
    });
  }

  return out;
}

export function buildAtomicKnowledgeMarkdown(video, selections) {
  const v = video || {};
  const selected = getSelectedAtomicKnowledge(v, selections);
  selected.keyInsights = Array.from(new Set([
    ...selected.brainHighlights,
    ...selected.keyInsights,
  ].filter(Boolean)));

  const meaningful = (s) =>
    s && typeof s === 'string' && s.trim() && s.trim() !== 'לא צוין בתמלול';
  const hasArr = (a) => Array.isArray(a) && a.length > 0;

  const hasStructured =
    meaningful(selected.mainLesson)    ||
    hasArr(selected.keyInsights)       ||
    hasArr(selected.rules)             ||
    hasArr(selected.actionItems)       ||
    hasArr(selected.mistakesToAvoid)   ||
    hasArr(selected.concepts)          ||
    hasArr(selected.frameworks)      ||
    hasArr(selected.questions)       ||
    hasArr(selected.quotes);

  if (!hasStructured) return null;

  const atomicSection = (heading, items) => {
    const filtered = (Array.isArray(items) ? items : []).filter(Boolean);
    if (!filtered.length) return [];
    return [heading, ...filtered.map((i) => `- ${i}`), ''];
  };

  const chapters = (v.aiChapters || v.chapters || []).filter(Boolean);
  const chapterLines = chapters.map((ch) => {
    const ts = ch.timestamp ||
      (Number.isFinite(ch.startSeconds) ? secondsToTimestamp(ch.startSeconds) : '');
    const title = ch.title || ch.heading || '';
    const desc  = ch.description || ch.summary || '';
    return `- **[${ts}]** ${title}${desc ? ` — ${desc}` : ''}`;
  });

  const youtubeUrl = v.url ||
    (v.videoId ? `https://youtube.com/watch?v=${v.videoId}` : null);

  const lines = [
    ...(meaningful(selected.mainLesson) ? ['## 🎯 Core Idea', selected.mainLesson, ''] : []),
    ...atomicSection('## ⚡ Insights',           selected.keyInsights),
    ...atomicSection('## ✅ Rules & Principles',  selected.rules),
    ...atomicSection('## 🔁 Actions',             selected.actionItems),
    ...atomicSection('## ⚠️ Mistakes / Risks',    selected.mistakesToAvoid),
    ...atomicSection('## 🧩 Concepts',            selected.concepts),
    ...atomicSection('## 🏗️ Frameworks',         selected.frameworks),
    ...atomicSection('## ❓ Questions',           selected.questions),
    ...atomicSection('## 💬 Quotes',              selected.quotes),
    ...(chapterLines.length ? ['## 📹 Chapters', ...chapterLines, ''] : []),
    '## 📝 Personal Notes',
    '[מלא ידנית]',
    '',
    ...(youtubeUrl
      ? ['## 🔗 Source', `[${v.title || 'YouTube'}](${youtubeUrl})`, '']
      : []),
  ];

  return lines.join('\n').trim();
}

// ── Full Video Note (one-click rich export) ───────────────────────────────────
// Combines ALL available data: AI summary, chapters, keyPoints, rules,
// actionItems, mistakesToAvoid, learning notes, and manual/NotebookLM notes.

const SOURCE_LABELS_HEB = { manual: 'ידני', notebooklm: 'NotebookLM', research: 'מחקר' };

export function buildVideoFullNote(video, mentorName = '', primaryTopicOverride = null, notes = [], manualNotes = [], exportOptions = undefined) {
  const opts = exportOptions && typeof exportOptions === 'object' ? exportOptions : {};
  const primaryTopic = primaryTopicOverride || resolvePrimaryTopic(video);
  const d = toDateStr(video.publishedAt || video.analyzedAt);
  const created = toISOCreated(video.analyzedAt || video.publishedAt);

  const tags = [
    ...(video.tags || []).map(cleanTag),
    ...(mentorName ? [cleanTag(mentorName)] : []),
  ].filter(Boolean);

  // Build YouTube URL from url field or videoId
  const youtubeUrl = video.url ||
    (video.videoId ? `https://youtube.com/watch?v=${video.videoId}` : null);

  const filename = `V-${slugify(video.title || 'video', 40)}.md`;

  // Chapters: prefer aiChapters, fall back to chapters[]
  const chapters = (video.aiChapters || video.chapters || []).filter(Boolean);
  const chaptersLines = chapters.map((ch) => {
    const ts = ch.timestamp ||
      (Number.isFinite(ch.startSeconds) ? secondsToTimestamp(ch.startSeconds) : '');
    const title = ch.title || ch.heading || '';
    const desc = ch.description || ch.summary || '';
    return `- **[${ts}]** ${title}${desc ? ` — ${desc}` : ''}`;
  });

  // Manual notes / NotebookLM section
  const manualLines = manualNotes.length > 0
    ? manualNotes.map((n) => {
        const type = SOURCE_LABELS_HEB[n.sourceType] || n.sourceType;
        return `### ${n.title} *(${type})*\n${(n.content || '').trim()}`;
      })
    : [];

  const frontmatter = buildFrontmatter({
    type: 'video-analysis',
    topic: primaryTopic,
    format: video?.obsidianFormat || video?.obsidianTemplate || null,
    source: 'YouTube',
    channel: mentorName || video.channelTitle || '',
    tags,
    date: d,
    created,
    related: mentorName ? [mentorName] : [],
  });

  // Helper: add a section only if it has content
  const sec = (heading, body) => body ? [heading, body, ''] : [];

  const headerParts = [
    youtubeUrl ? `[YouTube](${youtubeUrl})` : null,
    mentorName ? `ערוץ: [[${mentorName}]]` : null,
    video.publishedAt ? toDateStr(video.publishedAt) : null,
  ].filter(Boolean);

  // Body: atomic knowledge primary → brainSummary fallback → summary fallback
  const selForMarkdown = opts.selections !== undefined ? opts.selections : undefined;
  const atomicBody = buildAtomicKnowledgeMarkdown(video, selForMarkdown);

  const lines = [
    frontmatter,
    '',
    `# ${video.title || 'Video Analysis'}`,
    '',
    ...(headerParts.length ? [`> ${headerParts.join(' · ')}`, ''] : []),
    '',
    ...(atomicBody
      ? [atomicBody, '']
      : [
          ...sec('## סיכום קצר', (video.shortSummary || '').trim() || null),
          ...sec('## סיכום מלא',  (video.fullSummary  || '').trim() || null),
          ...sec('## נקודות מפתח', listLines(video.keyPoints)),
          ...(chaptersLines.length ? ['## פרקים', ...chaptersLines, ''] : []),
          ...sec('## תובנות',      listLines(video.keyInsights)),
          ...sec('## כללים',       listLines(video.rules)),
          ...sec('## פעולות',      listLines(video.actionItems)),
          ...sec('## טעויות להימנע', listLines(video.mistakesToAvoid)),
          ...(video.brainSummary ? ['', '---', '', '## 🧠 Brain Summary', '', video.brainSummary.trim(), ''] : []),
        ]
    ),
  ];

  if (Array.isArray(opts.atomicWikiLinks) && opts.atomicWikiLinks.length > 0) {
    lines.push(
      '## 🧩 Atomic Notes',
      '',
      ...opts.atomicWikiLinks.map((p) => `- [[${p}]]`),
      ''
    );
  }

  // User learning notes (NoteEditor)
  const notesSection = buildNotesSection(notes);
  if (notesSection) { lines.push(notesSection, ''); }

  // External manual / NotebookLM notes
  if (manualLines.length > 0) {
    lines.push('## הערות ידע חיצוני', '', ...manualLines.flatMap((l) => [l, '']),  '');
  }

  const content = lines.join('\n');
  return { content, filename, path: getExportPath('learning', primaryTopic, filename) };
}

// ── Export utilities ──────────────────────────────────────────────────────────

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

export function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
