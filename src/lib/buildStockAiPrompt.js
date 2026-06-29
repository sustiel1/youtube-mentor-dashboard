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
