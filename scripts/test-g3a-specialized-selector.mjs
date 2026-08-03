import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const readFixture = (name) => JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', name),
  'utf8',
));

const morning = readFixture('g3a-morning-brief.json');
const generic = readFixture('g3a-generic-market-brief.json');
const lateNight = readFixture('g3a-late-night-nested.json');
const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const display = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const bulk = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const knowledge = await vite.ssrLoadModule('/src/lib/videoKnowledgePackage.js');
  const obsidian = await vite.ssrLoadModule('/src/lib/obsidianVideoMergeItems.js');

  const snapshot = (payload) => bulk.buildMorningBriefBulkSections({}, payload);
  const count = (sections) => sections.reduce((sum, section) => sum + section.items.length, 0);
  const assertExportParity = (payload, sections, label) => {
    const exportedTexts = new Set(obsidian.collectVideoObsidianMergeItems({
      effectiveVideo: { id: `g3a-${label}` },
      marketBriefData: payload,
    }).map((item) => item.text));
    for (const item of sections.flatMap((section) => section.items)) {
      assert.ok(exportedTexts.has(String(item)), `${label}: renderer item missing from export`);
    }
  };

  const morningBefore = JSON.stringify(morning);
  const morningSections = snapshot(morning);
  assert.equal(JSON.stringify(morning), morningBefore, 'selector must not mutate Morning Brief input');
  assert.deepEqual(display.getSpecializedSrc(morning).marketNews, morning.universalTabs.specialized.marketNews);
  assert.equal(count(morningSections), knowledge.collectVideoKnowledgePackage({ marketBriefData: morning }).sections
    .find((section) => section.key === 'specialized').count);
  assertExportParity(morning, morningSections, 'morning');

  const genericBefore = JSON.stringify(generic);
  const genericSections = snapshot(generic);
  assert.equal(JSON.stringify(generic), genericBefore, 'selector must not mutate generic input');
  assert.deepEqual(display.getSpecializedSrc(generic).marketNews, generic.marketNews);
  assert.deepEqual(display.getSpecializedSrc(generic).stocksMentioned, generic.rawData.stocksMentioned);
  assert.equal(count(genericSections), knowledge.collectVideoKnowledgePackage({ marketBriefData: generic }).sections
    .find((section) => section.key === 'specialized').count);
  assertExportParity(generic, genericSections, 'generic');

  const lateBefore = JSON.stringify(lateNight);
  const lateSrc = display.getSpecializedSrc(lateNight);
  const lateSections = snapshot(lateNight);
  assert.equal(JSON.stringify(lateNight), lateBefore, 'selector must not mutate nested input');
  assert.equal(lateSrc.marketNews.length, 2, 'duplicate news must collapse while distinct news remains');
  assert.equal(lateSrc.stocksMentioned.length, 1, 'duplicate stocks must collapse');
  assert.equal(lateSrc.top5Insights.length, 1);
  assert.equal(lateSrc.learningInsights.length, 1);
  assert.equal(lateSections.find((section) => section.key === 'news').items.length, 2);
  assert.equal(lateSections.find((section) => section.key === 'stocks-mentioned').items.length, 1);
  assert.equal(lateSections.find((section) => section.key === 'top-insights').items.length, 1);
  assert.equal(lateSections.find((section) => section.key === 'learning-insights').items.length, 1);
  assert.equal(count(lateSections), knowledge.collectVideoKnowledgePackage({ marketBriefData: lateNight }).sections
    .find((section) => section.key === 'specialized').count);
  assertExportParity(lateNight, lateSections, 'late-night');

  console.log(JSON.stringify({
    status: 'passed',
    morning: count(morningSections),
    generic: count(genericSections),
    lateNight: count(lateSections),
  }, null, 2));
} finally {
  await vite.close();
}
