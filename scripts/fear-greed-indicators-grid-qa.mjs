import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FearGreedIndicatorsGrid.jsx imports @radix-ui/react-tooltip + lucide-react,
// so it can't go through the FearGreedScoreCard.jsx-style import-free vm
// render harness (see fear-greed-score-card-qa.mjs). This checks the source
// structurally instead — the actual JSX/import graph is exercised by
// `npm run build` and by the live browser check documented in the report.
const componentUrl = new URL('../src/components/dashboard/FearGreedIndicatorsGrid.jsx', import.meta.url);
const source = readFileSync(componentUrl, 'utf8');
const cardUrl = new URL('../src/components/dashboard/FearGreedScoreCard.jsx', import.meta.url);
const cardSource = readFileSync(cardUrl, 'utf8');

// Data comes from the shared normalization module, not hardcoded here.
assert.match(source, /from '@\/lib\/fearGreed'/);
assert.match(source, /FEAR_GREED_INDICATOR_IDS/);
assert.match(source, /FEAR_GREED_INDICATOR_LABELS_HE/);
assert.match(source, /FEAR_GREED_INDICATOR_TOOLTIPS_HE/);
assert.match(source, /FEAR_GREED_RATING_STYLES/);
assert.match(source, /formatFearGreedUpdatedAt/);
assert.doesNotMatch(source, /score:\s*\d/); // no hardcoded/fabricated indicator scores

// Reuses the project's existing tooltip primitive (same one AAIIWeeklySentimentCard
// uses) rather than introducing a second tooltip system.
assert.match(source, /from '@radix-ui\/react-tooltip'/);
assert.match(source, /from 'lucide-react'/);

// FearGreedScoreCard now wraps only its header in an <a> (see that file's
// own comment) precisely so this grid's per-row toggle and graph <a> are
// never nested inside another interactive element. The info-tooltip trigger
// still uses span+role=button since it nests inside the row's own toggle.
assert.match(cardSource, /cannot\s+validly\s+contain\s+another <a> or a <button>/);
assert.match(source, /<span[\s\S]{0,120}role="button"/);
assert.match(source, /role="button"/);
assert.match(source, /tabIndex=\{0\}/);
assert.match(source, /onKeyDown=/);
assert.match(source, /'Enter'/);
assert.match(source, /' '/);

// Escape closes the tooltip and returns focus to the trigger (same contract
// as AAIIHelpTooltip).
assert.match(source, /'Escape'/);
assert.match(source, /triggerRef\.current\?\.focus\?\.\(\)/);

// Accessible labeling + portal-based positioning that stays in the viewport.
assert.match(source, /aria-label=/);
assert.match(source, /aria-describedby=/);
assert.match(source, /TooltipPrimitive\.Portal/);
assert.match(source, /collisionPadding/);

// Exactly one row per canonical indicator id, rendered from the shared list
// (not duplicated/hand-enumerated), in a compact 2-column layout.
assert.match(source, /FEAR_GREED_INDICATOR_IDS\.map/);
assert.match(source, /grid-cols-2/);
assert.match(source, /data-fear-greed-indicators\n/);
assert.match(source, /data-fear-greed-indicator=\{id\}/);
assert.match(source, /data-fear-greed-indicator-tooltip/);
assert.match(source, /dir="rtl"/);

// A missing/unrecognized indicator renders as an explicit unavailable
// marker, never a guessed label — never invent a default rating.
assert.match(source, /entry\?\.ratingKey \|\| undefined/);
assert.match(source, /'—'/);

// --- Expand/collapse (accordion) requirements ---
// Row click toggles a single shared expandedId — only one row open at a time.
assert.match(source, /useState\(null\)/);
assert.match(source, /const toggle = \(id\) => setExpandedId/);
assert.match(source, /current === id \? null : id/);
assert.match(source, /aria-expanded=\{isExpanded\}/);
assert.match(source, /aria-controls=\{panelId\}/);
assert.match(source, /data-fear-greed-indicator-toggle/);
assert.match(source, /data-fear-greed-indicator-panel/);
// The toggle's own onClick/onKeyDown, not the tooltip's, drives expansion —
// clicking the info icon must not also toggle the row (its own handler
// already calls stopPropagation, verified in IndicatorInfoTooltip above).
assert.match(source, /onClick=\{\(\) => onToggle\(id\)\}/);

// --- Graph/page link requirements ---
// No per-indicator CNN anchor is used (verified unstable — see the top-of-file
// comment) — every row's link points at the single verified CNN URL import,
// not a hand-typed/invented address, and is labeled for the no-stable-anchor
// fallback case as the task requires.
assert.match(source, /from '@\/lib\/sentimentSourceLinks'/);
assert.match(source, /CNN_FEAR_GREED_URL/);
assert.doesNotMatch(source, /href=\{?["'`]https:\/\/(?!.*CNN_FEAR_GREED_URL)/); // no separately hardcoded URL
assert.match(source, /href=\{CNN_FEAR_GREED_URL\}/);
assert.match(source, /data-fear-greed-graph-link/);
assert.match(source, /target="_blank"/);
assert.match(source, /rel="noopener noreferrer"/);
assert.match(source, /פתח את עמוד המדד ב־CNN/);
// The graph link renders unconditionally inside the panel — outside the
// entry ? ... : ... branch — so missing data never hides it.
assert.match(source, /\)\}\s*<a\s*\n\s*href=\{CNN_FEAR_GREED_URL\}/);

// Never estimate/derive numbers beyond what normalizeCnnFearGreedPayload
// already verified (no chart/SVG parsing in this file at all).
assert.doesNotMatch(source, /getBoundingClientRect|querySelector|SVGElement|getAttribute\('d'\)/);

console.log('Fear & Greed indicators grid QA: PASS');
