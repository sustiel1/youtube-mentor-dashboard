const clean = (value) => typeof value === 'string' ? value.trim() : '';

function relativeKind(value) {
  const text = clean(value).toLowerCase();
  if (/\btomorrow\b|מחר/.test(text)) return 'tomorrow';
  if (/\btoday\b|היום/.test(text)) return 'today';
  return '';
}

export function resolveDisplayEventTiming(evidence = []) {
  const items = (Array.isArray(evidence) ? evidence : [evidence]).filter(Boolean);
  const kinds = new Set(items.map((item) => relativeKind(item.sourceRelativeText || item.timeframe)).filter(Boolean));
  const sourceRelativeText = [...new Set(items
    .map((item) => clean(item.sourceRelativeText || item.timeframe))
    .filter(Boolean))];
  if (kinds.size > 1 || items.some((item) => item.timingStatus === 'conflicting')) {
    return { eventDate: '', eventTime: '', timezone: '', sourceRelativeText, timingStatus: 'conflicting', displayLabel: 'מועד לא מאומת' };
  }
  const absolute = items.find((item) => item.eventDate || item.eventTime);
  if (absolute) {
    const timezone = clean(absolute.timezone);
    return {
      eventDate: clean(absolute.eventDate), eventTime: clean(absolute.eventTime), timezone,
      sourceRelativeText, timingStatus: timezone ? 'verified' : 'unverified',
      displayLabel: timezone ? '' : 'מועד לא מאומת',
    };
  }
  if (kinds.size) {
    return { eventDate: '', eventTime: '', timezone: '', sourceRelativeText, timingStatus: 'unverified', displayLabel: 'מועד לא מאומת' };
  }
  return { eventDate: '', eventTime: '', timezone: '', sourceRelativeText, timingStatus: 'missing', displayLabel: '' };
}
