/**
 * Context-aware AI analysis question bank.
 * Maps Morning Brief / Summary section labels to targeted Hebrew questions for Perplexity.
 *
 * Routing priority (per group of items from the same section):
 *   1. Content-based detection (stock → market-wide → sector → risk)
 *   2. Section-label lookup (fallback when content signals are absent)
 *   3. Generic fallback
 *
 * Usage:
 *   import { buildContextualAiAnalysisPrompt } from '@/lib/aiAnalysisQuestionBank';
 *   const prompt = buildContextualAiAnalysisPrompt({ selectedItems, tabSlug, sourceTitle, videoDate });
 */

// ─── Section → AI question map (section-label fallback) ───────────────────────

const SECTION_QUESTION_BANK = {
  // Summary tab
  'סיכום ב-30 שניות':
    'מהן ההשלכות המאקרו של הסיכום הזה על השוק? מה הכיוון הכולל — Risk-On, ניטרלי, Risk-Off, או המתנה?',
  'מה לעקוב היום':
    'מדוע פריטים אלו דורשים מעקב היום? מה הם מסמנים? מה לחפש כדי לאשר או לבטל את הכיוון?',
  'תובנות מרכזיות':
    'נתח תובנות אלו בהקשר מאקרו. מה הן מרמזות על מצב השוק? אילו נכסים, סקטורים או מניות מושפעים?',
  'מסקנה מנהלים':
    'מה המסקנה הסופית מנקודת מבט מסחרית? האם זה Risk-On, ניטרלי, Risk-Off, או המתנה? מה הצעד הבא?',

  // Risks / opportunities
  'סיכונים מרכזיים':
    'כיצד משפיעים סיכונים אלה על תיק ההשקעות? מה ההסתברות שכל סיכון יתממש? כיצד להגן על התיק?',
  'סיכונים':
    'כיצד משפיעים סיכונים אלה? מה סדר ההשפעה על השוק? כיצד להתגונן?',
  'הזדמנויות':
    'מהו הפוטנציאל של כל הזדמנות? מה יאשר אותה? מה נקודות הכניסה וניהול הסיכון?',
  'מסקנות למסחר':
    'מה ההחלטות המסחריות הנגזרות? מה עדיפויות הפעולה והטריגרים לכניסה?',

  // Video content tabs
  'נקודות מפתח':
    'מה הנקודות המרכזיות ומה ההשלכות המעשיות שלהן למסחר?',
  'פרקים':
    'מה הנושאים המרכזיים שעלו? מהן ההשלכות המעשיות על אסטרטגיית המסחר?',
  'פעולות':
    'כיצד לבצע פעולות אלו בצורה מיטבית? מה סדר העדיפויות ומה טריגר הכניסה?',
  'כללים':
    'כיצד לישם כללים אלו? באילו תנאי שוק הם רלוונטיים ביותר?',
  'נושאים קשורים':
    'כיצד נושאים אלו קשורים לכיוון השוק הנוכחי? מה ההשלכות?',
  'תובנות':
    'נתח תובנות אלו. מה הן מרמזות על מצב השוק ועל נכסים ספציפיים?',
  'סיכום':
    'מה הנקודות המרכזיות מהסיכום? מה הן מרמזות על כיוון השוק?',

  // Macro / specialized tab
  'מניות שהוזכרו':
    'נתח מניות אלו — טכנית ופנדמנטלית. מה הפוטנציאל שלהן? האם יש אשרור כניסה?',
  'סקטורים':
    'כיצד מתפקדים סקטורים אלו? האם יש רוטציה? מה מרמז על Risk-On/Off?',
  'היילייטים':
    'מהם ההיילייטים המרכזיים ומה ההשלכות שלהם על קביעת עמדה בשוק?',
  'אזהרות ופעולות למעקב':
    'כיצד לנהל אזהרות אלו? מה לעקוב כדי לאשר או לבטל אותן?',
  'אירועי מאקרו':
    'כיצד אירועי מאקרו אלו משפיעים על שווקים? מה לעקוב?',
  'חדשות':
    'מה ההשפעה הפוטנציאלית של חדשות אלו על השוק? מה יכול לשנות את הכיוון?',
  'מצב שוק':
    'מה הניתוח הכולל של מצב השוק? מה הכיוון — Risk-On, ניטרלי, Risk-Off, המתנה?',
};

