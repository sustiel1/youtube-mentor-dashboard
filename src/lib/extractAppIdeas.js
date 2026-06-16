/**
 * App Ideas Brain — lightweight adapter (presentation / extraction only).
 * Converts existing AI output into reusable application-building blocks.
 * Does NOT mutate GEM schemas or invent content.
 */
import { valueToDisplayItems } from '@/lib/universalTabSections';
import { getSpecializedSrc } from '@/lib/morningBriefDisplay';

export const APP_IDEAS_BRAIN_SECTIONS = [
  { key: 'ideas', emoji: '💡', labelHe: 'רעיונות לאפליקציות', file: 'Ideas.md' },
  { key: 'features', emoji: '⭐', labelHe: "פיצ'רים", file: 'Features.md' },
  { key: 'screens', emoji: '🖥️', labelHe: 'מסכים', file: 'Screens.md' },
  { key: 'logic', emoji: '🧠', labelHe: 'לוגיקה עסקית', file: 'Logic.md' },
  { key: 'dataModels', emoji: '📦', labelHe: 'מודלים של נתונים', file: 'DataModels.md' },
  { key: 'triggers', emoji: '🎯', labelHe: 'טריגרים והתראות', file: 'Triggers.md' },
  { key: 'risks', emoji: '⚠️', labelHe: 'סיכונים', file: 'Risks.md' },
  { key: 'tasks', emoji: '📋', labelHe: 'משימות', file: 'Tasks.md' },
  { key: 'research', emoji: '🔬', labelHe: 'נושאי מחקר', file: 'Research.md' },
];

const IDEA_SUFFIX_RULES = [
  { re: /pivot\s+high\/low|pivot\s+(?:high|low)/i, suffix: 'Breakout Scanner' },
  { re: /dilut/i, suffix: 'Risk Detector' },
  { re: /pre-?ipo|private\s+allocat/i, suffix: 'Opportunity Tracker' },
  { re: /breakout|crosses?\s+above|מעל\s+\d/i, suffix: 'Breakout Alert Engine' },
  { re: /relative\s+volume|נפח\s+יחסי/i, suffix: 'Volume Scanner' },
  { re: /sector\s+(?:rotation|strength)|סקטור/i, suffix: 'Sector Tool' },
  { re: /heatmap/i, suffix: 'Heatmap Dashboard' },
  { re: /watchlist|רשימת\s+מעקב/i, suffix: 'Watchlist Manager' },
  { re: /alert|התראה|trigger/i, suffix: 'Alert Engine' },
];

const RESEARCH_RE = /ipo|valuation|anthropic|openai|fed\s+chair|research|מחקר|הערכת\s+שווי/i;

