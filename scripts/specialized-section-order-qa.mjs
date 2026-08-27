import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { orderSpecializedSections } from '../src/lib/specializedSectionOrder.js';
import { groupWorkspaceItemsByVideo } from '../src/utils/workspaceVideoGrouping.js';
import { selectSavedAnalysisViewer } from '../src/utils/workspaceSavedAnalysis.js';

const section = (key) => ({ key, marker: key });
const full = [
  section('news'),
  section('market-regime'),
  section('sectors'),
  section('opportunities'),
  section('sentiment'),
  section('economic-calendar'),
  section('macro'),
  section('stocks-mentioned'),
  section('markets'),
];
const before = JSON.stringify(full);
const ordered = orderSpecializedSections(full);
assert.deepEqual(ordered.map((item) => item.key), [
  'sentiment', 'market-regime', 'economic-calendar', 'macro', 'news', 'opportunities', 'sectors', 'markets', 'stocks-mentioned',
]);
assert.equal(JSON.stringify(full), before, 'source array and sections remain unchanged');
assert.equal(new Set(ordered).size, full.length, 'sections are not duplicated');
assert.ok(ordered.every((item) => full.includes(item)), 'original section objects are reused');

assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'sentiment')).map((item) => item.key),
  ['market-regime', 'economic-calendar', 'macro', 'news', 'opportunities', 'sectors', 'markets', 'stocks-mentioned'],
);
assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'market-regime')).map((item) => item.key),
  ['sentiment', 'economic-calendar', 'macro', 'news', 'opportunities', 'sectors', 'markets', 'stocks-mentioned'],
);
assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'economic-calendar')).map((item) => item.key),
  ['sentiment', 'market-regime', 'macro', 'news', 'opportunities', 'sectors', 'markets', 'stocks-mentioned'],
);
assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'macro')).map((item) => item.key),
  ['sentiment', 'market-regime', 'economic-calendar', 'news', 'opportunities', 'sectors', 'markets', 'stocks-mentioned'],
);
assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'sectors')).map((item) => item.key),
  ['sentiment', 'market-regime', 'economic-calendar', 'macro', 'news', 'opportunities', 'markets', 'stocks-mentioned'],
);
assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'opportunities')).map((item) => item.key),
  ['sentiment', 'market-regime', 'economic-calendar', 'macro', 'news', 'sectors', 'markets', 'stocks-mentioned'],
);
assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'markets')).map((item) => item.key),
  ['sentiment', 'market-regime', 'economic-calendar', 'macro', 'news', 'opportunities', 'sectors', 'stocks-mentioned'],
);
assert.deepEqual(
  orderSpecializedSections(full.filter((item) => item.key !== 'stocks-mentioned')).map((item) => item.key),
  ['sentiment', 'market-regime', 'economic-calendar', 'macro', 'news', 'opportunities', 'sectors', 'markets'],
);
assert.deepEqual(
  orderSpecializedSections([
    section('news'),
    section('stocks-mentioned'),
    section('indices'),
    section('archive'),
  ]).map((item) => item.key),
  ['news', 'indices', 'stocks-mentioned', 'archive'],
);
assert.deepEqual(
  orderSpecializedSections([
    section('news'),
    section('sectors'),
    section('brief-opportunities'),
    section('brief-risks'),
    section('markets'),
  ]).map((item) => item.key),
  ['news', 'brief-opportunities', 'brief-risks', 'sectors', 'markets'],
);
assert.deepEqual(
  orderSpecializedSections([section('news'), section('sectors')]).map((item) => item.key),
  ['news', 'sectors'],
);
assert.deepEqual(orderSpecializedSections(null), []);

const oldPartial = [
  { id: 'legacy-a', heading: 'כותרת ישנה' },
  { id: 'legacy-b', heading: 'סעיף נוסף' },
];
assert.deepEqual(orderSpecializedSections(oldPartial), oldPartial, 'old sections without stable keys preserve order');

