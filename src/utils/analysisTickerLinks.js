const FINVIZ_QUOTE_BASE = 'https://finviz.com/quote.ashx?t=';

const NON_FINVIZ_ASSETS = new Set([
  'AI', 'BTC', 'BTCUSD', 'CPI', 'DXY', 'ETH', 'ETHUSD', 'ETF', 'FED', 'FOMC',
  'GDP', 'NASDAQ', 'NDX', 'NFP', 'PCE', 'SPX', 'TA35', 'TA125', 'USD', 'VIX',
]);

export function normalizeAnalysisTicker(value) {
  const ticker = String(value || '').trim().replace(/^\$/, '').toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) return null;
  if (NON_FINVIZ_ASSETS.has(ticker) || ticker.startsWith('TA-')) return null;
  return ticker;
}

export function buildSafeFinvizTickerUrl(value) {
  const ticker = normalizeAnalysisTicker(value);
  return ticker ? `${FINVIZ_QUOTE_BASE}${encodeURIComponent(ticker)}` : null;
}

export function isSafeAnalysisTicker(value) {
  return buildSafeFinvizTickerUrl(value) !== null;
}

export function buildPersistedYouTubeTimestampUrl(videoUrl, timestamp) {
  if (timestamp == null || String(timestamp).trim() === '') return null;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  try {
    const url = new URL(String(videoUrl || '').trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) return null;
    url.searchParams.set('t', String(Math.floor(seconds)));
    return url.toString();
  } catch {
    return null;
  }
}
