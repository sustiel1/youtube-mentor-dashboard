import assert from 'node:assert/strict';
import {
  FEAR_GREED_API_PATH,
  FEAR_GREED_QUERY_STALE_TIME_MS,
  FEAR_GREED_INDICATOR_IDS,
  FEAR_GREED_INDICATOR_LABELS_HE,
  FEAR_GREED_INDICATOR_TOOLTIPS_HE,
  FEAR_GREED_RATING_STYLES,
  normalizeCnnFearGreedPayload,
  normalizeCnnRatingKey,
  formatFearGreedUpdatedAt,
  formatFearGreedCheckedAtTime,
} from '../src/lib/fearGreed.js';

assert.equal(FEAR_GREED_API_PATH, '/api/market/fear-greed');
// Repeated visits within 5 minutes reuse the in-memory result (no refetch);
// after 5 minutes, the next mount triggers a real refetch.
assert.equal(FEAR_GREED_QUERY_STALE_TIME_MS, 5 * 60 * 1000);

// Real shape returned by the vite/backend proxy (mirrors CNN's own
// production.dataviz.cnn.io/index/fearandgreed/graphdata, mapped onto our
// canonical indicator ids) — verified 2026-08-25 against the live endpoint
// and the rendered cnn.com/markets/fear-and-greed page.
const validPayload = {
  fear_and_greed: {
    score: 54.9714285714286,
    rating: 'neutral',
    timestamp: '2026-08-25T00:00:00+00:00',
  },
  indicators: {
    market_momentum: { score: 35.8, rating: 'fear', timestamp: '2026-08-24T20:36:32.000Z' },
    stock_price_strength: { score: 26.6, rating: 'fear', timestamp: '2026-08-25T00:59:55.000Z' },
    stock_price_breadth: { score: 59.4, rating: 'greed', timestamp: '2026-08-25T00:59:55.000Z' },
    put_call_options: { score: 50.4, rating: 'neutral', timestamp: '2026-08-24T20:50:05.000Z' },
    market_volatility: { score: 50, rating: 'neutral', timestamp: '2026-08-24T20:15:01.000Z' },
    safe_haven_demand: { score: 66.6, rating: 'greed', timestamp: '2026-08-24T19:59:59.000Z' },
    junk_bond_demand: { score: 93.8, rating: 'extreme greed', timestamp: '2026-08-25T00:00:00.000Z' },
  },
};
const normalized = normalizeCnnFearGreedPayload(validPayload);
assert.ok(normalized);
// CNN's own page rounds to the nearest whole number (54.97 -> "55"); the
// card renders a bare integer, so the normalizer must match that rounding.
assert.equal(normalized.score, 55);
assert.equal(normalized.updatedAt, '2026-08-25T00:00:00+00:00');
assert.equal(normalized.source, 'cnn');

// All 7 indicators appear exactly once, with the exact rating CNN reported —
// nothing derived, nothing guessed.
assert.equal(Object.keys(normalized.indicators).length, 7);
assert.equal(FEAR_GREED_INDICATOR_IDS.length, 7);
assert.equal(normalized.indicators.market_momentum.ratingKey, 'fear');
assert.equal(normalized.indicators.market_momentum.score, 36);
assert.equal(normalized.indicators.junk_bond_demand.ratingKey, 'extreme greed');
assert.equal(normalized.indicators.junk_bond_demand.score, 94);
assert.equal(normalized.indicators.market_volatility.ratingKey, 'neutral');
for (const id of FEAR_GREED_INDICATOR_IDS) {
  assert.ok(normalized.indicators[id], `expected ${id} to normalize`);
  assert.ok(FEAR_GREED_INDICATOR_LABELS_HE[id], `expected a Hebrew label for ${id}`);
  assert.ok(FEAR_GREED_INDICATOR_TOOLTIPS_HE[id], `expected a Hebrew tooltip for ${id}`);
  assert.doesNotMatch(FEAR_GREED_INDICATOR_TOOLTIPS_HE[id], /\bthe\b|\ban\b/i, `tooltip for ${id} should be Hebrew, not copied CNN English`);
}

// A missing sub-indicator is unavailable (null), never fabricated — and it
// does not block the overall score or the other 6 indicators.
const partialPayload = {
  fear_and_greed: validPayload.fear_and_greed,
  indicators: { ...validPayload.indicators, put_call_options: undefined },
};
const partial = normalizeCnnFearGreedPayload(partialPayload);
assert.ok(partial);
assert.equal(partial.score, 55);
assert.equal(partial.indicators.put_call_options, null);
assert.equal(partial.indicators.market_momentum.ratingKey, 'fear');

