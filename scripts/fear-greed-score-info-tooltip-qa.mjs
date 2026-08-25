import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FearGreedScoreInfoTooltip.jsx imports @radix-ui/react-tooltip, so — like
// FearGreedIndicatorsGrid.jsx — it can't go through the FearGreedScoreCard.jsx
// import-free vm render harness. Checked structurally here; the actual
// JSX/import graph is exercised by `npm run build` and the live browser
// check documented in the report.
const componentUrl = new URL('../src/components/dashboard/FearGreedScoreInfoTooltip.jsx', import.meta.url);
const source = readFileSync(componentUrl, 'utf8');

// Reuses the project's existing tooltip primitive and open/escape/focus-return
// pattern (same as IndicatorInfoTooltip in FearGreedIndicatorsGrid.jsx)
// rather than a second tooltip implementation.
assert.match(source, /from '@radix-ui\/react-tooltip'/);
assert.match(source, /role="button"/);
assert.match(source, /tabIndex=\{0\}/);
assert.match(source, /key !== 'Escape'/);
assert.match(source, /triggerRef\.current\?\.focus\?\.\(\)/);

// Reuses FearGreedScoreCard's zone list rather than a third copy of the
// zone boundaries (fearGreed.js's FEAR_GREED_SCORE_ZONES is the second).
assert.match(source, /FEAR_GREED_ZONES,\s*getFearGreedHebrewRating/);
assert.match(source, /from '\.\/FearGreedScoreCard'/);
assert.match(source, /ratingKeyForScore/);
assert.match(source, /from '@\/lib\/fearGreed'/);

// Must render the disclaimer and never hardcode a score/zone value.
assert.match(source, /FEAR_GREED_DISCLAIMER_HE/);
assert.doesNotMatch(source, /score:\s*\d/);

// The current zone must be visibly distinguished (data attribute + styling),
// and the component must not crash / must still render the zone table when
// score is null (idle/unavailable state) — hasScore gates only the
// score-specific lines, not the whole tooltip.
assert.match(source, /data-fear-greed-score-zone-current/);
assert.match(source, /score = null/);
assert.match(source, /hasScore = typeof score === 'number'/);

// Regression guard: a real click fires the browser's own mousedown-focus
// event before the click event itself, so a toggle-on-click handler would
// flip straight back to closed (confirmed live in browser 2026-08-25).
// Click must always set open=true, never toggle.
assert.doesNotMatch(source, /setOpen\(\(value\) => !value\)/);
assert.match(source, /setOpen\(true\)/);

console.log('Fear & Greed score info tooltip QA: PASS');
