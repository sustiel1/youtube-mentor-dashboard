import { getTradingViewPublicDestination } from './tradingViewDestinations';

const TECHNICALS_BASE = 'https://www.tradingview.com/symbols/';

const CANONICAL_SECTORS = Object.freeze([
  { canonicalKey: 'technology', labelEn: 'Technology', etf: 'XLK', aliases: ['technology', 'טכנולוגיה'] },
  { canonicalKey: 'communication-services', labelEn: 'Communication Services', etf: 'XLC', aliases: ['communication services', 'communications', 'תקשורת'] },
  { canonicalKey: 'consumer-discretionary', labelEn: 'Consumer Discretionary', etf: 'XLY', aliases: ['consumer discretionary', 'consumer cyclical', 'discretionary', 'צריכה מחזורית', 'צרכנות מחזורית'] },
  { canonicalKey: 'consumer-staples', labelEn: 'Consumer Staples', etf: 'XLP', aliases: ['consumer staples', 'consumer defensive', 'צריכה בסיסית', 'צרכנות בסיסית'] },
  { canonicalKey: 'energy', labelEn: 'Energy', etf: 'XLE', aliases: ['energy', 'אנרגיה'] },
  { canonicalKey: 'financials', labelEn: 'Financials', etf: 'XLF', aliases: ['financial', 'financials', 'finance', 'פיננסים', 'פיננסיים'] },
  { canonicalKey: 'health-care', labelEn: 'Health Care', etf: 'XLV', aliases: ['healthcare', 'health care', 'בריאות'] },
  { canonicalKey: 'industrials', labelEn: 'Industrials', etf: 'XLI', aliases: ['industrials', 'תעשייה'] },
  { canonicalKey: 'materials', labelEn: 'Materials', etf: 'XLB', aliases: ['materials', 'basic materials', 'חומרי גלם', 'חומרים'] },
  { canonicalKey: 'real-estate', labelEn: 'Real Estate', etf: 'XLRE', aliases: ['real estate', 'נדלן', 'נדל״ן', 'נדל"ן'] },
  { canonicalKey: 'utilities', labelEn: 'Utilities', etf: 'XLU', aliases: ['utilities', 'שירותים ציבוריים', 'תשתיות'] },
]);

const normalize = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/["״׳']/g, '')
  .replace(/\s+/g, ' ');

const SECTOR_BY_ALIAS = new Map(
  CANONICAL_SECTORS.flatMap((entry) => entry.aliases.map((alias) => [normalize(alias), entry])),
);

function buildTechnicalsDestination(entry, resolutionSource) {
  const publicDestination = getTradingViewPublicDestination(entry.etf);
  if (!publicDestination || publicDestination.instrumentType !== 'etf') return null;
  const qualified = publicDestination.tradingViewSymbol.replace(':', '-');
  return {
    ...entry,
    url: `${TECHNICALS_BASE}${qualified}/technicals/`,
    provider: 'TradingView',
    resolutionSource,
    tooltipHe: `פתח RSI וניתוח טכני עבור סקטור ${entry.labelEn} באמצעות ETF ${entry.etf} ב־TradingView`,
    ariaLabelHe: `פתח RSI וניתוח טכני עבור סקטור ${entry.labelEn}, תעודת סל ${entry.etf}, באתר TradingView`,
  };
}

export function resolveSectorTechnicals({ sector, sourceEtf, legacyEtf } = {}) {
  const canonical = SECTOR_BY_ALIAS.get(normalize(sector));
  if (canonical) return buildTechnicalsDestination(canonical, 'canonical-sector');

  const explicitEtf = String(sourceEtf || legacyEtf || '').trim().toUpperCase();
  if (!explicitEtf) return null;
  const verified = getTradingViewPublicDestination(explicitEtf);
  if (!verified || verified.instrumentType !== 'etf') return null;
  return buildTechnicalsDestination({
    canonicalKey: null,
    labelEn: String(sector || explicitEtf).trim(),
    etf: explicitEtf,
    aliases: [],
  }, sourceEtf ? 'source-etf' : 'legacy-etf');
}

export const CANONICAL_SECTOR_TECHNICALS = CANONICAL_SECTORS;
