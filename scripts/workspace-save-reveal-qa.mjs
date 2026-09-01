import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const { buildWorkspaceSaveRevealParams } = await server.ssrLoadModule('/src/lib/workspaceSaveNavigation.js');
  const { getWorkspaceLibraryUrl } = await server.ssrLoadModule('/src/lib/workspaceLibraryRoute.js');
  const { WorkspaceRecordRevealProvider } = await server.ssrLoadModule('/src/context/WorkspaceRecordRevealContext.jsx');
  const { AnalysisList } = await server.ssrLoadModule('/src/components/shared/AnalysisContentPrimitives.jsx');
  const { SavedNewsRows } = await server.ssrLoadModule('/src/components/workspace/SavedNewsRows.jsx');

  const records = [
    ['saved-news-1', 'market-news', 'specialized'],
    ['saved-news-2', 'market-news', 'specialized'],
    ['saved-news-3', 'market-news', 'specialized'],
    ['saved-news-4', 'market-news', 'specialized'],
  ].map(([id, originalItemType, workspaceCollection]) => ({
    id,
    sourceVideoId: 'video-qa-1',
    topicId: 'wt-markets',
    sourceTabId: 'market-news',
    sourceTab: 'market-news',
    sourceSectionId: 'news',
    itemType: 'snippet',
    originalItemType,
    workspaceCollection,
    identityPayload: { text: id },
  }));
  const persistenceResult = { ok: true, persistedItems: records };
  const params = buildWorkspaceSaveRevealParams({
    persistenceResult,
    recordIds: records.map(item => item.id),
    tokenFactory: () => 'qa-token',
  });

  assert.equal(params.itemId, 'saved-news-1', 'the existing itemId deep-link remains the durable focus target');
  assert.equal(params.video, 'video-qa-1', 'the confirmed source group is focused');
  assert.equal(params.collection, 'specialized', 'the confirmed Workspace collection is activated');
  assert.equal(params.topicId, 'vt-markets', 'the canonical topic is converted to the visible Workspace tab');
  assert.deepEqual(params.revealRecordIds, records.map(item => item.id), 'all confirmed record ids are temporary reveal targets');
  assert.equal(params.revealCount, 4, 'the exact saved count is retained');
  assert.equal(params.revealToken, 'qa-token');

  const canonicalUrl = getWorkspaceLibraryUrl(params);
  assert.match(canonicalUrl, /^\/workspace-library\?/);
  assert.match(canonicalUrl, /itemId=saved-news-1/);
  assert.match(canonicalUrl, /video=video-qa-1/);
  assert.match(canonicalUrl, /collection=specialized/);
  assert.doesNotMatch(canonicalUrl, /revealRecordIds|revealCount|revealToken/, 'temporary highlighting does not become a permanent URL filter');

  assert.equal(buildWorkspaceSaveRevealParams({ persistenceResult: { ok: false }, recordIds: ['saved-news-1'] }), null, 'failed persistence never creates a navigation target');
  assert.equal(buildWorkspaceSaveRevealParams({ persistenceResult, recordIds: ['missing-id'] }), null, 'unconfirmed ids never create a navigation target');

  const partial = buildWorkspaceSaveRevealParams({
    persistenceResult,
    recordIds: ['saved-news-2', 'missing-id'],
    tokenFactory: () => 'partial-token',
  });
  assert.deepEqual(partial.revealRecordIds, ['saved-news-2'], 'partial success reveals only confirmed persisted ids');
  assert.equal(partial.revealCount, 1);

  const mixedCollections = buildWorkspaceSaveRevealParams({
    persistenceResult: {
      ok: true,
      persistedItems: [records[0], { ...records[1], id: 'saved-row-2', workspaceCollection: 'insights', sourceTabId: 'insights', sourceTab: 'insights' }],
    },
    recordIds: ['saved-news-1', 'saved-row-2'],
    tokenFactory: () => 'mixed-token',
  });
  assert.equal(mixedCollections.collection, undefined, 'mixed save types do not receive a collection filter that hides part of the saved set');
  assert.equal(mixedCollections.video, 'video-qa-1', 'mixed save types still open their shared source group');

  const highlightedList = renderToStaticMarkup(
    React.createElement(WorkspaceRecordRevealProvider, { recordIds: ['row-1', 'row-2'] },
      React.createElement(AnalysisList, {
        entries: [
          { text: 'שורה ראשונה', recordIds: ['row-1'] },
          { text: 'שורה שנייה', recordIds: ['row-2'] },
          { text: 'שורה ישנה', recordIds: ['old-row'] },
        ],
        selectedIds: new Set(),
        onToggleGroup: () => {},
      }),
    ),
  );
  assert.equal((highlightedList.match(/data-workspace-record-highlight="true"/g) || []).length, 2, 'several saved rows are highlighted independently');
  assert.match(highlightedList, /data-workspace-record-ids="row-1"/);
  assert.doesNotMatch(highlightedList, /data-workspace-record-ids="old-row" data-workspace-record-highlight/, 'an older row is not falsely highlighted');

  const highlightedNews = renderToStaticMarkup(
    React.createElement(WorkspaceRecordRevealProvider, { recordIds: ['news-only'] },
      React.createElement(SavedNewsRows, {
        entries: [{
          text: 'כותרת — תיאור',
          headline: 'כותרת',
          description: 'תיאור',
          structuredNews: true,
          recordIds: ['news-only'],
        }],
        selectedIds: new Set(),
        onToggleGroup: () => {},
      }),
    ),
  );
  assert.equal((highlightedNews.match(/data-workspace-record-highlight="true"/g) || []).length, 1, 'one news save highlights exactly its own row');

  const dialogSource = readFileSync(new URL('../src/components/workspace/SaveToWorkspaceDialog.jsx', import.meta.url), 'utf8');
  const overlaySource = readFileSync(new URL('../src/components/workspace/WorkspaceSaveReviewOverlay.jsx', import.meta.url), 'utf8');
  const panelSource = readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
  const librarySource = readFileSync(new URL('../src/pages/WorkspaceLibrary.jsx', import.meta.url), 'utf8');

  assert.match(dialogSource, /if \(!videoId \|\| isSaving\) return;/, 'full-video save ignores a competing click');
  assert.match(dialogSource, /disabled=\{isSaving\}/, 'full-video yellow button is disabled while persistence is pending');
  assert.match(overlaySource, /if \(effectiveDraftItems\.length === 0 \|\| isSaving\) return;/, 'multi-save ignores a competing click');
  assert.match(overlaySource, /recordIds: confirmedSavedIds[\s\S]*persistenceResult/, 'multi-save exposes only confirmed stable ids to navigation');
  assert.match(panelSource, /workspaceSingleSaveInFlightIdsRef\.current\.has\(wsId\)/, 'single-row save has duplicate-click protection');
  assert.match(panelSource, /navigateToSavedWorkspace\(saveResult, \[saveResult\.item\.id\]\)/, 'single-row and snapshot success use the canonical reveal navigation');
  assert.match(panelSource, /onSaved=\{\(\{ recordIds, persistenceResult \}[\s\S]*navigateToSavedWorkspace\(persistenceResult, recordIds\)/, 'multi-save success navigates through confirmed persistence output');
  assert.match(librarySource, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/, 'the first revealed record is scrolled into view');
  assert.match(librarySource, /closeDeadlineRef\.current = Date\.now\(\) \+ 7000;/, 'record highlighting close deadline is stamped at open time');
  assert.match(librarySource, /setTimeout\([\s\S]{0,180}setRevealedRecordIds\(\[\]\)/, 'record highlighting is temporary');
  assert.match(librarySource, /data-workspace-saved-count=\{revealedRecordCount\}/, 'the complete saved count is announced in the normal library');

  console.log('Workspace save reveal QA passed');
} finally {
  await server.close();
}

