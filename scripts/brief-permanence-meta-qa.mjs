/**
 * Focused QA for Phase 3 producer-metadata computation
 * (src/lib/briefPermanenceMeta.js). WORK-ID: YMD-BRIEF-PERMANENCE-SPLIT.
 *
 * Pure-function QA — no DOM, no localStorage. Exercises every branch of the
 * design doc's §2.2–§2.4 decision rules against the real functions.
 *
 * Run: node --import ./scripts/register-src-aliases.mjs scripts/brief-permanence-meta-qa.mjs
 */
const {
  resolveBriefSectionKeyFromBulkId,
  resolveBriefPermanenceDefault,
  computeDailyExpiry,
  resolveDateFromTitle,
  resolveDateFromPublishedAt,
  resolveSaveDateJerusalem,
  resolveBriefDate,
  resolveSourceChannel,
  buildBriefPermanenceMeta,
  resolveBriefDestinationPath,
  resolveDailyBriefPath,
  PLAYBOOK_PATH,
} = await import('../src/lib/briefPermanenceMeta.js');

let passed = 0;
let failed = 0;
function assert(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ── resolveBriefSectionKeyFromBulkId — id parsing ────────────────────────────
assert('specialized id → bare key', resolveBriefSectionKeyFromBulkId('specialized:risks:0') === 'risks');
assert('specialized id, multi-word-safe key → bare key', resolveBriefSectionKeyFromBulkId('specialized:economic-calendar:3') === 'economic-calendar');
assert('summary id → compound key', resolveBriefSectionKeyFromBulkId('summary:thirty:0') === 'summary:thirty');
assert('card id (specialized:card:X) is NOT treated as a plain section key', resolveBriefSectionKeyFromBulkId('specialized:card:opportunities-risks') === 'card');
assert('unrelated tab prefix → null (not a brief item)', resolveBriefSectionKeyFromBulkId('useful-knowledge:rule:0') === null);
assert('malformed id (too few segments) → null', resolveBriefSectionKeyFromBulkId('notes:0') === null);
assert('empty/undefined id → null', resolveBriefSectionKeyFromBulkId('') === null && resolveBriefSectionKeyFromBulkId(undefined) === null);

// ── resolveBriefPermanenceDefault — §2.4 table, the 11 real keys ────────────
const dailyDatePlusOne = ['news', 'market-regime', 'sectors', 'opportunities', 'risks', 'economic-calendar', 'macro', 'sentiment', 'markets', 'opportunities-risks'];
for (const key of dailyDatePlusOne) {
  const d = resolveBriefPermanenceDefault(key);
  assert(`§2.4 default for "${key}" is daily/date-plus-1`, d.permanence === 'daily' && d.expiryRule === 'date-plus-1', JSON.stringify(d));
}
assert('§2.4 default for "stocks-mentioned" is daily/five-weekdays', (() => {
  const d = resolveBriefPermanenceDefault('stocks-mentioned');
  return d.permanence === 'daily' && d.expiryRule === 'five-weekdays';
})());
assert('unrecognized key falls back to §2.4\'s own stated safe default (daily/date-plus-1)', (() => {
  const d = resolveBriefPermanenceDefault('levels'); // documented gap: no real producer yet
  return d.permanence === 'daily' && d.expiryRule === 'date-plus-1';
})());

// ── computeDailyExpiry ───────────────────────────────────────────────────────
assert('date-plus-1 expiry', computeDailyExpiry('2026-08-30', 'date-plus-1') === '2026-08-31');
assert('date-plus-1 across month boundary', computeDailyExpiry('2026-08-31', 'date-plus-1') === '2026-09-01');
// 2026-08-30 is a Sunday (verified against a real calendar) — 5 weekdays after: Mon 31, Tue 1, Wed 2, Thu 3, Fri 4.
assert('five-weekdays expiry skips the weekend and lands on the 5th weekday', computeDailyExpiry('2026-08-30', 'five-weekdays') === '2026-09-04', computeDailyExpiry('2026-08-30', 'five-weekdays'));
assert('invalid date string returns null, never a broken expiry', computeDailyExpiry('not-a-date', 'date-plus-1') === null);

// ── §2.2 date resolution — 3 tiers ────────────────────────────────────────────
assert('tier 1: explicit title date, 2-digit year', resolveDateFromTitle('מבזק לייב פתיחה לתאריך 30.08.26') === '2026-08-30');
assert('tier 1: explicit title date, 4-digit year, slash separator', resolveDateFromTitle('מבזק לייב פתיחה לתאריך 5/9/2026') === '2026-09-05');
assert('tier 1: no date phrase in title → null', resolveDateFromTitle('מבזק לייב פתיחה של היום') === null);
assert('tier 1: impossible calendar date rejected, not silently rolled over', resolveDateFromTitle('מבזק לייב פתיחה לתאריך 31.02.26') === null);
assert('tier 2: valid publishedAt', resolveDateFromPublishedAt('2026-08-30T06:00:00.000Z') === '2026-08-30');
assert('tier 2: invalid publishedAt → null', resolveDateFromPublishedAt('not-a-date') === null);
assert('tier 3: save-date resolves to a real YYYY-MM-DD string', /^\d{4}-\d{2}-\d{2}$/.test(resolveSaveDateJerusalem(new Date('2026-08-30T22:30:00.000Z'))));

assert('resolveBriefDate prefers tier 1 (title) over tier 2/3', resolveBriefDate({ title: 'מבזק לייב פתיחה לתאריך 30.08.26', publishedAt: '2026-01-01T00:00:00.000Z' }, { now: new Date('2026-06-01T00:00:00.000Z') }) === '2026-08-30');
assert('resolveBriefDate falls to tier 2 (publishedAt) when title has no date', resolveBriefDate({ title: 'מבזק לייב פתיחה', publishedAt: '2026-02-01T00:00:00.000Z' }, { now: new Date('2026-06-01T00:00:00.000Z') }) === '2026-02-01');
assert('resolveBriefDate falls to tier 3 (save date) when title and publishedAt are both unusable', resolveBriefDate({ title: 'מבזק לייב פתיחה' }, { now: new Date('2026-08-30T22:00:00.000Z') }) === resolveSaveDateJerusalem(new Date('2026-08-30T22:00:00.000Z')));

// ── resolveSourceChannel — reuses the existing channelTitle/channelName/channel chain ─
assert('sourceChannel prefers channelTitle', resolveSourceChannel({ channelTitle: 'ערוץ א', channelName: 'ערוץ ב' }) === 'ערוץ א');
assert('sourceChannel falls back to channelName', resolveSourceChannel({ channelName: 'ערוץ ב' }) === 'ערוץ ב');
assert('sourceChannel falls back to channel', resolveSourceChannel({ channel: 'ערוץ ג' }) === 'ערוץ ג');
assert('sourceChannel is undefined (not stored) when unavailable', resolveSourceChannel({}) === undefined);

// ── buildBriefPermanenceMeta — the all-in-one entry point ────────────────────
assert('non-brief item (unrecognized id) → null, nothing attached', buildBriefPermanenceMeta({ id: 'useful-knowledge:rule:0', video: {} }) === null);
assert('no id at all → null', buildBriefPermanenceMeta({ video: {} }) === null);

const riskMeta = buildBriefPermanenceMeta({
  id: 'specialized:risks:2',
  video: { title: 'מבזק לייב פתיחה לתאריך 30.08.26', channelTitle: 'ערוץ המסחר' },
});
assert('risks item: briefSectionKey', riskMeta?.briefSectionKey === 'risks');
assert('risks item: date from title', riskMeta?.date === '2026-08-30');
assert('risks item: default permanence is daily', riskMeta?.permanence === 'daily');
assert('risks item: expiry computed (date+1)', riskMeta?.expiry === '2026-08-31');
assert('risks item: sourceChannel attached', riskMeta?.sourceChannel === 'ערוץ המסחר');
assert('risks item: no ticker field (not threaded in Phase 3 — see report)', !('ticker' in (riskMeta || {})));

const stocksMeta = buildBriefPermanenceMeta({
  id: 'specialized:stocks-mentioned:0',
  video: { title: 'מבזק לייב פתיחה לתאריך 30.08.26' },
});
assert('stocks-mentioned item: five-weekdays expiry rule applied', stocksMeta?.expiry === '2026-09-04', stocksMeta?.expiry);

const summaryMeta = buildBriefPermanenceMeta({
  id: 'summary:checklist:0',
  video: { title: 'מבזק לייב פתיחה לתאריך 30.08.26' },
});
assert('summary:checklist item: recognized as a brief item', summaryMeta !== null);
assert('summary:checklist item: briefSectionKey is the compound form', summaryMeta?.briefSectionKey === 'summary:checklist');

// permanenceOverride — the future save-picker toggle (§2.5)
const overriddenToPermanent = buildBriefPermanenceMeta({
  id: 'specialized:risks:0',
  video: { title: 'מבזק לייב פתיחה לתאריך 30.08.26' },
  permanenceOverride: 'permanent',
});
assert('override to permanent changes classification', overriddenToPermanent?.permanence === 'permanent');
assert('override to permanent removes expiry entirely (§2.5: "מסיר expiry")', !('expiry' in (overriddenToPermanent || {})));

const overriddenToDaily = buildBriefPermanenceMeta({
  id: 'specialized:risks:0', // real §2.4 default for risks is already daily; still test the explicit path
  video: { title: 'מבזק לייב פתיחה לתאריך 30.08.26' },
  permanenceOverride: 'daily',
});
assert('override to daily (re-)computes expiry', overriddenToDaily?.expiry === '2026-08-31');

const invalidOverrideIgnored = buildBriefPermanenceMeta({
  id: 'specialized:risks:0',
  video: { title: 'מבזק לייב פתיחה לתאריך 30.08.26' },
  permanenceOverride: 'sometimes',
});
assert('an invalid override value is ignored, table default used instead', invalidOverrideIgnored?.permanence === 'daily');

// ── resolveBriefDestinationPath / resolveDailyBriefPath / PLAYBOOK_PATH ──────
assert('PLAYBOOK_PATH matches §3.1 exactly', PLAYBOOK_PATH === "שוק ההון/ספריית ידע/צ'קליסטים/פלייבוק מסחר.md");
assert('daily destination path matches §2.1 exactly', resolveDailyBriefPath('2026-08-30') === 'שוק ההון/מבזקים/2026-08-30.md');
assert('resolveDailyBriefPath with no date returns null (no broken path)', resolveDailyBriefPath('') === null);
assert('resolveBriefDestinationPath(permanent) → playbook', resolveBriefDestinationPath('permanent', '2026-08-30') === PLAYBOOK_PATH);
assert('resolveBriefDestinationPath(daily) → dated brief note', resolveBriefDestinationPath('daily', '2026-08-30') === 'שוק ההון/מבזקים/2026-08-30.md');

console.log(`\nBrief permanence meta QA: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
