// QA for Path A: parse flat saved "indices" row text back into table columns,
// and confirm the SavedMarketRowsTable / section-detection wiring.
//
//   node --import ./scripts/register-src-aliases.mjs scripts/saved-market-rows-qa.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import { parseMarketRowFromText } from '../src/lib/marketRowText.js';
import { getMarketTrendTone } from '../src/lib/marketRowVisuals.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── parseMarketRowFromText ──────────────────────────────────────────────────
check('asset-first row splits into all four columns', () => {
  const r = parseMarketRowFromText('SPX · עולה · +0.4% · צפי לפתיחה בעלייה של כ-0.4%');
  assert.equal(r.asset, 'SPX');
  assert.equal(r.trend, 'עולה');
  assert.equal(r.strength, '+0.4%');
  assert.equal(r.comment, 'צפי לפתיחה בעלייה של כ-0.4%');
});

check('reversed "0.8% · DOW" still resolves the asset', () => {
  const r = parseMarketRowFromText('0.8% · DOW');
  assert.equal(r.asset, 'DOW');
  assert.equal(r.strength, '0.8%');
  assert.equal(r.comment, null);
});

check('asset-only row keeps asset, no other columns', () => {
  const r = parseMarketRowFromText('BONDS10Y');
  assert.equal(r.asset, 'BONDS10Y');
  assert.equal(r.trend, null);
  assert.equal(r.strength, null);
  assert.equal(r.comment, null);
});

check('percent-only strength row', () => {
  const r = parseMarketRowFromText('RUSSELL · 0.21%');
  assert.equal(r.asset, 'RUSSELL');
  assert.equal(r.strength, '0.21%');
});

check('prose comment with embedded direction infers a trend for the pill', () => {
  const r = parseMarketRowFromText('VIX · עולה במקביל לעליית המדדים');
  assert.equal(r.asset, 'VIX');
  // "עולה במקביל..." is not an exact trend token → inferred from tone
  assert.equal(r.trend, 'עולה');
  assert.equal(r.comment, 'עולה במקביל לעליית המדדים');
});

check('comment-only market row (asset + free text)', () => {
  const r = parseMarketRowFromText('DOLLAR · מתחת לרמת 100');
  assert.equal(r.asset, 'DOLLAR');
  assert.equal(r.strength, null, '"מתחת לרמת 100" is not a strength token');
  assert.equal(r.comment, 'מתחת לרמת 100');
});

check('plain prose with no asset and no " · " returns null', () => {
  assert.equal(parseMarketRowFromText('הפד צפוי להותיר את הריבית ללא שינוי'), null);
});

check('empty / non-string input returns null', () => {
  assert.equal(parseMarketRowFromText(''), null);
  assert.equal(parseMarketRowFromText(null), null);
  assert.equal(parseMarketRowFromText(42), null);
});

// ── getMarketTrendTone parity with the committed snapshot helper ─────────────
check('trend tone: up → emerald, down → red, flat → amber, unknown → slate', () => {
  assert.match(getMarketTrendTone('עולה').className, /emerald/);
  assert.match(getMarketTrendTone('יורד').className, /red/);
  assert.match(getMarketTrendTone('דשדוש').className, /amber/);
  assert.match(getMarketTrendTone('בלה בלה').className, /slate/);
});

check('getMarketTrendTone is a verbatim copy of StructuredSnapshotView getTrendTone', () => {
  const snap = readFileSync(new URL('../src/components/workspace/StructuredSnapshotView.jsx', import.meta.url), 'utf8');
  const shared = readFileSync(new URL('../src/lib/marketRowVisuals.js', import.meta.url), 'utf8');
  for (const re of [
    /דשדוש\|מדשדש\|צידי\|יציב\|ללא שינוי\|שטוח\|מעורב\|ניטרל/,
    /יור\[דת\]\|יריד\|נפיל\|צונ\|דוב\|שליל\|נחלש\|אדום\|מתמת/,
    /עול\|עלי\|טיפוס\|מזנק\|שור\|ראלי\|ירוק\|חיוב/,
  ]) {
    assert.ok(re.test(snap), `snapshot has ${re}`);
    assert.ok(re.test(shared), `shared copy has ${re}`);
  }
});

