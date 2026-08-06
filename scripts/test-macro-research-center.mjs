import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });

try {
  const registry = await vite.ssrLoadModule('/src/lib/specializedSectionResources.js');
  const resources = registry.getMacroResearchResources();
  assert.equal(resources.length, 6);
  assert.deepEqual(resources.map((item) => item.key), ['economic-calendar', 'fedwatch', 'us-10y', 'vix', 'dxy', 'wti']);
  assert.equal(resources[0].url, 'https://il.investing.com/economic-calendar/');
  assert.equal(resources[1].url, 'https://www.cmegroup.com/en/markets/interest-rates/cme-fedwatch-tool.html');
  assert.equal(resources[2].url, 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield');
  assert.equal(resources[3].url, 'https://il.tradingview.com/symbols/CBOE-VIX/');
  assert.equal(resources[4].url, 'https://il.tradingview.com/symbols/TVC-DXY/');
  assert.equal(resources[5].url, 'https://il.tradingview.com/symbols/USOIL/');
  for (const resource of resources) {
    assert.ok(resource.labelHe && resource.descriptionHe && resource.provider && resource.category);
    assert.equal(resource.external, true);
  }

  for (const [alias, key] of [['BONDS10Y', 'us-10y'], ['US10Y', 'us-10y'], ['TNX', 'us-10y'], ['VIX', 'vix'], ['DOLLAR', 'dxy'], ['DXY', 'dxy'], ['OIL', 'wti'], ['WTI', 'wti']]) {
    assert.equal(registry.getMacroResearchResourceForIndicator(alias)?.key, key);
  }
  assert.equal(registry.getMacroResearchResourceForIndicator('סיכום מצב השוק'), null);
  assert.equal(registry.getMacroResearchResourceForIndicator('מצב רוח כללי'), null);
  assert.equal(registry.getMacroResearchResourceForIndicator('unknown narrative'), null);

  const component = fs.readFileSync(path.join(root, 'src/components/dashboard/MacroResearchCenter.jsx'), 'utf8');
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /event\.key === ' '/);
  assert.match(component, /triggerRef\.current\?\.focus/);
  assert.match(component, /הקישורים מיועדים לבדיקת נתוני שוק ומאקרו ואינם המלצת השקעה/);
  assert.doesNotMatch(component, /fetch\(|axios|XMLHttpRequest/);

  const panels = fs.readFileSync(path.join(root, 'src/components/dashboard/MorningBriefPanels.jsx'), 'utf8');
  assert.match(panels, /headerResources={<MacroResearchCenter \/>}/);
  assert.match(panels, /getMacroResearchResourceForIndicator\(card\.label\)/);
  assert.match(panels, /data-market-regime-resource/);
  console.log('Macro Research Center: 38 assertions passed.');
} finally {
  await vite.close();
}
