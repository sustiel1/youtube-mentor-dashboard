import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  formatInsightDisplayText,
  getInsightDisplayFields,
  parseLegacyInsightText,
} from '../src/lib/insightDisplay.js';
import { extractUniversalTabContent } from '../src/lib/universalTabSections.js';

const structured = {
  lesson: 'דוח חזק אינו מבטיח עלייה במניה.',
  whyImportant: 'הציפיות כבר עשויות להיות מגולמות במחיר.',
  category: 'מסחר בדוחות',
  applicableToApp: true,
  timestampSource: 'unavailable',
};

assert.deepEqual(getInsightDisplayFields(structured), {
  lesson: structured.lesson,
  whyImportant: structured.whyImportant,
});
assert.equal(
  formatInsightDisplayText(structured),
  `${structured.lesson}\nלמה זה חשוב: ${structured.whyImportant}`,
);
assert.equal(structured.category, 'מסחר בדוחות', 'structured source metadata must remain intact');
assert.equal(structured.applicableToApp, true, 'structured source booleans must remain intact');
assert.equal(structured.timestampSource, 'unavailable', 'structured source timestamps must remain intact');

assert.deepEqual(getInsightDisplayFields({ lesson: 'להמתין לאישור.' }), {
  lesson: 'להמתין לאישור.',
  whyImportant: '',
});

const legacy = 'lesson: לשמור על משמעת. | whyImportant: כך מצמצמים טעויות. | category: פסיכולוגיה | applicableToApp: true | timestampSource: unavailable';
assert.deepEqual(parseLegacyInsightText(legacy), {
  lesson: 'לשמור על משמעת.',
  whyImportant: 'כך מצמצמים טעויות.',
});

const englishLesson = 'Use the VIX only as context | not as a standalone signal.';
assert.deepEqual(parseLegacyInsightText(englishLesson), {
  lesson: englishLesson,
  whyImportant: '',
});

const embeddedEnglish = 'lesson: Keep the risk/reward ratio above 2:1. | timestampSource: unavailable';
assert.deepEqual(parseLegacyInsightText(embeddedEnglish), {
  lesson: 'Keep the risk/reward ratio above 2:1.',
  whyImportant: '',
});

const authoredPipeAfterMetadata = 'lesson: Core lesson | category: psychology | Keep this authored English note';
assert.deepEqual(parseLegacyInsightText(authoredPipeAfterMetadata), {
  lesson: 'Core lesson | Keep this authored English note',
  whyImportant: '',
});

const shaped = extractUniversalTabContent(null, 'insights', {
  universalTabs: {
    insights: {
      learningInsights: [structured, legacy],
      marketLessons: [{ lesson: 'לקח שוק ללא הסבר', timestampSource: 'unavailable' }],
      tradingInsights: [{ lesson: englishLesson, applicableToApp: false }],
    },
  },
});

assert.equal(shaped.mode, 'sections');
assert.deepEqual(
  shaped.sections.map(({ key, label }) => ({ key, label })),
  [
    { key: 'learningInsights', label: 'תובנות לימוד' },
    { key: 'marketLessons', label: 'לקחי שוק' },
    { key: 'tradingInsights', label: 'תובנות מסחר' },
  ],
  'existing insight group headings must remain unchanged',
);
assert.equal(shaped.sections[0].items[0], structured, 'structured insight object must reach the renderer intact');
assert.equal(shaped.sections[0].items[1], legacy, 'legacy string must reach the renderer intact');
assert.equal(getInsightDisplayFields(shaped.sections[2].items[0]).lesson, englishLesson);

const renderedText = shaped.sections
  .flatMap((section) => section.items)
  .map(formatInsightDisplayText)
  .join('\n');

for (const forbidden of [
  'lesson:',
  'whyImportant:',
  'category:',
  'applicableToApp:',
  'timestampSource:',
  'unavailable',
]) {
  assert.equal(renderedText.includes(forbidden), false, `rendered text must omit ${forbidden}`);
}

const componentSource = readFileSync(
  new URL('../src/components/dashboard/InsightsStructuredView.jsx', import.meta.url),
  'utf8',
);
assert.match(componentSource, /import \{ Lightbulb \} from 'lucide-react'/);
assert.match(componentSource, /data-insight-why-callout/);
assert.match(componentSource, /inline-flex max-w-full/);
assert.match(componentSource, /border-s-2 border-s-sky-400/);
assert.match(componentSource, /dark:bg-sky-950\/25/);
assert.match(componentSource, /row\.whyImportant \? \(/, 'missing whyImportant must not render a callout');
assert.match(
  componentSource,
  /const INSIGHT_TEXT_CLS = 'text-base leading-\[1\.55\] sm:text-\[17px\]';/,
  'insight and callout typography must share the responsive readable-size token',
);
assert.equal(
  componentSource.match(/\$\{INSIGHT_TEXT_CLS\}/g)?.length,
  2,
  'main insight and callout text must use the same typography token',
);
assert.doesNotMatch(
  componentSource,
  /DASHBOARD_TABLE_CELL_BODY_CLS/,
  'main insight must not be reduced by a nested fixed-size body class',
);
assert.doesNotMatch(
  componentSource,
  /data-insight-why-callout[\s\S]{0,700}text-(?:xs|sm)/,
  'callout must not contain smaller secondary typography',
);

console.log('Insight clean display QA passed');
