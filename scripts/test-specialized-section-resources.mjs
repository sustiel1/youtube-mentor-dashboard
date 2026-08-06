import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    getSpecializedSectionResources,
    SPECIALIZED_SECTION_RESOURCES,
  } = await vite.ssrLoadModule('/src/lib/specializedSectionResources.js');

  assert.equal(getSpecializedSectionResources('news').length, 4);
  assert.equal(getSpecializedSectionResources('economic-calendar').length, 2);
  assert.equal(getSpecializedSectionResources('macro').length, 4);
  assert.equal(getSpecializedSectionResources('sectors').length, 8);
  assert.equal(getSpecializedSectionResources('stocks-mentioned').length, 2);
  assert.equal(getSpecializedSectionResources('markets').length, 3);
  assert.deepEqual(getSpecializedSectionResources('unknown'), []);

  const expected = {
    news: [
      'https://il.investing.com/news',
      'https://il.investing.com/news/headlines',
      'https://il.investing.com/news/stock-market-news',
      'https://il.investing.com/news/economy',
    ],
    'economic-calendar': [
      'https://il.investing.com/economic-calendar',
      'https://il.investing.com/central-banks/fed-rate-monitor',
    ],
    macro: [
      'https://il.investing.com/news/economy',
      'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield',
      'https://il.investing.com/central-banks/fed-rate-monitor',
      'https://il.investing.com/commodities/crude-oil',
    ],
    sectors: [
      'https://finviz.com/map?t=sec',
      'https://finviz.com/groups',
      'https://www.tradingview.com/heatmap/stock/',
      'https://www.ssga.com/us/en/intermediary/resources/sector-tracker',
      'https://finviz.com/groups?g=sector&o=-change&v=140',
      'https://finviz.com/groups?g=sector&o=-perf1w&v=140',
      'https://finviz.com/groups?g=sector&o=-perf4w&v=140',
      undefined,
    ],
    'stocks-mentioned': [
      'https://finviz.com/screener?s=ta_topgainers&v=111',
      'https://finviz.com/screener?s=ta_toplosers&v=111',
    ],
    markets: [
      'https://finviz.com/map?t=sec_all',
      'https://finviz.com/futures',
      'https://il.investing.com/indices/major-indices',
    ],
  };
  for (const [section, urls] of Object.entries(expected)) {
    assert.deepEqual(SPECIALIZED_SECTION_RESOURCES[section].map((item) => item.url), urls);
    for (const item of SPECIALIZED_SECTION_RESOURCES[section]) {
      assert.match(item.labelHe, /[\u0590-\u05ff]/);
      assert.match(item.tooltipHe, /[\u0590-\u05ff]/);
    }
  }

  const shortcuts = fs.readFileSync(
    new URL('../src/components/dashboard/SpecializedSectionResourceShortcuts.jsx', import.meta.url),
    'utf8',
  );
  const panels = fs.readFileSync(
    new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
    'utf8',
  );
  const bulk = fs.readFileSync(
    new URL('../src/lib/morningBriefBulkSections.js', import.meta.url),
    'utf8',
  );
  assert.match(shortcuts, /target="_blank"/);
  assert.match(shortcuts, /rel="noopener noreferrer"/);
  assert.match(shortcuts, /event\.stopPropagation\(\)/);
  assert.match(shortcuts, /focus-visible:ring-2/);
  assert.match(shortcuts, /flex-wrap/);
  assert.match(panels, /headerResources=\{<SpecializedSectionResourceShortcuts sectionKey="news" \/>}/);
  assert.match(panels, /headerResources=\{<SpecializedSectionResourceShortcuts sectionKey="economic-calendar" \/>}/);
  assert.match(panels, /headerResources=\{<SpecializedSectionResourceShortcuts sectionKey="macro" \/>}/);
  assert.match(panels, /headerResources=\{<SpecializedSectionResourceShortcuts sectionKey="sectors" \/>}/);
  assert.match(panels, /headerResources=\{<SpecializedSectionResourceShortcuts sectionKey="stocks-mentioned" \/>}/);
  assert.match(panels, /headerResources=\{<SpecializedSectionResourceShortcuts sectionKey="markets" \/>}/);
  assert.equal(SPECIALIZED_SECTION_RESOURCES.sectors[0].key, 'sector-overview');
  assert.equal(SPECIALIZED_SECTION_RESOURCES.sectors[4].key, 'sector-performance-daily');
  assert.equal(new Set(SPECIALIZED_SECTION_RESOURCES.sectors.filter((item) => item.url).map((item) => item.url)).size, 7);
  assert.equal(SPECIALIZED_SECTION_RESOURCES.sectors[7].kind, 'info');
  assert.equal(SPECIALIZED_SECTION_RESOURCES.sectors[7].external, false);
  assert.ok(SPECIALIZED_SECTION_RESOURCES.sectors.every((item) => item.ariaLabelHe && item.tooltipHe));
  assert.match(SPECIALIZED_SECTION_RESOURCES.sectors[4].url, /o=-change/);
  assert.match(SPECIALIZED_SECTION_RESOURCES.sectors[5].url, /o=-perf1w/);
  assert.match(SPECIALIZED_SECTION_RESOURCES.sectors[6].url, /o=-perf4w/);
  assert.match(shortcuts, /data-resource-group/);
  assert.match(shortcuts, /resource\.kind === 'info'/);
  assert.match(SPECIALIZED_SECTION_RESOURCES['stocks-mentioned'][0].url, /ta_topgainers/);
  assert.match(SPECIALIZED_SECTION_RESOURCES['stocks-mentioned'][1].url, /ta_toplosers/);
  assert.equal(SPECIALIZED_SECTION_RESOURCES.markets[0].labelHe, 'מפת השוק');
  assert.notEqual(SPECIALIZED_SECTION_RESOURCES.markets[0].labelHe, 'מדדים בעולם');
  assert.match(shortcuts, /resource\.ariaLabelHe \|\| resource\.tooltipHe/);
  const newsBlock = panels.slice(
    panels.indexOf('export function NewsSection'),
    panels.indexOf('// ── 5. Macro'),
  );
  const regimeBlock = panels.slice(
    panels.indexOf('export function MarketRegimeSection'),
    panels.indexOf('// ── 2. Markets'),
  );
  assert.match(newsBlock, /sectionKey="news"/);
  assert.doesNotMatch(regimeBlock, /sectionKey="news"/);
  assert.doesNotMatch(bulk, /specializedSectionResources|SpecializedSectionResourceShortcuts/);
  assert.match(panels, /data-sector-empty-message/);
  assert.match(panels, /לא נמצאו נתוני סקטורים בסרטון/);
  assert.doesNotMatch(SPECIALIZED_SECTION_RESOURCES.sectors.map((item) => item.url).join('\n'), /^https:\/\/finviz\.com\/?$/m);

  console.log(JSON.stringify({
    status: 'passed',
    sections: 6,
    shortcuts: 23,
    exportImpact: 0,
  }, null, 2));
} finally {
  await vite.close();
}
