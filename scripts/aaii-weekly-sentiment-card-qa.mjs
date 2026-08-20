import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import { Pencil } from 'lucide-react';
import * as aaiiWeeklySentimentLib from '../src/lib/aaiiWeeklySentiment.js';

function harnessRequire(specifier) {
  if (specifier === 'lucide-react') return { Pencil };
  if (specifier === '@/lib/aaiiWeeklySentiment') return aaiiWeeklySentimentLib;
  throw new Error(`Unexpected import in QA harness: ${specifier}`);
}

const componentUrl = new URL('../src/components/dashboard/AAIIWeeklySentimentCard.jsx', import.meta.url);
const componentSource = readFileSync(componentUrl, 'utf8');
const containerSource = readFileSync(
  new URL('../src/components/dashboard/AAIIWeeklySentimentCardContainer.jsx', import.meta.url),
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

// --- valid values (approx totals to 100), period + last-updated display ---
const ready = renderCard({
  bullish: 49.5,
  neutral: 22.3,
  bearish: 28.2,
  weekStart: '2026-02-18',
  weekEnd: '2026-02-25',
  updatedAt: '2026-02-19T09:30:00.000Z',
  status: 'ready',
});
assert.match(ready, /data-status="ready"/);
assert.match(ready, /data-total-valid="true"/);
assert.match(ready, />49\.5%<\/span>/);
assert.match(ready, />22\.3%<\/span>/);
assert.match(ready, />28\.2%<\/span>/);
assert.match(ready, /בתוקף מ־18\/02\/2026 עד 25\/02\/2026/);
assert.match(ready, /עודכן לאחרונה:/);

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
assert.match(stale, /הנתון אינו עדכני/);
const staleInvalid = renderCard({ status: 'stale' });
assert.match(staleInvalid, /data-status="unavailable"/);

// --- presentational card stays pure: no network calls, timers, effects or storage writes ---
assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
assert.doesNotMatch(componentSource, /\bset(?:Interval|Timeout)\s*\(|requestAnimationFrame/);
assert.doesNotMatch(componentSource, /\buseEffect\s*\(|\buseQuery\s*\(/);
assert.doesNotMatch(componentSource, /localStorage|indexedDB|sessionStorage/);

// --- no mutation of input props ---
const inputProps = Object.freeze({ bullish: 49.5, neutral: 22.3, bearish: 28.2, status: 'ready' });
renderCard(inputProps); // Object.freeze would throw synchronously if the component tried to mutate it
assert.deepEqual(inputProps, { bullish: 49.5, neutral: 22.3, bearish: 28.2, status: 'ready' });

// --- responsive composition contract (matches sibling FearGreedScoreCard sizing convention) ---
assert.match(componentSource, /w-full min-w-0[\s\S]*lg:w-\[23rem\]/);
// Regression guard: at md (768-1023px) this card must stay full-width so it wraps
// under FearGreedScoreCard instead of crushing the section heading (see QA notes).
assert.doesNotMatch(componentSource, /\bmd:w-\[23rem\]/);
assert.match(componentSource, /dark:border-zinc-700[\s\S]*dark:bg-zinc-900/);

// --- container: owns persistence I/O, keeps no network/timer/localStorage code of its own ---
assert.match(containerSource, /readAaiiWeeklySentimentStore/);
assert.match(containerSource, /saveAaiiWeeklySentimentRecord/);
assert.match(containerSource, /useEffect/);
assert.doesNotMatch(containerSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|\bset(?:Interval|Timeout)\s*\(/);
assert.doesNotMatch(containerSource, /localStorage\.|sessionStorage\.|indexedDB\./);

// --- wiring: sentiment section renders the stateful container beside FearGreedScoreCard ---
assert.match(
  panelsSource,
  /headerLinks=\{\(\s*<>\s*<FearGreedScoreCard sourceUrl=\{CNN_FEAR_GREED_URL\} \/>\s*<AAIIWeeklySentimentCardContainer \/>\s*<\/>\s*\)\}/,
);
assert.match(
  panelsSource,
  /import \{ AAIIWeeklySentimentCardContainer \} from '\.\/AAIIWeeklySentimentCardContainer';/,
);

console.log('AAII weekly sentiment card QA: PASS');
