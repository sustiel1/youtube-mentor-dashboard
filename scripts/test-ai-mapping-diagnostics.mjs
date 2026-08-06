import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    getAnalysisDiagnosticStatus,
    resolveDiagnosticTab,
  } = await vite.ssrLoadModule('/src/lib/aiMappingDiagnosticContract.js');
  const { extractVideoTabItems } = await vite.ssrLoadModule('/src/config/videoTabsConfig.js');
  const { buildMorningBriefBulkSections } = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');

  const universalPayload = {
    contentType: 'marketBrief',
    universalTabs: {
      summary: ['s1', 's2', 's3', 's4', 's5'],
      chapters: Array.from({ length: 5 }, (_, i) => ({ title: `פרק ${i + 1}`, summary: `סיכום ${i + 1}` })),
      insights: ['i1', 'i2', 'i3', 'i4', 'i5'],
      usefulKnowledge: ['u1', 'u2'],
      appBuilder: {
        kpiList: ['k1', 'k2', 'k3'],
        dashboards: ['d1', 'd2', 'd3'],
        prompts: ['p1', 'p2', 'p3'],
        alerts: ['a1', 'a2'],
        suggestedFeatures: ['f1', 'f2', 'f3'],
      },
      topicsSubtopics: ['t1', 't2', 't3', 't4', 't5', 't6'],
      specialized: {},
    },
    marketNews: ['n1', 'n2', 'n3'],
    indices: [{ asset: 'SPX', change: '1%' }],
    sectorRotation: [{ sector: 'Software', direction: 'into' }],
    economicCalendar: [{ event: 'CPI', sourceRelativeText: 'tomorrow' }],
    sentiment: [{ label: 'Market', value: 'mixed' }],
    risks: [{ risk: 'r1' }],
    stocksMentioned: [{ ticker: 'NVDA', reason: 'mentioned' }],
  };
  const video = { analysisProvider: 'gems' };

  const expectedCounts = {
    summary: 5,
    chapters: 5,
    insights: 5,
    'useful-knowledge': 2,
    'app-builder': 14,
    'topics-subtopics': 6,
  };
  for (const [tabKey, expected] of Object.entries(expectedCounts)) {
    const diagnostic = resolveDiagnosticTab({ video, marketBriefData: universalPayload, tabKey });
    assert.equal(diagnostic.items, expected, `${tabKey} diagnostic count`);
    assert.equal(
      diagnostic.items,
      extractVideoTabItems(video, tabKey, universalPayload).length,
      `${tabKey} diagnostic/renderer count parity`,
    );
    assert.ok(
      diagnostic.matchedSourcePaths.some((path) => path.startsWith(`marketBriefData.universalTabs.`)),
      `${tabKey} must attribute universalTabs source`,
    );
  }

  const chapters = resolveDiagnosticTab({ video, marketBriefData: universalPayload, tabKey: 'chapters' });
  assert.equal(chapters.items, 5, 'semantic chapters without timestamps remain visible');

  const specialized = resolveDiagnosticTab({ video, marketBriefData: universalPayload, tabKey: 'specialized' });
  const renderedSpecializedCount = buildMorningBriefBulkSections(video, universalPayload)
    .reduce((sum, section) => sum + section.items.length, 0);
  assert.equal(specialized.items, renderedSpecializedCount, 'Specialized diagnostic/renderer count parity');
  assert.ok(specialized.matchedSourcePaths.includes('marketBriefData.sentiment'));
  assert.ok(specialized.matchedSourcePaths.includes('marketBriefData.economicCalendar'));

  assert.deepEqual(
    getAnalysisDiagnosticStatus({ provider: 'gems', marketBriefData: universalPayload, canonical: false }),
    {
      canonicalClaude: false,
      gemsImport: true,
      fallbackOnly: false,
      anyAnalysisData: true,
      status: 'GEMS JSON נטען בהצלחה',
      contentStatus: 'קיים תוכן מובנה',
    },
  );
  assert.equal(
    getAnalysisDiagnosticStatus({
      provider: 'claude',
      marketBriefData: { contentType: 'marketBrief', extractionMeta: {} },
      canonical: true,
    }).status,
    'ניתוח Claude קנוני הושלם',
  );
  assert.equal(
    getAnalysisDiagnosticStatus({
      provider: null,
      marketBriefData: { top5Insights: ['legacy'] },
      canonical: false,
    }).status,
    'קיים fallback חלקי בלבד',
  );
  assert.equal(
    getAnalysisDiagnosticStatus({ provider: null, marketBriefData: null, canonical: false }).status,
    'אין נתוני ניתוח',
  );

  console.log(JSON.stringify({
    status: 'passed',
    universalTabs: 7,
    specializedCount: specialized.items,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
