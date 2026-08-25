import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const componentUrl = new URL('../src/components/dashboard/FearGreedScoreCard.jsx', import.meta.url);
const componentSource = readFileSync(componentUrl, 'utf8');
const panelsSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);
const primitivesSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefVisualPrimitives.jsx', import.meta.url),
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
const moduleContext = { module: { exports: {} }, exports: {}, React };
vm.runInNewContext(transformed.code, moduleContext, { filename: componentUrl.pathname });

const {
  FearGreedScoreCard,
  getFearGreedHebrewRating,
  normalizeFearGreedScore,
} = moduleContext.module.exports;
const CNN_URL = 'https://www.cnn.com/markets/fear-and-greed';
const renderCard = (props = {}) => renderToStaticMarkup(React.createElement(FearGreedScoreCard, {
  sourceUrl: CNN_URL,
  ...props,
}));

const placeholder = renderCard();
assert.match(placeholder, /data-fear-greed-score-card="true"/);
assert.match(placeholder, />—<\/span>/);
assert.match(placeholder, /מדד פחד ותאווה/);
assert.match(placeholder, /ממתין לחיבור מקור חי/);
assert.match(placeholder, /טרם עודכן/);
assert.match(placeholder, />CNN ↗<\/span>/);
assert.doesNotMatch(placeholder, /data-active="true"/);
assert.doesNotMatch(placeholder, /data-score=/);

const ready = renderCard({ score: 56, rating: 'Greed', updatedAt: '12:30', status: 'ready' });
assert.match(ready, /data-score="56"/);
assert.match(ready, />56<\/span>/);
assert.match(ready, /תאווה/);
assert.match(ready, /עודכן 12:30/);
assert.equal((ready.match(/data-active="true"/g) || []).length, 1);

assert.equal(normalizeFearGreedScore(0), 0);
assert.equal(normalizeFearGreedScore(100), 100);
assert.equal(getFearGreedHebrewRating(0), 'פחד קיצוני');
assert.equal(getFearGreedHebrewRating(100), 'תאווה קיצונית');
assert.match(renderCard({ score: 0, status: 'ready' }), /data-score="0"/);
assert.match(renderCard({ score: 100, status: 'ready' }), /data-score="100"/);

for (const invalidScore of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, 101, '56']) {
  const markup = renderCard({ score: invalidScore, status: 'ready' });
  assert.doesNotMatch(markup, /data-score=/);
  assert.match(markup, />—<\/span>/);
  assert.match(markup, /ממתין לחיבור מקור חי/);
  assert.doesNotMatch(markup, /data-active="true"/);
}

// Score badge color must track the overall CNN state (requirement: the box
// showing e.g. "55" uses the zone color, not a neutral gray, once a real
// score is displayed) and fall back to neutral gray while idle/unavailable.
assert.match(placeholder, /bg-slate-100 text-slate-800/);
assert.doesNotMatch(placeholder, /bg-red-500 text-white|bg-orange-400 text-white|bg-amber-300 text-slate-900|bg-lime-400 text-slate-900|bg-emerald-500 text-white/);
assert.match(renderCard({ score: 10, status: 'ready' }), /bg-red-500 text-white/);
assert.match(renderCard({ score: 30, status: 'ready' }), /bg-orange-400 text-white/);
assert.match(renderCard({ score: 50, status: 'ready' }), /bg-amber-300 text-slate-900/);
assert.match(renderCard({ score: 65, status: 'ready' }), /bg-lime-400 text-slate-900/);
assert.match(renderCard({ score: 90, status: 'ready' }), /bg-emerald-500 text-white/);
// stale (cached) values keep the zone color too — only idle/loading/unavailable are neutral
assert.match(renderCard({ score: 90, status: 'stale' }), /bg-emerald-500 text-white/);
assert.match(renderCard({ score: 90, status: 'loading' }), /bg-slate-100 text-slate-800/);
assert.match(renderCard({ score: 90, status: 'unavailable' }), /bg-slate-100 text-slate-800/);

// indicatorsSlot: opt-in extra content rendered between the header and the
// bottom scale; absent by default so the placeholder/legacy callers are unchanged.
assert.doesNotMatch(placeholder, /data-fear-greed-indicators-slot/);
const withSlot = renderCard({ score: 55, status: 'ready', indicatorsSlot: React.createElement('span', { 'data-test-marker': true }, 'X') });
assert.match(withSlot, /data-fear-greed-indicators-slot/);
assert.match(withSlot, /data-test-marker="true"/);

