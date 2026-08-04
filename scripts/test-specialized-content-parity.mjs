import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const readFixture = (name) => JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', name),
  'utf8',
));
const payload = readFixture('specialized-content-parity.json');
const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const bulk = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const tabs = await vite.ssrLoadModule('/src/config/videoTabsConfig.js');
  const knowledge = await vite.ssrLoadModule('/src/lib/videoKnowledgePackage.js');
  const obsidian = await vite.ssrLoadModule('/src/lib/obsidianVideoMergeItems.js');
  const diagnostics = await vite.ssrLoadModule('/src/lib/aiMappingDiagnostics.js');

  const before = JSON.stringify(payload);
  const video = { id: 'specialized-parity', title: 'לייט נייט — בדיקת תוכן ייעודי' };
  const sections = bulk.buildMorningBriefBulkSections(video, payload);
  const byKey = Object.fromEntries(sections.map((section) => [section.key, section.items]));
  const rows = sections.flatMap((section) => section.items.map((text) => ({
    section: section.key,
    label: section.label,
    text: String(text),
  })));
  const total = rows.length;

  assert.equal(JSON.stringify(payload), before, 'canonical selection must not mutate source data');
  for (const key of [
    'news', 'market-regime', 'sectors', 'opportunities', 'risks', 'stocks-mentioned',
    'company-events', 'economic-calendar', 'macro', 'sentiment', 'markets', 'levels',
    'top-insights', 'learning-insights', 'all-points',
  ]) {
    assert.ok(byKey[key]?.length > 0, `${key} must receive applicable data`);
  }

  assert.equal(byKey.news.length, 2, 'sparse duplicate collapses but distinct impacts remain');
  assert.ok(byKey.news.some((text) => text.includes('השפעה ראשונה')));
  assert.ok(byKey.news.some((text) => text.includes('השפעה שנייה')));
  assert.equal(byKey['company-events'].length, 1);
  assert.match(byKey['company-events'][0], /דוח רבעוני של AI/);
  assert.equal(byKey['economic-calendar'].some((text) => text.includes('דוח רבעוני של AI')), false);
  assert.equal(byKey.opportunities.length, 1, 'summary opportunity is a fallback only when structured data is empty');
  assert.equal(byKey.risks.length, 1, 'summary warning is a fallback only when structured data is empty');
  assert.equal(byKey.sectors.some((text) => /(?:^| · )(?:0|לא)$/.test(text)), false);
  assert.equal(byKey['economic-calendar'].some((text) => /(?:^| · )(?:0|לא)$/.test(text)), false);
  assert.match(byKey['stocks-mentioned'][0], /^AI\b/);
  assert.match(byKey['stocks-mentioned'][0], /0/);
  assert.match(byKey['stocks-mentioned'][0], /חדש למעקב: לא/);
  assert.ok(byKey.markets.some((text) => /VIX/.test(text) && /0/.test(text)));
  assert.ok(byKey.macro.some((text) => /0/.test(text) && /לא/.test(text)));
  assert.ok(byKey.sentiment.some((text) => (
    text.includes('סנטימנט כללי')
    && text.includes('ערך: לא')
    && text.includes('כיוון: לא אומת')
    && text.includes('ניתוח הסרטון — לא אומת חיצונית')
  )));
  assert.match(byKey['top-insights'][0], /^#1 · SPX · תובנה מרכזית נקייה/);
  assert.match(byKey['learning-insights'][0], /לקח מרכזי שאסור לאבד/);
  assert.match(byKey['learning-insights'][0], /הסבר מדוע הלקח חשוב/);
  assert.match(byKey['learning-insights'][0], /מתאים ליישום: לא/);
  assert.equal(byKey['all-points'][0], 'נקודה ישירה משדה sibling · נושא: מידע נוסף');

  for (const { text } of rows) {
    assert.doesNotMatch(text, /\[object Object\]|\{\s*"/);
    assert.doesNotMatch(text, /\b(?:lesson|category|whyImportant)\s*:/i);
    assert.ok(text.trim(), 'empty rows are forbidden');
  }
  assert.equal(new Set(rows.map(({ section, text }) => `${section}\u0000${text}`)).size, total);

  const knowledgeCount = knowledge.collectVideoKnowledgePackage({
    effectiveVideo: video,
    marketBriefData: payload,
  }).sections.find((section) => section.key === 'specialized').count;
  const diagnosticCount = diagnostics.resolveAiMappingTab({
    video,
    marketBriefData: payload,
    normalizedSubCategory: 'evening-brief',
    tabKey: 'specialized',
  }).count;
  assert.equal(knowledgeCount, total);
  assert.equal(diagnosticCount, total);

  const exported = obsidian.collectVideoObsidianMergeItems({
    effectiveVideo: video,
    marketBriefData: payload,
  });
  for (const section of sections) {
    const exportedSectionTexts = exported
      .filter((item) => item.sectionLabel === section.label)
      .map((item) => item.text);
    assert.deepEqual(exportedSectionTexts, section.items, `${section.key} export must match renderer rows exactly`);
  }

  for (const name of [
    'g3a-morning-brief.json',
    'g3a-generic-market-brief.json',
    'g3a-late-night-nested.json',
    'g3a-late-night-sibling-specialized.json',
  ]) {
    assert.ok(bulk.buildMorningBriefBulkSections({}, readFixture(name)).length > 0, `${name} remains supported`);
  }
  assert.ok(tabs.extractVideoTabItems({}, 'specialized', readFixture('g3a-late-night-sibling-specialized.json')).length > 0);

  const rendererSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'SpecializedContentRenderer.jsx'),
    'utf8',
  );
  const dashboardSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'MorningBriefDashboard.jsx'),
    'utf8',
  );
  assert.match(rendererSource, /data-specialized-additional-sections/);
  assert.match(rendererSource, /MORNING_DASHBOARD_SECTION_KEYS/);
  assert.match(dashboardSource, /items=\{selectedNewsItems\}/);

  console.log(JSON.stringify({
    status: 'passed',
    total,
    sections: Object.fromEntries(sections.map((section) => [section.key, section.items.length])),
    rendererExportCountParity: true,
    aiMappingCountParity: true,
    preservesZeroAndFalse: true,
  }, null, 2));
} finally {
  await vite.close();
}
