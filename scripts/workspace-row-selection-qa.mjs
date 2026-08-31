// QA for the Part 2 row-selection wiring (WORK-ID:
// TRADINGBRAIN-SAVEDROWS-FIXPASS-AND-SELECT): the shared rowSelectionProps()
// helper, and real end-to-end routing through WorkspaceFocusedVideoCard.jsx
// confirming each of the six saved-rows renderers (AnalysisList,
// SavedMarketRowsTable, SavedStockRowsTable, SavedSectorRowsTable,
// SavedOpportunityRowsTable via both its table and Layer-2 fallback rows,
// SavedNewsRows) renders a real, correctly-checked checkbox when
// selectedIds/onToggleGroup are wired, and renders NO checkbox column at all
// when they are not (backward compatibility for any other caller).
//
//   node --import ./scripts/register-src-aliases.mjs scripts/workspace-row-selection-qa.mjs

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import { rowSelectionProps } from '../src/lib/workspaceRowSelection.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── rowSelectionProps (the shared helper) ────────────────────────────────────
check('returns null when selectedIds is absent (renderer stays checkbox-free)', () => {
  assert.equal(rowSelectionProps({ recordIds: ['a'], onToggleGroup: () => {} }), null);
});

check('returns null when onToggleGroup is absent', () => {
  assert.equal(rowSelectionProps({ recordIds: ['a'], selectedIds: new Set() }), null);
});

check('returns null when recordIds is empty/null (nothing to select)', () => {
  assert.equal(rowSelectionProps({ recordIds: null, selectedIds: new Set(), onToggleGroup: () => {} }), null);
  assert.equal(rowSelectionProps({ recordIds: [], selectedIds: new Set(), onToggleGroup: () => {} }), null);
});

check('accepts a single non-array recordId', () => {
  const selectedIds = new Set(['a']);
  const props = rowSelectionProps({ recordIds: 'a', selectedIds, onToggleGroup: () => {} });
  assert.equal(props.checked, true);
});

check('checked reflects selectedIds membership for every id in the entry', () => {
  const selectedIds = new Set(['a', 'b']);
  assert.equal(rowSelectionProps({ recordIds: ['a', 'b'], selectedIds, onToggleGroup: () => {} }).checked, true);
  assert.equal(rowSelectionProps({ recordIds: ['a', 'c'], selectedIds, onToggleGroup: () => {} }).checked, false, 'not every id is selected');
});

check('onChange calls onToggleGroup with the entry\'s own ids and the flipped selected state', () => {
  const calls = [];
  const selectedIds = new Set(['a']);
  const props = rowSelectionProps({
    recordIds: ['a'],
    selectedIds,
    onToggleGroup: (ids, selected) => calls.push({ ids, selected }),
  });
  props.onChange();
  assert.deepEqual(calls, [{ ids: ['a'], selected: false }], 'was checked, so toggling unchecks it');
});

check('REGRESSION: two entries sharing the same recordIds (one item split into multiple saved lines) toggle together, not independently', () => {
  // This is the documented "notes line shares recordIds with its row" case:
  // both entries reference the same underlying persisted item id, so both
  // must reflect (and flip) the exact same checked state.
  const selectedIds = new Set();
  const a = rowSelectionProps({ recordIds: ['shared-1'], selectedIds, onToggleGroup: () => {} });
  const b = rowSelectionProps({ recordIds: ['shared-1'], selectedIds, onToggleGroup: () => {} });
  assert.equal(a.checked, b.checked, 'both rows agree on checked state before any toggle');
  selectedIds.add('shared-1');
  const aAfter = rowSelectionProps({ recordIds: ['shared-1'], selectedIds, onToggleGroup: () => {} });
  const bAfter = rowSelectionProps({ recordIds: ['shared-1'], selectedIds, onToggleGroup: () => {} });
  assert.equal(aAfter.checked, true);
  assert.equal(bAfter.checked, true, 'the sibling row reflects the same selection automatically');
});

