import { getMarketAssetDestination } from './marketAssetDestinations';

export const SECTOR_RESEARCH_TOOLS = Object.freeze([
  { id: 'finviz-map', labelHe: 'מפת סקטורים', provider: 'Finviz', url: 'https://finviz.com/map?t=sec_all' },
  { id: 'finviz-daily', labelHe: 'ביצועים יומיים', provider: 'Finviz', url: 'https://finviz.com/groups?g=sector&v=140&o=-change' },
  { id: 'finviz-weekly', labelHe: 'ביצועים שבועיים', provider: 'Finviz', url: 'https://finviz.com/groups?g=sector&v=140&o=perf1w' },
  { id: 'finviz-monthly', labelHe: 'ביצועים חודשיים', provider: 'Finviz', url: 'https://finviz.com/groups?g=sector&v=140&o=perf4w' },
  { id: 'tradingview-heatmap', labelHe: 'מפת חום', provider: 'TradingView', url: 'https://www.tradingview.com/heatmap/stock/' },
  { id: 'state-street-tracker', labelHe: 'מעקב סקטורים', provider: 'State Street', url: 'https://www.ssga.com/us/en/intermediary/resources/sector-tracker' },
]);

const SECTORS = Object.freeze([
  { key: 'technology', labelHe: 'טכנולוגיה', etf: 'XLK', exchange: 'AMEX', aliases: ['technology', 'טכנולוגיה'] },
  { key: 'communication-services', labelHe: 'שירותי תקשורת', etf: 'XLC', exchange: 'AMEX', aliases: ['communication services', 'communications', 'תקשורת', 'שירותי תקשורת'] },
  { key: 'consumer-discretionary', labelHe: 'צריכה מחזורית', etf: 'XLY', exchange: 'AMEX', aliases: ['consumer discretionary', 'consumer cyclical', 'discretionary', 'צריכה מחזורית', 'צרכנות מחזורית'] },
  { key: 'consumer-staples', labelHe: 'צריכה בסיסית', etf: 'XLP', exchange: 'AMEX', aliases: ['consumer staples', 'consumer defensive', 'צריכה בסיסית', 'צרכנות בסיסית'] },
  { key: 'energy', labelHe: 'אנרגיה', etf: 'XLE', exchange: 'AMEX', aliases: ['energy', 'אנרגיה'] },
  { key: 'financials', labelHe: 'פיננסים', etf: 'XLF', exchange: 'AMEX', aliases: ['financial', 'financials', 'finance', 'פיננסים', 'פיננסיים'] },
  { key: 'health-care', labelHe: 'בריאות', etf: 'XLV', exchange: 'AMEX', aliases: ['health care', 'healthcare', 'בריאות'] },
  { key: 'industrials', labelHe: 'תעשייה', etf: 'XLI', exchange: 'AMEX', aliases: ['industrials', 'industrial', 'תעשייה'] },
  { key: 'materials', labelHe: 'חומרי גלם', etf: 'XLB', exchange: 'AMEX', aliases: ['materials', 'basic materials', 'חומרי גלם', 'חומרים'] },
  { key: 'real-estate', labelHe: 'נדל״ן', etf: 'XLRE', exchange: 'AMEX', aliases: ['real estate', 'נדלן', 'נדל״ן', 'נדל"ן'] },
  { key: 'utilities', labelHe: 'שירותים ציבוריים', etf: 'XLU', exchange: 'AMEX', aliases: ['utilities', 'שירותים ציבוריים', 'תשתיות'] },
]);

function normalizeSector(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/["'׳״]/g, '')
    .replace(/\s+/g, ' ');
}

const SECTOR_BY_ALIAS = new Map(
  SECTORS.flatMap((sector) => [
    ...sector.aliases.map((alias) => [normalizeSector(alias), sector]),
    [normalizeSector(sector.etf), sector],
  ]),
);

export function resolveSectorTools(input, explicitEtf = '') {
  const source = input && typeof input === 'object' ? input : { sector: input, etf: explicitEtf };
  const sectorValue = source.sector || source.name || '';
  const etfValue = String(source.etf || source.sourceEtf || explicitEtf || '').trim().toUpperCase();
  const sector = SECTOR_BY_ALIAS.get(normalizeSector(sectorValue)) ||
    SECTOR_BY_ALIAS.get(normalizeSector(etfValue));
  if (!sector || (etfValue && etfValue !== sector.etf)) return null;

  const etfDestination = getMarketAssetDestination(sector.etf);
  if (!etfDestination || etfDestination.destinationType !== 'finviz-etf') return null;

  return {
    ...sector,
    etfDestination,
    technicalsUrl: `https://www.tradingview.com/symbols/${sector.exchange}-${sector.etf}/technicals/`,
    researchTools: SECTOR_RESEARCH_TOOLS,
  };
}

export const CANONICAL_SECTOR_TOOLS = SECTORS;
