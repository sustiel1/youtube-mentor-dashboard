/**
 * Base44 Backend Function: FetchFearGreed
 *
 * HOW TO DEPLOY:
 * 1. Open your Base44 project → Functions → Create New Function
 * 2. Name it exactly: FetchFearGreed
 * 3. Paste this code into the function editor
 * 4. Save & Deploy
 * 5. In vite.config.js's dev proxy this is called at /api/market/fear-greed;
 *    map the Base44 function to the same client-facing route in production.
 *
 * INPUT:  none
 * OUTPUT: {
 *   fear_and_greed: {
 *     score: number, timestamp: string|null,
 *     previousClose, previousWeek, previousMonth, previousYear: number|null
 *   },
 *   indicators: {
 *     market_momentum, stock_price_strength, stock_price_breadth,
 *     put_call_options, market_volatility, safe_haven_demand,
 *     junk_bond_demand: { score: number, rating: string, timestamp: string|null } | null
 *   }
 * }
 *
 * CNN does not publish a documented public API for this index. The upstream
 * endpoint below is CNN's own internal data-viz feed (used by cnn.com itself
 * to render https://www.cnn.com/markets/fear-and-greed) and requires a
 * same-site Referer header or it returns HTTP 418. This function is the only
 * place that talks to it; the client never calls CNN directly.
 */

const CNN_FEAR_GREED_ENDPOINT = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
const FETCH_TIMEOUT_MS = 10_000;

// Canonical indicator id -> CNN's raw response key. Verified 2026-08-25
// against both this endpoint and the rendered cnn.com/markets/fear-and-greed
// page (same score+rating for every one of the 7 indicators). CNN also
// exposes market_momentum_sp125 and market_volatility_vix_50 with identical
// values to the keys used here in every observed sample — the _sp500/_vix
// keys are used since they match the page's own indicator naming.
const INDICATOR_CNN_KEYS = {
  market_momentum: 'market_momentum_sp500',
  stock_price_strength: 'stock_price_strength',
  stock_price_breadth: 'stock_price_breadth',
  put_call_options: 'put_call_options',
  market_volatility: 'market_volatility_vix',
  safe_haven_demand: 'safe_haven_demand',
  junk_bond_demand: 'junk_bond_demand',
};

function toIsoOrNull(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function toFiniteScoreOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 100 ? num : null;
}

function buildIndicators(data) {
  const indicators = {};
  for (const [id, cnnKey] of Object.entries(INDICATOR_CNN_KEYS)) {
    const entry = data?.[cnnKey];
    const score = Number(entry?.score);
    const rating = typeof entry?.rating === 'string' ? entry.rating : null;
    // A missing/malformed sub-indicator must not fail the whole response —
    // it is simply reported as unavailable (null), never guessed.
    indicators[id] = Number.isFinite(score) && rating
      ? { score, rating, timestamp: toIsoOrNull(entry?.timestamp) }
      : null;
  }
  return indicators;
}

async function handler() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(CNN_FEAR_GREED_ENDPOINT, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketDataProxy)',
        Accept: 'application/json',
        Referer: 'https://www.cnn.com/markets/fear-and-greed',
      },
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      err?.name === 'AbortError'
        ? `CNN Fear & Greed upstream timed out after ${FETCH_TIMEOUT_MS}ms`
        : `CNN Fear & Greed upstream request failed: ${err.message}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`CNN Fear & Greed upstream returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const score = Number(data?.fear_and_greed?.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('CNN Fear & Greed payload missing a valid score');
  }

  return {
    fear_and_greed: {
      score,
      timestamp: toIsoOrNull(data?.fear_and_greed?.timestamp),
      // Only included when CNN's own payload explicitly supplies them —
      // never estimated or carried over from a previous response.
      previousClose: toFiniteScoreOrNull(data?.fear_and_greed?.previous_close),
      previousWeek: toFiniteScoreOrNull(data?.fear_and_greed?.previous_1_week),
      previousMonth: toFiniteScoreOrNull(data?.fear_and_greed?.previous_1_month),
      previousYear: toFiniteScoreOrNull(data?.fear_and_greed?.previous_1_year),
    },
    indicators: buildIndicators(data),
  };
}

module.exports = { handler };
