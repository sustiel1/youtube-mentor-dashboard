// Obsidian-compatible Markdown export engine — v2
import { getObsidianPrimaryByTopicId, getAppIdeasFolder } from "@/lib/topicRules";
// Supports: topic-based pathing, LLM-ready headings, temporal YAML, weekly recap.
//
// Root folders map directly to semantic destinations inside the vault.
// Examples: /שוק ההון/ניתוח טכני  /טכנולוגיה ו-AI  /בריאות ותזונה  /ידע אישי/למידה
//
// Filename patterns:
//   Daily:         YYYY-MM-DD.md
//   Session:       S-YYYY-MM-DD-[brief-title].md
//   Learning:      L-[short-topic].md
//   Weekly Recap:  W-YYYY-[WW].md

// ── Constants ─────────────────────────────────────────────────────────────────

// Obsidian-first knowledge model:
// Root is always a semantic topic path inside the vault.
import {
  DEFAULT_OBSIDIAN_VAULT_NAME,
  buildObsidianOpenUrl,
  getConfiguredObsidianVaultName,
} from "./obsidianVaultConfig";
import {
  buildObsidianVideoFileName,
  resolveObsidianFolderFromTaxonomy,
  resolveVideoObsidianRoute,
} from "./obsidianRouting.js";
import { applyObsidianExportMetadata } from "./obsidianExportMetadata.js";

export { applyObsidianExportMetadata, buildVaultExportMetadataPayload } from "./obsidianExportMetadata.js";

function finalizeObsidianExport(content, video, exportOptions = {}) {
  if (!video || exportOptions?.skipMetadata) return content;
  return applyObsidianExportMetadata(content, video, exportOptions);
}

export const OBSIDIAN_VAULT_NAME = DEFAULT_OBSIDIAN_VAULT_NAME;

export const OBSIDIAN_FOLDER_CATALOG = {
  'שוק ההון': [
    // ── Folders that physically exist in the vault ──────────────────────
    'שוק ההון/סרטונים',                         // video exports (V-*.md)
    'שוק ההון/ספריית ידע/ניתוח טכני',
    'שוק ההון/ספריית ידע/ניתוח חדשות',
    'שוק ההון/ספריית ידע/אינדיקטורים',
    'שוק ההון/ספריית ידע/אסטרטגיות',
    'שוק ההון/ספריית ידע/ניהול סיכונים',
    'שוק ההון/ספריית ידע/פונדמנטלי',
    'שוק ההון/ספריית ידע/מאקרו',
    'שוק ההון/ספריית ידע/פסיכולוגיית מסחר',
    'שוק ההון/ספריית ידע/הערכת שווי',
    'שוק ההון/ספריית ידע/סקטורים ותעשיות',
    'שוק ההון/ספריית ידע/ETF',
    'שוק ההון/ספריית ידע/AI והשקעות',
    'שוק ההון/ספריית ידע/בניית אפליקציה',
    "שוק ההון/ספריית ידע/צ'קליסטים",
    'שוק ההון/ניתוח פונדמנטלי',
    'שוק ההון/מדד ה VIX',
    // ── Logical folders (may not yet exist — created on first save) ──────
    'שוק ההון/ניתוח טכני',
    'שוק ההון/מסחר יומי',
    'שוק ההון/מסחר סווינג',
    'שוק ההון/אופציות',
    'שוק ההון/מאקרו',
    'שוק ההון/מניות AI',
    'שוק ההון/דוחות ורווחים',
    'שוק ההון/השקעות לטווח ארוך',
    'שוק ההון/שיטת הרצפים',
  ],
  'טכנולוגיה ו-AI': [
    'טכנולוגיה ו-AI',
    'טכנולוגיה ו-AI/מודלים סיניים',
    'טכנולוגיה ו-AI/AI Workflows',
    'טכנולוגיה ו-AI/APIs & Integrations',
    'טכנולוגיה ו-AI/Automation',
    'טכנולוגיה ו-AI/Backend',
    'טכנולוגיה ו-AI/Base44',
    'טכנולוגיה ו-AI/ChatGPT',
    'טכנולוגיה ו-AI/Claude Code',
    'טכנולוגיה ו-AI/Codex',
    'טכנולוגיה ו-AI/Cursor',
    'טכנולוגיה ו-AI/Debugging & QA',
    'טכנולוגיה ו-AI/Frontend',
    'טכנולוגיה ו-AI/Gemini',
    'טכנולוגיה ו-AI/Local LLMs',
    'טכנולוגיה ו-AI/n8n',
    'טכנולוגיה ו-AI/Obsidian',
    'טכנולוגיה ו-AI/Ollama',
    'טכנולוגיה ו-AI/Perplexity',
    'טכנולוגיה ו-AI/Prompt Engineering',
    'טכנולוגיה ו-AI/RAG & Knowledge Systems',
    'טכנולוגיה ו-AI/React',
  ],
  'בריאות ותזונה': [
    'בריאות ותזונה',
    'בריאות ותזונה/בדיקות ומעקב',
    'בריאות ותזונה/גלידות וקינוחים',
    'בריאות ותזונה/ירידה במשקל',
    'בריאות ותזונה/לחמים וקמחים',
    'בריאות ותזונה/מדי סוכר',
    'בריאות ותזונה/מתכונים בריאים',
    'בריאות ותזונה/סכרת',
    'בריאות ותזונה/פעילות גופנית',
    'בריאות ותזונה/קיטו',
    'בריאות ותזונה/תוספים וזהירות',
    'בריאות ותזונה/תזונה דלת פחמימות',
  ],
  'ידע אישי': [
    'ידע אישי/החלטות',
    'ידע אישי/למידה',
    'ידע אישי/משימות',
    'ידע אישי/סיכומים',
    'ידע אישי/ציקליסטים',
    'ידע אישי/ריאיונות',
    'ידע אישי/תובנות אישיות',
    'ידע אישי/תוכניות',
  ],
  'פוליטיקה': [
    // ── Folders that physically exist in the vault ──────────────────────
    'פוליטיקה/דת ומדינה',
    'פוליטיקה/הכיבוש',
    'פוליטיקה/חרדים וגיוס',
    'פוליטיקה/מערכת המשפט',
    'פוליטיקה/ערבים ויהודים',
    'פוליטיקה/שלום עם הפלסטינים',
    'פוליטיקה/עסקת חטופים 7.10.23',
    'פוליטיקה/דיור',
    // ── Logical folders (created on first save) ─────────────────────────
    'פוליטיקה/בחירות',
    'פוליטיקה/ביטחון וצבא',
    'פוליטיקה/גיאופוליטיקה',
    'פוליטיקה/דמוקרטיה ומוסדות',
    'פוליטיקה/טראמפ',
    'פוליטיקה/כלכלה וחברה',
    'פוליטיקה/מדינת הלכה',
    'פוליטיקה/מחאה ואקטיביזם',
    'פוליטיקה/משיחיים',
    'פוליטיקה/פוליטיקה פנימית',
    'פוליטיקה/ריאיונות וזומק',
    'פוליטיקה/שחיתות ושלטון',
    'פוליטיקה/תקשורת ותעמולה',
  ],
};

export const PRIMARY_TOPICS = Object.values(OBSIDIAN_FOLDER_CATALOG).flat();

const DEFAULT_PRIMARY_TOPIC = 'ידע אישי/למידה';
const DEFAULT_MAIN_CATEGORY = 'ידע אישי';

const CATEGORY_TO_MAIN_CATEGORY = {
  // English codes (from RSS ingestion / mentor resolver)
  Markets: 'שוק ההון',
  Stock: 'שוק ההון',
  Trading: 'שוק ההון',
  Finance: 'שוק ההון',
  'Stock Market': 'שוק ההון',
  AI: 'טכנולוגיה ו-AI',
  Technology: 'טכנולוגיה ו-AI',
  Tech: 'טכנולוגיה ו-AI',
  Dev: 'טכנולוגיה ו-AI',
  Development: 'טכנולוגיה ו-AI',
  Health: 'בריאות ותזונה',
  Nutrition: 'בריאות ותזונה',
  Personal: 'ידע אישי',
  General: 'ידע אישי',
  Politics: 'פוליטיקה',
  Political: 'פוליטיקה',
  // Hebrew labels (from normalizeCategoryName / auto-assign flow)
  'שוק ההון': 'שוק ההון',
  'פוליטיקה': 'פוליטיקה',
  'טכנולוגיה ו-AI': 'טכנולוגיה ו-AI',
  'בינה מלאכותית ואוטומציה': 'טכנולוגיה ו-AI',
  'פיתוח תוכנה': 'טכנולוגיה ו-AI',
  'בריאות ותזונה': 'בריאות ותזונה',
  'ידע אישי': 'ידע אישי',
};