const _GENERIC_QUESTION =
  'נתח פריטים אלו מנקודת מבט שוק. מה ההשלכות המעשיות? מה כיוון השוק — Risk-On, ניטרלי, Risk-Off, או המתנה?';

// Tab slug → Hebrew display label
const _TAB_LABELS = {
  summary: 'סיכום',
  specialized: 'תוכן ייעודי',
  insights: 'תובנות',
  chapters: 'פרקים',
  'useful-knowledge': 'ידע שימושי',
  'topics-subtopics': 'נושאים',
  notes: 'הערות',
  'trading-brain': 'מוח המסחר',
  definitions: 'מושגים',
  setups: 'סטאפים',
  'morning-brief': 'מבזק בוקר',
  'app-builder': 'בניית אפליקציה',
};

// ─── Content-based entity detection ──────────────────────────────────────────

// Stock signals: Hebrew stock vocabulary + price-move verbs
const _RE_STOCK_WORDS =
  /המניה|מנייה|מניות|פרמרקט|אחרי.{0,3}שעות|לאחר.{0,3}שעות|\bEPS\b|רווח.{0,3}למניה|שווי.{0,3}שוק|דוח.{0,3}רבעוני|הנפקה|\bIPO\b/i;

// Stock price-move verbs — only trigger as stock signal when combined with a company/ticker
const _RE_STOCK_MOVE =
  /זינקה|קפצה|צנחה|נפלה|ירדה.{0,4}%|עלתה.{0,4}%|גאפ.{0,4}(למעלה|למטה)|נסחרת.{0,4}סביב/i;

// Known Hebrew company/brand names — no \b: Hebrew chars are non-word in JS regex
const _RE_HE_COMPANY =
  /(מטה|אפל|אמזון|גוגל|אלפבית|מיקרוסופט|נבידיה|טסלה|נטפליקס|אינטל|ברודקום|קוואלקום|אורקל|סיילספורס|ספוטיפיי|אובר|ליפט|שופיפיי|סנאפ|X\.AI|אקס)/i;

// English ticker: 2–5 uppercase letters standalone — matched by word boundary
// We exclude a short list of common non-ticker acronyms handled elsewhere
const _RE_EN_TICKER = /\b([A-Z]{2,5})\b/;
const _NON_STOCK_CAPS = new Set([
  'AI','VC','PE','US','EU','UK','IPO','ICO','ETF','VIX','DXY','CPI','PCE',
  'PPI','GDP','FED','FOMC','CEO','CFO','COO','ESG','EPS','FCF','ROE','ROI',
  'YOY','QOQ','TTM','LTM','RTL','RTX','SPX','NDX','DJI','HIV','FDA','SEC',
]);

// Market-wide signals: major indices, volatility, macro rates
const _RE_MARKET_WIDE =
  /\bS&P\b|SP.{0,2}500|\bNasdaqCOM\b|נאסד["ק]?|\bNASDAQ\b|\bNasdaq\b|\bDow\b|דאו\s*ג'ונס|ראסל|\bRussell\b|\bVIX\b|\bDXY\b|תשואות?\s*(10|שנה)|10Y|שוק.{0,4}הרחב|רוחב.{0,4}שוק|\bSPY\b|\bQQQ\b|\bIWM\b/i;

// Sector / theme signals — Hebrew terms have no \b (Hebrew chars are non-word in JS regex)
const _RE_SECTOR =
  /\bAI\b|בינה.{0,4}מלאכותית|\bLLM\b|ג'נרטיב|ענן|\bcloud\b|\bAWS\b|\bAzure\b|\bGCP\b|מוליכים.{0,4}למחצה|שבבים|\bchips\b|\bSMH\b|בנקים|בנקאי|\bbank|\bKRE\b|ריבית.{0,6}פד|אנרגיה|נפט|גז\s|\bOil\b|\bXLE\b|ביטקוין|\bbitcoin\b|קריפטו|\bcrypto\b|\bBTC\b|\bETH\b|אג["']ח|\bbonds?\b|\byields?\b|\bTLT\b|\bXLP\b|ביומד|\bbiotech\b|פארמ|pharma|סייבר|cyber|נדל"ן|\bREIT\b|\bVNQ\b/i;

