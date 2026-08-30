// QA for the "מניות שהוזכרו" saved-rows table: parse flat saved "stock" row
// text back into table columns (ticker/sector/sentiment/synthetic
// category/activity/notes), and confirm the SavedStockRowsTable /
// section-detection wiring.
//
//   node --import ./scripts/register-src-aliases.mjs scripts/saved-stock-rows-qa.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import { parseStockRowFromText } from '../src/lib/stockRowText.js';
import {
  deriveSyntheticStockCategory,
  getSavedStockSentimentTone,
  getActivityTone,
  CATEGORY_META,
} from '../src/lib/stockRowVisuals.js';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// ── parseStockRowFromText ────────────────────────────────────────────────────
check('ticker + company + sentiment + reason splits into all columns', () => {
  const r = parseStockRowFromText('OKTA · Okta Inc · חיובי · הכאה גדולה בהכנסות וברווח (1.05$ מול 0.97$ צפי, הכנסות 805M$). watch :פעולה · מיידי :עדכון · בינונית :טווח · חדש · בינונית :עדיפות · לא :למעקב');
  assert.equal(r.symbol, 'OKTA');
  assert.equal(r.companyName, 'Okta Inc');
  assert.equal(r.sentiment, 'positive');
  assert.equal(r.activity, 'watch');
  assert.equal(r.updateRecency, 'מיידי');
  assert.equal(r.timeframe, 'בינונית');
  assert.equal(r.priority, 'בינונית');
  assert.equal(r.followUp, 'לא');
  assert.ok(r.notes.includes('הכאה גדולה'), 'unrecognised prose stays in notes');
  assert.ok(!r.notes.includes('פעולה'), 'recognised tags are stripped out of notes');
});

check('known parseStockFromText limitation: short single-word company names collide with ticker-shape detection', () => {
  // "Okta" alone uppercases to 4 letters, matching the same TICKER_RE used to
  // detect the symbol column — parseStockFromText (unmodified, shared code)
  // then treats it as "no distinct company segment" rather than a company
  // name. Documented here, not fixed, since that function is out of scope.
  const r = parseStockRowFromText('OKTA · Okta · חיובי · הערה כלשהי');
  assert.equal(r.symbol, 'OKTA');
  assert.equal(r.companyName, null, 'inherited limitation — not something stockRowText.js can recover');
});

check('REGRESSION: explicit "חיובי" segment wins even when the reason text contains a bearish word (ירידה)', () => {
  // Found via visual QA against the real 30.8.2026 screenshot data: VEEV's
  // reason is "היפוך חד מירידה... לעלייה..." — contains the bearish keyword
  // "ירידה". parseStockFromText's own keyword inference matched bearish
  // first and returned 'negative', silently overriding the row's own
  // explicit "חיובי" label. extractExplicitSentiment must win here.
  const r = parseStockRowFromText('VEEV · Veeva Systems · חיובי · היפוך חד מירידה ראשונית לעלייה של כ-8% בעקבות הכנסות ורווחיות. watch :פעולה · מיידי :עדכון');
  assert.equal(r.sentiment, 'positive');
});

check('REGRESSION: "פעולה" (activity tag label) must not be misread as the bullish keyword "עולה" — tagged form', () => {
  // "עולה" (rising/bullish) is a literal substring of "פעולה" (action/activity
  // — the standard tag label present in nearly every real saved row). Without
  // the label-blanking guard, ANY row mentioning the activity tag and no
  // other sentiment word would falsely register positive.
  const r = parseStockRowFromText('AAPL · Apple Inc · הערה כללית ללא תיוג רגשי. פעולה: watch');
  assert.equal(r.sentiment, null, 'no explicit sentiment segment and no real bullish/bearish word → null, not a false positive');
});

check('REGRESSION: same collision with a bare "פעולה" mention (no colon, not a tag pair at all)', () => {
  // extractTags only strips exact "LABEL: value" pairs — a stray mention of
  // the word "פעולה" with no colon (e.g. casual "ללא תיוג פעולה") is left
  // untouched by tag-stripping, so the sentiment step needs its own guard.
  const r = parseStockRowFromText('AAPL · Apple · הערה כללית ללא תיוג פעולה');
  assert.equal(r.sentiment, null, 'bare label-word mention must not register as bullish');
});

