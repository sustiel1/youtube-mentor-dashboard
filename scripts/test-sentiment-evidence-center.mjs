import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts', 'fixtures', 'sentiment-evidence-center.json'),
  'utf8',
));
const require = createRequire(import.meta.url);
const { MARKET_BRIEF_RESPONSE_SCHEMA } = require('../shared/marketExtractionContract.cjs');

assert.ok(MARKET_BRIEF_RESPONSE_SCHEMA.properties.sentiment, 'structured schema must accept sentiment evidence');
assert.ok(MARKET_BRIEF_RESPONSE_SCHEMA.properties.sentiment.items.properties.sourceUrl);
assert.ok(MARKET_BRIEF_RESPONSE_SCHEMA.properties.sentiment.items.properties.verificationState);

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const evidence = await vite.ssrLoadModule('/src/lib/sentimentEvidence.js');
  const display = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const bulk = await vite.ssrLoadModule('/src/lib/morningBriefBulkSections.js');
  const tabs = await vite.ssrLoadModule('/src/config/videoTabsConfig.js');
  const obsidian = await vite.ssrLoadModule('/src/lib/obsidianVideoMergeItems.js');
  const diagnostics = await vite.ssrLoadModule('/src/lib/aiMappingDiagnostics.js');
  const knowledge = await vite.ssrLoadModule('/src/lib/videoKnowledgePackage.js');
  const persistence = await vite.ssrLoadModule('/src/lib/marketBriefPersistenceGuard.js');

  const cases = [
    ['morning', fixture.morning, 'morning-brief'],
    ['generic', fixture.generic, 'morning-brief'],
    ['evening', fixture.evening, 'evening-brief'],
    ['legacy', fixture.legacy, 'morning-brief'],
  ];

  for (const [name, payload, slug] of cases) {
    const video = { id: `sentiment-${name}`, title: `Sentiment ${name}` };
    const src = display.getSpecializedSrc(payload);
    const selected = display.extractSentimentItems(src);
    const formatted = selected.map(evidence.formatSentimentEvidenceText);
    const sections = bulk.buildMorningBriefBulkSections(video, payload);
    const sentimentSection = sections.find((section) => section.key === 'sentiment');
    assert.deepEqual(sentimentSection?.items || [], formatted, `${name}: renderer rows must use canonical evidence selector`);
    assert.deepEqual(
      tabs.extractVideoTabItems(video, 'brief-sentiment', payload),
      formatted,
      `${name}: dedicated tab must match canonical rows`,
    );
    assert.equal(
      diagnostics.resolveAiMappingTab({ video, marketBriefData: payload, normalizedSubCategory: slug, tabKey: 'brief-sentiment' }).count,
      formatted.length,
      `${name}: AI Mapping sentiment count parity`,
    );

    const exported = obsidian.collectVideoObsidianMergeItems({ effectiveVideo: video, marketBriefData: payload })
      .filter((item) => item.sectionLabel === sentimentSection?.label)
      .map((item) => item.text);
    assert.deepEqual(exported, formatted, `${name}: export parity`);

    const total = sections.reduce((sum, section) => sum + section.items.length, 0);
    assert.equal(
      diagnostics.resolveAiMappingTab({ video, marketBriefData: payload, normalizedSubCategory: slug, tabKey: 'specialized' }).count,
      total,
      `${name}: Specialized diagnostic count parity`,
    );
    assert.equal(
      knowledge.collectVideoKnowledgePackage({ effectiveVideo: video, marketBriefData: payload })
        .sections.find((section) => section.key === 'specialized').count,
      total,
      `${name}: displayed count parity`,
    );
  }

  const morning = display.extractSentimentItems(display.getSpecializedSrc(fixture.morning));
  assert.equal(morning.length, 5);
  assert.equal(morning[0].direction, 'bullish');
  assert.equal(morning[0].verificationState, 'external-verified');
  assert.equal(morning[0].sourceUrl, 'https://www.aaii.com/sentimentsurvey');
  assert.equal(morning[0].value, 40.2);
  assert.equal(morning[1].direction, 'bearish');
  assert.equal(morning[1].value, 0);
  assert.equal(morning[1].confidence, 0);
  assert.equal(morning[1].verificationState, 'video-unverified');
  assert.equal(morning[2].direction, 'neutral');
  assert.equal(morning[2].value, false);
  assert.equal(morning[3].direction, 'unverified', 'free text must not infer Bullish');
  assert.equal(morning[4].etfTarget, null);
  assert.equal(morning[4].sourceUrl, '', 'unknown assets must not receive an invented destination');

  const morningText = morning.map(evidence.formatSentimentEvidenceText).join('\n');
  assert.match(morningText, /ניתוח הסרטון — לא אומת חיצונית/);
  assert.match(morningText, /כיוון: ניטרלי/);
  assert.match(morningText, /ערך: 0/);
  assert.match(morningText, /ערך: לא/);
  assert.match(morningText, /ביטחון: 0\.85/);
  assert.doesNotMatch(morningText, /תוכן תמלול מלא|rawProviderPayload|אסור להציג|\[object Object\]|\{\s*"/);

  const generic = display.extractSentimentItems(display.getSpecializedSrc(fixture.generic));
  assert.equal(generic[0].direction, 'bullish');
  assert.equal(generic[1].direction, 'unverified', 'legacy free text remains unverified');
  const evening = display.extractSentimentItems(display.getSpecializedSrc(fixture.evening));
  assert.equal(evening[0].direction, 'neutral');
  assert.equal(evening[0].value, 17.3);

  const sanitized = evidence.normalizeSentimentEvidenceItem({
    label: 'בדיקת URL',
    direction: 'neutral',
    source: 'External source',
    sourceUrl: 'https://example.com/evidence?view=compact&token=secret',
    evidence: 'ראיה חיצונית',
    externallyVerified: true,
    etfTarget: null,
  });
  assert.match(sanitized.sourceUrl, /view=compact/);
  assert.doesNotMatch(sanitized.sourceUrl, /token|secret/);

  const persistenceResult = persistence.resolveMarketBriefPersistence({
    candidate: { contentType: 'marketBrief', sentiment: morning },
  });
  assert.equal(persistenceResult.accepted, true);
  assert.equal(persistenceResult.data.sentiment[1].confidence, 0);
  assert.equal(persistenceResult.data.sentiment[2].value, false);

  assert.deepEqual(display.extractSentimentItems(display.getSpecializedSrc(fixture.empty)), []);
  assert.deepEqual(tabs.extractVideoTabItems({}, 'brief-sentiment', fixture.empty), []);

  const panelSource = fs.readFileSync(
    path.join(root, 'src', 'components', 'dashboard', 'MorningBriefPanels.jsx'),
    'utf8',
  );
  const sentimentUiSource = panelSource.slice(
    panelSource.indexOf('// ── 6. Sentiment'),
    panelSource.indexOf('// ── 7. Economic Calendar'),
  );
  assert.match(sentimentUiSource, /data-sentiment-evidence-center/);
  assert.doesNotMatch(sentimentUiSource, /getSentimentSourceLink|LinkedMarketText/);
  assert.doesNotMatch(sentimentUiSource, /resolveTone\(valueText\)/);

  console.log(JSON.stringify({
    status: 'passed',
    morning: morning.length,
    generic: generic.length,
    evening: evening.length,
    explicitDirectionOnly: true,
    externalVerification: true,
    nullableEtfSafe: true,
    rendererExportCountParity: true,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
