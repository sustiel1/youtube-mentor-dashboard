import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    buildStructuredCoverageInventory,
    getAnalysisCoverageSummary,
  } = await vite.ssrLoadModule('/src/lib/aiMappingDiagnosticContract.js');

  const rows = (count, factory) => Array.from({ length: count }, (_, index) => factory(index));
  const gemsPayload = {
    contentType: 'marketBrief',
    universalTabs: {
      summary: rows(5, (i) => `summary-${i}`),
      chapters: rows(5, (i) => ({ title: `chapter-${i}`, summary: `semantic-${i}` })),
      insights: rows(5, (i) => `insight-${i}`),
      usefulKnowledge: rows(2, (i) => `knowledge-${i}`),
      appBuilder: {
        kpiList: rows(3, (i) => `kpi-${i}`),
        dashboards: rows(3, (i) => `dashboard-${i}`),
        prompts: rows(3, (i) => `prompt-${i}`),
        alerts: rows(2, (i) => `alert-${i}`),
        suggestedFeatures: rows(3, (i) => `feature-${i}`),
      },
      topicsSubtopics: rows(6, (i) => `topic-${i}`),
      specialized: {},
    },
    marketNews: rows(7, (i) => `news-${i}`),
    indices: rows(5, (i) => ({ asset: `INDEX${i}`, change: `${i}%` })),
    sectorRotation: rows(2, (i) => ({ sector: `sector-${i}`, direction: 'into' })),
    economicCalendar: rows(2, (i) => ({ event: `event-${i}` })),
    sentiment: rows(2, (i) => ({ label: `sentiment-${i}`, value: 'mixed' })),
    risks: rows(2, (i) => ({ risk: `risk-${i}` })),
    stocksMentioned: rows(2, (i) => ({ ticker: `STK${i}`, reason: 'mentioned' })),
    macroFactors: rows(2, (i) => ({ indicator: `macro-${i}`, value: `${i}` })),
    tradingOpportunities: rows(2, (i) => ({ asset: `OPP${i}`, setup: 'breakout' })),
    catalysts: rows(2, (i) => ({ title: `catalyst-${i}` })),
    keyLevels: rows(2, (i) => ({ asset: `LEVEL${i}`, level: `${i}` })),
    watchlistLevels: rows(2, (i) => ({ ticker: `WATCH${i}`, level: `${i}` })),
  };

  const gemsVideo = { analysisSource: 'gems', analysisExists: false };
  const gems = getAnalysisCoverageSummary({ video: gemsVideo, marketBriefData: gemsPayload });
  assert.equal(gems.activeFields, 12);
  assert.equal(gems.tabCounts.summary, 5);
  assert.equal(gems.tabCounts.chapters, 5);
  assert.equal(gems.tabCounts.insights, 5);
  assert.equal(gems.tabCounts['useful-knowledge'], 2);
  assert.equal(gems.tabCounts['app-builder'], 14);
  assert.equal(gems.tabCounts['topics-subtopics'], 6);
  assert.equal(gems.tabCounts.specialized, 30);
  assert.equal(gems.totalItems, 67);
  assert.equal(gems.sourceLabel, 'GEMS');
  assert.equal(gems.hasStructuredContent, true);

  const currentVideoPayload = {
    ...gemsPayload,
    marketNews: rows(13, (i) => `current-news-${i}`),
  };
  delete currentVideoPayload.watchlistLevels;
  const currentVideoCoverage = getAnalysisCoverageSummary({
    video: gemsVideo,
    marketBriefData: currentVideoPayload,
  });
  assert.equal(currentVideoCoverage.activeFields, 11);
  assert.equal(currentVideoCoverage.tabCounts.specialized, 34);
  assert.equal(currentVideoCoverage.totalItems, 71);

  const authoritativeSpecializedPayload = {
    ...currentVideoPayload,
    universalTabs: {
      ...currentVideoPayload.universalTabs,
      summary: rows(6, (i) => `resolved-summary-${i}`),
      chapters: rows(6, (i) => ({ title: `resolved-chapter-${i}`, summary: `semantic-${i}` })),
    },
    allPoints: rows(16, (i) => ({ point: `resolved-specialized-${i}`, category: 'market' })),
  };
  const authoritativeCoverage = getAnalysisCoverageSummary({
    video: gemsVideo,
    marketBriefData: authoritativeSpecializedPayload,
  });
  assert.equal(authoritativeCoverage.activeFields, 11);
  assert.deepEqual(authoritativeCoverage.tabCounts, {
    summary: 6,
    chapters: 6,
    insights: 5,
    'useful-knowledge': 2,
    'app-builder': 14,
    'topics-subtopics': 6,
    specialized: 50,
  });
  assert.equal(authoritativeCoverage.totalItems, 89);
  assert.equal(authoritativeCoverage.sourceLabel, 'GEMS');

  const duplicateFallback = {
    ...gemsPayload,
    shortSummary: 'legacy duplicate',
  };
  assert.equal(
    getAnalysisCoverageSummary({ video: gemsVideo, marketBriefData: duplicateFallback }).totalItems,
    67,
    'universalTabs precedence prevents fallback double counting',
  );

  const canonical = getAnalysisCoverageSummary({
    video: { analysisProvider: 'claude' },
    marketBriefData: gemsPayload,
    canonical: true,
  });
  assert.equal(canonical.sourceLabel, 'AI');

  const legacy = getAnalysisCoverageSummary({
    video: {},
    marketBriefData: { marketNews: ['legacy'] },
  });
  assert.equal(legacy.sourceType, 'Partial');
  assert.equal(legacy.sourceLabel, 'נתונים חלקיים');
  assert.equal(legacy.hasStructuredContent, true);

  const legacyVideo = getAnalysisCoverageSummary({
    video: { shortSummary: 'legacy video summary' },
  });
  assert.equal(legacyVideo.sourceType, 'Legacy');
  assert.equal(legacyVideo.hasStructuredContent, true);

  const transcriptOnly = getAnalysisCoverageSummary({ video: { transcript: 'transcript only' } });
  assert.equal(transcriptOnly.hasTranscript, true);
  assert.equal(transcriptOnly.hasStructuredContent, false);

  const empty = getAnalysisCoverageSummary({ video: {} });
  assert.equal(empty.hasTranscript, false);
  assert.equal(empty.hasStructuredContent, false);

  const beforeImport = getAnalysisCoverageSummary({ video: gemsVideo });
  const afterImport = getAnalysisCoverageSummary({ video: gemsVideo, marketBriefData: gemsPayload });
  assert.equal(beforeImport.totalItems, 0);
  assert.equal(afterImport.totalItems, 67);

  const fullyMappedInventory = buildStructuredCoverageInventory({
    video: gemsVideo,
    marketBriefData: gemsPayload,
  });
  assert.equal(fullyMappedInventory.unmappedMeaningful.length, 0);
  assert.equal(fullyMappedInventory.unsupported.length, 0);
  assert.equal(fullyMappedInventory.transcriptCoverageStatus, 'not-compared');

  const diagnosticInventory = buildStructuredCoverageInventory({
    video: { transcript: 'full transcript must never appear in the report' },
    marketBriefData: {
      contentType: 'marketBrief',
      universalTabs: {
        summary: ['preferred summary'],
        experimentalPanel: ['unknown universal content'],
      },
      shortSummary: 'duplicate summary',
      analystNotes: {
        deskView: 'nested meaningful unknown',
      },
      extractionMeta: { partial: false },
      emptyField: '',
      largeUnknown: 'x'.repeat(300),
    },
  });
  assert.ok(diagnosticInventory.duplicateFallback.some((entry) => entry.path.endsWith('.shortSummary')));
  assert.ok(diagnosticInventory.excludedByDesign.some((entry) => entry.path.includes('.extractionMeta.')));
  assert.ok(diagnosticInventory.invalid.some((entry) => entry.path.endsWith('.emptyField')));
  assert.ok(diagnosticInventory.unmappedMeaningful.some((entry) => entry.path.endsWith('.analystNotes.deskView')));
  assert.ok(diagnosticInventory.unsupported.some((entry) => entry.path.endsWith('.universalTabs.experimentalPanel')));
  const largePreview = diagnosticInventory.unmappedMeaningful.find((entry) => entry.path.endsWith('.largeUnknown'))?.preview;
  assert.ok(largePreview?.endsWith('…'));
  assert.ok(largePreview.length <= 120);
  const transcriptEntry = diagnosticInventory.excludedByDesign.find((entry) => entry.path === 'video.transcript');
  assert.ok(transcriptEntry);
  assert.doesNotMatch(transcriptEntry.preview, /full transcript/);
  assert.ok(diagnosticInventory.excludedByDesign.every((entry) => entry.reasonCode));
  assert.ok(diagnosticInventory.excludedByDesign.every((entry) => entry.reasonHe));
  assert.ok(diagnosticInventory.excludedByDesign.every((entry) => entry.destinationLabelHe));
  assert.ok(diagnosticInventory.excludedByDesign.every((entry) => entry.recommendedActionHe));
  assert.ok(diagnosticInventory.excludedByDesign.every((entry) => entry.preview.length <= 120));
  assert.equal(transcriptEntry.reasonCode, 'diagnostic-only');
  assert.equal(transcriptEntry.renderedElsewhere, true);

  const threeExclusions = buildStructuredCoverageInventory({
    marketBriefData: {
      contentType: 'marketBrief',
      extractionMeta: {
        provider: 'gems',
        generatedAt: '2026-07-29T08:00:00Z',
      },
    },
  });
  assert.equal(threeExclusions.excludedByDesign.length, 3);
  assert.deepEqual(
    threeExclusions.excludedByDesign.map((entry) => entry.path),
    [
      'marketBriefData.contentType',
      'marketBriefData.extractionMeta.provider',
      'marketBriefData.extractionMeta.generatedAt',
    ],
  );
  assert.ok(threeExclusions.excludedByDesign.every((entry) => entry.actionRequired === false));
  assert.equal(threeExclusions.invalid.length, 0);

  const panel = fs.readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
  const modal = fs.readFileSync(new URL('../src/components/dashboard/AiMappingModal.jsx', import.meta.url), 'utf8');
  assert.match(panel, /data-testid="analysis-coverage-summary"/);
  assert.match(panel, /dir="rtl"/);
  assert.match(panel, /role="status"/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /aria-label=/);
  assert.match(panel, /border-slate-200 bg-white/);
  assert.match(panel, /text-slate-900/);
  assert.match(panel, /cursor-default/);
  const coverageElementStart = panel.lastIndexOf('<div', panel.indexOf('data-testid="analysis-coverage-summary"'));
  const coverageElementEnd = panel.indexOf('</div>', panel.indexOf('data-testid="analysis-coverage-summary"'));
  const coverageElementSource = panel.slice(coverageElementStart, coverageElementEnd);
  assert.doesNotMatch(coverageElementSource, /onClick=|role="button"|cursor-pointer|hover:/);
  assert.ok(
    panel.indexOf('<span>AI Mapping</span>') < panel.indexOf('data-testid="analysis-coverage-summary"'),
    'AI Mapping must precede the passive coverage summary in DOM order',
  );
  assert.match(panel, /טרם נוצר תוכן מובנה/);
  assert.match(panel, /flex-wrap/);
  assert.match(panel, /onClick=\{\(\) => setShowAiMapping\(true\)\}/);
  assert.match(panel, /getAnalysisCoverageSummary/);
  assert.match(modal, /getAnalysisCoverageSummary/);
  assert.match(
    modal,
    /resolveDiagnosticTab\(\{ video: v, marketBriefData, tabKey: tab\.value \}\)/,
    'Tab Mapping must use the authoritative diagnostic selector',
  );
  assert.match(modal, /data-testid="unmapped-content-summary"/);
  assert.match(modal, /data-testid="user-facing-tab-mapping" className="-order-2"/);
  assert.match(modal, /data-testid="unmapped-content-summary" className="-order-1"/);
  assert.match(modal, /data-testid="technical-video-classification" className="order-0"/);
  assert.match(modal, /data-testid="technical-diagnostics-heading" className="[^"]*\border-0\b[^"]*"/);
  assert.match(modal, /פרטי אבחון טכניים/);
  assert.equal((modal.match(/data-testid="user-facing-tab-mapping"/g) || []).length, 1);
  assert.equal((modal.match(/data-testid="unmapped-content-summary"/g) || []).length, 1);
  assert.equal((modal.match(/data-testid="technical-diagnostics-heading"/g) || []).length, 1);
  assert.match(modal, /data-testid="excluded-by-design-details"/);
  assert.match(modal, /data-testid="excluded-by-design-row"/);
  assert.match(modal, /data-testid="excluded-by-design-card"/);
  assert.match(modal, /excludedEntries\.map/);
  assert.match(modal, /אין פריטים שהוחרגו/);
  assert.doesNotMatch(modal, /showExcluded|setShowExcluded|accordion|collapse/i);
  assert.match(modal, /לא בוצעה השוואה סמנטית מלאה מול התמלול/);

  console.log(JSON.stringify({
    status: 'passed',
    activeFields: gems.activeFields,
    totalItems: gems.totalItems,
    currentVideoActiveFields: currentVideoCoverage.activeFields,
    currentVideoTotalItems: currentVideoCoverage.totalItems,
    tabCounts: gems.tabCounts,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
