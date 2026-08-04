/**
 * Regression test: Specialized News / Sectors mapping fix.
 * Run with: node scripts/test-specialized-news-sectors-mapping.mjs
 *
 * Reproduces the reported bug: resolveSpecialized() shallow-spreads
 * { ...rawData, ...universalTabs.specialized }, so a present-but-empty (or thinner)
 * universalTabs.specialized.marketNews / .sectorRotation silently clobbers a populated
 * rawData array, leaving the News / Sectors dedicated views empty even though real
 * data exists. Also covers multi-shape item normalization:
 *   News:    { title, description } | { event } | { headline, summary/impact }
 *   Sectors: { sector, status } | { sector, trend } | { name, status }
 */
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
const {
  extractVideoTabItems,
  resolveSpecializedNewsItems,
  resolveSpecializedSectorItems,
  formatNewsItem,
  formatSectorItem,
} = await vite.ssrLoadModule('/src/config/videoTabsConfig.js');

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

console.log('\n=== Specialized News / Sectors Mapping Regression ===\n');

// ── 1. News from rawData.marketNews using { title, description } ──────────
console.log('1. News from rawData.marketNews — { title, description }');
{
  const gem = { rawData: { marketNews: [{ title: 'הנפקת SK Hynix בנאסדאק', description: 'הנפקה חיצונית ענקית.' }] } };
  const items = resolveSpecializedNewsItems(gem);
  assert('resolves 1 item', items.length === 1);
  assert(
    'formatted string keeps both title and description',
    formatNewsItem(items[0]) === 'הנפקת SK Hynix בנאסדאק — הנפקה חיצונית ענקית.',
  );
}

// ── 2. News from universalTabs.specialized.marketNews using { event } ──────
console.log('\n2. News from universalTabs.specialized.marketNews — { event }');
{
  const gem = { universalTabs: { specialized: { marketNews: [{ event: 'הכרזת ועדות הפד' }] } } };
  const items = resolveSpecializedNewsItems(gem);
  assert('resolves 1 item', items.length === 1);
  assert('formatted string uses event as title', formatNewsItem(items[0]) === 'הכרזת ועדות הפד');
}

// ── 3. Sectors from rawData.sectorRotation using { sector, status } ────────
console.log('\n3. Sectors from rawData.sectorRotation — { sector, status }');
{
  const gem = { rawData: { sectorRotation: [{ sector: 'Semiconductors', status: 'ירידות ולחץ מוכרים זמני' }] } };
  const items = resolveSpecializedSectorItems(gem);
  assert('resolves 1 item', items.length === 1);
  assert(
    'formatted string keeps sector + status',
    formatSectorItem(items[0]) === 'Semiconductors: ירידות ולחץ מוכרים זמני',
  );
}

// ── 4. Sectors from universalTabs.specialized.sectorRotation using { sector, trend } ──
console.log('\n4. Sectors from universalTabs.specialized.sectorRotation — { sector, trend }');
{
  const gem = { universalTabs: { specialized: { sectorRotation: [{ sector: 'Software', trend: 'חלש וסופג היצעים זמניים' }] } } };
  const items = resolveSpecializedSectorItems(gem);
  assert('resolves 1 item', items.length === 1);
  assert(
    'formatted string keeps sector + trend',
    formatSectorItem(items[0]) === 'Software: חלש וסופג היצעים זמניים',
  );
}

// ── 5. universalTabs nested inside rawData ─────────────────────────────────
console.log('\n5. universalTabs nested inside rawData');
{
  const gem = { rawData: { universalTabs: { specialized: { marketNews: [{ event: 'אירוע מקונן' }] } } } };
  const items = resolveSpecializedNewsItems(gem);
  assert('resolves nested rawData.universalTabs.specialized.marketNews', items.length === 1);
}

// ── 6. universalTabs located at root ───────────────────────────────────────
console.log('\n6. universalTabs located at root');
{
  const gem = { universalTabs: { specialized: { sectorRotation: [{ sector: 'Biotech', status: 'חיובי' }] } } };
  const items = resolveSpecializedSectorItems(gem);
  assert('resolves root universalTabs.specialized.sectorRotation', items.length === 1);
}

