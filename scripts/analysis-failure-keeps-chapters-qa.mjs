// YMD-ANALYSIS-FAIL-KEEPS-CHAPTERS — regression QA
//
// Contract under test: an ANALYSIS FAILURE must never destroy chapters that are
// already persisted, while an INTENTIONAL deletion ("מחק היסטוריה" /
// handleDeleteSavedAnalysis) must still clear them.
//
// The storage rule that makes this work lives in src/services/videoStorage.js
// (updateStoredVideo): a chapter field that is not an Array is stripped from a
// partial update (so "not mentioned" == "keep"), while an explicit [] is a
// caller's intentional value and overwrites. That rule is intentionally NOT
// changed by this task — this script pins it, plus the call-site behaviour.
//
// Section 0 — extract the REAL clearAiAnalysisFields() patch out of
//             VideoDetailPanel.jsx, so the fixture can never drift from the code.
// Section A — run that real patch through the real updateStoredVideo() and
//             assert chapters survive; then assert intentional deletion still wipes.
// Section B — static anchors on VideoDetailPanel.jsx so a future re-add of
//             `chapters:` / `aiChapters:` to the failure patch fails this script.
//
// Run: npm run test:analysis-failure-keeps-chapters
//   (the --import alias bootstrap is required: videoStorage → videoAnalytics → '@/lib/...')

import assert from 'node:assert/strict';
import fs from 'node:fs';

const PANEL_PATH = new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url);
const panelSource = fs.readFileSync(PANEL_PATH, 'utf8');

// ─── helpers ────────────────────────────────────────────────────────────────

/** Extract a brace-balanced block starting at the first `{` at/after `fromIndex`. */
function extractBalancedBraces(source, fromIndex, label) {
  const start = source.indexOf('{', fromIndex);
  assert.notEqual(start, -1, `${label}: opening brace not found`);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new assert.AssertionError({ message: `${label}: unbalanced braces — extraction failed` });
}

/** Drop whole-line `//` comments so key assertions are not satisfied by prose. */
function stripLineComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// ─── Section 0 — read the real failure patch out of the component ───────────

const DECLARATION = 'const clearAiAnalysisFields = (analysisError) => ({';
const declarationCount = panelSource.split(DECLARATION).length - 1;
assert.equal(declarationCount, 1, 'clearAiAnalysisFields must be declared exactly once with the expected signature');

const declarationIndex = panelSource.indexOf(DECLARATION);
const clearBodyLiteral = extractBalancedBraces(
  panelSource,
  declarationIndex + DECLARATION.indexOf('=> ('),
  'clearAiAnalysisFields body',
);
assert.match(clearBodyLiteral, /analysisStatus:\s*"failed"/, 'extracted body must be the failure patch');

// Evaluate the literal as-is: the fixture below is therefore the REAL patch,
// not a hand-copied approximation of it.
const ANALYSIS_ERROR_MESSAGE = 'ניתוח נכשל — לא התקבלה תשובה מהמודל';
// eslint-disable-next-line no-new-func
const buildFailurePatch = new Function('analysisError', `return (${clearBodyLiteral});`);
const failurePatch = buildFailurePatch(ANALYSIS_ERROR_MESSAGE);

assert.equal(typeof failurePatch, 'object', 'the extracted failure patch must evaluate to an object');
assert.equal(failurePatch.analysisStatus, 'failed');
assert.equal(failurePatch.analysisError, ANALYSIS_ERROR_MESSAGE);
assert.equal(failurePatch.shortSummary, null, 'the failure patch must still clear the summary fields');
assert.ok(Array.isArray(failurePatch.keyPoints), 'the failure patch must still clear keyPoints');
for (const forbidden of ['chapters', 'aiChapters', 'descriptionChapters']) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(failurePatch, forbidden),
    false,
    `clearAiAnalysisFields must not send "${forbidden}" — an analysis failure may not delete saved chapters`,
  );
}

// ─── localStorage stub (same shape the other storage QA scripts use) ────────

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;

const { saveVideos, updateStoredVideo } = await import('../src/services/videoStorage.js');

const STORAGE_KEY = 'yt_mentor_videos_v2';
const readStored = (id) => JSON.parse(storage.getItem(STORAGE_KEY)).find((video) => video.id === id);

// ─── Section A — real storage contract ──────────────────────────────────────

const CHAPTER_ONE = {
  title: 'פתיחה — מצב השוק',
  description: 'סקירת פתיחה',
  summary: 'סקירת פתיחה',
  startSeconds: 0,
  endSeconds: 180,
  timeSource: 'transcript',
  chapterSource: 'gems_analysis',
};
const CHAPTER_TWO = {
  title: 'ניתוח מדדים מובילים',
  description: 'S&P 500 ו-Nasdaq',
  summary: 'S&P 500 ו-Nasdaq',
  startSeconds: 180,
  endSeconds: 420,
  timeSource: 'transcript',
  chapterSource: 'gems_analysis',
};
const TWO_CHAPTERS = [CHAPTER_ONE, CHAPTER_TWO];

