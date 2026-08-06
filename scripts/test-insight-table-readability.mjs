import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/dashboard/MorningBriefDashboard.jsx', 'utf8');
assert.match(source, /insight-readable-table/);
assert.match(source, /<table/);
assert.match(source, /align-top text-\[15px\].*leading-7 text-slate-800/);
assert.match(source, /records\.some\(\(record\) => displayValue\(structuredFieldValue/);
assert.match(source, /record\?\.whyImportant \?\? record\?\.meaning/);
assert.match(source, /record\?\.reason \?\? record\?\.whyImportant/);
assert.match(source, /watch: 'מעקב'/);
assert.match(source, /avoid: 'להימנע'/);
assert.match(source, /bulkSelection\?\.onToggle/);
console.log('Insight table readability regression: PASS');
