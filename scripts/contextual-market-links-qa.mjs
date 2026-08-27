import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CNN_FEAR_GREED_URL,
  FINVIZ_MARKET_MAP_URL,
  getSentimentSourceLink,
} from '../src/lib/sentimentSourceLinks.js';

assert.equal(CNN_FEAR_GREED_URL, 'https://www.cnn.com/markets/fear-and-greed');
assert.equal(FINVIZ_MARKET_MAP_URL, 'https://finviz.com/map');
assert.equal(getSentimentSourceLink({ label: 'פחד וחמדנות' })?.url, CNN_FEAR_GREED_URL);

for (const label of [
  'פתיחת מסחר בוול סטריט',
  'broad market sentiment',
  'overall market condition',
  'סנטימנט כללי',
]) {
  const link = getSentimentSourceLink({ label });
  assert.equal(link?.url, FINVIZ_MARKET_MAP_URL, label);
  assert.equal(link?.ariaLabel, 'פתיחת מפת השוק של Finviz', label);
}

const sectorCases = [
  ['Technology', 'XLK'], ['Tech', 'XLK'], ['טכנולוגיה', 'XLK'],
  ['Health Care', 'XLV'], ['Healthcare', 'XLV'], ['בריאות', 'XLV'],
  ['Biotechnology', 'XLV'], ['Biotech', 'XLV'], ['Pharma', 'XLV'],
  ['Pharmaceuticals', 'XLV'], ['ביוטכנולוגיה', 'XBI'], ['תרופות', 'XLV'], ['ביומד', 'XLV'],
  ['Consumer Discretionary', 'XLY'], ['Retail', 'XLY'], ['Home Improvement', 'XLY'],
  ['צריכה מחזורית', 'XLY'], ['קמעונאות', 'XLY'], ['שיפוץ בית', 'XLY'],
  ['Consumer Staples', 'XLP'], ['צריכה בסיסית', 'XLP'],
  ['Communication Services', 'XLC'], ['Communications', 'XLC'], ['תקשורת', 'XLC'],
  ['Financials', 'XLF'], ['Finance', 'XLF'], ['פיננסים', 'XLF'],
  ['Energy', 'XLE'], ['אנרגיה', 'XLE'],
  ['Industrials', 'XLI'], ['Industry', 'XLI'], ['תעשייה', 'XLI'],
  ['Materials', 'XLB'], ['Basic Materials', 'XLB'], ['חומרי גלם', 'XLB'],
  ['Real Estate', 'XLRE'], ['נדל״ן', 'XLRE'],
  ['Utilities', 'XLU'], ['שירותים ציבוריים', 'XLU'],
];

for (const [label, ticker] of sectorCases) {
  const link = getSentimentSourceLink({ label });
  assert.equal(link?.ticker, ticker, label);
  assert.equal(link?.url, `https://finviz.com/stock?t=${ticker}`, label);
  assert.equal(link?.ariaLabel, `פתיחת תעודת הסל ${ticker} ב־Finviz`, label);
}

assert.equal(getSentimentSourceLink({ label: 'סקטור הביומד / מודרנה' })?.ticker, 'XLV');
assert.equal(getSentimentSourceLink({ label: 'ביוטכנולוגיה ותרופות' })?.ticker, 'XLV');
assert.equal(getSentimentSourceLink({ label: 'קמעונאות ומוצרי שיפוץ בית' })?.ticker, 'XLY');
assert.equal(getSentimentSourceLink({ label: 'סקטור למעקב', value: 'טכנולוגיה' })?.ticker, 'XLK');
assert.equal(getSentimentSourceLink({ label: 'סקטור לא מוכר', value: 'חברה אלמונית' }), null);
assert.equal(getSentimentSourceLink({ label: 'טכנולוגיה / פיננסים' }), null);

const oldSnapshot = {
  sentiment: [
    { label: 'סקטור הביומד / מודרנה', value: 'positive', ticker: 'MRNA' },
    { label: 'פתיחת מסחר בוול סטריט', value: 'unknown' },
  ],
};
const before = JSON.stringify(oldSnapshot);
for (const row of oldSnapshot.sentiment) getSentimentSourceLink(row);
assert.equal(JSON.stringify(oldSnapshot), before);
assert.equal(oldSnapshot.sentiment[0].ticker, 'MRNA');
assert.equal(getSentimentSourceLink({ label: 'טכנולוגיה' })?.ticker, 'XLK');
assert.equal(getSentimentSourceLink(null), null);

const panelsSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);
assert.ok(panelsSource.includes('href={CNN_FEAR_GREED_URL}'));
assert.ok(panelsSource.includes('aria-label="פתיחת מדד הפחד והחמדנות של CNN"'));
assert.ok(panelsSource.includes('target="_blank"'));
assert.ok(panelsSource.includes('rel="noopener noreferrer"'));
assert.ok(panelsSource.includes('onClick={(event) => event.stopPropagation()}'));
assert.ok(panelsSource.includes('data-contextual-sentiment-link={sourceLink.id}'));
assert.ok(panelsSource.includes('translateKnownIndicatorEnumValue(descriptionText)'));
assert.ok(panelsSource.includes('encodeURIComponent(ticker)'));

const sectorTableSource = readFileSync(
  new URL('../src/components/dashboard/MarketSectorTable.jsx', import.meta.url),
  'utf8',
);
const primitivesSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefVisualPrimitives.jsx', import.meta.url),
  'utf8',
);
const linkedTextSource = readFileSync(
  new URL('../src/components/shared/LinkedMarketText.jsx', import.meta.url),
  'utf8',
);
const insightCardsSource = readFileSync(
  new URL('../src/components/dashboard/MacroStyleInsightCards.jsx', import.meta.url),
  'utf8',
);
assert.ok(sectorTableSource.includes('onClick={(e) => e.stopPropagation()}'));
assert.ok(primitivesSource.includes('resolveSectorTableFinvizLink(sectorName)'));
assert.ok(primitivesSource.includes('data-finviz-link={sectorLink.ticker}'));
assert.ok(primitivesSource.includes('focus-visible:ring-2'));
assert.ok(linkedTextSource.includes('<AnalysisTickerLink'));
assert.ok(linkedTextSource.includes('data-contextual-sector-link={contextualLink.ticker}'));
assert.ok(linkedTextSource.includes('onClick={(event) => event.stopPropagation()}'));
assert.ok(insightCardsSource.includes('resolveSectorTableFinvizLink(title)'));
assert.ok(insightCardsSource.includes('renderLinkedMarketText(title, { contextualLink: titleContextualLink })'));

console.log(`contextual market links QA: ${sectorCases.length * 3 + 38} assertions passed`);
