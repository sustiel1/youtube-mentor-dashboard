import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    parseMacroDisplayItem,
  } = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const {
    cleanupMacroDisplayRows,
    getMacroImportanceDisplay,
  } = await vite.ssrLoadModule('/src/lib/macroDisplayCleanup.js');
  const {
    getMacroFieldDisplay,
  } = await vite.ssrLoadModule('/src/lib/morningBriefVisuals.js');
  const {
    buildStructuredCoverageInventory,
  } = await vite.ssrLoadModule('/src/lib/aiMappingDiagnosticContract.js');

  const raw = {
    name: 'interest rates',
    impact: 35,
    priority: 'high',
  };
  const rawBefore = structuredClone(raw);
  const normalized = parseMacroDisplayItem(raw);
  const [visible] = cleanupMacroDisplayRows([normalized]);

  assert.deepEqual(raw, rawBefore);
  assert.equal(normalized.impact, '35');
  assert.equal(normalized.importance, 'high');
  assert.equal(visible.impact, '');
  assert.equal(getMacroImportanceDisplay(visible.importance), 'חשיבות: גבוהה');
  assert.equal(getMacroFieldDisplay('35', visible), null);

  const verifiedProbability = parseMacroDisplayItem({
    name: 'Fed rate expectations',
    probabilityPercent: 35,
    priority: 'high',
  });
  assert.equal(verifiedProbability.probability, 'הסתברות: 35%');
  assert.equal(verifiedProbability.change, '');

  const verifiedMarketChange = parseMacroDisplayItem({
    name: 'CPI',
    changePercent: -0.3,
  });
  assert.equal(verifiedMarketChange.change, '-0.3%');

  const inventory = buildStructuredCoverageInventory({
    marketBriefData: {
      contentType: 'marketBrief',
      rawData: {
        macroFactors: [raw],
      },
    },
  });
  const issue = inventory.unsupported.find(
    (entry) => entry.path === 'marketBriefData.rawData.macroFactors.0.impact',
  );
  assert.ok(issue);
  assert.equal(issue.reasonCode, 'ambiguous-unlabelled-percentage');
  assert.equal(issue.preview, '35');
  assert.match(issue.reasonHe, /לא מוצג/);
  assert.match(issue.recommendedActionHe, /שדה סמנטי מפורש/);

  console.log(JSON.stringify({
    status: 'passed',
    ambiguousPercentageSuppressed: true,
    verifiedProbabilityLabelled: true,
    importanceTranslated: true,
    rawPayloadUnchanged: true,
  }, null, 2));
} finally {
  await vite.close();
}
