import assetAliases from '../../shared/marketAssetAliases.json';

const DESTINATIONS = Object.freeze({
  SPX: ['finviz', 'finviz-etf', 'SPY', 'https://finviz.com/stock?t=SPY'],
  NASDAQ: ['finviz', 'finviz-etf', 'QQQ', 'https://finviz.com/stock?t=QQQ'],
  DOW: ['finviz', 'finviz-etf', 'DIA', 'https://finviz.com/stock?t=DIA'],
  RUSSELL: ['finviz', 'finviz-etf', 'IWM', 'https://finviz.com/stock?t=IWM'],
  VIX: ['finviz', 'finviz-futures', 'VX', 'https://finviz.com/futures?p=d&t=VX'],
  OIL: ['finviz', 'finviz-futures', 'CL', 'https://finviz.com/futures?p=d&t=CL'],
  DOLLAR: ['finviz', 'finviz-futures', 'DX', 'https://finviz.com/futures?p=d&t=DX'],
  BITCOIN: ['finviz', 'finviz-crypto', 'BTCUSD', 'https://finviz.com/crypto?t=BTCUSD'],
  BONDS10Y: ['investing-israel', 'investing-yield', 'US10Y', 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield'],
});

export function canonicalizeExternalMarketAsset(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  return normalized ? (assetAliases[normalized] || '') : '';
}

export function getMarketAssetDestination(value) {
  const canonicalAsset = canonicalizeExternalMarketAsset(value);
  const destination = DESTINATIONS[canonicalAsset];
  if (!destination) return null;
  const [provider, destinationType, destinationSymbol, url] = destination;
  return { canonicalAsset, provider, destinationType, destinationSymbol, url };
}

export const MARKET_ASSET_DESTINATIONS = DESTINATIONS;
