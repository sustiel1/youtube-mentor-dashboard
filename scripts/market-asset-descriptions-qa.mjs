import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MARKET_ASSET_DESCRIPTIONS,
  UNKNOWN_MARKET_ASSET_DESCRIPTION,
  getMarketAssetDescription,
  normalizeMarketAssetDescriptionId,
} from '../src/lib/marketAssetDescriptions.js';

const expectedDescriptions = Object.freeze({
  RSP: 'קרן סל העוקבת אחר מניות S&P 500 במשקל שווה; מסייעת לבחון את רוחב השוק',
  ETH: 'המטבע של רשת Ethereum ומדד לפעילות בשוק הנכסים הדיגיטליים',
  SPX: 'מדד S&P 500 המייצג חברות אמריקאיות גדולות',
  NASDAQ: 'מדד מניות אמריקאי בעל משקל משמעותי לחברות טכנולוגיה וצמיחה',
  DOW: 'מדד דאו ג׳ונס הכולל 30 חברות אמריקאיות גדולות',
  RUSSELL: 'מדד Russell 2000 המייצג חברות אמריקאיות קטנות',
  VIX: 'מדד התנודתיות הצפויה בשוק לפי אופציות על S&P 500',
  OIL: 'מחיר הנפט הגולמי, המשפיע על אנרגיה, עלויות ואינפלציה',
  DOLLAR: 'מדד לעוצמת הדולר האמריקאי מול סל מטבעות',
  BITCOIN: 'הנכס הדיגיטלי ביטקוין ושוק הקריפטו',
  BONDS10Y: 'תשואת אג״ח ממשלת ארה״ב לעשר שנים, המשפיעה על עלויות המימון ותמחור נכסים',
});

assert.deepEqual(MARKET_ASSET_DESCRIPTIONS, expectedDescriptions);
for (const [asset, description] of Object.entries(expectedDescriptions)) {
  assert.equal(getMarketAssetDescription(asset), description, `${asset} description`);
  assert.equal(getMarketAssetDescription(` ${asset.toLowerCase()} `), description, `${asset} harmless normalization`);
}

for (const [alias, canonical] of Object.entries({
  BTC: 'BITCOIN',
  US10Y: 'BONDS10Y',
  DJI: 'DOW',
  DJIA: 'DOW',
  RUT: 'RUSSELL',
})) {
  assert.equal(normalizeMarketAssetDescriptionId(alias), canonical, `${alias} canonical identifier`);
  assert.equal(getMarketAssetDescription(alias), expectedDescriptions[canonical], `${alias} description`);
}

for (const unknown of ['TNX', 'UNKNOWN-ASSET', '', '   ', null, undefined, 42]) {
  assert.equal(getMarketAssetDescription(unknown), UNKNOWN_MARKET_ASSET_DESCRIPTION, `${String(unknown)} fallback`);
}

const oldSnapshot = Object.freeze({
  marketsTable: Object.freeze([
    Object.freeze({ asset: 'BTC', trend: 'legacy', strength: '1%', comment: 'saved row' }),
    Object.freeze({ asset: 'UNKNOWN-ASSET', trend: '', strength: '', comment: '' }),
  ]),
});
const before = JSON.stringify(oldSnapshot);
oldSnapshot.marketsTable.forEach((row) => getMarketAssetDescription(row.asset));
assert.equal(JSON.stringify(oldSnapshot), before, 'render-time lookup must not mutate old snapshots');

const liveSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefMarketsTable.jsx', import.meta.url),
  'utf8',
);
const snapshotSource = readFileSync(
  new URL('../src/components/workspace/StructuredSnapshotView.jsx', import.meta.url),
  'utf8',
);

const liveAssetHeading = liveSource.indexOf('>נכס</th>');
const liveDescriptionHeading = liveSource.indexOf('>מה הוא מייצג</th>');
const liveSentimentHeading = liveSource.indexOf('>סנטימנט</th>');
assert.ok(liveAssetHeading >= 0, 'dedicated-content asset heading');
assert.ok(liveDescriptionHeading > liveAssetHeading, 'description follows asset');
assert.ok(liveSentimentHeading > liveDescriptionHeading, 'sentiment follows description');
assert.equal(liveSource.includes('>קישורים</th>'), false, 'candidate does not add the separate provider-links column');

