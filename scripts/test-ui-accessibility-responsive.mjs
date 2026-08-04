import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const semantic = await import(pathToFileURL(path.join(root, 'src/lib/specializedSemanticVisualState.js')).href);
const selection = await import(pathToFileURL(path.join(root, 'src/lib/sectionBulkSelection.js')).href);

const semanticCases = [
  [{ direction: 'bullish', title: 'טקסט שלילי שלא קובע מצב' }, 'positive', 'bg-emerald-50/60'],
  [{ sentiment: 'bearish', description: 'טקסט חיובי שלא קובע מצב' }, 'negative', 'bg-red-50/60'],
  [{ status: 'warning' }, 'warning', 'bg-orange-50/70'],
  [{ direction: 'unknown' }, 'neutral', 'bg-slate-50/80'],
];
for (const [evidence, expected, className] of semanticCases) {
  assert.equal(semantic.resolveSemanticVisualState(evidence), expected);
  assert.match(semantic.semanticSurfaceClass(evidence), new RegExp(className.replace('/', '\\/')));
}
assert.equal(
  semantic.resolveSemanticVisualState({ title: 'bullish gain', description: 'negative sell' }),
  'neutral',
  'narrative text must not infer a financial state',
);
assert.equal(semantic.resolveSemanticVisualState({ changePercent: 0 }), 'neutral');

const sectionItems = [
  { id: 'news:0', text: 'עברית' },
  { id: 'news:1', text: 0 },
  { id: 'news:2', text: false },
];
const unrelated = new Map([['markets:0', { id: 'markets:0', text: 'שוק' }]]);
let state = selection.getSectionBulkSelectionState(sectionItems, unrelated);
assert.equal(state.totalCount, 3);
assert.equal(state.ariaChecked, false);
assert.equal(state.label, 'בחר הכול');
const partial = new Map(unrelated);
partial.set('news:0', sectionItems[0]);
state = selection.getSectionBulkSelectionState(sectionItems, partial);
assert.equal(state.ariaChecked, 'mixed');
assert.equal(state.selectedCount, 1);
sectionItems.forEach((item) => partial.set(item.id, item));
state = selection.getSectionBulkSelectionState(sectionItems, partial);
assert.equal(state.ariaChecked, true);
assert.equal(partial.has('markets:0'), true, 'section selection must preserve unrelated manual selections');
assert.equal(selection.getSectionBulkSelectionState([], partial).totalCount, 0);

const controlSource = read('src/components/shared/SectionBulkSelectControl.jsx');
assert.match(controlSource, /role="checkbox"/);
assert.match(controlSource, /aria-checked=\{state\.ariaChecked\}/);
assert.match(controlSource, /onSectionSelect\(state\.selectableItems\)/);
assert.match(controlSource, /onSectionDeselect\(state\.selectableItems\.map/);
assert.match(controlSource, /stopPropagation/);

for (const relativePath of [
  'src/components/shared/UniversalTabSelectRow.jsx',
  'src/components/dashboard/MorningBriefBulkCheckbox.jsx',
]) {
  const source = read(relativePath);
  assert.match(source, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(source, /onKeyDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(source, /focus-visible:ring-2/);
}

const tableSource = read('src/components/dashboard/briefTableLayout.jsx');
assert.match(tableSource, /data-semantic-visual-state=\{state\}/);
assert.match(tableSource, /focus-within:ring-2/);
assert.match(tableSource, /overflow-x-auto/);
for (const relativePath of [
  'src/components/dashboard/MorningBriefMarketsTable.jsx',
  'src/components/dashboard/MarketSectorTable.jsx',
  'src/components/dashboard/MorningBriefPanels.jsx',
]) {
  assert.match(read(relativePath), /SemanticTableRow/);
}

const sidebarSource = read('src/components/layout/AppSidebar.jsx');
assert.match(sidebarSource, /data-mobile-sidebar-trigger/);
assert.match(sidebarSource, /aria-expanded=\{mobileOpen\}/);
assert.match(sidebarSource, /aria-controls="app-sidebar-navigation"/);
assert.match(sidebarSource, /aria-modal=\{mobileOpen \|\| undefined\}/);
assert.match(sidebarSource, /aria-describedby=\{mobileOpen \? 'mobile-sidebar-description'/);
assert.match(sidebarSource, /event\.key === 'Escape'/);
assert.match(sidebarSource, /event\.key !== 'Tab'/);
assert.match(sidebarSource, /mobileTriggerRef\.current\?\.focus\(\)/);
assert.match(sidebarSource, /w-\[min\(18rem,calc\(100vw-2rem\)\)\]/);
assert.match(sidebarSource, /md:sticky/);
assert.match(sidebarSource, /invisible translate-x-full pointer-events-none md:visible/);
assert.doesNotMatch(sidebarSource, /aria-describedby=\{undefined\}/);
assert.match(sidebarSource, /<DialogDescription/);

const appSource = read('src/App.jsx');
assert.match(appSource, /<main className="min-w-0 flex-1/);

const videoDetailSource = read('src/components/dashboard/VideoDetailPanel.jsx');
assert.doesNotMatch(
  videoDetailSource,
  /absolute top-3 left-3 z-50 p-1\.5 rounded-full/,
  'Video Detail must rely on the accessible DialogContent close control instead of overlapping it',
);

const aiMappingSource = read('src/components/dashboard/AiMappingModal.jsx');
assert.match(aiMappingSource, /aria-label="סגור AI Mapping"/);

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const news = await vite.ssrLoadModule('/src/lib/morningBriefNewsNormalize.js');
  assert.equal(news.normalizeNewsSentiment('bullish'), 'positive');
  assert.equal(news.normalizeNewsSentiment('bearish'), 'negative');
  assert.equal(news.normalizeNewsSentiment('bullish because text says sell'), 'neutral');
  assert.equal(news.normalizeNewsItems(['bullish text only'])[0].sentiment, 'neutral');
  const preserved = news.normalizeNewsItems([{ title: 'עברית', sentiment: 'neutral', score: 0, active: false }])[0];
  assert.equal(preserved.title, 'עברית');
  assert.equal(preserved.sentiment, 'neutral');
} finally {
  await vite.close();
}

console.log(JSON.stringify({
  status: 'passed',
  semanticStates: 4,
  sectionIsolation: true,
  zeroAndFalsePreserved: true,
  responsiveSidebar: true,
  dialogDescription: true,
  eventSeparation: true,
  rtl: true,
}, null, 2));
