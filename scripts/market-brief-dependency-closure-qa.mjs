import assert from 'node:assert/strict';

import {
  INDICATOR_ENUM_UNKNOWN_LABEL,
  translateIndicatorEnumValue,
  translateIndicatorStatusDisplay,
  translateKnownIndicatorEnumValue,
} from '../src/lib/indicatorEnumDisplay.js';
import {
  UNKNOWN_MARKET_ASSET_DESCRIPTION,
  getMarketAssetDescription,
  normalizeMarketAssetDescriptionId,
} from '../src/lib/marketAssetDescriptions.js';
import {
  buildSectorTableFinvizUrl,
  normalizeSectorLabelForMapping,
  resolveSectorSentimentPresentation,
  resolveSectorTableEtfTicker,
  resolveSectorTableFinvizLink,
} from '../src/lib/sectorTablePresentation.js';

assert.equal(normalizeMarketAssetDescriptionId('btc'), 'BITCOIN');
assert.match(getMarketAssetDescription('SPX'), /S&P 500/);
assert.equal(getMarketAssetDescription('unsupported asset'), UNKNOWN_MARKET_ASSET_DESCRIPTION);

assert.equal(INDICATOR_ENUM_UNKNOWN_LABEL, 'לא ידוע');
assert.equal(translateIndicatorEnumValue('bullish'), 'שורי');
assert.equal(translateIndicatorEnumValue('unexpected'), 'לא ידוע');
assert.equal(translateKnownIndicatorEnumValue('neutral'), 'ניטרלי');
assert.equal(translateKnownIndicatorEnumValue('84.1'), '84.1');
assert.equal(translateKnownIndicatorEnumValue('טקסט קיים'), 'טקסט קיים');
assert.equal(translateIndicatorStatusDisplay('bearish ↓'), 'דובי ↓');

assert.equal(normalizeSectorLabelForMapping('  נדל״ן / Real Estate  '), 'נדלן real estate');
assert.equal(resolveSectorTableEtfTicker('טכנולוגיה'), 'XLK');
assert.equal(resolveSectorTableEtfTicker('ביוטכנולוגיה ותרופות'), 'XLV');
assert.equal(resolveSectorTableFinvizLink('טכנולוגיה')?.url, 'https://finviz.com/stock?t=XLK');
assert.equal(buildSectorTableFinvizUrl('XLV'), 'https://finviz.com/stock?t=XLV');

for (const value of [
  '',
  'unknown',
  'שירותים',
  'סקטור לא מוכר',
  'ביוטכנולוגיה / טכנולוגיה',
]) {
  assert.equal(resolveSectorTableEtfTicker(value), null, `must not classify ${value || 'empty input'}`);
  assert.equal(resolveSectorTableFinvizLink(value), null, `must not link ${value || 'empty input'}`);
}

assert.equal(buildSectorTableFinvizUrl('NOT-A-TICKER'), null);
assert.deepEqual(resolveSectorSentimentPresentation('into'), {
  rawValue: 'into',
  displayValue: 'כניסה לסקטור',
  tone: 'positive',
});
assert.deepEqual(resolveSectorSentimentPresentation('custom status'), {
  rawValue: 'custom status',
  displayValue: 'custom status',
  tone: null,
});

const legacyRow = { sector: 'טכנולוגיה', sentiment: 'into' };
const before = JSON.stringify(legacyRow);
resolveSectorTableFinvizLink(legacyRow.sector);
resolveSectorSentimentPresentation(legacyRow.sentiment);
assert.equal(JSON.stringify(legacyRow), before, 'helpers must not mutate legacy data');

console.log('market brief dependency closure QA: PASS');
