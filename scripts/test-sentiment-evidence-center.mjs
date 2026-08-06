import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const evidence = await vite.ssrLoadModule('/src/lib/sentimentEvidence.js');
  const display = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const legacy = display.extractSentimentItems({ sentiment: [{ label: 'סנטימנט מאקרו', value: 'חיובי', sentiment: 'Bullish', reason: 'ירידה באינפלציה', drivers: ['ציפיות ריבית'] }] });
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].scope, 'macro');
  assert.equal(legacy[0].sentiment, 'bullish');
  assert.equal(legacy[0].sourceType, 'video-claim');
  assert.equal(legacy[0].verificationStatus, 'unverified');
  assert.equal(legacy[0].value, null);
  assert.deepEqual(legacy[0].drivers, ['ציפיות ריבית']);
  assert.doesNotMatch(legacy[0].reason, /Bullish/i);

  const sector = evidence.normalizeSentimentEvidenceItem({ label: 'סנטימנט סקטור התוכנה', sentiment: 'Bearish', reason: 'חולשה יחסית', etf: 'IGV' });
  assert.equal(sector.scope, 'sector');
  assert.equal(sector.subject, 'התוכנה');
  assert.equal(evidence.getSentimentDestination(sector).url, 'https://finviz.com/groups.ashx');
  assert.equal(evidence.getSentimentLabelHe(sector.sentiment), 'דובי');

  for (const [scope, url] of [
    ['broad-market', 'https://www.cnn.com/markets/fear-and-greed'],
    ['retail-investors', 'https://www.aaii.com/sentimentsurvey'],
    ['active-managers', 'https://www.naaim.org/programs/naaim-exposure-index/'],
    ['options-positioning', 'https://www.cboe.com/us/options/market_statistics/daily/'],
    ['volatility', 'https://www.cboe.com/tradable_products/vix/'],
  ]) assert.equal(evidence.getSentimentDestination({ scope }).url, url);
  assert.equal(evidence.getSentimentDestination({ scope: 'unknown' }), null);
  assert.equal(evidence.normalizeSentimentEvidenceItem({ label: 'VIX', scope: 'volatility', value: 0, sentiment: 'neutral', confidence: 0, isLive: false }).value, 0);
  assert.equal(evidence.normalizeSentimentEvidenceItem({ label: 'Conflict', sentiment: 'mixed', verificationStatus: 'conflicting' }).verificationStatus, 'conflicting');
  assert.equal(evidence.getVerifiedExplicitEtfUrl(null, undefined), '');
  assert.equal(evidence.getVerifiedExplicitEtfUrl(null, 'IGV'), '');
  assert.equal(evidence.getVerifiedExplicitEtfUrl({ representativeEtf: null, etfUrl: null }, 'IGV'), '');
  assert.equal(evidence.getVerifiedExplicitEtfUrl({ representativeEtf: 'XLK', etfUrl: 'https://example.invalid/XLK' }, 'IGV'), '');
  assert.equal(evidence.getVerifiedExplicitEtfUrl({ representativeEtf: 'IGV', etfUrl: 'https://finviz.com/quote.ashx?t=IGV' }, 'igv'), 'https://finviz.com/quote.ashx?t=IGV');

  const panelSource = fs.readFileSync('src/components/dashboard/MorningBriefPanels.jsx', 'utf8');
  assert.match(panelSource, /target="_blank" rel="noopener noreferrer"/);
  assert.match(panelSource, /אין כאן המלצת קנייה או מכירה/);
  assert.match(panelSource, /data-sentiment-evidence-panel/);
  assert.match(panelSource, /MorningBriefBulkCheckbox/);

  console.log(JSON.stringify({ status: 'passed', semanticCases: 21, legacyCount: legacy.length, noTradingRecommendation: true, nullEtfSafe: true }, null, 2));
} finally { await vite.close(); }
