import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const helperUrl = pathToFileURL(path.join(root, 'src/lib/sectionBulkSelection.js')).href;
const { getSectionBulkSelectionState } = await import(helperUrl);

const markets = Array.from({ length: 9 }, (_, index) => ({
  id: `markets:${index}`,
  text: index === 0 ? '0' : (index === 1 ? 'false' : `market ${index}`),
}));
const stocks = Array.from({ length: 6 }, (_, index) => ({
  id: `stocks:${index}`,
  text: `stock ${index}`,
}));
const malformed = [
  { id: '', text: 'missing id' },
  { id: 'missing-text', text: '' },
  null,
];

let selected = new Map(stocks.map((item) => [item.id, item]));
let state = getSectionBulkSelectionState([...markets, ...malformed], selected);
assert.equal(state.totalCount, 9);
assert.equal(state.selectedCount, 0);
assert.equal(state.label, 'בחר הכל');
assert.equal(state.ariaChecked, false);

state.selectableItems.forEach((item) => selected.set(item.id, item));
state = getSectionBulkSelectionState(markets, selected);
assert.equal(state.selectedCount, 9);
assert.equal(state.label, 'בטל בחירה');
assert.equal(state.ariaChecked, true);
assert.equal(stocks.every((item) => selected.has(item.id)), true);

selected.delete(markets[4].id);
state = getSectionBulkSelectionState(markets, selected);
assert.equal(state.label, 'בחר הכל (8/9)');
assert.equal(state.ariaChecked, 'mixed');

state.selectableItems.forEach((item) => selected.set(item.id, item));
markets.forEach((item) => selected.delete(item.id));
assert.equal(markets.some((item) => selected.has(item.id)), false);
assert.equal(stocks.every((item) => selected.has(item.id)), true);

const controlSource = fs.readFileSync(
  path.join(root, 'src/components/shared/SectionBulkSelectControl.jsx'),
  'utf8',
);
assert.match(controlSource, /role="checkbox"/);
assert.match(controlSource, /aria-checked=\{state\.ariaChecked\}/);
assert.match(controlSource, /onSectionSelect\(state\.selectableItems\)/);
assert.match(controlSource, /onSectionDeselect\(state\.selectableItems\.map/);
assert.match(controlSource, /stopPropagation/);

console.log('Section bulk selection: 9/9 selectable rows, tri-state and isolation verified');
