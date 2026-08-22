import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { Info, Pencil } from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as aaiiWeeklySentimentLib from '../src/lib/aaiiWeeklySentiment.js';

function harnessRequire(specifier) {
  if (specifier === 'react') return React;
  if (specifier === 'lucide-react') return { Info, Pencil };
  if (specifier === '@radix-ui/react-tooltip') return TooltipPrimitive;
  if (specifier === '@/lib/aaiiWeeklySentiment') return aaiiWeeklySentimentLib;
  throw new Error(`Unexpected import in QA harness: ${specifier}`);
}

const componentUrl = new URL('../src/components/dashboard/AAIIWeeklySentimentCard.jsx', import.meta.url);
const componentSource = readFileSync(componentUrl, 'utf8');
const containerSource = readFileSync(
  new URL('../src/components/dashboard/AAIIWeeklySentimentCardContainer.jsx', import.meta.url),
  'utf8',
);
const editorSource = readFileSync(
  new URL('../src/components/dashboard/AAIIWeeklySentimentEditor.jsx', import.meta.url),
  'utf8',
);
const panelsSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);

const transformed = await transformWithEsbuild(componentSource, componentUrl.pathname, {
  loader: 'jsx',
  format: 'cjs',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  target: 'node18',
});
const moduleContext = { module: { exports: {} }, exports: {}, React, require: harnessRequire };
vm.runInNewContext(transformed.code, moduleContext, { filename: componentUrl.pathname });

const {
  AAIIWeeklySentimentCard,
  AAII_SENTIMENT_SURVEY_URL,
  formatCompactAaiiFreshnessLine,
  getCompactAaiiExplanation,
  millisecondsUntilNextLocalDay,
  normalizeAAIIPercent,
} = moduleContext.module.exports;

const renderCard = (props = {}) => renderToStaticMarkup(React.createElement(AAIIWeeklySentimentCard, props));

// --- Hebrew heading + labels + placeholder state ---
const placeholder = renderCard();
assert.match(placeholder, /data-aaii-weekly-sentiment-card="true"/);
assert.match(placeholder, /data-status="idle"/);
assert.match(placeholder, /סנטימנט שבועי AAII/);
assert.match(placeholder, /שוריים/);
assert.match(placeholder, /ניטרליים/);
assert.match(placeholder, /דוביים/);
assert.match(placeholder, /ממתין להזנת נתון שבועי/);
assert.match(placeholder, />AAII ↗<\/a>/);
assert.equal((placeholder.match(/>—<\/span>/g) || []).length, 3);
assert.doesNotMatch(placeholder, /49\.5|22\.3|28\.2/);
assert.doesNotMatch(placeholder, /data-total-valid="true"/);
assert.doesNotMatch(placeholder, /data-aaii-period/);
assert.doesNotMatch(placeholder, /data-aaii-updated-at/);