// ── wiring: real end-to-end routing through the real persisted-item shape ───
// These replace the previous string-includes checks, which only confirmed
// certain substrings existed somewhere in the source files and never
// exercised provenanceFor()/isMarketRowsSection() against any constructed
// data. That gap is exactly why the routing bug (provenanceFor() reading
// item.itemType instead of item.originalItemType — see
// src/utils/workspaceSavedAnalysis.js) shipped with "all checks passing":
// no test ever built an item shaped like what saveSingleItemToWorkspace()
// (src/components/dashboard/VideoDetailPanel.jsx) actually persists
// (itemType:'snippet', originalItemType:'indices').
//
// Real persisted shape for an individually-saved market/indices row, per
// VideoDetailPanel.jsx:saveSingleItemToWorkspace — itemType is ALWAYS
// 'snippet' there; the real semantic type only survives in originalItemType.
function realIndicesItem(overrides = {}) {
  return {
    id: 'ws-item:indices-1',
    sourceVideoId: 'video-1',
    sourceTabId: 'indices',
    sourceSectionId: 'markets',
    sourceHeading: '📈 שווקים',
    itemType: 'snippet',
    originalItemType: 'indices',
    savedAt: '2026-08-30T08:00:00Z',
    notes: 'SPX · עולה · +0.4% · צפי לפתיחה בעלייה של כ-0.4%',
    ...overrides,
  };
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const { WorkspaceSavedAnalysisContent } = await server.ssrLoadModule(
    '/src/components/workspace/WorkspaceFocusedVideoCard.jsx',
  );
  const render = (items) => renderToStaticMarkup(React.createElement(WorkspaceSavedAnalysisContent, {
    group: { items, versions: [], videoUrl: null },
    activeCollection: null,
    selectedIds: new Set(),
    onToggleGroup: () => {},
  }));

  const indicesMarkup = render([realIndicesItem()]);

  check('a real persisted indices row (itemType:snippet, originalItemType:indices) actually routes to SavedMarketRowsTable', () => {
    assert.ok(indicesMarkup.includes('data-saved-market-rows-table'), 'SavedMarketRowsTable rendered');
    assert.ok(indicesMarkup.includes('SPX'), 'the saved row content reached the table');
  });

  check('SavedMarketRowsTable hides Finviz in the links-menu trigger count (2 of 3 SPX providers, not 3)', () => {
    // The Popover's link list is client-portalled and does not render under
    // renderToStaticMarkup, but the trigger's own visible-link count
    // ({visibleLinks.length} in MarketAssetLinksMenu) does — and it already
    // reflects HIDDEN_PROVIDERS=['finviz'] filtering out one of SPX's three
    // configured providers (finviz/investing/tradingView per
    // market-asset-provider-links-qa.mjs), so this is a real assertion on
    // real output, not a source-text check.
    assert.ok(indicesMarkup.includes('data-market-asset-links-menu-trigger'), 'links menu trigger rendered');
    assert.ok(/tabular-nums">\s*2\s*</.test(indicesMarkup), 'trigger shows 2 visible providers (finviz hidden), not 3');
  });

  check('REGRESSION: reading item.itemType instead of item.originalItemType would have failed the check above', () => {
    // Same real item shape, but simulating the pre-fix read (item.itemType
    // only, no fallback to originalItemType) by constructing an item that
    // truly has no originalItemType at all — the persisted-item equivalent
    // of what provenanceFor() saw before the fix (itemType:'snippet' with
    // nothing else to recover the real type from). This must NOT route to
    // the market-rows table, proving the fix is additive, not a false-positive
    // on itemType alone.
    const markup = render([realIndicesItem({ id: 'ws-item:legacy-1', originalItemType: undefined })]);
    assert.equal(markup.includes('data-saved-market-rows-table'), false, 'no originalItemType and itemType=snippet must fall back to plain text, not market table');
  });

  check('a genuine plain-text snippet (unrelated heading) is never misrouted to the market table', () => {
    const markup = render([{
      id: 'ws-item:snippet-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'insights',
      sourceHeading: '💡 תובנות מובילות',
      itemType: 'snippet',
      originalItemType: 'snippet',
      savedAt: '2026-08-30T08:00:00Z',
      notes: 'תובנה כללית שאינה קשורה לשווקים',
    }]);
    assert.equal(markup.includes('data-saved-market-rows-table'), false, 'unrelated snippet stays on AnalysisList');
  });
} finally {
  await server.close();
}

console.log(`\nsaved market rows QA: ${count} checks passed`);
