import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildSectorTableFinvizUrl,
  normalizeSectorLabelForMapping,
  resolveSectorSentimentPresentation,
  resolveSectorTableEtfTicker,
  resolveSectorTableFinvizLink,
  resolveSectorTableFinvizLinks,
} from '../src/lib/sectorTablePresentation.js';

const aliasCases = [
  ['health care', 'XLV'], ['healthcare', 'XLV'], ['biotech', 'XLV'], ['biotechnology', 'XLV'], ['pharma', 'XLV'],
  ['pharmaceuticals', 'XLV'], ['ביוטכנולוגיה', 'XBI'], ['תרופות', 'XLV'], ['בריאות', 'XLV'], ['פארמה', 'XLV'], ['ביומד', 'XLV'],
  ['software', 'IGV'], ['software services', 'IGV'], ['תוכנה', 'IGV'],
  ['consumer discretionary', 'XLY'], ['retail', 'XLY'], ['home improvement', 'XLY'],
  ['קמעונאות', 'XLY'], ['שיפוץ בית', 'XLY'], ['צריכה מחזורית', 'XLY'],
  ['technology', 'XLK'], ['tech', 'XLK'], ['טכנולוגיה', 'XLK'],
  ['financials', 'XLF'], ['finance', 'XLF'], ['פיננסים', 'XLF'],
  ['energy', 'XLE'], ['אנרגיה', 'XLE'], ['industrials', 'XLI'], ['industry', 'XLI'], ['תעשייה', 'XLI'],
  ['real estate', 'XLRE'], ['נדל״ן', 'XLRE'], ['utilities', 'XLU'], ['שירותים ציבוריים', 'XLU'],
  ['materials', 'XLB'], ['basic materials', 'XLB'], ['חומרי גלם', 'XLB'], ['consumer staples', 'XLP'], ['צריכה בסיסית', 'XLP'],
  ['communication services', 'XLC'], ['communications', 'XLC'], ['תקשורת', 'XLC'],
  ['semiconductors', 'SMH'], ['chips', 'SMH'], ['סמיקונדקטורס', 'SMH'], ['cybersecurity', 'CIBR'], ['cyber', 'CIBR'], ['סייבר', 'CIBR'],
  ['aerospace defense', 'ITA'], ['defense aerospace', 'ITA'], ['defense', 'ITA'], ['ביטחון', 'ITA'],
  ['cloud computing', 'SKYY'], ['cloud', 'SKYY'], ['ענן', 'SKYY'], ['artificial intelligence', 'BOTZ'], ['AI', 'BOTZ'],
];

const mentionedStocksSectorCases = [
  ['טכנולוגיה', 'XLK'], ['טכנולוגיית מידע', 'XLK'], ['בריאות', 'XLV'], ['פיננסים', 'XLF'],
  ['צריכה מחזורית', 'XLY'], ['צריכה מחזורית/מחזורית', 'XLY'], ['צריכה בסיסית', 'XLP'], ['צריכה הגנתית', 'XLP'],
  ['תעשייה', 'XLI'], ['תעשיות', 'XLI'], ['אנרגיה', 'XLE'], ['חומרי גלם', 'XLB'], ['חומרים', 'XLB'],
  ['נדל״ן', 'XLRE'], ['נדל"ן', 'XLRE'], ['שירותים ציבוריים', 'XLU'], ['תקשורת', 'XLC'], ['שירותי תקשורת', 'XLC'],
  ['מוליכים למחצה', 'SMH'], ['שבבים', 'SMH'], ['ביוטכנולוגיה', 'XBI'],
];

for (const [label, ticker] of aliasCases) {
  assert.equal(resolveSectorTableEtfTicker(label), ticker, label);
  assert.equal(resolveSectorTableFinvizLink(label)?.url, `https://finviz.com/stock?t=${ticker}`, label);
}

for (const [label, ticker] of mentionedStocksSectorCases) {
  assert.equal(resolveSectorTableEtfTicker(label), ticker, label);
  assert.equal(resolveSectorTableFinvizLink(label)?.url, `https://finviz.com/stock?t=${ticker}`, label);
}

