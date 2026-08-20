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
assert.match(componentSource, /w-full min-w-0[\s\S]*md:w-\[23rem\]/);
assert.match(componentSource, /dark:border-zinc-700[\s\S]*dark:bg-zinc-900/);
assert.match(panelsSource, /<FearGreedScoreCard sourceUrl=\{CNN_FEAR_GREED_URL\} \/>/);
assert.match(primitivesSource, /flex flex-col gap-2 md:flex-row md:items-center md:justify-between/);
assert.match(primitivesSource, /flex min-w-0 flex-wrap items-center justify-between gap-2/);

console.log('Fear & Greed score card QA: PASS');
