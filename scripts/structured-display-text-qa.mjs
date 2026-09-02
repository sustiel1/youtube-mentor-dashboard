import assert from 'node:assert/strict';
import { localizeStructuredDisplayText } from '../src/lib/structuredDisplayText.js';
import { valueToDisplayItems } from '../src/lib/universalTabSections.js';
import { formatBulkItemText } from '../src/lib/universalTabBulkItems.js';
import { buildDailyBriefingView } from '../src/lib/summaryBriefingDisplay.js';

const indexRow = localizeStructuredDisplayText(
  'RSP | currentValue: | change | note: משקל שווה נפתח באדום ומעיד על חולשת רוחב השוק | direction: down',
);
assert.equal(
  indexRow,
  'RSP · הערה: משקל שווה נפתח באדום ומעיד על חולשת רוחב השוק · מגמה: ירידה',
);

const marketRow = localizeStructuredDisplayText(
  'label: General Market | value: זהיר / מעורב | sentiment: mixed | reason: דריכות לקראת נתונים',
);
assert.equal(
  marketRow,
  'סוג: השוק הכללי · ערך: זהיר / מעורב · סנטימנט: מעורב · סיבה: דריכות לקראת נתונים',
);

const sectorRow = localizeStructuredDisplayText(
  'label: Energy Sector | value: עליית מחירי הנפט | sentiment: bullish | reason: חיובי',
);
assert.equal(
  sectorRow,
  'סוג: סקטור האנרגיה · ערך: עליית מחירי הנפט · סנטימנט: שורי · סיבה: חיובי',
);

assert.equal(
  localizeStructuredDisplayText('META ממשיכה להתחזק מול S&P 500'),
  'META ממשיכה להתחזק מול S&P 500',
  'tickers and index names must remain unchanged',
);
assert.equal(
  localizeStructuredDisplayText('https://example.com/a|b'),
  'https://example.com/a · b',
  'URL prefixes must not be mistaken for schema labels',
);

for (const text of [indexRow, marketRow, sectorRow]) {
  assert.doesNotMatch(text, /\|/);
  assert.doesNotMatch(text, /\b(?:label|value|sentiment|reason|direction|currentValue|change|note)\s*:/i);
}

assert.deepEqual(
  valueToDisplayItems([{ label: 'General Market', sentiment: 'mixed', reason: 'תנודתיות גבוהה' }]),
  ['סוג: השוק הכללי · סנטימנט: מעורב · סיבה: תנודתיות גבוהה'],
  'universal tab extraction must apply the shared rule',
);
assert.equal(
  formatBulkItemText('direction: down | note: רוחב השוק נחלש'),
  'מגמה: ירידה · הערה: רוחב השוק נחלש',
  'bulk copy/save text must match the visible localized text',
);

const briefing = buildDailyBriefingView({
  marketBriefData: {
    universalTabs: {
      summary: {
        topTakeaways: [
          'RSP | currentValue: | change | note: רוחב השוק נחלש | direction: down',
        ],
      },
    },
  },
});
assert.equal(
  briefing.thirtySecond[0],
  'RSP · הערה: רוחב השוק נחלש · מגמה: ירידה',
  'every video summary must apply the shared presentation rule',
);

console.log('structured display text QA: all assertions passed');
