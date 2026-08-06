const INSIGHT_PRIMARY_FIELDS = [
  'lesson',
  'insight',
  'text',
  'title',
  'content',
  'point',
  'summary',
];

const INSIGHT_SUPPORT_FIELDS = [
  'whyImportant',
  'meaning',
  'reason',
  'significance',
  'explanation',
  'implication',
];

function firstText(item, fields) {
  for (const field of fields) {
    const value = item?.[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function withTerminalPunctuation(value) {
  const text = String(value || '').trim();
  if (!text || /[.!?…:;]$/u.test(text)) return text;
  return `${text}.`;
}

/**
 * Presentation-only resolver for structured insight objects.
 * Metadata stays in the source object, but is never flattened into user-facing text.
 */
export function resolveInsightDisplay(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { recognized: false, text: '' };
  }

  const recognized = [...INSIGHT_PRIMARY_FIELDS, ...INSIGHT_SUPPORT_FIELDS].some((field) => (
    Object.prototype.hasOwnProperty.call(item, field)
  ));
  if (!recognized) return { recognized: false, text: '' };

  const primary = firstText(item, INSIGHT_PRIMARY_FIELDS);
  const support = firstText(item, INSIGHT_SUPPORT_FIELDS);
  if (!primary) return { recognized: true, text: '' };

  return {
    recognized: true,
    text: [withTerminalPunctuation(primary), withTerminalPunctuation(support)]
      .filter(Boolean)
      .join(' '),
  };
}

