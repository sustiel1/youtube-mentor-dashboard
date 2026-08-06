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
    getMacroIndicatorDestination,
    getMacroIndicatorUrl,
    resolveMacroIndicatorInvestingUrl,
  } = await vite.ssrLoadModule('/src/lib/macroIndicatorLinks.js');

  const fedMonitor = 'https://il.investing.com/central-banks/fed-rate-monitor';
  const officialFomc = 'https://www.federalreserve.gov/monetarypolicy/fomc.htm';
  const rateDecision = 'https://il.investing.com/economic-calendar/interest-rate-decision-168';
  const tenYear = 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield';
  const spx = 'https://il.investing.com/indices/us-spx-500';

  assert.notEqual(getMacroIndicatorUrl('interest rates'), spx);
  assert.notEqual(getMacroIndicatorUrl('ריבית (interest rates)'), spx);
  assert.equal(getMacroIndicatorUrl('interest rates'), null);
  assert.equal(getMacroIndicatorUrl('ריבית (interest rates)'), null);
  assert.equal(getMacroIndicatorUrl({
    indicator: 'interest rates',
    description: 'Federal Reserve policy expectations in the U.S.',
  }), fedMonitor);
  assert.equal(getMacroIndicatorUrl({
    indicator: 'ריבית (interest rates)',
    sourceContext: 'החלטת הריבית הקרובה של הפד',
  }), fedMonitor);
  assert.equal(getMacroIndicatorUrl('Fed rate'), officialFomc);
  assert.equal(getMacroIndicatorUrl('interest rate decision'), rateDecision);
  assert.equal(getMacroIndicatorUrl('החלטת הריבית של הפד'), rateDecision);
  assert.equal(getMacroIndicatorUrl('BONDS10Y'), tenYear);
  assert.equal(getMacroIndicatorUrl('US10Y'), tenYear);
  assert.equal(getMacroIndicatorUrl('TNX'), tenYear);
  assert.equal(getMacroIndicatorUrl('ריבית'), null);
  assert.equal(getMacroIndicatorUrl('unknown macro prose'), null);
  assert.equal(resolveMacroIndicatorInvestingUrl('unknown macro prose'), null);
  assert.equal(getMacroIndicatorUrl('SPX'), spx);

  const monitorMeta = getMacroIndicatorDestination('Fed rate');
  assert.equal(monitorMeta.destinationType, 'official-data');
  assert.equal(monitorMeta.canonicalKey, 'FED_RATE');
  assert.match(monitorMeta.tooltipHe, /ניטור ריבית הפד/);
  assert.match(monitorMeta.ariaLabelHe, /ציפיות ריבית הפד/);
  assert.notEqual(getMacroIndicatorUrl('Fed rate'), fedMonitor);
  assert.notEqual(getMacroIndicatorUrl('Fed rate'), tenYear);
  assert.notEqual(getMacroIndicatorUrl('interest rate decision'), fedMonitor);
  assert.notEqual(getMacroIndicatorUrl('BONDS10Y'), fedMonitor);

  const panel = fs.readFileSync(
    new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
    'utf8',
  );
  assert.match(panel, /rel="noopener noreferrer"/);
  assert.match(panel, /title=\{macroDestination\.tooltipHe\}/);
  assert.match(panel, /aria-label=\{macroDestination\.ariaLabelHe \|\| macroDestination\.tooltipHe\}/);
  assert.match(panel, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
  assert.match(panel, /event\.key === ' '/);
  assert.match(panel, /event\.stopPropagation\(\)/);
  assert.match(panel, /aria-hidden>↗<\/span>/);

  console.log(JSON.stringify({
    status: 'passed',
    rateConcepts: 3,
    ambiguousUnlinked: true,
    spxFallback: false,
  }, null, 2));
} finally {
  await vite.close();
}
