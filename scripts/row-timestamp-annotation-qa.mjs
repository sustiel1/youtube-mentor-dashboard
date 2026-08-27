/**
 * Focused, isolated (no network) QA for opt-in row timestamps
 * (WORK-ID YMD-ONDEMAND-ROW-TIMES). Memory-only storage throughout — no
 * real localStorage/IndexedDB is touched by this script.
 *
 * Items 3 (one-click guard), 19-20 (RTL/dark/mobile/a11y) and 22 (perf) are
 * inherently browser/UI concerns and are verified separately via Playwright
 * against a dedicated isolated QA fixture, not here — noted per-item below.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  extractRows,
  buildRowTimestampDescriptors,
  getRowTimestampActionState,
  ROW_FIELD_TABS,
} from '../src/lib/rowExtraction.js';
import {
  createLocalStorageStore, createMemoryStore, saveAnnotations, resolveAnnotation, indexAnnotationsForVideo,
  resolveFromIndex, deleteAnnotationsForVideo, deleteAnnotation, fingerprintRowText, buildRowPath,
  classifyRowTimestampResults, ROW_TIMESTAMP_RESULT_STATUS,
  createRowTimestampResolver,
} from '../src/lib/rowTimestampSidecar.js';
import { mergeRowTimestampsIntoAnalysis } from '../src/lib/rowTimestampMerge.js';
import {
  buildRowTimestampPrompt,
  buildRowTimestampRequestPayload,
  applyEvidenceGateToRowAnnotations,
} from '../src/lib/rowTimestampAnnotation.js';
import { parseTimedTranscriptSegments } from '../src/lib/timedNarrativeEvidenceGate.js';
import { resolveStaticVideoTimestamp, buildStaticYouTubeTimestampLink } from '../src/lib/staticVideoTimestamp.js';
import { normalizeTimedNarrativeItem } from '../src/ai/gemini/validators/timedNarrative.js';
import {
  buildRowTimestampTranscript,
  loadRowTimestampTranscript,
  resolveRowTimestampYoutubeId,
} from '../src/services/rowTimestamps.js';

const TRANSCRIPT = [
  '[0] שלום וברוכים הבאים לשידור',
  '[8] היום נדבר על ניתוח טכני',
  '[15] הכלל הראשון הוא לשמור על סיכון מבוקר',
  '[30] בואו נמשיך לנושא הבא',
].join('\n');
const SEGMENTS = parseTimedTranscriptSegments(TRANSCRIPT);

const ANALYSIS = {
  shortSummary: 'תקציר',
  tags: ['תג1'],
  chapters: [{ title: 'פרק 1', startSeconds: 0, endSeconds: 120 }],
  keyPoints: [{ text: 'הכלל הראשון הוא לשמור על סיכון מבוקר' }, 'פריט טקסט פשוט'],
  keyInsights: [{ text: 'שלום וברוכים הבאים לשידור' }],
};

// Active ownership and UI contract: the real saved-video panel mounts one
// generator in the shared header based on selected narrative rows, not on
// saved-analysis metadata. The focused service owns the dedicated endpoint.
{
  const panelSource = readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
  const componentSource = readFileSync(new URL('../src/components/dashboard/RowTimestampGenerator.jsx', import.meta.url), 'utf8');
  const timestampLinkSource = readFileSync(new URL('../src/components/shared/StaticVideoTimestampLink.jsx', import.meta.url), 'utf8');
  const specializedSource = readFileSync(new URL('../src/components/dashboard/SpecializedContentRenderer.jsx', import.meta.url), 'utf8');
  const headerSource = readFileSync(new URL('../src/components/dashboard/BriefContextHeader.jsx', import.meta.url), 'utf8');
  const serviceSource = readFileSync(new URL('../src/services/rowTimestamps.js', import.meta.url), 'utf8');
  const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  const routeStart = viteSource.indexOf('function makeRowTimestampsPlugin');
  // End at the section marker that immediately follows makeRowTimestampsPlugin.
  // (Previously keyed off the Political Summary Plugin marker, which now sits
  // several plugins later — the slice over-captured unrelated analyze-video refs.)
  const routeEnd = viteSource.indexOf('// ─── Claude Video Analyze Plugin', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, 'makeRowTimestampsPlugin boundary not found in vite.config.js');
  const routeSource = viteSource.slice(routeStart, routeEnd);

  assert.match(panelSource, /rowTimestampActionState\.shouldRender/);
  assert.match(panelSource, /analysis=\{rowTimestampAnalysis\}/);
  assert.match(panelSource, /resolveRowTimestampYoutubeId\(video\)/);
  assert.match(panelSource, /const rowTimestampRecordId = video\?\.id \|\| video\?\._id \|\| null/);
  assert.match(panelSource, /recordId=\{rowTimestampRecordId\}/);
  assert.match(panelSource, /youtubeId=\{rowTimestampYoutubeId\}/);
  assert.doesNotMatch(panelSource, /<StaticVideoTimestampLink[\s\S]{0,180}effectiveVideo\?\.(?:youtubeId|videoId|id)/);
  assert.doesNotMatch(panelSource, /<InsightsStructuredView[\s\S]{0,220}effectiveVideo\?\.(?:youtubeId|videoId|id)/);
  assert.doesNotMatch(panelSource, /<LearningTabContent[\s\S]{0,220}effectiveVideo\?\.(?:youtubeId|videoId|id)/);
  assert.match(timestampLinkSource, /context\.youtubeId !== youtubeId/);
  assert.match(specializedSource, /youtubeId = null/);
  assert.doesNotMatch(specializedSource, /effectiveVideo\?\.youtubeId \|\| effectiveVideo\?\.videoId \|\| effectiveVideo\?\.id/);
  assert.doesNotMatch(panelSource, /hasSavedAnalysis && eligibleRowTimestampCount > 0/);
  assert.match(panelSource, /<RowTimestampGenerator/);
  assert.equal((panelSource.match(/<RowTimestampGenerator/g) || []).length, 1, 'the production panel must mount exactly one action');
  assert.match(panelSource, /action=\{rowTimestampActionState\.shouldRender/);
  assert.match(headerSource, /data-shared-heading-action/);
  assert.match(headerSource, /flex flex-wrap items-center/);
  assert.match(panelSource, /mergeRowTimestampsIntoAnalysis\(video, rowTimestampIndex\)/);
  assert.match(componentSource, /requestInFlightRef\.current/);
  assert.match(componentSource, /loadTranscriptFn/);
  assert.match(componentSource, /טוען תמלול…/);
  assert.match(componentSource, /focus-visible:ring-2/);
  assert.match(componentSource, /current\?\.fingerprint === annotation\.fingerprint/);
  assert.ok(componentSource.includes('הפעולה תשלח בקשת AI אחת ל-Claude/Anthropic ועשויה להיות בתשלום ולצרוך מכסת Base44. שליפת התמלול עצמה אינה משתמשת ב-AI.'));
  for (const label of ['🕒 צור זמנים לשורות', 'יוצר זמנים...', 'צור מחדש', 'לא נמצאו זמנים אמינים מספיק', 'נסה שוב']) {
    assert.ok(componentSource.includes(label), `missing required UI label: ${label}`);
  }
  assert.match(serviceSource, /fetch\('\/api\/generate-row-timestamps'/);
  assert.doesNotMatch(serviceSource, /analyze-video|AnalyzeVideo/);
  assert.match(routeSource, /applyEvidenceGateToRowAnnotations/);
  assert.doesNotMatch(routeSource, /analyze-video|AnalyzeVideo/);
}

// Shared production/dialog identity resolution: exact legacy paths and source
// objects win; text fallback is tab-scoped and only valid when unique.
{
  const firstDuplicate = { text: 'same canonical row' };
  const secondDuplicate = { text: 'same canonical row' };
  const transformed = { text: 'אנבידיה מציגה חוזקה יחסית' };
  const identityAnalysis = {
    keyPoints: [firstDuplicate, secondDuplicate],
    keyInsights: [transformed, { text: 'cross-tab identity' }],
    rules: ['cross-tab identity'],
  };
  const descriptors = buildRowTimestampDescriptors({
    analysis: identityAnalysis,
    recordId: 'record-identity',
    youtubeId: '9su_tZfRYrI',
  });
  const store = createMemoryStore();
  saveAnnotations(store, 'record-identity', descriptors.map((row, index) => ({
    rowPath: row.legacyRowPath,
    fingerprint: row.fingerprint,
    sourceQuote: row.canonicalSourceText,
    estimatedStartSeconds: index + 10,
  })));
  const resolver = createRowTimestampResolver(descriptors, indexAnnotationsForVideo(store, 'record-identity'));

  assert.equal(resolver.resolve({
    tab: 'summary',
    legacyRowPath: 'summary.keyPoints[1]',
    canonicalSourceText: secondDuplicate.text,
  }).descriptor.legacyRowPath, 'summary.keyPoints[1]', 'exact legacy path is primary');
  assert.equal(resolver.resolve({
    tab: 'summary',
    sourceItem: secondDuplicate,
    canonicalSourceText: secondDuplicate.text,
    productionRowId: 'summary:reordered:0',
  }).descriptor.legacyRowPath, 'summary.keyPoints[1]', 'reordering preserves exact source identity');
  assert.equal(resolver.resolve({
    tab: 'summary',
    canonicalSourceText: firstDuplicate.text,
  }), null, 'duplicate tab-scoped fingerprints never overwrite or guess');
  assert.equal(resolver.resolve({
    tab: 'insights',
    sourceItem: transformed,
    canonicalSourceText: transformed.text,
    displayText: 'NVDA מציגה חוזקה יחסית',
  }).descriptor.canonicalSourceText, transformed.text, 'display transforms do not alter canonical identity');
  assert.equal(resolver.resolve({
    tab: 'insights',
    canonicalSourceText: 'cross-tab identity',
  }).descriptor.tab, 'insights', 'same fingerprint in another tab remains tab-scoped');
  assert.equal(resolver.resolve({
    tab: 'useful-knowledge',
    canonicalSourceText: 'cross-tab identity',
  }).descriptor.tab, 'useful-knowledge', 'URL-only identity remains separate from record-owned storage');

  const stringDuplicates = buildRowTimestampDescriptors({
    analysis: { keyPoints: ['primitive duplicate', 'primitive duplicate'] },
  });
  const duplicateStatuses = createRowTimestampResolver(stringDuplicates, new Map()).classify(stringDuplicates);
  assert.equal(duplicateStatuses.every((row) => row.status === ROW_TIMESTAMP_RESULT_STATUS.ORPHAN), true);

  const insightItem = { text: 'shared structured insight' };
  const specializedItem = { text: 'shared structured insight' };
  const structuredDescriptors = buildRowTimestampDescriptors({
    analysis: { keyInsights: [insightItem], mistakesToAvoid: [specializedItem] },
    structuredMorningBrief: true,
  });
  const specializedDescriptor = structuredDescriptors.find((row) => row.tab === 'specialized');
  assert.equal(specializedDescriptor.renderable, false, 'structured duplicate without a production row is orphaned');
  assert.equal(
    createRowTimestampResolver(structuredDescriptors, new Map()).classify(structuredDescriptors)
      .find((row) => row.tab === 'specialized').status,
    ROW_TIMESTAMP_RESULT_STATUS.ORPHAN,
  );
}

// Saved-analysis eligibility is row-based. Missing transcript stays enabled
// for opt-in loading; an unsupported/no-row record stays hidden. GEMS selector
// coverage runs in the Vite browser fixture because videoTabsConfig uses
// import.meta.env.
{
  const video = { id: 'saved-record-1', youtubeId: '9su_tZfRYrI' };
  assert.equal(getRowTimestampActionState({ video, youtubeId: video.youtubeId, analysis: ANALYSIS, transcriptText: TRANSCRIPT }).shouldRender, true);
  assert.equal(getRowTimestampActionState({ video, youtubeId: video.youtubeId, analysis: {}, transcriptText: TRANSCRIPT }).shouldRender, false);
  assert.equal(getRowTimestampActionState({ video, youtubeId: video.youtubeId, analysis: ANALYSIS, transcriptText: '' }).disabledReason, null);
}

// Canonical identity and on-demand transcript acquisition never use the local
// application record ID. Every fetch below is injected and network-free.
{
  const urlOnlyVideo = {
    id: 'local_1787327696551_dd7jx',
    url: 'https://www.youtube.com/watch?v=9su_tZfRYrI',
  };
  assert.equal(resolveRowTimestampYoutubeId(urlOnlyVideo), '9su_tZfRYrI');
  assert.equal(resolveRowTimestampYoutubeId({ id: 'local-only-record' }), null);
  assert.equal(buildRowTimestampTranscript(urlOnlyVideo, null, '9su_tZfRYrI'), '');

  let fetchCalls = 0;
  const cached = await loadRowTimestampTranscript({
    video: { ...urlOnlyVideo, transcriptSegments: SEGMENTS },
    youtubeId: '9su_tZfRYrI',
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); },
  });
  assert.equal(cached.source, 'cache');
  assert.equal(fetchCalls, 0);

  let requestedUrl = null;
  const fetched = await loadRowTimestampTranscript({
    video: urlOnlyVideo,
    youtubeId: '9su_tZfRYrI',
    fetchImpl: async (url) => {
      fetchCalls += 1;
      requestedUrl = url;
      return { ok: true, status: 200, json: async () => ({ segments: SEGMENTS }) };
    },
  });
  assert.equal(fetched.source, 'network');
  assert.equal(requestedUrl, '/api/youtube-transcript?v=9su_tZfRYrI');
  assert.equal(requestedUrl.includes('local_1787327696551_dd7jx'), false);
  assert.equal(fetchCalls, 1);

  await assert.rejects(
    loadRowTimestampTranscript({
      video: urlOnlyVideo,
      youtubeId: '9su_tZfRYrI',
      fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ error: 'NO_TRANSCRIPT' }) }),
    }),
    (error) => error.status === 404 && /לא נמצא תמלול/.test(error.message),
  );

  await assert.rejects(
    loadRowTimestampTranscript({
      video: urlOnlyVideo,
      youtubeId: '9su_tZfRYrI',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ segments: [{ text: 'בודד', startSeconds: 1 }] }),
      }),
    }),
    (error) => error.code === 'INVALID_TIMED_TRANSCRIPT',
  );

  const abortingFetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(
    loadRowTimestampTranscript({
      video: urlOnlyVideo,
      youtubeId: '9su_tZfRYrI',
      timeoutMs: 5,
      fetchImpl: abortingFetch,
    }),
    (error) => error.code === 'TRANSCRIPT_TIMEOUT',
  );

  const externalController = new AbortController();
  const cancelled = loadRowTimestampTranscript({
    video: urlOnlyVideo,
    youtubeId: '9su_tZfRYrI',
    signal: externalController.signal,
    fetchImpl: abortingFetch,
  });
  externalController.abort();
  await assert.rejects(cancelled, (error) => error.code === 'TRANSCRIPT_CANCELLED');
}

// Record identity owns storage; canonical YouTube identity owns navigation.
// Results are classified from the already-built index without regeneration.
{
  const recordId = 'local_1787327696551_dd7jx';
  const youtubeId = '9su_tZfRYrI';
  const rows = extractRows(ANALYSIS);
  const store = createMemoryStore();
  saveAnnotations(store, recordId, [
    {
      rowPath: rows[0].rowPath,
      fingerprint: rows[0].fingerprint,
      sourceQuote: rows[0].text,
      estimatedStartSeconds: 320,
    },
    {
      rowPath: rows[1].rowPath,
      fingerprint: 'stale-fingerprint',
      sourceQuote: 'ציטוט ישן',
      estimatedStartSeconds: 300,
    },
  ]);
  assert.equal(indexAnnotationsForVideo(store, recordId).size, 2);
  assert.equal(indexAnnotationsForVideo(store, youtubeId).size, 0, 'YouTube identity must never own sidecar storage');

  const results = classifyRowTimestampResults(rows, indexAnnotationsForVideo(store, recordId));
  assert.equal(results.filter((row) => row.status === ROW_TIMESTAMP_RESULT_STATUS.MAPPED).length, 1);
  assert.equal(results.filter((row) => row.status === ROW_TIMESTAMP_RESULT_STATUS.STALE).length, 1);
  assert.equal(results.filter((row) => row.status === ROW_TIMESTAMP_RESULT_STATUS.UNMATCHED).length, rows.length - 2);
  assert.equal(results.filter((row) => row.status === ROW_TIMESTAMP_RESULT_STATUS.MAPPED).length + results.filter((row) => row.status !== ROW_TIMESTAMP_RESULT_STATUS.MAPPED).length, rows.length);
  assert.equal(
    buildStaticYouTubeTimestampLink(youtubeId, { estimatedStartSeconds: results[0].annotation.estimatedStartSeconds, timestampKind: 'estimated' }).href,
    'https://www.youtube.com/watch?v=9su_tZfRYrI&t=320s',
  );

  const composedInsightRows = extractRows({
    keyInsights: [{ lesson: 'בדיקת הקשר לפני החלטה', whyImportant: 'כך נמנעת מסקנה מנתון בודד' }],
  });
  assert.equal(composedInsightRows.length, 1, 'whyImportant must remain part of its parent insight');
  assert.match(composedInsightRows[0].text, /למה זה חשוב/);
}

// The outbound contract contains only existing row identity/text, the timed
// transcript and duration context — never video metadata or full-analysis fields.
{
  const payload = buildRowTimestampRequestPayload({
    transcript: TRANSCRIPT,
    rows: [{ rowPath: 'summary.keyPoints[0]', text: 'קיים', fingerprint: 'client-only' }],
    durationSeconds: 30,
    videoId: 'must-not-leave-client',
    title: 'must-not-leave-client',
  });
  assert.deepEqual(Object.keys(payload).sort(), ['durationSeconds', 'rows', 'transcript']);
  assert.deepEqual(payload.rows, [{ rowPath: 'summary.keyPoints[0]', text: 'קיים' }]);
  assert.equal(JSON.stringify(payload).includes('must-not-leave-client'), false);
}

// ── 1. Normal/automatic analysis prompt no longer requests row timestamps ──
{
  const backendSource = readFileSync(new URL('../backend/analyze-video.function.js', import.meta.url), 'utf8');
  assert.doesNotMatch(backendSource, /STATIC NARRATIVE TIMES/);
  assert.match(backendSource, /applyTimedNarrativeEvidenceGateToAnalysis\(parsed, \[\]\)/);
  const viteSource = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(viteSource, /STATIC NARRATIVE TIMES/);
}

// ── 2. No async/fetch anywhere in the render-path lookup functions ─────────
{
  const sidecarSource = readFileSync(new URL('../src/lib/rowTimestampSidecar.js', import.meta.url), 'utf8');
  const mergeSource = readFileSync(new URL('../src/lib/rowTimestampMerge.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sidecarSource, /\bfetch\(/);
  assert.doesNotMatch(mergeSource, /\bfetch\(/);
  assert.equal(resolveFromIndex.constructor.name, 'Function', 'resolveFromIndex must be synchronous');
  assert.equal(mergeRowTimestampsIntoAnalysis.constructor.name, 'Function', 'merge must be synchronous');
}

// ── 4. Only the selected video's rows are ever extracted ───────────────────
{
  const rowsA = extractRows(ANALYSIS);
  const rowsB = extractRows({ keyPoints: [{ text: 'שורה מווידאו אחר לגמרי' }] });
  assert.ok(rowsA.every((r) => !rowsB.some((b) => b.text === r.text)));
  assert.equal(rowsA.length, 3); // 2 keyPoints + 1 keyInsight (empty rows are skipped; none here)
}

// ── 5. Transcript coverage metadata is honest (full vs partial) ────────────
{
  const full = parseTimedTranscriptSegments(TRANSCRIPT);
  const truncated = parseTimedTranscriptSegments(TRANSCRIPT.split('\n').slice(0, 2).join('\n'));
  assert.equal(full.length, 4);
  assert.equal(truncated.length, 2);
  assert.ok(truncated.length < full.length, 'a truncated segment set must never report as many segments as the full one');
}

// ── 6 & 15. Parser repair + Evidence Gate applied; 0 remains valid ─────────
{
  const rows = extractRows(ANALYSIS);
  const raw = [
    { rowPath: 'summary.keyPoints[0]', sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר', estimatedStartSeconds: 15, timestampConfidence: 0.9 },
    { rowPath: 'insights.keyInsights[0]', sourceQuote: 'שלום וברוכים הבאים לשידור', estimatedStartSeconds: 0, timestampConfidence: 0.95 },
    { rowPath: 'summary.keyPoints[1]', sourceQuote: 'ציטוט שלא קיים בתמלול', estimatedStartSeconds: 8 }, // must be rejected
  ];
  const { accepted, rejected } = applyEvidenceGateToRowAnnotations(raw, rows, SEGMENTS);
  assert.equal(accepted.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, 'quote-not-found');
  const zeroAccepted = accepted.find((a) => a.rowPath === 'insights.keyInsights[0]');
  assert.equal(zeroAccepted.estimatedStartSeconds, 0, '0 must be accepted as a valid time, not treated as falsy');
}

// ── 7. Output never contains rewritten row text ─────────────────────────────
{
  const rows = extractRows(ANALYSIS);
  const raw = [{ rowPath: 'summary.keyPoints[0]', text: 'טקסט מזויף שהמודל ניסה להחזיר', sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר', estimatedStartSeconds: 15 }];
  const { accepted } = applyEvidenceGateToRowAnnotations(raw, rows, SEGMENTS);
  assert.equal(accepted[0].rowText, 'הכלל הראשון הוא לשמור על סיכון מבוקר', 'rowText must be OUR original text, never the model-supplied override');
  assert.equal('text' in accepted[0], false, 'accepted annotation objects never carry a text field at all');
}

// ── 8 & 9. Preview does not persist; cancel leaves storage unchanged ───────
{
  const store = createMemoryStore();
  const rows = extractRows(ANALYSIS);
  const raw = [{ rowPath: 'summary.keyPoints[0]', sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר', estimatedStartSeconds: 15 }];
  const { accepted } = applyEvidenceGateToRowAnnotations(raw, rows, SEGMENTS); // preview only
  assert.equal(store.keys().length, 0, 'building a preview must never write to the store');
  void accepted; // "cancel" = simply never calling saveAnnotations
  assert.equal(store.keys().length, 0, 'cancel leaves storage untouched');
}

// ── 10. Selective approval stores only checked annotations ─────────────────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const rows = extractRows(ANALYSIS);
  const raw = [
    { rowPath: 'summary.keyPoints[0]', sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר', estimatedStartSeconds: 15 },
    { rowPath: 'insights.keyInsights[0]', sourceQuote: 'שלום וברוכים הבאים לשידור', estimatedStartSeconds: 0 },
  ];
  const { accepted } = applyEvidenceGateToRowAnnotations(raw, rows, SEGMENTS);
  const onlyChecked = accepted.filter((a) => a.rowPath === 'summary.keyPoints[0]'); // user unchecked the 2nd
  saveAnnotations(store, videoId, onlyChecked);
  assert.equal(store.keys().length, 1);
  assert.equal(resolveAnnotation(store, videoId, 'insights.keyInsights[0]', 'שלום וברוכים הבאים לשידור'), null);
}

// ── 11. Existing content and user edits remain unchanged ───────────────────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const rows = extractRows(ANALYSIS);
  saveAnnotations(store, videoId, [{ rowPath: 'summary.keyPoints[0]', fingerprint: rows[0].fingerprint, sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר', estimatedStartSeconds: 15 }]);
  const index = indexAnnotationsForVideo(store, videoId);
  const merged = mergeRowTimestampsIntoAnalysis(ANALYSIS, index);
  assert.equal(merged.shortSummary, ANALYSIS.shortSummary);
  assert.deepEqual(merged.tags, ANALYSIS.tags);
  assert.deepEqual(merged.chapters, ANALYSIS.chapters);
  assert.equal(merged.keyPoints[1], 'פריט טקסט פשוט', 'untouched rows/user content must survive byte-for-byte');
  assert.notEqual(merged, ANALYSIS, 'merge must return a new object, never mutate the input');
  assert.equal(ANALYSIS.keyPoints[0].estimatedStartSeconds, undefined, 'the original analysis object itself must never be mutated');
}

// ── 12. Repeated save does not duplicate ────────────────────────────────────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const rows = extractRows(ANALYSIS);
  const ann = [{ rowPath: 'summary.keyPoints[0]', fingerprint: rows[0].fingerprint, sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר', estimatedStartSeconds: 15 }];
  saveAnnotations(store, videoId, ann);
  saveAnnotations(store, videoId, ann);
  saveAnnotations(store, videoId, ann);
  assert.equal(store.keys().length, 1, 'saving the same annotation repeatedly must never duplicate — same key, overwrite semantics');
}

// ── 13. Changed row text invalidates the old fingerprint ───────────────────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const originalText = 'הכלל הראשון הוא לשמור על סיכון מבוקר';
  saveAnnotations(store, videoId, [{ rowPath: 'summary.keyPoints[0]', fingerprint: fingerprintRowText(originalText), sourceQuote: originalText, estimatedStartSeconds: 15 }]);
  assert.ok(resolveAnnotation(store, videoId, 'summary.keyPoints[0]', originalText));
  assert.equal(resolveAnnotation(store, videoId, 'summary.keyPoints[0]', 'טקסט שונה לגמרי אחרי עריכה ידנית'), null, 'materially changed text must invalidate the old annotation');
}

// ── 14. Delete removes only generated annotations, nothing else ────────────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const rows = extractRows(ANALYSIS);
  saveAnnotations(store, videoId, [
    { rowPath: rows[0].rowPath, fingerprint: rows[0].fingerprint, sourceQuote: rows[0].text, estimatedStartSeconds: 15 },
    { rowPath: rows[2].rowPath, fingerprint: rows[2].fingerprint, sourceQuote: rows[2].text, estimatedStartSeconds: 0 },
  ]);
  assert.equal(store.keys().length, 2);
  deleteAnnotationsForVideo(store, videoId);
  assert.equal(store.keys().length, 0);
  assert.deepEqual(ANALYSIS.keyPoints[0], { text: 'הכלל הראשון הוא לשמור על סיכון מבוקר' }, 'deleting sidecar entries must never touch the analysis object itself');

  // Single-annotation delete
  const store2 = createMemoryStore();
  saveAnnotations(store2, videoId, [
    { rowPath: rows[0].rowPath, fingerprint: rows[0].fingerprint, sourceQuote: rows[0].text, estimatedStartSeconds: 15 },
    { rowPath: rows[2].rowPath, fingerprint: rows[2].fingerprint, sourceQuote: rows[2].text, estimatedStartSeconds: 0 },
  ]);
  deleteAnnotation(store2, videoId, rows[0].rowPath);
  assert.equal(store2.keys().length, 1);
}

// ── 16 & 18. Invalid/missing times render nothing; chapters unchanged ──────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const merged = mergeRowTimestampsIntoAnalysis(ANALYSIS, indexAnnotationsForVideo(store, videoId));
  assert.equal(merged, ANALYSIS, 'with an empty index, merge is a safe no-op (same reference, nothing to change)');
  const link = resolveStaticVideoTimestamp(normalizeTimedNarrativeItem(merged.keyPoints[1]));
  assert.equal(link, null, 'a row with no annotation must render no link');
  assert.deepEqual(merged.chapters, ANALYSIS.chapters);
}

// ── 17. End-to-end: link contains the correct YouTube ID and seconds ───────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const youtubeId = '9su_tZfRYrI';
  const rows = extractRows(ANALYSIS);
  const raw = [{ rowPath: rows[0].rowPath, sourceQuote: rows[0].text, estimatedStartSeconds: 15 }];
  const { accepted } = applyEvidenceGateToRowAnnotations(raw, rows, SEGMENTS);
  saveAnnotations(store, videoId, accepted);
  const merged = mergeRowTimestampsIntoAnalysis(ANALYSIS, indexAnnotationsForVideo(store, videoId));
  const link = resolveStaticVideoTimestamp(normalizeTimedNarrativeItem(merged.keyPoints[0]));
  assert.equal(link.seconds, 15);
  const fullLink = buildStaticYouTubeTimestampLink(youtubeId, normalizeTimedNarrativeItem(merged.keyPoints[0]));
  assert.equal(fullLink.href, `https://www.youtube.com/watch?v=${youtubeId}&t=15s`);
}

// ── 21. "Reload" (rebuild the index fresh from the same store) preserves
// approved annotations in the isolated fixture ──────────────────────────────
{
  const store = createMemoryStore();
  const videoId = 'vidA';
  const rows = extractRows(ANALYSIS);
  saveAnnotations(store, videoId, [{ rowPath: rows[0].rowPath, fingerprint: rows[0].fingerprint, sourceQuote: rows[0].text, estimatedStartSeconds: 15 }]);
  const indexBeforeReload = indexAnnotationsForVideo(store, videoId);
  const mergedBefore = mergeRowTimestampsIntoAnalysis(ANALYSIS, indexBeforeReload);
  // Simulate a reload: rebuild the index from scratch against the same store.
  const indexAfterReload = indexAnnotationsForVideo(store, videoId);
  const mergedAfter = mergeRowTimestampsIntoAnalysis(ANALYSIS, indexAfterReload);
  assert.deepEqual(mergedAfter.keyPoints[0], mergedBefore.keyPoints[0]);
  assert.equal(mergedAfter.keyPoints[0].estimatedStartSeconds, 15);
}

// A fresh localStorage adapter (the F5 boundary) reads approved synthetic
// annotations, while changed text remains fingerprint-invalid.
{
  const originalLocalStorage = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {
    get length() { return data.size; },
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    key: (index) => Array.from(data.keys())[index] ?? null,
  };
  try {
    const rows = extractRows(ANALYSIS);
    const firstAdapter = createLocalStorageStore();
    saveAnnotations(firstAdapter, 'synthetic-video-a', [{
      rowPath: rows[0].rowPath,
      fingerprint: rows[0].fingerprint,
      sourceQuote: rows[0].text,
      estimatedStartSeconds: 15,
    }]);
    const afterReload = createLocalStorageStore();
    assert.equal(indexAnnotationsForVideo(afterReload, 'synthetic-video-a').size, 1);
    assert.equal(indexAnnotationsForVideo(afterReload, 'synthetic-video-b').size, 0);
    assert.equal(resolveAnnotation(afterReload, 'synthetic-video-a', rows[0].rowPath, 'טקסט ששונה'), null);
  } finally {
    globalThis.localStorage = originalLocalStorage;
  }
}

console.log('Row timestamp annotation QA (canonical modules, memory-only storage): PASS');

// ── 6b. Parity: the embedded backend copy behaves identically ──────────────
const backendSource = readFileSync(new URL('../backend/generate-row-timestamps.function.js', import.meta.url), 'utf8');
const backendModule = { exports: {} };
new Function('module', 'exports', 'require', backendSource)(backendModule, backendModule.exports, () => {
  throw new Error('Unexpected require in production handler');
});
const be = backendModule.exports;
for (const fn of ['handler', 'buildRowTimestampPrompt', 'applyEvidenceGateToRowAnnotations', 'parseTimedTranscriptSegments', 'verifyTimedNarrativeEvidence', 'fingerprintRowText']) {
  assert.equal(typeof be[fn], 'function', `production export missing: ${fn}`);
}

assert.deepEqual(be.parseTimedTranscriptSegments(TRANSCRIPT), SEGMENTS);
assert.equal(be.fingerprintRowText(ANALYSIS.keyPoints[0].text), fingerprintRowText(ANALYSIS.keyPoints[0].text));
assert.equal(
  be.buildRowTimestampPrompt({ transcriptText: TRANSCRIPT, rows: [{ rowPath: 'a', text: 'x' }] }),
  buildRowTimestampPrompt({ transcriptText: TRANSCRIPT, rows: [{ rowPath: 'a', text: 'x' }] })
);

const parityRows = extractRows(ANALYSIS);
const parityRaw = [
  { rowPath: 'summary.keyPoints[0]', sourceQuote: 'הכלל הראשון הוא לשמור על סיכון מבוקר', estimatedStartSeconds: 15 },
  { rowPath: 'insights.keyInsights[0]', sourceQuote: 'שלום וברוכים הבאים לשידור', estimatedStartSeconds: 0 },
  { rowPath: 'summary.keyPoints[1]', sourceQuote: 'לא קיים', estimatedStartSeconds: 8 },
  { rowPath: 'unknown.field[9]', sourceQuote: 'לא רלוונטי', estimatedStartSeconds: 1 },
];
const sharedGate = applyEvidenceGateToRowAnnotations(parityRaw, parityRows, SEGMENTS);
const backendGate = be.applyEvidenceGateToRowAnnotations(parityRaw, parityRows, SEGMENTS);
assert.deepEqual(backendGate, sharedGate);

console.log('Row timestamp annotation QA (canonical/embedded parity): PASS');

// ── ROW_FIELD_TABS sanity: chapters is never included ───────────────────────
assert.ok(!ROW_FIELD_TABS.some(([, field]) => field === 'chapters'));
assert.equal(buildRowPath('summary', 'keyPoints', 2), 'summary.keyPoints[2]');