// --- AAII link URL + security attributes ---
assert.match(placeholder, new RegExp(`href="${AAII_SENTIMENT_SURVEY_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
assert.match(placeholder, /target="_blank"/);
assert.match(placeholder, /rel="noopener noreferrer"/);
assert.match(placeholder, /aria-label="פתיחת סקר הסנטימנט השבועי של AAII"/);
assert.equal(AAII_SENTIMENT_SURVEY_URL, 'https://www.aaii.com/sentimentsurvey');

// --- edit (pencil) button: present, accessible, independent from the external link ---
assert.match(placeholder, /data-aaii-edit-button/);
assert.match(placeholder, /aria-label="עריכת נתוני הסנטימנט השבועי של AAII"/);
// The edit button must be a sibling <button>, not nested inside the <a> (so a click on it
// can never also trigger navigation via the anchor).
const linkThenButton = /<a[^>]*href="https:\/\/www\.aaii\.com\/sentimentsurvey"[^>]*>[\s\S]*?<\/a>\s*<button[^>]*data-aaii-edit-button/;
assert.match(placeholder, linkThenButton);

// --- canonical freshness formatting + one local-midnight refresh timer ---
const currentFreshness = aaiiWeeklySentimentLib.resolveAaiiFreshness('2026-08-26', {
  now: new Date(2026, 7, 22, 12),
});
const expectedTodayFreshness = aaiiWeeklySentimentLib.resolveAaiiFreshness('2026-08-26', {
  now: new Date(2026, 7, 27, 12),
});
const updateDueFreshness = aaiiWeeklySentimentLib.resolveAaiiFreshness('2026-08-26', {
  now: new Date(2026, 7, 28, 12),
});
const uncertainFreshness = aaiiWeeklySentimentLib.resolveAaiiFreshness(null, {
  now: new Date(2026, 7, 22, 12),
});
assert.equal(
  formatCompactAaiiFreshnessLine(currentFreshness),
  'נתוני השבוע · בתוקף עד 26.08 · עדכון הבא 27.08',
);
assert.equal(formatCompactAaiiFreshnessLine(expectedTodayFreshness), 'עדכון AAII צפוי היום');
assert.equal(formatCompactAaiiFreshnessLine(updateDueFreshness), 'נדרש עדכון · נתונים חדשים צפויים מ־AAII');
assert.equal(formatCompactAaiiFreshnessLine(uncertainFreshness), 'לא ניתן לקבוע אם הנתונים מעודכנים');
assert.equal(formatCompactAaiiFreshnessLine(null), null);
assert.equal(millisecondsUntilNextLocalDay(new Date(2026, 7, 22, 23, 59, 59)), 2000);
assert.equal(millisecondsUntilNextLocalDay(new Date('invalid')), null);

// --- every compact explanation is generated from the existing interpretation label ---
const compactExplanationCases = [
  ['שורי קל', 'מעט יותר משקיעים צופים עליות'],
  ['שורי מתון', 'יותר משקיעים צופים עליות'],
  ['שורי חזק', 'הרבה יותר משקיעים צופים עליות'],
  ['ניטרלי', 'הציפיות לעליות ולירידות מאוזנות'],
  ['דובי קל', 'מעט יותר משקיעים צופים ירידות'],
  ['דובי מתון', 'יותר משקיעים צופים ירידות'],
  ['דובי חזק', 'הרבה יותר משקיעים צופים ירידות'],
];
for (const [label, expected] of compactExplanationCases) {
  assert.equal(getCompactAaiiExplanation({ label }), expected);
}
assert.equal(getCompactAaiiExplanation(null), null);

// --- valid values (approx totals to 100), compact meta + accessible full dates ---
const ready = renderCard({
  bullish: 49.5,
  neutral: 22.3,
  bearish: 28.2,
  bullishAverage: 37.5,
  neutralAverage: 31,
  bearishAverage: 31.5,
  bullBearSpread: 21.3,
  weekStart: '2026-02-18',
  weekEnd: '2026-02-25',
  updatedAt: '2026-02-19T09:30:00',
  status: 'ready',
  now: new Date(2026, 1, 24, 12),
});
assert.match(ready, /data-status="ready"/);
assert.match(ready, /data-total-valid="true"/);
assert.match(ready, />49\.5%<\/span>/);
assert.match(ready, />22\.3%<\/span>/);
assert.match(ready, />28\.2%<\/span>/);
assert.match(ready, /data-aaii-compact-meta="true"/);
assert.match(ready, /data-aaii-freshness="current"/);
assert.match(ready, /border-emerald-400 dark:border-emerald-600/);
assert.match(ready, /25\.02/);
assert.match(ready, /26\.02/);
assert.match(ready, /aria-label="[^"]*25\/02\/2026[^"]*26\/02\/2026[^"]*19\/02\/2026, 09:30/);
assert.doesNotMatch(ready, />סקר /);
assert.match(ready, /data-aaii-interpretation="true"/);
assert.match(ready, /data-aaii-tone="bullish"/);
assert.match(ready, /data-aaii-intensity="strong"/);
assert.match(ready, /data-aaii-compact-summary="true"/);
assert.match(ready, /מרווח <bdi[^>]*>\+21\.3<\/bdi> · שורי חזק/);
assert.match(ready, /הרבה יותר משקיעים צופים עליות/);
assert.match(ready, /text-emerald-700 dark:text-emerald-400/);
assert.doesNotMatch(ready, /מרווח שוריים–דוביים|משמעות|נק׳ אחוז/);
assert.doesNotMatch(ready, /ממוצע היסטורי/, 'historical averages stay inside the closed tooltip');
assert.ok(ready.indexOf('data-aaii-compact-meta') < ready.indexOf('data-aaii-rows'));
assert.ok(ready.indexOf('data-aaii-rows') < ready.indexOf('data-aaii-interpretation'));

const freshnessProps = {
  bullish: 35.5,
  neutral: 24.6,
  bearish: 39.9,
  bullBearSpread: -4.4,
  weekStart: '2026-08-19',
  weekEnd: '2026-08-26',
  updatedAt: '2026-08-22T11:43:00',
  status: 'ready',
};
const expectedTodayCard = renderCard({ ...freshnessProps, now: new Date(2026, 7, 27, 12) });
assert.match(expectedTodayCard, /data-aaii-freshness="expected_today"/);
assert.match(expectedTodayCard, /border-amber-400 dark:border-amber-500/);
assert.match(expectedTodayCard, /עדכון AAII צפוי היום/);

const updateDueCard = renderCard({ ...freshnessProps, now: new Date(2026, 7, 28, 12) });
assert.match(updateDueCard, /data-aaii-freshness="update_due"/);
assert.match(updateDueCard, /border-red-400 dark:border-red-600/);
assert.match(updateDueCard, /נדרש עדכון/);
assert.match(updateDueCard, /data-aaii-tone="bearish"/);
assert.match(updateDueCard, /text-red-700 dark:text-red-400/);

const newlySavedThursdayCard = renderCard({
  ...freshnessProps,
  weekStart: '2026-08-27',
  weekEnd: '2026-09-02',
  updatedAt: '2026-08-27T11:43:00',
  now: new Date(2026, 7, 27, 12),
});
assert.match(newlySavedThursdayCard, /data-aaii-freshness="current"/);
assert.match(newlySavedThursdayCard, /border-emerald-400 dark:border-emerald-600/);

const bullishButDueCard = renderCard({
  ...freshnessProps,
  bullish: 49.5,
  neutral: 22.3,
  bearish: 28.2,
  bullBearSpread: 21.3,
  now: new Date(2026, 7, 28, 12),
});
assert.match(bullishButDueCard, /data-aaii-freshness="update_due"/);
assert.match(bullishButDueCard, /border-red-400 dark:border-red-600/);
assert.match(bullishButDueCard, /data-aaii-tone="bullish"/);
assert.match(bullishButDueCard, /text-emerald-700 dark:text-emerald-400/);

const uncertainCard = renderCard({ ...freshnessProps, weekEnd: null, now: new Date(2026, 7, 22, 12) });
assert.match(uncertainCard, /data-aaii-freshness="uncertain"/);
assert.match(uncertainCard, /border-amber-400 dark:border-amber-500/);
assert.match(uncertainCard, /לא ניתן לקבוע אם הנתונים מעודכנים/);
assert.match(uncertainCard, /22\/08\/2026, 11:43/);

const copiedResult = renderCard({
  bullish: 35.5,
  neutral: 24.6,
  bearish: 39.9,
  bullishAverage: 37.5,
  neutralAverage: 31,
  bearishAverage: 31.5,
  bullBearSpread: -4.4,
  status: 'ready',
});
assert.match(copiedResult, /data-aaii-tone="bearish"/);
assert.match(copiedResult, /data-aaii-intensity="light"/);
assert.match(copiedResult, /מרווח <bdi[^>]*>-4\.4<\/bdi> · דובי קל/);
assert.match(copiedResult, /מעט יותר משקיעים צופים ירידות/);
assert.match(copiedResult, /text-red-700 dark:text-red-400/);

const neutralResult = renderCard({ bullish: 34, neutral: 32, bearish: 34, status: 'ready' });
assert.match(neutralResult, /data-aaii-tone="neutral"/);
assert.match(neutralResult, /מרווח <bdi[^>]*>0\.0<\/bdi> · ניטרלי/);
assert.match(neutralResult, /הציפיות לעליות ולירידות מאוזנות/);
assert.match(neutralResult, /text-slate-600 dark:text-zinc-300/);

// Legacy records without a saved spread derive it from bullish minus bearish.
const legacyReady = renderCard({ bullish: 35.5, neutral: 24.6, bearish: 39.9, status: 'ready' });
assert.match(legacyReady, /data-aaii-intensity="light"/);
assert.match(legacyReady, /-4\.4/);

// --- 0 and 100 boundaries ---
assert.equal(normalizeAAIIPercent(0), 0);
assert.equal(normalizeAAIIPercent(100), 100);
const boundary = renderCard({ bullish: 0, neutral: 0, bearish: 100, status: 'ready' });
assert.match(boundary, /data-total-valid="true"/);
assert.match(boundary, />0\.0%<\/span>/);
assert.match(boundary, />100\.0%<\/span>/);

// --- invalid numbers (out of range / non-finite) ---
for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 101, '49.5']) {
  assert.equal(normalizeAAIIPercent(bad), null);
  const markup = renderCard({ bullish: bad, neutral: 22.3, bearish: 28.2, status: 'ready' });
  assert.match(markup, /data-status="unavailable"/);
  assert.equal((markup.match(/>—<\/span>/g) || []).length, 3);
  assert.match(markup, /הנתון השבועי אינו זמין/);
}

// --- missing values (partial data must not be inferred/displayed) ---
const partial = renderCard({ bullish: 49.5, neutral: 22.3, status: 'ready' });
assert.doesNotMatch(partial, /data-total-valid="true"/);
assert.equal((partial.match(/>—<\/span>/g) || []).length, 3);
assert.doesNotMatch(partial, />49\.5%<\/span>/);

// --- approximate total validation (must reject totals far from 100, honest unavailable state) ---
const badTotal = renderCard({ bullish: 60, neutral: 30, bearish: 30, status: 'ready' });
assert.match(badTotal, /data-status="unavailable"/);
assert.equal((badTotal.match(/>—<\/span>/g) || []).length, 3);
const withinTolerance = renderCard({ bullish: 49.7, neutral: 22.1, bearish: 28.3, status: 'ready' });
assert.match(withinTolerance, /data-total-valid="true"/);

// --- stale with valid data still shows values; stale with invalid data becomes unavailable ---
const stale = renderCard({ bullish: 49.5, neutral: 22.3, bearish: 28.2, status: 'stale' });
assert.match(stale, /data-status="stale"/);
assert.match(stale, /data-aaii-freshness="uncertain"/);
const staleInvalid = renderCard({ status: 'stale' });
assert.match(staleInvalid, /data-status="unavailable"/);

// --- card stays data-pure; its only timer is the single next-local-midnight refresh ---
assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
assert.doesNotMatch(componentSource, /\bsetInterval\s*\(|requestAnimationFrame/);
assert.match(componentSource, /window\.setTimeout\(/);
assert.match(componentSource, /window\.clearTimeout\(/);
assert.match(componentSource, /millisecondsUntilNextLocalDay\(now\)/);
assert.doesNotMatch(componentSource, /\buseQuery\s*\(/);
assert.doesNotMatch(componentSource, /localStorage|indexedDB|sessionStorage/);

// --- accessible Radix tooltip: Hebrew guidance, persisted averages, RTL + viewport collision handling ---
assert.match(componentSource, /@radix-ui\/react-tooltip/);
assert.match(componentSource, /<TooltipPrimitive\.Provider/);
assert.match(componentSource, /<TooltipPrimitive\.Trigger asChild>/);
assert.match(componentSource, /<TooltipPrimitive\.Portal>/);
assert.match(componentSource, /<TooltipPrimitive\.Content/);
assert.match(componentSource, /data-aaii-help-trigger/);
assert.match(componentSource, /data-aaii-help-tooltip/);
assert.match(componentSource, /data-aaii-full-dates/);
assert.match(componentSource, /aria-describedby=\{descriptionId\}/);
assert.match(componentSource, /onFocus=\{\(\) => setOpen\(true\)\}/);
assert.match(componentSource, /event\.key !== 'Escape'/);
assert.match(componentSource, /event\.stopImmediatePropagation\(\)/);
assert.match(componentSource, /onEscapeKeyDown=\{\(event\) =>/);
assert.match(componentSource, /event\.nativeEvent\?\.stopImmediatePropagation\?\.\(\)/);
assert.match(componentSource, /triggerRef\.current\?\.focus\?\.\(\)/);
assert.match(componentSource, /addEventListener\('keydown', closeOnEscape, true\)/);
assert.match(componentSource, /dir="rtl"/);
assert.match(componentSource, /collisionPadding=\{12\}/);
assert.match(componentSource, /max-w-\[min\(22rem,calc\(100vw-1\.5rem\)\)\]/);
assert.match(componentSource, /ממוצע היסטורי – שוריים:/);
assert.match(componentSource, /ממוצע היסטורי – ניטרליים:/);
assert.match(componentSource, /ממוצע היסטורי – דוביים:/);
assert.match(componentSource, /formatHistoricalAverage\(bullishAverage\)/);
assert.match(componentSource, /formatHistoricalAverage\(neutralAverage\)/);
assert.match(componentSource, /formatHistoricalAverage\(bearishAverage\)/);
assert.match(componentSource, /data-aaii-update-schedule/);
assert.match(componentSource, /כיצד נקבע מועד העדכון\?/);
assert.match(componentSource, /נתוני AAII נאספים מדי שבוע מיום חמישי ועד יום רביעי/);
assert.match(componentSource, /תוצאות השבוע הבא צפויות בדרך כלל ביום חמישי/);
assert.match(componentSource, /תקופת הנתונים השמורה:/);
assert.match(componentSource, /עודכן באפליקציה:/);
assert.match(componentSource, /מרווח שוריים–דוביים מחושב כך:/);
assert.match(componentSource, /נקודות אחוז/);
assert.match(componentSource, /AAII_SPREAD_NOT_FORECAST_TEXT/);
assert.match(aaiiWeeklySentimentLib.AAII_SPREAD_NOT_FORECAST_TEXT, /לא תחזית לשיעור העלייה או הירידה של השוק/);

// --- no mutation of input props ---
const inputProps = Object.freeze({ bullish: 49.5, neutral: 22.3, bearish: 28.2, status: 'ready' });
renderCard(inputProps); // Object.freeze would throw synchronously if the component tried to mutate it
assert.deepEqual(inputProps, { bullish: 49.5, neutral: 22.3, bearish: 28.2, status: 'ready' });

// --- responsive composition contract: shared equal-column layout owns width and height ---
assert.match(componentSource, /h-full w-full min-w-0[\s\S]*rounded-xl/);
assert.doesNotMatch(componentSource, /(?:md|lg):w-\[/);
assert.match(componentSource, /dark:border-zinc-700[\s\S]*dark:bg-zinc-900/);
assert.match(componentSource, /min-w-0 text-\[10px\][\s\S]*leading-4[\s\S]*data-aaii-compact-meta/);
assert.doesNotMatch(componentSource, /truncate[^\n]*data-aaii-compact-meta/);
assert.match(componentSource, /truncate font-semibold[\s\S]*data-aaii-compact-summary/);
assert.match(componentSource, /truncate text-slate-600 dark:text-zinc-300[\s\S]*data-aaii-compact-explanation/);
assert.match(componentSource, /block text-\[10px\] text-slate-600 dark:text-zinc-300/);
assert.match(componentSource, /dir="rtl"[\s\S]*data-aaii-weekly-sentiment-card/);

// --- container: owns persistence I/O, keeps no network/timer/localStorage code of its own ---
assert.match(containerSource, /readAaiiWeeklySentimentStore/);
assert.match(containerSource, /saveAaiiWeeklySentimentRecord/);
assert.match(containerSource, /useEffect/);
assert.doesNotMatch(containerSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|\bset(?:Interval|Timeout)\s*\(/);
assert.doesNotMatch(containerSource, /localStorage\.|sessionStorage\.|indexedDB\./);
assert.match(containerSource, /buildAaiiWeeklyRecord\(\s*draft,\s*draft\.publicationDate/);
assert.match(containerSource, /bullishAverage=\{latest\?\.bullishAverage \?\? null\}/);
assert.match(containerSource, /neutralAverage=\{latest\?\.neutralAverage \?\? null\}/);
assert.match(containerSource, /bearishAverage=\{latest\?\.bearishAverage \?\? null\}/);
assert.match(containerSource, /bullBearSpread=\{latest\?\.bullBearSpread \?\? null\}/);

// --- editor paste flow: preview first, manual entry preserved, invalid parses never update the draft ---
assert.match(editorSource, /parseAaiiResultsLine/);
assert.match(editorSource, /data-aaii-editor-paste/);
assert.match(editorSource, /data-aaii-editor-parse/);
assert.match(editorSource, /data-aaii-editor-preview/);
assert.match(editorSource, /תצוגה מקדימה לפני שמירה/);
assert.match(editorSource, /ממוצע שוריים/);
assert.match(editorSource, /ממוצע ניטרליים/);
assert.match(editorSource, /ממוצע דוביים/);
assert.match(editorSource, /מרווח:/);
assert.match(editorSource, /סנטימנט:/);
assert.match(editorSource, /getAaiiSpreadInterpretation/);
assert.match(editorSource, /previewInterpretation\?\.label/);
assert.match(editorSource, /אישור ושמירה/);
assert.match(editorSource, /data-aaii-editor-field="bullish"/);
assert.match(editorSource, /data-aaii-editor-field="neutral"/);
assert.match(editorSource, /data-aaii-editor-field="bearish"/);
const parseHandlerSource = editorSource.slice(
  editorSource.indexOf('const handleParse'),
  editorSource.indexOf('const handleSave'),
);
assert.match(parseHandlerSource, /if \(!parsed\.valid\)[\s\S]*setParsedPreview\(null\)[\s\S]*return;/);
assert.doesNotMatch(parseHandlerSource, /setDraft\(/, 'parsing must not partially overwrite manual fields');

// --- wiring: sentiment section renders the stateful container beside FearGreedScoreCard ---
assert.match(panelsSource, /equalHeaderLinkColumns[\s\S]*headerLinks=/);
assert.match(
  panelsSource,
  /headerLinks=\{\(\s*<>\s*<FearGreedScoreCard sourceUrl=\{CNN_FEAR_GREED_URL\} \/>\s*<AAIIWeeklySentimentCardContainer \/>\s*<\/>\s*\)\}/,
);
assert.match(
  panelsSource,
  /import \{ AAIIWeeklySentimentCardContainer \} from '\.\/AAIIWeeklySentimentCardContainer';/,
);

console.log('AAII weekly sentiment card QA: PASS');
