/**
 * App Ideas Brain — presentation-only humanization layer.
 * Does not mutate extraction, storage, or Obsidian save payloads.
 */
import { HUMANIZATION_RULES } from '@/lib/appIdeasBrainHumanization/rules';

const RAW_TECHNICAL_RE = /^(metric|trigger|risk|level|symbol|type|value):/i;

/**
 * Apply the first matching humanization rule to raw text.
 * @param {string} text
 * @returns {string}
 */
export function humanizeAppBrainContent(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return '';

  for (const rule of HUMANIZATION_RULES) {
    if (rule.matches(raw)) {
      const result = rule.humanize(raw);
      if (result && result.trim() && result.trim() !== raw) {
        return result.trim();
      }
    }
  }

  return raw;
}

function normalizeDisplayText(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Collapse near-duplicate title/body pairs for UI only.
 * @returns {{ displayTitle: string, displayBody: string|null }}
 */
export function collapseSimilarDisplayTitleBody(displayTitle, displayBody) {
  const title = normalizeDisplayText(displayTitle);
  const body = normalizeDisplayText(displayBody);

  if (!body) {
    return { displayTitle: title, displayBody: null };
  }

  if (!title || title === body) {
    return { displayTitle: body, displayBody: null };
  }

  // Body starts with title — prefer the richer single version.
  if (body.startsWith(title)) {
    return { displayTitle: body, displayBody: null };
  }

  // Title is an effective prefix of body (high overlap, extra detail in body).
  if (title.length >= 8 && body.length > title.length) {
    const overlapRatio = title.length / body.length;
    if (overlapRatio >= 0.85 && body.startsWith(title.slice(0, Math.floor(title.length * 0.9)))) {
      return { displayTitle: body, displayBody: null };
    }
  }

  // Title prefix with small connector (e.g. title + " עם ...").
  const titlePrefix = title.replace(/[.!?…]+$/u, '');
  if (titlePrefix.length >= 8 && body.startsWith(titlePrefix)) {
    const suffix = body.slice(titlePrefix.length).trim().replace(/^[—\-–:,.\s]+/u, '');
    if (suffix) {
      return { displayTitle: body, displayBody: null };
    }
    return { displayTitle: titlePrefix, displayBody: null };
  }

  return { displayTitle: title, displayBody: body };
}

/** True if text still looks like raw technical key:value output. */
export function isRawTechnicalBrainText(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  if (RAW_TECHNICAL_RE.test(raw)) return true;
  return /^[a-z_]+:\s*.+\s*\|/i.test(raw);
}

/**
 * Format a brain item for UI display only.
 * @param {{ title?: string, content?: string }} item
 * @returns {{ displayTitle: string, displayBody: string|null, isHumanized: boolean }}
 */
export function formatBrainItemForDisplay(item) {
  const rawTitle = String(item?.title ?? '').trim();
  const rawContent = String(item?.content ?? '').trim();

  const humanizedTitle = humanizeAppBrainContent(rawTitle) || rawTitle;
  const humanizedContent = humanizeAppBrainContent(rawContent);
  const initialBody =
    humanizedContent &&
    humanizedContent !== humanizedTitle &&
    humanizedContent !== rawTitle
      ? humanizedContent
      : null;

  const { displayTitle, displayBody } = collapseSimilarDisplayTitleBody(
    humanizedTitle || rawContent,
    initialBody,
  );

  const isHumanized =
    (displayTitle !== rawTitle && displayTitle !== rawContent) ||
    (displayBody != null && displayBody !== rawContent) ||
    (initialBody != null && displayBody == null && displayTitle !== humanizedTitle);

  return { displayTitle, displayBody, isHumanized };
}

/**
 * Hebrew section heading with item count.
 * Example: "פיצ'רים (17)"
 * @param {string} labelHe
 * @param {number} count
 */
export function formatBrainSectionHeading(labelHe, count) {
  const n = Number(count) || 0;
  return `${labelHe} (${n})`;
}

/**
 * Hebrew total counter for document header.
 * @param {number} count
 */
export function formatBrainTotalCount(count) {
  const n = Number(count) || 0;
  const unit = n === 1 ? 'פריט' : 'פריטים';
  return `${n} ${unit} מחולצים מהנתונים הקיימים`;
}

export { HUMANIZATION_RULES } from '@/lib/appIdeasBrainHumanization/rules';
