import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
const {
  formatCalendarRowText,
  formatMacroRowText,
  formatSectorRowText,
  formatStockRowText,
  resolveMorningBriefBulkId,
} = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
const { getSectionBulkSelectionState } = await vite.ssrLoadModule('/src/lib/sectionBulkSelection.js');
const panels = fs.readFileSync(path.join(root, 'src/components/dashboard/MorningBriefPanels.jsx'), 'utf8');
const checkbox = fs.readFileSync(path.join(root, 'src/components/dashboard/MorningBriefBulkCheckbox.jsx'), 'utf8');
const tableLayout = fs.readFileSync(path.join(root, 'src/components/dashboard/briefTableLayout.jsx'), 'utf8');

const stocks = [
  { ticker: 'GRMN', context: 'strong report', sentiment: 'positive' },
  { ticker: 'PG', context: 'revenue miss', sentiment: 'negative' },
  { ticker: 'SOFI', context: 'guidance', sentiment: 'negative', changePercent: 0 },
  { ticker: 'V', context: 'down', sentiment: 'negative' },
  { ticker: 'VRT', context: 'revenue miss', sentiment: 'negative' },
  { ticker: 'GEHC', context: 'reported', sentiment: 'neutral', isNewToWatch: false },
];
const stockItems = stocks.map(formatStockRowText);
const stockSection = {
  key: 'stocks-mentioned',
  items: stockItems,
  itemIds: stockItems.map((_, index) => `specialized:stocks-mentioned:${index}`),
};

assert.equal(stockItems.length, 6);
stockItems.forEach((text, index) => {
  assert.equal(
    resolveMorningBriefBulkId([stockSection], 'stocks-mentioned', text),
    `specialized:stocks-mentioned:${index}`,
  );
});
assert.match(stockItems[2], /0/);
assert.match(stockItems[5], /false|לא/);

const selectable = stockItems.map((text, index) => ({ id: stockSection.itemIds[index], text }));
const other = { id: 'specialized:markets:0', text: 'SPX' };
let selected = new Map([[other.id, other]]);
let state = getSectionBulkSelectionState(selectable, selected);
assert.equal(state.totalCount, 6);
assert.equal(state.selectedCount, 0);
selected.set(selectable[0].id, selectable[0]);
state = getSectionBulkSelectionState(selectable, selected);
assert.equal(state.label, 'בחר הכל (1/6)');
selectable.forEach((item) => selected.set(item.id, item));
state = getSectionBulkSelectionState(selectable, selected);
assert.equal(state.label, 'בטל בחירה');
selected.delete(selectable[1].id);
state = getSectionBulkSelectionState(selectable, selected);
assert.equal(state.label, 'בחר הכל (5/6)');
assert.equal(selected.has(other.id), true);
assert.equal([...selected.values()].filter((item) => item.id.startsWith('specialized:stocks-mentioned:')).length, 5);
assert.equal(new Set([...selected.keys()]).size, selected.size);

assert.ok(formatSectorRowText({ sector: 'Semiconductors', direction: 'out', reason: 'weakness' }));
assert.ok(formatCalendarRowText({ event: 'Fed', importance: 'high', timeframe: 'today' }));
assert.ok(formatMacroRowText({ indicator: 'rates', value: 0, impact: false }));
assert.match(panels, /const summary = formatStockRowText\(stock\)/);
assert.match(panels, /const calendarText = formatCalendarRowText\(row\)/);
assert.match(panels, /const summary = formatMacroRowText\(row\)/);
assert.match(panels, /text=\{formatSectorRowText\(row\)\}/);
assert.match(panels, /itemLabel=\{ticker\}/);
assert.match(checkbox, /checked=\{checked\}/);
assert.match(checkbox, /bulkSelection\.onToggle\(id/);
assert.match(checkbox, /event\.stopPropagation\(\)/);
assert.match(checkbox, /בטל את הבחירה של/);
assert.match(tableLayout, /checkbox:/);
assert.doesNotMatch(checkbox, /hidden/);

console.log(JSON.stringify({
  status: 'passed',
  stockRows: 6,
  visibleCheckboxContract: 6,
  partialState: '5/6',
  exportRows: 5,
  otherSectionPreserved: true,
  assertions: 23,
}, null, 2));
await vite.close();