const persisted = [
  { id: 'macro', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'brief-macro', sourceHeading: 'מאקרו', identityPayload: { text: 'CPI' } },
  { id: 'news', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'news', sourceHeading: 'חדשות', identityPayload: { text: 'חדשות' } },
  { id: 'regime', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'market-regime', sourceHeading: 'מצב שוק', identityPayload: { text: 'חיובי' } },
  { id: 'sector', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'sectors', sourceHeading: 'סקטורים', identityPayload: { text: 'טכנולוגיה' } },
  { id: 'opportunity', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'brief-opportunities', sourceHeading: 'הזדמנויות וסיכונים', identityPayload: { text: 'הזדמנות' } },
  { id: 'stock', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'stocks-mentioned', sourceHeading: 'מניות שהוזכרו', identityPayload: { text: 'MRK' } },
  { id: 'market', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'indices', sourceHeading: 'שווקים', identityPayload: { text: 'RSP' } },
  { id: 'sentiment', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'sentiment', sourceHeading: 'סנטימנט שוק', identityPayload: { text: 'ניטרלי' } },
  { id: 'calendar', sourceVideoId: 'video-1', sourceTabId: 'specialized', sourceSectionId: 'brief-calendar', sourceHeading: 'לוח כלכלי', identityPayload: { text: 'קיצור חיצוני' } },
];
const persistedBefore = JSON.stringify(persisted);
const group = groupWorkspaceItemsByVideo(persisted).videoGroups[0];
const viewer = selectSavedAnalysisViewer(group);
assert.deepEqual(
  viewer.byTab.specialized.map((item) => item.provenance[0].sourceSectionId),
  ['sentiment', 'market-regime', 'brief-calendar', 'brief-macro', 'news', 'brief-opportunities', 'sectors', 'indices', 'stocks-mentioned'],
  'focused and global Workspace renderers share the ordered specialized collection',
);
assert.equal(JSON.stringify(persisted), persistedBefore, 'persisted records are not mutated');

const dashboardSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefDashboard.jsx', import.meta.url),
  'utf8',
);
const sentimentIndex = dashboardSource.indexOf('<SentimentSection');
const regimeIndex = dashboardSource.indexOf('<MarketRegimeSection');
const calendarIndex = dashboardSource.indexOf('<EconomicCalendarSection');
const macroIndex = dashboardSource.indexOf('<MacroSection');
const newsIndex = dashboardSource.indexOf('<NewsSection');
const sectorsIndex = dashboardSource.indexOf('<SectorOverviewSection');
const opportunitiesIndex = dashboardSource.indexOf('<OpportunitiesRisksDashboard');
const stocksIndex = dashboardSource.indexOf('<StocksMentionedSection');
const marketsIndex = dashboardSource.indexOf('<MarketsSection');
const dashboardSectionOrder = [...dashboardSource.matchAll(
  /<(SentimentSection|MarketRegimeSection|EconomicCalendarSection|MacroSection|NewsSection|OpportunitiesRisksDashboard|SectorOverviewSection|StocksMentionedSection|MarketsSection)\b/g,
)].map((match) => match[1]);
assert.deepEqual(dashboardSectionOrder, [
  'SentimentSection',
  'MarketRegimeSection',
  'EconomicCalendarSection',
  'MacroSection',
  'NewsSection',
  'OpportunitiesRisksDashboard',
  'SectorOverviewSection',
  'MarketsSection',
  'StocksMentionedSection',
], 'dashboard keeps both required section pairs adjacent');
assert.equal(
  dashboardSectionOrder[dashboardSectionOrder.indexOf('MarketsSection') + 1],
  'StocksMentionedSection',
  'markets is immediately followed by stocks mentioned',
);
assert.ok(sentimentIndex >= 0 && sentimentIndex < regimeIndex, 'sentiment renders first');
assert.ok(regimeIndex < newsIndex, 'market regime renders immediately after sentiment');
assert.ok(regimeIndex < calendarIndex && calendarIndex < macroIndex, 'calendar renders immediately after market regime');
assert.ok(macroIndex < newsIndex, 'macro renders immediately after the calendar shortcut');
assert.equal(dashboardSource.match(/<EconomicCalendarSection/g)?.length, 1, 'calendar section is rendered once');
assert.equal(dashboardSource.match(/<MacroSection/g)?.length, 1, 'macro section is moved, not duplicated');
assert.equal(dashboardSource.match(/<OpportunitiesRisksDashboard/g)?.length, 1, 'opportunities and risks section is moved, not duplicated');
assert.equal(dashboardSource.match(/<SectorOverviewSection/g)?.length, 1, 'sectors remain a separate section');
assert.equal(dashboardSource.match(/<MarketsSection/g)?.length, 1, 'markets section is moved, not duplicated');
assert.equal(dashboardSource.match(/<StocksMentionedSection/g)?.length, 1, 'stocks mentioned remains a separate section');
assert.ok(
  newsIndex < opportunitiesIndex
    && opportunitiesIndex < sectorsIndex
    && sectorsIndex < marketsIndex
    && marketsIndex < stocksIndex,
  'remaining dashboard sections retain their prior relative order',
);