function hashContent(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function pickArray(obj, ...keys) {
  for (const key of keys) {
    const val = obj?.[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return [];
}

function flattenItem(val) {
  return valueToDisplayItems(val).join('\n').trim();
}

function deriveIdeaTitle(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  for (const { re, suffix } of IDEA_SUFFIX_RULES) {
    if (re.test(t)) {
      const head = t.split(/[.!?\n]/)[0].trim();
      const words = head.split(/\s+/).slice(0, 4).join(' ');
      const subject = words.replace(/\b(allows?|enables?|helps?|for|the|a|an)\b/gi, '').trim();
      if (subject.length > 3 && subject.length < 40) return `${subject} ${suffix}`;
      return suffix;
    }
  }
  const first = t.split(/[.!?\n]/)[0].trim();
  return first.length <= 72 ? first : `${first.slice(0, 69)}…`;
}

function makeItem(category, { title, content, sourceField, sourcePath, videoId }) {
  const body = String(content || '').trim();
  if (!body) return null;
  const displayTitle = String(title || deriveIdeaTitle(body) || body.split('\n')[0]).trim().slice(0, 120);
  return {
    id: `${category}::${hashContent(`${body}::${sourcePath}`)}`,
    category,
    title: displayTitle,
    content: body,
    sourceField,
    sourcePath,
    videoId: videoId || null,
  };
}

function pushUnique(bucket, item, seen) {
  if (!item || seen.has(item.id)) return;
  seen.add(item.id);
  bucket.push(item);
}

function collectLines(bucket, category, raw, sourceField, sourcePath, videoId, seen, titleFn) {
  const items = valueToDisplayItems(raw);
  for (const line of items) {
    const content = String(line || '').trim();
    if (!content) continue;
    pushUnique(
      bucket,
      makeItem(category, {
        title: titleFn ? titleFn(content) : content.split('\n')[0].slice(0, 80),
        content,
        sourceField,
        sourcePath,
        videoId,
      }),
      seen,
    );
  }
}

function formatLevelRow(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);
  const sym = item.symbol || item.ticker || item.name || item.asset || '';
  const level = item.level ?? item.price ?? item.target ?? item.value ?? '';
  const note = item.note || item.description || item.comment || '';
  const parts = [sym, level && `level ${level}`, note].filter(Boolean);
  return parts.join(' — ').trim();
}

function resolveSources(video, marketBriefData) {
  const mbd = marketBriefData || video?.marketBriefData || {};
  const ut = mbd.universalTabs || {};
  const utApp = ut.app || ut.appBuilder || mbd.appBuilding || video?.analysis?.appBuilding || {};
  const utInsights = ut.insights || {};
  const utUseful = ut.usefulKnowledge || {};
  const utTopics = ut.topicsSubtopics || {};
  const spec = getSpecializedSrc(mbd) || ut.specialized || mbd;
  const brain = mbd.brainKnowledge && typeof mbd.brainKnowledge === 'object' ? mbd.brainKnowledge : {};

  return { mbd, utApp, utInsights, utUseful, utTopics, spec, brain };
}

/**
 * @param {object} video
 * @param {object|null} marketBriefData
 * @returns {Record<string, object[]>}
 */
export function extractAppIdeas(video, marketBriefData = null) {
  const videoId = video?.videoId || video?.id || '';
  const { mbd, utApp, utInsights, utUseful, utTopics, spec, brain } = resolveSources(video, marketBriefData);
  const seen = new Set();
  const out = Object.fromEntries(APP_IDEAS_BRAIN_SECTIONS.map((s) => [s.key, []]));

  // ── Ideas + Features from app building ───────────────────────────────────
  for (const raw of pickArray(utApp, 'suggestedFeatures')) {
    const feature = typeof raw === 'object' && raw
      ? String(raw.feature || raw.name || raw.title || '').trim()
      : '';
    const reason = typeof raw === 'object' && raw
      ? String(raw.reason || raw.description || raw.why || '').trim()
      : '';
    const content = [feature, reason].filter(Boolean).join(': ') || flattenItem(raw);
    if (!content) continue;
    pushUnique(
      out.ideas,
      makeItem('ideas', {
        title: feature ? `${feature} App` : deriveIdeaTitle(content),
        content,
        sourceField: 'suggestedFeatures',
        sourcePath: 'universalTabs.app.suggestedFeatures',
        videoId,
      }),
      seen,
    );
    pushUnique(
      out.features,
      makeItem('features', { title: feature || content, content, sourceField: 'suggestedFeatures', sourcePath: 'universalTabs.app.suggestedFeatures', videoId }),
      seen,
    );
  }

  const appFields = [
    { key: 'componentSuggestions', categories: ['features', 'tasks', 'screens'], path: 'universalTabs.app.componentSuggestions' },
    { key: 'dashboardUpdates', categories: ['features', 'screens'], path: 'universalTabs.app.dashboardUpdates' },
    { key: 'dashboards', categories: ['screens'], path: 'universalTabs.app.dashboards' },
    { key: 'newIndicators', categories: ['ideas', 'features', 'logic'], path: 'universalTabs.app.newIndicators' },
    { key: 'screeningCriteria', categories: ['logic'], path: 'universalTabs.app.screeningCriteria' },
    { key: 'alerts', categories: ['triggers', 'risks'], path: 'universalTabs.app.alerts' },
    { key: 'kpiList', categories: ['features', 'dataModels'], path: 'universalTabs.app.kpiList' },
    { key: 'dataPoints', categories: ['dataModels', 'features'], path: 'universalTabs.app.dataPoints' },
    { key: 'dataFields', categories: ['dataModels'], path: 'universalTabs.app.dataFields' },
  ];

  for (const { key, categories, path } of appFields) {
    const raw = utApp?.[key];
    for (const cat of categories) {
      const titleFn = cat === 'ideas' ? deriveIdeaTitle : null;
      collectLines(out[cat], cat, raw, key, path, videoId, seen, titleFn);
    }
  }

  // ── Insights ─────────────────────────────────────────────────────────────
  collectLines(out.ideas, 'ideas', pickArray(utInsights, 'learningInsights'), 'learningInsights', 'universalTabs.insights.learningInsights', videoId, seen, deriveIdeaTitle);
  collectLines(out.logic, 'logic', pickArray(utInsights, 'marketLessons'), 'marketLessons', 'universalTabs.insights.marketLessons', videoId, seen, null);
  collectLines(out.logic, 'logic', pickArray(utInsights, 'tradingInsights'), 'tradingInsights', 'universalTabs.insights.tradingInsights', videoId, seen, null);
  collectLines(out.research, 'research', pickArray(utInsights, 'top5Insights').filter((t) => RESEARCH_RE.test(String(t))), 'top5Insights', 'universalTabs.insights.top5Insights', videoId, seen, null);

  // ── Useful knowledge ─────────────────────────────────────────────────────
  for (const line of valueToDisplayItems(pickArray(utUseful, 'reusableKnowledge'))) {
    const content = String(line).trim();
    if (!content) continue;
    if (IDEA_SUFFIX_RULES.some(({ re }) => re.test(content))) {
      pushUnique(out.ideas, makeItem('ideas', { title: deriveIdeaTitle(content), content, sourceField: 'reusableKnowledge', sourcePath: 'universalTabs.usefulKnowledge.reusableKnowledge', videoId }), seen);
    }
    pushUnique(out.features, makeItem('features', { title: content.split('\n')[0], content, sourceField: 'reusableKnowledge', sourcePath: 'universalTabs.usefulKnowledge.reusableKnowledge', videoId }), seen);
  }
  collectLines(out.tasks, 'tasks', pickArray(utUseful, 'actionChecklist'), 'actionChecklist', 'universalTabs.usefulKnowledge.actionChecklist', videoId, seen, null);
  collectLines(out.risks, 'risks', pickArray(utUseful, 'mistakesToAvoid', 'riskManagement'), 'mistakesToAvoid', 'universalTabs.usefulKnowledge.mistakesToAvoid', videoId, seen, null);

  // ── Legacy flat on marketBriefData ───────────────────────────────────────
  collectLines(out.ideas, 'ideas', pickArray(mbd, 'reusableKnowledge'), 'reusableKnowledge', 'marketBriefData.reusableKnowledge', videoId, seen, deriveIdeaTitle);
  collectLines(out.tasks, 'tasks', pickArray(mbd, 'actionChecklist'), 'actionChecklist', 'marketBriefData.actionChecklist', videoId, seen, null);
  collectLines(out.research, 'research', pickArray(mbd, 'futureResearchTopics'), 'futureResearchTopics', 'marketBriefData.futureResearchTopics', videoId, seen, null);
  collectLines(
    out.research,
    'research',
    pickArray(mbd, 'top5Insights').filter((t) => RESEARCH_RE.test(String(t))),
    'top5Insights',
    'marketBriefData.top5Insights',
    videoId,
    seen,
    null,
  );

  // ── Specialized / market brief ─────────────────────────────────────────
  collectLines(out.risks, 'risks', pickArray(spec, 'risks'), 'risks', 'specialized.risks', videoId, seen, null);
  collectLines(out.triggers, 'triggers', pickArray(spec, 'alerts'), 'alerts', 'specialized.alerts', videoId, seen, null);

  for (const row of pickArray(spec, 'watchlistLevels', 'keyLevels')) {
    const content = formatLevelRow(row);
    if (!content) continue;
    pushUnique(out.triggers, makeItem('triggers', { title: content, content, sourceField: 'watchlistLevels', sourcePath: 'specialized.watchlistLevels', videoId }), seen);
  }

  for (const row of pickArray(spec, 'tradingOpportunities', 'opportunities', 'trades')) {
    const content = flattenItem(row);
    if (!content) continue;
    pushUnique(out.triggers, makeItem('triggers', { title: content.split('\n')[0], content, sourceField: 'tradingOpportunities', sourcePath: 'specialized.tradingOpportunities', videoId }), seen);
    pushUnique(out.ideas, makeItem('ideas', { title: deriveIdeaTitle(content), content, sourceField: 'tradingOpportunities', sourcePath: 'specialized.tradingOpportunities', videoId }), seen);
  }

  // ── brainKnowledge shell (no schema change — read arrays if present) ─────
  for (const [key, val] of Object.entries(brain)) {
    if (!Array.isArray(val)) continue;
    const path = `brainKnowledge.${key}`;
    const isResearch = /research|topic|future/i.test(key);
    const cat = isResearch ? 'research' : 'features';
    collectLines(out[cat], cat, val, key, path, videoId, seen, cat === 'ideas' ? deriveIdeaTitle : null);
  }

  // ── Research from topics mapping ─────────────────────────────────────────
  collectLines(out.research, 'research', pickArray(utTopics, 'relatedTopics', 'suggestedSubTopics'), 'relatedTopics', 'universalTabs.topicsSubtopics.relatedTopics', videoId, seen, null);

  return out;
}

/** Flat list of all extracted items with section metadata. */
export function flattenAppIdeasBrain(extracted) {
  const items = [];
  for (const section of APP_IDEAS_BRAIN_SECTIONS) {
    for (const item of extracted[section.key] || []) {
      items.push({ ...item, sectionKey: section.key, sectionLabel: section.labelHe });
    }
  }
  return items;
}

export function countAppIdeasBrain(extracted) {
  return flattenAppIdeasBrain(extracted).length;
}
