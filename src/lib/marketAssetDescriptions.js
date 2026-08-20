export const UNKNOWN_MARKET_ASSET_DESCRIPTION = 'אין תיאור זמין';

export const MARKET_ASSET_DESCRIPTIONS = Object.freeze({
  RSP: 'קרן סל העוקבת אחר מניות S&P 500 במשקל שווה; מסייעת לבחון את רוחב השוק',
  ETH: 'המטבע של רשת Ethereum ומדד לפעילות בשוק הנכסים הדיגיטליים',
  SPX: 'מדד S&P 500 המייצג חברות אמריקאיות גדולות',
  NASDAQ: 'מדד מניות אמריקאי בעל משקל משמעותי לחברות טכנולוגיה וצמיחה',
  DOW: 'מדד דאו ג׳ונס הכולל 30 חברות אמריקאיות גדולות',
  RUSSELL: 'מדד Russell 2000 המייצג חברות אמריקאיות קטנות',
  VIX: 'מדד התנודתיות הצפויה בשוק לפי אופציות על S&P 500',
  OIL: 'מחיר הנפט הגולמי, המשפיע על אנרגיה, עלויות ואינפלציה',
  DOLLAR: 'מדד לעוצמת הדולר האמריקאי מול סל מטבעות',
  BITCOIN: 'הנכס הדיגיטלי ביטקוין ושוק הקריפטו',
  BONDS10Y: 'תשואת אג״ח ממשלת ארה״ב לעשר שנים, המשפיעה על עלויות המימון ותמחור נכסים',
});

const MARKET_ASSET_DESCRIPTION_ALIASES = Object.freeze({
  BTC: 'BITCOIN',
  US10Y: 'BONDS10Y',
  DJI: 'DOW',
  DJIA: 'DOW',
  RUT: 'RUSSELL',
});

export function normalizeMarketAssetDescriptionId(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return MARKET_ASSET_DESCRIPTION_ALIASES[normalized] || normalized;
}

export function getMarketAssetDescription(value) {
  const identifier = normalizeMarketAssetDescriptionId(value);
  return MARKET_ASSET_DESCRIPTIONS[identifier] || UNKNOWN_MARKET_ASSET_DESCRIPTION;
}