// Only the header is a link now — the outer wrapper is a <div> so
// indicatorsSlot (per-indicator expand toggles + graph <a> links) never
// nests inside an <a>, which would be invalid HTML.
assert.match(placeholder, /^<div/);
assert.doesNotMatch(placeholder, /^<a/);
const anchorCloseIdx = withSlot.indexOf('</a>');
const slotIdx = withSlot.indexOf('data-fear-greed-indicators-slot');
assert.ok(anchorCloseIdx > -1 && slotIdx > anchorCloseIdx, 'indicatorsSlot must render after the header </a> closes, not inside it');

// refreshSlot: opt-in manual-refresh control, rendered as a sibling of the
// header <a> (never inside it — a <button> nested in an <a> is invalid).
assert.doesNotMatch(placeholder, /data-test-refresh-marker/);
const withRefresh = renderCard({
  score: 55,
  status: 'ready',
  refreshSlot: React.createElement('button', { type: 'button', 'data-test-refresh-marker': true }, 'R'),
});
assert.match(withRefresh, /data-test-refresh-marker="true"/);
const refreshAnchorCloseIdx = withRefresh.indexOf('</a>');
const refreshMarkerIdx = withRefresh.indexOf('data-test-refresh-marker');
assert.ok(
  refreshAnchorCloseIdx > -1 && refreshMarkerIdx > refreshAnchorCloseIdx,
  'refreshSlot must render after the header </a> closes, not inside it',
);

// scoreInfoSlot: opt-in overall-score info trigger, rendered as a sibling of
// the header <a> (never inside it — its trigger has role="button", and a
// role="button" element nested in an <a> is invalid HTML content-model-wise,
// same rule as refreshSlot above).
assert.doesNotMatch(placeholder, /data-test-score-info-marker/);
const withScoreInfo = renderCard({
  score: 55,
  status: 'ready',
  scoreInfoSlot: React.createElement('span', { role: 'button', tabIndex: 0, 'data-test-score-info-marker': true }, 'i'),
});
assert.match(withScoreInfo, /data-test-score-info-marker="true"/);
const scoreInfoAnchorCloseIdx = withScoreInfo.indexOf('</a>');
const scoreInfoMarkerIdx = withScoreInfo.indexOf('data-test-score-info-marker');
assert.ok(
  scoreInfoAnchorCloseIdx > -1 && scoreInfoMarkerIdx > scoreInfoAnchorCloseIdx,
  'scoreInfoSlot must render after the header </a> closes, not inside it',
);

// checkedAt: "last checked by the app" line, distinct from updatedAt (CNN's
// own index timestamp) — absent by default, shown only when provided.
assert.doesNotMatch(placeholder, /data-fear-greed-checked-at/);
assert.doesNotMatch(placeholder, /נבדק לאחרונה/);
const withCheckedAt = renderCard({ score: 55, status: 'ready', updatedAt: '25.08.2026, 10:15', checkedAt: '10:19' });
assert.match(withCheckedAt, /data-fear-greed-checked-at/);
assert.match(withCheckedAt, /נבדק לאחרונה: 10:19/);
assert.match(withCheckedAt, /עודכן 25\.08\.2026, 10:15/);

assert.match(placeholder, new RegExp(`href="${CNN_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
assert.match(placeholder, /target="_blank"/);
assert.match(placeholder, /rel="noopener noreferrer"/);
assert.match(placeholder, /aria-label="פתיחת מדד הפחד והתאווה של CNN באתר חיצוני"/);
assert.match(placeholder, /פחד קיצוני/);
assert.match(placeholder, /ניטרלי/);
assert.match(placeholder, /תאווה קיצונית/);

assert.doesNotMatch(componentSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
assert.doesNotMatch(componentSource, /\bset(?:Interval|Timeout)\s*\(|requestAnimationFrame/);
assert.doesNotMatch(componentSource, /\buseEffect\s*\(|\buseQuery\s*\(/);
assert.match(componentSource, /flex h-full w-full min-w-0[\s\S]*flex-col[\s\S]*rounded-xl/);
assert.doesNotMatch(componentSource, /(?:md|lg):w-\[/);
assert.match(componentSource, /flex min-w-0 items-start gap-3/);
assert.match(componentSource, /mt-auto grid grid-cols-5 gap-1 pt-2/);
assert.match(componentSource, /dark:border-zinc-700[\s\S]*dark:bg-zinc-900/);
assert.match(panelsSource, /<FearGreedScoreCardContainer \/>/);
assert.match(panelsSource, /equalHeaderLinkColumns[\s\S]*headerLinks=/);
assert.match(primitivesSource, /flex flex-col gap-2 md:flex-row md:items-center md:justify-between/);
assert.match(primitivesSource, /flex min-w-0 flex-wrap items-center justify-between gap-2/);
assert.match(primitivesSource, /grid w-full min-w-0 auto-rows-fr grid-cols-1 items-stretch gap-2 lg:flex-1 lg:grid-cols-2/);

console.log('Fear & Greed score card QA: PASS');