// Risk signals: negative market language — Hebrew terms have no \b
const _RE_RISK =
  /נשבר|חולשה|אזהרה|לחץ.{0,6}מכירה|ירידה.{0,4}חדה|קריסה|סיכון.{0,4}גבוה|\bbearish\b|sell.{0,4}off|תיקון.{0,6}(חד|שוק)|\bcorrection\b|מימוש.{0,4}חד/i;

function _hasEnTicker(text) {
  const m = text.match(_RE_EN_TICKER);
  if (!m) return false;
  return !_NON_STOCK_CAPS.has(m[1]);
}

/**
 * Scans the combined text of a group's items and returns the dominant content type.
 * Priority: stock → market-wide → sector → risk → null (fall back to section label).
 */
function _detectContentType(texts) {
  const combined = texts.join(' ');

  // Stock: explicit Hebrew stock vocabulary always wins
  if (_RE_STOCK_WORDS.test(combined)) return 'stock';

  // Stock: move verb + recognisable company/ticker
  if (_RE_STOCK_MOVE.test(combined) && (_RE_HE_COMPANY.test(combined) || _hasEnTicker(combined))) {
    return 'stock';
  }

  // Market-wide indices / vol / macro rates
  if (_RE_MARKET_WIDE.test(combined)) return 'market';

  // Sector / theme (AI, cloud, crypto, bonds, energy …)
  if (_RE_SECTOR.test(combined)) return 'sector';

  // Generic risk language
  if (_RE_RISK.test(combined)) return 'risk';

  return null;
}

/**
 * Tries to extract a company or ticker name from the combined text.
 * Returns the best candidate string or null.
 */
