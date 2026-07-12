/**
 * Regression test: Specialized tab → Macro section must render every macro
 * factor from rawData.macroFactors, even when the same event also appears
 * under Stocks (Oracle) or Markets (Bitcoin), and even when
 * universalTabs.specialized.macroFactors only has a partial/shorter copy.
 *
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/test-macro-specialized-regression.mjs
 *
 * Background: docs/MACRO_SPECIALIZED_MAPPING_AUDIT.md
 */
import { macroSpecializedFixture as fixture } from './fixtures/macro-specialized-regression.fixture.mjs';
import {
  extractMacroIndicatorRows,
  extractUnifiedStocks,
  extractMarketDashboardRows,
  extractKeyLevelRows,
  getSpecializedSrc,
  mergeMorningBriefSpecializedSource,
} from '../src/lib/morningBriefDisplay.js';

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

console.log('=== macro received (rawData.macroFactors + universalTabs.specialized.macroFactors) ===');
const receivedRaw = fixture.rawData.macroFactors.length;
const receivedSpec = fixture.universalTabs.specialized.macroFactors.length;
console.log(`received: rawData=${receivedRaw} specialized=${receivedSpec}`);

const merged = mergeMorningBriefSpecializedSource(fixture);
console.log(`\n=== macro normalized (post-merge candidate pool) ===`);
console.log(`candidates: ${merged.macroFactors?.length ?? 0}`);

const src = getSpecializedSrc(fixture);
const rows = extractMacroIndicatorRows(src);
console.log(`\n=== macro deduplicated / rendered ===`);
console.log(`rendered: ${rows.length}`);
rows.forEach((r, i) => console.log(`  [${i}] ${r.indicator} — ${r.description}`));

// ── Assertions ────────────────────────────────────────────────────────
console.log('\n=== assertions ===');
check('exactly 3 macro rows rendered', rows.length === 3);

const fedRow = rows.find((r) => /פד|ריבית|ועדות/.test(r.indicator));
check('Fed row present', Boolean(fedRow));
check('Fed row keeps rate-outlook detail (not just headline)', Boolean(fedRow?.description?.includes('נתונים כלכליים')));

const oracleRow = rows.find((r) => /אורקל/.test(r.indicator));
check('Oracle row present', Boolean(oracleRow));
check('Oracle row mentions BBB-', Boolean(oracleRow?.description?.includes('BBB')));

const cryptoRow = rows.find((r) => /קריפטו|ביטקוין|אתריום/.test(r.indicator) || /ביטקוין|אתריום/.test(r.description));
check('Crypto row present', Boolean(cryptoRow));
check('Crypto row mentions Bitcoin (64,000/64000)', Boolean(cryptoRow?.description?.match(/64,?000/)));
check('Crypto row does not drop Ethereum (1794/1,794)', Boolean(cryptoRow?.description?.match(/1,?794/)));

const seenSigs = new Set();
let hasExactDuplicate = false;
for (const r of rows) {
  const sig = `${r.indicator}|${r.description}`;
  if (seenSigs.has(sig)) hasExactDuplicate = true;
  seenSigs.add(sig);
}
check('no exact-duplicate macro cards', !hasExactDuplicate);

const stocks = extractUnifiedStocks(fixture, null);
check('Oracle still appears under Stocks (cross-category duplication allowed)', stocks.some((s) => s.ticker === 'ORCL'));

const marketRows = extractMarketDashboardRows(src);
const keyLevelRows = extractKeyLevelRows(src);
check('Bitcoin still appears under Markets/keyLevels', keyLevelRows.some((r) => r.symbol === 'BTC') || marketRows.some((r) => r.asset === 'BTC'));

console.log(`\n${failures === 0 ? 'PASS' : `FAIL: ${failures} assertion(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
