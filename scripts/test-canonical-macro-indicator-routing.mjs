import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { resolveCanonicalMacroIndicator } = await vite.ssrLoadModule('/src/lib/macroIndicatorRegistry.js');
  const { getMacroIndicatorDestination } = await vite.ssrLoadModule('/src/lib/macroIndicatorLinks.js');
  const { parseMacroDisplayItem } = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');

  const expected = new Map([
    ['אינפלציה', 'https://www.bls.gov/cpi/'],
    ['CPI', 'https://www.bls.gov/cpi/'],
    ['CORE_CPI', 'https://www.bls.gov/cpi/'],
    ['PPI', 'https://www.bls.gov/ppi/'],
    ['FOMC', 'https://www.federalreserve.gov/monetarypolicy/fomc.htm'],
    ['NFP', 'https://www.bls.gov/news.release/empsit.htm'],
    ['GDP', 'https://www.bea.gov/data/gdp/gross-domestic-product'],
    ['PCE', 'https://www.bea.gov/data/personal-consumption-expenditures-price-index'],
    ['מכירות קמעונאיות', 'https://www.census.gov/retail/index.html'],
    ['US10Y', 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield'],
    ['WTI', 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm'],
    ['VIX', 'https://www.cboe.com/tradable_products/vix/'],
  ]);
  for (const [indicator, url] of expected) {
    const destination = getMacroIndicatorDestination(indicator);
    assert.equal(destination.url, url, indicator);
    assert.match(destination.tooltipHe, /התאמה מדויקת/);
    assert.match(destination.ariaLabelHe, /נתונים עדכניים/);
  }

  assert.equal(resolveCanonicalMacroIndicator({ indicatorKey: 'CORE_CPI', indicator: 'טקסט אחר' }).canonicalKey, 'US_CPI');
  assert.equal(resolveCanonicalMacroIndicator({ indicator: 'טקסט לא מוכר', sourceUrl: 'https://www.bls.gov/cpi/' }).canonicalKey, 'US_CPI');
  assert.equal(resolveCanonicalMacroIndicator({ indicator: 'טקסט לא מוכר', sourceUrl: 'https://example.com/guess' }), null);
  assert.equal(resolveCanonicalMacroIndicator('טקסט מאקרו חופשי ולא מוכר'), null);
  assert.equal(getMacroIndicatorDestination('oil supply uncertainty and unrelated prose'), null);

  const capex = getMacroIndicatorDestination('השקעות הון בתשתיות AI (CapEx)');
  assert.equal(capex.canonicalKey, 'AI_INFRASTRUCTURE_CAPEX');
  assert.equal(capex.destinationType, 'internal-detail');
  assert.equal(capex.exactness, 'proxy');
  assert.equal(capex.url, '');
  assert.match(capex.tooltipHe, /מדד מייצג/);

  const normalized = parseMacroDisplayItem({
    indicatorKey: 'AI_INFRASTRUCTURE_CAPEX',
    name: 'AI CapEx',
    metricType: 'investment-growth',
    value: 0,
    unit: '%',
    period: 'Q2',
    asOf: '2026-06-30',
    sourceRelativeText: 'עלייה בהשקעות לפי הסרטון',
    sourceName: 'Video transcript',
    sourceUrl: 'https://example.com/not-approved',
    isLive: false,
  });
  assert.equal(normalized.value, '0');
  assert.equal(normalized.isLive, false);
  assert.equal(normalized.asOf, '2026-06-30');
  assert.equal(normalized.sourceRelativeText, 'עלייה בהשקעות לפי הסרטון');

  const panel = fs.readFileSync(new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url), 'utf8');
  assert.match(panel, /data-macro-evidence-panel/);
  assert.match(panel, /נתון מהסרטון/);
  assert.match(panel, /אין סדרה רשמית יחידה/);
  assert.match(panel, /target="_blank"/);
  assert.match(panel, /rel="noopener noreferrer"/);
  assert.match(panel, /event\.key === ' '/);
  assert.match(panel, /event\.stopPropagation\(\)/);

  console.log(JSON.stringify({ status: 'passed', canonicalRoutes: expected.size, internalCapex: true, unknownUnlinked: true }, null, 2));
} finally {
  await vite.close();
}