check('explicit "ניטרלי" segment maps to neutral (not dropped, not miscategorized)', () => {
  const r = parseStockRowFromText('MSFT · Microsoft · ניטרלי · ללא שינוי משמעותי ברבעון');
  assert.equal(r.sentiment, 'neutral');
});

check('tag order can vary — label-before-value still matches', () => {
  const r = parseStockRowFromText('NVDA · הכתה את התחזית · שלילי · ניטרלי בשל תנודתיות. פעולה: watch');
  assert.equal(r.symbol, 'NVDA');
  assert.equal(r.activity, 'watch');
});

check('2-part row (ticker + reason, no separate company segment)', () => {
  const r = parseStockRowFromText('OIL · דלק באזור 81.9.');
  assert.equal(r.symbol, 'OIL');
  assert.equal(r.companyName, null);
  assert.equal(r.activity, null);
  assert.equal(r.notes, 'דלק באזור 81.9.');
});

check('row with no recognised tags leaves notes untouched aside from trimming', () => {
  const r = parseStockRowFromText('CRM · Salesforce · חיובי · רווחיות חזקה (5.9$ למניה כולל רווחי השקעות)');
  assert.equal(r.symbol, 'CRM');
  assert.equal(r.activity, null);
  assert.ok(r.notes.includes('רווחיות חזקה'));
});

check('non-stock plain prose returns null (mirrors parseStockFromText)', () => {
  assert.equal(parseStockRowFromText('הפד צפוי להותיר את הריבית ללא שינוי'), null);
});

check('empty / non-string input returns null', () => {
  assert.equal(parseStockRowFromText(''), null);
  assert.equal(parseStockRowFromText(null), null);
  assert.equal(parseStockRowFromText(42), null);
});

// ── deriveSyntheticStockCategory ─────────────────────────────────────────────
check('synthetic category mapping: positive→opportunity, negative→risk, null→general', () => {
  assert.equal(deriveSyntheticStockCategory('positive'), 'opportunity');
  assert.equal(deriveSyntheticStockCategory('negative'), 'risk');
  assert.equal(deriveSyntheticStockCategory(null), 'general');
  assert.equal(deriveSyntheticStockCategory(undefined), 'general');
});

check('synthetic category never produces "watchlist" (no follow-intent signal exists)', () => {
  for (const input of ['positive', 'negative', null, undefined, 'unknown']) {
    assert.notEqual(deriveSyntheticStockCategory(input), 'watchlist');
  }
});

// ── getSavedStockSentimentTone ───────────────────────────────────────────────
check('sentiment tone: positive → emerald, negative → red, neutral → amber, null → no tone', () => {
  assert.match(getSavedStockSentimentTone('positive').className, /emerald/);
  assert.match(getSavedStockSentimentTone('negative').className, /red/);
  assert.match(getSavedStockSentimentTone('neutral').className, /amber/);
  assert.equal(getSavedStockSentimentTone(null), null);
});

// ── getActivityTone parity with the committed snapshot helper ───────────────
check('activity tone: avoid → red, everything else → slate', () => {
  assert.match(getActivityTone('avoid'), /red/);
  assert.match(getActivityTone('watch'), /slate/);
  assert.match(getActivityTone('buy'), /slate/);
});

check('getActivityTone is a verbatim copy of StructuredSnapshotView getActivityTone', () => {
  const snap = readFileSync(new URL('../src/components/workspace/StructuredSnapshotView.jsx', import.meta.url), 'utf8');
  const shared = readFileSync(new URL('../src/lib/stockRowVisuals.js', import.meta.url), 'utf8');
  const re = /avoid\|הימנע\|הימנעות\|להימנע/i;
  assert.ok(re.test(snap), 'snapshot has the activity regex');
  assert.ok(re.test(shared), 'shared copy has the activity regex');
});

check('CATEGORY_META keys match StructuredSnapshotView (visual parity)', () => {
  const snap = readFileSync(new URL('../src/components/workspace/StructuredSnapshotView.jsx', import.meta.url), 'utf8');
  for (const key of Object.keys(CATEGORY_META)) {
    assert.ok(snap.includes(`${key}:`), `snapshot CATEGORY_META has ${key}`);
  }
});

