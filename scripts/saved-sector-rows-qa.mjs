// QA for the "🏭 סקטורים" saved-rows table: parse flat saved "brief-sectors"
// row text back into table columns (sector/ETF pill, sentiment, note), and
// confirm the SavedSectorRowsTable / section-detection wiring via real
// end-to-end rendering (SSR through the actual component tree) — not
// string-includes checks against source files.
//
//   node --import ./scripts/register-src-aliases.mjs scripts/saved-sector-rows-qa.mjs

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import { parseSectorRowFromText } from '../src/lib/sectorRowText.js';
import { getSectorRowSentimentTone, getSectorRowSentimentLabel } from '../src/lib/sectorRowVisuals.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── parseSectorRowFromText ───────────────────────────────────────────────────
check('sector + sentiment + note splits into all columns', () => {
  const r = parseSectorRowFromText('תוכנה · positive · ETF IGV נהנה מהוצאות תשתית AI. CRWD, OKTA ו-CRM מוזכרות כנהנות עיקריות');
  assert.equal(r.sector, 'תוכנה');
  assert.equal(r.sentimentRaw, 'positive');
  assert.ok(r.note.includes('CRWD'), 'mentioned tickers stay in the note as free text, not a separate field');
  assert.ok(r.note.includes('OKTA') && r.note.includes('CRM'));
});

check('sector-only row (no sentiment, no note) still parses', () => {
  const r = parseSectorRowFromText('אנרגיה');
  assert.equal(r.sector, 'אנרגיה');
  assert.equal(r.sentimentRaw, null);
  assert.equal(r.note, null);
});

check('sector + sentiment, no note', () => {
  const r = parseSectorRowFromText('פיננסים · negative');
  assert.equal(r.sector, 'פיננסים');
  assert.equal(r.sentimentRaw, 'negative');
  assert.equal(r.note, null);
});

check('note containing its own " · " (note+reason joined) stays intact as one note field', () => {
  const r = parseSectorRowFromText('בריאות · into · ביצועים חזקים · דוחות רבעוניים חיוביים בסקטור');
  assert.equal(r.sector, 'בריאות');
  assert.equal(r.sentimentRaw, 'into');
  assert.equal(r.note, 'ביצועים חזקים · דוחות רבעוניים חיוביים בסקטור');
});

check('never returns null for non-empty text (single shared producer, no ordering ambiguity — see doc comment)', () => {
  assert.notEqual(parseSectorRowFromText('כל טקסט חופשי כלשהו בלי מבנה ברור'), null);
});

check('empty / non-string input returns null', () => {
  assert.equal(parseSectorRowFromText(''), null);
  assert.equal(parseSectorRowFromText(null), null);
  assert.equal(parseSectorRowFromText(42), null);
});

// ── getSectorRowSentimentTone / Label ────────────────────────────────────────
check('sentiment tone: positive/up/into → emerald, negative/down/out → orange', () => {
  for (const v of ['positive', 'up', 'into']) assert.match(getSectorRowSentimentTone(v).className, /emerald/, v);
  for (const v of ['negative', 'down', 'out']) assert.match(getSectorRowSentimentTone(v).className, /orange/, v);
});

check('unrecognised sentiment value returns null tone but still exposes a display label (no data loss)', () => {
  assert.equal(getSectorRowSentimentTone('מוביל'), null);
  assert.equal(typeof getSectorRowSentimentLabel('מוביל'), 'string');
  assert.ok(getSectorRowSentimentLabel('מוביל').length > 0);
});