// An indicator with a score but an unrecognized rating string must not be
// guessed into one of the 5 known states.
const unknownRating = normalizeCnnFearGreedPayload({
  fear_and_greed: validPayload.fear_and_greed,
  indicators: { ...validPayload.indicators, market_momentum: { score: 40, rating: 'bullish' } },
});
assert.equal(unknownRating.indicators.market_momentum, null);

// An indicator with an out-of-range score is unavailable, not clamped/guessed.
const outOfRangeIndicator = normalizeCnnFearGreedPayload({
  fear_and_greed: validPayload.fear_and_greed,
  indicators: { ...validPayload.indicators, junk_bond_demand: { score: 150, rating: 'extreme greed' } },
});
assert.equal(outOfRangeIndicator.indicators.junk_bond_demand, null);

// No indicators object at all (older proxy/cache shape) -> every indicator
// unavailable, overall score still fine.
const noIndicators = normalizeCnnFearGreedPayload({ fear_and_greed: validPayload.fear_and_greed });
assert.ok(noIndicators);
assert.equal(noIndicators.score, 55);
for (const id of FEAR_GREED_INDICATOR_IDS) assert.equal(noIndicators.indicators[id], null);

// normalizeCnnRatingKey: case/whitespace-insensitive, rejects unknown strings.
assert.equal(normalizeCnnRatingKey('Extreme Greed'), 'extreme greed');
assert.equal(normalizeCnnRatingKey('  Fear  '), 'fear');
assert.equal(normalizeCnnRatingKey('NEUTRAL'), 'neutral');
assert.equal(normalizeCnnRatingKey('bogus'), null);
assert.equal(normalizeCnnRatingKey(''), null);
assert.equal(normalizeCnnRatingKey(null), null);
assert.equal(normalizeCnnRatingKey(42), null);

// The 5-state color/label mapping is complete (used by the score badge, the
// 7 indicator dots, and the bottom scale — one consistent mapping).
for (const key of ['extreme fear', 'fear', 'neutral', 'greed', 'extreme greed']) {
  assert.ok(FEAR_GREED_RATING_STYLES[key]?.labelHe, `expected a Hebrew label for ${key}`);
  assert.ok(FEAR_GREED_RATING_STYLES[key]?.dotCls, `expected a dot class for ${key}`);
  assert.ok(FEAR_GREED_RATING_STYLES[key]?.textCls, `expected a text class for ${key}`);
}

assert.equal(normalizeCnnFearGreedPayload(null), null);
assert.equal(normalizeCnnFearGreedPayload({}), null);
assert.equal(normalizeCnnFearGreedPayload({ fear_and_greed: {} }), null);
assert.equal(normalizeCnnFearGreedPayload({ fear_and_greed: { score: 'not-a-number' } }), null);
assert.equal(normalizeCnnFearGreedPayload({ fear_and_greed: { score: -1 } }), null);
assert.equal(normalizeCnnFearGreedPayload({ fear_and_greed: { score: 101 } }), null);
assert.equal(normalizeCnnFearGreedPayload({ fear_and_greed: { score: Number.NaN } }), null);

// A malformed/missing timestamp must not fail the whole payload — only the
// score is required for the card to render a verified value.
const missingTimestamp = normalizeCnnFearGreedPayload({ fear_and_greed: { score: 40 } });
assert.ok(missingTimestamp);
assert.equal(missingTimestamp.updatedAt, null);

const badTimestamp = normalizeCnnFearGreedPayload({
  fear_and_greed: { score: 40, timestamp: 'not-a-date' },
});
assert.ok(badTimestamp);
assert.equal(badTimestamp.updatedAt, null);

assert.equal(formatFearGreedUpdatedAt(null), null);
assert.equal(formatFearGreedUpdatedAt('not-a-date'), null);
assert.match(formatFearGreedUpdatedAt('2026-08-25T00:00:00+00:00'), /2026/);
// Requirement: show the time alongside the date, not just the date.
assert.match(formatFearGreedUpdatedAt('2026-08-25T00:00:00+00:00'), /\d{2}:\d{2}/);

// formatFearGreedCheckedAtTime: "last checked by the app" — time only, and
// independent of formatFearGreedUpdatedAt (CNN's own index timestamp).
assert.equal(formatFearGreedCheckedAtTime(null), null);
assert.equal(formatFearGreedCheckedAtTime('not-a-date'), null);
assert.match(formatFearGreedCheckedAtTime('2026-08-25T07:19:00.000Z'), /^\d{2}:\d{2}$/);

console.log('Fear & Greed live-fetch normalization QA: PASS');
