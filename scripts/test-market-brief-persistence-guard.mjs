import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    assertPersistableMarketBrief,
    resolveMarketBriefPersistence,
    validatePersistableMarketBrief,
  } = await vite.ssrLoadModule('/src/lib/marketBriefPersistenceGuard.js');

  const previous = Object.freeze({
    contentType: 'marketBrief',
    shortSummary: 'previous valid analysis',
    chapters: [],
  });
  const valid = {
    contentType: 'marketBrief',
    marketOverview: { vix: { level: 0 } },
    chapters: [],
    extractionMeta: { partial: false },
  };

  assert.deepEqual(validatePersistableMarketBrief(valid), { valid: true, reason: null });
  assert.equal(assertPersistableMarketBrief(valid), valid);
  assert.equal(resolveMarketBriefPersistence({ previous, candidate: valid }).data, valid);

  for (const [candidate, reason] of [
    [null, 'INVALID_OBJECT'],
    [{ contentType: 'general', shortSummary: 'wrong route' }, 'INVALID_CONTENT_TYPE'],
    [{ contentType: 'marketBrief', chapters: {} }, 'INVALID_CHAPTERS'],
    [{ contentType: 'marketBrief', chapters: [] }, 'EMPTY_ANALYSIS'],
    [{ contentType: 'marketBrief', shortSummary: 'partial', extractionMeta: { partial: true } }, 'PARTIAL_ANALYSIS'],
  ]) {
    const decision = resolveMarketBriefPersistence({ previous, candidate });
    assert.equal(decision.accepted, false);
    assert.equal(decision.reason, reason);
    assert.equal(decision.data, previous);
    assert.equal(decision.previousDataPreserved, true);
  }

  const noPrevious = resolveMarketBriefPersistence({ candidate: null });
  assert.equal(noPrevious.data, null);
  assert.equal(noPrevious.previousDataPreserved, false);
  assert.throws(
    () => assertPersistableMarketBrief({ contentType: 'marketBrief', extractionMeta: { partial: true }, shortSummary: 'partial' }),
    { code: 'PARTIAL_ANALYSIS' },
  );

  console.log(JSON.stringify({
    status: 'passed',
    validAccepted: true,
    invalidPreserved: true,
    partialPreserved: true,
    runtimeWiring: false,
  }, null, 2));
} finally {
  await vite.close();
}