assert.equal(resolveSectorTableEtfTicker('ביוטכנולוגיה ותרופות'), 'XLV');
assert.equal(resolveSectorTableEtfTicker('פארמה ובריאות'), 'XLV');
assert.equal(resolveSectorTableEtfTicker('תוכנה'), 'IGV');
assert.equal(resolveSectorTableEtfTicker('ענף התוכנה'), 'IGV');
assert.equal(resolveSectorTableEtfTicker('חברות הפארמה'), 'XLV');
assert.equal(resolveSectorTableEtfTicker('שבבים ומוליכים למחצה'), 'SMH');
assert.equal(resolveSectorTableEtfTicker('מוליכים למחצה (Semiconductors)'), 'SMH');
assert.equal(resolveSectorTableEtfTicker('שבבים וחומרה'), 'SMH');
assert.equal(resolveSectorTableEtfTicker('שבבים וסמיקונדקטורס'), 'SMH');
assert.equal(resolveSectorTableEtfTicker('תחום הסמיקונדקטורס'), 'SMH');
assert.equal(resolveSectorTableEtfTicker('ענף השבבים והחומרה'), 'SMH');
assert.equal(resolveSectorTableEtfTicker('שבבים ותשתיות AI'), 'SMH');
assert.equal(resolveSectorTableEtfTicker('סייבר'), 'CIBR');
assert.equal(resolveSectorTableEtfTicker('תחום הסייבר'), 'CIBR');
assert.equal(resolveSectorTableEtfTicker('ביטחון ותעופה'), 'ITA');
assert.equal(resolveSectorTableEtfTicker('תחום הביטחון'), 'ITA');
assert.equal(resolveSectorTableEtfTicker('תשתיות מחשוב וענן (Data Centers / AI)'), 'SKYY');
assert.equal(resolveSectorTableEtfTicker('סולאר ואנרגיה נקייה'), 'TAN');
assert.equal(resolveSectorTableEtfTicker('פרסום וצריכה רגישה'), 'XLY');
assert.equal(resolveSectorTableEtfTicker('סקטור הביומד / מודרנה'), 'XLV');
assert.equal(resolveSectorTableEtfTicker('קמעונאות ומוצרי שיפוץ בית'), 'XLY');
assert.equal(resolveSectorTableFinvizLink('ביוטכנולוגיה ותרופות')?.url, 'https://finviz.com/stock?t=XLV');
assert.equal(resolveSectorTableFinvizLink('פארמה ובריאות')?.url, 'https://finviz.com/stock?t=XLV');
assert.equal(resolveSectorTableFinvizLink('תוכנה')?.url, 'https://finviz.com/stock?t=IGV');
assert.equal(resolveSectorTableFinvizLink('שבבים ומוליכים למחצה')?.url, 'https://finviz.com/stock?t=SMH');
assert.equal(resolveSectorTableFinvizLink('מוליכים למחצה (Semiconductors)')?.url, 'https://finviz.com/stock?t=SMH');
assert.equal(resolveSectorTableFinvizLink('שבבים וחומרה')?.url, 'https://finviz.com/stock?t=SMH');
assert.equal(resolveSectorTableFinvizLink('שבבים וסמיקונדקטורס')?.url, 'https://finviz.com/stock?t=SMH');
assert.equal(resolveSectorTableFinvizLink('סייבר')?.url, 'https://finviz.com/stock?t=CIBR');
assert.equal(resolveSectorTableFinvizLink('ביטחון ותעופה')?.url, 'https://finviz.com/stock?t=ITA');
assert.deepEqual(resolveSectorTableFinvizLinks('תשתיות מחשוב וענן (Data Centers / AI)'), [
  { label: 'תשתיות מחשוב וענן', ticker: 'SKYY', url: 'https://finviz.com/stock?t=SKYY' },
  { label: 'AI', ticker: 'BOTZ', url: 'https://finviz.com/stock?t=BOTZ' },
]);
assert.deepEqual(resolveSectorTableFinvizLinks('שבבים ותשתיות AI'), [
  { label: 'שבבים', ticker: 'SMH', url: 'https://finviz.com/stock?t=SMH' },
  { label: 'תשתיות AI', ticker: 'BOTZ', url: 'https://finviz.com/stock?t=BOTZ' },
]);
assert.equal(resolveSectorTableFinvizLink('סולאר ואנרגיה נקייה')?.url, 'https://finviz.com/stock?t=TAN');
assert.equal(resolveSectorTableFinvizLink('פרסום וצריכה רגישה')?.url, 'https://finviz.com/stock?t=XLY');
assert.equal(resolveSectorTableFinvizLink('קמעונאות ומוצרי שיפוץ בית')?.url, 'https://finviz.com/stock?t=XLY');
assert.equal(buildSectorTableFinvizUrl('XLV'), 'https://finviz.com/stock?t=XLV');
assert.equal(resolveSectorTableEtfTicker('ביוטכנולוגיה / טכנולוגיה'), null);
assert.equal(resolveSectorTableFinvizLink('סקטור לא מוכר'), null);
assert.equal(resolveSectorTableFinvizLink('שירותים'), null);
assert.equal(resolveSectorTableFinvizLink(''), null);
assert.equal(resolveSectorTableFinvizLink('—'), null);
assert.equal(resolveSectorTableFinvizLink('unknown'), null);
assert.equal(normalizeSectorLabelForMapping('  נדל״ן / Real Estate  '), 'נדלן real estate');

