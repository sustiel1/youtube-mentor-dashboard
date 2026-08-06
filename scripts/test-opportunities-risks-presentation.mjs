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
    countOpportunitiesAndRisks,
    rankOpportunityItems,
    rankRiskItems,
  } = await vite.ssrLoadModule('/src/lib/morningBriefPresentation.js');
  const {
    extractOpportunityIdeas,
    extractRiskItems,
  } = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const { resolveOpportunitiesAndRisks } = await vite.ssrLoadModule('/src/lib/opportunitiesRisksResolver.js');
  const { buildMorningBriefBulkSections } = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');

  assert.equal(countOpportunitiesAndRisks([], []), 0);

  const oneOpportunity = [{ title: 'Real opportunity', priority: 'medium' }];
  const twoRisks = [
    { text: 'Risk one', severity: 'high' },
    { text: 'Risk two', severity: 'low' },
  ];
  assert.deepEqual(rankOpportunityItems(oneOpportunity), oneOpportunity);
  assert.deepEqual(rankRiskItems(twoRisks), twoRisks);
  assert.equal(countOpportunitiesAndRisks(oneOpportunity, twoRisks), 3);

  const opportunities = [
    { title: 'source-first', priority: 'low', confidence: 'low' },
    { title: 'complete-high', priority: 'high', confidence: 'high', entry: 0, stop: false, target: '10' },
    { title: 'medium', priority: 'medium', confidence: 'high' },
    { title: 'high-less-complete', priority: 'high', confidence: 'high', entry: '5' },
  ];
  assert.deepEqual(
    rankOpportunityItems(opportunities).slice(0, 3).map((item) => item.title),
    ['complete-high', 'high-less-complete', 'medium'],
  );

  const risks = [
    { text: 'low', severity: 'low', affectedAssets: ['A'] },
    { text: 'critical-fewer', severity: 'critical', priority: 'medium', affectedAssets: ['A'] },
    { text: 'critical-more', severity: 'critical', priority: 'medium', affectedAssets: ['A', 'B'] },
    { text: 'high', severity: 'high', priority: 'high', affectedAssets: ['A', 'B', 'C'] },
  ];
  assert.deepEqual(
    rankRiskItems(risks).slice(0, 3).map((item) => item.text),
    ['critical-more', 'critical-fewer', 'high'],
  );

  const normalizedOpportunities = extractOpportunityIdeas({
    tradingOpportunities: [{
      ticker: 'ZERO',
      setup: 'Zero-safe setup',
      entry: 0,
      stop: false,
      confidence: 'high',
      priority: 'critical',
    }],
  });
  assert.equal(normalizedOpportunities[0].entry, '0');
  assert.equal(normalizedOpportunities[0].stop, 'false');
  assert.equal(normalizedOpportunities[0].priority, 'critical');

  const normalizedRisks = extractRiskItems({
    risks: [{
      risk: 'Evidence risk',
      severity: 'high',
      priority: 'medium',
      affectedAssets: ['SPX', 'NASDAQ'],
    }],
  });
  assert.equal(normalizedRisks[0].severity, 'high');
  assert.deepEqual(normalizedRisks[0].affectedAssets, ['SPX', 'NASDAQ']);

  const exportPayload = {
    tradingOpportunities: opportunities.map((item) => ({ setup: item.title, ...item })),
    risks,
  };
  const exportSections = buildMorningBriefBulkSections({}, exportPayload);
  assert.equal(exportSections.find((section) => section.key === 'opportunities').items.length, 3);
  assert.equal(exportSections.find((section) => section.key === 'risks').items.length, 3);
  assert.equal(countOpportunitiesAndRisks(opportunities, risks), 8);

  const suppliedFixture = {
    tradingOpportunities: [],
    risks: [
      { risk: 'שחיקת הון בקרן ממונפת SOXL', affectedAssets: ['SOXL'], severity: 'high' },
      { risk: 'פרסומות הונאה וקמפיינים של התחזות ברשתות', severity: 'high' },
    ],
    universalTabs: {
      summary: {
        keyOpportunities: [
          'טכנולוגיה ותוכנה הנהנות מהשקעות AI',
          'תגובות חיוביות לאחר דוחות חזקים, כולל GRMN ו-3M',
        ],
        importantWarnings: [
          'אזהרת התחזות והונאה ברשתות',
          'סיכון אירועי דוחות בחברות META ו-MSFT',
          'סיכון בקרן סקטור ממונפת SOXL',
        ],
      },
      insights: ['תובנה חיובית שאינה הזדמנות מפורשת'],
    },
  };
  const resolved = resolveOpportunitiesAndRisks(suppliedFixture, {});
  assert.equal(resolved.opportunities.length, 2);
  assert.equal(resolved.risks.length, 3);
  assert.ok(resolved.opportunities.every((item) => item.isFallback && item.kindLabel === 'למעקב'));
  assert.ok(resolved.opportunities.every((item) => item.sourcePath === 'marketBriefData.universalTabs.summary.keyOpportunities'));
  assert.ok(resolved.opportunities.every((item) => !item.entry && !item.stop && !item.target));
  assert.deepEqual(resolved.risks.map((item) => item.sourceType), ['structured', 'structured', 'summary-fallback']);
  assert.equal(resolved.diagnostics.riskItems.filter((item) => item.status === 'duplicate-of-structured-item').length, 2);
  assert.equal(resolved.diagnostics.opportunityItems.filter((item) => item.status.startsWith('displayed-')).length, 2);
  assert.ok(resolved.diagnostics.riskItems.some((item) => item.status === 'displayed-summary-fallback'));

  const fallbackBulk = buildMorningBriefBulkSections({}, suppliedFixture);
  assert.equal(fallbackBulk.find((section) => section.key === 'opportunities').items.length, 2);
  assert.equal(fallbackBulk.find((section) => section.key === 'risks').items.length, 3);

  for (const count of [0, 1, 2, 3, 4]) {
    const payload = { tradingOpportunities: Array.from({ length: count }, (_, index) => `Opportunity ${index}`) };
    assert.equal(resolveOpportunitiesAndRisks(payload).opportunities.length, Math.min(count, 3));
  }
  const legacyFallback = resolveOpportunitiesAndRisks({ summary: { keyOpportunities: ['Legacy explicit opportunity'] } });
  assert.equal(legacyFallback.opportunities[0].sourcePath, 'marketBriefData.summary.keyOpportunities');

  const panelsSource = fs.readFileSync(
    new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
    'utf8',
  );
  const emptyCardSource = fs.readFileSync(
    new URL('../src/components/dashboard/MacroStyleInsightCards.jsx', import.meta.url),
    'utf8',
  );
  assert.match(panelsSource, /return \[oppBlock, riskBlock\]/);
  assert.ok(panelsSource.indexOf('const oppBlock') < panelsSource.indexOf('const riskBlock'));
  assert.match(panelsSource, /adaptiveInsightGridClass/);
  assert.match(panelsSource, /itemCount === 2/);
  assert.match(panelsSource, /max-w-2xl/);
  assert.doesNotMatch(panelsSource, /risksFirst/);
  assert.match(emptyCardSource, /לא נמצאה הזדמנות נוספת/);
  assert.match(emptyCardSource, /לא נמצא סיכון נוסף/);
  assert.doesNotMatch(emptyCardSource, /aria-hidden/);
  assert.doesNotMatch(panelsSource, /MacroStyleEmptyInsightCard/);
  assert.doesNotMatch(panelsSource, /padInsightSlots/);
  assert.match(panelsSource, /לא נמצאו הזדמנויות מבוססות־ראיות/);
  assert.match(panelsSource, /לא נמצאו סיכונים מבוססי־ראיות/);

  console.log(JSON.stringify({
    status: 'passed',
    cases: 27,
    suppliedFixture: { opportunities: 2, risks: 3 },
    exportedRealItems: 6,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