function _extractEntityName(texts) {
  const combined = texts.join(' ');

  // Hebrew company name takes priority (human-readable)
  const heMatch = combined.match(_RE_HE_COMPANY);
  if (heMatch) return heMatch[0];

  // English ticker: first ALL_CAPS word that is not a known non-ticker acronym
  const words = combined.split(/[\s,;:()\[\]"']+/);
  for (const w of words) {
    if (/^[A-Z]{2,5}$/.test(w) && !_NON_STOCK_CAPS.has(w)) return w;
  }

  return null;
}

/**
 * Extracts the first matching sector/theme name for use in a sector question.
 */
function _extractSectorName(texts) {
  const combined = texts.join(' ');
  const sectorWords = [
    'AI','בינה מלאכותית','ענן','cloud','מוליכים למחצה','שבבים','chips',
    'בנקים','bank','אנרגיה','נפט','גז','ביטקוין','קריפטו','crypto',
    'אג"ח','bonds','yields','ביומד','biotech','פארמה','pharma','סייבר','cyber','נדל"ן','REIT',
  ];
  const lower = combined.toLowerCase();
  for (const kw of sectorWords) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

/**
 * Returns the best question string for the detected content type.
 * Returns null only when contentType is null (caller should fall back to section-label question).
 */
function _getContentTypeQuestion(contentType, texts) {
  switch (contentType) {
    case 'stock': {
      const entity = _extractEntityName(texts);
      const subj = entity ? `את ${entity}` : 'את המניה/החברה שהוזכרה';
      return (
        `נתח ${subj} כמניה: האם הקטליזטור האחרון נתמך בפנדמנטלים? ` +
        'מה רמות המחיר המרכזיות ונפח המסחר? מה הסיכונים והמטרות למעקב?'
      );
    }
    case 'market':
      return (
        'נתח את מצב השוק הרחב: מה הכיוון הנוכחי — Risk-On, ניטרלי, Risk-Off? ' +
        'מה רמות המפתח במדדים? אילו סקטורים ונכסים מובילים ומפגרים?'
      );
    case 'sector': {
      const sector = _extractSectorName(texts) || 'הסקטור/תמה';
      return (
        `נתח את ${sector} כסקטור/תמה: מה הנרטיב הנוכחי, מי המוביל בסקטור, ` +
        'אילו ETF/מניות מייצגים הזדמנות, ומה הסיכונים?'
      );
    }
    case 'risk':
      return (
        'נתח את הסיכון שהוזכר: מה ההסתברות שיתממש, מה ההשפעה הצפויה על תיק ההשקעות, ' +
        'וכיצד להתגונן או לנצל את התנועה?'
      );
    default:
      return null;
  }
}

// ─── Section-label helpers ────────────────────────────────────────────────────

function _stripLeadingEmoji(label) {
  return label.replace(/^[\u{1F000}-\u{1FFFF}☀-⟿︀-﻿⭐📝📰📊🔔🎯💡🏭🌍⚠️🧠🏷️✅🔮]+\s*/u, '').trim();
}

/**
 * Returns the best-matching Hebrew question for a given section label.
 * Falls back to a generic market question when no match is found.
 * Used when content-based detection produces no result.
 */
export function getQuestionForSection(sectionLabel) {
  const lbl = String(sectionLabel || '').trim();
  if (!lbl) return _GENERIC_QUESTION;

  if (SECTION_QUESTION_BANK[lbl]) return SECTION_QUESTION_BANK[lbl];

  const stripped = _stripLeadingEmoji(lbl);
  if (stripped !== lbl && SECTION_QUESTION_BANK[stripped]) return SECTION_QUESTION_BANK[stripped];

  for (const [key, question] of Object.entries(SECTION_QUESTION_BANK)) {
    if (lbl.includes(key) || (stripped && stripped.includes(key))) return question;
  }

  return _GENERIC_QUESTION;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds a context-aware Hebrew AI analysis prompt for Perplexity.
 *
 * For each group (items sharing the same sectionLabel):
 *   1. Scan item text for content signals (stock / market-wide / sector / risk).
 *   2. If a signal is found, use the content-type question (may include entity name).
 *   3. Otherwise fall back to the section-label question bank.
 *   4. Final fallback: generic market question.
 *
 * @param {object}   opts
 * @param {Array}    opts.selectedItems - bulk selection items ({ text, sectionLabel, type, tabScope })
 * @param {string}  [opts.tabTitle]    - Hebrew tab name (overrides tabSlug)
 * @param {string}  [opts.tabSlug]     - raw tab slug (e.g. 'summary')
 * @param {string}  [opts.sourceTitle] - video/source title
 * @param {string}  [opts.videoDate]   - formatted date string (e.g. "2 יולי 2026")
 * @returns {string} ready-to-paste Perplexity prompt
 */
export function buildContextualAiAnalysisPrompt({ selectedItems, tabTitle, tabSlug, sourceTitle, videoDate } = {}) {
  const items = Array.isArray(selectedItems) ? selectedItems.filter(Boolean) : [];
  if (!items.length) return '';

  const resolvedTabTitle = tabTitle || (tabSlug ? _TAB_LABELS[tabSlug] : '') || '';

  // Group items by sectionLabel (insertion order preserved)
  const groups = new Map();
  for (const item of items) {
    const key = String(item.sectionLabel || '').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const lines = [];

  lines.push('## ניתוח AI — מבזק שוק');
  lines.push('');

  if (sourceTitle) {
    const datePart = videoDate ? ` (${videoDate})` : '';
    lines.push(`**מקור:** ${sourceTitle}${datePart}`);
  }
  if (resolvedTabTitle) lines.push(`**טאב:** ${resolvedTabTitle}`);
  if (sourceTitle || resolvedTabTitle) lines.push('');

  lines.push('---');
  lines.push('');

  for (const [sectionLabel, groupItems] of groups) {
    const sectionTitle = sectionLabel || 'ניתוח כללי';

    // 1. Try content-based detection on the group's item texts
    const texts = groupItems.map((item) => String(item.text || '').trim()).filter(Boolean);
    const contentType = _detectContentType(texts);
    const question =
      (contentType && _getContentTypeQuestion(contentType, texts)) ||
      getQuestionForSection(sectionLabel);

    lines.push(`### ${sectionTitle}`);
    lines.push(`**שאלה מנחה:** ${question}`);
    lines.push('');
    lines.push('**פריטים לניתוח:**');
    groupItems.forEach((item, i) => {
      const text = String(item.text || '').trim();
      if (text) lines.push(`${i + 1}. ${text}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**הנחיות לניתוח:**');
  lines.push('- ענה בעברית בלבד');
  lines.push('- תן פרשנות שוק מעשית ואקציונבילית');
  lines.push('- **החלטה סופית:** בחר: Risk-On / ניטרלי / Risk-Off / המתנה');
  lines.push('- **רמת ביטחון:** ציון 0–100');
  lines.push('- **מה לעקוב בהמשך:** תן 3–5 נקודות מעקב ספציפיות');

  return lines.join('\n');
}