const baseVideo = (id) => ({
  id,
  url: `https://www.youtube.com/watch?v=${id}`,
  fetchedAt: '2026-09-22T08:00:00.000Z',
  title: `video ${id}`,
  analysisStatus: 'analyzed',
  analyzedAt: '2026-09-22T08:05:00.000Z',
  shortSummary: 'סיכום קצר שמור',
  fullSummary: 'סיכום מלא שמור',
  keyPoints: ['נקודה א', 'נקודה ב'],
  chapters: structuredClone(TWO_CHAPTERS),
  aiChapters: structuredClone(TWO_CHAPTERS),
  descriptionChapters: structuredClone(TWO_CHAPTERS),
  chapterSource: 'gems_analysis',
});

// 1) Seed: three records, each with 2 chapters in every chapter field.
assert.equal(
  saveVideos([baseVideo('vid-failure'), baseVideo('vid-untouched'), baseVideo('vid-negative-control')]),
  true,
  'seed write must be confirmed by the read-back inside saveVideos',
);

// 2) Apply the REAL analysis-failure patch.
const afterFailureReturn = updateStoredVideo('vid-failure', failurePatch);
assert.ok(afterFailureReturn, 'updateStoredVideo must report a persisted record');
const afterFailure = readStored('vid-failure');

// 3) Chapters survive an analysis failure — exactly as they were.
assert.deepEqual(afterFailure.chapters, TWO_CHAPTERS, 'analysis failure must not touch chapters');
assert.deepEqual(afterFailure.aiChapters, TWO_CHAPTERS, 'analysis failure must not touch aiChapters');
assert.deepEqual(afterFailure.descriptionChapters, TWO_CHAPTERS, 'analysis failure must not touch descriptionChapters');
assert.equal(afterFailure.chapterSource, 'gems_analysis', 'analysis failure must not reset chapterSource');
assert.equal(afterFailure.chapters.length, 2, 'both chapters must still be persisted');
// ...while the AI analysis fields it IS responsible for really were cleared.
assert.equal(afterFailure.shortSummary, null, 'the failure patch must clear shortSummary');
assert.equal(afterFailure.fullSummary, null, 'the failure patch must clear fullSummary');
assert.deepEqual(afterFailure.keyPoints, [], 'the failure patch must clear keyPoints');
assert.equal(afterFailure.analysisStatus, 'failed', 'the record must be marked failed');
assert.equal(afterFailure.analysisError, ANALYSIS_ERROR_MESSAGE, 'the failure reason must be persisted');

// 3b) Negative control — proves assertion (3) is load-bearing and not vacuous:
// the SAME patch plus an explicit `chapters: []` / `aiChapters: []` DOES wipe them.
// So if clearAiAnalysisFields ever sends those keys again, step (3) fails.
updateStoredVideo('vid-negative-control', { ...failurePatch, chapters: [], aiChapters: [] });
const afterNegativeControl = readStored('vid-negative-control');
assert.deepEqual(afterNegativeControl.chapters, [], 'an explicit [] must overwrite chapters (storage contract)');
assert.deepEqual(afterNegativeControl.aiChapters, [], 'an explicit [] must overwrite aiChapters (storage contract)');
assert.deepEqual(
  afterNegativeControl.descriptionChapters,
  TWO_CHAPTERS,
  'a field the patch does not mention is still preserved',
);

// 4) Intentional deletion — the "מחק היסטוריה" patch shape (commit 32dbca7).
updateStoredVideo('vid-failure', {
  transcript: null,
  transcriptStatus: 'unavailable',
  chapters: [],
  aiChapters: [],
  chapterSource: null,
  shortSummary: null,
  fullSummary: null,
  keyPoints: [],
  keyInsights: [],
  analysisStatus: 'not_analyzed',
  analysisError: null,
});
const afterClearHistory = readStored('vid-failure');

// 5) Intentional deletion still wipes chapters.
assert.deepEqual(afterClearHistory.chapters, [], '"מחק היסטוריה" must clear chapters');
assert.deepEqual(afterClearHistory.aiChapters, [], '"מחק היסטוריה" must clear aiChapters');
assert.equal(afterClearHistory.chapterSource, null, '"מחק היסטוריה" must reset chapterSource');
assert.equal(afterClearHistory.analysisStatus, 'not_analyzed', '"מחק היסטוריה" must reset analysisStatus');

