// QA for the "🎯 הזדמנויות" saved-rows renderer: Layer-1 " · "+Hebrew-prefix
// parsing into table columns, Layer-2 fallback to the news-style row layout
// for the MacroGemDashboard `\n`-shaped producer, the link resolver's
// Finviz/il.investing.com fallback guarantee, and real end-to-end routing
// through WorkspaceFocusedVideoCard.jsx — not string-grep over source.
//
//   node --import ./scripts/register-src-aliases.mjs scripts/saved-opportunity-rows-qa.mjs

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import { parseOpportunityRowLayer1 } from '../src/lib/opportunityRowText.js';
import { resolveMarketEntityLink, findMarketEntityLinksInText } from '../src/lib/marketEntityLinkResolver.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── parseOpportunityRowLayer1 ────────────────────────────────────────────────
check('full trade-plan row (real formatMorningBriefOpportunityText shape) parses every field', () => {
  const r = parseOpportunityRowLayer1('IGV · Breakout · כניסה: 100 · סטופ: 95 · יעד: 110 · יחס סיכון/סיכוי: 1:2 · טווח: swing · ביטחון: medium');
  assert.equal(r.ticker, 'IGV');
  assert.equal(r.setup, 'Breakout');
  assert.equal(r.entry, '100');
  assert.equal(r.stop, '95');
  assert.equal(r.target, '110');
  assert.equal(r.rrRatio, '1:2');
  assert.equal(r.timeframe, 'swing');
  assert.equal(r.confidence, 'medium');
});

check('multi-segment setup (title + detail) before the trade-plan fields joins correctly', () => {
  const r = parseOpportunityRowLayer1('NVDA · פריצה מעל התנגדות מפתח · נפח מסחר גבוה, מעל הממוצע הנע 50 · כניסה: 181.50 · סטופ: 176.00 · טווח: יומי');
  assert.equal(r.ticker, 'NVDA');
  assert.equal(r.setup, 'פריצה מעל התנגדות מפתח · נפח מסחר גבוה, מעל הממוצע הנע 50');
  assert.equal(r.entry, '181.50');
  assert.equal(r.target, null);
});

check('non-equity ticker (SPX) is still recognised as the ticker segment', () => {
  const r = parseOpportunityRowLayer1('SPX · תמיכה באזור 6400 · כניסה: 6400 · טווח: שבועי');
  assert.equal(r.ticker, 'SPX');
  assert.equal(r.entry, '6400');
  assert.equal(r.stop, null);
});

check('no ticker at all — setup absorbs both free-text segments, missing fields stay null', () => {
  const r = parseOpportunityRowLayer1('רוטציה לסקטור הבריאות · ללא טיקר ספציפי');
  assert.equal(r.ticker, null);
  assert.equal(r.setup, 'רוטציה לסקטור הבריאות · ללא טיקר ספציפי');
  assert.equal(r.entry, null);
  assert.equal(r.stop, null);
  assert.equal(r.timeframe, null);
});

check('stop without entry — fields are independent, not positional', () => {
  const r = parseOpportunityRowLayer1('DXY · התחזקות הדולר · סטופ: 104.20 · טווח: יומי');
  assert.equal(r.ticker, 'DXY');
  assert.equal(r.entry, null);
  assert.equal(r.stop, '104.20');
  assert.equal(r.timeframe, 'יומי');
});

check('MacroGemDashboard shape (newline-separated) returns null — routed to Layer-2 fallback, not forced into the table', () => {
  const r = parseOpportunityRowLayer1('רוטציה לטכנולוגיה\nסוג: swing trading\nפרטים: מומנטום חיובי בסקטור\nנכסים: XLK, SMH\nקטליסט: דוחות רבעוניים');
  assert.equal(r, null);
});

check('empty / non-string input returns null', () => {
  assert.equal(parseOpportunityRowLayer1(''), null);
  assert.equal(parseOpportunityRowLayer1(null), null);
  assert.equal(parseOpportunityRowLayer1(42), null);
});

// ── marketEntityLinkResolver — the link-rule guarantee ───────────────────────
check('equity ticker resolves to Finviz', () => {
  const link = resolveMarketEntityLink('NVDA');
  assert.equal(link.provider, 'finviz');
  assert.equal(link.url, 'https://finviz.com/quote.ashx?t=NVDA');
});

check('index (SPX) has no Finviz page — falls back to il.investing.com specific slug', () => {
  const link = resolveMarketEntityLink('SPX');
  assert.equal(link.provider, 'investing');
  assert.equal(link.url, 'https://il.investing.com/indices/us-spx-500');
});

check('macro term (VIX) falls back to il.investing.com', () => {
  const link = resolveMarketEntityLink('VIX');
  assert.equal(link.provider, 'investing');
  assert.equal(link.url, 'https://il.investing.com/indices/volatility-s-p-500');
});

check('unmapped macro code (PPI) still resolves — via il.investing.com SEARCH fallback, never null, never a guessed slug', () => {
  const link = resolveMarketEntityLink('PPI');
  assert.equal(link.provider, 'investing');
  assert.equal(link.url, 'https://il.investing.com/search/?q=PPI');
});

check('pure business jargon (CEO) is not treated as a market entity at all', () => {
  assert.equal(resolveMarketEntityLink('CEO'), null);
});

check('empty input returns null', () => {
  assert.equal(resolveMarketEntityLink(''), null);
  assert.equal(resolveMarketEntityLink(null), null);
});

