/**
 * Presentation-only stock/status row humanization.
 * Does not modify stored data, extraction, or GEM schemas.
 */
import { resolveTone, TONE } from './morningBriefVisuals';

const SYMBOL_STATUS_LINE_RE = /^\s*symbol\s*:\s*([^|]+?)(?:\s*\|\s*status\s*:\s*(.*?))?\s*$/i;

function pickString(...vals) {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function pickStatusLabel(statusRaw, kind) {
  const lower = String(statusRaw || '').toLowerCase();
  const tables = {
    positive: [
      ['פריצה', 'פריצה'], ['breakout', 'פריצה'],
      ['חיובי', 'חיובי'], ['positive', 'חיובי'],
      ['bullish', 'Bullish'], ['עולה', 'עולה'],
    ],
    negative: [
      ['פגיעה', 'פגיעה'], ['שלילי', 'שלילי'],
      ['bearish', 'Bearish'], ['יורדת', 'יורדת'], ['negative', 'שלילי'],
    ],
    neutral: [
      ['יציבה', 'יציבה'], ['ניטרלי', 'ניטרלי'],
      ['watch', 'Watch'], ['מעקב', 'מעקב'],
    ],
  };
  for (const [tok, label] of tables[kind] || []) {
    if (lower.includes(tok)) return label;
  }
  return null;
}

function statusVisual(statusRaw) {
  const s = String(statusRaw || '').trim();
  if (!s) {
    return { tone: 'neutral', arrow: '', label: '', hasStatus: false };
  }
  const lower = s.toLowerCase();
  if (lower.includes('פריצה') || lower.includes('breakout')) {
    return { tone: 'positive', arrow: '↑', label: 'פריצה', hasStatus: true };
  }
  if (lower.includes('פגיעה')) {
    return { tone: 'negative', arrow: '↓', label: 'פגיעה', hasStatus: true };
  }
  const tone = resolveTone(s);
  if (tone === TONE.BULLISH) {
    return { tone: 'positive', arrow: '↑', label: pickStatusLabel(s, 'positive') || 'עולה', hasStatus: true };
  }
  if (tone === TONE.BEARISH) {
    return { tone: 'negative', arrow: '↓', label: pickStatusLabel(s, 'negative') || 'יורדת', hasStatus: true };
  }
  if (
    ['neutral', 'flat', 'sideways', 'hold', 'mixed', 'stable', 'range', 'watch', 'ניטרלי', 'יציב', 'שטוח']
      .some((tok) => s.toLowerCase().includes(tok))
  ) {
    return { tone: 'neutral', arrow: '→', label: pickStatusLabel(s, 'neutral') || 'יציבה', hasStatus: true };
  }
  if (tone === TONE.NEUTRAL) {
    return { tone: 'neutral', arrow: '→', label: pickStatusLabel(s, 'neutral') || 'יציבה', hasStatus: true };
  }
  return { tone: 'unknown', arrow: '·', label: 'סטטוס לא ידוע', hasStatus: true };
}

const STOCK_STATUS_TEXT_CLASS = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-slate-500 dark:text-zinc-400',
  unknown: 'text-slate-600 dark:text-zinc-400',
};

const STOCK_STATUS_EMPHASIS_CLASS = {
  positive: 'text-emerald-700 dark:text-emerald-300',
  negative: 'text-red-700 dark:text-red-300',
  neutral: 'text-slate-600 dark:text-zinc-300',
  unknown: 'text-slate-600 dark:text-zinc-400',
};

const STOCK_STATUS_DOT = {
  positive: '🟢',
  negative: '🔴',
  neutral: '⚪',
  unknown: '⚪',
};

function isStockStatusObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const ticker = pickString(obj.symbol, obj.ticker, obj.name, obj.stock);
  if (!ticker) return false;

  const hasRichFields = pickString(
    obj.reason, obj.why, obj.note, obj.importance, obj.catalyst,
    obj.event, obj.level, obj.price, obj.company, obj.context,
  );
  if (hasRichFields) return false;

  const status = obj.status ?? obj.direction ?? obj.sentiment ?? obj.trend;
  if (status !== undefined && status !== null && String(status).trim() !== '') return true;

  const keys = Object.keys(obj).filter((k) => obj[k] != null && String(obj[k]).trim() !== '');
  return keys.every((k) => [
    'symbol', 'ticker', 'name', 'stock',
    'status', 'direction', 'sentiment', 'trend',
    'change', 'pct', 'changePercent', 'percent',
  ].includes(k));
}

