const ROUTES = [
  { canonicalKey: 'US_CPI', aliases: ['CPI', 'CORE_CPI', 'אינפלציה', 'מדד המחירים לצרכן', 'אינפלציית ליבה'], labelHe: 'מדד המחירים לצרכן בארצות הברית', provider: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/cpi/', destinationType: 'official-data', exactness: 'exact', updateCadence: 'monthly' },
  { canonicalKey: 'US_PPI', aliases: ['PPI', 'מדד המחירים ליצרן'], labelHe: 'מדד המחירים ליצרן בארצות הברית', provider: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/ppi/', destinationType: 'official-data', exactness: 'exact', updateCadence: 'monthly' },
  { canonicalKey: 'FED_RATE', aliases: ['FOMC', 'FED', 'ריבית הפד'], labelHe: 'מדיניות הריבית של הפדרל ריזרב', provider: 'Federal Reserve', url: 'https://www.federalreserve.gov/monetarypolicy/fomc.htm', destinationType: 'official-data', exactness: 'exact', updateCadence: 'event-based' },
  { canonicalKey: 'US_EMPLOYMENT', aliases: ['NFP', 'UNEMPLOYMENT', 'תעסוקה', 'אבטלה', 'דוח התעסוקה'], labelHe: 'דוח התעסוקה בארצות הברית', provider: 'U.S. Bureau of Labor Statistics', url: 'https://www.bls.gov/news.release/empsit.htm', destinationType: 'official-data', exactness: 'exact', updateCadence: 'monthly' },
  { canonicalKey: 'US_GDP', aliases: ['GDP', 'תוצר', 'תוצר מקומי גולמי'], labelHe: 'התוצר המקומי הגולמי בארצות הברית', provider: 'U.S. Bureau of Economic Analysis', url: 'https://www.bea.gov/data/gdp/gross-domestic-product', destinationType: 'official-data', exactness: 'exact', updateCadence: 'quarterly' },
  { canonicalKey: 'US_PCE', aliases: ['PCE', 'CORE_PCE', 'מדד PCE', 'הוצאות צריכה אישית'], labelHe: 'מדד מחירי הוצאות הצריכה האישית', provider: 'U.S. Bureau of Economic Analysis', url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index', destinationType: 'official-data', exactness: 'exact', updateCadence: 'monthly' },
  { canonicalKey: 'US_RETAIL_SALES', aliases: ['RETAIL SALES', 'מכירות קמעונאיות'], labelHe: 'מכירות קמעונאיות בארצות הברית', provider: 'U.S. Census Bureau', url: 'https://www.census.gov/retail/index.html', destinationType: 'official-data', exactness: 'exact', updateCadence: 'monthly' },
  { canonicalKey: 'BONDS10Y', aliases: ['US10Y', 'TNX', 'אג״ח 10Y', 'אגח 10Y', 'תשואת אג״ח ל-10 שנים'], labelHe: 'תשואת אג״ח ארצות הברית ל-10 שנים', provider: 'Investing.com ישראל', url: 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield', destinationType: 'market-chart', exactness: 'exact', updateCadence: 'intraday' },
  { canonicalKey: 'WTI', aliases: ['OIL', 'WTI', 'נפט WTI', 'נפט'], labelHe: 'מחיר ספוט לנפט WTI', provider: 'U.S. Energy Information Administration', url: 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm', destinationType: 'official-data', exactness: 'exact', updateCadence: 'daily' },
  { canonicalKey: 'VIX', aliases: ['VIX', 'מדד הפחד', 'מדד התנודתיות'], labelHe: 'מדד התנודתיות VIX', provider: 'Cboe Global Markets', url: 'https://www.cboe.com/tradable_products/vix/', destinationType: 'market-chart', exactness: 'exact', updateCadence: 'intraday' },
  { canonicalKey: 'AI_INFRASTRUCTURE_CAPEX', aliases: ['AI CAPEX', 'AI INFRASTRUCTURE CAPEX', 'השקעות הון בתשתיות AI', 'השקעות הון בתשתיות AI (CAPEX)'], labelHe: 'השקעות הון בתשתיות AI', provider: 'נתוני הסרטון', url: '', destinationType: 'internal-detail', exactness: 'proxy', updateCadence: 'event-based' },
];

const CADENCE_HE = { intraday: 'תוך־יומי', daily: 'יומי', weekly: 'שבועי', monthly: 'חודשי', quarterly: 'רבעוני', 'event-based': 'לפי אירוע' };

function normalize(value) {
  return String(value ?? '').normalize('NFKC').replace(/["'׳״]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLocaleUpperCase('he');
}

const NORMALIZED_ROUTES = ROUTES.map((route) => ({ ...route, normalizedKeys: [route.canonicalKey, ...route.aliases].map(normalize) }));

function withAccessibleMetadata(route) {
  const exactnessHe = route.exactness === 'exact' ? 'התאמה מדויקת' : 'מדד מייצג';
  const cadenceHe = CADENCE_HE[route.updateCadence] || route.updateCadence;
  const actionHe = route.destinationType === 'internal-detail' ? 'פתח פירוט ראיות פנימי' : 'פתח נתונים עדכניים';
  const topicHe = route.canonicalKey === 'FED_RATE' ? 'ניטור ריבית הפד · ' : '';
  const ariaTopicHe = route.canonicalKey === 'FED_RATE' ? 'מידע על ציפיות ריבית הפד. ' : '';
  return { ...route, tooltipHe: `${topicHe}${route.provider} · ${cadenceHe} · ${exactnessHe}`, ariaLabelHe: `${ariaTopicHe}${actionHe}: ${route.labelHe}, ${route.provider}, ${cadenceHe}, ${exactnessHe}` };
}

export function resolveCanonicalMacroIndicator(input) {
  const row = input && typeof input === 'object' ? input : { indicator: input };
  const explicitKey = normalize(row.indicatorKey || row.canonicalKey);
  if (explicitKey) {
    const explicit = NORMALIZED_ROUTES.find((route) => route.normalizedKeys.includes(explicitKey));
    return explicit ? withAccessibleMetadata(explicit) : null;
  }
  const explicitUrl = String(row.sourceUrl || '').trim();
  if (explicitUrl) {
    const approved = NORMALIZED_ROUTES.find((route) => route.url && route.url === explicitUrl);
    if (approved) return withAccessibleMetadata(approved);
  }
  const indicator = normalize(row.indicator);
  if (!indicator) return null;
  const aliasMatch = NORMALIZED_ROUTES.find((route) => route.normalizedKeys.includes(indicator));
  return aliasMatch ? withAccessibleMetadata(aliasMatch) : null;
}

export { ROUTES as MACRO_INDICATOR_DESTINATIONS };
