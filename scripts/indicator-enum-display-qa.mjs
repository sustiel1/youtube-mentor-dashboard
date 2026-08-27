import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  INDICATOR_ENUM_UNKNOWN_LABEL,
  translateIndicatorEnumValue,
  translateKnownIndicatorEnumValue,
} from '../src/lib/indicatorEnumDisplay.js';
import { getMacroChangeDisplay } from '../src/lib/morningBriefVisuals.js';

const mappings = {
  unknown: 'לא ידוע',
  positive: 'חיובי',
  negative: 'שלילי',
  neutral: 'ניטרלי',
  up: 'עלייה',
  down: 'ירידה',
  into: 'כניסה לסקטור',
  out: 'יציאה מהסקטור',
  bullish: 'שורי',
  bearish: 'דובי',
};

assert.equal(INDICATOR_ENUM_UNKNOWN_LABEL, 'לא ידוע');
for (const [raw, expected] of Object.entries(mappings)) {
  assert.equal(translateIndicatorEnumValue(raw), expected);
  assert.equal(translateIndicatorEnumValue(raw.toUpperCase()), expected);
  assert.equal(translateKnownIndicatorEnumValue(raw), expected);
  const display = getMacroChangeDisplay(raw);
  assert.equal(translateIndicatorEnumValue(display?.text ?? raw), expected);
}

for (const value of [null, undefined, '', '   ', 'unexpected', {}, []]) {
  assert.equal(translateIndicatorEnumValue(value), 'לא ידוע');
}

assert.equal(translateKnownIndicatorEnumValue('84.1'), '84.1');
assert.equal(translateKnownIndicatorEnumValue('טקסט קיים'), 'טקסט קיים');
assert.equal(translateKnownIndicatorEnumValue(null), '');

const oldSnapshot = {
  macroFactors: [
    { indicator: 'Crude Oil', value: '', change: 'unknown', impact: 'negative' },
    { indicator: 'DXY', value: 'positive', change: 'up', impact: null },
    { indicator: 'US10Y', value: '4.2%', change: 'down', impact: 'neutral' },
  ],
};
const before = JSON.stringify(oldSnapshot);
for (const row of oldSnapshot.macroFactors) {
  translateKnownIndicatorEnumValue(row.value);
  translateIndicatorEnumValue(row.change);
  translateKnownIndicatorEnumValue(row.impact);
}
assert.equal(JSON.stringify(oldSnapshot), before);
assert.equal(oldSnapshot.macroFactors[0].change, 'unknown');
assert.equal(oldSnapshot.macroFactors[1].change, 'up');

const panelSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);
assert.ok(panelSource.includes('translateIndicatorEnumValue(display?.text ?? rawValue)'));
assert.ok(panelSource.includes('translateKnownIndicatorEnumValue(row.value)'));
assert.ok(panelSource.includes('translateKnownIndicatorEnumValue(row.frequency)'));
assert.ok(panelSource.includes('<MacroChangeCell display={changeDisplay} rawValue={row.change} />'));
assert.ok(panelSource.includes('translateIndicatorEnums'));
assert.ok(panelSource.includes('return [row.indicator, row.value, row.change, row.frequency, row.description, row.impact]'));

console.log('indicator enum display QA: 60 assertions passed');
