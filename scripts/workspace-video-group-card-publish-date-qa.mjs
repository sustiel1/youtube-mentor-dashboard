// QA for TRADINGBRAIN-MORNING-BATCH Phase 1: WorkspaceVideoGroupCard.jsx is the
// component actually rendered for the TRUE default "כל הסרטונים" view
// (WorkspaceLibrary.jsx's `activeCollection` state defaults to null via
// `useState(null)`, and the ternary at the render call site picks
// WorkspaceVideoGroupCard specifically when activeCollection is falsy —
// WorkspaceGlobalSavedAnalysisGroup, covered by the sibling QA script, only
// renders once a specific collection is selected). This script proves the
// publish-date/time line now appears there too, reusing buildSectionMetadataLine.
//
//   node --import ./scripts/register-src-aliases.mjs scripts/workspace-video-group-card-publish-date-qa.mjs

import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let count = 0;
const check = (name, fn) => { fn(); count += 1; console.log(`  ok  ${name}`); };

function expectedDatePlain(iso) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}
function expectedTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { WorkspaceVideoGroupCard } = await server.ssrLoadModule(
    '/src/components/workspace/WorkspaceVideoGroupCard.jsx',
  );

  const baseGroup = (overrides = {}) => ({
    videoKey: 'video-1',
    videoTitle: 'וידאו לדוגמה',
    channel: 'ערוץ לדוגמה',
    thumbnail: null,
    items: [{
      id: 'ws-item:1', sourceVideoId: 'video-1', sourceTabId: 'indices',
      sourceHeading: '📈 שווקים', itemType: 'snippet', originalItemType: 'indices',
      savedAt: '2026-08-30T08:00:00Z', notes: 'SPX · עולה · +0.4%',
    }],
    versions: [],
    uniqueContentCount: 1,
    exactDuplicateGroups: [],
    latestSaveDate: '2026-08-30T08:00:00Z',
    collectionUniqueCounts: {},
    ...overrides,
  });

  const render = (group, videoLookup) => renderToStaticMarkup(React.createElement(WorkspaceVideoGroupCard, {
    group, topics: [], selectedIds: new Set(), onToggleItem: () => {}, onToggleGroup: () => {},
    onOpenVideo: () => {}, onOpenItem: () => {}, onEditItem: () => {}, onArchiveItem: () => {},
    onDeleteItem: () => {}, focusItemId: null, onFocusVideo: () => {}, isFocused: false, videoLookup,
  }));

  check('own videoPublishedAt renders bold "פורסם" with date+time in the default view card', () => {
    const publishedAt = '2026-08-21T14:29:00Z';
    const markup = render(baseGroup({ items: [{ ...baseGroup().items[0], videoPublishedAt: publishedAt }] }));
    const publishedText = `פורסם ${expectedDatePlain(publishedAt)} ${expectedTime(publishedAt)}`;
    const boldMatch = markup.match(/<strong[^>]*>([^<]*)<\/strong>/);
    assert.ok(boldMatch, 'publish date is bold');
    assert.equal(boldMatch[1], publishedText, 'bold segment is exactly the publish date+time');
  });

  check('legacy item with no own videoPublishedAt resolves via videoLookup in the default view card', () => {
    const publishedAt = '2026-08-15T05:30:00Z';
    const videoLookup = new Map([['video-1', publishedAt]]);
    const markup = render(baseGroup(), videoLookup);
    const publishedText = `פורסם ${expectedDatePlain(publishedAt)} ${expectedTime(publishedAt)}`;
    assert.ok(markup.includes(publishedText), 'videoLookup fallback resolves the publish date here too');
  });

  check('no publish date resolvable falls back to the pre-existing line with no null/Invalid Date', () => {
    const markup = render(baseGroup());
    assert.ok(!markup.includes('פורסם'), 'no publish segment rendered');
    assert.ok(!markup.includes('null'), 'no literal null');
    assert.ok(!markup.includes('Invalid Date'), 'no Invalid Date');
    assert.ok(markup.includes('נשמר לאחרונה'), 'save-date fallback still present');
  });

  check('existing card-level counters (שמירות / תכנים ייחודיים) are preserved unchanged', () => {
    const markup = render(baseGroup());
    assert.ok(markup.includes('1 שמירות'), 'save count preserved');
    assert.ok(markup.includes('1 תכנים ייחודיים'), 'unique content count preserved');
  });
} finally {
  await server.close();
}

console.log(`\nworkspace video group card publish-date QA: ${count} checks passed`);
