import assetAliases from '../../shared/marketAssetAliases.json';

const DESTINATIONS = Object.freeze({
  SPX: {
    provider: 'finviz',
    destinationType: 'finviz-etf',
    destinationSymbol: 'SPY',
    url: 'https://finviz.com/stock?t=SPY',
    labelHe: 'SPY — תעודת סל המייצגת את S&P 500',
    tooltipHe: 'פתח את SPY, תעודת הסל המייצגת את S&P 500, ב־Finviz',
    exact: false,
  },
  NASDAQ: {
    provider: 'finviz',
    destinationType: 'finviz-etf',
    destinationSymbol: 'QQQ',
    url: 'https://finviz.com/stock?t=QQQ',
    labelHe: 'QQQ — תעודת סל המייצגת את Nasdaq-100',
    tooltipHe: 'פתח את QQQ, תעודת הסל המייצגת את Nasdaq-100, ב־Finviz',
    exact: false,
  },
  DOW: {
    provider: 'finviz',
    destinationType: 'finviz-etf',
    destinationSymbol: 'DIA',
    url: 'https://finviz.com/stock?t=DIA',
    labelHe: 'DIA — תעודת סל המייצגת את Dow Jones',
    tooltipHe: 'פתח את DIA, תעודת הסל המייצגת את Dow Jones, ב־Finviz',
    exact: false,
  },
  RUSSELL: {
    provider: 'finviz',
    destinationType: 'finviz-etf',
    destinationSymbol: 'IWM',
    url: 'https://finviz.com/stock?t=IWM',
    labelHe: 'IWM — תעודת סל המייצגת את Russell 2000',
    tooltipHe: 'פתח את IWM, תעודת הסל המייצגת את Russell 2000, ב־Finviz',
    exact: false,
  },
  VIX: {
    provider: 'finviz',
    destinationType: 'finviz-futures',
    destinationSymbol: 'VX',
    url: 'https://finviz.com/futures?p=d&t=VX',
    labelHe: 'VX — חוזי VIX',
    tooltipHe: 'פתח חוזי VIX ב־Finviz; היעד מציג חוזים ולא את מדד ה־VIX הספוט',
    exact: false,
  },
  OIL: {
    provider: 'finviz',
    destinationType: 'finviz-futures',
    destinationSymbol: 'CL',
    url: 'https://finviz.com/futures?p=d&t=CL',
    labelHe: 'CL — חוזי נפט גולמי WTI',
    tooltipHe: 'פתח חוזי נפט WTI ב־Finviz',
    exact: false,
  },
  DOLLAR: {
    provider: 'finviz',
    destinationType: 'finviz-futures',
    destinationSymbol: 'DX',
    url: 'https://finviz.com/futures?p=d&t=DX',
    labelHe: 'DX — חוזי מדד הדולר האמריקאי',
    tooltipHe: 'פתח חוזי מדד הדולר ב־Finviz',
    exact: false,
  },
  BITCOIN: {
    provider: 'finviz',
    destinationType: 'finviz-crypto',
    destinationSymbol: 'BTCUSD',
    url: 'https://finviz.com/crypto?t=BTCUSD',
    labelHe: 'BTC/USD — Bitcoin מול הדולר',
    tooltipHe: 'פתח את Bitcoin מול הדולר ב־Finviz',
    exact: true,
  },
  BONDS10Y: {
    provider: 'investing-israel',
    destinationType: 'investing-yield',
    destinationSymbol: 'US10Y',
    url: 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield',
    labelHe: 'תשואת אג״ח ארצות הברית ל־10 שנים',
    tooltipHe: 'פתח את תשואת אג״ח ארצות הברית ל־10 שנים ב־Investing ישראל',
    ariaLabelHe: 'פתח את נתוני תשואת אג״ח ארצות הברית ל־10 שנים באתר Investing ישראל',
    exact: true,
  },
});

export function canonicalizeExternalMarketAsset(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  return normalized ? (assetAliases[normalized] || '') : '';
}

export function getMarketAssetDestination(value) {
  const canonicalAsset = canonicalizeExternalMarketAsset(value);
  const destination = DESTINATIONS[canonicalAsset];
  return destination ? { canonicalAsset, ...destination } : null;
}

export const MARKET_ASSET_DESTINATIONS = DESTINATIONS;
