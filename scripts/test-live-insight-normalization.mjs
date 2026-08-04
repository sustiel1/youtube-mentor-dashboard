import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', 'live-evidence-learning-insights.json'),
  'utf8',
));

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const sectionsModule = await vite.ssrLoadModule('/src/lib/universalTabSections.js');
  const bulkModule = await vite.ssrLoadModule('/src/lib/universalTabBulkItems.js');

  const insights = sectionsModule.extractUniversalTabContent({}, 'insights', fixture);
  const useful = sectionsModule.extractUniversalTabContent({}, 'useful-knowledge', fixture);

  assert.equal(insights.mode, 'sections');
  assert.equal(useful.mode, 'sections');

  const learning = insights.sections.find((section) => section.key === 'learningInsights');
  assert.equal(learning.items.length, 2);
  assert.deepEqual(learning.items[0], {
    category: 'ניהול סיכונים',
    applicableToApp: false,
    startSeconds: 480.25,
    endSeconds: 493.75,
    timestampSource: 'timed-transcript-alignment',
    timestampConfidence: 0.95,
    timestampBasis: 'matching transcript segment',
    timingScope: 'video-absolute',
    insight: 'התגובה הראשונית לחדשות אינה תמיד המגמה',
    meaning: 'נדרש אישור לפני פעולה',
  });
  assert.deepEqual(learning.items[1], {
    manual: true,
    insight: '0',
    meaning: 'false',
  });

  const usefulLearning = useful.sections.find((section) => section.key === 'learningInsights');
  assert.equal(usefulLearning.items[0].startSeconds, 0);
  assert.equal(usefulLearning.items[0].timestampConfidence, 1);
  assert.equal(useful.sections.find((section) => section.key === 'lessons').items[0].insight, 'לקח legacy נשמר');
  assert.equal(useful.sections.find((section) => section.key === 'rules').items[0], 'כלל ישיר נשמר');

  const insightBulk = bulkModule.buildBulkItemsFromSections(insights.sections, 'insights');
  const usefulBulk = bulkModule.buildBulkItemsFromSections(useful.sections, 'useful-knowledge');
  assert.equal(insightBulk.length, insights.sections.reduce((sum, section) => sum + section.items.length, 0));
  assert.equal(usefulBulk.length, useful.sections.reduce((sum, section) => sum + section.items.length, 0));
  assert.ok(insightBulk.some((item) => item.text === 'התגובה הראשונית לחדשות אינה תמיד המגמה'));

  const exportedText = [...insightBulk, ...usefulBulk].map((item) => item.text).join('\n');
  assert.doesNotMatch(exportedText, /(?:lesson|category|whyImportant|providerPayload)\s*:/i);
  assert.doesNotMatch(exportedText, /must-not-render|\[object Object\]|\{\s*"/);

  const nullSafe = sectionsModule.valueToDisplayItems({ providerPayload: { raw: 'secret' } }, { preserveStructured: true });
  assert.deepEqual(nullSafe, []);

  console.log(JSON.stringify({
    status: 'passed',
    insightItems: insightBulk.length,
    usefulKnowledgeItems: usefulBulk.length,
    verifiedTimingPreserved: true,
    zeroAndFalsePreserved: true,
    rawFieldsExcluded: true,
  }, null, 2));
} finally {
  await vite.close();
}
