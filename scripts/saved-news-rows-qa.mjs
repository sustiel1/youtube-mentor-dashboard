// QA for the "📰 חדשות" saved-rows renderer: tone/topic derivation (exact
// word-boundary matching — must NOT reproduce the "פעולה" contains "עולה"
// substring bug), entity-chip extraction/linking, and real end-to-end
// routing through WorkspaceFocusedVideoCard.jsx — not string-grep over
// source.
//
//   node --import ./scripts/register-src-aliases.mjs scripts/saved-news-rows-qa.mjs

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import { deriveNewsTone, deriveNewsTopic } from '../src/lib/newsRowVisuals.js';
import { findMarketEntityLinksInText } from '../src/lib/marketEntityLinkResolver.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── deriveNewsTone — the core regression this task exists to fix ────────────
check('REGRESSION: bare "פעולה" mention with no other sentiment content must be neutral, not positive', () => {
  assert.equal(deriveNewsTone('הנהלת החברה נקטה פעולה מיידית לטיפול בתקלה'), 'neutral');
});

check('REGRESSION: "פעולה" alongside real bearish content must not cancel/flip the bearish result', () => {
  assert.equal(deriveNewsTone('המניה צנחה בעקבות פעולה רגולטורית לא צפויה'), 'negative');
});

check('exact bullish token registers positive', () => {
  assert.equal(deriveNewsTone('המדד עלה בחדות לאחר פרסום הנתונים'), 'positive');
});

check('exact bearish token registers negative', () => {
  assert.equal(deriveNewsTone('המניה ירדה בעקבות אזהרת רווח'), 'negative');
});

check('no sentiment-bearing tokens at all registers neutral', () => {
  assert.equal(deriveNewsTone('הבנק הפדרלי הותיר את הריבית ללא שינוי'), 'neutral');
});

check('mixed bull/bear tokens resolve deterministically (bearish-leaning tie-break)', () => {
  assert.equal(deriveNewsTone('עלה בתחילת המסחר אך ירד וצנח לקראת הסגירה'), 'negative');
});

// ── deriveNewsTopic — 4-bucket priority order ────────────────────────────────
check('deal keyword wins topic classification even when a ticker is present', () => {
  const links = findMarketEntityLinksInText('AAPL בהליכי מיזוג עם ספק רכיבים מרכזי');
  assert.equal(deriveNewsTopic('AAPL בהליכי מיזוג עם ספק רכיבים מרכזי', links), 'עסקה');
});

check('macro keyword classifies as מאקרו when no deal keyword present', () => {
  assert.equal(deriveNewsTopic('מדד המחירים לצרכן עלה בהתאם לתחזיות האינפלציה', []), 'מאקרו');
});

check('English macro code (CPI) classifies as מאקרו', () => {
  assert.equal(deriveNewsTopic('מדד ה-CPI עלה ב-0.3% במקביל לתחזיות', []), 'מאקרו');
});

check('a resolved equity ticker with no deal/macro keyword classifies as מניה', () => {
  const links = findMarketEntityLinksInText('NVDA מדווחת על עלייה בהכנסות הרבעון');
  assert.equal(deriveNewsTopic('NVDA מדווחת על עלייה בהכנסות הרבעון', links), 'מניה');
});

check('no deal/macro keyword and no resolvable ticker falls back to כללי', () => {
  assert.equal(deriveNewsTopic('סקירה כללית של מצב הרוח בשוק', []), 'כללי');
});

// ── entity chips never leave a real symbol unlinked ──────────────────────────
check('a news sentence mixing an equity ticker and a macro index both resolve to real links', () => {
  const links = findMarketEntityLinksInText('ה-VIX זינק בעקבות ירידת AAPL');
  const byDisplay = Object.fromEntries(links.map((l) => [l.display, l]));
  assert.equal(byDisplay.VIX.provider, 'investing');
  assert.equal(byDisplay.VIX.url, 'https://il.investing.com/indices/volatility-s-p-500');
  assert.equal(byDisplay.AAPL.provider, 'finviz');
  assert.equal(byDisplay.AAPL.url, 'https://finviz.com/quote.ashx?t=AAPL');
});

// ── wiring: real end-to-end routing through the real persisted-item shape ───
function realNewsItem(overrides = {}) {
  return {
    id: 'ws-item:news-1',
    sourceVideoId: 'video-1',
    sourceTabId: 'market-news',
    sourceSectionId: 'news',
    sourceHeading: '📰 חדשות',
    itemType: 'snippet',
    originalItemType: 'market-news',
    savedAt: '2026-08-30T08:00:00Z',
    notes: 'NVDA מדווחת על עלייה של 15% בהכנסות הרבעון — הכנסות הצמיחו במהלך פעולה מתמשכת של הרחבת קיבולת ייצור. השפעה על השוק: חיזוק הסנטימנט בסקטור השבבים',
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

  check('a real persisted news row (originalItemType:market-news) routes to SavedNewsRows as a row, not a table', () => {
    const markup = render([realNewsItem()]);
    assert.ok(markup.includes('data-saved-news-rows'), 'SavedNewsRows rendered');
    assert.ok(markup.includes('data-news-style-row'), 'row layout, not a table');
    assert.equal(markup.includes('<table'), false, 'no table element anywhere in the news section');
  });

  check('the real saved text mentioning "פעולה" is classified positive (from "עלייה", not the tag word) and never crashes the tone deriver', () => {
    const markup = render([realNewsItem()]);
    assert.ok(markup.includes('data-news-row-tone="positive"'), 'tone comes from the real bullish word, not a פעולה false-positive');
  });

  check('an em-dash-separated saved news row with a non-equity macro symbol gets a real il.investing.com chip, never plain text', () => {
    const markup = render([realNewsItem({
      id: 'ws-item:news-vix-1',
      notes: 'ה-VIX זינק ל-22 נקודות על רקע חוסר ודאות גיאופוליטית — תנודתיות מוגברת בשווקים. השפעה על השוק: לחץ מכירה קצר טווח',
    })]);
    assert.ok(markup.includes('https://il.investing.com/indices/volatility-s-p-500'), 'VIX resolves to a real investing.com link, not left as plain text');
  });

  check('REGRESSION: no originalItemType must not route to SavedNewsRows', () => {
    const markup = render([realNewsItem({ id: 'ws-item:news-legacy-1', originalItemType: undefined })]);
    assert.equal(markup.includes('data-saved-news-rows'), false, 'falls back to plain text');
  });

  check('opportunity/stock/sector/market routing is unaffected by the new news path', () => {
    const markup = render([{
      id: 'ws-item:indices-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'indices',
      sourceHeading: '📈 שווקים',
      itemType: 'snippet',
      originalItemType: 'indices',
      savedAt: '2026-08-30T08:00:00Z',
      notes: 'SPX · עולה · +0.4%',
    }]);
    assert.ok(markup.includes('data-saved-market-rows-table'), 'indices still route to SavedMarketRowsTable');
    assert.equal(markup.includes('data-saved-news-rows'), false);
  });
} finally {
  await server.close();
}

console.log(`\nsaved news rows QA: ${count} checks passed`);
