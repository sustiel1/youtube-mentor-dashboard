/**
 * Presentation-only labels for brief type + timing context above Specialized Content.
 */

export const BRIEF_CONTEXT_BY_SLUG = {
  'morning-brief': {
    title: '🌅 מבזק בוקר',
    context: '⏰ לפני פתיחת המסחר',
  },
  'evening-brief': {
    title: '🌇 מבזק ערב',
    context: '🌙 לאחר סיום המסחר',
  },
  'weekly-brief': {
    title: '📆 מבזק שבועי',
    context: '📆 סיכום והיערכות לשבוע',
  },
  'earnings-brief': {
    title: '📈 מבזק דוחות',
    context: '📈 עונת דוחות',
  },
  'macro': {
    title: '🏦 מאקרו',
    context: '🏦 אירועי מאקרו וכלכלה',
  },
  'news-brief': {
    title: '🗞️ מבזק חדשות',
    context: '🗞️ חדשות והשפעתן על השוק',
  },
};

/** Hebrew subCategory fallbacks when slug normalization differs. */
const BRIEF_CONTEXT_BY_SUBCATEGORY = {
  'מבזק בוקר': BRIEF_CONTEXT_BY_SLUG['morning-brief'],
  'מבזק ערב': BRIEF_CONTEXT_BY_SLUG['evening-brief'],
  'מבזק שבועי': BRIEF_CONTEXT_BY_SLUG['weekly-brief'],
  'מבזק דוחות': BRIEF_CONTEXT_BY_SLUG['earnings-brief'],
  'מאקרו': BRIEF_CONTEXT_BY_SLUG.macro,
};

const BRIEF_CONTEXT_SLUGS = new Set(Object.keys(BRIEF_CONTEXT_BY_SLUG));

export function isBriefContextSlug(slug) {
  return BRIEF_CONTEXT_SLUGS.has(String(slug || '').trim());
}

/** Resolve brief title + context label for display. */
export function getBriefContextDisplay(slug, subCategory) {
  const key = String(slug || '').trim();
  if (BRIEF_CONTEXT_BY_SLUG[key]) return BRIEF_CONTEXT_BY_SLUG[key];

  const sub = String(subCategory || '').trim();
  if (BRIEF_CONTEXT_BY_SUBCATEGORY[sub]) return BRIEF_CONTEXT_BY_SUBCATEGORY[sub];

  return null;
}

function formatBriefPublishDateParts(publishedAt) {
  if (!publishedAt) return null;
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return { day, month, year, plain: `${day}.${month}.${year}` };
}

/** Format publish date as 📅 dd.MM.yyyy */
export function formatBriefPublishDate(publishedAt) {
  const parts = formatBriefPublishDateParts(publishedAt);
  if (!parts) return null;
  return `📅 ${parts.plain}`;
}

/** Plain dd.MM.yyyy for muted header line */
export function formatBriefPublishDatePlain(publishedAt) {
  const parts = formatBriefPublishDateParts(publishedAt);
  return parts?.plain ?? null;
}
