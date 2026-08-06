import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const primitives = await vite.ssrLoadModule('/src/components/dashboard/MorningBriefVisualPrimitives.jsx');
  const expected = {
    CRWD: 'https://finviz.com/quote.ashx?t=CRWD',
    AVGO: 'https://finviz.com/quote.ashx?t=AVGO',
    SPX: 'https://finviz.com/stock?t=SPY',
  };
  for (const [symbol, url] of Object.entries(expected)) {
    const destination = primitives.resolveVerifiedExternalSymbolDestination(symbol);
    assert.equal(destination?.url, url, symbol);
    assert.equal(destination?.canonicalAsset, symbol, `${symbol} remains visible/canonical`);
  }
  assert.equal(primitives.resolveVerifiedExternalSymbolDestination('UNKNOWN'), null);
  assert.equal(primitives.resolveVerifiedExternalSymbolDestination('FAKECO'), null);

  const dashboard = fs.readFileSync(new URL('../src/components/dashboard/MorningBriefDashboard.jsx', import.meta.url), 'utf8');
  const primitiveSource = fs.readFileSync(new URL('../src/components/dashboard/MorningBriefVisualPrimitives.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /sectionKey === 'company-events' && fieldKey === 'affectedStocks'/);
  assert.match(dashboard, /sectionKey === 'levels' && fieldKey === 'symbol'/);
  assert.match(dashboard, /<ExternalSymbolLink symbol=\{asset\} verifiedAssetOnly>/);
  assert.match(primitiveSource, /target="_blank"/);
  assert.match(primitiveSource, /rel="noopener noreferrer"/);
  assert.match(primitiveSource, /e\.stopPropagation\(\)/);
  assert.match(primitiveSource, /e\.key === ' '/);
  assert.match(primitiveSource, /getVerifiedFinvizStockUrl/);

  console.log('structured asset links: 14/14 passed');
} finally {
  await vite.close();
}
