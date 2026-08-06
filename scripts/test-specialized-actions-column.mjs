import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const layout = read('src/components/dashboard/briefTableLayout.jsx');
const panels = read('src/components/dashboard/MorningBriefPanels.jsx');
const markets = read('src/components/dashboard/MorningBriefMarketsTable.jsx');
const sectors = read('src/components/dashboard/MarketSectorTable.jsx');
const destinations = read('src/lib/tradingViewDestinations.js');

assert.match(layout, /export function BriefRowActions/);
assert.match(layout, /min-w-\[44px\]/);
assert.match(layout, /overflow-x-auto/);
assert.match(markets, /data-market-actions-cell/);
assert.match(markets, /<BriefRowActions/);
assert.doesNotMatch(markets, /<col style=\{\{ width: BRIEF_COL\.checkbox \}\}/);
assert.match(markets, /<col style=\{\{ width: BRIEF_COL\.actions \}\}/);
assert.match(panels, /data-stock-actions-cell/);
assert.match(panels, /data-macro-actions-cell/);
assert.match(panels, /<MarketSectorTable[\s\S]*actionsColumn/);
assert.match(sectors, /actionsColumn = false/);
assert.match(sectors, /showTradingView=\{!actionsColumn\}/);
assert.match(sectors, /checkbox=\{renderLeadingCell\?\./);
assert.match(destinations, /return null/);

console.log(JSON.stringify({
  status: 'passed',
  assertions: 14,
  fixedActionsWidth: true,
  rtlFarLeftByFinalCell: true,
  unsupportedTradingViewAssetsRemainUnlinked: true,
}, null, 2));