const panelsSource = readFileSync(
  new URL('../src/components/dashboard/MorningBriefPanels.jsx', import.meta.url),
  'utf8',
);
const calendarLinksSource = readFileSync(
  new URL('../src/components/dashboard/EconomicCalendarHeaderLinks.jsx', import.meta.url),
  'utf8',
);
const expectedCalendarUrls = [
  'https://il.investing.com/economic-calendar',
  'https://il.investing.com/earnings-calendar',
  'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
  'https://il.investing.com/holiday-calendar/',
  'https://il.investing.com/dividends-calendar/',
  'https://il.investing.com/ipo-calendar/',
  'https://www.treasurydirect.gov/auctions/upcoming/',
];
const expectedCalendarAriaLabels = [
  'פתיחת הלוח הכלכלי באתר Investing.com ישראל',
  'פתיחת יומן הדוחות הכספיים',
  'פתיחת לוח החלטות הריבית של הפדרל ריזרב',
  'פתיחת לוח החופשות בבורסות',
  'פתיחת תפריט לוחות נוספים',
  'פתיחת יומן הדיבידנדים',
  'פתיחת יומן ההנפקות',
  'פתיחת לוח מכרזי אג״ח ארצות הברית',
];
for (const url of expectedCalendarUrls) {
  assert.ok(calendarLinksSource.includes(`'${url}'`), `calendar URL must remain exact: ${url}`);
}
for (const label of expectedCalendarAriaLabels) {
  assert.ok(calendarLinksSource.includes(label), `calendar accessibility label must remain exact: ${label}`);
}
assert.ok(calendarLinksSource.includes('target="_blank"'));
assert.ok(calendarLinksSource.includes('rel="noopener noreferrer"'));
assert.ok(calendarLinksSource.includes('aria-expanded={open}'));
assert.ok(calendarLinksSource.includes('aria-controls={menuId}'));
assert.ok(calendarLinksSource.includes("event.key !== 'Escape'"));
assert.ok(calendarLinksSource.includes('event.stopPropagation()'));
assert.ok(calendarLinksSource.includes('event.stopImmediatePropagation()'));
assert.ok(calendarLinksSource.includes("buttonRef.current?.focus()"));
assert.ok(calendarLinksSource.includes("window.addEventListener('keydown', handleKeyDown, true)"));
assert.ok(calendarLinksSource.includes("document.addEventListener('pointerdown', handlePointerDown)"));
assert.ok(calendarLinksSource.includes('onOpen();'));
assert.ok(calendarLinksSource.includes("hidden items-center gap-2 xl:flex"));
assert.ok(calendarLinksSource.includes("responsivePrimary ? 'xl:hidden'"));
assert.ok(calendarLinksSource.includes('<span>לוח כלכלי 📅</span>'));
assert.ok(calendarLinksSource.includes("label: 'לוח כלכלי'"));
assert.ok(panelsSource.includes('data-economic-calendar-shortcut'));
assert.ok(panelsSource.includes('headerLinks={<EconomicCalendarHeaderLinks />}'));
assert.ok(!calendarLinksSource.includes('utm_'));

const calendarSectionSource = panelsSource.slice(
  panelsSource.indexOf('export function EconomicCalendarSection'),
  panelsSource.indexOf('export function OpportunitiesRisksDashboard'),
);
const calendarActionIndex = calendarSectionSource.indexOf('<EconomicCalendarActionLink />');
const calendarEditIndex = calendarSectionSource.indexOf('{edit.headerActions}');
assert.ok(calendarActionIndex >= 0, 'calendar action remains in the calendar header');
assert.ok(calendarEditIndex >= 0, 'edit action remains in the calendar header');
assert.ok(calendarActionIndex < calendarEditIndex, 'calendar action and edit positions are swapped in RTL DOM order');

console.log('specialized section order QA: all assertions passed');
