import { lookupTradingViewSymbol } from '../utils/finvizLinks.js';
import { resolveSectorTableFinvizLink } from './sectorTablePresentation.js';

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

function verifiedQuoteAsset(key, type, aliases, exchange) {
  return Object.freeze({
    key,
    type,
    aliases,
    finviz: `https://finviz.com/stock?t=${key}`,
    tradingViewLookup: key,
    tradingViewSymbol: `${exchange}:${key}`,
  });
}

const VERIFIED_MARKET_ASSETS = Object.freeze([
  verifiedQuoteAsset('MSFT', 'stock', ['MSFT', 'MICROSOFT', 'מיקרוסופט'], 'NASDAQ'),
  verifiedQuoteAsset('AAPL', 'stock', ['AAPL', 'APPLE', 'אפל'], 'NASDAQ'),
  verifiedQuoteAsset('NVDA', 'stock', ['NVDA', 'NVIDIA', 'אנבידיה', 'נבידיה'], 'NASDAQ'),
  verifiedQuoteAsset('TSLA', 'stock', ['TSLA', 'TESLA', 'טסלה'], 'NASDAQ'),
  verifiedQuoteAsset('GOOGL', 'stock', ['GOOGL', 'GOOGLE', 'ALPHABET', 'גוגל', 'אלפבית'], 'NASDAQ'),
  verifiedQuoteAsset('META', 'stock', ['META', 'מטא'], 'NASDAQ'),
  verifiedQuoteAsset('AMZN', 'stock', ['AMZN', 'AMAZON', 'אמזון'], 'NASDAQ'),
  verifiedQuoteAsset('SPY', 'etf', ['SPY'], 'AMEX'),
  verifiedQuoteAsset('QQQ', 'etf', ['QQQ'], 'NASDAQ'),
  verifiedQuoteAsset('IWM', 'etf', ['IWM'], 'AMEX'),
  verifiedQuoteAsset('DIA', 'etf', ['DIA'], 'AMEX'),
  {
    key: 'RSP',
    type: 'etf',
    aliases: ['RSP'],
    finviz: 'https://finviz.com/stock?t=RSP',
  },
  {
    key: 'ETH',
    type: 'crypto',
    aliases: ['ETH', 'ETHEREUM'],
    investing: 'https://il.investing.com/crypto/ethereum',
    tradingViewLookup: 'ETH',
    tradingViewSymbol: 'BITSTAMP:ETHUSD',
  },
  {
    key: 'SPX',
    type: 'index',
    aliases: ['SPX', 'S&P 500', 'S&P500', 'SP500'],
    finviz: 'https://finviz.com/stock?t=SPY',
    finvizRelation: 'proxy',
    finvizQualifier: 'נציג S&P 500 · ETF SPY',
    finvizFuturesSymbol: 'ES',
    finvizFuturesUrl: 'https://finviz.com/futures?t=ES',
    finvizFuturesLabel: 'חוזה S&P 500',
    investing: 'https://il.investing.com/indices/us-spx-500',
    tradingViewLookup: 'SPX',
    tradingViewSymbol: 'SP:SPX',
  },
  {
    key: 'NASDAQ',
    type: 'index',
    aliases: ['NASDAQ', 'NASDAQ COMPOSITE', 'NASDAQ 100', 'NASDAQ100', 'NDX', 'IXIC'],
    finviz: 'https://finviz.com/stock?t=QQQ',
    finvizRelation: 'proxy',
    finvizQualifier: 'נציג Nasdaq 100 · ETF QQQ',
    finvizFuturesSymbol: 'NQ',
    finvizFuturesUrl: 'https://finviz.com/futures?t=NQ',
    finvizFuturesLabel: 'חוזה Nasdaq 100',
    investing: 'https://il.investing.com/indices/nasdaq-composite',
    tradingViewLookup: 'NASDAQ',
    tradingViewSymbol: 'NASDAQ:IXIC',
  },
  {
    key: 'DOW',
    type: 'index',
    aliases: ['DOW', 'DOW JONES', 'DJIA'],
    finviz: 'https://finviz.com/stock?t=DIA',
    finvizRelation: 'proxy',
    finvizQualifier: 'נציג Dow Jones · ETF DIA',
    finvizFuturesSymbol: 'YM',
    finvizFuturesUrl: 'https://finviz.com/futures?t=YM',
    finvizFuturesLabel: 'חוזה Dow Jones',
    investing: 'https://il.investing.com/indices/us-30',
    tradingViewLookup: 'DOW',
    tradingViewSymbol: 'DJ:DJI',
  },
  {
    key: 'RUSSELL',
    type: 'index',
    aliases: ['RUSSELL', 'RUSSELL 2000', 'RUT'],
    finviz: 'https://finviz.com/stock?t=IWM',
    finvizRelation: 'proxy',
    finvizQualifier: 'נציג Russell 2000 · ETF IWM',
    finvizFuturesSymbol: 'ER2',
    finvizFuturesUrl: 'https://finviz.com/futures?t=ER2',
    finvizFuturesLabel: 'חוזה Russell 2000',
    investing: 'https://il.investing.com/indices/smallcap-2000',
    tradingViewLookup: 'RUSSELL',
    tradingViewSymbol: 'TVC:RUT',
  },
  {
    key: 'VIX',
    type: 'index',
    aliases: ['VIX'],
    finviz: 'https://finviz.com/stock?t=VIXY',
    finvizRelation: 'proxy',
    finvizQualifier: 'נציג חוזי VIX קצרים, לא מדד VIX המזומן · ETF VIXY',
    finvizFuturesSymbol: 'VX',
    finvizFuturesUrl: 'https://finviz.com/futures?t=VX',
    finvizFuturesLabel: 'חוזה VIX',
    investing: 'https://il.investing.com/indices/volatility-s-p-500',
    tradingViewLookup: 'VIX',
    tradingViewSymbol: 'CBOE:VIX',
    acceptedProjectTradingViewSymbol: 'TVC:VIX',
  },
  {
    key: 'OIL',
    type: 'commodity',
    aliases: ['OIL', 'WTI', 'USOIL', 'CRUDE OIL'],
    finviz: 'https://finviz.com/stock?t=USO',
    finvizRelation: 'proxy',
    finvizQualifier: 'קרן נציגת WTI המבוססת על חוזים · USO',
    finvizFuturesSymbol: 'CL',
    finvizFuturesUrl: 'https://finviz.com/futures?t=CL',
    finvizFuturesLabel: 'חוזה נפט גולמי WTI',
    investing: 'https://il.investing.com/commodities/crude-oil',
    tradingViewLookup: 'OIL',
    tradingViewSymbol: 'TVC:USOIL',
  },
  {
    key: 'DOLLAR',
    type: 'currency-index',
    aliases: ['DOLLAR', 'DXY', 'US DOLLAR INDEX', 'DOLLAR INDEX'],
    finviz: 'https://finviz.com/stock?t=UUP',
    finvizRelation: 'proxy',
    finvizQualifier: 'קרן נציגת מדד דולר שורית · UUP',
    finvizFuturesSymbol: 'DX',
    finvizFuturesUrl: 'https://finviz.com/futures?p=d&t=DX',
    finvizFuturesLabel: 'חוזה מדד דולר',
    investing: 'https://il.investing.com/indices/usdollar',
    tradingViewLookup: 'DOLLAR INDEX',
    tradingViewSymbol: 'TVC:DXY',
  },
  {
    key: 'BITCOIN',
    type: 'crypto',
    aliases: ['BITCOIN', 'BTC', 'BTCUSD'],
    finviz: 'https://finviz.com/crypto?t=BTCUSD',
    investing: 'https://il.investing.com/crypto/bitcoin',
    tradingViewLookup: 'BITCOIN',
    tradingViewSymbol: 'BITSTAMP:BTCUSD',
  },
  {
    key: 'BONDS10Y',
    type: 'yield',
    aliases: ['BONDS10Y', 'US10Y', '10Y'],
    finviz: 'https://finviz.com/stock?t=IEF',
    finvizRelation: 'proxy',
    finvizQualifier: 'קרן אג״ח ארה״ב ל־7–10 שנים; מחיר, לא תשואת US10Y · IEF',
    finvizFuturesSymbol: 'ZN',
    finvizFuturesUrl: 'https://finviz.com/futures?t=ZN',
    finvizFuturesLabel: 'חוזה אג״ח ארה״ב ל־10 שנים',
    investing: 'https://il.investing.com/rates-bonds/u.s.-10-year-bond-yield',
    tradingViewLookup: 'US10Y',
    tradingViewSymbol: 'TVC:US10Y',
  },
  {
    key: 'GOLD',
    type: 'commodity',
    aliases: ['GOLD', 'XAU', 'XAUUSD', 'זהב'],
    investing: 'https://il.investing.com/commodities/gold',
    tradingViewLookup: 'GOLD',
    tradingViewSymbol: 'TVC:GOLD',
  },
  {
    key: 'SILVER',
    type: 'commodity',
    aliases: ['SILVER', 'XAG', 'XAGUSD', 'כסף'],
    investing: 'https://il.investing.com/commodities/silver',
    tradingViewLookup: 'SILVER',
    tradingViewSymbol: 'TVC:SILVER',
  },
  {
    key: 'BRENT',
    type: 'commodity',
    aliases: ['BRENT', 'BRENT OIL', 'UKBRENT'],
    investing: 'https://il.investing.com/commodities/brent-oil',
    tradingViewLookup: 'BRENT',
    tradingViewSymbol: 'TVC:UKOIL',
  },
  {
    key: 'NATGAS',
    type: 'commodity',
    aliases: ['NATURAL GAS', 'NATGAS', 'גז טבעי'],
    investing: 'https://il.investing.com/commodities/natural-gas',
    tradingViewLookup: 'NATURAL GAS',
    tradingViewSymbol: 'TVC:NATGAS',
  },
  {
    key: 'COPPER',
    type: 'commodity',
    aliases: ['COPPER', 'נחושת'],
    investing: 'https://il.investing.com/commodities/copper',
    tradingViewLookup: 'COPPER',
    tradingViewSymbol: 'COMEX:HG1!',
  },
  {
    key: 'US2Y',
    type: 'yield',
    aliases: ['US2Y', '2Y', '2 YEAR YIELD', 'תשואת 2 שנים'],
    investing: 'https://il.investing.com/rates-bonds/u.s.-2-year-bond-yield',
  },
  {
    key: 'US5Y',
    type: 'yield',
    aliases: ['US5Y', '5Y', '5 YEAR YIELD', 'תשואת 5 שנים'],
    investing: 'https://il.investing.com/rates-bonds/u.s.-5-year-bond-yield',
  },
  {
    key: 'US30Y',
    type: 'yield',
    aliases: ['US30Y', '30Y', '30 YEAR YIELD', 'תשואת 30 שנים'],
    investing: 'https://il.investing.com/rates-bonds/u.s.-30-year-bond-yield',
  },
  {
    key: 'EURUSD',
    type: 'currency',
    aliases: ['EUR/USD', 'EURUSD', 'EURO', 'אירו'],
    investing: 'https://il.investing.com/currencies/eur-usd',
  },
  {
    key: 'USDILS',
    type: 'currency',
    aliases: ['USD/ILS', 'USDILS', 'DOLLAR SHEKEL', 'דולר שקל'],
    investing: 'https://il.investing.com/currencies/usd-ils',
  },
  {
    key: 'USDJPY',
    type: 'currency',
    aliases: ['USD/JPY', 'USDJPY', 'YEN', 'יין'],
    investing: 'https://il.investing.com/currencies/usd-jpy',
  },
  {
    key: 'KOSPI',
    type: 'index',
    aliases: ['KOSPI', 'SOUTH KOREAN KOSPI'],
    tradingViewLookup: 'KOSPI',
    tradingViewSymbol: 'KRX:KOSPI',
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

const PROVIDER_HOSTS = Object.freeze({
  finviz: new Set(['finviz.com', 'www.finviz.com']),
  investing: new Set(['il.investing.com']),
  tradingView: new Set(['tradingview.com', 'www.tradingview.com', 'il.tradingview.com']),
});

function getRawAssetValue(rawAsset) {
  if (!rawAsset || typeof rawAsset !== 'object') return rawAsset;
  return rawAsset.canonicalKey
    ?? rawAsset.symbol
    ?? rawAsset.ticker
    ?? rawAsset.asset
    ?? rawAsset.name
    ?? rawAsset.label
    ?? '';
}

function getAssetType(rawAsset) {
  if (!rawAsset || typeof rawAsset !== 'object') return '';
  return normalizeMarketAssetAlias(rawAsset.assetType ?? rawAsset.instrumentType ?? rawAsset.type);
}

function validateProviderUrl(provider, rawUrl) {
  if (!rawUrl || !PROVIDER_HOSTS[provider]) return null;
  try {
    const parsed = new URL(String(rawUrl));
    if (parsed.protocol !== 'https:' || !PROVIDER_HOSTS[provider].has(parsed.hostname.toLowerCase())) return null;
    if (/\/(?:search|markets\/stocks)\/?$/i.test(parsed.pathname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveTypedAsset(rawValue, assetType) {
  const normalized = normalizeMarketAssetAlias(rawValue);
  if (!normalized) return null;

  if (assetType === 'STOCK' || assetType === 'ETF') {
    const tradingViewSymbol = lookupTradingViewSymbol(normalized);
    if (!tradingViewSymbol || !tradingViewSymbol.endsWith(`:${normalized}`)) return null;
    return Object.freeze({
      key: normalized,
      type: assetType.toLowerCase(),
      aliases: [normalized],
      finviz: `https://finviz.com/stock?t=${normalized}`,
      tradingViewSymbol,
    });
  }

  if (assetType === 'SECTOR') {
    const sectorProxy = resolveSectorTableFinvizLink(rawValue);
    if (!sectorProxy?.ticker || !sectorProxy.url) return null;
    return Object.freeze({
      key: `SECTOR:${sectorProxy.ticker}`,
      type: 'sector',
      aliases: [rawValue],
      finviz: sectorProxy.url,
      tradingViewSymbol: lookupTradingViewSymbol(sectorProxy.ticker),
      relation: 'proxy',
      qualifier: `ETF ${sectorProxy.ticker}`,
    });
  }

  return null;
}

function getExplicitProviderUrl(rawAsset, provider, registryUrl) {
  if (!rawAsset || typeof rawAsset !== 'object') return null;
  const verifiedUrls = rawAsset.verifiedProviderUrls;
  const verifiedCandidate = verifiedUrls && typeof verifiedUrls === 'object'
    ? verifiedUrls[provider]
    : null;
  const verifiedUrl = validateProviderUrl(provider, verifiedCandidate);
  if (verifiedUrl) return verifiedUrl;

  const legacyField = {
    finviz: 'finvizUrl',
    investing: 'investingUrl',
    tradingView: 'tradingViewUrl',
  }[provider];
  const legacyUrl = validateProviderUrl(provider, rawAsset[legacyField]);
  const normalizedRegistryUrl = validateProviderUrl(provider, registryUrl);
  return legacyUrl && normalizedRegistryUrl && legacyUrl === normalizedRegistryUrl ? legacyUrl : null;
}

function buildProviderLink(provider, url, displaySymbol, asset) {
  const meta = PROVIDER_META[provider];
  const verifiedUrl = validateProviderUrl(provider, url);
  if (!meta || !verifiedUrl) return null;
  const qualifier = asset?.[`${provider}Qualifier`] ?? asset?.qualifier ?? null;
  const relation = asset?.[`${provider}Relation`] ?? asset?.relation ?? 'direct';
  return Object.freeze({
    provider,
    label: meta.label,
    url: verifiedUrl,
    qualifier,
    relation,
    primaryEligible: asset?.[`${provider}PrimaryEligible`] !== false,
    tooltip: meta.tooltip,
    ariaLabel: qualifier
      ? `פתיחת ${displaySymbol} באתר ${meta.accessibleName} באמצעות ${qualifier}`
      : `פתיחת ${displaySymbol} באתר ${meta.accessibleName}`,
  });
}

function buildFinvizFuturesLink(asset) {
  const symbol = String(asset?.finvizFuturesSymbol || '').trim();
  const url = validateProviderUrl('finviz', asset?.finvizFuturesUrl);
  const label = String(asset?.finvizFuturesLabel || '').trim();
  if (!symbol || !url || !label) return null;
  return Object.freeze({
    provider: 'finviz',
    symbol,
    url,
    relation: 'futures',
    tooltip: `${label} · Finviz ${symbol}`,
    ariaLabel: `פתיחת גרף ${label} ב־Finviz, סימול חוזה ${symbol}`,
  });
}

export function selectPreferredMarketAssetLink(linksByProvider = {}) {
  for (const provider of MARKET_ASSET_PROVIDER_PRIORITY) {
    const link = linksByProvider?.[provider];
    if (link && link.primaryEligible !== false) return link;
  }
  return null;
}

export function filterMarketAssetProviderLinks(links = [], hiddenProviders = []) {
  const hidden = new Set(hiddenProviders);
  return links.filter((link) => !hidden.has(link.provider));
}

export function resolveMarketAssetProviderLinks(rawAsset) {
  const rawValue = String(getRawAssetValue(rawAsset) ?? '');
  const displaySymbol = rawValue.trim();
  const assetType = getAssetType(rawAsset);
  const asset = MARKET_ASSET_BY_ALIAS.get(normalizeMarketAssetAlias(rawValue))
    || resolveTypedAsset(rawValue, assetType);
  if (!asset || !displaySymbol) return null;

  const linksByProvider = {};
  const finvizUrl = getExplicitProviderUrl(rawAsset, 'finviz', asset.finviz) || asset.finviz;
  if (finvizUrl) {
    linksByProvider.finviz = buildProviderLink('finviz', finvizUrl, displaySymbol, asset);
  }
  const investingUrl = getExplicitProviderUrl(rawAsset, 'investing', asset.investing) || asset.investing;
  if (investingUrl) {
    linksByProvider.investing = buildProviderLink('investing', investingUrl, displaySymbol, asset);
  }

  const projectTradingViewSymbol = asset.tradingViewLookup
    ? lookupTradingViewSymbol(asset.tradingViewLookup)
    : asset.tradingViewSymbol;
  const isVerifiedProjectMapping = Boolean(asset.tradingViewSymbol) && (
    !asset.tradingViewLookup
    || projectTradingViewSymbol === (asset.acceptedProjectTradingViewSymbol || asset.tradingViewSymbol)
  );
  const registryTradingViewUrl = isVerifiedProjectMapping
    ? `${TRADINGVIEW_CHART_BASE}${encodeURIComponent(asset.tradingViewSymbol)}`
    : null;
  const tradingViewUrl = getExplicitProviderUrl(rawAsset, 'tradingView', registryTradingViewUrl)
    || registryTradingViewUrl;
  if (tradingViewUrl) {
    linksByProvider.tradingView = buildProviderLink('tradingView', tradingViewUrl, displaySymbol, asset);
  }

  const links = MARKET_ASSET_PROVIDER_PRIORITY
    .map((provider) => linksByProvider[provider])
    .filter(Boolean);
  if (links.length === 0) return null;
  const preferred = selectPreferredMarketAssetLink(linksByProvider);
  const futures = buildFinvizFuturesLink(asset);

  return Object.freeze({
    rawValue,
    canonicalKey: asset.key,
    assetType: asset.type || assetType.toLowerCase() || 'unknown',
    relation: preferred?.relation ?? asset.relation ?? 'direct',
    qualifier: preferred?.qualifier ?? asset.qualifier ?? null,
    links: Object.freeze(links),
    preferred,
    futures,
  });
}