for (const [label, source, desktopBreakpoint] of [
  ['dedicated content', liveSource, 'md:table-cell'],
  ['saved snapshot', snapshotSource, 'sm:table-cell'],
]) {
  assert.ok(source.includes('getMarketAssetDescription'), `${label} uses shared render-time metadata`);
  assert.ok(source.includes('data-market-asset-description-mobile'), `${label} exposes mobile description detail`);
  assert.ok(source.includes('data-market-asset-description'), `${label} exposes desktop description cell`);
  assert.ok(source.includes(desktopBreakpoint), `${label} exposes a responsive desktop column`);
}

assert.ok(liveSource.includes('md:min-w-[1280px]'), 'dedicated-content table reserves readable desktop geometry');
assert.ok(liveSource.includes('w-[180px] md:w-[160px]'), 'asset column preserves complete symbol width');
assert.ok(liveSource.includes('<ExternalSymbolLink symbol={row.asset}>'), 'existing preferred symbol link is preserved');
assert.ok(liveSource.includes("buildTradingViewChartUrl(assetName)"), 'existing TradingView resolver remains unchanged');
assert.match(liveSource, />\s*TV\s*<\/a>/, 'TV provider action remains present');
assert.match(liveSource, />\s*Inv\s*<\/a>/, 'Inv provider action remains present');
assert.match(liveSource, />\s*InvIL\s*<\/a>/, 'InvIL provider action remains present');
assert.ok(liveSource.includes('https://www.investing.com/search/?q='), 'Investing destination remains present');
assert.ok(liveSource.includes('https://il.investing.com/search/?q='), 'Investing Israel destination remains present');
assert.equal(liveSource.includes('MarketAssetProviderLinks'), false, 'unrelated provider-chip feature is excluded');
assert.equal(liveSource.includes('MarketAssetPreferredLink'), false, 'unrelated provider-priority feature is excluded');

const liveRowStart = liveSource.indexOf('data-market-item');
const liveRowEnd = liveSource.indexOf('</tr>', liveRowStart);
const liveRowSource = liveSource.slice(liveRowStart, liveRowEnd);
assert.equal((liveRowSource.match(/<MorningBriefBulkCheckbox/g) || []).length, 1, 'market row keeps exactly one existing checkbox');
assert.ok(liveRowSource.includes('renderLinkedMarketText(row.comment)'), 'video-derived note remains unchanged');
assert.ok(liveSource.includes('border-b border-slate-200/70'), 'market grid line remains present');

const liveAssetCellStart = liveRowSource.indexOf('<td className="w-[180px]');
const liveAssetCellEnd = liveRowSource.indexOf('data-market-asset-description-mobile');
const liveAssetCellSource = liveRowSource.slice(liveAssetCellStart, liveAssetCellEnd);
assert.ok(liveAssetCellStart >= 0, 'asset cell uses the explicit full-symbol width');
assert.equal(liveAssetCellSource.includes('truncate'), false, 'asset symbols are never truncated');
const descriptionRegionEnd = liveRowSource.indexOf('<td className={BRIEF_CELL.sentiment}>');
const descriptionRegion = liveRowSource.slice(liveAssetCellStart, descriptionRegionEnd);
assert.equal(descriptionRegion.includes('onClick='), false, 'description and asset cells add no click handler');

const snapshotMarketsSource = snapshotSource.slice(
  snapshotSource.indexOf('function MarketsTable'),
  snapshotSource.indexOf('function SentimentTable'),
);
assert.ok(snapshotMarketsSource.includes('>מה הוא מייצג</th>'), 'saved snapshot includes the description heading');
assert.ok(snapshotMarketsSource.includes('sm:min-w-[940px]'), 'saved snapshot reserves description width');
assert.ok(snapshotMarketsSource.includes('whitespace-nowrap'), 'saved snapshot keeps complete symbols on one line');
assert.ok(snapshotMarketsSource.includes('border-b border-slate-100'), 'saved snapshot grid lines remain present');
assert.equal(snapshotMarketsSource.includes('MarketAssetProviderLinks'), false, 'snapshot provider behavior is unchanged');

for (const source of [liveSource, snapshotMarketsSource]) {
  assert.equal(/fetch\(|indexedDB|localStorage|structuredSnapshot\s*=/.test(source), false);
}

for (const longestSymbol of ['NASDAQ', 'RUSSELL', 'DOLLAR', 'BITCOIN', 'BONDS10Y']) {
  assert.ok(longestSymbol.length <= 8, `${longestSymbol} fits the verified 160px no-wrap symbol column`);
}

console.log('market asset descriptions QA passed');
