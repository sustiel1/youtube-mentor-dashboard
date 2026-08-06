import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { normalizeNewsItems, normalizeNewsSentiment } = await vite.ssrLoadModule('/src/lib/morningBriefNewsNormalize.js');
  const aliases = new Map([
    ['positive', ['positive', 'bullish', 'favorable', 'up', 'חיובי', 'שורי', 'עולה']],
    ['negative', ['negative', 'bearish', 'unfavorable', 'down', 'שלילי', 'דובי', 'יורד']],
    ['neutral', ['neutral', 'ניטרלי']],
    ['mixed', ['mixed', 'מעורב']],
    ['unknown', ['unknown', 'unclassified', 'unspecified', 'לא ידוע', 'לא סווג']],
    ['warning', ['warning', 'caution', 'אזהרה']],
    ['high-risk', ['high-risk', 'critical', 'severe', 'סיכון גבוה']],
  ]);
  for (const [expected, values] of aliases) {
    values.forEach((value) => assert.equal(normalizeNewsSentiment(value), expected, value));
  }
  assert.equal(normalizeNewsSentiment('future-status'), 'unknown');
  assert.equal(normalizeNewsSentiment(''), 'unknown');

  const fixture = [
    { title: 'עליות חדות בטקסט בלבד', summary: 'positive bullish up', sentiment: '' },
    { title: 'פריט חיובי', sentiment: 'positive' },
    { title: 'פריט שלילי', status: 'bearish' },
    { title: 'פריט מעורב', tone: 'מעורב' },
  ];
  const normalized = normalizeNewsItems(fixture);
  assert.equal(normalized.length, fixture.length);
  assert.deepEqual(normalized.map((item) => item.title), fixture.map((item) => item.title));
  assert.deepEqual(normalized.map((item) => item.sentiment), ['unknown', 'positive', 'negative', 'mixed']);
  assert.equal(normalized[0].saveText.includes('positive bullish up'), true);
  assert.equal(normalizeNewsItems(['positive bullish headline'])[0].sentiment, 'unknown');
  assert.equal(normalizeNewsItems([{ title: 'חשיבות אינה סנטימנט', importance: 'high', category: 'positive' }])[0].sentiment, 'unknown');
  const preserved = normalizeNewsItems([{ title: 'שימור', sentiment: 'neutral', sentimentConfidence: 0, sourceEvidence: ['ראיה'], flag: false }])[0];
  assert.equal(preserved.sentimentConfidence, 0);
  assert.deepEqual(preserved.sourceEvidence, ['ראיה']);

  const cardSource = fs.readFileSync(new URL('../src/components/dashboard/MorningBriefNewsSection.jsx', import.meta.url), 'utf8');
  assert.match(cardSource, /semanticRowClass\(semanticEvidence\)/);
  assert.match(cardSource, /data-news-semantic-status/);
  assert.match(cardSource, /resolveMorningBriefBulkId/);
  assert.match(cardSource, /data-news-selected/);
  assert.match(cardSource, /isSelected \? 'ring-2 ring-indigo-500 ring-offset-1'/);
  assert.match(cardSource, /focus-within:ring-2/);
  assert.match(cardSource, /MorningBriefBulkCheckbox/);
  assert.match(cardSource, /sentStyle\.label/);
  assert.match(cardSource, /border-dashed/);

  const contractSource = fs.readFileSync(new URL('../shared/marketExtractionContract.cjs', import.meta.url), 'utf8');
  assert.match(contractSource, /marketNews:\s*\{/);
  assert.match(contractSource, /enum:\s*\['positive', 'negative', 'neutral', 'mixed', 'unknown'\]/);
  assert.match(contractSource, /required:\s*\['title', 'sentiment'\]/);

  console.log(JSON.stringify({ status: 'passed', semanticStates: 7, aliases: 19, inferredFromText: 0 }, null, 2));
} finally {
  await vite.close();
}
