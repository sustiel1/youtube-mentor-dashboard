import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const { resolveMacroMetricSemantics } = await vite.ssrLoadModule('/src/lib/macroMetricSemantics.js');
  const { parseMacroDisplayItem } = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const cpi = resolveMacroMetricSemantics(parseMacroDisplayItem({ indicator: 'CPI annual', actualValue: 3.5, unit: '%', period: 'June 2026', targetValue: 2, referenceType: 'policy-target', referencePeriod: 'June 2026', metricType: 'annual-cpi', referenceMetricType: 'annual-cpi', sourceName: 'BLS' }));
  assert.equal(cpi.actualDisplay, '3.5%');
  assert.equal(cpi.referenceDisplay, '2%');
  assert.equal(cpi.referenceLabel, 'יעד מדיניות');
  assert.equal(cpi.gapDisplay, '+1.5 נק׳ אחוז');
  assert.equal(resolveMacroMetricSemantics({ actualValue: 0.3, targetValue: 2, unit: '%', actualPeriod: 'monthly', referencePeriod: 'annual' }).gapDisplay, '');
  assert.equal(resolveMacroMetricSemantics({ gapValue: 1.5, unit: '%' }).gapDisplay, '');
  assert.equal(resolveMacroMetricSemantics({ actualValue: 0, unit: '%', period: 'monthly', sourceName: 'BLS' }).actualDisplay, '0%');
  assert.equal(resolveMacroMetricSemantics({ actualValue: 2.6, referenceValue: 2.4, referenceType: 'market-consensus' }).referenceLabel, 'צפי שוק');
  assert.equal(resolveMacroMetricSemantics({ actualValue: 2.6, referenceValue: 2.5, referenceType: 'previous-reading' }).referenceLabel, 'נתון קודם');
  assert.equal(resolveMacroMetricSemantics({ actualValue: 2.6 }).referenceDisplay, '');
  assert.equal(resolveMacroMetricSemantics({ indicator: 'Inflation', value: '2%', impact: 'delays rate cuts' }).actualDisplay, '');
  assert.equal(resolveMacroMetricSemantics({ indicator: 'Legacy CPI', value: '3.5%', period: 'June 2026' }).actualDisplay, '3.5%');
  const capex = resolveMacroMetricSemantics(parseMacroDisplayItem({ indicator: 'AI CapEx', actualValue: 20, unit: '%', sourceType: 'video-claim', trend: 'down', impact: 'חיובי מאוד' }));
  assert.equal(capex.sourceUnverified, true);
  assert.match(capex.sourceWarning, /נתון מהסרטון/);
  assert.equal(capex.trend, 'down');
  assert.equal(resolveMacroMetricSemantics({ impact: 'חיובי', sentiment: 'positive' }).trend, 'unknown');
  assert.equal(resolveMacroMetricSemantics({ isLive: false, actualValue: 0 }).isLive, false);
  console.log(JSON.stringify({ status: 'passed', cases: 12, zeroPreserved: true }, null, 2));
} finally {
  await vite.close();
}
