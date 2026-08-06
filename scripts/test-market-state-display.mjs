import assert from 'node:assert/strict';
import { formatMarketStateItem, formatMarketStateItems, normalizeHebrewFinancialTypography } from '../src/lib/summaryItemDisplay.js';
import { translateMarketEnum } from '../src/lib/sentimentDisplayI18n.js';

const source = {
  label: 'סנטימנט שוק כללי',
  value: 'מעורב-חיובי',
  sentiment: 'bullish',
  reason: 'מעבר מפרי-מרקט אדום לירוק עקב נסיגה בתשואות האג"ח והנפט',
};
const snapshot = JSON.stringify(source);
const line = formatMarketStateItem(source);
assert.equal(line, 'סנטימנט השוק: מעורב עם נטייה חיובית — מעבר מפרה־מרקט אדום לירוק עקב נסיגה בתשואות האג״ח והנפט');
for (const forbidden of ['label:', 'value:', 'sentiment:', 'reason:', 'note:', 'changePercent:', ' | ']) assert.doesNotMatch(line, new RegExp(forbidden.replace('|', '\\|')));
assert.equal(JSON.stringify(source), snapshot);

assert.equal(translateMarketEnum('mixed', 'sentiment'), 'מעורב');
assert.equal(translateMarketEnum('bullish', 'sentiment'), 'חיובי');
assert.equal(translateMarketEnum('bearish', 'sentiment'), 'שלילי');
assert.equal(translateMarketEnum('into', 'direction'), 'כניסת כספים');
assert.equal(translateMarketEnum('out', 'direction'), 'יציאת כספים');
assert.equal(translateMarketEnum('future-unknown', 'sentiment'), '');
assert.equal(translateMarketEnum(0, 'sentiment'), '0');
assert.equal(translateMarketEnum(false, 'sentiment'), 'false');
assert.equal(normalizeHebrewFinancialTypography('MSFT ירד ב־-2.5%'), 'MSFT ירד ב־-2.5%');

assert.deepEqual(formatMarketStateItems([source, 'mixed']), [line]);
assert.deepEqual(formatMarketStateItems(['mixed']), ['מצב רוח כללי: מעורב']);
assert.deepEqual(formatMarketStateItems(['טקסט עברי חופשי']), ['טקסט עברי חופשי']);

console.log('Market State semantic display: 18 assertions passed');