// ── wiring: real end-to-end routing through the real persisted-item shape ───
// Same pattern as saved-market-rows-qa.mjs / saved-stock-rows-qa.mjs from the
// start (not string-grep): construct items shaped like BOTH real save paths
// and render the actual WorkspaceSavedAnalysisContent tree via Vite SSR.
//
// Real persisted shape, per WorkspaceSaveReviewOverlay.jsx (bulk-review path)
// AND VideoDetailPanel.jsx:saveSingleItemToWorkspace (quick-save path) — for
// 'brief-sectors' BOTH paths agree: no remapping quirk like stocks-mentioned
// had, so itemType and originalItemType are the same value in the overlay
// path, and only originalItemType survives as 'brief-sectors' in the
// quick-save path (itemType is always 'snippet' there).
function realSectorItem(overrides = {}) {
  return {
    id: 'ws-item:sector-1',
    sourceVideoId: 'video-1',
    sourceTabId: 'specialized',
    sourceSectionId: 'brief-sectors',
    sourceHeading: '🏭 סקטורים',
    itemType: 'snippet',
    originalItemType: 'brief-sectors',
    savedAt: '2026-08-30T08:00:00Z',
    notes: 'תוכנה · positive · ETF IGV נהנה מהוצאות תשתית AI. CRWD, OKTA ו-CRM מוזכרות כנהנות עיקריות',
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

  check('a real quick-save-path sector row (itemType:snippet, originalItemType:brief-sectors) routes to SavedSectorRowsTable', () => {
    const markup = render([realSectorItem()]);
    assert.ok(markup.includes('data-saved-sector-rows-table'), 'SavedSectorRowsTable rendered');
    assert.ok(markup.includes('תוכנה'), 'the saved row content reached the table');
    assert.ok(markup.includes('CRWD') && markup.includes('OKTA') && markup.includes('CRM'), 'mentioned tickers survive into the rendered note cell');
  });

  check('a real overlay-path sector row (itemType:brief-sectors, originalItemType:brief-sectors) also routes', () => {
    // WorkspaceSaveReviewOverlay.jsx never remaps 'brief-sectors' (no
    // stockExtraFields-style override exists for it) — itemType and
    // originalItemType are identical from that path.
    const markup = render([realSectorItem({ id: 'ws-item:overlay-sector-1', itemType: 'brief-sectors' })]);
    assert.ok(markup.includes('data-saved-sector-rows-table'), 'overlay-saved sector row routes to the table');
  });

  check('REGRESSION: no originalItemType (itemType:snippet only) must not route to the sector table', () => {
    const markup = render([realSectorItem({ id: 'ws-item:legacy-sector-1', originalItemType: undefined })]);
    assert.equal(markup.includes('data-saved-sector-rows-table'), false, 'falls back to plain text, not sector table');
  });

  check('indices and stock routing are unaffected by the sector path addition', () => {
    const markup = render([
      { id: 'ws-item:indices-1', sourceVideoId: 'video-1', sourceTabId: 'indices', sourceHeading: '📈 שווקים', itemType: 'snippet', originalItemType: 'indices', savedAt: '2026-08-30T08:00:00Z', notes: 'SPX · עולה · +0.4%' },
      { id: 'ws-item:stock-1', sourceVideoId: 'video-1', sourceTabId: 'stocks-mentioned', sourceHeading: '⭐ מניות שהוזכרו', itemType: 'stock', originalItemType: 'stocks-mentioned', savedAt: '2026-08-30T08:00:00Z', notes: 'NVDA · Nvidia Corp · חיובי · המשך מומנטום' },
      realSectorItem({ id: 'ws-item:sector-2' }),
    ]);
    assert.ok(markup.includes('data-saved-market-rows-table'), 'indices still route to SavedMarketRowsTable');
    assert.ok(markup.includes('data-saved-stock-rows-table'), 'stocks still route to SavedStockRowsTable');
    assert.ok(markup.includes('data-saved-sector-rows-table'), 'sectors route to SavedSectorRowsTable');
  });

  check('a genuine plain-text snippet (unrelated heading) is never misrouted to the sector table', () => {
    const markup = render([{
      id: 'ws-item:snippet-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'insights',
      sourceHeading: '💡 תובנות מובילות',
      itemType: 'snippet',
      originalItemType: 'snippet',
      savedAt: '2026-08-30T08:00:00Z',
      notes: 'תובנה כללית שאינה קשורה לסקטורים',
    }]);
    assert.equal(markup.includes('data-saved-sector-rows-table'), false, 'unrelated snippet stays on AnalysisList');
  });
} finally {
  await server.close();
}

console.log(`\nsaved sector rows QA: ${count} checks passed`);
