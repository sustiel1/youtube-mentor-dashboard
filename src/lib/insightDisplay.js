const LESSON_KEYS = ['lesson', 'insight', 'text', 'title', 'content', 'point', 'summary'];
const WHY_IMPORTANT_KEYS = [
  'whyImportant',
  'why_it_matters',
  'whyItMatters',
  'meaning',
  'reason',
  'significance',
  'explanation',
  'implication',
];

const LEGACY_SEGMENT_PATTERN = /^(lesson|whyImportant|category|applicableToApp|timestampSource)\s*:\s*(.*)$/i;
const EMPTY_OPTIONAL_VALUES = new Set([
  '',
  'unavailable',
  'not available',
  'n/a',
  'null',
  'undefined',
  'true',
  'false',
]);

function asDisplayString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function firstDisplayValue(source, keys) {
  for (const key of keys) {
    const value = asDisplayString(source?.[key]);
    if (value) return value;
  }
  return '';
}

function meaningfulOptionalValue(value) {
  const text = asDisplayString(value);
  return EMPTY_OPTIONAL_VALUES.has(text.toLowerCase()) ? '' : text;
}

/**
 * Presentation-only parser for known legacy serialization labels.
 * Unrecognized text and pipes inside the lesson remain untouched.
 */
export function parseLegacyInsightText(value) {
  const source = asDisplayString(value);
  if (!source) return null;

  const segments = source.split(/\s*\|\s*/);
  const parsedSegments = segments.map((segment) => {
    const match = segment.trim().match(LEGACY_SEGMENT_PATTERN);
    return match
      ? { label: match[1].toLowerCase(), value: match[2].trim() }
      : { label: null, value: segment.trim() };
  });

  if (!parsedSegments.some((segment) => segment.label)) {
    return { lesson: source, whyImportant: '' };
  }

  const lessonParts = [];
  let whyImportant = '';

  parsedSegments.forEach(({ label, value: segmentValue }) => {
    if (!label || label === 'lesson') {
      if (segmentValue) lessonParts.push(segmentValue);
      return;
    }
    if (label === 'whyimportant' && !whyImportant) whyImportant = segmentValue;
  });

  const preservedLesson = lessonParts.join(' | ').trim();
  if (!preservedLesson) return null;

  return {
    lesson: preservedLesson,
    whyImportant: meaningfulOptionalValue(whyImportant),
  };
}

/** Resolve explicit UI fields without mutating the persisted source object. */
export function getInsightDisplayFields(item) {
  if (typeof item === 'string') return parseLegacyInsightText(item);
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const directLesson = firstDisplayValue(item, LESSON_KEYS);
  if (!directLesson) return null;

  const parsedLesson = parseLegacyInsightText(directLesson);
  if (!parsedLesson?.lesson) return null;

  const directWhyImportant = meaningfulOptionalValue(firstDisplayValue(item, WHY_IMPORTANT_KEYS));
  return {
    lesson: parsedLesson.lesson,
    whyImportant: directWhyImportant || parsedLesson.whyImportant,
  };
}

export function formatInsightDisplayText(item) {
  const fields = getInsightDisplayFields(item);
  if (!fields) return '';
  return fields.whyImportant
    ? `${fields.lesson}\nלמה זה חשוב: ${fields.whyImportant}`
    : fields.lesson;
}
