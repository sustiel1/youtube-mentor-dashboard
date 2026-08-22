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
const tooltipSource = readFileSync(
  new URL('../src/components/shared/MarketAssetDescriptionTooltip.jsx', import.meta.url),
  'utf8',
);

for (const [label, source] of [['dedicated content', liveSource], ['saved snapshot', snapshotSource]]) {
  const assetHeading = source.indexOf('>נכס</th>');
  const descriptionHeading = source.indexOf('>מה הוא מייצג</th>');
  const linksHeading = source.indexOf('>קישורים</th>');
  assert.ok(assetHeading >= 0, `${label} asset heading`);
  assert.equal(descriptionHeading, -1, `${label} removes the visible description heading`);
  assert.ok(linksHeading > assetHeading, `${label} links follow asset`);
  assert.ok(source.includes('<MarketAssetDescriptionTooltip'), `${label} attaches shared tooltip to the asset`);
  assert.equal(source.includes('data-market-asset-description-mobile'), false, `${label} removes mobile description text`);
  assert.equal(source.includes('data-market-asset-description>'), false, `${label} removes desktop description cell`);
  assert.ok(source.includes('<MarketAssetProviderLinks'), `${label} preserves provider links`);
}

const snapshotStocksSource = snapshotSource.slice(snapshotSource.indexOf('function StocksTable'), snapshotSource.indexOf('function MarketsTable'));
const snapshotMarketsSource = snapshotSource.slice(snapshotSource.indexOf('function MarketsTable'), snapshotSource.indexOf('function SentimentTable'));
assert.equal(snapshotMarketsSource.includes('sm:min-w-[940px]'), false, 'saved Markets table releases description width');
assert.equal(snapshotStocksSource.includes('sm:min-w-[940px]'), false, 'neighboring Stocks table geometry remains unchanged');

const liveRowStart = liveSource.indexOf('data-market-item');
const liveRowEnd = liveSource.indexOf('</tr>', liveRowStart);
const liveRowSource = liveSource.slice(liveRowStart, liveRowEnd);
assert.equal((liveRowSource.match(/<MorningBriefBulkCheckbox/g) || []).length, 1, 'market row keeps exactly one checkbox');
assert.ok(liveRowSource.indexOf('<MorningBriefBulkCheckbox') < liveRowSource.indexOf('<MarketAssetDescriptionTooltip'), 'checkbox stays beside asset link');
assert.ok(liveRowSource.indexOf('<MarketAssetDescriptionTooltip') < liveRowSource.indexOf('data-markets-provider-links-cell'), 'tooltip stays in the asset cell before provider links');
const liveAssetCellSource = liveRowSource.slice(liveRowSource.indexOf('<td className={BRIEF_MARKETS_CELL.asset}>'), liveRowSource.indexOf('data-markets-provider-links-cell'));
assert.equal(liveAssetCellSource.includes('truncate'), false, 'asset symbols are never truncated');
assert.ok(liveAssetCellSource.includes('showInfoButton={false}'), 'live Markets asset cell suppresses the adjacent info control');
assert.ok(liveAssetCellSource.includes('showQualifier={false}'), 'live Markets asset cell suppresses visible proxy qualifiers');
assert.equal(liveRowSource.includes('onClick='), false, 'row keeps no click handler');

assert.ok(tooltipSource.includes('getMarketAssetDescription(assetName)'), 'tooltip preserves the shared description source');
assert.ok(tooltipSource.includes('description !== UNKNOWN_MARKET_ASSET_DESCRIPTION'), 'unknown descriptions are rejected');
assert.ok(tooltipSource.indexOf('if (!hasDescription || !showInfoButton)') < tooltipSource.indexOf('data-market-asset-description-info'), 'unknown or compact assets return before the info icon');
assert.ok(tooltipSource.includes('<MarketAssetPreferredLink'), 'tooltip preserves the existing asset link component');
assert.ok(tooltipSource.includes('descriptionId={descriptionId}'), 'asset link references the accessible description');
assert.ok(tooltipSource.includes('aria-describedby={descriptionId}'), 'info control references the accessible description');
assert.ok(tooltipSource.includes('<span id={descriptionId} className="sr-only">{description}</span>'), 'one stable hidden description backs both controls');
assert.equal(tooltipSource.includes('role="tooltip"'), false, 'Radix retains ownership of tooltip semantics');
assert.ok(tooltipSource.includes('onFocusCapture={(event) =>'), 'focus on the asset or info control opens the tooltip');
assert.ok(tooltipSource.includes('event.currentTarget.contains(event.relatedTarget)'), 'focus can move within the asset controls without closing');
assert.ok(tooltipSource.includes("event.key !== 'Escape'"), 'Escape closes the tooltip');
assert.ok(tooltipSource.includes('event.stopImmediatePropagation()'), 'Escape is contained inside parent dialogs');
assert.ok(tooltipSource.includes('collisionPadding={12}'), 'tooltip uses viewport collision padding');
assert.ok(tooltipSource.includes('max-w-[min(20rem,calc(100vw-1.5rem))]'), 'tooltip width stays within the viewport');
assert.ok(tooltipSource.includes('dir="rtl"'), 'tooltip content supports RTL');
assert.ok(tooltipSource.includes('onClick={(event) =>'), 'info control supports tap and keyboard activation');
assert.ok(tooltipSource.includes('setOpen(true)'), 'tap opens even when hover opened immediately before click');

for (const source of [liveSource, snapshotMarketsSource]) {
  const marketRenderer = source.includes('function MarketsTable')
    ? source.slice(source.indexOf('function MarketsTable'), source.indexOf('function SentimentTable'))
    : source;
  assert.equal(/fetch\(|indexedDB|localStorage|structuredSnapshot\s*=/.test(marketRenderer), false);
}

console.log('market asset descriptions QA passed');
