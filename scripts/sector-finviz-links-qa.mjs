import assert from 'node:assert/strict';

import {
  buildSectorTableFinvizUrl,
  resolveSectorTableEtfTicker,
  resolveSectorTableFinvizLink,
  resolveSectorTableFinvizLinks,
} from '../src/lib/sectorFinvizLinks.js';

const singleLinkCases = [
  ['שבבים', 'SMH'],
  ['מוליכים למחצה (Semiconductors)', 'SMH'],
  ['שבבים וסמיקונדקטורס', 'SMH'],
  ['תוכנה', 'IGV'],
  ['פארמה ובריאות', 'XLV'],
  ['סולאר ואנרגיה נקייה', 'TAN'],
  ['פרסום וצריכה רגישה', 'XLY'],
  ['סייבר', 'CIBR'],
  ['ביטחון ותעופה', 'ITA'],
  ['תשתיות מחשוב וענן', 'SKYY'],
  ['AI', 'BOTZ'],
];

for (const [label, ticker] of singleLinkCases) {
  assert.equal(resolveSectorTableEtfTicker(label), ticker, label);
  assert.deepEqual(resolveSectorTableFinvizLink(label), {
    ticker,
    url: `https://finviz.com/stock?t=${ticker}`,
  }, label);
  assert.deepEqual(resolveSectorTableFinvizLinks(label), [{
    label,
    ticker,
    url: `https://finviz.com/stock?t=${ticker}`,
  }], label);
}

const prefixedAliasCases = [
  ['ענף התוכנה', 'IGV'],
  ['חברות הפארמה', 'XLV'],
  ['תחום הסמיקונדקטורס', 'SMH'],
  ['תחום הסייבר', 'CIBR'],
  ['תחום הביטחון', 'ITA'],
  ['סקטור הסולאר', 'TAN'],
  ['חברות הקמעונאות', 'XLY'],
  ['שירותי הענן', 'SKYY'],
  ['תחום הבינה המלאכותית', 'BOTZ'],
];

for (const [label, ticker] of prefixedAliasCases) {
  assert.equal(resolveSectorTableEtfTicker(label), ticker, label);
  assert.equal(resolveSectorTableFinvizLink(label)?.url, `https://finviz.com/stock?t=${ticker}`, label);
}

assert.deepEqual(resolveSectorTableFinvizLinks('שבבים ותשתיות AI'), [
  { label: 'שבבים', ticker: 'SMH', url: 'https://finviz.com/stock?t=SMH' },
  { label: 'תשתיות AI', ticker: 'BOTZ', url: 'https://finviz.com/stock?t=BOTZ' },
]);

assert.deepEqual(resolveSectorTableFinvizLinks('תשתיות מחשוב וענן (Data Centers / AI)'), [
  { label: 'תשתיות מחשוב וענן', ticker: 'SKYY', url: 'https://finviz.com/stock?t=SKYY' },
  { label: 'AI', ticker: 'BOTZ', url: 'https://finviz.com/stock?t=BOTZ' },
]);

for (const label of ['', '—', 'unknown', 'סקטור לא מוכר', 'שירותים', 'ביוטכנולוגיה / טכנולוגיה']) {
  assert.equal(resolveSectorTableEtfTicker(label), null, label);
  assert.equal(resolveSectorTableFinvizLink(label), null, label);
  assert.deepEqual(resolveSectorTableFinvizLinks(label), [], label);
}

assert.equal(buildSectorTableFinvizUrl('SMH'), 'https://finviz.com/stock?t=SMH');
assert.equal(buildSectorTableFinvizUrl('not-a-ticker'), null);

console.log('sector Finviz links QA: all assertions passed');
