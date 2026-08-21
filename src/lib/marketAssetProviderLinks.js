import { lookupTradingViewSymbol } from '../utils/finvizLinks.js';

const TRADINGVIEW_CHART_BASE = 'https://www.tradingview.com/chart/?symbol=';

const PROVIDER_META = Object.freeze({
  finviz: {
    label: 'Finviz',
    accessibleName: 'Finviz',
    tooltip: 'פתיחה ב־Finviz',
  },
  investing: {
    label: 'Investing',
    accessibleName: 'Investing.com ישראל',
    tooltip: 'פתיחה ב־Investing.com ישראל',
  },
  tradingView: {
    label: 'TradingView',
    accessibleName: 'TradingView',
    tooltip: 'פתיחה ב־TradingView',
  },
});

export const MARKET_ASSET_PROVIDER_PRIORITY = Object.freeze([
  'finviz',
  'investing',
  'tradingView',
]);

const VERIFIED_MARKET_ASSETS = Object.freeze([
  {
    key: 'RSP',
    aliases: ['RSP'],
    finviz: 'https://finviz.com/stock?t=RSP',
  },
  {
    key: 'ETH',
    aliases: ['ETH', 'ETHEREUM'],
    investing: 'https://il.investing.com/crypto/ethereum',
    tradingViewLookup: 'ETH',
    tradingViewSymbol: 'BITSTAMP:ETHUSD',
  },
  {
    key: 'SPX',
    aliases: ['SPX', 'S&P 500', 'S&P500', 'SP500'],
    investing: 'https://il.investing.com/indices/us-spx-500',
    tradingViewLookup: 'SPX',
    tradingViewSymbol: 'SP:SPX',
  },
  {
    key: 'NASDAQ',
    aliases: ['NASDAQ', 'NASDAQ COMPOSITE', 'IXIC'],
    investing: 'https://il.investing.com/indices/nasdaq-composite',
    tradingViewLookup: 'NASDAQ',
    tradingViewSymbol: 'NASDAQ:IXIC',
  },
  {
    key: 'DOW',
    aliases: ['DOW', 'DOW JONES', 'DJIA'],
    investing: 'https://il.investing.com/indices/us-30',
    tradingViewLookup: 'DOW',
    tradingViewSymbol: 'DJ:DJI',
  },
  {
    key: 'RUSSELL',
    aliases: ['RUSSELL', 'RUSSELL 2000', 'RUT'],
    investing: 'https://il.investing.com/indices/smallcap-2000',
    tradingViewLookup: 'RUSSELL',
    tradingViewSymbol: 'TVC:RUT',
  },
  {
    key: 'VIX',
    aliases: ['VIX'],
    investing: 'https://il.investing.com/indices/volatility-s-p-500',
    tradingViewLookup: 'VIX',
    tradingViewSymbol: 'CBOE:VIX',
    acceptedProjectTradingViewSymbol: 'TVC:VIX',
  },
  {
    key: 'OIL',
    aliases: ['OIL', 'WTI', 'USOIL', 'CRUDE OIL'],
    investing: 'https://il.investing.com/commodities/crude-oil',
    tradingViewLookup: 'OIL',
    tradingViewSymbol: 'TVC:USOIL',
  },
  {
    key: 'DOLLAR',
    aliases: ['DOLLAR', 'DXY', 'US DOLLAR INDEX', 'DOLLAR INDEX'],
    investing: 'https://il.investing.com/indices/usdollar',
    tradingViewLookup: 'DOLLAR INDEX',
    tradingViewSymbol: 'TVC:DXY',
  },
  {
    key: 'BITCOIN',
    aliases: ['BITCOIN', 'BTC', 'BTCUSD'],
    investing: 'https://il.investing.com/crypto/bitcoin',
    tradingViewLookup: 'BITCOIN',
    tradingViewSymbol: 'BITSTAMP:BTCUSD',
  },
  {
    key: 'BONDS10Y',
    aliases: ['BONDS10Y', 'US10Y', '10Y'],
    investing: 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield',
    tradingViewLookup: 'US10Y',
    tradingViewSymbol: 'TVC:US10Y',
  },
]);

function normalizeMarketAssetAlias(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

const MARKET_ASSET_BY_ALIAS = new Map();
for (const asset of VERIFIED_MARKET_ASSETS) {
  for (const alias of asset.aliases) {
    MARKET_ASSET_BY_ALIAS.set(normalizeMarketAssetAlias(alias), asset);
  }
}

function buildProviderLink(provider, url, displaySymbol) {
  const meta = PROVIDER_META[provider];
  if (!meta || !url) return null;
  return Object.freeze({
    provider,
    label: meta.label,
    url,
    tooltip: meta.tooltip,
    ariaLabel: `פתיחת ${displaySymbol} באתר ${meta.accessibleName}`,
  });
}

export function selectPreferredMarketAssetLink(linksByProvider = {}) {
  for (const provider of MARKET_ASSET_PROVIDER_PRIORITY) {
    if (linksByProvider?.[provider]) return linksByProvider[provider];
  }
  return null;
}

export function resolveMarketAssetProviderLinks(rawAsset) {
  const rawValue = String(rawAsset ?? '');
  const displaySymbol = rawValue.trim();
  const asset = MARKET_ASSET_BY_ALIAS.get(normalizeMarketAssetAlias(rawValue));
  if (!asset || !displaySymbol) return null;

  const linksByProvider = {};
  if (asset.finviz) {
    linksByProvider.finviz = buildProviderLink('finviz', asset.finviz, displaySymbol);
  }
  if (asset.investing) {
    linksByProvider.investing = buildProviderLink('investing', asset.investing, displaySymbol);
  }

  if (asset.tradingViewSymbol && asset.tradingViewLookup) {
    const resolvedTradingViewSymbol = lookupTradingViewSymbol(asset.tradingViewLookup);
    const isVerifiedProjectMapping = resolvedTradingViewSymbol === (
      asset.acceptedProjectTradingViewSymbol || asset.tradingViewSymbol
    );
    if (isVerifiedProjectMapping) {
      const tradingViewUrl = `${TRADINGVIEW_CHART_BASE}${encodeURIComponent(asset.tradingViewSymbol)}`;
      linksByProvider.tradingView = buildProviderLink('tradingView', tradingViewUrl, displaySymbol);
    }
  }

  const links = MARKET_ASSET_PROVIDER_PRIORITY
    .map((provider) => linksByProvider[provider])
    .filter(Boolean);
  if (links.length === 0) return null;

  return Object.freeze({
    rawValue,
    canonicalKey: asset.key,
    links: Object.freeze(links),
    preferred: selectPreferredMarketAssetLink(linksByProvider),
  });
}
