import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { splitTranscript } = require('../shared/marketExtractionContract.cjs');

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});

try {
  const {
    resolveAnalysisRoute,
    buildAnalysisTranscript,
    getCanonicalMarketAnalysisState,
  } = await vite.ssrLoadModule('/src/lib/canonicalAnalysisRouting.js');

  assert.equal(resolveAnalysisRoute({ videoType: 'morningBrief' }), 'market');
  assert.equal(resolveAnalysisRoute({ tabsKey: 'morningBrief' }), 'market');
  assert.equal(resolveAnalysisRoute({ videoType: 'morningBrief', gemType: 'news' }), 'market');
  assert.equal(resolveAnalysisRoute({ videoType: 'general', tabsKey: 'general' }), 'general');

  const plain = `${'x'.repeat(11108)} END`;
  assert.equal(buildAnalysisTranscript(plain, []), plain);
  const chunks = splitTranscript(plain, { chunkChars: 7000, overlapChars: 400 });
  assert.equal(chunks.length, 2);
  assert.equal(chunks.at(-1).end, plain.length);
  assert.ok(chunks.at(-1).text.endsWith('END'));

  assert.deepEqual(
    getCanonicalMarketAnalysisState({
      provider: 'gems',
      marketBriefData: { contentType: 'marketBrief', indices: [{}] },
    }),
    { canonical: false, source: 'gems' },
  );
  assert.deepEqual(
    getCanonicalMarketAnalysisState({
      provider: 'claude',
      marketBriefData: { contentType: 'marketBrief', extractionMeta: { partial: false } },
    }),
    { canonical: true, source: 'claude_market_extraction' },
  );

  const panel = fs.readFileSync(new URL('../src/components/dashboard/VideoDetailPanel.jsx', import.meta.url), 'utf8');
  const adapter = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  const diagnostics = fs.readFileSync(new URL('../src/components/dashboard/AiMappingModal.jsx', import.meta.url), 'utf8');

  assert.match(panel, /analysisStatus: "failed",\s+analysisError: message/);
  assert.match(panel, /marketExtractionMeta: result\.marketBriefData\.extractionMeta \|\| null/);
  assert.match(panel, /resolveAnalysisRoute\(\{\s+videoType,\s+tabsKey: selectedTabsConfigKey/);
  assert.match(adapter, /body\.analysisRoute !== 'market'/);
  assert.match(adapter, /GENERAL_ANALYSIS_NOT_SUPPORTED_LOCALLY/);
  assert.match(diagnostics, /resolveDiagnosticTab/);
  assert.match(diagnostics, /analysisDataStatus/);
  assert.match(diagnostics, /canonical:\s+canonicalAnalysis\.canonical/);

  console.log(JSON.stringify({
    status: 'passed',
    tests: 17,
    transcriptChars: plain.length,
    chunks: chunks.length,
    paidCalls: 0,
  }, null, 2));
} finally {
  await vite.close();
}
