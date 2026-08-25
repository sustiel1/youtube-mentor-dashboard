import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FearGreedFullScreenModal.jsx imports @radix-ui/react-dialog + the project's
// ui/dialog wrapper, so — like FearGreedIndicatorsGrid.jsx — it can't go
// through the FearGreedScoreCard.jsx-style import-free vm render harness.
// Checked structurally here; the actual JSX/import graph is exercised by
// `npm run build` and the live browser check documented in the report.
const componentUrl = new URL('../src/components/dashboard/FearGreedFullScreenModal.jsx', import.meta.url);
const source = readFileSync(componentUrl, 'utf8');

// Reuses the project's existing dialog primitive (same one AiMappingModal.jsx
// uses for a large custom-sized modal) rather than a second modal system.
assert.match(source, /from '@radix-ui\/react-dialog'/);
assert.match(source, /from '@\/components\/ui\/dialog'/);

// Reuses FearGreedScoreCard's own zone/rating logic rather than duplicating
// score-classification rules a third time.
assert.match(source, /FEAR_GREED_ZONES,?\s*\n\s*getFearGreedHebrewRating,?\s*\n\s*normalizeFearGreedScore/);
assert.match(source, /from '\.\/FearGreedScoreCard'/);

// Genuinely full-screen (not a centered dialog like AiMappingModal.jsx).
assert.match(source, /inset-0/);
assert.match(source, /h-screen/);
assert.match(source, /w-screen/);
assert.match(source, /DialogPrimitive\.Close/);
assert.match(source, /aria-label="סגירת תצוגה מלאה"/);

// Overall section: score, classification, gauge, CNN update time, optional
// comparison values (only rendered when explicitly supplied), explanation,
// and a visible non-advice disclaimer.
assert.match(source, /data-fear-greed-fullscreen-overall/);
assert.match(source, /OverallGauge/);
assert.match(source, /FEAR_GREED_OVERALL_EXPLANATION_HE/);
assert.match(source, /FEAR_GREED_DISCLAIMER_HE/);
assert.match(source, /data-fear-greed-disclaimer/);
assert.match(source, /if \(value == null\) return null;/); // ComparisonRow never fabricates a missing previous-value
assert.match(source, /data-fear-greed-fullscreen-comparisons/);
assert.match(source, /previousClose/);
assert.match(source, /previousWeek/);
assert.match(source, /previousMonth/);
assert.match(source, /previousYear/);

// Seven indicator sections, driven by the shared canonical id list (never
// hand-enumerated).
assert.match(source, /data-fear-greed-fullscreen-indicators/);
assert.match(source, /FEAR_GREED_INDICATOR_IDS\.map/);
assert.match(source, /data-fear-greed-fullscreen-indicator=\{id\}/);
assert.doesNotMatch(source, /score:\s*\d/); // no hardcoded/fabricated numeric values

// A missing indicator entry renders an explicit "no data" state, not a
// fabricated bar/value. The normalized score renders as a bare, large,
// state-colored number beside the title — no "X מתוך 100" phrasing (that
// wording was explicitly rejected), and never shown when there's no entry.
assert.match(source, /אין נתונים/);
assert.match(source, /אין נתון מספרי זמין כרגע/);
assert.doesNotMatch(source, /מתוך 100/);
assert.match(source, /\{entry && \(/);
assert.match(source, /text-xl font-extrabold tabular-nums \$\{style\?\.textCls/);

// The per-card generic "open CNN's page" link was removed — the only CNN
// source link left is the one near the overall heading (sourceUrl prop,
// rendered once). No leftover "פתח את עמוד המדד" wording or per-card CNN
// href, and no separate bottom "related data" section/component.
assert.doesNotMatch(source, /פתח את עמוד המדד ב־CNN/);
assert.doesNotMatch(source, /GRAPH_LINK_LABEL/);
assert.doesNotMatch(source, /RelatedSourcesSection/);
assert.doesNotMatch(source, /נתונים וגרפים קשורים/);
assert.doesNotMatch(source, /data-fear-greed-fullscreen-related/);
assert.doesNotMatch(source, /data-fear-greed-related-group/);
const cnnHrefMatches = source.match(/href=\{sourceUrl\}/g) || [];
assert.equal(cnnHrefMatches.length, 1, 'sourceUrl (CNN link) must render exactly once, near the overall heading');

// Verified related-source chips: rendered inside each indicator's own
// header (beside the title, not at the card's bottom and not in a separate
// section), sourced from fearGreedRelatedSources.js, external + labeled.
assert.match(source, /from '@\/lib\/fearGreedRelatedSources'/);
assert.match(source, /FEAR_GREED_RELATED_SOURCES\[id\]/);
assert.match(source, /data-fear-greed-fullscreen-graph-chip/);
assert.match(source, /data-fear-greed-fullscreen-graph-provider/);
assert.match(source, /target="_blank"/);
assert.match(source, /rel="noopener noreferrer"/);
assert.match(source, /source\.ariaLabel/);
assert.match(source, /source\.shortLabel/);
// Chips render in the title row (flex-wrap header), before the score bar —
// not after the "מה זה מודד" explanation paragraph.
const chipIdx = source.indexOf('GraphChip key={source.url}');
const scoreBarIdx = source.indexOf('h-full rounded-full ${style?.dotCls');
const explanationIdx = source.indexOf('מה זה מודד');
assert.ok(chipIdx > -1 && chipIdx < scoreBarIdx && scoreBarIdx < explanationIdx,
  'graph chips must render in the header, before the score bar and explanation');

console.log('Fear & Greed full-screen modal QA: PASS');