const CATEGORY_TO_TOPIC = {
  // English category codes (from mentor resolver)
  Markets: 'שוק ההון/ניתוח טכני',
  Stock: 'שוק ההון/ניתוח טכני',
  Trading: 'שוק ההון/מסחר סווינג',
  Finance: 'שוק ההון/מסחר סווינג',
  'Stock Market': 'שוק ההון/ניתוח טכני',
  AI: 'טכנולוגיה ו-AI',
  Technology: 'טכנולוגיה ו-AI',
  Tech: 'טכנולוגיה ו-AI',
  Dev: 'טכנולוגיה ו-AI/Frontend',
  Development: 'טכנולוגיה ו-AI/Frontend',
  Health: 'בריאות ותזונה',
  Nutrition: 'בריאות ותזונה',
  Personal: 'ידע אישי/למידה',
  General: 'ידע אישי/למידה',
  Politics: 'פוליטיקה/פוליטיקה פנימית',
  Political: 'פוליטיקה/פוליטיקה פנימית',
  // Hebrew category labels (from GEM_CATEGORY_MAP.categoryLabel — saved by handleApplyRecommendation)
  'שוק ההון':       'שוק ההון',
  'פיתוח':          'טכנולוגיה ו-AI',
  'פוליטיקה':       'פוליטיקה',
  'בריאות':         'בריאות ותזונה',
};

const FORMAT_LABELS = new Set(['weekly', 'daily', 'session']);