// ── wiring: real end-to-end routing through WorkspaceFocusedVideoCard.jsx ───
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const { WorkspaceSavedAnalysisContent } = await server.ssrLoadModule(
    '/src/components/workspace/WorkspaceFocusedVideoCard.jsx',
  );
  const render = (items, { selectedIds, onToggleGroup } = {}) => renderToStaticMarkup(React.createElement(WorkspaceSavedAnalysisContent, {
    group: { items, versions: [], videoUrl: null },
    activeCollection: null,
    selectedIds: selectedIds || new Set(),
    onToggleGroup: onToggleGroup || (() => {}),
  }));

  const fixtures = {
    generic: { id: 'row-sel:generic-1', sourceHeading: 'תובנות מרכזיות', itemType: 'insight', notes: 'תובנה חופשית לבדיקה', savedAt: '2026-08-31T08:00:00Z' },
    market: { id: 'row-sel:market-1', sourceHeading: '📈 שווקים', itemType: 'snippet', originalItemType: 'indices', notes: 'SPX · עולה · +0.4%', savedAt: '2026-08-31T08:00:00Z' },
    stock: { id: 'row-sel:stock-1', sourceHeading: '⭐ מניות שהוזכרו', itemType: 'snippet', originalItemType: 'stocks-mentioned', notes: 'AAPL · Apple · עלייה חדה', savedAt: '2026-08-31T08:00:00Z' },
    sector: { id: 'row-sel:sector-1', sourceHeading: '🏭 סקטורים', itemType: 'snippet', originalItemType: 'brief-sectors', notes: 'טכנולוגיה · חיובי · המשך מומנטום', savedAt: '2026-08-31T08:00:00Z' },
    opportunityTable: { id: 'row-sel:opp-table-1', sourceHeading: '🎯 הזדמנויות', itemType: 'snippet', originalItemType: 'brief-opportunities', notes: 'AAPL · פריצה · כניסה: 220 · סטופ: 210 · טווח: swing', savedAt: '2026-08-31T08:00:00Z' },
    opportunityFallback: { id: 'row-sel:opp-fallback-1', sourceHeading: '🎯 הזדמנויות', itemType: 'snippet', originalItemType: 'brief-opportunities', notes: 'פריצת התנגדות מרכזית בטווח הקצר', savedAt: '2026-08-31T08:00:00Z' },
    news: { id: 'row-sel:news-1', sourceHeading: '📰 חדשות', itemType: 'snippet', originalItemType: 'market-news', notes: 'עדכון: הפד הותיר את הריבית ללא שינוי', savedAt: '2026-08-31T08:00:00Z' },
  };

  for (const [label, item] of Object.entries(fixtures)) {
    check(`${label}: a real row checkbox renders, unchecked, when selection is wired but the id is not selected`, () => {
      const markup = render([item], { selectedIds: new Set() });
      assert.ok(markup.includes('accent-indigo-600'), `${label} should render a UniversalTabCheckbox`);
      assert.equal(markup.includes('checked=""'), false, `${label} checkbox should not be checked`);
    });

    check(`${label}: the row checkbox reflects checked="checked" when its recordId is in selectedIds`, () => {
      const markup = render([item], { selectedIds: new Set([item.id]) });
      assert.ok(markup.includes('checked=""') || markup.includes('checked="checked"'), `${label} checkbox should render checked`);
    });
  }

  // Backward compatibility: called directly (not through
  // WorkspaceFocusedVideoCard.jsx, which always wires selection for its own
  // pre-existing section-level checkbox) with no selectedIds/onToggleGroup at
  // all, none of the six renderers should render a row checkbox.
  const { AnalysisList } = await server.ssrLoadModule('/src/components/shared/AnalysisContentPrimitives.jsx');
  const { SavedMarketRowsTable } = await server.ssrLoadModule('/src/components/workspace/SavedMarketRowsTable.jsx');
  const { SavedStockRowsTable } = await server.ssrLoadModule('/src/components/workspace/SavedStockRowsTable.jsx');
  const { SavedSectorRowsTable } = await server.ssrLoadModule('/src/components/workspace/SavedSectorRowsTable.jsx');
  const { SavedOpportunityRowsTable } = await server.ssrLoadModule('/src/components/workspace/SavedOpportunityRowsTable.jsx');
  const { SavedNewsRows } = await server.ssrLoadModule('/src/components/workspace/SavedNewsRows.jsx');

  const directCases = [
    ['AnalysisList', AnalysisList, { entries: [{ text: 'שורה חופשית', recordIds: ['x'] }] }],
    ['SavedMarketRowsTable', SavedMarketRowsTable, { entries: [{ text: 'SPX · עולה · +0.4%', recordIds: ['x'] }] }],
    ['SavedStockRowsTable', SavedStockRowsTable, { entries: [{ text: 'AAPL · Apple · עלייה', recordIds: ['x'] }] }],
    ['SavedSectorRowsTable', SavedSectorRowsTable, { entries: [{ text: 'טכנולוגיה · חיובי · המשך מומנטום', recordIds: ['x'] }] }],
    ['SavedOpportunityRowsTable (table row)', SavedOpportunityRowsTable, { entries: [{ text: 'AAPL · פריצה · כניסה: 220', recordIds: ['x'] }] }],
    ['SavedOpportunityRowsTable (fallback row)', SavedOpportunityRowsTable, { entries: [{ text: 'פריצת התנגדות מרכזית', recordIds: ['x'] }] }],
    ['SavedNewsRows', SavedNewsRows, { entries: [{ text: 'עדכון: הפד הותיר את הריבית', recordIds: ['x'] }] }],
  ];
  for (const [label, Component, props] of directCases) {
    check(`${label}: no row checkbox renders when called directly with no selectedIds/onToggleGroup`, () => {
      const markup = renderToStaticMarkup(React.createElement(Component, props));
      assert.equal(markup.includes('accent-indigo-600'), false, `${label} must stay checkbox-free when selection isn't wired`);
    });
    check(`${label}: a row checkbox renders when called directly WITH selectedIds/onToggleGroup`, () => {
      const markup = renderToStaticMarkup(React.createElement(Component, { ...props, selectedIds: new Set(), onToggleGroup: () => {} }));
      assert.ok(markup.includes('accent-indigo-600'), `${label} should render a checkbox once selection is wired`);
    });
  }

  check('section-level "select all" checkbox (pre-existing) is unaffected by the new row-level checkboxes', () => {
    const markup = render([fixtures.market], { selectedIds: new Set([fixtures.market.id]) });
    // Two checkboxes now: the section-level select-all + the one row checkbox.
    const checkboxCount = (markup.match(/type="checkbox"/g) || []).length;
    assert.equal(checkboxCount, 2, 'exactly one section checkbox + one row checkbox for a single-row section');
  });

  // ── "הוסף ליום העבודה" button on WorkspaceBulkActionBar ─────────────────────
  const { WorkspaceBulkActionBar } = await server.ssrLoadModule('/src/components/workspace/WorkspaceBulkActionBar.jsx');

  check('WorkspaceBulkActionBar: "הוסף ליום העבודה" does NOT render when onAddToWorkspaceDay is absent (no day open)', () => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceBulkActionBar, { count: 2 }));
    assert.equal(markup.includes('הוסף ליום העבודה'), false, 'button must be hidden when no day is open');
  });

  check('WorkspaceBulkActionBar: "הוסף ליום העבודה" renders when onAddToWorkspaceDay is provided (a day is open)', () => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceBulkActionBar, { count: 2, onAddToWorkspaceDay: () => {} }));
    assert.ok(markup.includes('הוסף ליום העבודה'), 'button must render when a day is open');
  });

  check('WorkspaceBulkActionBar: the bar itself stays hidden entirely when count is 0, regardless of onAddToWorkspaceDay', () => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceBulkActionBar, { count: 0, onAddToWorkspaceDay: () => {} }));
    assert.equal(markup, '', 'bar renders nothing when nothing is selected');
  });
} finally {
  await server.close();
}

console.log(`\nworkspace row-selection QA: ${count} checks passed`);
