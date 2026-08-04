import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(fs.readFileSync(
  path.join(root, 'scripts/fixtures/market-links-sector-tools.json'),
  'utf8',
));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { getMarketAssetDestination } = await vite.ssrLoadModule('/src/lib/marketAssetDestinations.js');
  const { segmentMarketLinkText } = await vite.ssrLoadModule('/src/lib/marketLinkText.js');
  const { CANONICAL_SECTOR_TOOLS, SECTOR_RESEARCH_TOOLS, resolveSectorTools } =
    await vite.ssrLoadModule('/src/lib/sectorTools.js');

  for (const textCase of fixture.textCases) {
    const segments = segmentMarketLinkText(textCase.input);
    assert.equal(segments.map((segment) => segment.text).join(''), textCase.input, `${textCase.name}: preserves text`);
    const links = segments.filter((segment) => segment.type === 'link');
    assert.deepEqual(links.map((segment) => segment.text), textCase.linkedText, `${textCase.name}: links`);
    for (const plain of textCase.plainText) {
      assert.ok(textCase.input.includes(plain), `${textCase.name}: fixture contains ${plain}`);
      assert.ok(!links.some((segment) => segment.text.includes(plain)), `${textCase.name}: ${plain} stays plain`);
    }
  }

  assert.equal(getMarketAssetDestination('MYST'), null, 'unknown ticker stays plain');
  assert.equal(getMarketAssetDestination('BRK'), null, 'ambiguous ticker stays plain');
  assert.equal(getMarketAssetDestination(null), null, 'null destination is safe');
  assert.match(getMarketAssetDestination('AAPL').url, /^https:\/\/finviz\.com\/quote\.ashx\?t=AAPL/);
  assert.match(getMarketAssetDestination('XLK').url, /^https:\/\/finviz\.com\/quote\.ashx\?t=XLK/);
  assert.equal(getMarketAssetDestination('BONDS10Y').url, 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield');

  assert.equal(CANONICAL_SECTOR_TOOLS.length, 11);
  for (const expected of fixture.sectors) {
    const tools = resolveSectorTools(expected.name);
    assert.ok(tools, expected.name);
    assert.equal(tools.etf, expected.etf);
    assert.equal(tools.exchange, 'AMEX');
    assert.match(tools.etfDestination.url, new RegExp(`finviz\\.com/quote\\.ashx\\?t=${expected.etf}`));
    assert.equal(tools.technicalsUrl, `https://www.tradingview.com/symbols/AMEX-${expected.etf}/technicals/`);
  }
  assert.equal(resolveSectorTools('Unknown Sector'), null);
  assert.equal(resolveSectorTools({ sector: 'Technology', etf: 'MYST' }), null);

  const requiredTools = new Set([
    'finviz-map', 'finviz-daily', 'finviz-weekly', 'finviz-monthly',
    'tradingview-heatmap', 'state-street-tracker',
  ]);
  assert.deepEqual(new Set(SECTOR_RESEARCH_TOOLS.map((tool) => tool.id)), requiredTools);
  for (const tool of SECTOR_RESEARCH_TOOLS) {
    assert.match(tool.url, /^https:\/\//, `${tool.id}: secure URL`);
    assert.notEqual(tool.url, 'https://finviz.com/', `${tool.id}: not generic Finviz homepage`);
    assert.ok(!tool.url.includes('search.ashx'), `${tool.id}: no guessed search link`);
  }

  const linkedSource = read('src/components/shared/LinkedMarketText.jsx');
  const sectorSource = read('src/components/dashboard/MarketSectorTable.jsx');
  const marketTableSource = read('src/components/dashboard/MarketIndicesTable.jsx');
  const visualSource = read('src/components/dashboard/MorningBriefVisualPrimitives.jsx');
  const stockSource = read('src/components/dashboard/MorningBriefPanels.jsx');
  const macroSource = read('src/components/dashboard/MacroGemDashboard.jsx');
  const summarySource = read('src/components/dashboard/SummaryBriefingView.jsx');
  for (const source of [linkedSource, sectorSource, marketTableSource, visualSource, stockSource, macroSource, summarySource]) {
    assert.ok(!source.includes('getSectorFinvizUrl('), 'canonical UI must not use sector search fallback');
  }
  assert.match(linkedSource, /segmentMarketLinkText/);
  assert.match(linkedSource, /target="_blank"/);
  assert.match(linkedSource, /rel="noopener noreferrer"/);
  assert.match(linkedSource, /stopPropagation\(\)/);
  assert.match(sectorSource, /data-sector-tools-toggle/);
  assert.match(sectorSource, /data-sector-tools-panel/);
  assert.match(sectorSource, /data-sector-etf/);
  assert.match(sectorSource, /aria-expanded=/);
  assert.match(sectorSource, /stopPropagation\(\)/);
  assert.match(stockSource, /getMarketAssetDestination\(ticker\)/);
  assert.match(marketTableSource, /getMarketAssetDestination/);
  assert.match(visualSource, /getMarketAssetDestination/);
  assert.match(macroSource, /getMarketAssetDestination/);
  assert.match(summarySource, /getMarketAssetDestination\(result\.ticker\)/);

  console.log(JSON.stringify({
    status: 'passed',
    textCases: fixture.textCases.length,
    canonicalAssets: 9,
    sectorEtfs: fixture.sectors.length,
    sectorResearchTools: SECTOR_RESEARCH_TOOLS.length,
  }, null, 2));
} finally {
  await vite.close();
}