// 6) A patch that does not mention chapters at all must leave them intact.
updateStoredVideo('vid-untouched', { title: 'כותרת מעודכנת', notes: 'עריכת מטא-דאטה' });
const afterMetadataEdit = readStored('vid-untouched');
assert.equal(afterMetadataEdit.title, 'כותרת מעודכנת', 'the unrelated patch must be applied');
assert.deepEqual(afterMetadataEdit.chapters, TWO_CHAPTERS, 'a chapter-less patch must not touch chapters');
assert.deepEqual(afterMetadataEdit.aiChapters, TWO_CHAPTERS, 'a chapter-less patch must not touch aiChapters');
assert.deepEqual(
  afterMetadataEdit.descriptionChapters,
  TWO_CHAPTERS,
  'a chapter-less patch must not touch descriptionChapters',
);
assert.equal(afterMetadataEdit.analysisStatus, 'analyzed', 'a metadata edit must not change analysis status');

// Unrelated records are never collateral damage.
assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 3, 'no record may be added or dropped');
assert.deepEqual(
  readStored('vid-negative-control').descriptionChapters,
  TWO_CHAPTERS,
  'later writes must leave other records intact',
);

// ─── Section B — static anchors against the real component source ───────────

const clearBodyNoComments = stripLineComments(clearBodyLiteral);
assert.doesNotMatch(
  clearBodyNoComments,
  /(^|[^A-Za-z])chapters\s*:/m,
  'clearAiAnalysisFields must not contain a "chapters:" key — failure must not delete saved chapters',
);
assert.doesNotMatch(
  clearBodyNoComments,
  /aiChapters\s*:/,
  'clearAiAnalysisFields must not contain an "aiChapters:" key',
);
assert.doesNotMatch(
  clearBodyNoComments,
  /descriptionChapters\s*:/,
  'clearAiAnalysisFields must not contain a "descriptionChapters:" key',
);

// The declaration itself uses `= (analysisError) =>`, so this regex counts CALL sites only.
const callSites = panelSource.match(/clearAiAnalysisFields\(/g) || [];
assert.equal(
  callSites.length,
  5,
  `clearAiAnalysisFields must have exactly 5 analysis-failure call sites (found ${callSites.length})`,
);

// The intentional-deletion flows must still send their own explicit empty arrays.
const CLEAR_HISTORY_DECLARATION = 'const handleDeleteTranscript = () => {';
assert.ok(panelSource.includes(CLEAR_HISTORY_DECLARATION), 'handleDeleteTranscript must exist');
const clearHistoryBody = extractBalancedBraces(
  panelSource,
  panelSource.indexOf(CLEAR_HISTORY_DECLARATION) + CLEAR_HISTORY_DECLARATION.length - 1,
  'handleDeleteTranscript body',
);
assert.match(clearHistoryBody, /transcriptStatus:\s*"unavailable"/, 'extracted the wrong block for "מחק היסטוריה"');
assert.match(clearHistoryBody, /(^|[^A-Za-z])chapters:\s*\[\s*\]/m, '"מחק היסטוריה" must still send chapters: []');
assert.match(clearHistoryBody, /aiChapters:\s*\[\s*\]/, '"מחק היסטוריה" must still send aiChapters: []');
assert.match(clearHistoryBody, /analysisStatus:\s*"not_analyzed"/, '"מחק היסטוריה" must reset analysisStatus');

// The 🧹 menu entry must keep pointing at that handler, so the block above is the live one.
assert.match(
  panelSource,
  /label: 'מחק היסטוריה',[\s\S]{0,400}?onClick: handleDeleteTranscript,/,
  'the "מחק היסטוריה" menu item must stay wired to handleDeleteTranscript',
);

const savedAnalysisDeclaration = 'const handleDeleteSavedAnalysis = () => {';
assert.ok(panelSource.includes(savedAnalysisDeclaration), 'handleDeleteSavedAnalysis must exist');
const savedAnalysisBody = extractBalancedBraces(
  panelSource,
  panelSource.indexOf(savedAnalysisDeclaration) + savedAnalysisDeclaration.length - 1,
  'handleDeleteSavedAnalysis body',
);
assert.match(savedAnalysisBody, /aiChapters:\s*\[\s*\]/, 'handleDeleteSavedAnalysis must still send aiChapters: []');
assert.match(
  savedAnalysisBody,
  /(^|[^A-Za-z])chapters:\s*\[\s*\]/m,
  'handleDeleteSavedAnalysis must still send chapters: []',
);

// The storage rule this all depends on must stay in place.
const storageSource = fs.readFileSync(new URL('../src/services/videoStorage.js', import.meta.url), 'utf8');
for (const field of ['aiChapters', 'chapters', 'descriptionChapters']) {
  assert.match(
    storageSource,
    new RegExp(`if \\(!Array\\.isArray\\(safeUpdates\\.${field}\\)\\) \\{\\s*delete safeUpdates\\.${field};`),
    `updateStoredVideo must keep stripping non-array "${field}" from a partial update`,
  );
}

console.log(
  'analysis-failure-keeps-chapters-qa: PASS ' +
  '(failure patch keeps 2 chapters, explicit [] still wipes, chapter-less patch is a no-op, 5 failure call sites)',
);
