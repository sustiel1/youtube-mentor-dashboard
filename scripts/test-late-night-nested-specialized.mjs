import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const fixturePath = path.join(root, 'scripts/fixtures/late-night-nested-market-brief.json');
const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });

try {
  const display = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const bulk = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const launcher = await vite.ssrLoadModule('/src/lib/marketBriefGemLauncher.js');
  const diagnostics = await vite.ssrLoadModule('/src/lib/aiMappingDiagnosticContract.js');
  const presentation = await vite.ssrLoadModule('/src/lib/morningBriefPresentation.js');
  const before = JSON.stringify(payload);
  const src = display.getSpecializedSrc(payload);
  const video = { title: 'לייט נייט - קראודסטרייק וברודקום מדווחות', videoType: 'morningBrief' };
  const sections = bulk.buildMorningBriefBulkSections(video, payload);
  const byKey = Object.fromEntries(sections.map((section) => [section.key, section.items]));
  const allText = sections.flatMap((section) => section.items).map(String).join('\n');
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  assert.equal(JSON.stringify(payload), before, 'resolver must not mutate imported payload');
  assert.ok(total > 5, `expected substantially more than five items, received ${total}`);
  assert.equal(src.marketOverview.generalMood, 'bearish');
  for (const asset of ['SPX', 'NASDAQ', 'DOW', 'RUSSELL', 'OIL', 'DOLLAR', 'BITCOIN', 'BONDS10Y']) {
    assert.match(allText, new RegExp(asset));
  }
  assert.equal(byKey.sectors.length, 2);
  assert.equal(byKey['stocks-mentioned'].length, 5);
  for (const ticker of ['CRWD', 'AVGO', 'AI', 'META', 'MU']) assert.match(allText, new RegExp(`\\b${ticker}\\b`));
  assert.equal(byKey['company-events'].length, 2);
  assert.equal(byKey['economic-calendar'], undefined, 'company catalysts must not be mislabeled as economic calendar');
  assert.equal(byKey.levels.length, 2);
  assert.equal(byKey['top-insights'].length, 5);
  assert.equal(byKey['learning-insights'].length, 2);
  assert.equal(byKey.opportunities.length, 2, 'must not fabricate a third opportunity');
  assert.equal(byKey.sectors.some((item) => /(?:^| · )0$/.test(item)), false, 'empty sector stocks must not leak numeric zero');
  assert.equal(sections.find((section) => section.key === 'company-events').records.length, 2);
  assert.equal(sections.find((section) => section.key === 'levels').records.length, 2);
  assert.deepEqual(
    presentation.resolveMarketBriefSectionOrder(presentation.getMarketBriefSpecializedPresentation('evening')).slice(0, 10),
    ['news', 'market-regime', 'markets', 'sectors', 'company-events', 'stocks-mentioned', 'opportunities-risks', 'levels', 'top-insights', 'learning-insights'],
  );
  assert.deepEqual(
    presentation.resolveMarketBriefSectionOrder(presentation.getMarketBriefSpecializedPresentation('morning')).slice(0, 9),
    ['news', 'market-regime', 'sectors', 'opportunities-risks', 'stocks-mentioned', 'economic-calendar', 'macro', 'sentiment', 'markets'],
    'morning order must remain unchanged',
  );
  assert.equal(presentation.getMarketBriefSpecializedPresentation('evening').hideEmptyOptionalSections, true);
  for (const section of sections) {
    assert.equal(new Set(section.items.map((item) => JSON.stringify(item))).size, section.items.length, `${section.key} contains an exact duplicate`);
  }
  assert.equal(src.stocksMentioned.every((stock) => stock.isNewToWatch === false), true);
  assert.equal(src.marketOverview.dollar.currentValue, 99);
  const session = launcher.resolveMarketBriefSession({
    video,
    videoType: 'eveningBrief',
    structuredData: payload,
  });
  assert.equal(session.briefType, 'evening');
  assert.equal(session.labelHe, 'מבזק ערב');
  assert.equal(launcher.resolveMarketBriefSession({ video: { title: 'מבזק לייב פתיחה לתאריך 10.6.26' }, videoType: 'morningBrief' }).labelHe, 'מבזק בוקר');
  assert.equal(launcher.resolveMarketBriefSession({ video: { title: 'סקירת שוק כללית' } }).briefType, 'unknown');

  const duplicatePayload = {
    ...payload,
    stocksMentioned: payload.universalTabs.stocksMentioned,
  };
  assert.equal(display.getSpecializedSrc(duplicatePayload).stocksMentioned.length, 5);
  const diagnostic = diagnostics.resolveDiagnosticTab({ video, marketBriefData: payload, tabKey: 'specialized' });
  assert.equal(diagnostic.items, total, 'diagnostic count must match the rendered/exported bulk sections');
  assert.ok(diagnostic.matchedSourcePaths.includes('marketBriefData.universalTabs.stocksMentioned'));

  console.log(JSON.stringify({
    status: 'passed',
    total,
    sections: Object.fromEntries(sections.map((section) => [section.key, section.items.length])),
    session: session.briefType,
    immutable: true,
  }, null, 2));
} finally {
  await vite.close();
}
