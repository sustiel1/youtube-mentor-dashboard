import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', 'macro-value-semantics.json'),
  'utf8',
));
const require = createRequire(import.meta.url);
const { MARKET_BRIEF_RESPONSE_SCHEMA } = require('../shared/marketExtractionContract.cjs');

const macroSchema = MARKET_BRIEF_RESPONSE_SCHEMA.properties.macroFactors.items.properties;
for (const field of [
  'actualValue', 'currentValue', 'targetValue', 'referenceValue', 'forecastValue',
  'previousValue', 'change', 'period', 'meaning', 'gapToTarget', 'sourceUrl',
]) assert.ok(macroSchema[field], `macro schema missing ${field}`);

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const semantics = await vite.ssrLoadModule('/src/lib/macroValueSemantics.js');
  const bulk = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const tabs = await vite.ssrLoadModule('/src/config/videoTabsConfig.js');
  const diagnostics = await vite.ssrLoadModule('/src/lib/aiMappingDiagnostics.js');
  const obsidian = await vite.ssrLoadModule('/src/lib/obsidianVideoMergeItems.js');
  const knowledge = await vite.ssrLoadModule('/src/lib/videoKnowledgePackage.js');
  const persistence = await vite.ssrLoadModule('/src/lib/marketBriefPersistenceGuard.js');
  const links = await vite.ssrLoadModule('/src/lib/macroIndicatorLinks.js');

  const cases = [
    ['morning', fixture.morning, 'morning-brief'],
    ['generic', fixture.generic, 'morning-brief'],
    ['evening', fixture.evening, 'evening-brief'],
    ['legacy', fixture.legacy, 'morning-brief'],
  ];

  for (const [name, payload, slug] of cases) {
    const video = { id: `macro-${name}`, title: `Macro ${name}` };
    const selected = semantics.selectMacroValueRowsFromMarketBrief(payload);
    const fallback = tabs.extractVideoTabItems(video, 'brief-macro', payload);
    const rows = bulk.resolveMorningBriefMacroRows(payload, fallback);
    const formatted = rows.map(semantics.formatMacroValueText);
    const sections = bulk.buildMorningBriefBulkSections(video, payload);
    const section = sections.find((candidate) => candidate.key === 'macro');
    assert.deepEqual(section?.items || [], formatted, `${name}: renderer/export source parity`);
    assert.equal(selected.length, rows.length, `${name}: canonical selector count parity`);
    assert.equal(
      diagnostics.resolveAiMappingTab({ video, marketBriefData: payload, normalizedSubCategory: slug, tabKey: 'brief-macro' }).count,
      formatted.length,
      `${name}: AI Mapping macro count parity`,
    );
    const exported = obsidian.collectVideoObsidianMergeItems({ effectiveVideo: video, marketBriefData: payload })
      .filter((item) => item.sectionLabel === section?.label)
      .map((item) => item.text);
    assert.deepEqual(exported, formatted, `${name}: export parity`);
    const total = sections.reduce((sum, current) => sum + current.items.length, 0);
    assert.equal(
      diagnostics.resolveAiMappingTab({ video, marketBriefData: payload, normalizedSubCategory: slug, tabKey: 'specialized' }).count,
      total,
      `${name}: Specialized count parity`,
    );
    assert.equal(
      knowledge.collectVideoKnowledgePackage({ effectiveVideo: video, marketBriefData: payload })
        .sections.find((sectionItem) => sectionItem.key === 'specialized').count,
      total,
      `${name}: displayed count parity`,
    );
  }

  const morning = semantics.selectMacroValueRowsFromMarketBrief(fixture.morning);
  const cpi = morning.find((row) => row.indicator === 'US CPI');
  const fedTarget = morning.find((row) => /inflation target/i.test(row.indicator));
  assert.equal(cpi.actualValue, 3.2);
  assert.equal(cpi.targetValue, undefined, 'Fed target must not become current CPI');
  assert.equal(cpi.forecastValue, 3.1);
  assert.equal(cpi.previousValue, 3.3);
  assert.equal(cpi.change, '-0.1 נקודת אחוז');
  assert.equal(cpi.period, 'יולי 2026');
  assert.equal(cpi.gapToTarget, 1.2);
  assert.match(cpi.meaning, /האינפלציה/);
  assert.equal(fedTarget.targetValue, 2);
  assert.equal(fedTarget.actualValue, undefined);
  assert.equal(fedTarget.currentValue, undefined);

  const zeroFalse = morning.find((row) => row.indicator === 'מדד עברי');
  const zeroFalseText = semantics.formatMacroValueText(zeroFalse);
  assert.equal(zeroFalse.actualValue, 0);
  assert.equal(zeroFalse.currentValue, false);
  assert.equal(zeroFalse.isPreliminary, false);
  assert.match(zeroFalseText, /בפועל: 0/);
  assert.match(zeroFalseText, /נוכחי: לא/);
  assert.match(zeroFalseText, /ראשוני: לא/);

  const evening = semantics.selectMacroValueRowsFromMarketBrief(fixture.evening);
  assert.equal(evening[0].currentValue, -0.25);
  assert.equal(evening[0].forecastValue, -0.2);
  assert.equal(evening[0].previousValue, -0.1);
  const unknown = evening.find((row) => row.indicator === 'Unknown macro asset');
  assert.equal(unknown.sourceUrl, '');
  assert.equal(links.getMacroIndicatorUrl(unknown.indicator), null);
  assert.doesNotMatch(semantics.formatMacroValueText(unknown), /secret|תמלול מלא|rawProvider|\[object Object\]|\{/);

  const generic = semantics.selectMacroValueRowsFromMarketBrief(fixture.generic);
  assert.equal(generic[0].legacyValue, '4.5%');
  assert.equal(generic[1].currentValue, 4.125);
  const legacy = semantics.selectMacroValueRowsFromMarketBrief(fixture.legacy);
  assert.equal(legacy[0].legacyValue, '12.5%');
  assert.equal(legacy[0].change, '-1.25%');
  assert.equal(legacy[0].period, 'רבעון שני');

  assert.equal(links.getMacroIndicatorUrl('US CPI'), 'https://www.bls.gov/cpi/');
  assert.match(links.getMacroIndicatorUrl('Federal Reserve inflation target'), /^https:\/\/www\.federalreserve\.gov\//);
  assert.equal(links.getMacroIndicatorUrl('US10Y'), 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield');
  assert.equal(links.getMacroIndicatorUrl('Unmapped narrative about CPI nearby'), null);

  const persistenceResult = persistence.resolveMarketBriefPersistence({ candidate: fixture.generic });
  assert.equal(persistenceResult.accepted, true);
  assert.equal(persistenceResult.data.macro[1].currentValue, 4.125);
  assert.deepEqual(semantics.selectMacroValueRowsFromMarketBrief(fixture.empty), []);

  const panelSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'MorningBriefPanels.jsx'),
    'utf8',
  );
  const macroUiSource = panelSource.slice(
    panelSource.indexOf('// ── 5. Macro'),
    panelSource.indexOf('// ── 6. Sentiment'),
  );
  assert.match(macroUiSource, /resolveMorningBriefMacroRows/);
  assert.match(macroUiSource, /בפועל|נוכחי/);
  assert.match(macroUiSource, /יעד|ייחוס|תחזית|קודם|פער מהיעד/);
  assert.doesNotMatch(macroUiSource, /mergeMacroDisplayRows|row\.value\b/);

  console.log(JSON.stringify({
    status: 'passed',
    morning: morning.length,
    generic: generic.length,
    evening: evening.length,
    legacy: legacy.length,
    explicitValueRoles: true,
    cpiTargetSeparated: true,
    officialDestinations: true,
    rendererExportCountParity: true,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