for (const [label, ticker] of [
  ['בריאות', 'XLV'],
  ['מוליכים למחצה', 'SMH'],
  ['צריכה מחזורית', 'XLY'],
  ['תקשורת', 'XLC'],
]) {
  assert.equal(resolveSectorTableFinvizLink(label)?.url, `https://finviz.com/stock?t=${ticker}`);
}

assert.deepEqual(resolveSectorSentimentPresentation('into'), {
  rawValue: 'into', displayValue: 'כניסה לסקטור', tone: 'positive',
});
assert.deepEqual(resolveSectorSentimentPresentation('OUT'), {
  rawValue: 'OUT', displayValue: 'יציאה מהסקטור', tone: 'negative',
});
assert.deepEqual(resolveSectorSentimentPresentation('neutral'), {
  rawValue: 'neutral', displayValue: 'ניטרלי', tone: null,
});
assert.deepEqual(resolveSectorSentimentPresentation('positive'), {
  rawValue: 'positive', displayValue: 'חיובי', tone: 'positive',
});
assert.deepEqual(resolveSectorSentimentPresentation('unknown'), {
  rawValue: 'unknown', displayValue: 'לא ידוע', tone: null,
});

const oldSnapshot = {
  sectorRotation: [
    { sector: 'ביוטכנולוגיה ותרופות', sentiment: 'into', reason: 'historical row' },
    { sector: 'קמעונאות ומוצרי שיפוץ בית', sentiment: 'out', reason: 'historical row' },
  ],
};
const before = JSON.stringify(oldSnapshot);
for (const row of oldSnapshot.sectorRotation) {
  resolveSectorTableFinvizLink(row.sector);
  resolveSectorSentimentPresentation(row.sentiment);
}
assert.equal(JSON.stringify(oldSnapshot), before);
assert.equal(oldSnapshot.sectorRotation[0].sentiment, 'into');
assert.equal(oldSnapshot.sectorRotation[1].sentiment, 'out');

const tableSource = readFileSync(
  new URL('../src/components/dashboard/MarketSectorTable.jsx', import.meta.url),
  'utf8',
);
assert.ok(tableSource.includes('target="_blank"'));
assert.ok(tableSource.includes('rel="noopener noreferrer"'));
assert.ok(tableSource.includes('aria-label={`פתיחת תעודת הסל ${link.ticker} ב־Finviz`}'));
assert.ok(tableSource.includes('focus-visible:ring-2'));
assert.ok(tableSource.includes('<SectorSentimentCell value={normalized.sentiment} />'));
assert.ok(tableSource.includes("positive ? 'bg-emerald-500' : 'bg-orange-500'"));
assert.ok(tableSource.includes("'text-emerald-700 dark:text-emerald-400'"));
assert.ok(tableSource.includes("'text-orange-700 dark:text-orange-400'"));
assert.ok(tableSource.includes('sentiment: sentimentLabel'));
assert.ok(tableSource.includes("data-finviz-link={item.ticker}"));
assert.ok(tableSource.includes("{index > 0 ? <span aria-hidden>ו־</span> : null}"));

const mentionedStocksSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);
assert.ok(mentionedStocksSource.includes("const FINVIZ_GROUPS_URL = 'https://finviz.com/groups';"));
assert.ok(mentionedStocksSource.includes("const FINVIZ_GROUPS_ARIA_LABEL = 'פתיחת סקירת הסקטורים והקבוצות באתר Finviz';"));
const sectorHeaderLinkMatch = mentionedStocksSource.match(/function SectorGroupsHeaderLink\(\) \{([\s\S]*?)\n\}/);
assert.ok(sectorHeaderLinkMatch, 'sector groups header link component exists');
const sectorHeaderLinkSource = sectorHeaderLinkMatch[1];
assert.ok(sectorHeaderLinkSource.includes('href={FINVIZ_GROUPS_URL}'));
assert.ok(sectorHeaderLinkSource.includes('target="_blank"'));
assert.ok(sectorHeaderLinkSource.includes('rel="noopener noreferrer"'));
assert.ok(sectorHeaderLinkSource.includes('aria-label={FINVIZ_GROUPS_ARIA_LABEL}'));
assert.ok(sectorHeaderLinkSource.includes('title="השוואת ביצועים בין סקטורים ב־Finviz"'));
assert.ok(sectorHeaderLinkSource.includes('onClick={(event) => event.stopPropagation()}'));
assert.ok(sectorHeaderLinkSource.includes('<span>סקירת סקטורים ב־Finviz</span>'));
assert.ok(sectorHeaderLinkSource.includes('>↗</span>'));
assert.ok(sectorHeaderLinkSource.includes('cursor-pointer'));
assert.ok(sectorHeaderLinkSource.includes('focus-visible:ring-2'));
assert.ok(sectorHeaderLinkSource.includes('dark:hover:'));
assert.ok(!sectorHeaderLinkSource.includes('utm_'));
assert.equal(mentionedStocksSource.match(/data-sector-groups-finviz-link/g)?.length, 1);

const sectorOverviewStart = mentionedStocksSource.indexOf('export function SectorOverviewSection');
const sectorOverviewEnd = mentionedStocksSource.indexOf('const NEWS_EXTERNAL_SOURCES', sectorOverviewStart);
const sectorOverviewSource = mentionedStocksSource.slice(sectorOverviewStart, sectorOverviewEnd);
assert.ok(sectorOverviewSource.includes('headerLinks={<SectorGroupsHeaderLink />}'));
assert.ok(sectorOverviewSource.includes('headerActions={edit.headerActions}'));
assert.ok(sectorOverviewSource.includes("resolveMorningBriefSectionChildItems(bulkSections, 'sectors')"));
assert.ok(sectorOverviewSource.includes('<MarketSectorTable'));

const visualPrimitivesSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefVisualPrimitives.jsx', import.meta.url),
  'utf8',
);
assert.ok(visualPrimitivesSource.includes('flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-x-3'));
assert.ok(visualPrimitivesSource.includes('flex min-w-0 flex-wrap items-center justify-between gap-2 md:shrink-0 md:justify-start'));
// TRADINGBRAIN-STOCKS-SECTOR-ENRICHMENT: the sector cell now resolves via the
// shared resolveStockSectorDisplay() (ticker map + stored-value-first order)
// instead of calling resolveSectorTableFinvizLink(sectorLabel) directly —
// same underlying Finviz link helper (sectorFinvizLinks.js), reused inside
// the shared resolver rather than called a second time in this component.
assert.ok(mentionedStocksSource.includes('resolveStockSectorDisplay({ ticker, storedSector: stock.sector })'));
assert.ok(mentionedStocksSource.includes('href={sectorLink.url}'));
assert.ok(mentionedStocksSource.includes('target="_blank"'));
assert.ok(mentionedStocksSource.includes('rel="noopener noreferrer"'));
assert.ok(mentionedStocksSource.includes('onClick={(event) => event.stopPropagation()}'));
assert.ok(mentionedStocksSource.includes('title="פתיחת תעודת הסל של הסקטור ב־Finviz"'));
assert.ok(mentionedStocksSource.includes('aria-label={`פתיחת סקטור ${sectorLabel} באמצעות תעודת הסל ${sectorLink.ticker} באתר Finviz`}'));
assert.ok(mentionedStocksSource.includes('data-stock-sector-finviz-link={sectorLink.ticker}'));
assert.ok(mentionedStocksSource.includes('focus-visible:ring-2'));
assert.ok(!mentionedStocksSource.includes('resolveSectorTableFinvizLink(ticker)'));
assert.ok(!mentionedStocksSource.includes('showHelperLinks && sectorLink'));

console.log('sector table presentation QA: all assertions passed');
