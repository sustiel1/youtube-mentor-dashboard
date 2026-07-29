import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { buildMorningBriefBulkSections } = await server.ssrLoadModule('/src/lib/morningBriefBulkSections.js');

  const payload = {
    contentType: 'marketBrief',
    marketOverview: {
      generalMood: 'mixed',
      summary: 'Broad market steady',
      empty: { direction: 'out' },
      spx: { direction: 'up', change: '0%', note: 'unchanged' },
      vix: { level: 0, direction: 'flat', note: 'zero market level' },
      oil: { level: '80', note: 'oil note' },
      bitcoin: { level: '63400', note: 'bitcoin note' },
      dollar: { level: '101.5', note: 'dollar note' },
    },
    catalysts: [{
      description: 'Fed decision',
      impact: 'mixed',
      affectedStocks: ['AAPL'],
      timeframe: 'today',
    }],
    sectorRotation: [{
      sector: 'Semiconductors',
      direction: 'out',
      reason: 'profit taking',
      stocks: ['MU', 'SNDK'],
      etf: 'SOXX',
    }],
    tradingOpportunities: [{
      ticker: 'IGV',
      setup: 'Breakout',
      entry: '100',
      stop: '95',
      target: '110',
      rrRatio: '1:2',
      timeframe: 'swing',
      confidence: 'medium',
      reason: 'relative strength',
    }],
    stocksMentioned: [{
      ticker: 'ZERO',
      reason: 'zero/false regression',
      change: '0%',
      isNewToWatch: false,
    }, {
      ticker: 'SNDK',
      reason: 'priceLevel regression',
      priceLevel: 1100,
    }],
    watchlistLevels: [
      { ticker: 'SOXX', level: '17', condition: 'below', significance: 'critical', action: 'buy' },
      { ticker: 'QQQ', level: 0, condition: 'at', significance: 'critical', action: 'watch', note: 'zero level' },
    ],
    keyLevels: [{ asset: 'SOXX', level: '532', type: 'support', note: 'key support' }],
    top5Insights: Array.from({ length: 5 }, (_, i) => ({ rank: i + 1, asset: `Asset ${i}`, note: `Insight ${i}` })),
    learningInsights: [{ insight: 'Wait for stabilization', applicableToApp: false }],
    allPoints: Array.from({ length: 25 }, (_, i) => ({ point: `Point ${i}`, category: 'market' })),
  };

  const sections = buildMorningBriefBulkSections({}, payload);
  const rows = sections.flatMap((section) => section.items.map((text) => ({
    section: section.key,
    text,
  })));
  const texts = rows.map((row) => row.text);

  assert.ok(rows.length > 30, 'mapping must not truncate item counts above 30');
  assert.ok(!texts.includes('mixed'), 'mixed must not render as standalone content');
  assert.ok(!texts.includes('out'), 'out must not render as standalone content');
  assert.ok(!texts.includes('into'), 'into must not render as standalone content');
  assert.ok(!texts.some((text) => /^—\s*·\s*out$/i.test(text)), 'empty market rows must be rejected');
  assert.ok(texts.some((text) => text.includes('השפעה: mixed')), 'calendar impact must retain context');
  assert.ok(texts.some((text) => text.includes('זרימת כספים: out')), 'sector direction must retain context');
  assert.ok(texts.some((text) => text.includes('ETF: SOXX') && text.includes('MU, SNDK')), 'sector details must be preserved');
  assert.ok(texts.some((text) => text.includes('כניסה: 100') && text.includes('יחס סיכון/סיכוי: 1:2')), 'trade plan must be complete');
  assert.ok(texts.some((text) => text.includes('0%') && text.includes('חדש למעקב: לא')), 'zero and false values must be preserved');
  assert.ok(texts.some((text) => text.includes('Wait for stabilization') && text.includes('יישומי לאפליקציה: לא')), 'learning false value must be preserved');
  assert.ok(texts.some((text) => text.startsWith('VIX ·') && text.includes('· 0 ·')), 'numeric zero market level must be preserved');
  assert.ok(texts.some((text) => text.startsWith('OIL ·') && text.includes('· 80 ·')), 'oil level must enrich its existing market row');
  assert.ok(texts.some((text) => text.startsWith('BITCOIN ·') && text.includes('· 63400 ·')), 'bitcoin level must enrich its existing market row');
  assert.ok(texts.some((text) => text.startsWith('DOLLAR ·') && text.includes('· 101.5 ·')), 'dollar level must enrich its existing market row');
  assert.ok(texts.some((text) => text.startsWith('SNDK ·') && text.includes('1100')), 'stock priceLevel must enrich its existing stock row');
  assert.ok(texts.some((text) => text.startsWith('SOXX · 17') && text.includes('תנאי: below') && text.includes('חשיבות: critical') && text.includes('פעולה: buy')), 'SOXX watchlist context must be complete');
  assert.ok(texts.some((text) => text.startsWith('QQQ · 0') && text.includes('תנאי: at') && text.includes('חשיבות: critical') && text.includes('פעולה: watch')), 'QQQ watchlist context and zero must be complete');
  for (const asset of ['VIX', 'OIL', 'BITCOIN', 'DOLLAR']) {
    assert.equal(rows.filter(({ section, text }) => section === 'markets' && text.startsWith(`${asset} ·`)).length, 1, `${asset} enrichment must not create a duplicate market row`);
  }
  assert.equal(rows.filter(({ section, text }) => section === 'stocks-mentioned' && text.startsWith('SNDK ·')).length, 1, 'priceLevel enrichment must not create a duplicate stock row');
  assert.equal(rows.filter(({ section, text }) => section === 'levels' && text.startsWith('SOXX · 17')).length, 1, 'SOXX enrichment must not create a duplicate level row');
  assert.equal(rows.filter(({ section, text }) => section === 'levels' && text.startsWith('QQQ · 0')).length, 1, 'QQQ enrichment must not create a duplicate level row');

  const ids = rows.map((row, index) => `${row.section}:${index}:${row.text}`);
  assert.equal(new Set(ids).size, ids.length, 'export rows must remain one-to-one with displayed rows');

  console.log(`specialized coverage: ${rows.length} rows, all assertions passed`);

  if (process.argv[2]) {
    const realPayload = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const realSections = buildMorningBriefBulkSections({}, realPayload);
    const realRows = realSections.flatMap((section) => section.items.map((text) => ({
      section: section.key,
      text,
    })));
    const malformed = realRows.filter(({ text }) =>
      ['mixed', 'out', 'into'].includes(text.trim().toLowerCase())
      || /^—\s*·\s*(out|into)$/i.test(text.trim())
    );
    assert.deepEqual(malformed, [], 'real payload must not contain contextless enum or empty market rows');
    const expectSingleRealRow = (section, prefix, fragments) => {
      const matches = realRows.filter((row) => row.section === section && row.text.startsWith(prefix));
      assert.equal(matches.length, 1, `${prefix} must enrich exactly one existing ${section} row`);
      for (const fragment of fragments) {
        assert.ok(matches[0].text.includes(fragment), `${prefix} row must include ${fragment}`);
      }
    };
    expectSingleRealRow('markets', 'VIX ·', ['18.6']);
    expectSingleRealRow('markets', 'OIL ·', ['80']);
    expectSingleRealRow('markets', 'BITCOIN ·', ['63400']);
    expectSingleRealRow('markets', 'DOLLAR ·', ['101.5']);
    expectSingleRealRow('stocks-mentioned', 'SNDK ·', ['1100']);
    expectSingleRealRow('levels', 'SOXX · PE 17', ['תנאי: below', 'חשיבות: critical', 'פעולה: buy']);
    expectSingleRealRow('levels', 'QQQ · MA 150', ['תנאי: at', 'חשיבות: critical', 'פעולה: watch']);
    console.log(JSON.stringify({
      realPayloadCount: realRows.length,
      sectionCounts: Object.fromEntries(realSections.map((section) => [section.key, section.items.length])),
      malformedCount: malformed.length,
    }, null, 2));
  }
} finally {
  await server.close();
}
