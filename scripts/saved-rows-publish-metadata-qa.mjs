// QA for TRADINGBRAIN-SAVEDROWS-NEWS-FRESHNESS (Step 3): every saved-section
// header must show the original YouTube video's publish date+time next to
// "נשמר לאחרונה", across all six saved-row section renderers, including
// items saved BEFORE this change (own field missing, resolved only through
// a videoLookup Map built at display time from the currently loaded videos).
//
//   node --import ./scripts/register-src-aliases.mjs scripts/saved-rows-publish-metadata-qa.mjs

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

// Same real he-IL 24h formatting the implementation uses — computed here,
// not hardcoded, so this QA is not timezone-dependent (see repo lesson on
// verifying he-IL/hour12 formatting per engine).
function expectedTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function expectedDatePlain(iso) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}
// dateText() (the pre-existing "נשמר לאחרונה" formatter) uses
// toLocaleDateString('he-IL') directly — unpadded day/month (e.g. "30.8.2026"),
// unlike formatBriefPublishDatePlain's zero-padded "30.08.2026". Compute both
// separately so this QA is never timezone- or padding-assumption-dependent.
function expectedSaveDateText(iso) {
  return new Date(iso).toLocaleDateString('he-IL');
}
const SAVED_AT = '2026-08-30T08:00:00Z';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { WorkspaceSavedAnalysisContent, WorkspaceGlobalSavedAnalysisGroup } = await server.ssrLoadModule(
    '/src/components/workspace/WorkspaceFocusedVideoCard.jsx',
  );
  const render = (items, videoLookup) => renderToStaticMarkup(React.createElement(WorkspaceSavedAnalysisContent, {
    group: { items, versions: [], videoUrl: null },
    activeCollection: null,
    selectedIds: new Set(),
    onToggleGroup: () => {},
    videoLookup,
  }));

  // One real persisted-shape fixture builder per section type, matching the
  // exact shapes exercised by the sibling saved-*-rows-qa.mjs scripts.
  const SECTION_BUILDERS = {
    text: (overrides = {}) => ({
      id: 'ws-item:text-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'insights',
      sourceHeading: '💡 תובנות מובילות',
      itemType: 'snippet',
      originalItemType: 'snippet',
      savedAt: SAVED_AT,
      notes: 'תובנה כללית שאינה קשורה לשווקים',
      ...overrides,
    }),
    market: (overrides = {}) => ({
      id: 'ws-item:indices-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'indices',
      sourceSectionId: 'markets',
      sourceHeading: '📈 שווקים',
      itemType: 'snippet',
      originalItemType: 'indices',
      savedAt: SAVED_AT,
      notes: 'SPX · עולה · +0.4%',
      ...overrides,
    }),
    stock: (overrides = {}) => ({
      id: 'ws-item:stock-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'stocks-mentioned',
      sourceHeading: '⭐ מניות שהוזכרו',
      itemType: 'snippet',
      originalItemType: 'stocks-mentioned',
      savedAt: SAVED_AT,
      notes: 'NVDA · Nvidia Corp · חיובי · המשך מומנטום',
      ...overrides,
    }),
    sector: (overrides = {}) => ({
      id: 'ws-item:sector-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'brief-sectors',
      sourceHeading: '🏭 סקטורים',
      itemType: 'snippet',
      originalItemType: 'brief-sectors',
      savedAt: SAVED_AT,
      notes: 'טכנולוגיה · חיובי · המשך מומנטום ברכיבי AI',
      ...overrides,
    }),
    opportunity: (overrides = {}) => ({
      id: 'ws-item:opp-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'brief-opportunities',
      sourceSectionId: 'opportunities',
      sourceHeading: '🎯 הזדמנויות',
      itemType: 'snippet',
      originalItemType: 'brief-opportunities',
      savedAt: SAVED_AT,
      notes: 'IGV · Breakout · כניסה: 100 · סטופ: 95 · יעד: 110 · יחס סיכון/סיכוי: 1:2 · טווח: swing · ביטחון: medium',
      ...overrides,
    }),
    news: (overrides = {}) => ({
      id: 'ws-item:news-1',
      sourceVideoId: 'video-1',
      sourceTabId: 'market-news',
      sourceSectionId: 'news',
      sourceHeading: '📰 חדשות',
      itemType: 'snippet',
      originalItemType: 'market-news',
      savedAt: SAVED_AT,
      notes: 'NVDA מדווחת על עלייה של 15% בהכנסות הרבעון — הרחבת קיבולת ייצור. השפעה על השוק: חיזוק הסנטימנט בסקטור השבבים',
      ...overrides,
    }),
  };
  const SECTION_MARKERS = {
    text: 'data-analysis-presentation="section"',
    market: 'data-saved-market-rows-table',
    stock: 'data-saved-stock-rows-table',
    sector: 'data-saved-sector-rows-table',
    opportunity: 'data-saved-opportunity-rows',
    news: 'data-saved-news-rows',
  };

  // ── (a) full data present: published (bold, first/rightmost) · brief · saved · count ──
  // 2026-09-01 user feedback: publish date must lead (bold, rightmost in RTL),
  // save date de-emphasized and moved after it — see buildSectionMetadataLine
  // doc-comment. The composed value is now JSX (a <strong> segment plus plain
  // spans), not one flat string, so assert per-piece text + relative order via
  // indexOf rather than one exact substring (tags sit between the pieces).
  const publishedAtA = '2026-08-31T08:05:00Z';
  for (const [type, build] of Object.entries(SECTION_BUILDERS)) {
    check(`(a) full data present renders in order for ${type} section`, () => {
      const markup = render([build({ videoPublishedAt: publishedAtA, sourceBriefSlug: 'morning-brief' })]);
      assert.ok(markup.includes(SECTION_MARKERS[type]), `${type} section renderer is actually active`);
      const publishedText = `פורסם ${expectedDatePlain(publishedAtA)} ${expectedTime(publishedAtA)}`;
      const boldMatch = markup.match(/<strong[^>]*>([^<]*)<\/strong>/);
      assert.ok(boldMatch, 'publish date is wrapped in a <strong> element');
      assert.equal(boldMatch[1], publishedText, 'the bold segment is exactly the publish date+time, nothing else');
      const idxPublished = markup.indexOf(publishedText);
      const idxBrief = markup.indexOf('🌅 מבזק בוקר');
      const idxSaved = markup.indexOf(`נשמר לאחרונה ${expectedSaveDateText(SAVED_AT)}`);
      const idxCount = markup.indexOf('1 רשומות מקור');
      assert.ok(idxPublished >= 0 && idxBrief > idxPublished && idxSaved > idxBrief && idxCount > idxSaved,
        `expected order published < brief < saved < count, got indices ${idxPublished}/${idxBrief}/${idxSaved}/${idxCount}`);
    });
  }

  // ── (b) no publish date resolvable at all: omit the segment cleanly, exact legacy format preserved ──
  for (const [type, build] of Object.entries(SECTION_BUILDERS)) {
    check(`(b) no publish date resolvable omits the publish segment cleanly for ${type} section`, () => {
      const markup = render([build()]);
      assert.ok(!markup.includes('פורסם'), 'no publish segment rendered');
      assert.ok(markup.includes(`נשמר לאחרונה ${expectedSaveDateText(SAVED_AT)} · 1 רשומות מקור`), 'exact pre-existing format preserved, no stray separator dots');
    });
  }

  // ── (c) publish date resolvable but no brief slug: omit only the brief label ──
  // Order with brief omitted: published (bold, first) · saved · count.
  for (const [type, build] of Object.entries(SECTION_BUILDERS)) {
    check(`(c) publish date without brief slug omits only the brief label for ${type} section`, () => {
      const markup = render([build({ videoPublishedAt: publishedAtA })]);
      assert.ok(!markup.includes('מבזק'), 'no guessed brief label');
      const publishedText = `פורסם ${expectedDatePlain(publishedAtA)} ${expectedTime(publishedAtA)}`;
      const idxPublished = markup.indexOf(publishedText);
      const idxSaved = markup.indexOf(`נשמר לאחרונה ${expectedSaveDateText(SAVED_AT)}`);
      const idxCount = markup.indexOf('1 רשומות מקור');
      assert.ok(idxPublished >= 0 && idxSaved > idxPublished && idxCount > idxSaved,
        'date+time present and leads, brief label omitted, count still last');
    });
  }

  // ── (d) videoLookup fallback path: item has no own videoPublishedAt, resolves via videoLookup, for all 6 types ──
  const publishedAtD = '2026-08-15T05:30:00Z';
  const videoLookup = new Map([['video-1', publishedAtD]]);
  for (const [type, build] of Object.entries(SECTION_BUILDERS)) {
    check(`(d) legacy item with no own videoPublishedAt resolves through videoLookup for ${type} section`, () => {
      const markup = render([build()], videoLookup);
      const publishedText = `פורסם ${expectedDatePlain(publishedAtD)} ${expectedTime(publishedAtD)}`;
      const idxPublished = markup.indexOf(publishedText);
      const idxSaved = markup.indexOf(`נשמר לאחרונה ${expectedSaveDateText(SAVED_AT)}`);
      assert.ok(idxPublished >= 0 && idxSaved > idxPublished,
        'videoLookup fallback resolves the publish date for an item saved before this change, and it leads the line');
    });
  }

  // ── an item's OWN persisted videoPublishedAt takes priority over videoLookup ──
  check('an item\'s own persisted videoPublishedAt wins over a conflicting videoLookup entry', () => {
    const ownPublishedAt = '2026-01-01T00:00:00Z';
    const conflictingLookup = new Map([['video-1', publishedAtD]]);
    const markup = render([SECTION_BUILDERS.market({ videoPublishedAt: ownPublishedAt })], conflictingLookup);
    assert.ok(markup.includes(expectedDatePlain(ownPublishedAt)), 'own field wins');
    assert.ok(!markup.includes(expectedDatePlain(publishedAtD)), 'lookup value is not used when own field exists');
  });

  // ── an invalid/malformed videoPublishedAt must never render "Invalid Date" or a stray time ──
  check('a malformed videoPublishedAt renders nothing extra, never "Invalid Date"', () => {
    const markup = render([SECTION_BUILDERS.market({ videoPublishedAt: 'not-a-real-date' })]);
    assert.ok(!markup.includes('Invalid Date'), 'never renders Invalid Date');
    assert.ok(!markup.includes('פורסם'), 'malformed date is treated as unresolved, segment omitted entirely');
    assert.ok(markup.includes(`נשמר לאחרונה ${expectedSaveDateText(SAVED_AT)} · 1 רשומות מקור`), 'falls back to the exact pre-existing format');
  });

  // ── mixed provenance: section with 2 records disagreeing on sourceBriefSlug never guesses a single label ──
  check('a section with disagreeing sourceBriefSlug across its saved items shows no brief label (mixed, not guessed)', () => {
    const markup = render([
      SECTION_BUILDERS.news({ id: 'ws-item:news-1', videoPublishedAt: publishedAtA, sourceBriefSlug: 'morning-brief' }),
      SECTION_BUILDERS.news({ id: 'ws-item:news-2', videoPublishedAt: publishedAtA, sourceBriefSlug: 'evening-brief', notes: 'עדכון חדשות שני שאינו זהה לראשון על מגזר הבנקאות' }),
    ]);
    assert.ok(!markup.includes('מבזק'), 'no single brief label guessed for a mixed-brief section');
    assert.ok(markup.includes(`פורסם ${expectedDatePlain(publishedAtA)} ${expectedTime(publishedAtA)}`), 'publish date still shown (both records agree on it)');
  });

  // ── 2026-09-01: WorkspaceGlobalSavedAnalysisGroup (the default "כל הסרטונים"
  // grouped view) must also thread videoLookup through to WorkspaceSavedAnalysisContent,
  // exactly like WorkspaceFocusedVideoCard already does — a legacy item with no own
  // videoPublishedAt must still resolve the publish date there via the lookup fallback. ──
  check('WorkspaceGlobalSavedAnalysisGroup (default all-videos view) threads videoLookup so a legacy item resolves its publish date', () => {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceGlobalSavedAnalysisGroup, {
      group: {
        videoKey: 'video-1', items: [SECTION_BUILDERS.market()], versions: [], videoUrl: null,
        videoTitle: 'וידאו לדוגמה', channel: 'ערוץ לדוגמה', thumbnail: null,
        uniqueContentCount: 1, latestSaveDate: SAVED_AT,
      },
      activeCollection: null,
      selectedIds: new Set(),
      onToggleGroup: () => {},
      onFocusVideo: () => {},
      videoLookup: new Map([['video-1', publishedAtD]]),
    }));
    const publishedText = `פורסם ${expectedDatePlain(publishedAtD)} ${expectedTime(publishedAtD)}`;
    assert.ok(markup.includes(publishedText), 'legacy item with no own videoPublishedAt resolves through videoLookup in the default all-videos view, not just the focused view');
  });

  // ── 2026-09-01: a section whose records come from more than one source
  // video must never show a single misleading publish date/time. ──
  check('a section spanning two different source videos shows no single misleading publish date', () => {
    const dateA = '2026-08-20T08:00:00Z';
    const dateB = '2026-08-25T08:00:00Z';
    const markup = render([
      SECTION_BUILDERS.market({ id: 'ws-item:m1', sourceVideoId: 'video-A', videoPublishedAt: dateA }),
      SECTION_BUILDERS.market({ id: 'ws-item:m2', sourceVideoId: 'video-B', videoPublishedAt: dateB, notes: 'NASDAQ · יורד · -0.2%' }),
    ]);
    assert.ok(!markup.includes('פורסם'), 'no publish segment at all when the section spans multiple videos — showing either date would misrepresent the other record');
    assert.ok(markup.includes(`נשמר לאחרונה ${expectedSaveDateText(SAVED_AT)} · 2 רשומות מקור`), 'falls back to the exact pre-existing format, count reflects both records');
  });

  // ── same check, but items from a single video with matching own dates must still show it (no false suppression) ──
  check('a section where all records share the same source video still shows the publish date', () => {
    const markup = render([
      SECTION_BUILDERS.market({ id: 'ws-item:m1', sourceVideoId: 'video-1', videoPublishedAt: publishedAtA }),
      SECTION_BUILDERS.market({ id: 'ws-item:m2', sourceVideoId: 'video-1', videoPublishedAt: publishedAtA, notes: 'NASDAQ · יורד · -0.2%' }),
    ]);
    assert.ok(markup.includes(`פורסם ${expectedDatePlain(publishedAtA)} ${expectedTime(publishedAtA)}`), 'single-video section is not falsely suppressed by the multi-video guard');
  });
} finally {
  await server.close();
}

console.log(`\nsaved rows publish metadata QA: ${count} checks passed`);
