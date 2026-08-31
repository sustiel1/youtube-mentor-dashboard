/**
 * Live-Stream Brief Permanence — Phase 3 producer wiring.
 * WORK-ID: YMD-BRIEF-PERMANENCE-SPLIT
 *
 * Pure logic layer that computes the six optional obsidianItemSaveStore
 * fields (docs/LIVE_STREAM_BRIEF_PERMANENCE_SCHEME.md §2.2) for an
 * individually-saved morning-brief bulk item, following the design's
 * default table (§2.4) exactly. No routing engine, no store, no
 * side effects — callers decide what to do with the returned values.
 *
 * KNOWN GAP (found during Phase 3 investigation, not fixed here — see the
 * Phase 3 report): the design doc's §1.2/§2.4 table lists 14 producer keys,
 * but `buildMorningBriefBulkSections()` (src/lib/morningBriefBulkSections.js)
 * currently only emits 10 of them (news, market-regime, sectors,
 * opportunities, risks, stocks-mentioned, economic-calendar, macro,
 * sentiment, markets) plus the combined `opportunities-risks` card key.
 * `levels` (key levels) has no standalone producer today — that data, when
 * present, is folded into the `markets` section instead. `top-insights`,
 * `learning-insights`, and `all-points` also have no standalone producer —
 * videoTabsConfig.js's `brief-conclusions` case merges all three of their
 * source arrays (reusableKnowledge/actionChecklist/conclusions/
 * top5Insights/learningInsights/keyTakeaways) into ONE undifferentiated
 * array with no per-item provenance to split them back apart. Building
 * that split is a real (if small) extraction-logic change, not just
 * "wiring an existing producer" — left for a follow-up decision. Any bulk
 * item whose key isn't recognized below (including these 4) falls through
 * to the design doc's own stated safe default: daily, dated target,
 * expiry = date + 1 — never silently unclassified.
 */

// ── §2.4 default table — the 11 real, currently-producing keys ─────────────
// (10 buildMorningBriefBulkSections() keys + the combined opportunities-risks
// card key from buildMorningBriefCardBulkItems()). Every other key —
// including the 4 documented-but-not-yet-produced ones above and any future
// unrecognized key — uses DEFAULT_FALLBACK below, exactly per §2.4's own
// stated fallback rule.
const BRIEF_SECTION_DEFAULTS = {
  'news': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'market-regime': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'sectors': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'opportunities': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'risks': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'stocks-mentioned': { permanence: 'daily', expiryRule: 'five-weekdays' },
  'economic-calendar': { permanence: 'daily', expiryRule: 'date-plus-1' }, // event-date+1 needs a per-row event date not available at this layer; §2.4's own stated fallback applies
  'macro': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'sentiment': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'markets': { permanence: 'daily', expiryRule: 'date-plus-1' },
  'opportunities-risks': { permanence: 'daily', expiryRule: 'date-plus-1' },
};

const DEFAULT_FALLBACK = { permanence: 'daily', expiryRule: 'date-plus-1' };

/** §3.1 — the one standing playbook note. Never created per-item; items land in its waiting section. */
export const PLAYBOOK_PATH = "שוק ההון/ספריית ידע/צ'קליסטים/פלייבוק מסחר.md";

/** §2.1 — dated daily archive note for a given `YYYY-MM-DD` brief date. */
export function resolveDailyBriefPath(date) {
  const d = String(date || '').trim();
  return d ? `שוק ההון/מבזקים/${d}.md` : null;
}

/**
 * Extracts the canonical `briefSectionKey` (§2.4) from a bulk item's `id`.
 * IDs are built by buildBulkItemsFromSections(sections, idPrefix) as
 * `${idPrefix}:${key}:${index}` (src/lib/universalTabBulkItems.js).
 *   - idPrefix 'specialized' (the morning-brief tab) → bare key, e.g. "risks".
 *   - idPrefix 'summary' → compound key, e.g. "summary:thirty" (matches
 *     §2.4's own `summary:*` row naming exactly).
 *   - anything else (card ids, other tabs, legacy ids with no id at all) →
 *     null — this is the "not a recognized brief-producer item" signal;
 *     callers must treat null as "do not attach permanence metadata".
 * @param {string} [id]
 * @returns {string|null}
 */
export function resolveBriefSectionKeyFromBulkId(id) {
  const raw = String(id || '').trim();
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length < 3) return null;
  const [prefix, key] = parts;
  if (!key) return null;
  if (prefix === 'specialized') return key;
  if (prefix === 'summary') return `summary:${key}`;
  return null;
}

/** §2.4 — default permanence + expiry rule for a canonical briefSectionKey. Never null. */
export function resolveBriefPermanenceDefault(briefSectionKey) {
  return BRIEF_SECTION_DEFAULTS[briefSectionKey] || DEFAULT_FALLBACK;
}

