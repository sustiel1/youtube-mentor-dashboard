#!/usr/bin/env node
// Verifies what a7536c0 ("show original publish date/time on saved rows")
// actually covers, per the TRADINGBRAIN-NIGHT-VERIFY-HARDEN overnight audit:
// (a) local-timezone rendering, (b) which saved-section types get the header,
// (c) the confirmed gap in the default "כל הסרטונים" list (WorkspaceVideoGroupCard).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cardSource = readFileSync(new URL('../src/components/workspace/WorkspaceFocusedVideoCard.jsx', import.meta.url), 'utf8');
const groupCardSource = readFileSync(new URL('../src/components/workspace/WorkspaceVideoGroupCard.jsx', import.meta.url), 'utf8');

// ── (a) Timezone: formatBriefPublishDateParts/publishedTimeText use local getters ──
import { formatBriefPublishDatePlain } from '../src/lib/briefContextDisplay.js';

const storedUTC = '2026-08-09T21:45:00.000Z';
const rendered = formatBriefPublishDatePlain(storedUTC);
const tzOffsetMinutes = new Date(storedUTC).getTimezoneOffset();
const utcDatePart = storedUTC.slice(8, 10); // "09"
// Only assert the local-vs-UTC distinction where it's actually observable —
// machines running exactly at UTC (offset 0) would render the same date
// either way, so this guard is meaningful on any non-zero-offset runner
// (this repo's dev/CI environment is Asia/Jerusalem, UTC+2/+3).
if (tzOffsetMinutes !== 0) {
  assert.notEqual(rendered.slice(0, 2), utcDatePart, `publish date renders in local time (got ${rendered} for a UTC value whose UTC date-of-month is ${utcDatePart}) — confirms local, not UTC, rendering`);
}
assert.match(cardSource, /toLocaleTimeString\('he-IL',\s*\{\s*hour:\s*'2-digit',\s*minute:\s*'2-digit',\s*hour12:\s*false\s*\}\)/, 'publishedTimeText has no explicit timeZone option — confirms it defaults to the runtime\'s local timezone, not UTC');

// ── (b) Section-type coverage: every row-based section shell must call buildSectionMetadataLine ──
const rowSectionComponents = [
  'SavedTextSection', 'SavedMarketSection', 'SavedStockSection',
  'SavedSectorSection', 'SavedOpportunitySection', 'SavedNewsSection',
];
for (const name of rowSectionComponents) {
  const fnMatch = cardSource.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(fnMatch, `${name} exists in WorkspaceFocusedVideoCard.jsx`);
  assert.match(fnMatch[0], /metadata=\{buildSectionMetadataLine\(/, `${name} renders the publish-date header via buildSectionMetadataLine`);
}

// SnapshotSection (structured snapshots) is a documented, confirmed gap —
// it uses its own plain metadata string, not buildSectionMetadataLine.
const snapshotFn = cardSource.match(/function SnapshotSection\([^)]*\) \{[\s\S]*?\n\}/);
assert.ok(snapshotFn, 'SnapshotSection exists');
assert.doesNotMatch(snapshotFn[0], /buildSectionMetadataLine/, 'confirmed gap: SnapshotSection does NOT get the a7536c0 publish-date header (structured snapshots only show record count)');

// ── (c) Default "כל הסרטונים" view gap: CLOSED by commit 51701f6 ("fix(workspace):
// show publish date/time in the default video-group card"), identified via
// `git log --oneline -S "buildSectionMetadataLine" -- src/components/workspace/WorkspaceVideoGroupCard.jsx`
// during TRADINGBRAIN-WIP-CLOSEOUT-PRECLEAN (2026-09-06/07). WorkspaceVideoGroupCard.jsx
// now imports buildSectionMetadataLine, receives a videoLookup prop, and resolves
// per-group provenance through it — assertions below flipped from the prior
// doesNotMatch/match pair to match current reality instead of the old gap.
assert.match(groupCardSource, /buildSectionMetadataLine/, 'WorkspaceVideoGroupCard.jsx (the live renderer for the default all-videos list) now calls buildSectionMetadataLine — the previously-confirmed gap is closed');
assert.match(groupCardSource, /videoLookup/, 'WorkspaceVideoGroupCard.jsx now receives a videoLookup prop — the freshness lookup fallback can reach it');
// The old group-level date-only "פורסם" line (group.originalVideoDate, no time,
// no videoLookup fallback) was not merely supplemented — it was REPLACED by the
// shared metadataLine composition (see the in-source comment above `metadataLine`
// in WorkspaceVideoGroupCard.jsx). Confirm the old field is gone and the new
// unified line has taken its place, rather than asserting the old line still exists.
assert.doesNotMatch(groupCardSource, /originalVideoDate/, 'the older, replaced group-level publish-date-only (no time) field is gone — superseded by the shared metadataLine, not merely supplemented by it');
assert.match(groupCardSource, /<span>· \{metadataLine\}<\/span>/, 'the new shared metadata line (via buildSectionMetadataLine) renders in its place');

console.log('publish-date-header-coverage QA: 13 assertions passed');