// ── 7. Duplicate entries across raw + specialized — prefer richer item ──────
console.log('\n7. Duplicate entries across raw + specialized — prefer richer item');
{
  const gem = {
    rawData: { marketNews: [{ title: 'מייקרוסופט מפטרת עובדים' }] },
    universalTabs: {
      specialized: {
        marketNews: [{ title: 'מייקרוסופט מפטרת עובדים', description: '4,800 מפוטרים, בעיקר מאקסבוקס' }],
      },
    },
  };
  const items = resolveSpecializedNewsItems(gem);
  assert('dedupes to a single item', items.length === 1);
  assert('keeps the richer (title+description) version', formatNewsItem(items[0]).includes('4,800'));
}

// ── 8. Missing optional description — item still kept ──────────────────────
console.log('\n8. Missing optional description — item still valid');
{
  const gem = { rawData: { marketNews: [{ title: 'כותרת בלבד ללא תיאור' }] } };
  const items = resolveSpecializedNewsItems(gem);
  assert('item without description is kept', items.length === 1);
  assert('formatted string is just the title', formatNewsItem(items[0]) === 'כותרת בלבד ללא תיאור');
}

// ── 9. Truly empty data — correct empty state ──────────────────────────────
console.log('\n9. Truly empty data — empty state');
{
  assert('no marketNews anywhere → []', resolveSpecializedNewsItems({}).length === 0);
  assert(
    'empty specialized.sectorRotation + no rawData → []',
    resolveSpecializedSectorItems({ universalTabs: { specialized: { sectorRotation: [] } } }).length === 0,
  );
}

// ── 10. Legacy flat GEM JSON (no universalTabs) still works ───────────────
console.log('\n10. Legacy flat GEM JSON (no universalTabs) still works');
{
  const legacyGem = {
    marketNews: [{ headline: 'חדשות ישנות', summary: 'תקציר ישן' }],
    sectorRotation: [{ sector: 'Energy', trend: 'עולה' }],
  };
  const newsItems = resolveSpecializedNewsItems(legacyGem);
  const sectorItems = resolveSpecializedSectorItems(legacyGem);
  assert('legacy top-level marketNews resolved', newsItems.length === 1);
  assert('legacy top-level sectorRotation resolved', sectorItems.length === 1);
}

// ── 11. extractVideoTabItems integration — clobbering bug reproduction ─────
console.log('\n11. extractVideoTabItems integration — clobbering bug reproduction');
{
  // Reproduces the exact reported failure: universalTabs.specialized.marketNews /
  // .sectorRotation are present but EMPTY and must not wipe out rawData's real items.
  const gem = {
    contentType: 'marketBrief',
    rawData: {
      marketNews: [
        { headline: 'מייקרוסופט מפטרת 4,800 עובדים', impact: '3,200 מתוכם מחטיבת אקסבוקס' },
      ],
      sectorRotation: [
        { sector: 'Semiconductors', status: 'לחץ מוכרים סמוי' },
      ],
    },
    universalTabs: {
      specialized: {
        marketNews: [],
        sectorRotation: [],
      },
    },
  };
  const newsTabItems = extractVideoTabItems({ title: 'x' }, 'market-news', gem);
  const sectorTabItems = extractVideoTabItems({ title: 'x' }, 'brief-sectors', gem);
  assert('market-news tab is NOT empty despite empty specialized.marketNews', newsTabItems.length > 0);
  assert(
    'market-news tab keeps the headline+impact text',
    newsTabItems.some((i) => typeof i === 'string' && i.includes('מייקרוסופט') && i.includes('אקסבוקס')),
  );
  assert('brief-sectors tab is NOT empty despite empty specialized.sectorRotation', sectorTabItems.length > 0);
  assert(
    'brief-sectors tab keeps sector + status text',
    sectorTabItems.some((i) => typeof i === 'string' && i.includes('Semiconductors') && i.includes('לחץ מוכרים')),
  );
}

// ── Result ──────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
await vite.close();
if (failed > 0) process.exit(1);