function toDateOnly(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDateOnly(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateOnly(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/**
 * §2.4 — "5 ימי מסחר" = five Mon–Fri days after `date`, no external calendar,
 * no holiday awareness (documented v1 limitation; user may correct manually).
 */
function addFiveWeekdays(d) {
  let cur = toDateOnly(d);
  let remaining = 5;
  while (remaining > 0) {
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
    const dow = cur.getUTCDay(); // 0=Sun..6=Sat
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return cur;
}

/**
 * §2.4 — expiry is "the first day the item is no longer active"; a daily
 * item expires once `today >= expiry`. Date-only arithmetic, no network,
 * no timezone conversion (the date itself is already the resolved calendar
 * day — see resolveBriefDate).
 * @param {string} dateStr `YYYY-MM-DD`
 * @param {'date-plus-1'|'five-weekdays'} expiryRule
 * @returns {string|null} `YYYY-MM-DD`, or null if dateStr is invalid
 */
export function computeDailyExpiry(dateStr, expiryRule) {
  const base = parseDateOnly(dateStr);
  if (!base) return null;
  if (expiryRule === 'five-weekdays') return formatDateOnly(addFiveWeekdays(base));
  const plusOne = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  return formatDateOnly(plusOne);
}

// ── §2.2 date resolution — three tiers, no network call ─────────────────────

// "מבזק לייב פתיחה לתאריך DD.MM.YY[YY]" — the real, documented title
// convention (src/config/videoTabsConfig.js's MORNING_BRIEF_KEYWORDS comment,
// src/lib/gemRecommender.js). Day/month may be 1-2 digits; year 2 or 4.
const TITLE_DATE_RE = /לתאריך\s+(\d{1,2})[./](\d{1,2})[./](\d{2,4})/;

/** Tier 1 — explicit, verified date from the video title. Returns `YYYY-MM-DD` or null. */
export function resolveDateFromTitle(title) {
  const m = TITLE_DATE_RE.exec(String(title || ''));
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible calendar dates (e.g. 31.02) rather than silently rolling over.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return formatDateOnly(d);
}

/** Tier 2 — the video's own publish timestamp, if parseable. Returns `YYYY-MM-DD` or null. */
export function resolveDateFromPublishedAt(publishedAt) {
  if (!publishedAt) return null;
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateOnly(toDateOnly(d));
}

/**
 * Tier 3 — the save date itself, in Asia/Jerusalem (no network call: uses
 * Intl's built-in tz database, not a live time service).
 */
export function resolveSaveDateJerusalem(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

/**
 * §2.2 full date decision: explicit verified title date → publishedAt →
 * save date (Asia/Jerusalem). Always returns a `YYYY-MM-DD` string.
 */
export function resolveBriefDate(video, { now = new Date() } = {}) {
  return (
    resolveDateFromTitle(video?.title)
    || resolveDateFromPublishedAt(video?.publishedAt)
    || resolveSaveDateJerusalem(now)
  );
}

/**
 * Channel name from video metadata — reuses this codebase's existing
 * channelTitle/channelName/channel fallback chain (see VideoDetailPanel.jsx).
 * Returns undefined (not stored) when unavailable, per §2.2.
 */
export function resolveSourceChannel(video) {
  const name = String(video?.channelTitle || video?.channelName || video?.channel || '').trim();
  return name || undefined;
}

/**
 * All-in-one: computes the full permanence-meta object for one bulk item,
 * or null when the item's `id` doesn't resolve to a recognized brief
 * producer key AND no explicit override was given — meaning "this is not a
 * brief item; attach nothing" (Phase 2's additive contract: omit entirely).
 *
 * @param {object} params
 * @param {string} [params.id] — the bulk item's id (buildBulkItemsFromSections shape)
 * @param {object} [params.video] — the video record (title, publishedAt, channel fields)
 * @param {Date} [params.now]
 * @param {'permanent'|'daily'|null} [params.permanenceOverride] — explicit save-picker toggle (§2.5); null/undefined = use table default
 * @returns {{briefSectionKey: string, date: string, permanence: 'permanent'|'daily', expiry?: string, sourceChannel?: string}|null}
 */
export function buildBriefPermanenceMeta({ id, video, now = new Date(), permanenceOverride = null } = {}) {
  const briefSectionKey = resolveBriefSectionKeyFromBulkId(id);
  if (!briefSectionKey) return null;

  const { permanence: defaultPermanence, expiryRule } = resolveBriefPermanenceDefault(briefSectionKey);
  const permanence = permanenceOverride === 'permanent' || permanenceOverride === 'daily'
    ? permanenceOverride
    : defaultPermanence;

  const date = resolveBriefDate(video, { now });
  const sourceChannel = resolveSourceChannel(video);

  const meta = { briefSectionKey, date, permanence };
  if (permanence === 'daily') {
    const expiry = computeDailyExpiry(date, expiryRule);
    if (expiry) meta.expiry = expiry;
  }
  if (sourceChannel) meta.sourceChannel = sourceChannel;
  return meta;
}

/** §2.1/§2.5 — the suggested destination path for a permanence classification. */
export function resolveBriefDestinationPath(permanence, date) {
  if (permanence === 'permanent') return PLAYBOOK_PATH;
  return resolveDailyBriefPath(date);
}
