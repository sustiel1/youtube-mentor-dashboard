import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  const semantic = await vite.ssrLoadModule('/src/lib/specializedSemanticVisualState.js');
  const cases = [
    [{ sentiment: 'bullish' }, 'positive', 'bg-emerald-50/60'],
    [{ direction: '↑' }, 'positive', 'bg-emerald-50/60'],
    [{ impact: 'negative' }, 'negative', 'bg-red-50/60'],
    [{ direction: '↓' }, 'negative', 'bg-red-50/60'],
    [{ status: 'warning' }, 'warning', 'bg-amber-50/70'],
    [{ status: 'scheduled' }, 'informational', 'bg-sky-50/60'],
    [{ event: 'earnings', affectedStocks: ['CRWD'] }, 'neutral', 'bg-slate-50/80'],
  ];
  for (const [evidence, expected, classToken] of cases) {
    assert.equal(semantic.resolveSemanticVisualState(evidence), expected);
    assert.match(semantic.semanticRowClass(evidence), new RegExp(classToken.replace('/', '\\/')));
  }
  assert.equal(semantic.resolveSemanticVisualState({ event: 'Company crashes after earnings', affectedStocks: ['BAD'] }), 'neutral', 'free text/company identity must not infer sentiment');
  assert.equal(semantic.resolveSemanticVisualState({ change: 0 }), 'neutral', 'numeric zero must remain neutral');

  const display = await vite.ssrLoadModule('/src/lib/morningBriefDisplay.js');
  const companyRows = display.extractCompanyEventRows({ catalysts: [
    { type: 'earnings', event: 'Positive event', sentiment: 'bullish' },
    { type: 'company', event: 'Negative event', impact: 'negative' },
    { type: 'corporate', event: 'Unknown event' },
  ] });
  assert.deepEqual(companyRows.map((row) => semantic.resolveSemanticVisualState(row)), ['positive', 'negative', 'neutral']);

  const dashboard = fs.readFileSync(new URL('../src/components/dashboard/MorningBriefDashboard.jsx', import.meta.url), 'utf8');
  const tableLayout = fs.readFileSync(new URL('../src/components/dashboard/briefTableLayout.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /<SemanticTableRow key=\{id\} evidence=\{record\}/);
  assert.match(tableLayout, /data-semantic-visual-state=\{state\}/);
  assert.match(tableLayout, /focus-within:ring-2/);
  assert.match(dashboard, /type="checkbox"/);
  console.log('specialized semantic rows: 9/9 passed');
} finally {
  await vite.close();
}
