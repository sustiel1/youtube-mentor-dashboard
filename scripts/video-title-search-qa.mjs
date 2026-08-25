import assert from 'node:assert/strict';
import {
  matchesVideoTitleSearch,
  normalizeVideoTitleSearchText,
} from '../src/lib/videoTitleSearch.js';

const hebrewTitle = 'הסיבה האמיתית שפלנטיר זינקה 29% — ואתם מפספסים אותה';
const englishTitleWithRepeatedWhitespace = 'לייט נייט דיווחים AMD ANET ALAB  SPCX OPEN KTOS';
const punctuationTitle = '❌ מייקל ברי שוב נגד פלנטיר — וסקטור השבבים - ישבר או יטוס?';

assert.equal(matchesVideoTitleSearch(hebrewTitle, hebrewTitle), true, 'exact Hebrew title');
assert.equal(matchesVideoTitleSearch(hebrewTitle, 'פלנטיר זינקה'), true, 'partial Hebrew title');
assert.equal(matchesVideoTitleSearch(hebrewTitle, '  פלנטיר  '), true, 'trimmed Hebrew query');
assert.equal(matchesVideoTitleSearch(englishTitleWithRepeatedWhitespace, 'amd anet'), true, 'case-insensitive English query');
assert.equal(
  matchesVideoTitleSearch(englishTitleWithRepeatedWhitespace, 'AMD ANET ALAB SPCX OPEN KTOS'),
  true,
  'visible single whitespace matches repeated stored whitespace',
);
assert.equal(
  matchesVideoTitleSearch(punctuationTitle, 'פלנטיר - וסקטור השבבים'),
  true,
  'typographic dash variants match',
);
assert.equal(matchesVideoTitleSearch(hebrewTitle, 'תוצאה שאינה קיימת'), false, 'unrelated query');
assert.equal(matchesVideoTitleSearch(hebrewTitle, ''), true, 'cleared query');
assert.equal(matchesVideoTitleSearch(hebrewTitle, '   '), true, 'whitespace-only query');
assert.equal(matchesVideoTitleSearch(null, 'פלנטיר'), false, 'missing title is safe');
assert.equal(normalizeVideoTitleSearchText('  AMD\tANET\n'), 'amd anet', 'whitespace normalization');

console.log('video title search QA: PASS');
