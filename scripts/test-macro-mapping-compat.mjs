/**
 * Backward-compatibility smoke test for the macro mapping fix in
 * scripts/test-macro-specialized-regression.mjs — checks the macro pipeline
 * against non-morning-brief / legacy-shaped payloads so the fix stays additive.
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/test-macro-mapping-compat.mjs
 */
import {
  extractMacroIndicatorRows,
  getSpecializedSrc,
} from '../src/lib/morningBriefDisplay.js';

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures += 1; }
}

console.log('=== non-market-brief payload (no macroFactors anywhere) ===');
const nonMarketBrief = { contentType: 'general', rawData: {}, universalTabs: {} };
const src1 = getSpecializedSrc(nonMarketBrief);
const rows1 = extractMacroIndicatorRows(src1);
check('returns empty array, does not throw', Array.isArray(rows1) && rows1.length === 0);

console.log('\n=== legacy Dixie/US10Y duplicate-label payload (pre-existing dedup path) ===');
const legacyBrief = {
  contentType: 'marketBrief',
  rawData: {
    macroFactors: [
      { name: 'הדולר (Dixie)', description: 'מתחזק ל-101.2 - 101.3' },
      { indicator: 'Dixie', value: '101.3' },
      { name: 'אג"ח', description: 'תשואות מרימות ראש' },
    ],
  },
  universalTabs: {},
};
const src2 = getSpecializedSrc(legacyBrief);
const rows2 = extractMacroIndicatorRows(src2);
console.log(rows2.map((r) => `  ${r.indicator} :: ${r.value || r.description}`).join('\n'));
check('Dixie label + Dixie indicator collapse into one row (pre-existing itemMergeSignature normalization)',
  rows2.filter((r) => /dixie|דולר/i.test(r.indicator)).length === 1);
check('unrelated bond-yield row is not swallowed by the Dixie group', rows2.some((r) => /אג"ח|אגח/.test(r.indicator)));

console.log(`\n${failures === 0 ? 'PASS' : `FAIL: ${failures} assertion(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
