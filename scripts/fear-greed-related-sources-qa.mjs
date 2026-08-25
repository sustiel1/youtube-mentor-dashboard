import assert from 'node:assert/strict';
import { FEAR_GREED_RELATED_SOURCES } from '../src/lib/fearGreedRelatedSources.js';
import { FEAR_GREED_INDICATOR_IDS } from '../src/lib/fearGreed.js';

// Every key must be one of the 7 canonical CNN indicator ids — this module
// must never invent an 8th "component" that doesn't map to CNN's own
// methodology (per the audit's mapping requirement).
for (const key of Object.keys(FEAR_GREED_RELATED_SOURCES)) {
  assert.ok(FEAR_GREED_INDICATOR_IDS.includes(key), `unexpected key ${key} is not a CNN indicator id`);
}
for (const id of FEAR_GREED_INDICATOR_IDS) {
  assert.ok(Object.hasOwn(FEAR_GREED_RELATED_SOURCES, id), `missing entry (even if empty) for ${id}`);
}

// put_call_options was audited and excluded: the former app's only related
// link there was a general CBOE landing page, not a direct data page.
assert.deepEqual(FEAR_GREED_RELATED_SOURCES.put_call_options, []);

// Every entry must be a real https link with a short visible chip label and
// a full accessible label naming the provider — and, per the "links only,
// no fabricated value" scope decision, must never carry a value/unit/
// timestamp field (that would imply live data this module doesn't fetch).
for (const [id, sources] of Object.entries(FEAR_GREED_RELATED_SOURCES)) {
  for (const source of sources) {
    assert.match(source.url, /^https:\/\//, `${id} source url must be https`);
    assert.ok(source.shortLabel && source.shortLabel.trim().length > 0, `${id} source needs a shortLabel`);
    assert.ok(source.shortLabel.length <= 10, `${id} shortLabel "${source.shortLabel}" should be a compact chip label`);
    assert.ok(source.provider && source.provider.trim().length > 0, `${id} source needs a provider name`);
    assert.ok(source.ariaLabel && source.ariaLabel.trim().length > 0, `${id} source needs an ariaLabel`);
    assert.ok(!('value' in source), `${id} source must not carry a fabricated value`);
    assert.ok(!('unit' in source), `${id} source must not carry a fabricated unit`);
    assert.ok(!('updatedAt' in source) && !('lastUpdated' in source), `${id} source must not carry a fabricated timestamp`);
  }
}

// The accessible label must distinguish these from the CNN graph-link
// wording used elsewhere, and must name the actual provider — matching the
// acceptance criteria's "פתח גרף VIX באתר CBOE"-style example.
for (const sources of Object.values(FEAR_GREED_RELATED_SOURCES)) {
  for (const source of sources) {
    assert.doesNotMatch(source.ariaLabel, /פתח את עמוד המדד ב־CNN/);
    assert.ok(source.ariaLabel.includes(source.provider), `ariaLabel "${source.ariaLabel}" should name provider "${source.provider}"`);
  }
}

// No two entries for the same indicator (or across indicators) may share an
// identical destination URL — the exact duplication bug that was audited
// and fixed (stock_price_strength and stock_price_breadth previously both
// pointed at $NYA200R).
const allUrls = Object.values(FEAR_GREED_RELATED_SOURCES).flat().map((s) => s.url);
assert.equal(new Set(allUrls).size, allUrls.length, 'no two related-source entries may share the same destination URL');

console.log('Fear & Greed related-sources QA: PASS');