function extractMovePct(raw, statusRaw, sourceObj) {
  if (sourceObj && typeof sourceObj === 'object') {
    const fromField = pickString(
      sourceObj.change, sourceObj.pct, sourceObj.changePercent, sourceObj.percent,
    );
    const m = fromField.match(/(\d+(?:\.\d+)?)\s*%?/);
    if (m) return `${m[1]}%`;
  }
  const combined = `${raw} ${statusRaw}`;
  const m = combined.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? `${m[1]}%` : null;
}

/** Split embedded move patterns like "↑ 13% APLD" from ticker text. */
function splitTickerMove(ticker) {
  let t = String(ticker || '').trim();
  if (!t) return { ticker: '', movePct: null, arrowOverride: null };

  const leading = t.match(/^([↑↓→])\s*(\d+(?:\.\d+)?)\s*%\s+(.+)$/);
  if (leading) {
    return { ticker: leading[3].trim(), movePct: `${leading[2]}%`, arrowOverride: leading[1] };
  }

  const trailing = t.match(/^(.+?)\s+([↑↓→])\s*(\d+(?:\.\d+)?)\s*%$/);
  if (trailing) {
    return { ticker: trailing[1].trim(), movePct: `${trailing[3]}%`, arrowOverride: trailing[2] };
  }

  const pctOnly = t.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%$/);
  if (pctOnly) {
    return { ticker: pctOnly[1].trim(), movePct: `${pctOnly[2]}%`, arrowOverride: null };
  }

  return { ticker: t, movePct: null, arrowOverride: null };
}

function buildResult(ticker, statusRaw, vis, sourceObj = null) {
  const split = splitTickerMove(ticker);
  const cleanTicker = split.ticker || ticker;
  const movePct = split.movePct || extractMovePct(ticker, statusRaw, sourceObj);
  const arrow = split.arrowOverride || vis.arrow;
  const emphasis = Boolean(movePct);
  const rowClass = emphasis
    ? STOCK_STATUS_EMPHASIS_CLASS[vis.tone] || STOCK_STATUS_EMPHASIS_CLASS.neutral
    : STOCK_STATUS_TEXT_CLASS[vis.tone] || STOCK_STATUS_TEXT_CLASS.neutral;

  let displayText = cleanTicker;
  if (vis.hasStatus && vis.label) {
    displayText = vis.tone === 'unknown'
      ? `${cleanTicker} · סטטוס לא ידוע`
      : [cleanTicker, movePct, arrow, vis.label].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  } else if (movePct && arrow) {
    displayText = `${arrow} ${movePct} ${cleanTicker}`.replace(/\s+/g, ' ').trim();
  }

  return {
    ticker: cleanTicker,
    statusRaw,
    arrow,
    label: vis.label,
    movePct,
    emphasis,
    tone: vis.tone,
    dot: STOCK_STATUS_DOT[vis.tone] || STOCK_STATUS_DOT.neutral,
    displayText,
    isStockStatus: true,
    textClass: STOCK_STATUS_TEXT_CLASS[vis.tone] || STOCK_STATUS_TEXT_CLASS.neutral,
    rowClass,
  };
}

/** Parse string or object into stock status visual model; null if not a stock/status row. */
export function parseStockStatusInput(input) {
  if (input == null) return null;

  if (typeof input === 'object' && !Array.isArray(input)) {
    if (!isStockStatusObject(input)) return null;
    const ticker = pickString(input.symbol, input.ticker, input.name, input.stock);
    const statusRaw = pickString(input.status, input.direction, input.sentiment, input.trend);
    return buildResult(ticker, statusRaw, statusVisual(statusRaw), input);
  }

  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return null;
    if (/↑\s*עולה|↓\s*יורדת|→\s*יציבה/.test(raw)) return null;

    const moveLine = raw.match(/^\s*([↑↓→])\s*(\d+(?:\.\d+)?)\s*%\s*([A-Za-z][A-Za-z0-9.-]{0,12})\s*$/);
    if (moveLine) {
      const statusRaw = moveLine[1] === '↓' ? 'down' : moveLine[1] === '→' ? 'neutral' : 'up';
      return buildResult(
        `${moveLine[1]} ${moveLine[2]}% ${moveLine[3].trim()}`,
        statusRaw,
        statusVisual(statusRaw),
      );
    }

    const match = raw.match(SYMBOL_STATUS_LINE_RE);
    if (match) {
      const ticker = match[1].trim();
      const statusRaw = (match[2] || '').trim();
      return buildResult(ticker, statusRaw, statusVisual(statusRaw));
    }
  }

  return null;
}

/** Plain-text display line for copy, bulk, and fallback rendering. */
export function formatStockStatusText(input) {
  return parseStockStatusInput(input)?.displayText ?? null;
}

export function getStockStatusVisual(input) {
  return parseStockStatusInput(input);
}

export function isStockStatusLike(input) {
  return parseStockStatusInput(input) != null;
}
