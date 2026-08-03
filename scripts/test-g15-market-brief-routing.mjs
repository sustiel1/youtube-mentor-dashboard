import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const fixtures = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', 'g15-market-brief-sessions.json'),
  'utf8',
));
const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const tabs = await vite.ssrLoadModule('/src/config/videoTabsConfig.js');
  const sessions = await vite.ssrLoadModule('/src/lib/marketBriefSession.js');
  const gems = await vite.ssrLoadModule('/src/lib/gemRecommender.js');
  const gemConfig = await vite.ssrLoadModule('/src/lib/gemsConfig.js');
  const briefContext = await vite.ssrLoadModule('/src/lib/briefContextDisplay.js');
  const display = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');

  const aliases = [
    'לייט נייט', 'לייטנייט', 'סיכום מסחר', 'נעילת מסחר', 'late night', 'closing brief',
  ];
  for (const title of aliases) {
    assert.equal(tabs.detectVideoType({ title, contentType: 'marketBrief' }), 'eveningBrief', title);
  }
  for (const title of ['סיכום יום', 'סקירת ערב', 'סגירת שוק']) {
    assert.equal(tabs.detectVideoType({ title, contentType: 'marketBrief' }), 'eveningBrief', `legacy: ${title}`);
  }
  assert.equal(
    tabs.detectVideoType({ title: 'סקירת בוקר', contentType: 'marketBrief' }),
    'morningBrief',
    'legacy morning alias',
  );

  assert.equal(tabs.detectVideoType(fixtures.morning), 'morningBrief');
  assert.equal(tabs.detectVideoType(fixtures.generic), 'morningBrief', 'legacy generic fallback must remain morningBrief');
  assert.equal(tabs.detectVideoType(fixtures.lateNight), 'eveningBrief');
  assert.equal(sessions.resolveMarketBriefSlug({ video: fixtures.morning, marketBriefData: fixtures.morning }), 'morning-brief');
  assert.equal(sessions.resolveMarketBriefSlug({ video: fixtures.generic, marketBriefData: fixtures.generic }), 'morning-brief');
  assert.equal(sessions.resolveMarketBriefSlug({ video: fixtures.lateNight, marketBriefData: fixtures.lateNight }), 'evening-brief');

  const morningGem = gems.preGemClassifier(fixtures.morning);
  const lateGem = gems.preGemClassifier(fixtures.lateNight);
  assert.equal(morningGem.gemKey, 'news');
  assert.equal(morningGem.gemLabel, 'מבזק בוקר');
  assert.equal(lateGem.gemKey, 'news');
  assert.equal(lateGem.gemLabel, 'מבזק ערב');
  assert.equal(gemConfig.defaultGems.news, 'https://gemini.google.com/gem/1CN2KyVNHZalbhNR6rqCcztivoHcl4ySx?usp=sharing');

  assert.match(briefContext.getBriefContextDisplay('morning-brief').title, /מבזק בוקר/);
  assert.match(briefContext.getBriefContextDisplay('evening-brief').title, /מבזק ערב/);

  const nested = JSON.parse(fs.readFileSync(
    path.join(root, 'scripts', 'fixtures', 'g3a-late-night-nested.json'),
    'utf8',
  ));
  const normalized = display.getSpecializedSrc(nested);
  assert.equal(normalized.marketNews.length, 2);
  assert.equal(normalized.stocksMentioned.length, 1);
  assert.equal(normalized.top5Insights.length, 1);
  assert.equal(normalized.learningInsights.length, 1);

  console.log(JSON.stringify({
    status: 'passed',
    morning: { type: 'morningBrief', gem: morningGem.gemKey, heading: 'מבזק בוקר' },
    generic: { type: 'morningBrief', slug: 'morning-brief' },
    lateNight: { type: 'eveningBrief', gem: lateGem.gemKey, heading: 'מבזק ערב' },
  }, null, 2));
} finally {
  await vite.close();
}
