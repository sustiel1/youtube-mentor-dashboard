import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const source = fs.readFileSync(
  new URL('../src/components/dashboard/MarketSectorTable.jsx', import.meta.url),
  'utf8',
);

assert.match(source, /data-sector-tools-trigger/);
assert.match(source, /aria-expanded=\{open\}/);
assert.match(source, /aria-controls=\{panelId\}/);
assert.match(source, /role="region"/);
assert.match(source, /setOpenRowIndex\(\(current\) => current === i \? null : i\)/);
assert.match(source, /data-sector-tools-panel/);
assert.match(source, /data-sector-etf-identity/);
assert.match(source, /כלים וגרפים/);
assert.doesNotMatch(source, /<span[^>]*>ETF \{technicals\.etf\}<\/span>/);
assert.match(source, /event\.stopPropagation\(\)/);
assert.match(source, /grid-cols-1/);
assert.match(source, /className=\{actionsColumn \? 'w-full text-right border-collapse table-fixed'/);
assert.match(source, /w-\[22%\] sm:w-\[14%\]/);
assert.match(source, /sm:hidden">כלים/);

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const { resolveSectorDestination } = await vite.ssrLoadModule('/src/utils/finvizLinks.js');
  const { resolveSectorTechnicals } = await vite.ssrLoadModule('/src/lib/sectorTechnicals.js');

  for (const [input, etf] of [[{ sector: 'Energy' }, 'XLE'], [{ sector: 'Software', sourceEtf: 'IGV' }, 'IGV']]) {
    const destination = resolveSectorDestination(input);
    const technicals = resolveSectorTechnicals(input);
    assert.equal(destination.representativeEtf, etf);
    assert.ok(destination.etfUrl);
    assert.equal(technicals.etf, etf);
    assert.ok(technicals.url);
  }

  const unknown = resolveSectorDestination({ sector: 'Future Unknown Sector' });
  assert.equal(unknown.representativeEtf, null);
  assert.equal(unknown.etfUrl, null);
  assert.equal(resolveSectorTechnicals({ sector: 'Future Unknown Sector' }), null);

  console.log(JSON.stringify({ status: 'passed', assertions: 21 }, null, 2));
} finally {
  await vite.close();
}
