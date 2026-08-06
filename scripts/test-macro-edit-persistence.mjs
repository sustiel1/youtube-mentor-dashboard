import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const overrides = await server.ssrLoadModule('/src/lib/manualBriefOverrides.js');
  const semantics = await server.ssrLoadModule('/src/lib/macroMetricSemantics.js');
  const original = {
    macroFactors: [{ indicator: 'מחיר הנפט הגולמי (WTI)', actualValue: 99.5, unit: 'USD', targetValue: 102, description: 'מקור' }],
  };
  const originalSnapshot = JSON.stringify(original);
  const editable = overrides.getEditableRowsForSection(original, {}, 'macro');
  const draft = editable.map((row) => ({ ...row, actualValue: '84.5' }));
  const saved = overrides.buildMarketBriefWithSectionOverride(original, 'macro', draft);
  const savedRow = saved.manualOverrides.macro.rows[0];
  assert.equal(savedRow.actualValue, 84.5);
  assert.deepEqual(savedRow.manualOverrideFields, ['actualValue']);
  assert.equal(semantics.resolveMacroMetricSemantics(savedRow).actualDisplay, '84.5 USD');
  assert.equal(JSON.stringify(original), originalSnapshot);
  assert.equal(savedRow.targetValue, 102);
  assert.equal(savedRow.description, 'מקור');
  for (const value of ['0', '0.56', '-7.25']) {
    const normalized = overrides.normalizeMacroManualRows([{ indicator: 'WTI', actualValue: value }])[0];
    assert.equal(normalized.actualValue, Number(value));
    assert.equal(semantics.resolveMacroMetricSemantics(normalized).actualDisplay, value);
  }
  const cleared = overrides.normalizeMacroManualRows([{ indicator: 'WTI', value: 99.5, actualValue: '' }])[0];
  assert.equal(semantics.resolveMacroMetricSemantics(cleared).actualDisplay, '');
  assert.equal(saved.manualOverrides.macro.rows.length, 1);
  assert.equal(editable[0].indicator, savedRow.indicator);
  const memory = new Map();
  globalThis.localStorage = {
    setItem: (key, value) => memory.set(key, value),
    getItem: (key) => memory.get(key) ?? null,
  };
  overrides.persistMarketBriefData('video-wti', saved);
  const reloaded = overrides.readPersistedMarketBriefData('video-wti');
  assert.equal(reloaded.manualOverrides.macro.rows[0].actualValue, 84.5);
  assert.equal(semantics.resolveMacroMetricSemantics(reloaded.manualOverrides.macro.rows[0]).actualDisplay, '84.5 USD');
  console.log('Macro edit persistence: 18 assertions passed');
} finally {
  await server.close();
}