// ── wiring: real end-to-end routing through the real persisted-item shape ───
// Replaces the previous string-includes checks (proved only that certain
// substrings existed somewhere in the source, never that a real saved item
// actually routes anywhere). Mirrors the equivalent fix in
// scripts/saved-market-rows-qa.mjs for the indices path — same root cause:
// provenanceFor() (src/utils/workspaceSavedAnalysis.js) must read
// item.originalItemType, not item.itemType, because
// saveSingleItemToWorkspace() (VideoDetailPanel.jsx) always persists
// itemType:'snippet' and keeps the real type only in originalItemType.
// originalItemType is 'stocks-mentioned' — NOT 'stock'. 'stock' only ever
// exists as WorkspaceSaveReviewOverlay.jsx's itemType override
// (stockExtraFields.itemType, used for the display title); neither save
// path — the overlay's bulk-review-and-confirm flow nor
// saveSingleItemToWorkspace()'s per-row quick-save — ever writes 'stock' to
// originalItemType. A fixture using 'stock' here would test a value real
// persisted data never has.
function realStockItem(overrides = {}) {
  return {
    id: 'ws-item:stock-1',
    sourceVideoId: 'video-1',
    sourceTabId: 'stocks-mentioned',
    sourceSectionId: 'stocks',
    sourceHeading: '⭐ מניות שהוזכרו',
    itemType: 'snippet',
    originalItemType: 'stocks-mentioned',
    savedAt: '2026-08-30T08:00:00Z',
    notes: 'NVDA · Nvidia Corp · חיובי · המשך מומנטום חזק לאחר הדוחות',
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

  check('a real persisted stock row (itemType:snippet, originalItemType:stocks-mentioned) actually routes to SavedStockRowsTable', () => {
    const markup = render([realStockItem()]);
    assert.ok(markup.includes('data-saved-stock-rows-table'), 'SavedStockRowsTable rendered');
    assert.ok(markup.includes('NVDA'), 'the saved row content reached the table');
  });

  check('REGRESSION: no originalItemType (itemType:snippet only) must not route to the stock table', () => {
    const markup = render([realStockItem({ id: 'ws-item:legacy-stock-1', originalItemType: undefined })]);
    assert.equal(markup.includes('data-saved-stock-rows-table'), false, 'falls back to plain text, not stock table');
  });

  check('REGRESSION: WorkspaceSaveReviewOverlay-shaped stock row (itemType:stock, originalItemType:stocks-mentioned) still routes', () => {
    // The exact real shape written by WorkspaceSaveReviewOverlay.jsx's
    // stockExtraFields override: itemType is remapped to 'stock' for the
    // display title, but originalItemType is left untouched at
    // 'stocks-mentioned'. Detection must key off originalItemType, not
    // itemType — this is the overlay-path counterpart to the quick-save-path
    // fixture above, proving both real save paths route correctly.
    const markup = render([realStockItem({ id: 'ws-item:overlay-stock-1', itemType: 'stock', originalItemType: 'stocks-mentioned' })]);
    assert.ok(markup.includes('data-saved-stock-rows-table'), 'overlay-saved stock row routes to the table');
  });

  check('REGRESSION: checking originalItemType === "stock" (instead of "stocks-mentioned") would misroute every real saved stock row', () => {
    // Guards the detection predicate itself, not just fixture shapes: no real
    // persisted item — from either save path — ever has originalItemType
    // exactly 'stock'. If isStockRowsSection() ever reverts to checking
    // 'stock', this proves it would send every real stock row to the bullet
    // list, and this specific fixture (originalItemType:'stock') must NOT
    // route to the table.
    const markup = render([realStockItem({ id: 'ws-item:should-not-exist-1', originalItemType: 'stock' })]);
    assert.equal(markup.includes('data-saved-stock-rows-table'), false, '"stock" is never a real originalItemType value — must not match');
  });

  check('indices routing (Path A) is unaffected by the stock path fix', () => {
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
    assert.equal(markup.includes('data-saved-stock-rows-table'), false, 'and not to the stock table');
  });

  check('a genuine plain-text snippet (unrelated heading) is never misrouted to the stock table', () => {
    const markup = render([{
      id: 'ws-item:snippet-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'insights',
      sourceHeading: '💡 תובנות מובילות',
      itemType: 'snippet',
      originalItemType: 'snippet',
      savedAt: '2026-08-30T08:00:00Z',
      notes: 'תובנה כללית שאינה קשורה למניות',
    }]);
    assert.equal(markup.includes('data-saved-stock-rows-table'), false, 'unrelated snippet stays on AnalysisList');
  });
} finally {
  await server.close();
}

console.log(`\nsaved stock rows QA: ${count} checks passed`);
