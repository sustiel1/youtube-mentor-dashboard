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
    FINVIZ_SECTOR_OVERVIEW_URL,
    resolveSectorDestination,
  } = await vite.ssrLoadModule('/src/utils/finvizLinks.js');
  const {
    CANONICAL_SECTOR_TECHNICALS,
    resolveSectorTechnicals,
  } = await vite.ssrLoadModule('/src/lib/sectorTechnicals.js');
  const { getSpecializedSectionResources } = await vite.ssrLoadModule('/src/lib/specializedSectionResources.js');

  assert.equal(FINVIZ_SECTOR_OVERVIEW_URL, 'https://finviz.com/groups?g=sector&v=140&o=-change');
  assert.notEqual(FINVIZ_SECTOR_OVERVIEW_URL, 'https://finviz.com/');
  assert.equal(getSpecializedSectionResources('sectors')[0].url, 'https://finviz.com/map?t=sec');

  const canonical = new Map([
    ['Technology', ['Technology', 'XLK']],
    ['Communication Services', ['Communication Services', 'XLC']],
    ['Financial', ['Financial', 'XLF']],
    ['Healthcare', ['Healthcare', 'XLV']],
    ['Energy', ['Energy', 'XLE']],
    ['Industrials', ['Industrials', 'XLI']],
    ['Consumer Cyclical', ['Consumer Discretionary', 'XLY']],
    ['Consumer Defensive', ['Consumer Staples', 'XLP']],
    ['Utilities', ['Utilities', 'XLU']],
    ['Basic Materials', ['Materials', 'XLB']],
    ['Real Estate', ['Real Estate', 'XLRE']],
  ]);
  for (const [label, [identity, etf]] of canonical) {
    const result = resolveSectorDestination({ sector: label });
    assert.equal(result.canonicalSector, identity, label);
    assert.equal(result.representativeEtf, etf, label);
    assert.equal(result.etfUrl, `https://finviz.com/quote.ashx?t=${etf}`, label);
    assert.equal(result.resolutionSource, 'registry', label);
    const technicals = resolveSectorTechnicals({ sector: label });
    assert.equal(technicals.etf, etf, label);
    assert.equal(technicals.url, `https://www.tradingview.com/symbols/AMEX-${etf}/technicals/`, label);
  }
  assert.equal(CANONICAL_SECTOR_TECHNICALS.length, 11);
  assert.equal(resolveSectorTechnicals({ sector: 'טכנולוגיה' }).etf, 'XLK');
  assert.equal(resolveSectorTechnicals({ sector: 'שירותים ציבוריים' }).etf, 'XLU');
  assert.equal(resolveSectorTechnicals({ sector: 'future unknown sector' }), null);
  assert.equal(resolveSectorTechnicals({ sector: 'Semiconductors' }), null);
  assert.equal(resolveSectorTechnicals({ sector: 'Semiconductors', sourceEtf: 'SOXX' }).etf, 'SOXX');
  assert.equal(resolveSectorTechnicals({ sector: 'Unknown', sourceEtf: 'UNKNOWN' }), null);

  assert.deepEqual(
    resolveSectorDestination({ sector: 'טכנולוגיה וענן' }),
    {
      sourceSectorLabel: 'טכנולוגיה וענן',
      canonicalSector: 'Technology',
      representativeEtf: 'XLK',
      resolutionSource: 'registry',
      overviewUrl: FINVIZ_SECTOR_OVERVIEW_URL,
      etfUrl: 'https://finviz.com/quote.ashx?t=XLK',
    },
  );
  assert.equal(resolveSectorDestination({ sector: 'נדל״ן ונכסי סיכון' }).representativeEtf, 'XLRE');
  assert.equal(resolveSectorDestination({ sector: 'נדל״ן ונכסי סיכון' }).canonicalSector, 'Real Estate');

  const sourceWins = resolveSectorDestination({ sector: 'Technology', sourceEtf: 'SOXX', legacyEtf: 'SMH' });
  assert.equal(sourceWins.representativeEtf, 'SOXX');
  assert.equal(sourceWins.resolutionSource, 'source-etf');
  const legacyWins = resolveSectorDestination({ sector: 'Technology', legacyEtf: 'SMH' });
  assert.equal(legacyWins.representativeEtf, 'SMH');
  assert.equal(legacyWins.resolutionSource, 'legacy-etf');

  for (const unknown of ['risk assets', 'נכסי סיכון', 'future unknown sector']) {
    const result = resolveSectorDestination({ sector: unknown });
    assert.equal(result.representativeEtf, null, unknown);
    assert.equal(result.etfUrl, null, unknown);
    assert.equal(result.resolutionSource, 'unresolved', unknown);
  }

  const tableSource = fs.readFileSync(
    new URL('../src/components/dashboard/MarketSectorTable.jsx', import.meta.url),
    'utf8',
  );
  const actionSource = fs.readFileSync(
    new URL('../src/components/shared/ExternalResourceAction.jsx', import.meta.url),
    'utf8',
  );
  assert.match(tableSource, /data-sector-etf-action/);
  assert.match(tableSource, /data-sector-resolution-source/);
  assert.match(tableSource, /data-sector-technicals-action/);
  assert.match(tableSource, /RSI וניתוח טכני/);
  assert.match(tableSource, /data-sector-tools-trigger/);
  assert.match(tableSource, /data-sector-tools-panel/);
  assert.match(actionSource, /target="_blank"/);
  assert.match(actionSource, /rel="noopener noreferrer"/);
  assert.match(actionSource, /stopPropagation\(\)/);
  assert.match(actionSource, /focus-visible:ring-2/);

  const dailyWeeklyMonthly = getSpecializedSectionResources('sectors')
    .filter((item) => item.key.startsWith('sector-performance-'));
  assert.deepEqual(dailyWeeklyMonthly.map((item) => item.key), [
    'sector-performance-daily',
    'sector-performance-weekly',
    'sector-performance-monthly',
  ]);

  console.log(JSON.stringify({
    status: 'passed',
    canonicalMappings: canonical.size,
    currentVideoMappings: 2,
    precedenceCases: 3,
    unresolvedCases: 3,
  }, null, 2));
} finally {
  await vite.close();
}
