import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    normalizeConclusionText,
    resolveSummaryConclusion,
  } = await vite.ssrLoadModule('/src/lib/summaryConclusionResolver.js');
  const { extractVideoTabItems } = await vite.ssrLoadModule('/src/config/videoTabsConfig.js');
  const { extractUniversalTabContent } = await vite.ssrLoadModule('/src/lib/universalTabSections.js');
  const { buildDailyBriefingView } = await vite.ssrLoadModule('/src/lib/summaryBriefingDisplay.js');
  const {
    buildStructuredCoverageInventory,
    getAnalysisCoverageSummary,
  } = await vite.ssrLoadModule('/src/lib/aiMappingDiagnosticContract.js');

  const canonicalPayload = {
    universalTabs: { summary: { mainConclusion: 'מסקנה קנונית.' } },
  };
  assert.deepEqual(
    resolveSummaryConclusion({ marketBriefData: canonicalPayload }),
    {
      text: 'מסקנה קנונית.',
      sourcePath: 'marketBriefData.universalTabs.summary.mainConclusion',
      fallbackPath: '',
      fallbackStatus: 'absent',
      duplicateOf: '',
    },
  );

  const payloadFallback = {
    universalTabs: { summary: ['סיכום קיים'] },
    mainLesson: 'לקח מרכזי חדש',
  };
  assert.equal(
    resolveSummaryConclusion({ marketBriefData: payloadFallback }).sourcePath,
    'marketBriefData.mainLesson',
  );
  assert.deepEqual(
    extractVideoTabItems({}, 'summary', payloadFallback),
    ['סיכום קיים', 'לקח מרכזי חדש'],
  );
  const shapedFallback = extractUniversalTabContent({}, 'summary', payloadFallback);
  assert.equal(shapedFallback.mode, 'sections');
  assert.equal(shapedFallback.sections.at(-1).label, 'מסקנה מרכזית');
  assert.deepEqual(shapedFallback.sections.at(-1).items, ['לקח מרכזי חדש']);

  const legacy = resolveSummaryConclusion({ video: { mainLesson: 'לקח legacy' } });
  assert.equal(legacy.sourcePath, 'video.mainLesson');
  assert.deepEqual(
    extractUniversalTabContent({ mainLesson: 'לקח legacy' }, 'summary', null),
    {
      mode: 'sections',
      sections: [{ key: 'mainConclusion', label: 'מסקנה מרכזית', items: ['לקח legacy'] }],
    },
  );

  const identicalCanonical = {
    universalTabs: { summary: { mainConclusion: 'אותה מסקנה!' } },
    mainLesson: '  אותה   מסקנה ',
  };
  const identicalResolution = resolveSummaryConclusion({ marketBriefData: identicalCanonical });
  assert.equal(identicalResolution.fallbackStatus, 'duplicate');
  assert.equal(extractVideoTabItems({}, 'summary', identicalCanonical).length, 1);
  assert.equal(normalizeConclusionText('אותה מסקנה!'), normalizeConclusionText(' אותה   מסקנה '));

  const differentCanonical = {
    universalTabs: { summary: { mainConclusion: 'מסקנה קנונית' } },
    mainLesson: 'לקח שונה',
  };
  const differentResolution = resolveSummaryConclusion({ marketBriefData: differentCanonical });
  assert.equal(differentResolution.text, 'מסקנה קנונית');
  assert.equal(differentResolution.fallbackStatus, 'shadowed');
  assert.equal(
    extractVideoTabItems({}, 'summary', differentCanonical).length,
    extractVideoTabItems({}, 'summary', {
      universalTabs: differentCanonical.universalTabs,
    }).length,
    'a shadowed fallback does not inflate the visible count',
  );

  for (const [fieldPath, payload] of [
    ['topTakeaways', {
      universalTabs: { summary: { topTakeaways: ['לקח כפול'] } },
      mainLesson: 'לקח כפול.',
    }],
    ['learningInsights', {
      universalTabs: { summary: [], insights: { learningInsights: ['לקח כפול'] } },
      mainLesson: 'לקח כפול',
    }],
    ['reusableKnowledge', {
      universalTabs: { summary: [], usefulKnowledge: { reusableKnowledge: ['לקח כפול'] } },
      mainLesson: 'לקח כפול',
    }],
  ]) {
    const resolution = resolveSummaryConclusion({ marketBriefData: payload });
    assert.equal(resolution.text, '', `${fieldPath} duplicate is not displayed`);
    assert.equal(resolution.fallbackStatus, 'duplicate');
  }

  assert.equal(resolveSummaryConclusion({ marketBriefData: { mainLesson: '' } }).text, '');
  assert.equal(resolveSummaryConclusion({ marketBriefData: { mainLesson: '   ' } }).text, '');

  const existingStoredPayload = structuredClone(payloadFallback);
  extractVideoTabItems({}, 'summary', existingStoredPayload);
  assert.deepEqual(existingStoredPayload, payloadFallback, 'read-time resolution does not migrate storage');

  assert.equal(
    resolveSummaryConclusion({
      marketBriefData: {
        universalTabs: { summary: { mainConclusion: 'AI canonical' } },
        mainLesson: 'GEMS fallback',
      },
    }).text,
    'AI canonical',
  );

  const mappedInventory = buildStructuredCoverageInventory({
    marketBriefData: payloadFallback,
  });
  assert.ok(mappedInventory.mapped.some((entry) => (
    entry.path === 'marketBriefData.mainLesson'
    && entry.destination === 'summary / mainConclusion'
  )));
  assert.equal(
    mappedInventory.unmappedMeaningful.some((entry) => entry.path === 'marketBriefData.mainLesson'),
    false,
  );

  const duplicateInventory = buildStructuredCoverageInventory({
    marketBriefData: identicalCanonical,
  });
  assert.ok(duplicateInventory.duplicateFallback.some((entry) => entry.path === 'marketBriefData.mainLesson'));

  const shadowedInventory = buildStructuredCoverageInventory({
    marketBriefData: differentCanonical,
  });
  assert.ok(shadowedInventory.excludedByDesign.some((entry) => (
    entry.path === 'marketBriefData.mainLesson'
    && entry.destination === 'summary / mainConclusion'
  )));
  assert.equal(
    shadowedInventory.unmappedMeaningful.some((entry) => entry.path === 'marketBriefData.mainLesson'),
    false,
  );

  const canonicalCoverage = getAnalysisCoverageSummary({
    video: { analysisProvider: 'claude' },
    marketBriefData: identicalCanonical,
    canonical: true,
  });
  assert.equal(canonicalCoverage.tabCounts.summary, 1);

  const briefing = buildDailyBriefingView({
    marketBriefData: payloadFallback,
    summaryShaped: shapedFallback,
  });
  assert.deepEqual(briefing.executiveConclusion, ['לקח מרכזי חדש']);

  console.log(JSON.stringify({
    status: 'passed',
    cases: 18,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
