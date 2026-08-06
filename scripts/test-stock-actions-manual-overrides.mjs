import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    buildMarketBriefWithFieldOverride,
    normalizeStockManualFieldValue,
    persistMarketBriefData,
    preserveManualOverridesOnReanalysis,
  } = await vite.ssrLoadModule('/src/lib/manualBriefOverrides.js');
  const {
    extractUnifiedStocks,
    getStockOverrideRowId,
  } = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const {
    buildMorningBriefBulkSections,
  } = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');

  const raw = {
    rawData: {
      stocksMentioned: [
        { ticker: 'GRMN', context: 'report', sentiment: 'positive' },
        { ticker: 'PG', context: 'miss', sentiment: 'negative' },
        { ticker: 'SOFI', context: 'guidance', sentiment: 'negative' },
        { ticker: 'V', context: 'down', sentiment: 'negative' },
        { ticker: 'VRT', context: 'revenue', sentiment: 'negative' },
        { ticker: 'GEHC', context: 'reported', sentiment: 'neutral' },
      ],
    },
  };
  const rawSnapshot = structuredClone(raw);
  assert.equal(getStockOverrideRowId({ ticker: 'grmn' }), 'stock:GRMN');

  const withSector = buildMarketBriefWithFieldOverride(
    raw,
    'stocksMentioned',
    'stock:GRMN',
    'sector',
    'צריכה',
  );
  assert.deepEqual(raw, rawSnapshot);
  assert.equal(withSector.manualOverrides.stocksMentioned.fieldOverrides['stock:GRMN'].sector, 'צריכה');
  assert.equal(extractUnifiedStocks(withSector).find((row) => row.ticker === 'GRMN').sector, 'צריכה');
  assert.equal(extractUnifiedStocks(withSector).length, 6);
  const exportStockSection = buildMorningBriefBulkSections({}, withSector)
    .find((section) => section.key === 'stocks-mentioned');
  assert.equal(exportStockSection.items.length, 6);
  assert.match(exportStockSection.items.find((item) => item.includes('GRMN')), /צריכה/);

  const withZero = buildMarketBriefWithFieldOverride(withSector, 'stocksMentioned', 'stock:PG', 'changePercent', 0);
  assert.equal(extractUnifiedStocks(withZero).find((row) => row.ticker === 'PG').changePercent, 0);
  const withFalse = buildMarketBriefWithFieldOverride(withZero, 'stocksMentioned', 'stock:PG', 'flag', false);
  assert.equal(withFalse.manualOverrides.stocksMentioned.fieldOverrides['stock:PG'].flag, false);

  const reanalyzed = preserveManualOverridesOnReanalysis(withFalse, {
    rawData: { stocksMentioned: [{ ticker: 'GRMN', context: 'new report', sentiment: 'positive' }] },
  });
  assert.equal(reanalyzed.manualOverrides.stocksMentioned.fieldOverrides['stock:GRMN'].sector, 'צריכה');
  assert.equal(extractUnifiedStocks(reanalyzed).find((row) => row.ticker === 'GRMN').context, 'new report');

  const reset = buildMarketBriefWithFieldOverride(withSector, 'stocksMentioned', 'stock:GRMN', 'sector', null);
  assert.equal(reset.manualOverrides?.stocksMentioned, undefined);
  assert.equal(extractUnifiedStocks(reset).find((row) => row.ticker === 'GRMN').sector, undefined);

  assert.deepEqual(normalizeStockManualFieldValue('sector', '   '), { ok: true, value: null });
  assert.deepEqual(normalizeStockManualFieldValue('changePercent', '-5.9%'), { ok: true, value: '-5.9%' });
  assert.deepEqual(normalizeStockManualFieldValue('changePercent', '0'), { ok: true, value: '0' });
  assert.equal(normalizeStockManualFieldValue('changePercent', 'abc').ok, false);
  assert.equal(normalizeStockManualFieldValue('notes', '<img src=x onerror=alert(1)>').ok, true);

  const memoryStorage = new Map();
  globalThis.localStorage = {
    setItem: (key, value) => memoryStorage.set(key, value),
  };
  persistMarketBriefData('video-1', withSector, () => ({ id: 'video-1' }));
  assert.equal(
    JSON.parse(memoryStorage.get('market_brief_video-1')).manualOverrides.stocksMentioned
      .fieldOverrides['stock:GRMN'].sector,
    'צריכה',
  );
  globalThis.localStorage = { setItem: () => { throw new Error('quota'); } };
  assert.throws(
    () => persistMarketBriefData('video-1', withSector, () => null),
    /quota|persistence failed/i,
  );

  const panels = fs.readFileSync(path.join(root, 'src/components/dashboard/MorningBriefPanels.jsx'), 'utf8');
  const layout = fs.readFileSync(path.join(root, 'src/components/dashboard/briefTableLayout.jsx'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'src/components/shared/TradingViewSymbolAction.jsx'), 'utf8');
  const storage = fs.readFileSync(path.join(root, 'src/lib/manualBriefOverrides.js'), 'utf8');

  assert.match(panels, />פעולות<\/th>/);
  assert.match(panels, /data-stock-actions-cell/);
  assert.match(panels, /BRIEF_CELL\.actions/);
  assert.match(panels, /MorningBriefBulkCheckbox[\s\S]*TradingViewSymbolAction/);
  assert.match(layout, /min-w-\[44px\]/);
  assert.match(panels, /onBlur=\{commit\}/);
  assert.match(panels, /event\.key === 'Enter'/);
  assert.match(panels, /event\.key === 'Escape'/);
  assert.match(panels, /commitStartedRef/);
  assert.match(panels, /ערך שהוזן ידנית/);
  assert.match(panels, /חזור לערך המקורי/);
  assert.match(layout, /actions: '9%'/);
  assert.match(layout, /overflow-x-auto/);
  assert.match(actions, /event\.stopPropagation\(\)/);
  assert.match(actions, /rel="noopener noreferrer"/);
  assert.doesNotMatch(panels, /dangerouslySetInnerHTML/);
  assert.match(storage, /throw directStorageError \|\| new Error\('Manual override persistence failed'\)/);
  assert.match(panels, /TradingViewSymbolAction asset=\{stock\} sourceContext="stock"/);

  console.log(JSON.stringify({
    status: 'passed',
    assertions: 35,
    stockRows: 6,
    rawGemsImmutable: true,
    reanalysisPreservesOverrides: true,
    resetRestoresCanonical: true,
    persistenceFailureIsExplicit: true,
  }, null, 2));
} finally {
  await vite.close();
}