const FOLDER_KEYWORD_RULES = [
  { folder: 'שוק ההון/מסחר סווינג', keywords: ['swing', 'trading', 'trade setup', 'momentum trade', 'swing trade', 'technical trading', 'מסחר סווינג', 'מסחר', 'טריידינג'] },
  { folder: 'שוק ההון/ניתוח טכני', keywords: ['technical analysis', 'chart', 'price action', 'support resistance', 'indicator', 'indicators', 'ניתוח טכני', 'גרף', 'אינדיקטור'] },
  { folder: 'שוק ההון/מאקרו', keywords: ['macro', 'economy', 'fed', 'inflation', 'rates', 'bond', 'yield', 'gdp', 'מאקרו', 'כלכלה', 'ריבית', 'אינפלציה'] },
  { folder: 'שוק ההון/אופציות', keywords: ['option', 'options', 'calls', 'puts', 'spread', 'אופציה', 'אופציות'] },
  { folder: 'שוק ההון/פונדמנטלי', keywords: ['fundamental', 'valuation', 'balance sheet', 'cash flow', 'earnings analysis', 'פונדמנטלי'] },
  { folder: 'שוק ההון/דוחות ורווחים', keywords: ['earnings', 'quarterly results', 'guidance', 'דוחות', 'רווחים'] },
  { folder: 'שוק ההון/השקעות לטווח ארוך', keywords: ['long term investing', 'investing', 'portfolio', 'compound', 'passive investing', 'השקעות לטווח ארוך'] },
  { folder: 'שוק ההון/טראמפ ושוק ההון', keywords: ['trump market', 'trump tariffs', 'טראמפ ושוק ההון'] },
  { folder: 'שוק ההון/מניות AI', keywords: ['ai stocks', 'nvidia', 'amd', 'super micro', 'מניות ai'] },
  { folder: 'שוק ההון/מסחר יומי', keywords: ['day trading', 'intraday', 'scalping', 'מסחר יומי'] },
  { folder: 'שוק ההון/ניהול סיכונים', keywords: ['risk management', 'stop loss', 'position sizing', 'ניהול סיכונים'] },
  { folder: 'שוק ההון/רשימות מעקב', keywords: ['watchlist', 'watch list', 'scanner', 'רשימות מעקב'] },
  { folder: 'שוק ההון/שיטת הרצפים', keywords: ['sequence', 'sequential', 'שיטת הרצפים'] },
  { folder: 'טכנולוגיה ו-AI/מודלים סיניים', keywords: ['deepseek', 'qwen', 'alibaba', 'moonshot', 'kimi', 'chinese model', 'מודלים סיניים'] },
  { folder: 'טכנולוגיה ו-AI/AI Workflows', keywords: ['workflow', 'workflows', 'agentic workflow', 'ai workflow'] },
  { folder: 'טכנולוגיה ו-AI/APIs & Integrations', keywords: ['api', 'apis', 'integration', 'webhook', 'sdk', 'integrations'] },
  { folder: 'טכנולוגיה ו-AI/Automation', keywords: ['automation', 'automate', 'zapier', 'make.com', 'אוטומציה'] },
  { folder: 'טכנולוגיה ו-AI/Backend', keywords: ['backend', 'server', 'database', 'auth', 'sql', 'node server'] },
  { folder: 'טכנולוגיה ו-AI/Base44', keywords: ['base44'] },
  { folder: 'טכנולוגיה ו-AI/ChatGPT', keywords: ['chatgpt', 'openai'] },
  { folder: 'טכנולוגיה ו-AI/Claude Code', keywords: ['claude code'] },
  { folder: 'טכנולוגיה ו-AI/Codex', keywords: ['codex'] },
  { folder: 'טכנולוגיה ו-AI/Cursor', keywords: ['cursor'] },
  { folder: 'טכנולוגיה ו-AI/Debugging & QA', keywords: ['debug', 'debugging', 'qa', 'test', 'playwright', 'bugfix'] },
  { folder: 'טכנולוגיה ו-AI/Frontend', keywords: ['frontend', 'ui', 'ux', 'css', 'tailwind'] },
  { folder: 'טכנולוגיה ו-AI/Gemini', keywords: ['gemini'] },
  { folder: 'טכנולוגיה ו-AI/Local LLMs', keywords: ['local llm', 'local llms', 'lm studio', 'gguf'] },
  { folder: 'טכנולוגיה ו-AI/n8n', keywords: ['n8n'] },
  { folder: 'טכנולוגיה ו-AI/Obsidian', keywords: ['obsidian', 'vault', 'markdown vault'] },
  { folder: 'טכנולוגיה ו-AI/Ollama', keywords: ['ollama'] },
  { folder: 'טכנולוגיה ו-AI/Perplexity', keywords: ['perplexity'] },
  { folder: 'טכנולוגיה ו-AI/Prompt Engineering', keywords: ['prompt engineering', 'prompt', 'system prompt'] },
  { folder: 'טכנולוגיה ו-AI/RAG & Knowledge Systems', keywords: ['rag', 'retrieval', 'knowledge base', 'knowledge system', 'vector database'] },
  { folder: 'טכנולוגיה ו-AI/React', keywords: ['react', 'jsx', 'hooks', 'component', 'frontend react'] },
  { folder: 'בריאות ותזונה/בדיקות ומעקב', keywords: ['blood work', 'lab test', 'tracking', 'glucose monitor', 'בדיקות', 'מעקב'] },
  { folder: 'בריאות ותזונה/גלידות וקינוחים', keywords: ['ice cream', 'dessert', 'גלידה', 'קינוח'] },
  { folder: 'בריאות ותזונה/ירידה במשקל', keywords: ['weight loss', 'fat loss', 'calorie deficit', 'ירידה במשקל'] },
  { folder: 'בריאות ותזונה/לחמים וקמחים', keywords: ['bread', 'flour', 'sourdough', 'לחם', 'קמח'] },
  { folder: 'בריאות ותזונה/מדי סוכר', keywords: ['cgm', 'glucose meter', 'blood sugar meter', 'מדי סוכר'] },
  { folder: 'בריאות ותזונה/מתכונים בריאים', keywords: ['recipe', 'healthy recipe', 'meal prep', 'מתכון', 'מתכונים'] },
  { folder: 'בריאות ותזונה/סכרת', keywords: ['diabetes', 'insulin resistance', 'סכרת'] },
  { folder: 'בריאות ותזונה/פעילות גופנית', keywords: ['exercise', 'workout', 'fitness', 'cardio', 'strength', 'פעילות גופנית'] },
  { folder: 'בריאות ותזונה/קיטו', keywords: ['keto', 'ketogenic', 'קטו', 'קיטו'] },
  { folder: 'בריאות ותזונה/תוספים וזהירות', keywords: ['supplement', 'supplements', 'side effect', 'toxicity', 'תוסף', 'תוספים'] },
  { folder: 'בריאות ותזונה/תזונה דלת פחמימות', keywords: ['low carb', 'low-carb', 'תזונה דלת פחמימות'] },
  { folder: 'ידע אישי/החלטות', keywords: ['decision', 'decisions', 'החלטה', 'החלטות'] },
  { folder: 'ידע אישי/למידה', keywords: ['learning', 'study', 'למידה', 'ללמוד'] },
  { folder: 'ידע אישי/משימות', keywords: ['tasks', 'todo', 'execution', 'משימות'] },
  { folder: 'ידע אישי/סיכומים', keywords: ['summary', 'recap', 'סיכום', 'סיכומים'] },
  { folder: 'ידע אישי/ציקליסטים', keywords: ['cyclist', 'cycling', 'ציקליסט', 'ציקליסטים'] },
  { folder: 'ידע אישי/ריאיונות', keywords: ['interview', 'podcast interview', 'ראיון', 'ריאיונות'] },
  { folder: 'ידע אישי/תובנות אישיות', keywords: ['personal insight', 'self reflection', 'תובנות אישיות'] },
  { folder: 'ידע אישי/תוכניות', keywords: ['plan', 'roadmap', 'planning', 'תוכנית', 'תוכניות'] },
  { folder: 'פוליטיקה/בחירות', keywords: ['election', 'campaign', 'בחירות'] },
  { folder: 'פוליטיקה/ביטחון וצבא', keywords: ['army', 'military', 'security', 'idf', 'ביטחון', 'צבא'] },
  { folder: 'פוליטיקה/גיאופוליטיקה', keywords: ['geopolitics', 'geopolitical', 'גיאופוליטיקה'] },
  { folder: 'פוליטיקה/דמוקרטיה ומוסדות', keywords: ['democracy', 'institutions', 'court reform', 'דמוקרטיה', 'מוסדות'] },
  { folder: 'פוליטיקה/הכיבוש', keywords: ['occupation', 'הכיבוש'] },
  { folder: 'פוליטיקה/חרדים וגיוס', keywords: ['haredi', 'draft', 'conscription', 'חרדים', 'גיוס'] },
  { folder: 'פוליטיקה/טראמפ', keywords: ['trump', 'טראמפ'] },
  { folder: 'פוליטיקה/כלכלה וחברה', keywords: ['society', 'social policy', 'economy policy', 'כלכלה וחברה'] },
  { folder: 'פוליטיקה/מדינת הלכה', keywords: ['halacha state', 'religion and state', 'מדינת הלכה'] },
  { folder: 'פוליטיקה/מחאה ואקטיביזם', keywords: ['protest', 'activism', 'מחאה', 'אקטיביזם'] },
  { folder: 'פוליטיקה/מערכת המשפט', keywords: ['supreme court', 'judicial', 'מערכת המשפט'] },
  { folder: 'פוליטיקה/משיחיים', keywords: ['messianic', 'משיחיים'] },
  { folder: 'פוליטיקה/פוליטיקה פנימית', keywords: ['coalition', 'knesset', 'israeli politics', 'politics', 'פוליטיקה פנימית', 'פוליטיקה'] },
  { folder: 'פוליטיקה/ריאיונות וזומק', keywords: ['zomek', 'זומק', 'political interview'] },
  { folder: 'פוליטיקה/שחיתות ושלטון', keywords: ['corruption', 'governance', 'שחיתות', 'שלטון'] },
  { folder: 'פוליטיקה/תקשורת ותעמולה', keywords: ['media', 'propaganda', 'תקשורת', 'תעמולה'] },
];

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
    // keep ASCII word chars + Hebrew Unicode block (א-ת) + spaces + hyphens
    .replace(/[^\wא-ת\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
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

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function getDetectionHaystack(video = {}) {
  return [
    video.category,
    video.primaryTopic,
    video.obsidianTopic,
    video.title,
    video.channelTitle,
    video.shortSummary,
    video.fullSummary,
    video.brainSummary,
    video.mainLesson,
    video.strategyOrMethod,
    ...(Array.isArray(video.tags) ? video.tags : []),
    ...(Array.isArray(video.keyInsights) ? video.keyInsights : []),
    ...(Array.isArray(video.keyPoints) ? video.keyPoints : []),
    ...(Array.isArray(video.actionItems) ? video.actionItems : []),
    ...(Array.isArray(video.rules) ? video.rules : []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function getMainCategoryFromPath(path) {
  const value = String(path || '').trim();
  if (!value) return null;
  const mainCategory = value.split('/')[0]?.trim();
  return mainCategory && OBSIDIAN_FOLDER_CATALOG[mainCategory] ? mainCategory : null;
}

export function getFolderOptionsForMainCategory(mainCategory) {
  return [...(OBSIDIAN_FOLDER_CATALOG[mainCategory] || [])];
}

export function getFolderOptionsForVideo(video = {}) {
  const mainCategory =
    getMainCategoryFromPath(video?.obsidianTopic) ||
    CATEGORY_TO_MAIN_CATEGORY[video?.category] ||
    getMainCategoryFromPath(resolvePrimaryTopic(video)) ||
    DEFAULT_MAIN_CATEGORY;
  return getFolderOptionsForMainCategory(mainCategory);
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
  if (video.obsidianTopic && PRIMARY_TOPICS.includes(String(video.obsidianTopic).trim())) {
    return String(video.obsidianTopic).trim();
  }

  // Priority: topicIds from mentor/classification (HARD RULE — before category keyword matching)
  const topicIds = Array.isArray(video.topicIds) ? video.topicIds : [];
  for (const tid of topicIds) {
    const folder = getObsidianPrimaryByTopicId(tid);
    if (folder) return folder;
  }

  if (video.category && CATEGORY_TO_TOPIC[video.category]) {
    const categoryFolder = CATEGORY_TO_TOPIC[video.category];
    const haystack = getDetectionHaystack(video);
    const categoryMain = getMainCategoryFromPath(categoryFolder);
    const categoryOptions = getFolderOptionsForMainCategory(categoryMain);
    const categoryMatch = FOLDER_KEYWORD_RULES.find(
      ({ folder, keywords }) =>
        categoryOptions.includes(folder) && keywords.some((kw) => haystack.includes(normalizeText(kw)))
    );
    if (categoryMatch) return categoryMatch.folder;
    return categoryFolder;
  }

  const haystack = getDetectionHaystack(video);

  for (const { folder, keywords } of FOLDER_KEYWORD_RULES) {
    if (keywords.some((kw) => haystack.includes(normalizeText(kw)))) return folder;
  }

  if (haystack.includes('ai') || haystack.includes('llm') || haystack.includes('מודל')) {
    return 'טכנולוגיה ו-AI';
  }

  return DEFAULT_PRIMARY_TOPIC;
}

function normalizePrimaryTopic(topic) {
  const value = String(topic || '').trim();
  if (!value) return null;
  if (PRIMARY_TOPICS.includes(value)) return value;
  if (OBSIDIAN_FOLDER_CATALOG[value]?.length) return OBSIDIAN_FOLDER_CATALOG[value][0];
  return CATEGORY_TO_TOPIC[value] || null;
}

/**
 * Constructs the full Obsidian vault path for a note.
 * Example: "שוק ההון/ניתוח טכני/V-some-video.md"
 */
export function getExportPath(type, primaryTopic, filename) {
  const root = normalizePrimaryTopic(primaryTopic) || DEFAULT_PRIMARY_TOPIC;
  return `${root}/${filename}`;
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
    `topic: ${normalizePrimaryTopic(topic) || DEFAULT_PRIMARY_TOPIC}`,
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
  primaryTopic = DEFAULT_PRIMARY_TOPIC,
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
  primaryTopic = DEFAULT_PRIMARY_TOPIC,
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
  primaryTopic = DEFAULT_PRIMARY_TOPIC,
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
  primaryTopic = DEFAULT_PRIMARY_TOPIC,
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
    buildFrontmatter({ type: 'weekly-recap', format: format || 'weekly', topic: normalizePrimaryTopic(primaryTopic) || DEFAULT_PRIMARY_TOPIC, source, channel, tags: ['weekly-recap', `week-${week}`], date: d, created }),
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

  return { content, filename, path: getExportPath('weekly-recap', normalizePrimaryTopic(primaryTopic) || DEFAULT_PRIMARY_TOPIC, filename) };
}

// ── Video → Note builders ─────────────────────────────────────────────────────

export function buildVideoLearningNote(video, mentorName = '', primaryTopicOverride = null, notes = [], exportOptions = {}) {
  if (video?.contentType === "pdf") return buildPdfFullObsidianExport(video, { primaryTopicOverride, notes });
  const primaryTopic = normalizePrimaryTopic(primaryTopicOverride) || resolveObsidianFolderForVideo(video);
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
  const raw = notesSection ? result.content + '\n\n' + notesSection : result.content;
  return {
    ...result,
    content: finalizeObsidianExport(raw, video, {
      analysisType: 'Useful Knowledge',
      ...exportOptions,
    }),
  };
}

export function buildVideoSessionNote(video, mentorName = '', primaryTopicOverride = null, notes = [], exportOptions = {}) {
  const primaryTopic = normalizePrimaryTopic(primaryTopicOverride) || resolveObsidianFolderForVideo(video);
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
  const raw = notesSection ? result.content + '\n\n' + notesSection : result.content;
  return {
    ...result,
    content: finalizeObsidianExport(raw, video, {
      analysisType: 'Session Export',
      ...exportOptions,
    }),
  };
}

export function buildVideoDailyNote(video, mentorName = '', primaryTopicOverride = null, notes = [], exportOptions = {}) {
  const primaryTopic = normalizePrimaryTopic(primaryTopicOverride) || resolvePrimaryTopic(video);
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
  const raw = notesSection ? result.content + '\n\n' + notesSection : result.content;
  return {
    ...result,
    content: finalizeObsidianExport(raw, video, {
      analysisType: 'Notes',
      ...exportOptions,
    }),
  };
}

// ── Notes section builder ─────────────────────────────────────────────────────

function secondsToTimestamp(s) {
  const n = Math.floor(Number(s) || 0);
  const m = Math.floor(n / 60);
  const sec = n % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function buildNotesSection(notes, { heading = '## Learning Notes' } = {}) {
  if (!Array.isArray(notes) || notes.length === 0) return null;
  const lines = [heading, ''];
  for (const note of notes) {
    const ts = note.timestampLabel || (Number.isFinite(note.timestampSeconds) ? secondsToTimestamp(note.timestampSeconds) : null);
    if (ts) lines.push(`**[${ts}]**`);
    if (note.content) lines.push(note.content.trim());
    if (Array.isArray(note.images) && note.images.length > 0) lines.push('📷 Image attached to note');
    lines.push('');
  }
  return lines.join('\n');
}

/** Standalone Obsidian export for user learning notes (Notes tab). */
export function buildVideoNotesObsidianExport(video, notes = [], exportOptions = {}) {
  const notesBody = buildNotesSection(notes, { heading: '## הערות למידה' });
  if (!notesBody) return null;

  const primaryTopic =
    normalizePrimaryTopic(exportOptions.primaryTopicOverride) || resolvePrimaryTopic(video);
  const filename = `N-${slugify(video?.title || 'notes', 40)}.md`;
  const content = finalizeObsidianExport(notesBody, video, {
    analysisType: 'Notes',
    ...exportOptions,
  });

  return {
    content,
    filename,
    path: getExportPath('learning', primaryTopic, filename),
  };
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

  const rawAppBuilderPoints = Array.isArray(v.appBuilderData?.allPoints)
    ? v.appBuilderData.allPoints.map(p => typeof p === 'string' ? p : String(p?.point || p?.text || '')).filter(Boolean)
    : [];

  return {
    mainLesson:        filterSingle(v.mainLesson,      'mainLesson'),
    keyInsights:       filterArr(v.keyInsights,         'keyInsights'),
    brainHighlights:   filterArr(extractBrainHighlightsFromVideo(v), 'brainHighlights'),
    keyPoints:         filterArr(v.keyPoints,           'keyPoints'),
    rules:             filterArr(v.rules,               'rules'),
    actionItems:       filterArr(v.actionItems,         'actionItems'),
    mistakesToAvoid:   filterArr(v.mistakesToAvoid,     'mistakesToAvoid'),
    concepts:          filterArr(v.concepts,            'concepts'),
    frameworks:        filterArr(v.frameworks,          'frameworks'),
    questions:         filterArr(v.questions,           'questions'),
    quotes:            filterArr(v.quotes,              'quotes'),
    appBuilderPoints:  filterArr(rawAppBuilderPoints,   'appBuilderPoints'),
  };
}

/** Maps video knowledge field → Obsidian folder under topic (ZIP / vault). */
export const ATOMIC_FIELD_TO_FOLDER = {
  mainLesson: 'Atomic/Insights',
  keyInsights: 'Atomic/Insights',
  brainHighlights: 'Atomic/Insights',
  keyPoints: 'Atomic/Insights',
  rules: 'Atomic/Rules',
  actionItems: 'Atomic/Actions',
  mistakesToAvoid: 'Atomic/Mistakes',
  concepts: 'Atomic/Concepts',
  frameworks: 'Atomic/Frameworks',
  questions: 'Atomic/Questions',
  quotes: 'Atomic/Quotes',
};

/** Maps GEMS v2.1 political sectionType → Obsidian folder path. */
export const GEMS_V2_SECTION_PATHS = {
  politicalSummary:         'פוליטיקה/סיכום פוליטי',
  ideologyAnalysis:         'פוליטיקה/אידיאולוגיה וערכים',
  theologyAnalysis:         'פוליטיקה/דת ותיאולוגיה',
  liberalJewishPerspective: 'פוליטיקה/יהדות ליברלית',
  opponentView:             'פוליטיקה/דעת הצד השני',
  debateResponses:          'פוליטיקה/תגובות לוויכוחים',
  commentBank:              'פוליטיקה/בנק תגובות',
  campaignKit:              'פוליטיקה/קיט קמפיין',
  reusableKnowledge:        'פוליטיקה/ידע רב פעמי',
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

  const primaryTopic = normalizePrimaryTopic(v?.obsidianTopic) || resolveObsidianFolderForVideo(v);
  const videoSlug = slugify(v.title || 'video', 40) || 'video';
  const videoBasename = `V-${videoSlug}`;
  const videoWikiPath = `${primaryTopic}/${videoBasename}`;
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
      `topic: ${primaryTopic || DEFAULT_PRIMARY_TOPIC}`,
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
      markdown: finalizeObsidianExport(markdown, v, { analysisType: 'Atomic Knowledge' }),
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
    meaningful(selected.mainLesson)         ||
    hasArr(selected.keyPoints)              ||
    hasArr(selected.keyInsights)            ||
    hasArr(selected.rules)                  ||
    hasArr(selected.actionItems)            ||
    hasArr(selected.mistakesToAvoid)        ||
    hasArr(selected.concepts)               ||
    hasArr(selected.frameworks)             ||
    hasArr(selected.questions)              ||
    hasArr(selected.quotes)                 ||
    hasArr(selected.appBuilderPoints);

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
    ...atomicSection('## 📌 ידע שימושי (נקודות מפתח)', selected.keyPoints),
    ...atomicSection('## ⚡ Insights',           selected.keyInsights),
    ...atomicSection('## ✅ Rules & Principles',  selected.rules),
    ...atomicSection('## 🔁 Actions',             selected.actionItems),
    ...atomicSection('## ⚠️ Mistakes / Risks',    selected.mistakesToAvoid),
    ...atomicSection('## 🧩 Concepts',            selected.concepts),
    ...atomicSection('## 🏗️ Frameworks',         selected.frameworks),
    ...atomicSection('## ❓ Questions',           selected.questions),
    ...atomicSection('## 💬 Quotes',              selected.quotes),
    ...atomicSection('## 🏗️ App Builder Points', selected.appBuilderPoints),
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
  if (video?.contentType === "pdf") return buildPdfFullObsidianExport(video, { primaryTopicOverride, notes });
  const opts = exportOptions && typeof exportOptions === 'object' ? exportOptions : {};
  const primaryTopic = normalizePrimaryTopic(primaryTopicOverride) || resolveObsidianFolderForVideo(video);
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

  const customSubtitle = typeof (v.customSubtitle ?? v.subtitle) === 'string'
    ? String(v.customSubtitle ?? v.subtitle).trim()
    : '';

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

  // Opponent-view marked sentences (political only)
  const opponentSentences = Array.isArray(opts.opponentSentences) ? opts.opponentSentences : [];
  if (opponentSentences.length > 0) {
    lines.push('## ⚔️ דעת האויב — משפטים מסומנים', '');
    opponentSentences.forEach(s => {
      lines.push(`- ⚔️ ${s.text}`);
      if (s.response) lines.push(`  - 💬 תשובה: ${s.response}`);
    });
    lines.push('');
  }

  const content = finalizeObsidianExport(lines.join('\n'), video, {
    analysisType: opts.analysisType || 'Summary',
    ...opts,
  });
  const notePath = `${primaryTopic}/${filename}`;
  console.debug("OBSIDIAN ROUTE FINAL", {
    category: video.category,
    subCategory: video.subCategory,
    obsidianTopic: video.obsidianTopic,
    resolvedFolder: primaryTopic,
    fileName: filename,
    fullPath: notePath,
  });
  return { content, filename, path: notePath };
}

// ── Full-video one-click export (all sections) ────────────────────────────────
// Generates a comprehensive single note with every available content section.
// Does NOT re-run AI — reads all fields from the video state object.


/**
 * Build Obsidian markdown lines for all GEMS v2.1 political sections.
 * Supports flat (v2.1) structure with fallback to nested legacy.
 * @param {Object} pd  - The full politicalSummary state object
 * @param {Object} vid - The video object (for metadata)
 * @returns {string[]} Markdown lines ready to spread into the export lines array
 */
function buildGemsV2PoliticalSections(pd, vid) {
  if (!pd) return [];
  const pn  = pd?.politicalSummary || {};              // nested legacy fallback
  const get = (key) => pd[key] || pn[key] || null;    // dual-structure resolver

  const videoTitle = vid?.title || '';
  const videoId    = vid?.youtubeId || vid?.id || '';
  const meta       = `> sectionType: GEMS v2.1 | videoId: ${videoId} | title: ${videoTitle}`;
  const now        = new Date().toISOString();
  const out        = [];

  // Normalize any value to an array of non-empty strings
  const toStrings = (val) => {
    if (!val) return [];
    if (typeof val === 'string') return val.trim() ? [val.trim()] : [];
    if (Array.isArray(val)) return val.map(v => {
      if (typeof v === 'string') return v.trim();
      return (v?.quote || v?.slogan || v?.comment || v?.response ||
              v?.text  || v?.point  || String(v)).trim();
    }).filter(Boolean);
    if (typeof val === 'object') return Object.values(val).flatMap(toStrings);
    return [String(val).trim()].filter(Boolean);
  };

  // Add a section built from a flat array
  const addList = (heading, data, sectionType) => {
    const items = toStrings(data);
    if (items.length === 0) {
      console.log(`[ObsidianExport] skipped empty section: ${sectionType}`);
      return;
    }
    console.log(`[ObsidianExport] exporting GEMS v2.1 section: ${sectionType}`);
    out.push(`## ${heading}`, meta, '', `> createdAt: ${now}`, '');
    items.forEach(item => out.push(`- ${item}`));
    out.push('');
    console.log(`[ObsidianExport] export success: ${sectionType}`);
  };

  // Add a section built from an object with named sub-fields
  const addObject = (heading, data, sectionType, fields) => {
    if (!data || typeof data !== 'object') {
      console.log(`[ObsidianExport] skipped empty section: ${sectionType}`);
      return;
    }
    const hasContent = fields.some(({ key }) => toStrings(data[key]).length > 0);
    if (!hasContent) {
      console.log(`[ObsidianExport] skipped empty section: ${sectionType}`);
      return;
    }
    console.log(`[ObsidianExport] exporting GEMS v2.1 section: ${sectionType}`);
    out.push(`## ${heading}`, meta, '', `> createdAt: ${now}`, '');
    fields.forEach(({ key, label }) => {
      const lines = toStrings(data[key]);
      if (lines.length === 0) return;
      out.push(`### ${label}`);
      lines.forEach(l => out.push(`- ${l}`));
      out.push('');
    });
    console.log(`[ObsidianExport] export success: ${sectionType}`);
  };

  // 1. politicalSummary
  const ps = get('politicalSummary');
  if (ps && typeof ps === 'object') {
    const psItems = [
      ps.shortSummary && `**תקציר:** ${ps.shortSummary}`,
      ps.mainClaim    && `**טענה מרכזית:** ${ps.mainClaim}`,
      ...(toStrings(ps.keyPoints)),
      ...(toStrings(ps.supportingArguments)),
      ps.bottomLine   && `**שורה תחתונה:** ${ps.bottomLine}`,
    ].filter(Boolean);
    if (psItems.length > 0) {
      console.log('[ObsidianExport] exporting GEMS v2.1 section: politicalSummary');
      out.push('## סיכום פוליטי', meta, '', `> createdAt: ${now}`, '');
      psItems.forEach(l => out.push(l));
      out.push('');
      console.log('[ObsidianExport] export success: politicalSummary');
    }
  }

  // 2. ideologyAnalysis
  addObject('⚖️ אידיאולוגיה וערכים', get('ideologyAnalysis'), 'ideologyAnalysis', [
    { key: 'politicalCamp',        label: 'מחנה פוליטי' },
    { key: 'coreValues',           label: 'ערכי ליבה' },
    { key: 'targetAudience',       label: 'קהל יעד' },
    { key: 'emotionalTriggers',    label: 'טריגרים רגשיים' },
    { key: 'persuasionTechniques', label: 'טכניקות שכנוע' },
    { key: 'hiddenAssumptions',    label: 'הנחות נסתרות' },
    { key: 'logicalWeaknesses',    label: 'חולשות לוגיות' },
  ]);

  // 3. theologyAnalysis
  addObject('✡️ דת ותיאולוגיה', get('theologyAnalysis'), 'theologyAnalysis', [
    { key: 'religiousTopics',        label: 'נושאים דתיים' },
    { key: 'jewishSources',          label: 'מקורות יהודיים' },
    { key: 'jewishValues',           label: 'ערכים יהודיים' },
    { key: 'theologicalAssumptions', label: 'הנחות תיאולוגיות' },
    { key: 'conflictingValues',      label: 'ערכים בסתירה' },
    { key: 'summary',                label: 'סיכום' },
  ]);

  // 4. liberalJewishPerspective
  addObject('יהדות ליברלית', get('liberalJewishPerspective'), 'liberalJewishPerspective', [
    { key: 'supportedValues',       label: 'ערכים נתמכים' },
    { key: 'concerns',              label: 'חששות' },
    { key: 'ethicalQuestions',      label: 'שאלות אתיות' },
    { key: 'relevantJewishSources', label: 'מקורות יהודיים' },
    { key: 'bottomLine',            label: 'שורה תחתונה' },
  ]);

  // 5. opponentView
  addObject('דעת הצד השני', get('opponentView'), 'opponentView', [
    { key: 'summary',              label: 'סיכום' },
    { key: 'strongestArguments',   label: 'הטיעונים החזקים' },
    { key: 'basicAssumptions',     label: 'הנחות יסוד' },
    { key: 'recommendedResponses', label: 'תגובות מומלצות' },
  ]);

  // 6. debateResponses — special: format as claim → response
  const dr = get('debateResponses');
  if (Array.isArray(dr) && dr.length > 0) {
    const drLines = dr.map(d =>
      typeof d === 'string' ? d
        : `${d.claim ? d.claim + ' ← ' : ''}תגובה: ${d.response || ''}`.trim()
    ).filter(Boolean);
    addList('תגובות לוויכוחים', drLines, 'debateResponses');
  }

  // 7. commentBank
  addList('בנק תגובות', get('commentBank'), 'commentBank');

  // 8. campaignKit
  addObject('קיט קמפיין', get('campaignKit'), 'campaignKit', [
    { key: 'topSlogans',         label: 'סיסמאות מובילות' },
    { key: 'topQuotes',          label: 'ציטוטים מובילים' },
    { key: 'topComments',        label: 'תגובות מובילות' },
    { key: 'topDebateResponses', label: 'תגובות ויכוח מובילות' },
    { key: 'keyIdeas',           label: 'רעיונות מרכזיים' },
  ]);

  // 9. reusableKnowledge
  addObject('ידע רב פעמי', get('reusableKnowledge'), 'reusableKnowledge', [
    { key: 'principles',         label: 'עקרונות' },
    { key: 'mentalModels',       label: 'מודלים מנטליים' },
    { key: 'historicalPatterns', label: 'דפוסים היסטוריים' },
    { key: 'strategicLessons',   label: 'לקחים אסטרטגיים' },
    { key: 'reusableArguments',  label: 'טיעונים רב פעמיים' },
  ]);

  return out;
}

// ── PDF Document Export ───────────────────────────────────────────────────────
// Generates Obsidian-compatible markdown for PDF documents (contentType:"pdf").
// Called by buildFullVideoObsidianExport, buildVideoLearningNote, buildVideoFullNote
// when contentType === "pdf" is detected — keeps YouTube logic completely untouched.
//
// Label differences vs YouTube exports:
//   "פרטי סרטון"  → "פרטי מסמך"  (metadata section)
//   "תמלול מלא"   → "טקסט שחולץ מ-PDF"  (transcript/body section)
//   source:YouTube → source:PDF  (YAML frontmatter)
//   type:video-full → type:pdf-document
function buildPdfFullObsidianExport(v, {
  primaryTopicOverride = null,
  notes = [],
  includeTranscript = true,
} = {}) {
  console.log("[ObsidianSave] Saving PDF content item:", {
    id: v.id,
    title: v.title,
    pages: v.pdfPages,
    originalFileName: v.originalFileName,
    transcriptLength: (v.transcript || v.manualTranscript || '').length,
  });

  const primaryTopic = normalizePrimaryTopic(primaryTopicOverride) || resolveObsidianFolderForVideo(v);
  const d       = toDateStr(v.addedAt || v.fetchedAt);
  const created = toISOCreated(v.addedAt || v.fetchedAt);
  const filename = `PDF-${slugify(v.title || 'document', 40)}.md`;
  const tags = [...(v.tags || []).map(cleanTag)].filter(Boolean);

  const frontmatter = buildFrontmatter({
    type: 'pdf-document',
    topic: primaryTopic,
    source: 'PDF',
    channel: '',
    tags,
    date: d,
    created,
    related: [],
  });

  const transcript = typeof (v.transcript || v.manualTranscript || '') === 'string'
    ? (v.transcript || v.manualTranscript || '').trim()
    : '';

  const sec = (heading, body) => (body ? [heading, body, ''] : []);
  const secList = (heading, arr) => {
    const items = (Array.isArray(arr) ? arr : []).map(i => String(i).trim()).filter(Boolean);
    return items.length ? [heading, ...items.map(i => `- ${i}`), ''] : [];
  };

  const lines = [
    frontmatter,
    '',
    `# ${v.title || 'PDF Document'}`,
    '',
    // One-line overview: icon, filename, page count
    `> 📄 ${v.originalFileName || (v.title + '.pdf')}${v.pdfPages ? ` · ${v.pdfPages} עמודים` : ''}`,
    '',

    // PDF-specific metadata (not YouTube metadata)
    '## פרטי מסמך',
    `- **סוג:** מסמך PDF`,
    ...(v.originalFileName ? [`- **שם קובץ מקורי:** ${v.originalFileName}`] : []),
    ...(v.pdfPages != null  ? [`- **מספר עמודים:** ${v.pdfPages}`] : []),
    ...(v.addedAt           ? [`- **תאריך ייבוא:** ${toDateStr(v.addedAt)}`] : []),
    `- **contentType:** pdf`,
    '',

    // AI analysis sections (same structure as YouTube — filled after analysis)
    ...sec('## סיכום קצר',    (v.shortSummary || '').trim() || null),
    ...sec('## סיכום מלא',    (v.fullSummary  || '').trim() || null),
    ...sec('## לקח מרכזי',    (v.mainLesson   || '').trim() || null),
    ...secList('## נקודות מפתח',    v.keyPoints),
    ...secList('## תובנות מפתח',    v.keyInsights),
    ...secList('## כללים ועקרונות', v.rules),
    ...secList('## פעולות מומלצות', v.actionItems),

    // User notes from NoteEditor
    ...(buildNotesSection(notes) ? [buildNotesSection(notes), ''] : []),

    // Extracted PDF text — renamed from "תמלול מלא" to be accurate
    ...(includeTranscript && transcript ? [
      '## טקסט שחולץ מ-PDF',
      '',
      '<details>',
      '<summary>לחץ להצגת הטקסט המלא</summary>',
      '',
      transcript,
      '',
      '</details>',
      '',
    ] : []),
  ];

  const content = finalizeObsidianExport(lines.join('\n'), v, { analysisType: 'PDF Document' });
  console.log('[ObsidianSave] PDF export generated', content.length, 'chars →', `${primaryTopic}/${filename}`);
  return {
    content,
    filename,
    path: `${primaryTopic}/${filename}`,
  };
}

export function buildFullVideoObsidianExport(video, {
  mentorName = '',
  primaryTopicOverride = null,
  notes = [],
  manualNotes = [],
  includeTranscript = true,
  politicalData = null,
} = {}) {
  const v = video || {};
  // PDF documents use a dedicated template — no YouTube-specific fields
  if (v.contentType === "pdf") return buildPdfFullObsidianExport(v, { primaryTopicOverride, notes, includeTranscript });
  const primaryTopic = normalizePrimaryTopic(primaryTopicOverride) || resolvePrimaryTopic(v);
  const d = toDateStr(v.publishedAt || v.analyzedAt);
  const created = toISOCreated(v.analyzedAt || v.publishedAt);
  const youtubeUrl = v.url || (v.videoId ? `https://youtube.com/watch?v=${v.videoId}` : null);
  const filename = `V-${slugify(v.title || 'video', 45)}.md`;

  const tags = [
    ...(v.tags || []).map(cleanTag),
    ...(mentorName ? [cleanTag(mentorName)] : []),
  ].filter(Boolean);

  const frontmatter = buildFrontmatter({
    type: 'video-full',
    topic: primaryTopic,
    source: 'YouTube',
    channel: mentorName || v.channelTitle || '',
    tags,
    date: d,
    created,
    related: mentorName ? [mentorName] : [],
  });

  const sec = (heading, body) => (body ? [heading, body, ''] : []);
  const secList = (heading, arr) => {
    const items = (Array.isArray(arr) ? arr : []).map(i => String(i).trim()).filter(Boolean);
    return items.length ? [heading, ...items.map(i => `- ${i}`), ''] : [];
  };

  // Chapters
  const chapters = (v.aiChapters || v.chapters || []).filter(Boolean);
  const chapterLines = chapters.map((ch) => {
    const ts = ch.timestamp || (Number.isFinite(ch.startSeconds) ? secondsToTimestamp(ch.startSeconds) : '');
    const title = ch.title || ch.heading || '';
    const desc = ch.description || ch.summary || '';
    return `- **[${ts}]** ${title}${desc ? ` — ${desc}` : ''}`;
  });

  // Transcript (prefer longest available source)
  const txRaw = v.transcript || v.manualTranscript || v.whisperTranscript || '';
  const transcript = typeof txRaw === 'string' ? txRaw.trim() : '';

  // Political / viral content
  const networkSlogans = (Array.isArray(v.networkSlogans) ? v.networkSlogans : [])
    .map(s => (typeof s === 'string' ? s : s?.text)).filter(Boolean);
  const politicalSlogans = (Array.isArray(v.politicalSlogans) ? v.politicalSlogans : [])
    .map(s => (typeof s === 'string' ? s : s?.text)).filter(Boolean);
  const viralQuotes = (Array.isArray(v.viralQuotes) ? v.viralQuotes : []).filter(Boolean);
  const counterArguments = (Array.isArray(v.counterArguments) ? v.counterArguments : []).filter(Boolean);

  // App builder
  const appBuilderPoints = Array.isArray(v.appBuilderData?.allPoints)
    ? v.appBuilderData.allPoints.map(p => typeof p === 'string' ? p : String(p?.point || p?.text || '')).filter(Boolean)
    : [];

  // Brain highlights
  const brainHighlights = extractBrainHighlightsFromVideo(v);
  // GEMS v2.1 political sections (built from politicalData param or video fields)
  const _pdSource = politicalData || (v.politicalSummary ? v : null);
  const gemsV2Lines = _pdSource ? buildGemsV2PoliticalSections(_pdSource, v) : [];
  if (gemsV2Lines.length > 0) console.log('[ObsidianExport] sectionType supported: GEMS v2.1 political', gemsV2Lines.length, 'lines');

  // Manual / NotebookLM notes
  const manualLines = (manualNotes || []).map(n => {
    const label = { manual: 'ידני', notebooklm: 'NotebookLM', research: 'מחקר' }[n.sourceType] || n.sourceType || '';
    return `### ${n.title || 'הערה'}${label ? ` *(${label})*` : ''}\n${(n.content || '').trim()}`;
  });

  // Debug: collect section presence
  const debugSections = {
    shortSummary: !!(v.shortSummary || '').trim(),
    fullSummary: !!(v.fullSummary || '').trim(),
    chapters: chapters.length > 0,
    keyInsights: Array.isArray(v.keyInsights) && v.keyInsights.length > 0,
    keyPoints: Array.isArray(v.keyPoints) && v.keyPoints.length > 0,
    rules: Array.isArray(v.rules) && v.rules.length > 0,
    warnings: Array.isArray(v.warnings) && v.warnings.length > 0,
    concepts: Array.isArray(v.concepts) && v.concepts.length > 0,
    actionItems: Array.isArray(v.actionItems) && v.actionItems.length > 0,
    mistakesToAvoid: Array.isArray(v.mistakesToAvoid) && v.mistakesToAvoid.length > 0,
    brainHighlights: brainHighlights.length > 0,
    notes: notes.length > 0,
    manualNotes: manualNotes.length > 0,
    networkSlogans: networkSlogans.length > 0,
    politicalSlogans: politicalSlogans.length > 0,
    viralQuotes: viralQuotes.length > 0,
    counterArguments: counterArguments.length > 0,
    appBuilderPoints: appBuilderPoints.length > 0,
    transcript: transcript.length > 0,
    gemsV2Political: gemsV2Lines.length > 0,
  };
  const sectionsFound = Object.entries(debugSections).filter(([, v]) => v).map(([k]) => k);
  const sectionsMissing = Object.entries(debugSections).filter(([, v]) => !v).map(([k]) => k);
  console.log('[FullObsidianExport] sections found:', sectionsFound);
  console.log('[FullObsidianExport] sections missing:', sectionsMissing);
  console.log('[FullObsidianExport] destination path:', `${primaryTopic}/${filename}`);

  const customSubtitle = typeof (v.customSubtitle ?? v.subtitle) === 'string'
    ? String(v.customSubtitle ?? v.subtitle).trim()
    : '';

  const headerParts = [
    youtubeUrl ? `[YouTube](${youtubeUrl})` : null,
    mentorName ? `ערוץ: [[${mentorName}]]` : v.channelTitle ? `ערוץ: ${v.channelTitle}` : null,
    v.publishedAt ? toDateStr(v.publishedAt) : null,
    v.duration ? `⏱ ${v.duration}` : null,
  ].filter(Boolean);

  const lines = [
    frontmatter,
    '',
    `# ${v.title || 'Video Analysis'}`,
    ...(customSubtitle ? [`> ${customSubtitle}`, ''] : []),
    '',
    ...(headerParts.length ? [`> ${headerParts.join(' · ')}`, ''] : []),

    // Metadata block
    '## פרטי סרטון',
    ...(v.title        ? [`- **כותרת:** ${v.title}`] : []),
    ...((mentorName || v.channelTitle) ? [`- **ערוץ:** ${mentorName || v.channelTitle}`] : []),
    ...(youtubeUrl     ? [`- **קישור:** ${youtubeUrl}`] : []),
    ...(v.analyzedAt   ? [`- **תאריך ניתוח:** ${toDateStr(v.analyzedAt)}`] : []),
    ...(v.publishedAt  ? [`- **תאריך פרסום:** ${toDateStr(v.publishedAt)}`] : []),
    ...(v.duration     ? [`- **משך:** ${v.duration}`] : []),
    ...(v.viewCount != null ? [`- **צפיות:** ${Number(v.viewCount).toLocaleString()}`] : []),
    '',

    ...sec('## סיכום קצר', (v.shortSummary || '').trim() || null),
    ...sec('## סיכום מלא',  (v.fullSummary  || '').trim() || null),
    ...sec('## לקח מרכזי',  (v.mainLesson   || '').trim() || null),

    ...(chapterLines.length ? ['## פרקים', ...chapterLines, ''] : []),

    ...secList('## תובנות מפתח',         v.keyInsights),
    ...secList('## ידע שימושי',           v.keyPoints),
    ...secList('## כללים ועקרונות',       v.rules),
    ...secList('## אזהרות',               v.warnings),
    ...secList('## מושגים',               v.concepts),
    ...secList('## פעולות מומלצות',       v.actionItems),
    ...secList('## טעויות להימנע',        v.mistakesToAvoid),
    ...secList('## 🧠 תובנות מרכזיות',    brainHighlights),

    ...(brainHighlights.length === 0 && v.brainSummary ? ['## 🧠 Brain Summary', '', v.brainSummary.trim(), ''] : []),

    // Political / viral sections (only if content exists)
    ...(viralQuotes.length > 0       ? ['## ציטוטים ויראליים', ...viralQuotes.map(q => `- "${q}"`), ''] : []),
    ...(politicalSlogans.length > 0  ? ['## סיסמאות פוליטיות', ...politicalSlogans.map(s => `- ${s}`), ''] : []),
    ...(networkSlogans.length > 0    ? ['## סיסמאות רשת', ...networkSlogans.map(s => `- ${s}`), ''] : []),
    ...(counterArguments.length > 0  ? secList('## טיעוני נגד', counterArguments) : []),

    // GEMS v2.1 political sections
    ...gemsV2Lines,

    // App builder
    ...(appBuilderPoints.length > 0 ? secList('## 🏗️ App Builder', appBuilderPoints) : []),

    // User notes (NoteEditor)
    ...(buildNotesSection(notes) ? [buildNotesSection(notes), ''] : []),

    // External notes (manual / NotebookLM)
    ...(manualLines.length > 0 ? ['## הערות ידע חיצוני', '', ...manualLines.flatMap(l => [l, '']), ''] : []),

    // Transcript (collapsed at bottom)
    ...(includeTranscript && transcript ? [
      '## תמלול מלא',
      '',
      '<details>',
      '<summary>לחץ להצגת התמלול המלא</summary>',
      '',
      transcript,
      '',
      '</details>',
      '',
    ] : []),

    // Attached Documents Insights (AI-generated section — only when analysis included PDFs)
    ...(() => {
      const ins = v.attachedDocumentsInsights;
      if (!ins) return [];
      const listSection = (heading, arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return [];
        return [`### ${heading}`, ...arr.map(i => `- ${i}`), ''];
      };
      return [
        '## 📚 תובנות ממסמכים מצורפים',
        '',
        ...(ins.overallSummary ? [ins.overallSummary, ''] : []),
        ...listSection('🔍 ממצאים מרכזיים', ins.keyFindings),
        ...listSection('✅ ראיות תומכות', ins.supportingEvidence),
        ...listSection('⚠️ סתירות עם הסרטון', ins.contradictions),
        ...listSection('💡 מושגים נוספים', ins.additionalConcepts),
      ];
    })(),

    // Attached PDF documents (list + collapsible transcript)
    ...(() => {
      const docs = Array.isArray(v.attachedDocuments) ? v.attachedDocuments : [];
      if (docs.length === 0) return [];
      console.log('[VideoPDF] Included in Obsidian export:', docs.map(d => ({ id: d.id, name: d.name })));
      const docLines = docs.flatMap(doc => [
        `### 📄 ${doc.name}`,
        ...(doc.pages ? [`- **עמודים:** ${doc.pages}`] : []),
        ...(doc.importedAt ? [`- **יובא:** ${doc.importedAt.slice(0, 10)}`] : []),
        '',
        ...(doc.transcript?.length > 50 ? [
          '<details>',
          `<summary>טקסט מ-PDF — ${Math.round(doc.transcript.length / 1000)}K תווים</summary>`,
          '',
          doc.transcript.trim(),
          '',
          '</details>',
          '',
        ] : ['*(אין טקסט חלוץ)*', '']),
      ]);
      return [
        '## 📚 מסמכים מצורפים',
        '',
        ...docLines,
      ];
    })(),
  ];

  const content = finalizeObsidianExport(lines.join('\n'), v, { analysisType: 'Full Export' });
  console.log('[FullObsidianExport] generated', content.length, 'chars →', `${primaryTopic}/${filename}`);
  return {
    content,
    filename,
    path: `${primaryTopic}/${filename}`,
    debugSections,
    sectionsFound,
    sectionsMissing,
  };
}

// ── Obsidian deep-link ────────────────────────────────────────────────────────

/**
 * Builds an obsidian:// URI that opens the matching vault file for a video.
 * Path mirrors buildVideoFullNote: {topic}/V-{slug}.md
 */
/**
 * Resolves the Obsidian folder path for the current video.
 * Priority:
 *   1. category + subCategory → direct folder match (most accurate)
 *   2. resolvePrimaryTopic fallback (topicIds → keywords → obsidianTopic)
 *
 * Does NOT use video.obsidianTopic as primary source to prevent stale cache reuse.
 */
// Per-category default folder for video exports (where V-*.md notes land in the real vault)
const VIDEO_DEFAULT_FOLDER = {
  'שוק ההון':       'שוק ההון/סרטונים',
  'פוליטיקה':       'פוליטיקה/פוליטיקה פנימית',
  'טכנולוגיה ו-AI': 'טכנולוגיה ו-AI',
  'בריאות ותזונה':  'בריאות ותזונה',
  'ידע אישי':       'ידע אישי/למידה',
};

export function resolveObsidianFolderForVideo(video = {}) {
  const taxonomyFolder = resolveObsidianFolderFromTaxonomy(video);

  // Priority 1: explicit UI selection always wins — no keyword override
  if (taxonomyFolder) return taxonomyFolder;

  // Priority 2: fallback to keyword/topicId/obsidianTopic detection
  return resolvePrimaryTopic(video);
}

export function buildObsidianUrl(video, vaultName = getConfiguredObsidianVaultName()) {
  const route = resolveVideoObsidianRoute(video || {}, {
    vaultName,
    fileName: buildObsidianVideoFileName(video || {}, { prefix: "V", maxLen: 40 }),
  });

  console.debug("OBSIDIAN OPEN FINAL", {
    category: video?.category,
    subCategory: video?.subCategory,
    resolvedFolder: route.resolvedFolder,
    fileName: route.fileName,
    fullPath: route.finalFilePath,
    url: route.obsidianUrl,
  });

  return route.obsidianUrl;
}

let lastOpenedObsidianUrl = '';
let lastOpenedObsidianAt = 0;
const OBSIDIAN_OPEN_DEDUPE_MS = 1500;

export function openObsidianUrl(url, options = {}) {
  if (!url || typeof document === 'undefined') return { called: false, url };
  const { bypassDedupe = false, method = 'anchor' } = options || {};
  const now = Date.now();
  const debug = {
    called: true,
    url,
    method,
    usedWindowOpen: false,
    windowOpenBlocked: null,
    usedAnchorClick: false,
    focusAssistAttempted: false,
    browserCannotForceExternalAppFocus: true,
    deduped: false,
  };

  if (
    !bypassDedupe &&
    url === lastOpenedObsidianUrl &&
    now - lastOpenedObsidianAt < OBSIDIAN_OPEN_DEDUPE_MS
  ) {
    debug.deduped = true;
    console.log("[ObsidianOpen] deduped", {
      url,
      lastOpenedObsidianAt,
      now,
      windowMs: OBSIDIAN_OPEN_DEDUPE_MS,
    });
    return debug;
  }

  lastOpenedObsidianUrl = url;
  lastOpenedObsidianAt = now;

  console.debug("FINAL OBSIDIAN URL", url);
  console.log("[ObsidianOpen] attempting", debug);

  if (method === 'window') {
    try {
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        debug.usedWindowOpen = true;
        debug.windowOpenBlocked = opened == null;
        console.log("[ObsidianOpen] window.open", {
          url,
          blocked: debug.windowOpenBlocked,
        });
      }
    } catch (error) {
      debug.usedWindowOpen = true;
      debug.windowOpenBlocked = true;
      console.log("[ObsidianOpen] window.open error", {
        url,
        message: error?.message || String(error),
      });
    }
  } else {
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      debug.usedAnchorClick = true;
      console.log("[ObsidianOpen] anchor.click", { url });
    } catch (error) {
      console.log("[ObsidianOpen] anchor.click error", {
        url,
        message: error?.message || String(error),
      });
    }
  }

  try {
    if (typeof window !== 'undefined' && typeof window.focus === 'function') {
      debug.focusAssistAttempted = true;
      window.setTimeout(() => {
        try {
          window.focus();
        } catch {}
      }, 120);
    }
  } catch {
    debug.focusAssistAttempted = true;
  }

  return debug;
}

// ── APP Builder Obsidian integration (§26 + §30) ─────────────────────────────

/**
 * Returns the full Obsidian path for an APP Builder note.
 * §30: only valid path is App Ideas/{folder}/{filename}.md
 */
export function getAppIdeasPath(topicName, title) {
  const folder = getAppIdeasFolder(topicName);
  const safeTitle = slugify(title || 'untitled', 60) || 'untitled';
  return `App Ideas/${folder}/${safeTitle}.md`;
}

/**
 * Builds the Obsidian markdown for an APP Builder draft.
 * sections = { summary, requirements, screens, logic, risks, tasks, prompt }
 */
export function buildAppIdeasNote(video, sections = {}, topicName = '') {
  const title = video?.title || 'Untitled';
  const videoId = video?.videoId || video?.id || '';
  const watchUrl = videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : '';
  const date = new Date().toISOString().slice(0, 10);

  const lines = [
    '---',
    `title: "${title.replace(/"/g, "'")}"`,
    `date: ${date}`,
    `source: ${watchUrl || 'manual'}`,
    `topic: "${topicName}"`,
    `tags: [app-idea, youtube-mentor]`,
    '---',
    '',
    `# 🏗️ בונה אפליקציות — ${title}`,
    '',
  ];

  const sectionDefs = [
    { key: 'summary',      label: '## 📝 סיכום — מה לבנות' },
    { key: 'requirements', label: '## 🎯 דרישות' },
    { key: 'screens',      label: '## 🖥️ מסכים' },
    { key: 'logic',        label: '## ⚙️ לוגיקה' },
    { key: 'risks',        label: '## ⚠️ סיכונים' },
    { key: 'tasks',        label: '## 📋 משימות' },
    { key: 'prompt',       label: '## 🚀 פרומפט פיתוח' },
  ];

  sectionDefs.forEach(({ key, label }) => {
    const content = sections[key]?.trim();
    if (content) {
      lines.push(label, '', content, '');
    }
  });

  return lines.join('\n');
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
