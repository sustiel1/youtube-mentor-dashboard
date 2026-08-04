import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const lateNightFixture = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', 'g3a-late-night-nested.json'),
  'utf8',
));

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const diagnostics = await vite.ssrLoadModule('/src/lib/aiMappingDiagnostics.js');
  const specialized = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const knowledge = await vite.ssrLoadModule('/src/lib/videoKnowledgePackage.js');
  const obsidian = await vite.ssrLoadModule('/src/lib/obsidianVideoMergeItems.js');

  const tabKeys = [
    'summary',
    'chapters',
    'insights',
    'useful-knowledge',
    'app-builder',
    'topics-subtopics',
    'specialized',
  ];
  const sections = specialized.buildMorningBriefBulkSections({}, lateNightFixture);
  const renderedSpecializedItems = sections.flatMap((section) => section.items);
  const coverage = diagnostics.buildAiMappingCoverage({
    video: {},
    marketBriefData: lateNightFixture,
    normalizedSubCategory: 'evening-brief',
    tabKeys,
  });
  assert.equal(
    coverage.tabCounts.specialized,
    renderedSpecializedItems.length,
    'AI Mapping Specialized count must use the renderer selector',
  );
  assert.equal(
    coverage.totalItems,
    Object.values(coverage.tabCounts).reduce((sum, count) => sum + count, 0),
    'total rendered count must be the sum of canonical tab counts',
  );

  const packageSpecializedCount = knowledge.collectVideoKnowledgePackage({
    marketBriefData: lateNightFixture,
  }).sections.find((section) => section.key === 'specialized')?.count;
  assert.equal(packageSpecializedCount, renderedSpecializedItems.length, 'renderer/count package parity');

  const exportedTexts = new Set(obsidian.collectVideoObsidianMergeItems({
    effectiveVideo: { id: 'ai-mapping-parity' },
    marketBriefData: lateNightFixture,
  }).map((item) => item.text));
  for (const text of renderedSpecializedItems) {
    assert.ok(exportedTexts.has(String(text)), `renderer/export parity missing: ${text}`);
  }

  const learningFieldToTab = {
    definitions: 'definitions',
    actionItems: 'useful-knowledge',
  };
  const briefFieldToTab = {
    universalTabs: 'summary',
    marketNews: 'market-news',
    sentiment: 'brief-sentiment',
    risks: 'brief-risks',
  };
  assert.equal(diagnostics.countActiveMappedFields({
    video: { definitions: ['מונח'], actionItems: false },
    marketBriefData: {
      universalTabs: { summary: ['סיכום'] },
      marketNews: ['חדשות'],
      sentiment: false,
      risks: 0,
    },
    learningFieldToTab,
    briefFieldToTab,
  }), 6, 'active-field count must preserve false and zero');

  assert.deepEqual(
    diagnostics.buildExcludedItemDiagnostics({
      video: {},
      marketBriefData: null,
      learningFieldToTab,
      briefFieldToTab,
    }),
    [],
    'empty diagnostic state',
  );

  const secretValue = 'super-secret-value-that-must-not-leak';
  const transcriptValue = 'full transcript content that must never appear';
  const excluded = diagnostics.buildExcludedItemDiagnostics({
    video: {
      transcript: transcriptValue,
      apiToken: secretValue,
    },
    marketBriefData: {
      contentType: 'marketBrief',
      universalTabs: { summary: ['סיכום קנוני'], specialized: {} },
      shortSummary: 'סיכום fallback',
      extractionMeta: { provider: 'gems', generatedAt: '2026-08-04T00:00:00Z' },
      analystNotes: { deskView: 'א'.repeat(240) },
      zeroMetric: 0,
      falseFlag: false,
      providerPayload: { raw: secretValue },
    },
    learningFieldToTab,
    briefFieldToTab,
  });

  assert.ok(excluded.length > 0, 'populated diagnostic state');
  assert.ok(excluded.every((entry) => entry.sourcePath && entry.reasonHe));
  assert.ok(excluded.every((entry) => /[\u0590-\u05FF]/.test(entry.reasonHe)), 'all reasons are Hebrew');
  assert.ok(excluded.every((entry) => entry.preview.length <= diagnostics.AI_MAPPING_PREVIEW_LIMIT));
  assert.doesNotMatch(JSON.stringify(excluded), new RegExp(secretValue));
  assert.doesNotMatch(JSON.stringify(excluded), /full transcript content/);
  assert.doesNotMatch(JSON.stringify(excluded), /apiToken|providerPayload/);

  const transcriptEntry = excluded.find((entry) => entry.sourcePath === 'video.transcript');
  assert.equal(transcriptEntry?.preview, '[תמלול הוסתר]');
  assert.equal(transcriptEntry?.destinationTab, 'transcript');
  assert.equal(transcriptEntry?.displayedElsewhere, true);

  const fallbackEntry = excluded.find((entry) => entry.sourcePath === 'marketBriefData.shortSummary');
  assert.equal(fallbackEntry?.destinationTab, 'summary');
  assert.equal(fallbackEntry?.displayedElsewhere, true);
  assert.equal(fallbackEntry?.actionRequired, false);

  const longPreview = excluded.find((entry) => entry.sourcePath.endsWith('analystNotes.deskView'))?.preview;
  assert.equal(longPreview?.length, diagnostics.AI_MAPPING_PREVIEW_LIMIT);
  assert.ok(longPreview?.endsWith('…'));
  assert.equal(excluded.find((entry) => entry.sourcePath.endsWith('zeroMetric'))?.preview, '0');
  assert.equal(excluded.find((entry) => entry.sourcePath.endsWith('falseFlag'))?.preview, 'false');
  assert.equal(excluded.find((entry) => entry.sourcePath.endsWith('zeroMetric'))?.actionRequired, true);

  const modalSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'AiMappingModal.jsx'),
    'utf8',
  );
  assert.match(modalSource, /data-testid="active-field-count"/);
  assert.match(modalSource, /data-testid="total-rendered-item-count"/);
  assert.match(modalSource, /specialized-rendered-count/);
  assert.match(modalSource, /data-testid="excluded-items-section"/);
  assert.match(modalSource, /data-testid="excluded-items-empty"/);
  assert.match(modalSource, /data-testid="excluded-item-row"/);
  assert.match(modalSource, /data-testid="excluded-item-card"/);
  assert.match(modalSource, /resolveAiMappingTab/);

  console.log(JSON.stringify({
    status: 'passed',
    activeFields: 6,
    totalItems: coverage.totalItems,
    specializedItems: coverage.tabCounts.specialized,
    excludedItems: excluded.length,
    previewLimit: diagnostics.AI_MAPPING_PREVIEW_LIMIT,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