check('findMarketEntityLinksInText finds a mix of equity + macro terms and dedupes', () => {
  const links = findMarketEntityLinksInText('NVDA עלה בעקבות ה-VIX שירד, NVDA עדיין החברה המובילה');
  const displays = links.map((l) => l.display);
  assert.deepEqual(displays, ['NVDA', 'VIX'], 'deduped, in first-seen order');
  assert.equal(links.find((l) => l.display === 'NVDA').provider, 'finviz');
  assert.equal(links.find((l) => l.display === 'VIX').provider, 'investing');
});

check('Hebrew company alias resolves to the same link as its ticker', () => {
  const links = findMarketEntityLinksInText('אנבידיה ממשיכה להוביל את השוק');
  assert.equal(links.length, 1);
  assert.equal(links[0].display, 'NVDA');
  assert.equal(links[0].provider, 'finviz');
});

check('text with no identifiable entity returns an empty array, not a crash', () => {
  assert.deepEqual(findMarketEntityLinksInText('משפט כללי ללא שום סימול'), []);
});

// ── wiring: real end-to-end routing through the real persisted-item shape ───
function realOpportunityItem(overrides = {}) {
  return {
    id: 'ws-item:opp-1',
    sourceVideoId: 'video-1',
    sourceTabId: 'brief-opportunities',
    sourceSectionId: 'opportunities',
    sourceHeading: '🎯 הזדמנויות',
    itemType: 'snippet',
    originalItemType: 'brief-opportunities',
    savedAt: '2026-08-30T08:00:00Z',
    notes: 'IGV · Breakout · כניסה: 100 · סטופ: 95 · יעד: 110 · יחס סיכון/סיכוי: 1:2 · טווח: swing · ביטחון: medium',
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

  check('a real Layer-1-shaped opportunity row routes to the table with a real Finviz link', () => {
    const markup = render([realOpportunityItem()]);
    assert.ok(markup.includes('data-saved-opportunity-table'), 'table rendered');
    assert.ok(markup.includes('data-saved-opportunity-fallback-rows') === false, 'no fallback rows for a fully-parseable item');
    assert.ok(markup.includes('https://finviz.com/quote.ashx?t=IGV'), 'ticker cell links to Finviz');
    assert.ok(markup.includes('>100<'), 'entry pill value present');
  });

  check('a real MacroGemDashboard-shaped opportunity row (newline-separated) has its labeled סוג/פרטים/נכסים/קטליסט lines routed to the news-style fallback, never dumped as all-"—" table rows', () => {
    // workspaceSavedAnalysis.js's textLines() splits the '\n'-joined saved
    // text into 5 separate entries before this component ever sees them
    // (title + 4 labeled lines) — see opportunityRowText.js's doc comment.
    const markup = render([realOpportunityItem({
      id: 'ws-item:opp-macro-1',
      notes: 'רוטציה לטכנולוגיה\nסוג: swing trading\nפרטים: מומנטום חיובי בסקטור השבבים\nנכסים: XLK, SMH\nקטליסט: דוחות רבעוניים',
    })]);
    assert.ok(markup.includes('data-saved-opportunity-fallback-rows'), 'fallback row list rendered');
    assert.ok(markup.includes('data-news-style-row'), 'reuses the news-style row component');
    assert.ok(markup.includes('סוג: swing trading'), 'labeled fragment preserved verbatim, no data loss');
    assert.ok(markup.includes('נכסים: XLK, SMH'), 'labeled fragment preserved verbatim, no data loss');
    // The bare title-only line ("רוטציה לטכנולוגיה", no label, no ' · ') is
    // structurally identical to a legitimate no-ticker Layer-1 row and is
    // accepted into the table per the approved scope — this is the
    // irreducible ambiguity documented in opportunityRowText.js, not a bug.
    assert.ok(markup.includes('data-saved-opportunity-table'), 'the bare title line is accepted as a legitimate no-ticker table row');
    assert.ok(markup.includes('רוטציה לטכנולוגיה'), 'title line content preserved somewhere in the output');
  });

  check('a mix of both producer shapes renders the table AND the fallback list under one section', () => {
    const markup = render([
      realOpportunityItem({ id: 'ws-item:opp-mix-table' }),
      realOpportunityItem({ id: 'ws-item:opp-mix-fallback', notes: 'כותרת בלבד\nסוג: value' }),
    ]);
    assert.ok(markup.includes('data-saved-opportunity-table'), 'table present');
    assert.ok(markup.includes('data-saved-opportunity-fallback-rows'), 'fallback rows present');
  });

  check('REGRESSION: no originalItemType must not route to the opportunity renderer', () => {
    const markup = render([realOpportunityItem({ id: 'ws-item:opp-legacy-1', originalItemType: undefined })]);
    assert.equal(markup.includes('data-saved-opportunity-rows'), false, 'falls back to plain text');
  });

  check('stock/sector/market routing is unaffected by the new opportunity path', () => {
    const markup = render([{
      id: 'ws-item:stock-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'stocks-mentioned',
      sourceHeading: '⭐ מניות שהוזכרו',
      itemType: 'snippet',
      originalItemType: 'stocks-mentioned',
      savedAt: '2026-08-30T08:00:00Z',
      notes: 'NVDA · Nvidia Corp · חיובי · המשך מומנטום חזק',
    }]);
    assert.ok(markup.includes('data-saved-stock-rows-table'), 'stock table still routes correctly');
    assert.equal(markup.includes('data-saved-opportunity-rows'), false);
  });
} finally {
  await server.close();
}

console.log(`\nsaved opportunity rows QA: ${count} checks passed`);
