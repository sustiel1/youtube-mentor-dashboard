import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

try {
  const { resolveInsightDisplay } = await vite.ssrLoadModule('/src/lib/insightDisplay.js');
  const { extractUniversalTabContent } = await vite.ssrLoadModule('/src/lib/universalTabSections.js');
  const { formatBulkItemText } = await vite.ssrLoadModule('/src/lib/universalTabBulkItems.js');

  const learningInsight = {
    lesson: 'ירידה חדה אינה בהכרח הזדמנות קנייה',
    whyImportant: 'יש להמתין לאישור טכני לפני פעולה',
    category: 'risk-management',
    applicableToApp: false,
  };
  const snapshot = structuredClone(learningInsight);
  const resolved = resolveInsightDisplay(learningInsight);

  assert.equal(resolved.recognized, true);
  assert.equal(resolved.text, 'ירידה חדה אינה בהכרח הזדמנות קנייה. יש להמתין לאישור טכני לפני פעולה.');
  assert.deepEqual(learningInsight, snapshot, 'presentation formatting must not mutate source data');
  assert.doesNotMatch(resolved.text, /lesson:|whyImportant:|category:|applicableToApp:|\||false|true/);
  assert.equal(formatBulkItemText(learningInsight), resolved.text);

  assert.deepEqual(resolveInsightDisplay({ lesson: 'לקח יחיד', applicableToApp: true }), {
    recognized: true,
    text: 'לקח יחיד.',
  });
  assert.deepEqual(resolveInsightDisplay({ category: 'risk', applicableToApp: false }), {
    recognized: false,
    text: '',
  });

  const shaped = extractUniversalTabContent({}, 'insights', {
    universalTabs: {
      insights: {
        top5Insights: [{ insight: 'תובנה מרכזית', whyImportant: 'הסבר תומך', rank: 1 }],
        learningInsights: [learningInsight, { lesson: '' }, 'תובנה ותיקה'],
      },
    },
  });

  assert.equal(shaped.mode, 'sections');
  assert.equal(shaped.sections.length, 2);
  assert.deepEqual(shaped.sections.map((section) => section.items.length), [1, 2]);
  assert.equal(shaped.sections[0].items[0], 'תובנה מרכזית. הסבר תומך.');
  assert.equal(shaped.sections[1].items[0], resolved.text);
  assert.equal(shaped.sections[1].items[1], 'תובנה ותיקה');
  assert.ok(shaped.sections.flatMap((section) => section.items).every((text) => !text.includes('|')));

  console.log('Learning insight display regression: PASS');
} finally {
  await vite.close();
}
