import assert from 'node:assert/strict';

import {
  extractCalendarRows,
  mergeCalendarRows,
  mergeMacroDisplayRows,
  parseMacroDisplayItem,
} from '../src/lib/morningBriefDisplay.js';
import { getMacroFieldDisplay } from '../src/lib/morningBriefVisuals.js';

const actual = parseMacroDisplayItem({
  factor: 'CPI',
  actualValue: 3.2,
  unit: '%',
  targetValue: 2,
  referenceType: 'policy-target',
  trend: 'down',
});
assert.equal(actual.value, '3.2%', 'actualValue and unit populate the displayed actual value');
assert.equal(actual.actualValue, 3.2);
assert.equal(actual.targetValue, 2, 'target remains separate from the actual value');

const targetOnly = parseMacroDisplayItem({
  factor: 'US 10Y yield',
  actualValue: null,
  unit: '%',
  targetValue: 5,
  referenceType: 'technical-level',
  trend: 'up',
  description: 'התשואה צריכה לרדת מתחת ל־5% כדי להקל על השוק',
});
assert.equal(targetOnly.value, '', 'target/reference must not be displayed as an actual value');
assert.equal(targetOnly.change, 'up', 'a structured trend survives threshold text');
assert.equal(targetOnly.targetValue, 5);

const explicitMissingActual = parseMacroDisplayItem({
  factor: 'Policy rate',
  actualValue: null,
  currentValue: 4.25,
  targetValue: 3,
  unit: '%',
});
assert.equal(explicitMissingActual.value, '', 'explicit null actualValue blocks legacy/current fallbacks');

const explicitTextMove = parseMacroDisplayItem({
  factor: 'AAII',
  trend: 'unknown',
  description: '↓ 5% לעומת השבוע הקודם',
});
assert.equal(explicitTextMove.change, '-5%', 'an explicit arrow percentage is extracted as change');

const explicitHebrewMove = parseMacroDisplayItem({
  factor: 'CPI',
  description: 'המדד עלה ב־5% לעומת התקופה הקודמת',
});
assert.equal(explicitHebrewMove.change, '+5%', 'an explicit Hebrew percentage move is extracted as change');

const thresholdOnly = parseMacroDisplayItem({
  factor: 'אג״ח',
  description: 'חייבים לרדת מתחת ל־5% להמשך עליות',
});
assert.notEqual(thresholdOnly.change, '-5%', 'a threshold is not converted into a percentage decline');
assert.notEqual(
  getMacroFieldDisplay('חייבים לרדת מתחת ל־5%', thresholdOnly)?.kind,
  'percent',
  'a threshold in descriptive text is not rendered as a percentage decline',
);

const mergedMacro = mergeMacroDisplayRows(
  [{
    indicator: 'תשואות אג״ח ממשלת ארה״ב',
    value: '',
    change: 'up',
    frequency: '',
    description: 'תיאור מובנה',
    impact: '',
    trend: 'up',
    targetValue: 5,
  }],
  ['תשואות אג״ח ממשלת ארה״ב\nטקסט fallback ארוך יותר שחייבים לרדת מתחת ל־5%'],
);
assert.equal(mergedMacro.length, 1);
assert.equal(mergedMacro[0].change, 'up', 'richer fallback text cannot erase structured trend');
assert.equal(mergedMacro[0].targetValue, 5);

const calendarRows = extractCalendarRows({
  catalysts: [
    {
      description: 'ביקור נשיא סין בארה״ב',
      sourceRelativeText: 'בסוף ספטמבר',
      timeframe: 'סוף ספטמבר 2026',
      impact: 'השפעה אפשרית על יחסי הסחר',
    },
    {
      description: 'דוחות אנבידיה',
      timeframe: 'שבוע הבא ביום רביעי',
      severity: 'high',
      impact: 'תנודתיות בסקטור השבבים',
    },
    {
      description: 'אירוע legacy',
      when: 'מחר',
      priority: 'medium',
    },
    {
      description: 'אירוע עם impact תיאורי בלבד',
      impact: 'high volatility is possible',
    },
  ],
});

assert.equal(calendarRows[0].date, 'בסוף ספטמבר');
assert.equal(calendarRows[0].importance, '', 'importance is not fabricated from descriptive impact');
assert.equal(calendarRows[1].date, 'שבוע הבא ביום רביעי');
assert.equal(calendarRows[1].importance, 'high');
assert.equal(calendarRows[1].impact, 'תנודתיות בסקטור השבבים');
assert.equal(calendarRows[2].date, 'מחר', 'legacy timing alias remains readable');
assert.equal(calendarRows[2].importance, 'medium', 'legacy importance alias remains readable');
assert.equal(calendarRows[3].importance, '', 'descriptive impact is not treated as importance');

const mergedCalendar = mergeCalendarRows([
  { event: 'מדד המחירים לצרכן CPI', date: 'מחר', importance: '', impact: '', type: 'CPI' },
  { event: 'CPI', date: '', importance: 'high', impact: 'השפעה על הריבית', type: 'CPI' },
]);
assert.equal(mergedCalendar.length, 1);
assert.equal(mergedCalendar[0].date, 'מחר');
assert.equal(mergedCalendar[0].importance, 'high');
assert.equal(mergedCalendar[0].impact, 'השפעה על הריבית');

const missing = parseMacroDisplayItem({ factor: 'ללא נתונים' });
assert.equal(missing.value, '');
assert.equal(missing.change, '');

console.log('macro table field mapping QA passed');
