const STORAGE_KEY = 'market_manual_finviz_mappings_v1';
const FINVIZ_BASE = 'https://finviz.com/quote.ashx?t=';

export function getManualFinvizMappings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveManualFinvizMapping(originalName, ticker, displayName = '') {
  const mappings = getManualFinvizMappings();
  mappings[String(originalName).trim()] = {
    ticker: String(ticker).trim().toUpperCase(),
    displayName: String(displayName).trim() || String(originalName).trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

export function resolveManualFinvizTicker(input) {
  const mappings = getManualFinvizMappings();
  return mappings[String(input || '').trim()]?.ticker ?? null;
}

export function getManualFinvizUrl(input) {
  const ticker = resolveManualFinvizTicker(input);
  return ticker ? `${FINVIZ_BASE}${encodeURIComponent(ticker)}&p=d` : null;
}
