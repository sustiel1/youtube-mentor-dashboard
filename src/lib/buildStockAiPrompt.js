/**
 * Builds a compact stock analysis AI prompt for a given ticker.
 * Designed for Perplexity, Claude, or any AI assistant.
 * Output target: compact decision table, decision-oriented.
 */
export function buildStockAiPrompt(ticker) {
  const sym = String(ticker || '').toUpperCase().trim();
  if (!sym) return '';
  return (
    `Analyze ${sym} for a fast swing-trading decision. Return a compact table only.\n` +
    `Include: RSI, MACD, Bollinger Bands, EMA 20/50/200, volume/relative volume, ` +
    `support/resistance, trend score, momentum score, valuation, growth, profitability, ` +
    `debt/balance-sheet risk, analyst sentiment, key catalyst, key risk, ` +
    `and an overall score from 0 to 100.\n` +
    `Keep the explanation short and decision-oriented.`
  );
}

/** Returns a Perplexity search URL pre-filled with the stock prompt. */
export function buildStockPerplexityUrl(ticker) {
  const prompt = buildStockAiPrompt(ticker);
  if (!prompt) return null;
  return `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`;
}

// ── Perplexity Space analysis prompt builder ─────────────────────────────────

/** User's Perplexity Space for stock fast-decision analysis. */
export const PERPLEXITY_SPACE_URL =
  'https://www.perplexity.ai/spaces/stock-fast-decision-oOhCJwdnQKqXFNhAt5CVVw';

// Self-contained instructions block appended to every prompt.
// Does not rely on "Space instructions" — works as a standalone paste.
const _ANALYSIS_INSTRUCTIONS =
  '\n\nענה אך ורק בעברית. טבלאות RTL בלבד. אל תסביר — רק טבלאות.\n' +
  'כל שורה חייבת לכלול סטטוס צבע: 🟢 חיובי / 🟡 ניטרלי / 🔴 שלילי\n\n' +
  '## 1. החלטה מהירה\n' +
  '| פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |\n\n' +
  '## 2. טכני\n' +
  '| פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |\n' +
  'כלול: RSI, MACD, Bollinger Bands, EMA 20/50/200, נפח, תמיכה/התנגדות\n\n' +
  '## 3. פנדמנטלי\n' +
  '| פרמטר | נתון | 🔴🟡🟢 | פירוש קצר | ציון |\n' +
  'כלול: P/E, צמיחה, מרווחים, חוב, המלצות אנליסטים\n\n' +
  '## 4. סיכונים וקטליזטורים\n' +
  '| גורם | פרטים | 🔴🟡🟢 | השפעה |\n\n' +
  '## ציון כולל\n' +
  '| ציון (0-100) | החלטה |\n' +
  '| --- | קנה / מעקב / הימנע |\n\n' +
  'ציין מקורות. תובנות קצרות בלבד. אין הסברים ארוכים.';

function _extractItemLabel(item) {
  const text = String(item?.text || '').trim();
  // Morning Brief stock rows: "AAPL · Apple Inc. · context" — use first segment if it's a ticker
  const firstSeg = text.split(' · ')[0].trim();
  if (/^[A-Z]{1,6}$/.test(firstSeg)) return firstSeg;
  // Fallback: cap long text
  return text.length > 60 ? text.slice(0, 57) + '…' : text;
}

/**
 * Builds a ready-to-paste Perplexity Space analysis prompt for one or more
 * selected bulk items. Works for stocks, sectors, macros, or any row.
 * Self-contained — no reliance on Space system instructions.
 */
export function buildPerplexityAnalysisPrompt(selectedItems) {
  const items = Array.isArray(selectedItems) ? selectedItems.filter(Boolean) : [];
  if (items.length === 0) return '';

  if (items.length === 1) {
    const label = _extractItemLabel(items[0]);
    return `נתח את ${label}${_ANALYSIS_INSTRUCTIONS}`;
  }

  const list = items.map((item) => `- ${_extractItemLabel(item)}`).join('\n');
  return (
    `נתח את הנכסים הבאים:\n${list}` +
    '\n\nלכל נכס החזר טבלאות החלטה נפרדות.' +
    _ANALYSIS_INSTRUCTIONS
  );
}
