const firstPresent = (...values) => values.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
import { translateMarketEnum, translateSentimentLabel } from './sentimentDisplayI18n.js';

function cleanSentencePart(value) {
  return String(value ?? '').trim().replace(/[\s·|—]+$/g, '').replace(/[.]+$/g, '');
}

export function normalizeHebrewFinancialTypography(value) {
  return String(value ?? '')
    .replace(/פרי\s*[-־]\s*מרקט/g, 'פרה־מרקט')
    .replace(/אג["״]ח/g, 'אג״ח')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMarketStateValue(value) {
  const raw = normalizeHebrewFinancialTypography(value);
  if (!raw) return '';
  if (/מעורב\s*[-־]\s*חיובי/.test(raw)) return 'מעורב עם נטייה חיובית';
  if (/מעורב\s*[-־]\s*שלילי/.test(raw)) return 'מעורב עם נטייה שלילית';
  const translated = translateMarketEnum(raw, 'sentiment');
  if (translated) return translated;
  return /[\u0590-\u05FF]/.test(raw) ? raw : '';
}

/** One deterministic, presentation-only sentence for a structured Market State fact. */
export function formatMarketStateItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const rawLabel = cleanSentencePart(firstPresent(item.label, item.title, item.name));
  const translatedLabel = translateSentimentLabel(rawLabel);
  const label = /סנטימנט שוק כללי/.test(translatedLabel)
    ? 'סנטימנט השוק'
    : normalizeHebrewFinancialTypography(translatedLabel);
  if (!label) return '';

  const value = normalizeMarketStateValue(firstPresent(item.value, item.mood, item.status));
  const sentiment = translateMarketEnum(item.sentiment, 'sentiment');
  const sentimentAddsMeaning = sentiment && !value.includes(sentiment);
  const main = [value, sentimentAddsMeaning ? sentiment : ''].filter(Boolean).join(' — ');
  const reason = normalizeHebrewFinancialTypography(firstPresent(item.reason, item.explanation, item.note, item.description));
  const body = [main, reason].filter(Boolean).join(' — ');
  return body ? `${label}: ${body}` : label;
}

/** Preserve parent ownership: attribute enums never become detached rows. */
export function formatMarketStateItems(items) {
  const list = Array.isArray(items) ? items : [];
  const hasStructured = list.some((item) => Boolean(formatMarketStateItem(item)));
  return list.flatMap((item) => {
    const structured = formatMarketStateItem(item);
    if (structured) return [structured];
    if (typeof item !== 'string') return [];
    const raw = item.trim();
    if (!raw) return [];
    if (/[\u0590-\u05FF]/.test(raw)) return [normalizeHebrewFinancialTypography(raw)];
    const translated = translateMarketEnum(raw, 'sentiment');
    if (translated) return hasStructured ? [] : [`מצב רוח כללי: ${translated}`];
    return [normalizeHebrewFinancialTypography(raw)];
  });
}

function parseExplicitPercent(value, percentField) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? { number: value, display: percentField ? `${value}%` : String(value) } : null;
  const text = String(value).trim();
  if (!/^[+-]?\d+(?:\.\d+)?%?$/.test(text)) return { number: null, display: text };
  const number = Number(text.replace('%', ''));
  return Number.isFinite(number) ? { number, display: percentField || text.endsWith('%') ? `${text.replace(/%+$/, '')}%` : text } : null;
}

function explicitDirectionLabel(value) {
  const direction = String(value ?? '').trim().toLowerCase();
  if (!direction) return '';
  if (['up', 'upward', 'positive', 'rise', 'rising', 'עלה', 'עולה', 'עלייה'].includes(direction)) return 'עלה';
  if (['down', 'downward', 'negative', 'fall', 'falling', 'ירד', 'יורד', 'ירידה'].includes(direction)) return 'ירד';
  if (['flat', 'unchanged', 'neutral', 'ללא שינוי', 'שטוח', 'יציב'].includes(direction)) return 'ללא שינוי';
  return '';
}

function noteAlreadyContainsPercent(note, percent) {
  if (!note || percent?.number === null || percent?.number === undefined) return false;
  const escaped = String(Math.abs(percent.number)).replace('.', '[.,]');
  return new RegExp(`(?:^|[^\\d])[-+]?${escaped}\\s*%`).test(note);
}

export function formatSummaryMarketItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const asset = cleanSentencePart(firstPresent(item.symbol, item.asset, item.ticker, item.name));
  if (!asset) return '';

  const hasChangePercent = item.changePercent !== null && item.changePercent !== undefined && item.changePercent !== '';
  const rawChange = hasChangePercent ? item.changePercent : item.change;
  const percent = parseExplicitPercent(rawChange, hasChangePercent);
  const note = cleanSentencePart(firstPresent(item.note, item.description, item.summary, item.text));
  const suppliedDirection = explicitDirectionLabel(item.direction);
  const inferredDirection = hasChangePercent
    ? percent?.number > 0 ? 'עלה' : percent?.number < 0 ? 'ירד' : percent?.number === 0 ? 'ללא שינוי' : ''
    : '';
  const direction = suppliedDirection || inferredDirection;

  if (!percent && !note && !direction) return asset;
  const movement = percent && !noteAlreadyContainsPercent(note, percent)
    ? direction === 'ללא שינוי'
      ? `ללא שינוי (${percent.display})`
      : direction
        ? `${direction} ב־${percent.display}`
        : percent.display
    : direction === 'ללא שינוי' && !percent
      ? direction
      : '';
  const sentence = [asset, movement].filter(Boolean).join(' ');
  return [sentence, note].filter(Boolean).join(' — ').replace(/\s+/g, ' ').trim();
}
